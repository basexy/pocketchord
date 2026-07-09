// bass.js — 303-style monophonic acid bassline. 16 steps, each step is a
// scale-degree row (or off) with accent and slide flags. Slide glides INTO
// the step from the previous note (portamento), accent hits harder.

/* global Tone */

export const BASS_ROWS = 8; // natural-minor degrees, row 0 = low root
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12]; // semitones from the root

export function emptySeq() {
  return Array.from({ length: 16 }, () => ({ r: -1, a: false, s: false }));
}

/** Rolling octave riff for a fresh project. */
export function starterSeq() {
  const seq = emptySeq();
  [0, 3, 6, 10, 12].forEach((s) => { seq[s] = { r: 0, a: s === 0, s: false }; });
  seq[14] = { r: 7, a: false, s: true }; // octave slide-up at the turnaround
  return seq;
}

export class Bass303 {
  constructor() {
    this.seq = emptySeq();
    this.rootPc = 5; // F minor, tech house staple
    this.cutoff = 380;
    this.res = 6;
    this.built = false;
  }

  build(out) {
    this.synth = new Tone.MonoSynth({
      volume: -7,
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.003, decay: 0.18, sustain: 0.12, release: 0.06 },
      filter: { type: 'lowpass', rolloff: -24, Q: this.res },
      filterEnvelope: {
        attack: 0.004, decay: 0.16, sustain: 0.1, release: 0.1,
        baseFrequency: this.cutoff, octaves: 3.4,
      },
    }).connect(out);
    this.built = true;
  }

  setCutoff(hz) {
    this.cutoff = hz;
    if (this.built) this.synth.filterEnvelope.baseFrequency = hz;
  }

  setRes(q) {
    this.res = q;
    if (this.built) this.synth.filter.Q.value = q;
  }

  setRoot(pc) {
    this.rootPc = pc;
  }

  /** Play one step object (from the live seq or a pattern snapshot). */
  playNote(st, time) {
    if (!this.built || !st || st.r < 0) return;
    const midi = 25 + this.rootPc + SCALE[st.r]; // root around C#1..C2
    const d16 = Tone.Time('16n').toSeconds();
    this.synth.portamento = st.s ? 0.055 : 0;
    this.synth.triggerAttackRelease(
      Tone.Frequency(midi, 'midi'),
      st.s ? d16 * 1.35 : d16 * 0.85,
      time,
      st.a ? 1 : 0.55,
    );
  }

  playStep(step, time) {
    this.playNote(this.seq[step], time);
  }

  /** Toggle a note cell: mono per column — same row clears, other row moves. */
  toggleNote(row, step) {
    const st = this.seq[step];
    st.r = st.r === row ? -1 : row;
    return st.r;
  }

  toggleAccent(step) {
    const st = this.seq[step];
    st.a = !st.a;
    return st.a;
  }

  toggleSlide(step) {
    const st = this.seq[step];
    st.s = !st.s;
    return st.s;
  }

  clear() {
    this.seq = emptySeq();
  }

  getSeq() {
    return this.seq.map((st) => ({ ...st }));
  }

  setSeq(seq) {
    if (!Array.isArray(seq) || seq.length !== 16) return;
    this.seq = seq.map((st) => ({ r: st.r ?? -1, a: Boolean(st.a), s: Boolean(st.s) }));
  }
}
