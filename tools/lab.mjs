// Fast material lab capture: node tools/lab.mjs <out.png> [query]
import { chromium } from '/home/user/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs';

const out = process.argv[2];
const query = process.argv[3] || '';
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1240, height: 700 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:5177/tools/lab.html' + query, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, { timeout: 30000 }).catch(() => { });
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
