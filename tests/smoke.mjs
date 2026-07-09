// Browser smoke test: node tests/smoke.mjs (needs a server on :8080)
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
await page.click('#start-btn');
await page.waitForSelector('#start-overlay.hidden');

// Press degree I via keyboard, check the LCD shows the chord
await page.keyboard.down('a');
await page.waitForTimeout(300);
const chord = await page.textContent('#lcd-chord');
const activeCount = await page.locator('.chord-btn.active').count();
await page.keyboard.up('a');

// Switch flavor to seventh and press V
await page.keyboard.press('2');
await page.keyboard.down('g');
await page.waitForTimeout(200);
const chordV7 = await page.textContent('#lcd-chord');
await page.keyboard.up('g');

// Change key to A minor, press I
await page.selectOption('#root-select', '9');
await page.click('#mode-toggle');
await page.keyboard.press('1');
await page.keyboard.down('a');
await page.waitForTimeout(200);
const chordAm = await page.textContent('#lcd-chord');
await page.keyboard.up('a');

// Looper: rec, play a chord, check event count appears
await page.click('#loop-rec');
await page.keyboard.down('s');
await page.waitForTimeout(400);
await page.keyboard.up('s');
await page.waitForTimeout(200);
const loopText = await page.textContent('#lcd-loop');
await page.click('#loop-rec');
await page.click('#loop-play'); // stop
await page.click('#loop-clear');
const loopCleared = await page.textContent('#lcd-loop');

// Drum machine: toggle two kick steps, check they light up
await page.locator('.drum-cell').nth(0).click();
await page.locator('.drum-cell').nth(4).click();
const drumOn = await page.locator('.drum-cell.on').count();

// Save the loop (has 0 chord events after clear, but drums are on) as a pattern
await page.click('#pat-save');
const chips = await page.locator('.pat-chip').count();

// Place the pattern on the playlist and play the song
await page.locator('.pl-cell').first().click();
const clipCells = await page.locator('.pl-cell.clip').count();
await page.click('#song-play');
await page.waitForTimeout(600);
const lcdSong = await page.textContent('#lcd-loop');
const songBtn = await page.textContent('#song-play');
await page.click('#song-play'); // stop

// Remove the clip by clicking it again
await page.locator('.pl-cell.clip').first().click();
const clipsAfter = await page.locator('.pl-cell.clip').count();

await page.screenshot({ path: 'tests/screenshot-desktop.png' });
await page.setViewportSize({ width: 390, height: 800 });
await page.screenshot({ path: 'tests/screenshot-mobile.png' });
await browser.close();

console.log('chord I:', chord, '| active buttons:', activeCount);
console.log('chord V (7th):', chordV7);
console.log('chord i (A minor):', chordAm);
console.log('loop while rec:', loopText, '| after clear:', loopCleared);
console.log('drum cells on:', drumOn, '| pattern chips:', chips);
console.log('clip cells:', clipCells, '| song lcd:', lcdSong, '| song btn:', songBtn);
console.log('clips after remove:', clipsAfter);
console.log('console errors:', errors.length ? errors : 'none');

if (chord !== 'C') { console.error('FAIL: expected C'); process.exit(1); }
if (chordV7 !== 'G7') { console.error('FAIL: expected G7'); process.exit(1); }
if (chordAm !== 'Am') { console.error('FAIL: expected Am, got ' + chordAm); process.exit(1); }
if (!/·1/.test(loopText)) { console.error('FAIL: expected 1 loop event'); process.exit(1); }
if (!/·0/.test(loopCleared)) { console.error('FAIL: expected 0 after clear'); process.exit(1); }
if (drumOn !== 2) { console.error('FAIL: expected 2 drum cells on'); process.exit(1); }
if (chips !== 1) { console.error('FAIL: expected 1 pattern chip'); process.exit(1); }
if (clipCells !== 4) { console.error('FAIL: expected a 4-bar clip'); process.exit(1); }
if (!/SONG:PLAY/.test(lcdSong)) { console.error('FAIL: expected SONG:PLAY on LCD'); process.exit(1); }
if (!/STOP/.test(songBtn)) { console.error('FAIL: expected song button to show STOP'); process.exit(1); }
if (clipsAfter !== 0) { console.error('FAIL: expected clip removed'); process.exit(1); }
if (errors.length) { console.error('FAIL: console errors'); process.exit(1); }
console.log('\nSmoke test passed.');
