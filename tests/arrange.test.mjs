// Run with: node tests/arrange.test.mjs — pure studio arrangement model.
import {
  Arrangement, clipAt, canPlace, songBars, patternById, SONG_BARS,
} from '../src/studio/arrange.js';

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
  { id: 'a', name: 'P1', color: 0 },
  { id: 'b', name: 'P2', color: 1 },
];
const clips = [
  { patternId: 'a', track: 0, startBar: 0 },
  { patternId: 'b', track: 0, startBar: 3 },
  { patternId: 'b', track: 1, startBar: 0 },
];

// --- helpers ---
check('patternById finds', patternById(patterns, 'b')?.name === 'P2');
check('patternById missing → null', patternById(patterns, 'zz') === null);
check('clipAt hit', clipAt(clips, 0, 3) === clips[1]);
check('clipAt empty bar', clipAt(clips, 0, 1) === null);
check('clipAt tracks independent', clipAt(clips, 1, 3) === null);
check('canPlace on free cell', canPlace(clips, 2, 0, 'a'));
check('canPlace over clip fails', !canPlace(clips, 0, 0, 'b'));
check('canPlace past song end fails', !canPlace(clips, 2, SONG_BARS, 'a'));
check('canPlace without pattern fails', !canPlace(clips, 2, 0, null));
check('empty song is 1 bar', songBars([]) === 1);
check('song length = last clip end', songBars(clips) === 4);

// --- Arrangement mutations ---
let changes = 0;
const arr = new Arrangement(() => { changes++; });
const p1 = arr.savePattern({ drums: [], bass: [], stabs: { steps: [], chord: 'm7' } });
const p2 = arr.savePattern({ drums: [], bass: [], stabs: { steps: [], chord: 'm9' } });
check('savePattern names sequentially', p1.name === 'P1' && p2.name === 'P2');
check('savePattern fires onChange', changes === 2);

check('place works', arr.place(0, 0, p1.id) && arr.clips.length === 1);
check('place on occupied cell rejected', !arr.place(0, 0, p2.id) && arr.clips.length === 1);
check('remove works', arr.remove(0, 0) && arr.clips.length === 0);
check('remove empty cell is a no-op', !arr.remove(0, 0));

arr.place(0, 5, p2.id);
arr.deletePattern(p2.id);
check('deletePattern removes its clips', arr.clips.length === 0 && arr.patterns.length === 1);

arr.place(1, 2, p1.id);
const json = JSON.parse(JSON.stringify(arr.toJSON()));
const arr2 = new Arrangement(() => {});
arr2.restore(json);
check('restore round-trips', arr2.patterns.length === 1 && arr2.clips.length === 1 && arr2.bars === 3);
const p3 = arr2.savePattern({ drums: [], bass: [], stabs: { steps: [], chord: 'm7' } });
check('restore keeps name counter', p3.name === 'P3');

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll arrange tests passed.');
