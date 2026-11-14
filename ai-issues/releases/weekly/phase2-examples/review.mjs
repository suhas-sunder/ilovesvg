import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:5285');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
const out = path.resolve(process.env.REVIEW_OUTPUT || path.join(root, 'tmp/phase2/examples-review'));
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const manifest = JSON.parse(await readFile(path.join(root, 'public/examples/output-inspection/manifest.json'), 'utf8'));
const report = { base: base.href, assets: [], cases: [], inspector: [], failures: [] };
await mkdir(out, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const example of manifest.examples) {
  for (const [field, hashField] of [['source', 'sourceSha256'], ['traced', 'outputSha256'], ['preview', 'previewSha256']]) {
    const response = await fetch(new URL(example[field], base));
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = digest(bytes);
    if (hash !== example[hashField]) report.failures.push(`${example.id} ${field} hash differs from the manifest`);
    report.assets.push({ id: example.id, field, bytes: bytes.length, hash });
  }
}
for (const engine of ['chromium', 'webkit']) {
  const browser = await pw[engine].launch();
  try {
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
      await page.goto(new URL('/how-it-works/exporting-and-downloads', base).href, { waitUntil: 'networkidle' });
      await page.locator('#conversion-examples').scrollIntoViewIfNeeded();
      for (const figure of await page.locator('#conversion-examples figure').all()) await figure.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('#conversion-examples img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.ilovesvg.com/how-it-works/exporting-and-downloads');
      assert.equal(await page.locator('#conversion-examples figure').count(), 6);
      assert.equal(await page.locator('#conversion-examples a[download]').count(), 13);
      for (const [index, example] of manifest.examples.entries()) {
        const figure = page.locator('#conversion-examples figure').nth(index);
        assert.equal(await figure.locator('figcaption').innerText(), example.label);
        assert.equal(await figure.getByRole('link', { name: 'Download traced SVG', exact: true }).getAttribute('href'), example.traced);
        assert.match(await figure.innerText(), new RegExp(`${example.paths} path elements; ${example.subpaths} subpaths; ${example.images} image elements`));
      }
      const inspectionSteps = await page.locator('#inspect-svg-output ol > li').first().innerText();
      if (!/\bElements\b.*\bCounts\b/s.test(inspectionSteps)) {
        report.failures.push(`${engine} ${width}: inspection guide does not identify Elements before Counts`);
      }
      const state = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, headings: [...document.querySelectorAll('h2')].map(node => node.textContent), images: [...document.querySelectorAll('#conversion-examples img')].map(img => ({ width: img.naturalWidth, height: img.naturalHeight })) }));
      assert.ok(state.overflow <= 1, JSON.stringify({ engine, width, ...state }));
      assert.deepEqual(errors, []);
      let accessibility = null;
      if (process.env.AXE_PATH) {
        await page.addScriptTag({ path: process.env.AXE_PATH });
        accessibility = await page.evaluate(async () => (await axe.run({ include: ['#inspect-svg-output', '#conversion-examples'] })).violations);
        assert.deepEqual(accessibility, []);
      }
      if (width === 390) {
        const downloadLink = page.locator('#conversion-examples figure').first().getByRole('link', { name: 'Download traced SVG', exact: true });
        const [download] = await Promise.all([page.waitForEvent('download'), downloadLink.click()]);
        assert.equal(digest(await readFile(await download.path())), manifest.examples[0].outputSha256);
      }
      await page.screenshot({ path: path.join(out, `${engine}-${width}.png`), fullPage: true });
      report.cases.push({ engine, width, ...state, accessibility, errors });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
    await page.goto(new URL('/svg-preview-viewer', base).href, { waitUntil: 'networkidle' });
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Open SVG', { exact: true }).click(),
    ]);
    await chooser.setFiles(path.join(root, 'public/examples/output-inspection/cut-mark-traced.svg'));
    const elements = page.getByRole('button', { name: 'Elements', exact: true });
    if (!(await elements.isVisible())) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await elements.click();
    await page.getByText('Counts', { exact: true }).waitFor();
    const counts = await page.getByText('Counts', { exact: true }).locator('..').innerText();
    const cutMark = manifest.examples.find(example => example.id === 'cut-mark');
    assert.match(counts, new RegExp(`\\bpath\\s+${cutMark.paths}\\b`, 'i'));
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    const source = await page.locator('textarea').evaluateAll(elements => elements.map(element => element.value));
    // Source presentation can be a text area or preformatted read-only code.
    const visible = await page.locator('body').innerText();
    assert.ok(source.some(value => value.includes('<path')) || visible.includes('<path'));
    report.inspector.push({ engine, counts, pathSourceVisible: true });
    await page.screenshot({ path: path.join(out, `${engine}-inspector.png`), fullPage: true });
    await page.close();
  } finally { await browser.close(); }
}
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ assets: report.assets.length, cases: report.cases.length, inspector: report.inspector.length }));
assert.deepEqual(report.failures, []);
