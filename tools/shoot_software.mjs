// Capture of the CPU fallback renderer (WebGL disabled). Usage:
//   node tools/shoot_software.mjs <url> <out.png> [width] [height] [waitMs]
import { chromium } from '/home/user/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs';

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 1440);
const height = Number(process.argv[5] || 900);
const wait = Number(process.argv[6] || 12000);

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl', '--disable-webgl2', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(wait);
await page.screenshot({ path: out });
if (errors.length) console.log('CONSOLE:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
