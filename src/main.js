// main.js — bootstrap and wiring between chords (theory), audio, looper and UI.

import {
  diatonicChord, allDegreeChords, voiceLead, midiToName, noteNamesFor,
} from './chords.js';
import { AudioEngine } from './audio-engine.js';
import { Looper } from './looper.js';
import { UI } from './ui.js';

const state = {
  rootPc: 0,
  mode: 'major',
  flavor: 'triad',
  timbre: 'pad',
  bpm: 100,
  prevVoicing: null,
};

const held = new Map(); // degree -> note names currently sounding

const audio = new AudioEngine();
const looper = new Looper(audio, (loopState) => ui.updateLoop(loopState));

const ui = new UI({
  start: async () => {
    await audio.start();
    looper.init();
    audio.setBpm(state.bpm);
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
  },

  setMode: () => {
    state.mode = state.mode === 'major' ? 'minor' : 'major';
    state.prevVoicing = null;
    ui.updateMode(state.mode);
    refreshLabels();
  },

  setFlavor: (flavor) => {
    state.flavor = flavor;
    ui.setSelected('flavor', flavor);
    ui.updateLCD({ flavor });
    refreshLabels();
  },

  setTimbre: (timbre) => {
    state.timbre = timbre;
    if (audio.started) audio.setTimbre(timbre);
    ui.setSelected('timbre', timbre);
    ui.updateLCD({ timbre });
  },

  setBpm: (bpm) => {
    state.bpm = bpm;
    if (audio.started) audio.setBpm(bpm);
    ui.updateLCD({ bpm });
  },

  toggleReverb: (on) => audio.started && audio.setReverb(on),
  toggleDelay: (on) => audio.started && audio.setDelay(on),
  toggleMetronome: (on) => { audio.metronomeOn = on; },

  loopRecord: () => audio.started && looper.toggleRecord(),
  loopPlayStop: () => {
    if (!audio.started) return;
    if (looper.isRunning) looper.stop();
    else looper.play();
  },
  loopClear: () => audio.started && looper.clear(),
  setBars: (bars) => audio.started && looper.setBars(bars),
});

function refreshLabels() {
  ui.setChordLabels(allDegreeChords(state.rootPc, state.mode, state.flavor));
  ui.updateLCD({
    keyName: noteNamesFor(state.rootPc, state.mode)[state.rootPc],
    mode: state.mode,
  });
}

// Initial render
refreshLabels();
ui.updateMode(state.mode);
ui.setSelected('flavor', state.flavor);
ui.setSelected('timbre', state.timbre);
ui.updateLCD({ flavor: state.flavor, timbre: state.timbre, bpm: state.bpm });
ui.updateLoop({ recording: false, playing: false, eventCount: 0, beat: -1 });
