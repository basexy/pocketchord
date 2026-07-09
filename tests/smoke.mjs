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

await page.screenshot({ path: 'tests/screenshot-desktop.png' });
await page.setViewportSize({ width: 390, height: 800 });
await page.screenshot({ path: 'tests/screenshot-mobile.png' });
await browser.close();

console.log('chord I:', chord, '| active buttons:', activeCount);
console.log('chord V (7th):', chordV7);
console.log('chord i (A minor):', chordAm);
console.log('loop while rec:', loopText, '| after clear:', loopCleared);
console.log('console errors:', errors.length ? errors : 'none');

if (chord !== 'C') { console.error('FAIL: expected C'); process.exit(1); }
if (chordV7 !== 'G7') { console.error('FAIL: expected G7'); process.exit(1); }
if (chordAm !== 'Am') { console.error('FAIL: expected Am, got ' + chordAm); process.exit(1); }
if (!/·1/.test(loopText)) { console.error('FAIL: expected 1 loop event'); process.exit(1); }
if (!/·0/.test(loopCleared)) { console.error('FAIL: expected 0 after clear'); process.exit(1); }
if (errors.length) { console.error('FAIL: console errors'); process.exit(1); }
console.log('\nSmoke test passed.');
