import { chromium } from 'playwright';
const base = process.env.GYMOS_URL || 'http://127.0.0.1:8765/';
const shots = (process.env.SHOTS || './shots/');
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera', 'microphone'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: shots + '01-onboard.png' });
await page.click('#ob-next'); await page.waitForTimeout(200);
await page.screenshot({ path: shots + '02-onboard2.png' });
await page.click('#ob-next'); await page.waitForTimeout(200);
await page.screenshot({ path: shots + '03-onboard3.png' });
await page.click('#ob-next'); // starts demo
const log = [];
for (const t of [3000, 9000, 16000, 26000, 33000]) {
  await page.waitForTimeout(t - (log.length ? log[log.length-1] : 0));
  log.push(t);
  const state = await page.evaluate(() => ({ mode: Spotter.W.mode, screen: document.querySelector('.screen.active').id, count: document.getElementById('count').textContent, cue: document.getElementById('cue').textContent }));
  console.log(t, JSON.stringify(state));
  await page.screenshot({ path: shots + `10-demo-${t}.png` });
}
await page.waitForFunction(() => document.querySelector('.screen.active').id === 'summary', null, { timeout: 30000 });
await page.waitForTimeout(400);
await page.screenshot({ path: shots + '20-summary.png', fullPage: false });
await page.evaluate(() => document.getElementById('summary-body').scrollTo(0, 9999));
await page.screenshot({ path: shots + '21-summary-bottom.png' });
await page.click('#sum-done'); await page.waitForTimeout(300);
await page.screenshot({ path: shots + '30-home.png' });
await page.click('.ex-row[data-id="squat"]'); await page.waitForTimeout(300);
await page.screenshot({ path: shots + '31-setup.png' });
await page.click('#qr-btn'); await page.waitForTimeout(2500);
await page.screenshot({ path: shots + '32-qr.png' });
await page.click('#qr [data-go="setup"]'); await page.waitForTimeout(200);
// Real camera path with the fake camera: model must load and the check screen must appear
await page.click('#start-btn');
try {
  await page.waitForFunction(() => Spotter.W.mode === 'check', null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  console.log('camera path OK, mode', await page.evaluate(() => Spotter.W.mode));
} catch (e) { console.log('camera path FAILED', e.message, await page.evaluate(() => document.getElementById('loading-t').textContent)); }
await page.screenshot({ path: shots + '40-check.png' });
await page.click('#live-close'); await page.waitForTimeout(300);
await page.click('[data-go="home"]').catch(()=>{}); await page.waitForTimeout(200);
await page.evaluate(() => Spotter.show('settings')); await page.waitForTimeout(300);
await page.screenshot({ path: shots + '50-settings.png' });
await page.evaluate(() => Spotter.show('history')); await page.waitForTimeout(300);
await page.screenshot({ path: shots + '51-history.png' });
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
