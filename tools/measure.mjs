// Measures the real GPU cost of one frame by patching the WebGL context.
// Usage: node tools/measure.mjs <url>
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
  const stats = { calls: 0, triangles: 0, instances: 0, frames: 0 };
  globalThis.ISLE_GL_STATS = stats;
  globalThis.ISLE_GL_PEAK = { calls: 0, triangles: 0 };
  for (const name of ['WebGL2RenderingContext', 'WebGLRenderingContext']) {
    const proto = globalThis[name]?.prototype;
    if (!proto) continue;
    const wrap = (key, factor) => {
      const original = proto[key];
      if (!original) return;
      proto[key] = function (...args) {
        stats.calls++;
        const count = args[1] ?? 0;
        const inst = factor ? (args[4] ?? 1) : 1;
        stats.triangles += (count / 3) * inst;
        stats.instances += inst;
        return original.apply(this, args);
      };
    };
    wrap('drawElements', false);
    wrap('drawArrays', false);
    wrap('drawElementsInstanced', true);
  }
  // The peak counts the busiest frame, which is the one the scene is built for.
  const raf = globalThis.requestAnimationFrame.bind(globalThis);
  let last = 0;
  globalThis.requestAnimationFrame = cb => raf(t => {
    if (t - last > 40) {
      last = t;
      stats.frames++;
      globalThis.ISLE_GL_PEAK.calls = Math.max(globalThis.ISLE_GL_PEAK.calls, stats.calls);
      globalThis.ISLE_GL_PEAK.triangles = Math.max(globalThis.ISLE_GL_PEAK.triangles, stats.triangles);
      stats.calls = 0;
      stats.triangles = 0;
      stats.instances = 0;
    }
    cb(t);
  });
});
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(14000);
const out = await page.evaluate(() => ({
  peak: globalThis.ISLE_GL_PEAK,
  frames: globalThis.ISLE_GL_STATS.frames
}));
console.log(JSON.stringify(out, null, 2));
if (errors.length) console.log('CONSOLE:\n' + errors.slice(0, 20).join('\n'));
await browser.close();
