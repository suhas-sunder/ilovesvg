import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs');
const beforeDir = process.env.BEFORE_DIR || 'tmp/ad-safety/browser-before';
const edgesDir = process.env.BEFORE_EDGES_DIR || 'tmp/ad-safety/browser-before-edges';
const afterDir = process.env.AFTER_DIR || 'tmp/ad-safety/browser-after';
const out = 'ai-issues/ad-safety';
const read = async dir => JSON.parse(await readFile(`${dir}/report.json`, 'utf8'));
const before = await read(beforeDir), edges = await read(edgesDir), after = await read(afterDir);
assert.equal(before.complete, true); assert.equal(edges.complete, true); assert.equal(after.complete, true);
const flickerBefore = await read('tmp/ad-safety/browser-before-flicker');
const flickerAfter = await read('tmp/ad-safety/browser-after-flicker');
const stagedFlicker = await read('tmp/ad-safety/browser-staged-flicker');
const sidebarBefore = await read('tmp/ad-safety/browser-before-sidebar');
const sidebarAfter = await read('tmp/ad-safety/browser-after-sidebar');
assert.equal(flickerBefore.complete, true); assert.equal(flickerAfter.complete, true);
assert.equal(stagedFlicker.complete, true); assert.equal(sidebarBefore.complete, true); assert.equal(sidebarAfter.complete, true);
for (const sample of flickerBefore.results) assert.ok(sample.monitor.visibleFrames > 0, 'Baseline frame monitor must detect the missing suppression');
for (const sample of flickerAfter.results) assert.equal(sample.monitor.visibleFrames, 0);
const compact = result => ({ ...result, axe: result.axe?.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, examples: v.nodes.slice(0, 2) })), states: result.states.map(state => ({ ...state, pushes: { count: state.pushes.length, byPath: Object.fromEntries([...new Set(state.pushes.map(p => p.path))].map(path => [path, state.pushes.filter(p => p.path === path).length])), timesMs: state.pushes.map(p => Math.round(p.at)) }, slots: state.slots.map(slot => ({ ...slot, stacking: slot.stacking ? { ...slot.stacking, stack: slot.stacking.stack.map(node => node.mock ? 'mock-iframe' : node.tag) } : null })) })) });
const comparisons = [];
const geometryProbe = JSON.parse(await readFile('tmp/ad-safety/geometry-probe.json', 'utf8'));
assert.deepEqual(geometryProbe[0].data, geometryProbe[1].data, 'Fresh 768px layout probe differs');
for (const a of before.results.filter(r => ['visual', 'matrix'].includes(r.section))) {
  const b = after.results.find(r => r.engine === a.engine && r.section === a.section && r.width === a.width);
  assert.ok(b);
  const shape = state => state.slots.map(s => ({ slot: s.slot, client: s.client, wrapperBox: { x:s.wrapperBox.x,width:s.wrapperBox.width,height:s.wrapperBox.height }, insBox: { x:s.insBox.x,width:s.insBox.width,height:s.insBox.height,relativeY:s.insBox.y-s.wrapperBox.y } }));
  const firstA = a.states[0], firstB = b.states[0];
  assert.deepEqual(shape(firstA), shape(firstB), `${a.engine}/${a.width}: initial reserved geometry changed`);
  assert.equal(firstA.pushes.length, firstB.pushes.length, `${a.engine}/${a.width}: initial pushes changed`);
  assert.equal(a.network.adScripts, b.network.adScripts, `${a.engine}/${a.width}: script request count changed`);
  const row = { engine: a.engine, section: a.section, width: a.width, sameSlotIdsPublisherAndReservedGeometry: true, documentYDifferences: firstA.slots.flatMap((s,i)=>s.wrapperBox.y===firstB.slots[i].wrapperBox.y?[]:[{slot:s.slot,before:s.wrapperBox.y,after:firstB.slots[i].wrapperBox.y}]), initialPushesBefore: firstA.pushes.length, initialPushesAfter: firstB.pushes.length, adScriptRequestsBefore: a.network.adScripts, adScriptRequestsAfter: b.network.adScripts };
  if (a.section === 'matrix') {
    const lastA = a.states.at(-1), lastB = b.states.at(-1);
    assert.equal(lastA.pushes.length, lastB.pushes.length, `${a.engine}: route-sequence push count changed`);
    row.finalPushesBefore = lastA.pushes.length; row.finalPushesAfter = lastB.pushes.length;
    row.axeBefore = a.axe.map(v => v.id); row.axeAfter = b.axe.map(v => v.id);
    assert.deepEqual(row.axeBefore, row.axeAfter, `${a.engine}: accessibility violation families changed`);
  }
  comparisons.push(row);
}
const result = { statuses: ['VALIDATED LOCALLY'], genuineAdNetworkVerified: false, baselineHead: 'c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4', note: 'Baseline mode characterizes failures; it does not assert the old global safety invariant. Corrected mode asserts suppression, visible creative containers, and topmost sampled creative hit stacking. No ads clicked and no off-origin requests allowed.', geometryNote: 'Initial 768px Chromium sample has a 22.75px downstream document-Y difference with identical ad reservation dimensions. Fresh independent 768px probe exactly matches all measured main headings, paragraphs, sections and ad rectangles/styles. Initial offsets are retained; no universal absolute-position equality claimed.', freshGeometryProbe: geometryProbe, comparisons, frameSampling: { before: flickerBefore.results, after: flickerAfter.results, stagedSpriteApplication: stagedFlicker.results }, sidebarFirst: { before:sidebarBefore.results.map(compact), after:sidebarAfter.results.map(compact) }, before: before.results.map(compact), beforeAdditionalEdges: edges.results.map(compact), after: after.results.map(compact) };
await writeFile(`${out}/browser-results.json`, JSON.stringify(result, null, 2));
await mkdir(`${out}/screenshots`, { recursive: true });
const browser = await chromium.launch();
try {
  for (const engine of ['chromium', 'webkit']) {
    await copyFile(`tmp/ad-safety/browser-after-sidebar/${engine}-sidebar-first.png`, `${out}/screenshots/${engine}-sidebar-first.png`);
    const rows = [];
    for (const width of [320, 390, 768, 1440, 1920, 2560]) {
      const images = [];
      for (const [label, dir] of [['before', beforeDir], ['after', afterDir]]) {
        const filename = `${engine}-${width}-fill-held.png`;
        await copyFile(`${dir}/${filename}`, `${out}/screenshots/${label}-${filename}`);
        const data = (await readFile(`${dir}/${filename}`)).toString('base64');
        images.push(`<figure><figcaption>${label.toUpperCase()} · ${engine} · ${width}px · observer callback held</figcaption><img src="data:image/png;base64,${data}"></figure>`);
      }
      rows.push(images.join(''));
    }
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.setContent(`<html><head><style>body{margin:0;padding:14px;background:#e4e8ed;font:14px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;background:white;padding:8px}figcaption{height:28px;font-weight:600}img{display:block;width:100%;height:390px;object-fit:contain;object-position:top}</style></head><body><main>${rows.join('')}</main></body></html>`);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path: `${out}/screenshots/${engine}-comparison.png`, fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ comparisons: comparisons.length, genuineAdNetworkVerified: false }));
