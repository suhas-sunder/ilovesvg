import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = new URL(process.env.BASE_URL);
const canonical = 'https://www.ilovesvg.com/author/suhas-sunder';
const profilePath = '/author/suhas-sunder';
const resultDir = path.resolve(process.env.REVIEW_OUTPUT || 'tmp/phase2/maintainer-review');
const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const report = { base: base.href, cases: [], failures: [] };
await mkdir(resultDir, { recursive: true });

const [htmlSitemap, xmlSitemap, robots, redirect] = await Promise.all([
  fetch(new URL('/sitemap', base)).then(response => response.text()),
  fetch(new URL('/sitemap.xml', base)).then(response => response.text()),
  fetch(new URL('/robots.txt', base)).then(response => response.text()),
  fetch(new URL(`${profilePath}/`, base), { redirect: 'manual', headers: { accept: 'text/html' } }),
]);
assert.match(htmlSitemap, /href="\/author\/suhas-sunder"/);
assert.equal(xmlSitemap.split(`<loc>${canonical}</loc>`).length - 1, 1);
assert.doesNotMatch(robots, /Disallow:\s*\/author/i);
assert.equal(redirect.status, 308);
assert.equal(new URL(redirect.headers.get('location'), base).pathname, profilePath);

for (const [engineName, width] of ['chromium', 'webkit'].flatMap(engine => [320, 375, 390, 430, 768, 1024, 1440].map(width => [engine, width]))) {
  const browser = await playwright[engineName].launch();
  try {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 920 } });
    const external = [];
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin === base.origin) return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    const runtime = [];
    page.on('pageerror', error => runtime.push(error.message));
    const response = await page.goto(new URL(profilePath, base).href);
    const html = await response.text();
    assert.equal(response.status(), 200);
    assert.match(html, /<h1[^>]*>Suhas Sunder<\/h1>/);
    assert.match(html, /"@type":"ProfilePage"/);
    assert.doesNotMatch(response.headers()['x-robots-tag'] || '', /noindex/i);
    await page.getByRole('heading', { level: 1, name: 'Suhas Sunder' }).waitFor();
    await page.addScriptTag({ path: process.env.AXE_SCRIPT });
    const state = await page.evaluate(async () => {
      const main = document.querySelector('main');
      const boxes = [...main.querySelectorAll('a, h1, h2, h3')].map(node => node.getBoundingClientRect());
      return {
        canonical: document.querySelector('link[rel=canonical]')?.href,
        canonicalCount: document.querySelectorAll('link[rel=canonical]').length,
        title: document.title,
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        overflow: boxes.filter(box => box.left < -1 || box.right > innerWidth + 1).length,
        sections: [...main.querySelectorAll('h1,h2,h3')].map(node => [node.tagName, node.textContent]),
        ads: document.querySelectorAll('ins.adsbygoogle,[data-monetization-kind="adsense"],script[src*="pagead2.googlesyndication.com/pagead/js/"]').length,
        links: [...main.querySelectorAll('a')].map(link => [link.textContent, link.getAttribute('href')]),
        schema: [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => JSON.parse(node.textContent)),
        robots: document.querySelector('meta[name=robots]')?.content,
        axe: (await window.axe.run()).violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({ target: node.target, html: node.html })) })),
      };
    });
    await page.screenshot({ path: path.join(resultDir, `${engineName}-${width}.png`), fullPage: true });
    report.cases.push({ engineName, width, state, runtime, external });
    assert.equal(state.canonicalCount, 1);
    assert.equal(state.canonical, canonical);
    assert.equal(state.title, 'Suhas Sunder - iLoveSVG Maintainer');
    assert.equal(state.documentWidth, width);
    assert.equal(state.bodyWidth, width);
    assert.equal(state.overflow, 0);
    assert.equal(state.ads, 0);
    assert.equal(state.sections.filter(([level]) => level === 'H1').length, 1);
    assert.equal(state.schema.find(item => item['@type'] === 'ProfilePage')?.mainEntity.name, 'Suhas Sunder');
    assert.equal(state.schema.find(item => item['@type'] === 'ProfilePage')?.mainEntity.jobTitle, 'Software engineer');
    assert.doesNotMatch(state.robots || '', /noindex/i);
    assert.deepEqual(runtime, []);
    if (process.env.ACCEPT_BASELINE_SOCIAL_REGION !== '1') assert.deepEqual(state.axe, []);
    if (width === 390 || width === 1440) {
      if (width === 1440) await page.setViewportSize({ width: 2560, height: 920 });
      const guideLink = page.getByRole('link', { name: 'How the tools work' });
      await guideLink.focus();
      assert.equal(await guideLink.evaluate(node => node === document.activeElement), true);
      await guideLink.press('Enter');
      await page.waitForURL('**/how-it-works');
      await page.locator('[data-monetization-slot="docs-help-compact"]').waitFor();
      const attributionLink = page.locator('footer').getByRole('link', { name: 'Suhas Sunder', exact: true });
      await attributionLink.focus();
      assert.equal(await attributionLink.evaluate(node => node === document.activeElement), true);
      await attributionLink.press('Enter');
      await page.waitForURL(`**${profilePath}`);
      await page.getByRole('heading', { level: 1, name: 'Suhas Sunder' }).waitFor();
      state.adNavigation = await page.evaluate(() => ({
        width: innerWidth,
        matches: [...document.querySelectorAll('ins.adsbygoogle,[data-monetization-kind="adsense"],script[src*="pagead2.googlesyndication.com/pagead/js/"],[data-ultra-wide-sidebar-ads]')].map(node => node.outerHTML.slice(0, 250)),
      }));
      assert.equal(await page.locator('ins.adsbygoogle,[data-monetization-kind="adsense"],[data-ultra-wide-sidebar-ads]').count(), 0);
    }
  } catch (error) {
    report.failures.push({ engineName, width, error: error.stack });
  } finally {
    await browser.close();
  }
}

await writeFile(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, failures: report.failures }, null, 2));
if (report.failures.length) process.exitCode = 1;
