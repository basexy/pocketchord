// audio-engine.js — Tone.js: synths, effects, metronome click, output chain.
// Everything is built lazily after Tone.start() (user gesture required).

/* global Tone */

const PRESETS = {
  pad: {
    options: {
      maxPolyphony: 16,
      volume: -14,
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.16, decay: 0.4, sustain: 0.7, release: 1.3 },
    },
    filterHz: 1400,
  },
  organ: {
    options: {
      maxPolyphony: 16,
      volume: -13,
      oscillator: { type: 'custom', partials: [1, 0.7, 0.45, 0.3, 0.15, 0.1] },
      envelope: { attack: 0.03, decay: 0.1, sustain: 0.9, release: 0.15 },
    },
  },
  pluck: {
    options: {
      maxPolyphony: 16,
      volume: -9,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.12, release: 0.4 },
    },
  },
};

export class AudioEngine {
  constructor() {
    this.started = false;
    this.timbre = 'pad';
    this.metronomeOn = false;
  }

  async start() {
    if (this.started) return;
    await Tone.start();
    this._build();
    this.started = true;
  }

  _build() {
    this.limiter = new Tone.Limiter(-2).toDestination();
    this.reverb = new Tone.Reverb({ decay: 2.6, wet: 0.35 }).connect(this.limiter);
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.22 })
      .connect(this.reverb);
    this._reverbWet = 0.35;
    this._delayWet = 0.22;

    this.synths = {};
    for (const [name, preset] of Object.entries(PRESETS)) {
      const synth = new Tone.PolySynth(Tone.Synth, preset.options);
      if (preset.filterHz) {
        const filter = new Tone.Filter(preset.filterHz, 'lowpass').connect(this.delay);
        synth.connect(filter);
      } else {
        synth.connect(this.delay);
      }
      this.synths[name] = synth;
    }

    this.clickSynth = new Tone.Synth({
      volume: -12,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    }).connect(this.limiter);
  }

  setTimbre(name) {
    if (!this.synths[name]) return;
    this.synths[this.timbre].releaseAll();
    this.timbre = name;
  }

  triggerAttack(notes) {
    this.synths[this.timbre].triggerAttack(notes, Tone.now());
  }

  triggerRelease(notes) {
    // Release on every synth: harmless for notes a synth never played,
    // and covers timbre switches while a chord is held.
    for (const synth of Object.values(this.synths)) {
      synth.triggerRelease(notes, Tone.now());
    }
  }

  /** Scheduled playback from the looper. */
  playChord(notes, duration, time) {
    this.synths[this.timbre].triggerAttackRelease(notes, duration, time);
  }

  setReverb(on) {
    this.reverb.wet.rampTo(on ? this._reverbWet : 0, 0.1);
  }

  setDelay(on) {
    this.delay.wet.rampTo(on ? this._delayWet : 0, 0.1);
  }

  setBpm(bpm) {
    Tone.Transport.bpm.value = bpm;
  }

  click(accent, time) {
    if (!this.metronomeOn) return;
    this.clickSynth.triggerAttackRelease(accent ? 1800 : 1200, 0.03, time, accent ? 1 : 0.6);
  }
}
