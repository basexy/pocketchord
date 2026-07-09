// Run with: node tests/song.test.mjs — pure playlist helpers, no Tone needed.
import {
  clipAt, canPlace, songBars, patternById, SONG_BARS,
} from '../src/song.js';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

const patterns = [
  { id: 'a', name: 'P1', bars: 4, chords: [], drums: [] },
  { id: 'b', name: 'P2', bars: 2, chords: [], drums: [] },
];
const clips = [
  { patternId: 'a', track: 0, startBar: 0 }, // bars 0-3
  { patternId: 'b', track: 0, startBar: 6 }, // bars 6-7
  { patternId: 'b', track: 1, startBar: 0 }, // bars 0-1
];

// --- patternById ---
check('patternById finds', patternById(patterns, 'b')?.name === 'P2');
check('patternById missing → null', patternById(patterns, 'zz') === null);

// --- clipAt: clip covers its full length ---
check('clip start bar', clipAt(clips, patterns, 0, 0) === clips[0]);
check('clip middle bar', clipAt(clips, patterns, 0, 3) === clips[0]);
check('bar after clip end is free', clipAt(clips, patterns, 0, 4) === null);
check('gap between clips is free', clipAt(clips, patterns, 0, 5) === null);
check('second clip found', clipAt(clips, patterns, 0, 6) === clips[1]);
check('tracks are independent', clipAt(clips, patterns, 1, 3) === null);

// --- canPlace: overlaps and bounds ---
check('placing over existing clip fails', !canPlace(clips, patterns, 0, 2, 'b'));
check('tail overlap fails', !canPlace(clips, patterns, 0, 5, 'a'), '4 bars from 5 hits clip at 6');
check('fits in a gap', canPlace(clips, patterns, 0, 4, 'b'));
check('fits on empty track', canPlace(clips, patterns, 2, 0, 'a'));
check('past song end fails', !canPlace(clips, patterns, 2, SONG_BARS - 1, 'b'));
check('unknown pattern fails', !canPlace(clips, patterns, 2, 0, 'zz'));

// --- songBars ---
check('empty song is 1 bar', songBars([], patterns) === 1);
check('song length = end of last clip', songBars(clips, patterns) === 8);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll song tests passed.');
