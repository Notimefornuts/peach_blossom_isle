// Close-up capture of the shoreline. Usage:
//   node tools/shoot.mjs <url> <out.png> [width] [height] [waitMs] [zoom] [dragX]
import { chromium } from '/home/user/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs';

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 1440);
const height = Number(process.argv[5] || 900);
const wait = Number(process.argv[6] || 9000);
const zoom = Number(process.argv[7] || 0);
const drag = Number(process.argv[8] || 0);

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-lcd-text']
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(wait);
if (drag) {
  await page.mouse.move(width * .5, height * .5);
  await page.mouse.down();
  await page.mouse.move(width * .5 + drag, height * .5, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(700);
}
if (zoom) {
  await page.mouse.move(width * .5, height * .5);
  for (let i = 0; i < zoom; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1400);
}
await page.screenshot({ path: out });
if (errors.length) console.log('CONSOLE:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
