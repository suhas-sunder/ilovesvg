import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const base = new URL(process.env.BASE_URL);
const baseline = new URL(process.env.BASELINE_URL);
const guide = '/how-it-works/troubleshooting';
const anchor = '#mobile-image-recovery';
const converter = '/png-to-svg-converter';
const recoveryHeading = 'A phone photo won’t upload or convert';
const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = path.resolve(process.env.REVIEW_OUTPUT || 'tmp/phase2/mobile-review-b');
const report = { base: base.href, baseline: baseline.href, cases: [], workflow: [], failures: [] };
await mkdir(output, { recursive: true });

const getDocument = async origin => {
  const response = await fetch(new URL(guide, origin), { headers: { accept: 'text/html' } });
  assert.equal(response.status, 200);
  assert.doesNotMatch(response.headers.get('x-robots-tag') || '', /noindex/i);
  return response.text();
};
const existing = await getDocument(baseline);
const candidate = await getDocument(base);
for (const pattern of [/<title>[^<]*<\/title>/g, /<meta name="description"[^>]+>/g, /<link rel="canonical"[^>]+>/g, /<script type="application\/ld\+json">[^<]+<\/script>/g]) {
  const expected = existing.match(pattern);
  assert.ok(expected?.length, `baseline has ${pattern}`);
  assert.deepEqual(candidate.match(pattern), expected);
}
assert.match(candidate, /id="mobile-image-recovery"/);
assert.match(candidate, /A phone photo won’t upload or convert/);
assert.doesNotMatch(candidate, /<meta name="robots" content="[^"]*noindex/i);

const jpeg = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><path fill="#132949" d="M20 20H90V140H20Z"/><circle fill="#e35227" cx="165" cy="70" r="38"/></svg>'))
  .flatten({ background: 'white' }).jpeg().toBuffer();

async function newContext(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    return [base.origin, baseline.origin].includes(origin) ? route.continue() : route.abort();
  });
  return context;
}

async function axeFindings(page, scope = null) {
  await page.addScriptTag({ path: process.env.AXE_SCRIPT });
  return page.evaluate(async selector => {
    const results = selector ? await window.axe.run(selector) : await window.axe.run();
    return results.violations.map(violation => violation.id).sort();
  }, scope);
}

for (const engine of ['chromium', 'webkit']) {
  const browser = await playwright[engine].launch();
  try {
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      const context = await newContext(browser, width);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(new URL(guide, baseline).href, { waitUntil: 'networkidle' });
        const baselineAxe = await axeFindings(page);
        await page.goto(new URL(`${guide}${anchor}`, base).href, { waitUntil: 'networkidle' });
        const heading = page.getByRole('heading', { name: recoveryHeading, level: 2 });
        await heading.waitFor();
        const state = await heading.evaluate(node => {
          const area = node.closest('#mobile-image-recovery');
          const ad = document.querySelector('[data-monetization-slot="docs-help-compact"]');
          const bounds = node.getBoundingClientRect();
          return {
            scrollWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            targetTop: bounds.top,
            targetBottom: bounds.bottom,
            windowHeight: innerHeight,
            h1Count: document.querySelectorAll('h1').length,
            adBelowContent: Boolean(ad && ad.getBoundingClientRect().top >= area.getBoundingClientRect().bottom),
            links: [...area.querySelectorAll('a[href^="/"]')].map(link => link.getAttribute('href')),
            contentOverflow: [...area.querySelectorAll('a, h2, h3')].some(element => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > innerWidth + 1;
            }),
          };
        });
        const candidateAxe = await axeFindings(page);
        const recoveryAxe = await axeFindings(page, anchor);
        assert.equal(state.scrollWidth, width);
        assert.equal(state.bodyWidth, width);
        assert.equal(state.h1Count, 1);
        assert.ok(state.targetTop >= 0 && state.targetBottom <= state.windowHeight, 'fragment lands at visible heading');
        assert.equal(state.adBelowContent, true);
        assert.equal(state.contentOverflow, false);
        assert.deepEqual(state.links, [converter, '/jpg-to-svg-converter', '/webp-to-svg-converter', '/how-it-works/conversion-workflow']);
        assert.deepEqual(candidateAxe, baselineAxe);
        assert.deepEqual(recoveryAxe, []);
        assert.deepEqual(errors, []);
        if (engine === 'chromium' && [390, 1440].includes(width)) {
          await page.screenshot({ path: path.join(output, `mobile-guide-${width}.png`), fullPage: true });
        }
        report.cases.push({ engine, width, state, baselineAxe, candidateAxe, recoveryAxe });
      } catch (error) {
        report.failures.push({ engine, width, error: error.stack });
      } finally {
        await context.close();
      }
    }

    const context = await newContext(browser, 390);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    async function selectFile(file) {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'), page.getByLabel('Click or drag a file', { exact: true }).click(),
      ]);
      await chooser.setFiles(file);
    }
    try {
      await page.goto(new URL(converter, base).href, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Show \d+ more presets/ }).click();
      await page.getByRole('button', { name: 'Show fewer presets' }).click();
      await selectFile({ name: 'renamed.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00]) });
      await page.getByText(/For iPhone HEIC or ProRAW\/DNG photos/).first().waitFor();
      const link = page.getByRole('link', { name: 'Image upload and mobile recovery steps', exact: true });
      assert.equal(await link.getAttribute('href'), `${guide}${anchor}`);
      await link.press('Enter');
      await page.waitForURL(new URL(`${guide}${anchor}`, base).href);
      await page.getByRole('heading', { name: recoveryHeading }).waitFor();
      await page.locator(anchor).getByRole('link', { name: 'PNG to SVG', exact: true }).click();
      await page.waitForURL(new URL(converter, base).href);
      await page.getByRole('button', { name: /Show \d+ more presets/ }).click();
      await page.getByRole('button', { name: 'Show fewer presets' }).click();
      await selectFile({ name: 'exported-copy.jpg', mimeType: 'image/jpeg', buffer: jpeg });
      await page.getByText('240 x 160', { exact: true }).waitFor();
      const convert = page.getByRole('button', { name: 'Convert PNG to SVG', exact: true });
      const download = page.locator('[data-output-stamp]').first().getByRole('button', { name: 'Download SVG', exact: true });
      if (!(await download.isVisible()) && await convert.isEnabled()) await convert.click();
      await download.waitFor({ timeout: 30_000 });
      const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
      const target = path.join(output, `${engine}-recovered.svg`);
      await file.saveAs(target);
      const svg = await readFile(target);
      assert.match(svg.toString('utf8'), /<svg\b[^>]*>/);
      assert.match(svg.toString('utf8'), /<path\b[^>]*>/);
      await sharp(svg).png().toBuffer();
      report.workflow.push({ engine, inputBytes: jpeg.length, svgBytes: svg.length });
    } catch (error) {
      report.failures.push({ engine, workflow: true, error: error.stack });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, workflow: report.workflow, failures: report.failures }, null, 2));
if (report.failures.length) process.exitCode = 1;
