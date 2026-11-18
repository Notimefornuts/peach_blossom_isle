// Counts the real draw calls, triangles and texture memory of the live scene by
// patching the WebGL context before the page loads. Usage:
//   node tools/stats.mjs <url>
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('/home/user/.npm/_npx/f0a362733743bae2/node_modules/playwright-core/index.mjs'));
}

const url = process.argv[2];
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => {
  const stats = { calls: 0, triangles: 0, elements: 0, textures: 0 };
  globalThis.ISLE_GL_STATS = stats;
  // Keep only the last complete frame so the numbers describe one draw pass.
  const raf = globalThis.requestAnimationFrame.bind(globalThis);
  let pending = false;
  globalThis.requestAnimationFrame = cb => raf(t => {
    if (!pending) {
      pending = true;
      stats.calls = 0;
      stats.triangles = 0;
      stats.elements = 0;
      setTimeout(() => { pending = false; }, 0);
    }
    cb(t);
  });
  for (const name of ['WebGL2RenderingContext', 'WebGLRenderingContext']) {
    const proto = globalThis[name]?.prototype;
    if (!proto) continue;
    const drawElements = proto.drawElements;
    proto.drawElements = function (mode, count, type, offset) {
      stats.calls++;
      stats.triangles += count / 3;
      stats.elements++;
      return drawElements.call(this, mode, count, type, offset);
    };
    const drawArrays = proto.drawArrays;
    proto.drawArrays = function (mode, first, count) {
      stats.calls++;
      stats.triangles += count / 3;
      stats.elements++;
      return drawArrays.call(this, mode, first, count);
    };
    const drawInstanced = proto.drawElementsInstanced;
    if (drawInstanced) proto.drawElementsInstanced = function (mode, count, type, offset, inst) {
      stats.calls++;
      stats.triangles += count / 3 * inst;
      stats.elements++;
      return drawInstanced.call(this, mode, count, type, offset, inst);
    };
  }
});
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(12000);
const stats = await page.evaluate(() => {
  const s = globalThis.ISLE_GL_STATS;
  return {
    drawCalls: s.calls,
    triangles: Math.round(s.triangles),
    drawElements: s.elements
  };
});
console.log(JSON.stringify(stats, null, 2));
if (errors.length) console.log('CONSOLE:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
