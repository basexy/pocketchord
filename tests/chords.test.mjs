// Run with: node tests/chords.test.mjs
import {
  buildScale, diatonicChord, allDegreeChords,
  defaultVoicing, voiceLead, midiToName,
  RANGE_MIN, RANGE_MAX,
} from '../src/chords.js';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- Scales ---
check('C major scale', eq(buildScale(0, 'major'), [0, 2, 4, 5, 7, 9, 11]));
check('A minor scale', eq(buildScale(9, 'minor'), [9, 11, 0, 2, 4, 5, 7]));
check('E♭ major scale', eq(buildScale(3, 'major'), [3, 5, 7, 8, 10, 0, 2]));

// --- Diatonic triads in C major ---
const labels = allDegreeChords(0, 'major', 'triad').map((c) => c.label);
check('C major triads', eq(labels, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']), labels.join(','));
const romans = allDegreeChords(0, 'major', 'triad').map((c) => c.roman);
check('C major romans', eq(romans, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']), romans.join(','));

// --- Triads in A minor ---
const minorLabels = allDegreeChords(9, 'minor', 'triad').map((c) => c.label);
check('A minor triads', eq(minorLabels, ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']), minorLabels.join(','));

// --- Sevenths in C major ---
const sevenths = allDegreeChords(0, 'major', 'seventh').map((c) => c.label);
check('C major sevenths',
  eq(sevenths, ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']), sevenths.join(','));

// --- Sus: IV in C major has a tritone 4th (B), must fall back to sus2 ---
const susIV = diatonicChord(0, 'major', 3, 'sus');
check('IV sus avoids tritone', susIV.label === 'Fsus2' && eq(susIV.pcs, [5, 7, 0]), susIV.label);
const susV = diatonicChord(0, 'major', 4, 'sus');
check('V sus4', susV.label === 'Gsus4' && eq(susV.pcs, [7, 0, 2]), susV.label);

// --- add9 ---
const add9I = diatonicChord(0, 'major', 0, 'add9');
check('I add9', add9I.label === 'Cadd9' && eq(add9I.pcs, [0, 4, 7, 2]), add9I.label);
const add9iii = diatonicChord(0, 'major', 2, 'add9');
check('iii add♭9 named honestly', add9iii.label === 'Emadd♭9', add9iii.label);

// --- Flat spelling in flat keys ---
check('E♭ major V is B♭', diatonicChord(3, 'major', 4, 'triad').label === 'B♭');
check('E major V is B (sharps)', diatonicChord(4, 'major', 4, 'triad').label === 'B');

// --- Default voicing: root position, root in C3–B3 ---
const dv = defaultVoicing([0, 4, 7]);
check('default C voicing', eq(dv, [48, 52, 55]), dv.join(','));

// --- Voice leading: C → Am keeps C and E, moves G→A ---
const cMaj = voiceLead(null, [0, 4, 7]);
const aMin = voiceLead(cMaj, [9, 0, 4]);
check('C→Am common tones', aMin.includes(48) && aMin.includes(52), aMin.join(','));
check('C→Am nearest move G→A', aMin.includes(57), aMin.join(','));

// --- Voice leading: C → G moves minimally (total motion small) ---
const gMaj = voiceLead(cMaj, [7, 11, 2]);
const motion = totalMotion(cMaj, gMaj);
check('C→G small total motion', motion <= 6, `motion=${motion} ${gMaj.join(',')}`);

// --- Growing chord: triad → seventh keeps the triad in place ---
const c7 = voiceLead(cMaj, [0, 4, 7, 10]);
check('C→C7 keeps common tones', [48, 52, 55].every((n) => c7.includes(n)), c7.join(','));
check('C→C7 has 4 voices', c7.length === 4);

// --- Random walk stays in range with no duplicate notes ---
let prev = null;
let ok = true;
let detail = '';
let seed = 12345;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = 0; i < 500; i++) {
  const deg = Math.floor(rand() * 7);
  const flavor = ['triad', 'seventh', 'sus', 'add9'][Math.floor(rand() * 4)];
  const mode = rand() < 0.5 ? 'major' : 'minor';
  const root = Math.floor(rand() * 12);
  const chord = diatonicChord(root, mode, deg, flavor);
  const v = voiceLead(prev, chord.pcs);
  if (v.some((n) => n < RANGE_MIN || n > RANGE_MAX)) { ok = false; detail = `out of range: ${v}`; break; }
  if (new Set(v).size !== v.length) { ok = false; detail = `duplicate notes: ${v}`; break; }
  if (new Set(v.map((n) => n % 12)).size !== chord.pcs.length) { ok = false; detail = `missing pcs: ${v} for ${chord.pcs}`; break; }
  prev = v;
}
check('500-chord random walk in range, complete, no unisons', ok, detail);

// --- Consecutive same-key motion is smooth on average ---
prev = voiceLead(null, diatonicChord(0, 'major', 0, 'triad').pcs);
let worst = 0;
for (const deg of [3, 4, 5, 0, 1, 4, 0]) {
  const v = voiceLead(prev, diatonicChord(0, 'major', deg, 'triad').pcs);
  worst = Math.max(worst, totalMotion(prev, v));
  prev = v;
}
check('I-IV-V-vi-I-ii-V-I progression stays smooth', worst <= 9, `worst=${worst}`);

// --- midiToName ---
check('midiToName 60 = C4', midiToName(60) === 'C4');
check('midiToName 61 = C#4', midiToName(61) === 'C#4');

function totalMotion(a, b) {
  // sum of distances from each new voice to its nearest old voice
  return b.reduce((sum, n) => sum + Math.min(...a.map((m) => Math.abs(n - m))), 0);
}

console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
