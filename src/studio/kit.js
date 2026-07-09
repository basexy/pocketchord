// kit.js — 909-flavoured tech house drum kit, fully synthesized (no samples),
// with a 16-step × 6-row grid. One bar of 16ths.

/* global Tone */

export const KIT_ROWS = [
  { id: 'kick', label: 'KICK' },
  { id: 'clap', label: 'CLAP' },
  { id: 'chat', label: 'CHAT' },
  { id: 'ohat', label: 'OHAT' },
  { id: 'ride', label: 'RIDE' },
  { id: 'rim', label: 'RIM' },
];

export const STEPS = 16;

export function emptyGrid() {
  return KIT_ROWS.map(() => new Array(STEPS).fill(false));
}

/** Four-on-the-floor starter groove for a fresh project. */
export function starterGrid() {
  const g = emptyGrid();
  [0, 4, 8, 12].forEach((s) => { g[0][s] = true; }); // kick
  [4, 12].forEach((s) => { g[1][s] = true; });       // clap on 2 & 4
  [2, 6, 10, 14].forEach((s) => { g[3][s] = true; }); // open hat offbeats
  return g;
}

export class Kit909 {
  constructor() {
    this.grid = emptyGrid();
    this.built = false;
  }

  /**
   * @param {Tone.ToneAudioNode} out  master input
   * @param {Tone.ToneAudioNode} revSend  reverb send (clap gets a little space)
   */
  build(out, revSend) {
    this.kick = new Tone.MembraneSynth({
      volume: -3,
      pitchDecay: 0.028,
      octaves: 5.5,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.04 },
    }).connect(out);

    const clapFilter = new Tone.Filter(1200, 'bandpass').connect(out);
    clapFilter.Q.value = 1.4;
    if (revSend) clapFilter.connect(revSend);
    this.clap = new Tone.NoiseSynth({
      volume: -7,
      noise: { type: 'pink' },
      envelope: { attack: 0.004, decay: 0.24, sustain: 0 },
    }).connect(clapFilter);

    const chatFilter = new Tone.Filter(8200, 'highpass').connect(out);
    this.chat = new Tone.NoiseSynth({
      volume: -12,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
    }).connect(chatFilter);

    const ohatFilter = new Tone.Filter(7200, 'highpass').connect(out);
    this.ohat = new Tone.NoiseSynth({
      volume: -13,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.28, sustain: 0 },
    }).connect(ohatFilter);

    const rideFilter = new Tone.Filter(9500, 'highpass').connect(out);
    this.ride = new Tone.NoiseSynth({
      volume: -18,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.42, sustain: 0 },
    }).connect(rideFilter);

    this.rim = new Tone.Synth({
      volume: -13,
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 },
    }).connect(out);

    this.built = true;
  }

  hit(rowIndex, time) {
    if (!this.built) return;
    switch (KIT_ROWS[rowIndex].id) {
      case 'kick': this.kick.triggerAttackRelease('C1', 0.3, time); break;
      case 'clap': this.clap.triggerAttackRelease(0.24, time); break;
      case 'chat': this.chat.triggerAttackRelease(0.035, time); break;
      case 'ohat': this.ohat.triggerAttackRelease(0.28, time); break;
      case 'ride': this.ride.triggerAttackRelease(0.42, time); break;
      case 'rim': this.rim.triggerAttackRelease(1050, 0.05, time); break;
    }
  }

  /** Live playback of the editable grid. */
  playStep(step, time) {
    this.grid.forEach((row, r) => { if (row[step]) this.hit(r, time); });
  }

  toggle(row, step) {
    this.grid[row][step] = !this.grid[row][step];
    return this.grid[row][step];
  }

  clear() {
    this.grid = emptyGrid();
  }

  getGrid() {
    return this.grid.map((row) => [...row]);
  }

  setGrid(grid) {
    if (!Array.isArray(grid) || grid.length !== KIT_ROWS.length) return;
    this.grid = grid.map((row) => [...row]);
  }
}
