// stabs.js — plucky chord-stab synth for syncopated tech house riffs.
// 16 on/off steps + a chord type; the root follows the studio key.

/* global Tone */

export const CHORD_TYPES = {
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  sus7: [0, 5, 7, 10],
  m6: [0, 3, 7, 9],
};

export function emptySteps() {
  return new Array(16).fill(false);
}

/** Classic offbeat stab for a fresh project. */
export function starterSteps() {
  const steps = emptySteps();
  [3, 7, 11].forEach((s) => { steps[s] = true; });
  return steps;
}

export class Stabs {
  constructor() {
    this.steps = emptySteps();
    this.chord = 'm7';
    this.rootPc = 5;
    this.tone = 2400;
    this.built = false;
  }

  /**
   * @param {Tone.ToneAudioNode} out  master input
   * @param {Tone.ToneAudioNode} delaySend  delay send for the dub echo
   */
  build(out, delaySend) {
    this.filter = new Tone.Filter(this.tone, 'lowpass').connect(out);
    if (delaySend) this.filter.connect(delaySend);
    this.synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 12,
      volume: -12,
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.004, decay: 0.16, sustain: 0, release: 0.08 },
    }).connect(this.filter);
    this.built = true;
  }

  setTone(hz) {
    this.tone = hz;
    if (this.built) this.filter.frequency.rampTo(hz, 0.05);
  }

  setRoot(pc) {
    this.rootPc = pc;
  }

  /** Play one stab of the given chord type (defaults to the live selection). */
  hitChord(time, chord = this.chord) {
    if (!this.built) return;
    const intervals = CHORD_TYPES[chord] || CHORD_TYPES.m7;
    const notes = intervals.map((iv) => Tone.Frequency(53 + this.rootPc + iv, 'midi'));
    this.synth.triggerAttackRelease(notes, Tone.Time('16n').toSeconds() * 0.9, time, 0.8);
  }

  playStep(step, time) {
    if (this.steps[step]) this.hitChord(time);
  }

  toggle(step) {
    this.steps[step] = !this.steps[step];
    return this.steps[step];
  }

  clear() {
    this.steps = emptySteps();
  }

  getState() {
    return { steps: [...this.steps], chord: this.chord };
  }

  setState(state) {
    if (!state) return;
    if (Array.isArray(state.steps) && state.steps.length === 16) this.steps = [...state.steps];
    if (CHORD_TYPES[state.chord]) this.chord = state.chord;
  }
}
