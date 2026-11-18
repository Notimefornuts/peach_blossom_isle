// Low angle capture of the island facade. Usage:
//   node tools/shoot_facade.mjs <url> <out.png> [width] [height] [waitMs] [zoom] [dragX] [dragY]
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('/home/user/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs'));
}

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 1280);
const height = Number(process.argv[5] || 800);
const wait = Number(process.argv[6] || 16000);
const zoom = Number(process.argv[7] || 0);
const dragX = Number(process.argv[8] || 0);
const dragY = Number(process.argv[9] || 0);
const curX = Number(process.argv[10] || 0.5);
const curY = Number(process.argv[11] || 0.62);

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
if (dragX || dragY) {
  await page.mouse.move(width * .5, height * .5);
  await page.mouse.down();
  await page.mouse.move(width * .5 + dragX, height * .5 + dragY, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(900);
}
if (zoom) {
  await page.mouse.move(width * curX, height * curY);
  for (let i = 0; i < zoom; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1600);
}
await page.screenshot({ path: out, timeout: 180000 });
if (errors.length) console.log('CONSOLE:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
