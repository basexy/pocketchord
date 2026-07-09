// main.js — bootstrap and wiring between chords (theory), audio, drums,
// looper, song builder and UI. Owns the pattern/song mode switch and
// localStorage persistence.

/* global Tone */

import {
  diatonicChord, allDegreeChords, voiceLead, midiToName, noteNamesFor,
} from './chords.js';
import { AudioEngine } from './audio-engine.js';
import { Looper } from './looper.js';
import { DrumMachine } from './drums.js';
import { Song, patternById } from './song.js';
import { UI } from './ui.js';

const LS_KEY = 'pocketchord-project-v1';

const state = {
  rootPc: 0,
  mode: 'major',
  flavor: 'triad',
  timbre: 'pad',
  bpm: 100,
  prevVoicing: null,
  songMode: false, // false: live loop (pattern) · true: playlist playback
};

const held = new Map(); // degree -> note names currently sounding
let selectedPatternId = null;
let restoring = false;

const audio = new AudioEngine();
const drums = new DrumMachine((step) => ui.drumPlayhead(step));
const looper = new Looper(audio, (loopState) => {
  ui.updateLoop({ ...loopState, songMode: state.songMode });
  ui.updateSongMode(state.songMode, loopState.playing);
  if (!loopState.playing) {
    ui.drumPlayhead(-1);
    ui.setPlayhead(-1);
  } else if (state.songMode && loopState.bar !== undefined) {
    ui.setPlayhead(loopState.bar);
  }
});
const song = new Song(audio, drums, onSongChange);

function onSongChange() {
  renderSongView();
  persist();
  if (state.songMode && audio.started) {
    song.schedule();
    Tone.Transport.loopEnd = `${song.bars}m`;
  }
}

/* ---------- pattern/song mode ---------- */

function enterPatternMode() {
  if (!state.songMode) return;
  looper.stop();
  song.unschedule();
  looper.reschedule();
  drums.liveEnabled = true;
  Tone.Transport.loopEnd = `${looper.bars}m`;
  state.songMode = false;
  ui.updateSongMode(false, false);
}

function enterSongMode() {
  if (state.songMode) return;
  looper.stop();
  looper.unschedule();
  drums.liveEnabled = false;
  song.schedule();
  Tone.Transport.loopEnd = `${song.bars}m`;
  state.songMode = true;
}

/* ---------- UI ---------- */

const ui = new UI({
  start: async () => {
    await audio.start();
    drums.build(audio.limiter);
    drums.init();
    looper.init();
    audio.setBpm(state.bpm);
    audio.setTimbre(state.timbre);
    ui.hideOverlay();
  },

  degreeOn: (degree) => {
    if (!audio.started || held.has(degree)) return;
    const chord = diatonicChord(state.rootPc, state.mode, degree, state.flavor);
    const voicing = voiceLead(state.prevVoicing, chord.pcs);
    state.prevVoicing = voicing;
    const notes = voicing.map(midiToName);
    held.set(degree, notes);
    audio.triggerAttack(notes);
    looper.noteOn(degree, notes);
    ui.chordActive(degree, true, chord.label);
  },

  degreeOff: (degree) => {
    const notes = held.get(degree);
    if (!notes) return;
    held.delete(degree);
    audio.triggerRelease(notes);
    looper.noteOff(degree);
    ui.chordActive(degree, false);
  },

  setRoot: (pc) => {
    state.rootPc = pc;
    state.prevVoicing = null; // new key: start from a fresh voicing
    refreshLabels();
    persist();
  },

  setMode: () => {
    state.mode = state.mode === 'major' ? 'minor' : 'major';
    state.prevVoicing = null;
    ui.updateMode(state.mode);
    refreshLabels();
    persist();
  },

  setFlavor: (flavor) => {
    state.flavor = flavor;
    ui.setSelected('flavor', flavor);
    ui.updateLCD({ flavor });
    refreshLabels();
    persist();
  },

  setTimbre: (timbre) => {
    state.timbre = timbre;
    if (audio.started) audio.setTimbre(timbre);
    ui.setSelected('timbre', timbre);
    ui.updateLCD({ timbre });
    persist();
  },

  setBpm: (bpm) => {
    state.bpm = bpm;
    if (audio.started) audio.setBpm(bpm);
    ui.updateLCD({ bpm });
    persist();
  },

  toggleReverb: (on) => audio.started && audio.setReverb(on),
  toggleDelay: (on) => audio.started && audio.setDelay(on),
  toggleMetronome: (on) => { audio.metronomeOn = on; },

  loopRecord: () => {
    if (!audio.started) return;
    enterPatternMode();
    looper.toggleRecord();
  },
  loopPlayStop: () => {
    if (!audio.started) return;
    enterPatternMode();
    if (looper.isRunning) looper.stop();
    else looper.play();
  },
  loopClear: () => audio.started && looper.clear(),
  setBars: (bars) => {
    if (!audio.started) return;
    enterPatternMode();
    looper.setBars(bars);
    persist();
  },

  /* drum machine */
  drumToggle: (row, step) => {
    ui.setDrumCell(row, step, drums.toggle(row, step));
    persist();
  },
  drumClear: () => {
    drums.clear();
    ui.setDrumGrid(drums.getGrid());
    persist();
  },

  /* song builder */
  patSave: () => {
    const pattern = song.savePattern(looper.bars, looper.getEvents(), drums.getGrid());
    if (!pattern) return; // nothing recorded yet
    selectedPatternId = pattern.id;
    renderSongView();
    persist();
  },
  patSelect: (id) => {
    selectedPatternId = id;
    renderSongView();
    persist();
  },
  patDelete: (id) => {
    song.deletePattern(id);
    if (selectedPatternId === id) {
      selectedPatternId = song.patterns[0]?.id ?? null;
      renderSongView();
    }
  },
  cellToggle: (track, bar) => song.toggleClip(track, bar, selectedPatternId),
  songClear: () => song.clearClips(),
  songPlayStop: () => {
    if (!audio.started) return;
    if (state.songMode && looper.isRunning) {
      looper.stop();
    } else {
      enterSongMode();
      looper.play();
    }
  },
});

function refreshLabels() {
  ui.setChordLabels(allDegreeChords(state.rootPc, state.mode, state.flavor));
  ui.updateLCD({
    keyName: noteNamesFor(state.rootPc, state.mode)[state.rootPc],
    mode: state.mode,
  });
}

function renderSongView() {
  ui.renderSong({ patterns: song.patterns, clips: song.clips, selectedId: selectedPatternId });
}

/* ---------- persistence ---------- */

function persist() {
  if (restoring) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      song: song.toJSON(),
      drumGrid: drums.getGrid(),
      selectedPatternId,
      settings: {
        rootPc: state.rootPc,
        mode: state.mode,
        flavor: state.flavor,
        timbre: state.timbre,
        bpm: state.bpm,
        bars: looper.bars,
      },
    }));
  } catch { /* storage unavailable: keep playing without persistence */ }
}

function restore() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(LS_KEY)); } catch { /* corrupt: start fresh */ }
  if (!data) return;
  restoring = true;
  const s = data.settings || {};
  if (typeof s.rootPc === 'number') state.rootPc = s.rootPc;
  if (s.mode === 'minor' || s.mode === 'major') state.mode = s.mode;
  if (typeof s.flavor === 'string') state.flavor = s.flavor;
  if (typeof s.timbre === 'string') state.timbre = s.timbre;
  if (typeof s.bpm === 'number') state.bpm = s.bpm;
  if (typeof s.bars === 'number') looper.bars = s.bars;
  if (data.drumGrid) drums.setGrid(data.drumGrid);
  song.restore(data.song);
  selectedPatternId = patternById(song.patterns, data.selectedPatternId)
    ? data.selectedPatternId
    : (song.patterns[0]?.id ?? null);
  restoring = false;
}

/* ---------- initial render ---------- */

restore();
refreshLabels();
ui.updateMode(state.mode);
ui.setSelected('flavor', state.flavor);
ui.setSelected('timbre', state.timbre);
ui.updateLCD({ flavor: state.flavor, timbre: state.timbre, bpm: state.bpm });
ui.updateLoop({
  recording: false, playing: false, eventCount: 0, beat: -1, bars: looper.bars,
});
ui.el.root.value = String(state.rootPc);
ui.setDrumGrid(drums.getGrid());
renderSongView();
