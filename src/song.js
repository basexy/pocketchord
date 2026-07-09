// song.js — FL-style pattern library + playlist.
// A pattern is a snapshot of the chord loop + drum grid. Clips place patterns
// on the playlist (track, startBar); song mode schedules every clip on the
// transport and loops over the song length.
// Pure helpers are exported separately so they can be unit-tested in Node.

/* global Tone */

export const TRACKS = 3;
export const SONG_BARS = 32;
export const PATTERN_COLORS = 6; // css classes pat-c0..pat-c5

export function patternById(patterns, id) {
  return patterns.find((p) => p.id === id) || null;
}

/** Clip covering (track, bar), or null. */
export function clipAt(clips, patterns, track, bar) {
  return clips.find((c) => {
    if (c.track !== track) return false;
    const p = patternById(patterns, c.patternId);
    const len = p ? p.bars : 1;
    return bar >= c.startBar && bar < c.startBar + len;
  }) || null;
}

/** A pattern can be placed if it fits in the song and overlaps nothing on the track. */
export function canPlace(clips, patterns, track, startBar, patternId) {
  const p = patternById(patterns, patternId);
  if (!p || startBar + p.bars > SONG_BARS) return false;
  for (let b = startBar; b < startBar + p.bars; b++) {
    if (clipAt(clips, patterns, track, b)) return false;
  }
  return true;
}

/** Song length in bars: end of the last clip (minimum 1). */
export function songBars(clips, patterns) {
  let end = 1;
  for (const c of clips) {
    const p = patternById(patterns, c.patternId);
    end = Math.max(end, c.startBar + (p ? p.bars : 1));
  }
  return end;
}

export class Song {
  /**
   * @param {AudioEngine} audio
   * @param {DrumMachine} drums
   * @param {() => void} onChange  fired on any data change (render + persist)
   */
  constructor(audio, drums, onChange) {
    this.audio = audio;
    this.drums = drums;
    this.onChange = onChange;
    this.patterns = [];
    this.clips = [];
    this._nextN = 1;
    this._ids = []; // transport schedule ids while in song mode
  }

  /** Snapshot the current loop as a new pattern. Returns it, or null if empty. */
  savePattern(bars, chordEvents, drumGrid) {
    const hasDrums = drumGrid.some((row) => row.some(Boolean));
    if (chordEvents.length === 0 && !hasDrums) return null;
    const pattern = {
      id: `p${Date.now().toString(36)}${this._nextN}`,
      name: `P${this._nextN}`,
      color: (this._nextN - 1) % PATTERN_COLORS,
      bars,
      chords: chordEvents,
      drums: drumGrid,
    };
    this._nextN += 1;
    this.patterns.push(pattern);
    this.onChange();
    return pattern;
  }

  deletePattern(id) {
    this.patterns = this.patterns.filter((p) => p.id !== id);
    this.clips = this.clips.filter((c) => c.patternId !== id);
    this.onChange();
  }

  /** Click on a playlist cell: remove the clip there, or place the selected pattern. */
  toggleClip(track, bar, patternId) {
    const existing = clipAt(this.clips, this.patterns, track, bar);
    if (existing) {
      this.clips = this.clips.filter((c) => c !== existing);
      this.onChange();
      return;
    }
    if (!canPlace(this.clips, this.patterns, track, bar, patternId)) return;
    this.clips.push({ patternId, track, startBar: bar });
    this.onChange();
  }

  clearClips() {
    this.clips = [];
    this.onChange();
  }

  get bars() {
    return songBars(this.clips, this.patterns);
  }

  /** Arm every clip on the transport (song mode). */
  schedule() {
    this.unschedule();
    const PPQ = Tone.Transport.PPQ;
    const barTicks = 4 * PPQ;
    for (const clip of this.clips) {
      const p = patternById(this.patterns, clip.patternId);
      if (!p) continue;
      const clipStart = clip.startBar * barTicks;

      for (const ev of p.chords) {
        const id = Tone.Transport.schedule((time) => {
          this.audio.playChord(ev.notes, Tone.Ticks(ev.durTicks).toSeconds(), time);
        }, `${clipStart + ev.ticks}i`);
        this._ids.push(id);
      }

      const sixteenth = PPQ / 4;
      for (let bar = 0; bar < p.bars; bar++) {
        p.drums.forEach((row, r) => {
          row.forEach((on, s) => {
            if (!on) return;
            const id = Tone.Transport.schedule(
              (time) => this.drums.hit(r, time),
              `${clipStart + bar * barTicks + s * sixteenth}i`,
            );
            this._ids.push(id);
          });
        });
      }
    }
  }

  unschedule() {
    for (const id of this._ids) Tone.Transport.clear(id);
    this._ids = [];
  }

  /** Serializable snapshot for persistence. */
  toJSON() {
    return { patterns: this.patterns, clips: this.clips, nextN: this._nextN };
  }

  restore(data) {
    if (!data) return;
    this.patterns = data.patterns || [];
    this.clips = data.clips || [];
    this._nextN = data.nextN || this.patterns.length + 1;
  }
}
