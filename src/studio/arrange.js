// arrange.js — pure song-arrangement model for the studio: patterns are
// 1-bar snapshots of every sequencer; clips place them on a track × bar grid.
// No Tone, no DOM: testable in Node. Scheduling lives in main.js.

export const TRACKS = 3;
export const SONG_BARS = 32;
export const PATTERN_COLORS = 6; // css classes pat-c0..pat-c5

export function patternById(patterns, id) {
  return patterns.find((p) => p.id === id) || null;
}

/** Clips are always 1 bar long. */
export function clipAt(clips, track, bar) {
  return clips.find((c) => c.track === track && c.startBar === bar) || null;
}

export function canPlace(clips, track, bar, patternId) {
  return Boolean(patternId) && bar >= 0 && bar < SONG_BARS && !clipAt(clips, track, bar);
}

/** Song length in bars: end of the last clip (minimum 1). */
export function songBars(clips) {
  return clips.reduce((end, c) => Math.max(end, c.startBar + 1), 1);
}

/** Mutable arrangement state with snapshot/restore for persistence. */
export class Arrangement {
  constructor(onChange) {
    this.onChange = onChange;
    this.patterns = [];
    this.clips = [];
    this._nextN = 1;
  }

  /** @param {object} snapshot  per-instrument state captured by the caller */
  savePattern(snapshot) {
    const pattern = {
      id: `p${Date.now().toString(36)}${this._nextN}`,
      name: `P${this._nextN}`,
      color: (this._nextN - 1) % PATTERN_COLORS,
      ...snapshot,
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

  /** Place the pattern at (track, bar). Returns true if something changed. */
  place(track, bar, patternId) {
    if (!canPlace(this.clips, track, bar, patternId)) return false;
    this.clips.push({ patternId, track, startBar: bar });
    this.onChange();
    return true;
  }

  /** Remove the clip at (track, bar). Returns true if something changed. */
  remove(track, bar) {
    const clip = clipAt(this.clips, track, bar);
    if (!clip) return false;
    this.clips = this.clips.filter((c) => c !== clip);
    this.onChange();
    return true;
  }

  clearClips() {
    this.clips = [];
    this.onChange();
  }

  get bars() {
    return songBars(this.clips);
  }

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
