import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baselineRoot = process.env.BASELINE_BUILD;
const candidateRoot = process.env.CANDIDATE_BUILD || path.join(root, 'tmp/phase2/package-f/build/client');
if (!baselineRoot || !process.env.PLAYWRIGHT_MODULE) throw new Error('Set BASELINE_BUILD and PLAYWRIGHT_MODULE');
const routes = ['how-it-works.exporting-and-downloads', 'how-it-works.troubleshooting', 'png-to-svg-for-cricut', 'svg-background-editor', 'author.suhas-sunder', 'svg-sprite-generator'];
const report = { note: 'Local cold Chromium measurements with third-party requests blocked; not field Core Web Vitals, production timings or a revenue forecast. Route chunks exclude shared imports; inventory totals are not per-page payloads.', bundles: {}, navigation: [] };
for (const [label, folder] of [['baseline', baselineRoot], ['candidate', candidateRoot]]) {
  const files = await readdir(path.join(folder, 'assets'));
  const all = await Promise.all(files.filter(name => /\.(js|css)$/.test(name)).map(async name => { const b = await readFile(path.join(folder, 'assets', name)); return { name, bytes: b.length, gzip: gzipSync(b).length }; }));
  report.bundles[label] = { totalBytes: all.reduce((sum, file) => sum + file.bytes, 0), totalGzip: all.reduce((sum, file) => sum + file.gzip, 0), routes: Object.fromEntries(routes.map(route => [route, all.find(file => new RegExp(`^${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[A-Za-z0-9_-]+\\.js$`).test(file.name)) || null])) };
}
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch();
try {
  for (const [label, origin] of [['baseline', process.env.BASELINE_URL || 'http://127.0.0.1:5280'], ['candidate', process.env.BASE_URL || 'http://127.0.0.1:5290']]) {
    for (const route of ['/', '/how-it-works/exporting-and-downloads', '/png-to-svg-for-cricut', '/svg-background-editor']) {
      const samples = [];
      for (let run = 0; run < 3; run++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        await page.route('**/*', request => new URL(request.request().url()).origin === origin ? request.continue() : request.abort());
        await page.goto(origin + route, { waitUntil: 'load' });
        await page.waitForTimeout(250);
        samples.push(await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const r = performance.getEntriesByType('resource').filter(item => item.name.startsWith(location.origin)); return { domContentLoadedMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd, localTransferBytes: n.transferSize + r.reduce((sum, item) => sum + item.transferSize, 0), localRequests: r.length, documentBytes: n.decodedBodySize }; }));
        await context.close();
      }
      report.navigation.push({ label, route, samples, medianDOMContentLoadedMs: samples.map(item => item.domContentLoadedMs).sort((a,b) => a-b)[1] });
    }
  }
} finally { await browser.close(); }
await writeFile(new URL('./performance.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.bundles, null, 2));
