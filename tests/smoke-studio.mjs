// Browser smoke test for the studio page: node tests/smoke-studio.mjs
// (needs a server on :8080)
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8080/studio.html', { waitUntil: 'networkidle' });
await page.click('#start-btn');
await page.waitForSelector('#start-overlay.hidden');

// Fresh project ships with a starter groove: kick 4-on-the-floor etc.
const drumsOn = await page.locator('#drum-grid .cell.on').count();
const bassOn = await page.locator('#bass-roll .cell.on').count();
const stabsOn = await page.locator('#stab-row .cell.on').count();

// Live playback: play, check the playhead moves, stop
await page.click('#play-btn');
await page.waitForTimeout(700);
const playheads = await page.locator('#drum-grid .cell.ph').count();
const playBtn = await page.textContent('#play-btn');
await page.click('#play-btn');

// Edit each sequencer
await page.locator('#drum-grid .cell').nth(2).click(); // kick step 3
const drumsAfter = await page.locator('#drum-grid .cell.on').count();
await page.locator('#bass-roll .cell').nth(1).click(); // top row step 2
const bassAfter = await page.locator('#bass-roll .cell.on').count();
await page.locator('#bass-acc .cell').nth(1).click();
const accOn = await page.locator('#bass-acc .cell.on').count();

// Song dock: save a pattern (opens the dock), paint a clip, play the song
await page.click('#pat-save');
const dockVisible = await page.locator('#dock-body').isVisible();
const chips = await page.locator('.pat-chip').count();
await page.locator('.pl-cell').first().click();
const clipCells = await page.locator('.pl-cell.clip').count();
await page.click('#song-play');
await page.waitForTimeout(600);
const songBtn = await page.textContent('#song-play');
await page.click('#song-play'); // stop
await page.locator('.pl-cell.clip').first().click(); // erase the clip
const clipsAfter = await page.locator('.pl-cell.clip').count();

// Persistence: reload and check the drum edit survived
await page.reload({ waitUntil: 'networkidle' });
const drumsPersisted = await page.locator('#drum-grid .cell.on').count();
const chipsPersisted = await page.locator('.pat-chip').count();

await page.click('#start-btn');
await page.waitForSelector('#start-overlay.hidden');
await page.waitForTimeout(400); // let the overlay fade out
const dockClosedOnLoad = !(await page.locator('#dock-body').isVisible());
await page.click('#dock-toggle'); // open the dock for the screenshot
await page.screenshot({ path: 'tests/screenshot-studio.png' });
await page.setViewportSize({ width: 390, height: 800 });
await page.screenshot({ path: 'tests/screenshot-studio-mobile.png' });
await browser.close();

console.log('starter groove — drums:', drumsOn, 'bass:', bassOn, 'stabs:', stabsOn);
console.log('playing — playheads:', playheads, '| play btn:', playBtn);
console.log('edits — drums:', drumsAfter, 'bass:', bassAfter, 'acc:', accOn);
console.log('dock open:', dockVisible, '| chips:', chips, '| clip cells:', clipCells);
console.log('song btn while playing:', songBtn, '| clips after erase:', clipsAfter);
console.log('after reload — drums:', drumsPersisted, 'chips:', chipsPersisted,
  '| dock closed on load:', dockClosedOnLoad);
console.log('console errors:', errors.length ? errors : 'none');

if (drumsOn !== 10) { console.error('FAIL: starter groove drums'); process.exit(1); }
if (bassOn !== 6) { console.error('FAIL: starter bass seq'); process.exit(1); }
if (stabsOn !== 3) { console.error('FAIL: starter stabs'); process.exit(1); }
if (playheads < 1) { console.error('FAIL: no playhead while playing'); process.exit(1); }
if (!/STOP/.test(playBtn)) { console.error('FAIL: play button should show STOP'); process.exit(1); }
if (drumsAfter !== 11) { console.error('FAIL: drum toggle'); process.exit(1); }
if (bassAfter !== 7) { console.error('FAIL: bass note toggle'); process.exit(1); }
if (accOn !== 2) { console.error('FAIL: accent toggle (starter has 1)'); process.exit(1); }
if (!dockVisible) { console.error('FAIL: dock should open on save'); process.exit(1); }
if (chips !== 1) { console.error('FAIL: expected 1 pattern chip'); process.exit(1); }
if (clipCells !== 1) { console.error('FAIL: expected 1 painted clip'); process.exit(1); }
if (!/STOP/.test(songBtn)) { console.error('FAIL: song button should show STOP'); process.exit(1); }
if (clipsAfter !== 0) { console.error('FAIL: clip erase'); process.exit(1); }
if (drumsPersisted !== 11) { console.error('FAIL: drums not persisted'); process.exit(1); }
if (chipsPersisted !== 1) { console.error('FAIL: pattern not persisted'); process.exit(1); }
if (!dockClosedOnLoad) { console.error('FAIL: dock should start collapsed'); process.exit(1); }
if (errors.length) { console.error('FAIL: console errors'); process.exit(1); }
console.log('\nStudio smoke test passed.');
