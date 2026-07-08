// chords.js — pure music theory: scales, diatonic chords, flavors, voice leading.
// No audio, no DOM. Testable in Node.

export const RANGE_MIN = 48; // C3
export const RANGE_MAX = 72; // C5

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]; // natural minor

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

// Keys whose signature uses flats (major: F B♭ E♭ A♭ D♭ G♭ / minor: d g c f b♭ e♭)
const FLAT_MAJOR_ROOTS = new Set([5, 10, 3, 8, 1, 6]);
const FLAT_MINOR_ROOTS = new Set([2, 7, 0, 5, 10, 3]);

export const ROOT_OPTIONS = [
  { pc: 0, name: 'C' }, { pc: 1, name: 'D♭' }, { pc: 2, name: 'D' },
  { pc: 3, name: 'E♭' }, { pc: 4, name: 'E' }, { pc: 5, name: 'F' },
  { pc: 6, name: 'F♯' }, { pc: 7, name: 'G' }, { pc: 8, name: 'A♭' },
  { pc: 9, name: 'A' }, { pc: 10, name: 'B♭' }, { pc: 11, name: 'B' },
];

export const FLAVORS = ['triad', 'seventh', 'sus', 'add9'];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function noteNamesFor(rootPc, mode) {
  const flats = mode === 'minor' ? FLAT_MINOR_ROOTS.has(rootPc) : FLAT_MAJOR_ROOTS.has(rootPc);
  return flats ? FLAT_NAMES : SHARP_NAMES;
}

export function buildScale(rootPc, mode) {
  const steps = mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS;
  return steps.map((s) => (rootPc + s) % 12);
}

/**
 * Diatonic chord on a scale degree (0–6), with a flavor transformation
 * applied before voicing. Returns pitch classes in stacking order
 * (root first), plus display labels.
 */
export function diatonicChord(rootPc, mode, degree, flavor = 'triad') {
  const scale = buildScale(rootPc, mode);
  const at = (k) => scale[(degree + k) % 7];
  const chordRoot = at(0);
  const iv = (k) => (at(k) - chordRoot + 12) % 12; // interval above chord root

  const third = iv(2);
  const fifth = iv(4);
  const seventh = iv(6);
  const second = iv(1);
  const fourth = iv(3);

  const quality = third === 4 ? 'maj' : fifth === 6 ? 'dim' : 'min';
  const triadSuffix = { maj: '', min: 'm', dim: 'dim' }[quality];

  let pcs;
  let suffix;
  switch (flavor) {
    case 'seventh':
      pcs = [at(0), at(2), at(4), at(6)];
      if (quality === 'maj') suffix = seventh === 11 ? 'maj7' : '7';
      else if (quality === 'min') suffix = seventh === 10 ? 'm7' : 'm(maj7)';
      else suffix = seventh === 10 ? 'm7♭5' : 'dim7';
      break;
    case 'sus': {
      // Prefer sus4; fall back to sus2 when the diatonic 4th is a tritone.
      const useFourth = fourth === 5;
      pcs = [at(0), useFourth ? at(3) : at(1), at(4)];
      suffix = useFourth ? 'sus4' : 'sus2';
      break;
    }
    case 'add9':
      pcs = [at(0), at(2), at(4), at(1)];
      suffix = triadSuffix + (second === 2 ? 'add9' : 'add♭9');
      break;
    default:
      pcs = [at(0), at(2), at(4)];
      suffix = triadSuffix;
  }

  let roman = quality === 'maj' ? ROMAN[degree] : ROMAN[degree].toLowerCase();
  if (quality === 'dim') roman += '°';

  const rootName = noteNamesFor(rootPc, mode)[chordRoot];
  return { degree, root: chordRoot, pcs: dedupe(pcs), label: rootName + suffix, roman };
}

export function allDegreeChords(rootPc, mode, flavor) {
  return Array.from({ length: 7 }, (_, d) => diatonicChord(rootPc, mode, d, flavor));
}

/** Root-position voicing in the middle of the range, for the first chord. */
export function defaultVoicing(pcs) {
  const notes = [RANGE_MIN + pcs[0]]; // root in C3–B3
  for (let i = 1; i < pcs.length; i++) {
    const prev = notes[notes.length - 1];
    let n = prev + (((pcs[i] - prev) % 12) + 12) % 12;
    if (n === prev) n += 12;
    notes.push(n);
  }
  return notes;
}

/**
 * Voice leading: keep common tones in place, move each remaining voice to
 * the nearest realization of a new pitch class, keep everything in range.
 */
export function voiceLead(prevVoicing, pcs) {
  if (!prevVoicing || prevVoicing.length === 0) return defaultVoicing(pcs);

  const result = [];
  const pool = [...pcs];
  const free = [];

  // 1. Common tones stay where they are.
  for (const note of prevVoicing) {
    const i = pool.indexOf(((note % 12) + 12) % 12);
    if (i !== -1) {
      result.push(note);
      pool.splice(i, 1);
    } else {
      free.push(note);
    }
  }

  // 2. Pair remaining pitch classes with freed voices, shortest move first.
  while (pool.length && free.length) {
    let best = null;
    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < free.length; j++) {
        const cand = nearestMidi(pool[i], free[j]);
        const d = Math.abs(cand - free[j]);
        if (!best || d < best.d) best = { i, j, cand, d };
      }
    }
    result.push(fitNote(best.cand, result));
    pool.splice(best.i, 1);
    free.splice(best.j, 1);
  }

  // 3. Chord grew: drop extra tones near the center of the current voicing.
  for (const pc of pool) {
    const center = result.reduce((a, b) => a + b, 0) / result.length;
    result.push(fitNote(nearestMidi(pc, Math.round(center)), result));
  }

  return result.sort((a, b) => a - b);
}

/** MIDI note with pitch class `pc` closest to `target`. */
function nearestMidi(pc, target) {
  let n = target + (((pc - target) % 12) + 12) % 12;
  if (n - target > 6) n -= 12;
  return n;
}

/** Clamp into range and resolve unison collisions by octave shifts. */
function fitNote(note, taken) {
  let n = note;
  while (n < RANGE_MIN) n += 12;
  while (n > RANGE_MAX) n -= 12;
  let guard = 0;
  while (taken.includes(n) && guard++ < 8) {
    n += 12;
    if (n > RANGE_MAX) n -= 24;
    if (n < RANGE_MIN) n += 12;
  }
  return n;
}

const MIDI_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI number → Tone.js-friendly note name, e.g. 60 → "C4". */
export function midiToName(midi) {
  return MIDI_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

function dedupe(arr) {
  return [...new Set(arr)];
}
