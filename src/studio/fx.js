// fx.js — master chain + performance FX: DJ-style sweep filter (one control,
// left = lowpass down, right = highpass up), white-noise riser, and
// delay/reverb send buses.

/* global Tone */

export class MasterFX {
  constructor() {
    this.built = false;
    this.delayOn = true;
    this.reverbOn = true;
  }

  build() {
    this.limiter = new Tone.Limiter(-1.5).toDestination();
    this.hp = new Tone.Filter(10, 'highpass').connect(this.limiter);
    this.lp = new Tone.Filter(20000, 'lowpass').connect(this.hp);
    this.input = this.lp; // instruments connect here

    // send buses (instruments connect a tap; wet returns into the master)
    this.delaySend = new Tone.Gain(this.delayOn ? 0.35 : 0);
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.42, wet: 1 });
    this.delaySend.chain(this.delay, this.lp);

    this.reverbSend = new Tone.Gain(this.reverbOn ? 0.3 : 0);
    this.reverb = new Tone.Reverb({ decay: 1.9, wet: 1 });
    this.reverbSend.chain(this.reverb, this.lp);

    // riser: white noise swept up while the button is held
    this.riserGain = new Tone.Gain(0).connect(this.lp);
    this.riserFilter = new Tone.Filter(300, 'highpass').connect(this.riserGain);
    this.noise = new Tone.Noise('white').connect(this.riserFilter);
    this.noise.start();

    this.built = true;
  }

  /**
   * DJ sweep, v in [-1, 1]. Negative closes the lowpass (darker),
   * positive raises the highpass (thinner), 0 is neutral.
   */
  setSweep(v) {
    if (!this.built) return;
    const lpHz = v < 0 ? 20000 * Math.pow(150 / 20000, -v) : 20000;
    const hpHz = v > 0 ? 10 * Math.pow(4500 / 10, v) : 10;
    this.lp.frequency.rampTo(lpHz, 0.06);
    this.hp.frequency.rampTo(hpHz, 0.06);
  }

  riserStart() {
    if (!this.built) return;
    this.riserFilter.frequency.cancelScheduledValues(Tone.now());
    this.riserFilter.frequency.value = 300;
    this.riserFilter.frequency.rampTo(6000, 3.5);
    this.riserGain.gain.rampTo(0.2, 0.08);
  }

  riserStop() {
    if (!this.built) return;
    this.riserGain.gain.rampTo(0, 0.25);
  }

  setDelay(on) {
    this.delayOn = on;
    if (this.built) this.delaySend.gain.rampTo(on ? 0.35 : 0, 0.1);
  }

  setReverb(on) {
    this.reverbOn = on;
    if (this.built) this.reverbSend.gain.rampTo(on ? 0.3 : 0, 0.1);
  }
}
