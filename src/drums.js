// drums.js — 16-step drum machine: synthesized kit + step grid on Tone.Transport.
// The grid is 1 bar of 16th notes and repeats inside whatever loop is running.
// In song mode `liveEnabled` is false and the song scheduler calls hit() directly.

/* global Tone */

export const DRUM_ROWS = [
  { id: 'kick', label: 'KICK' },
  { id: 'snare', label: 'SNR' },
  { id: 'clap', label: 'CLAP' },
  { id: 'hat', label: 'HAT' },
  { id: 'ohat', label: 'OHAT' },
];

export const STEPS = 16;

export function emptyGrid() {
  return DRUM_ROWS.map(() => new Array(STEPS).fill(false));
}

export class DrumMachine {
  /** @param {(step: number) => void} onStep  UI playhead callback */
  constructor(onStep) {
    this.onStep = onStep;
    this.grid = emptyGrid();
    this.liveEnabled = true; // pattern mode plays the editable grid
    this.built = false;
  }

  /** Build synths after Tone.start(). @param {Tone.ToneAudioNode} out */
  build(out) {
    this.kick = new Tone.MembraneSynth({
      volume: -6,
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 },
    }).connect(out);

    const snareFilter = new Tone.Filter(1800, 'bandpass').connect(out);
    snareFilter.Q.value = 0.8;
    this.snare = new Tone.NoiseSynth({
      volume: -8,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
    }).connect(snareFilter);

    const clapFilter = new Tone.Filter(1100, 'bandpass').connect(out);
    clapFilter.Q.value = 1.2;
    this.clap = new Tone.NoiseSynth({
      volume: -8,
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0 },
    }).connect(clapFilter);

    const hatFilter = new Tone.Filter(7500, 'highpass').connect(out);
    this.hat = new Tone.NoiseSynth({
      volume: -14,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
    }).connect(hatFilter);

    const ohatFilter = new Tone.Filter(6500, 'highpass').connect(out);
    this.ohat = new Tone.NoiseSynth({
      volume: -16,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).connect(ohatFilter);

    this.built = true;
  }

  /** Call once after Tone.start(): drive steps from the transport. */
  init() {
    Tone.Transport.scheduleRepeat((time) => this._tick(time), '16n');
  }

  _tick(time) {
    const sixteenth = Tone.Transport.PPQ / 4;
    const step = Math.round(Tone.Transport.getTicksAtTime(time) / sixteenth) % STEPS;
    if (this.liveEnabled) {
      this.grid.forEach((row, r) => { if (row[step]) this.hit(r, time); });
    }
    Tone.Draw.schedule(() => this.onStep(step), time);
  }

  hit(rowIndex, time) {
    if (!this.built) return;
    switch (DRUM_ROWS[rowIndex].id) {
      case 'kick': this.kick.triggerAttackRelease('C1', 0.25, time); break;
      case 'snare': this.snare.triggerAttackRelease(0.16, time); break;
      case 'clap': this.clap.triggerAttackRelease(0.22, time); break;
      case 'hat': this.hat.triggerAttackRelease(0.045, time); break;
      case 'ohat': this.ohat.triggerAttackRelease(0.3, time); break;
    }
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
    if (!Array.isArray(grid) || grid.length !== DRUM_ROWS.length) return;
    this.grid = grid.map((row) => [...row]);
  }
}
