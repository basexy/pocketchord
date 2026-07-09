// main.js (studio) — bootstrap for the tech house workstation: one 16th-note
// clock drives all sequencers in live mode; song mode schedules the painted
// clips instead. Project state persists to localStorage.

/* global Tone */

import { Kit909, starterGrid } from './kit.js';
import { Bass303, starterSeq } from './bass.js';
import { Stabs, starterSteps, CHORD_TYPES } from './stabs.js';
import { MasterFX } from './fx.js';
import { Arrangement, patternById } from './arrange.js';
import { StudioUI } from './ui.js';

const LS_KEY = 'thstudio-v1';
const PPQ_BAR = 4; // quarters per bar

const state = {
  bpm: 126,
  swing: 12, // % of a 16th applied to the off-16ths
  keyPc: 5, // F minor
  songMode: false,
  started: false,
};

let selectedPatternId = null;
let restoring = false;
let songIds = []; // transport schedule ids while in song mode

const fx = new MasterFX();
const kit = new Kit909();
const bass = new Bass303();
const stabs = new Stabs();
const song = new Arrangement(onSongChange);

function onSongChange() {
  renderSongView();
  persist();
  if (state.songMode && state.started) {
    scheduleSong();
    Tone.Transport.loopEnd = `${song.bars}m`;
  }
}

/* ---------- clock & scheduling ---------- */

function swingSeconds() {
  return (state.swing / 100) * Tone.Time('16n').toSeconds();
}

function startClock() {
  Tone.Transport.loop = true;
  Tone.Transport.loopStart = 0;
  Tone.Transport.loopEnd = '1m';
  const sixteenth = Tone.Transport.PPQ / 4;
  Tone.Transport.scheduleRepeat((time) => {
    const ticks = Tone.Transport.getTicksAtTime(time);
    const step = Math.round(ticks / sixteenth) % 16;
    const t = step % 2 ? time + swingSeconds() : time;
    if (!state.songMode) {
      kit.playStep(step, t);
      bass.playStep(step, t);
      stabs.playStep(step, t);
    }
    Tone.Draw.schedule(() => {
      ui.playhead(step);
      if (state.songMode) {
        ui.setPlayheadBar(Math.floor(Math.round(ticks / Tone.Transport.PPQ) / PPQ_BAR));
      }
    }, time);
  }, '16n');
}

function scheduleSong() {
  unscheduleSong();
  const PPQ = Tone.Transport.PPQ;
  const sixteenth = PPQ / 4;
  for (const clip of song.clips) {
    const p = patternById(song.patterns, clip.patternId);
    if (!p) continue;
    const base = clip.startBar * PPQ_BAR * PPQ;
    const at = (s, fn) => {
      const id = Tone.Transport.schedule((time) => {
        fn(s % 2 ? time + swingSeconds() : time);
      }, `${base + s * sixteenth}i`);
      songIds.push(id);
    };
    p.drums.forEach((row, r) => row.forEach((on, s) => { if (on) at(s, (t) => kit.hit(r, t)); }));
    p.bass.forEach((st, s) => { if (st.r >= 0) at(s, (t) => bass.playNote(st, t)); });
    p.stabs.steps.forEach((on, s) => { if (on) at(s, (t) => stabs.hitChord(t, p.stabs.chord)); });
  }
}

function unscheduleSong() {
  for (const id of songIds) Tone.Transport.clear(id);
  songIds = [];
}

function stopTransport() {
  Tone.Transport.stop();
  ui.playhead(-1);
  ui.setPlayheadBar(-1);
  ui.updateTransport(false, state.songMode);
}

function enterLiveMode() {
  if (!state.songMode) return;
  stopTransport();
  unscheduleSong();
  Tone.Transport.loopEnd = '1m';
  state.songMode = false;
  ui.updateTransport(false, false);
}

function enterSongMode() {
  if (state.songMode) return;
  stopTransport();
  scheduleSong();
  Tone.Transport.loopEnd = `${song.bars}m`;
  state.songMode = true;
}

/* ---------- UI wiring ---------- */

let dockOpen = false;

const ui = new StudioUI({
  start: async () => {
    await Tone.start();
    fx.build();
    kit.build(fx.input, fx.reverbSend);
    bass.build(fx.input);
    stabs.build(fx.input, fx.delaySend);
    Tone.Transport.bpm.value = state.bpm;
    startClock();
    state.started = true;
    ui.hideOverlay();
  },

  playStop: () => {
    if (!state.started) return;
    enterLiveMode();
    if (Tone.Transport.state === 'started') {
      stopTransport();
    } else {
      Tone.Transport.start();
      ui.updateTransport(true, false);
    }
  },

  setBpm: (bpm) => {
    state.bpm = bpm;
    if (state.started) Tone.Transport.bpm.value = bpm;
    ui.updateBpm(bpm);
    persist();
  },
  setSwing: (swing) => {
    state.swing = swing;
    ui.updateSwing(swing);
    persist();
  },
  setKey: (pc) => {
    state.keyPc = pc;
    bass.setRoot(pc);
    stabs.setRoot(pc);
    persist();
  },

  drumToggle: (r, s) => {
    ui.setDrumCell(r, s, kit.toggle(r, s));
    persist();
  },
  drumClear: () => {
    kit.clear();
    ui.setDrumGrid(kit.getGrid());
    persist();
  },

  bassNote: (row, s) => {
    bass.toggleNote(row, s);
    ui.setBassSeq(bass.seq);
    persist();
  },
  bassAcc: (s) => {
    bass.toggleAccent(s);
    ui.setBassSeq(bass.seq);
    persist();
  },
  bassSld: (s) => {
    bass.toggleSlide(s);
    ui.setBassSeq(bass.seq);
    persist();
  },
  bassClear: () => {
    bass.clear();
    ui.setBassSeq(bass.seq);
    persist();
  },
  setCutoff: (hz) => { bass.setCutoff(hz); persist(); },
  setRes: (q) => { bass.setRes(q); persist(); },

  stabToggle: (s) => {
    stabs.toggle(s);
    ui.setStabState(stabs.getState());
    persist();
  },
  stabChord: (type) => {
    if (CHORD_TYPES[type]) stabs.chord = type;
    persist();
  },
  stabClear: () => {
    stabs.clear();
    ui.setStabState(stabs.getState());
    persist();
  },
  setTone: (hz) => { stabs.setTone(hz); persist(); },

  setSweep: (v) => fx.setSweep(v),
  riserDown: () => fx.riserStart(),
  riserUp: () => fx.riserStop(),
  toggleDelay: (on) => { fx.setDelay(on); persist(); },
  toggleReverb: (on) => { fx.setReverb(on); persist(); },

  dockToggle: () => {
    dockOpen = !dockOpen;
    ui.setDockOpen(dockOpen);
  },
  patSave: () => {
    const pattern = song.savePattern({
      drums: kit.getGrid(),
      bass: bass.getSeq(),
      stabs: stabs.getState(),
    });
    selectedPatternId = pattern.id;
    if (!dockOpen) { dockOpen = true; ui.setDockOpen(true); }
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
  cellPaint: (track, bar, mode) => {
    if (mode === 'erase') song.remove(track, bar);
    else song.place(track, bar, selectedPatternId);
  },
  songClear: () => song.clearClips(),
  songPlayStop: () => {
    if (!state.started) return;
    if (state.songMode && Tone.Transport.state === 'started') {
      stopTransport();
    } else {
      enterSongMode();
      Tone.Transport.start();
      ui.updateTransport(true, true);
    }
  },
});

function renderSongView() {
  ui.renderSong({
    patterns: song.patterns,
    clips: song.clips,
    selectedId: selectedPatternId,
    bars: song.bars,
  });
}

/* ---------- persistence ---------- */

function persist() {
  if (restoring) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      song: song.toJSON(),
      selectedPatternId,
      drums: kit.getGrid(),
      bass: { seq: bass.getSeq(), cutoff: bass.cutoff, res: bass.res },
      stabs: { ...stabs.getState(), tone: stabs.tone },
      fx: { delayOn: fx.delayOn, reverbOn: fx.reverbOn },
      settings: { bpm: state.bpm, swing: state.swing, keyPc: state.keyPc },
    }));
  } catch { /* storage unavailable: keep playing without persistence */ }
}

function restore() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(LS_KEY)); } catch { /* corrupt: fresh */ }
  restoring = true;
  if (data) {
    const s = data.settings || {};
    if (typeof s.bpm === 'number') state.bpm = s.bpm;
    if (typeof s.swing === 'number') state.swing = s.swing;
    if (typeof s.keyPc === 'number') state.keyPc = s.keyPc;
    if (data.drums) kit.setGrid(data.drums);
    if (data.bass) {
      bass.setSeq(data.bass.seq);
      if (typeof data.bass.cutoff === 'number') bass.cutoff = data.bass.cutoff;
      if (typeof data.bass.res === 'number') bass.res = data.bass.res;
    }
    if (data.stabs) {
      stabs.setState(data.stabs);
      if (typeof data.stabs.tone === 'number') stabs.tone = data.stabs.tone;
    }
    if (data.fx) {
      fx.delayOn = data.fx.delayOn !== false;
      fx.reverbOn = data.fx.reverbOn !== false;
    }
    song.restore(data.song);
    selectedPatternId = patternById(song.patterns, data.selectedPatternId)
      ? data.selectedPatternId
      : (song.patterns[0]?.id ?? null);
  } else {
    // fresh project: preload a groove so PLAY makes sound immediately
    kit.setGrid(starterGrid());
    bass.setSeq(starterSeq());
    stabs.steps = starterSteps();
  }
  bass.setRoot(state.keyPc);
  stabs.setRoot(state.keyPc);
  restoring = false;
}

/* ---------- initial render ---------- */

restore();
ui.setControls({
  bpm: state.bpm,
  swing: state.swing,
  keyPc: state.keyPc,
  cutoff: bass.cutoff,
  res: bass.res,
  tone: stabs.tone,
  delayOn: fx.delayOn,
  reverbOn: fx.reverbOn,
});
ui.setDrumGrid(kit.getGrid());
ui.setBassSeq(bass.seq);
ui.setStabState(stabs.getState());
ui.setDockOpen(false);
renderSongView();
