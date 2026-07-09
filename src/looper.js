// looper.js — beat-synced recording/playback on Tone.Transport.
// Events are stored in ticks, so they stay musically in place when BPM changes.
// Recording is always overdub: existing layers keep playing while you add more.

/* global Tone */

export class Looper {
  /**
   * @param {AudioEngine} audio
   * @param {(state: object) => void} onUpdate  UI callback (state/beat changes)
   */
  constructor(audio, onUpdate) {
    this.audio = audio;
    this.onUpdate = onUpdate;
    this.recording = false;
    this.events = [];
    this.eventIds = [];
    this.held = new Map(); // key -> { startTicks, notes }
    this.bars = 4;
  }

  /** Call once after Tone.start(). */
  init() {
    const T = Tone.Transport;
    T.loop = true;
    T.loopStart = 0;
    this.setBars(this.bars);
    T.scheduleRepeat((time) => this._onBeat(time), '4n');
  }

  get isRunning() {
    return Tone.Transport.state === 'started';
  }

  setBars(bars) {
    this.bars = bars;
    Tone.Transport.loopEnd = `${bars}m`;
    this._notify();
  }

  play() {
    if (!this.isRunning) Tone.Transport.start();
    this._notify();
  }

  stop() {
    Tone.Transport.stop(); // rewinds to loopStart
    this.recording = false;
    this.held.clear();
    this._notify({ beat: -1 });
  }

  toggleRecord() {
    this.recording = !this.recording;
    if (this.recording && !this.isRunning) this.play();
    if (!this.recording) this.held.clear();
    this._notify();
  }

  clear() {
    for (const id of this.eventIds) Tone.Transport.clear(id);
    this.eventIds = [];
    this.events = [];
    this.held.clear();
    this._notify();
  }

  /** Capture a chord press (live sound is triggered by the UI, not here). */
  noteOn(key, notes) {
    if (!this.recording || !this.isRunning) return;
    this.held.set(key, { startTicks: Tone.Transport.ticks, notes });
  }

  noteOff(key) {
    const h = this.held.get(key);
    if (!h) return;
    this.held.delete(key);

    const sixteenth = Tone.Transport.PPQ / 4;
    const loopTicks = this.bars * 4 * Tone.Transport.PPQ;

    let start = Math.round(h.startTicks / sixteenth) * sixteenth;
    if (start >= loopTicks) start = 0; // quantized past the loop end → next pass downbeat

    let dur = Tone.Transport.ticks - h.startTicks;
    if (dur < 0) dur += loopTicks; // held across the loop seam
    dur = Math.max(sixteenth, Math.min(dur, loopTicks - sixteenth));

    const event = { ticks: start, durTicks: dur, notes: h.notes };
    this.events.push(event);
    this._schedule(event);
    this._notify();
  }

  _schedule(event) {
    const id = Tone.Transport.schedule((time) => {
      this.audio.playChord(event.notes, Tone.Ticks(event.durTicks).toSeconds(), time);
    }, `${event.ticks}i`);
    this.eventIds.push(id);
  }

  _onBeat(time) {
    const beat = Math.round(Tone.Transport.getTicksAtTime(time) / Tone.Transport.PPQ) % 4;
    this.audio.click(beat === 0, time);
    Tone.Draw.schedule(() => this._notify({ beat }), time);
  }

  _notify(extra = {}) {
    this.onUpdate({
      recording: this.recording,
      playing: this.isRunning,
      eventCount: this.events.length,
      bars: this.bars,
      ...extra,
    });
  }
}
