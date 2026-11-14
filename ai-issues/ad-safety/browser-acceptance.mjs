import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs');

// No genuine ad traffic or creative clicks. Third-party requests are intercepted.
const base = process.env.BASE_URL || 'http://127.0.0.1:5321';
const baseline = process.env.BASELINE === '1';
const out = process.env.OUT || `tmp/ad-safety/browser-${baseline ? 'before' : 'after'}`;
const sections = (process.env.SECTIONS || 'matrix,visual').split(',');
const engines = (process.env.ENGINES || 'chromium,webkit').split(',');
const widths = [320, 390, 768, 1440, 1920, 2560];
const routes = ['/', '/png-to-svg-converter', '/how-it-works/troubleshooting', '/svg-minifier', '/svg-background-editor'];
if (process.env.INCLUDE_SPRITE === '1') routes.push('/svg-sprite-generator');
await mkdir(out, { recursive: true });
const report = { base, baseline, mockOnly: true, networkPolicy: 'All off-origin requests intercepted; no ad clicks.', results: [], errors: [] };
const axe = await readFile(process.env.AXE_SCRIPT || 'C:/Users/Suhas/.codex/worktrees/ilovesvg-phase1-20261112/tmp/phase1-a11y/node_modules/axe-core/axe.min.js', 'utf8');
const write = () => writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));

async function createPage(browser, width, mode = 'mock', javaScriptEnabled = true) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, javaScriptEnabled, colorScheme: 'light' });
  const network = { adScripts: 0, blocked: 0 };
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
    if (route.request().url().includes('/pagead/js/adsbygoogle.js')) {
      network.adScripts++;
      if (mode === 'empty-script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* Local empty script: no ad SDK. */' });
    }
    network.blocked++;
    return route.abort();
  });
  await context.addInitScript(({ mode }) => {
    window.__adTest = { pushes: [], holdObservers: false, held: [], observers: [], frameId: 0, marker: Math.random() };
    if (mode === 'mock') window.adsbygoogle = { push() { window.__adTest.pushes.push({ at: performance.now(), path: location.pathname }); } };
    const NativeObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeObserver {
      constructor(callback) {
        const record = { active: false, target: '', disconnects: 0 };
        super((records, observer) => {
          const invoke = () => callback(records, observer);
          if (window.__adTest.holdObservers) window.__adTest.held.push(invoke); else invoke();
        });
        this.record = record;
        window.__adTest.observers.push(record);
      }
      observe(target, options) { this.record.active = true; this.record.target = target.tagName || target.nodeName; return super.observe(target, options); }
      disconnect() { this.record.active = false; this.record.disconnects++; return super.disconnect(); }
    };
    window.__adTest.flush = () => {
      window.__adTest.holdObservers = false;
      const held = window.__adTest.held.splice(0);
      held.forEach(callback => callback());
    };
  }, { mode });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type()) && /hydrat|did not match|server.rendered/i.test(message.text())) errors.push(`console-${message.type()}: ${message.text()}`);
  });
  return { context, page, network, errors };
}

async function open(page, path = '/png-to-svg-converter', settle = 2200) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__reactRouterDataRouter));
  await page.evaluate(() => document.fonts.ready);
  if (settle) await page.waitForTimeout(settle);
}

async function snapshot(page, label) {
  return page.evaluate(label => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; };
    const painted = node => {
      if (!node || !node.getBoundingClientRect().width || !node.getBoundingClientRect().height) return false;
      for (let e = node; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
      return true;
    };
    const slots = [...document.querySelectorAll('ins.adsbygoogle')].map((ins, index) => {
      const wrapper = ins.parentElement;
      const placeholder = wrapper.querySelector('[data-ad-placeholder]') || [...wrapper.children].find(node => node !== ins && node.getAttribute('aria-hidden') === 'true');
      const iframe = ins.querySelector('iframe[data-mock-creative]');
      const p = placeholder && getComputedStyle(placeholder), s = getComputedStyle(ins), w = getComputedStyle(wrapper);
      let stacking = null;
      if (iframe && painted(iframe)) {
        const f = iframe.getBoundingClientRect(), wr = wrapper.getBoundingClientRect();
        const x = Math.max(1, Math.min(innerWidth - 2, f.left + f.width / 2));
        const y = Math.max(1, Math.min(innerHeight - 2, Math.max(f.top, wr.top) + Math.min(f.height, wr.height) / 2));
        const original = placeholder?.style.pointerEvents;
        // pointer-events:none masks layers from elementsFromPoint. Temporarily expose it
        // for measurement only; no input is dispatched, and the style is restored.
        if (placeholder) placeholder.style.pointerEvents = 'auto';
        const stack = document.elementsFromPoint(x, y);
        const frameIndex = stack.indexOf(iframe);
        const placeholderIndex = placeholder ? stack.findIndex(node => node === placeholder || placeholder.contains(node)) : -1;
        if (placeholder) placeholder.style.pointerEvents = original || '';
        const intersection = placeholder ? (() => { const pr = placeholder.getBoundingClientRect(); return Math.max(0, Math.min(pr.right, f.right) - Math.max(pr.left, f.left)) * Math.max(0, Math.min(pr.bottom, f.bottom) - Math.max(pr.top, f.top)); })() : 0;
        const pointInsideFrame = x >= f.left && x < f.right && y >= f.top && y < f.bottom && x >= wr.left && x < wr.right && y >= wr.top && y < wr.bottom;
        stacking = { point: [x, y], pointInsideFrame, frameIndex, placeholderIndex, intersection, placeholderPaintedAbove: painted(placeholder) && intersection > 0 && placeholderIndex >= 0 && (frameIndex < 0 || placeholderIndex < frameIndex), stack: stack.slice(0, 8).map(node => ({ tag: node.tagName, class: node.className, mock: node.hasAttribute('data-mock-creative') })) };
      }
      return { index, slot: ins.dataset.adSlot, client: ins.dataset.adClient, status: ins.dataset.adStatus || null, wrapperBox: rect(wrapper), insBox: rect(ins), placeholderBox: placeholder ? rect(placeholder) : null, placeholderPainted: painted(placeholder), placeholderStyle: p ? { display: p.display, visibility: p.visibility, opacity: p.opacity, zIndex: p.zIndex, position: p.position, pointerEvents: p.pointerEvents, transition: p.transitionDuration } : null, insStyle: { display: s.display, visibility: s.visibility, opacity: s.opacity, zIndex: s.zIndex, position: s.position }, wrapperStyle: { overflow: w.overflow, zIndex: w.zIndex, position: w.position }, frame: iframe ? { painted: painted(iframe), box: rect(iframe), display: getComputedStyle(iframe).display, visibility: getComputedStyle(iframe).visibility } : null, stacking };
    });
    return { label, path: location.pathname, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, marker: window.__adTest?.marker, pushes: window.__adTest?.pushes || [], observers: window.__adTest?.observers.filter(record => record.active) || [], slots };
  }, label);
}

async function chooseTarget(page, number = 0) {
  return page.evaluate(number => {
    const visible = [...document.querySelectorAll('ins.adsbygoogle')].filter(ins => ins.parentElement.getBoundingClientRect().width > 0 && [...ins.parentElement.children].some(node => node !== ins && node.getAttribute('aria-hidden') === 'true'));
    const ins = visible[number % visible.length];
    if (!ins) throw new Error('No visible ad placeholder target');
    ins.dataset.testTarget = String(number);
    return ins.dataset.adSlot;
  }, number);
}

async function creative(page, number = 0, status = 'filled') {
  await page.locator(`[data-test-target="${number}"]`).evaluate((ins, { status }) => {
    if (status === null) ins.removeAttribute('data-ad-status'); else ins.setAttribute('data-ad-status', status);
    let iframe = ins.querySelector('[data-mock-creative]');
    if (!iframe) {
      iframe = document.createElement('iframe'); iframe.dataset.mockCreative = 'true'; iframe.title = 'Local mock advertisement — no network';
      iframe.style.cssText = 'display:block;width:100%;height:90px;border:0;background:#146b3a';
      iframe.srcdoc = '<!doctype html><html><body style="margin:0;display:grid;place-items:center;height:90px;background:#146b3a;color:white;font:16px sans-serif"><div>LOCAL MOCK CREATIVE</div></body></html>';
      ins.append(iframe);
    }
  }, { status });
}

async function navigate(page, path) {
  await page.evaluate(path => window.__reactRouterDataRouter.navigate(path), path);
  await page.waitForURL(url => url.pathname === path);
  await page.waitForTimeout(2300);
}

function check(state, { suppressed = false, creativeVisible = false, noOverlap = true } = {}) {
  if (suppressed && !baseline) assert.equal(state.slots.filter(s => s.placeholderPainted).length, 0, `${state.label}: placeholder reappeared`);
  if (creativeVisible) assert.ok(state.slots.some(s => s.frame?.painted), `${state.label}: creative disappeared`);
  if (noOverlap && !baseline) for (const slot of state.slots) {
    assert.notEqual(slot.stacking?.placeholderPaintedAbove, true, `${state.label}: placeholder covers creative`);
    if (slot.stacking?.pointInsideFrame) assert.equal(slot.stacking.frameIndex, 0, `${state.label}: a layer covers the mock creative's sample point`);
  }
}

async function lifecycle(browser, engine) {
  const session = await createPage(browser, 1440);
  const { page, context } = session;
  const result = { engine, section: 'matrix', states: [], assertions: [], errors: session.errors, network: session.network };
  const capture = async (label, expected) => { const state = await snapshot(page, label); result.states.push(state); check(state, expected); return state; };
  try {
    await open(page, '/png-to-svg-converter', 7600);
    const pending = await capture('pending-request');
    assert.ok(pending.pushes.length > 0 && pending.slots.filter(s => s.placeholderPainted).length >= 2);
    await page.locator('ins.adsbygoogle').evaluateAll(nodes => nodes.forEach(ins => ins.setAttribute('data-ad-status', 'unfilled')));
    await page.waitForTimeout(200); await capture('all-unfilled');
    await chooseTarget(page, 0); await chooseTarget(page, 1);
    await page.locator('[data-test-target="0"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => { window.__adTest.holdObservers = true; });
    await creative(page, 0, null);
    await page.waitForTimeout(300);
    const delayed = await capture('delayed-iframe-no-filled-signal-observer-held', { creativeVisible: true });
    if (!baseline) assert.ok(delayed.slots.some(s => s.placeholderPainted), 'Unknown iframe must not globally classify filled');
    await page.evaluate(() => window.__adTest.flush()); await page.waitForTimeout(150);
    await capture('unknown-iframe-observer-flushed', { creativeVisible: true });
    await page.locator('[data-test-target="0"]').evaluate(ins => { ins.querySelector('iframe')?.remove(); ins.setAttribute('data-ad-status', 'unfilled'); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.__adTest.holdObservers = true; });
    await creative(page, 0);
    await page.waitForTimeout(80);
    await capture('first-filled-signal-observer-held', { suppressed: true, creativeVisible: true });
    await page.screenshot({ path: `${out}/${engine}-matrix-delayed-first-fill.png` });
    await page.evaluate(() => window.__adTest.flush()); await page.waitForTimeout(200);
    await capture('first-fill-observed', { suppressed: true, creativeVisible: true });
    await page.waitForTimeout(600); await creative(page, 1); await page.waitForTimeout(100);
    await capture('two-delayed-fills', { suppressed: true, creativeVisible: true });
    await page.locator('ins.adsbygoogle').evaluateAll(nodes => nodes.forEach(ins => { ins.setAttribute('data-ad-status', 'unfilled'); ins.querySelectorAll('iframe').forEach(frame => frame.remove()); }));
    await page.waitForTimeout(200); await capture('previously-filled-now-unfilled', { suppressed: true });
    for (const status of ['filled', 'unfilled', 'filled', 'unfilled']) {
      await page.locator('[data-test-target="0"]').evaluate((ins, status) => ins.setAttribute('data-ad-status', status), status);
      await page.waitForTimeout(40); await capture(`transition-${status}`, { suppressed: true });
    }
    for (const width of [390, 768, 2560, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.waitForTimeout(2100);
      await capture(`resize-${width}-new-sidebar-mount`, { suppressed: true });
    }
    for (const path of routes) { await navigate(page, path); await capture(`spa-${path}`, { suppressed: true }); }
    await navigate(page, '/privacy-policy');
    const legal = await capture('legal-route-unmount', { suppressed: true });
    assert.equal(legal.slots.length, 0);
    await page.goBack(); await page.waitForTimeout(2300);
    await capture('navigation-back-remount', { suppressed: true });
    await page.waitForTimeout(7600); await capture('repeated-late-polling', { suppressed: true });
    await page.addScriptTag({ content: axe });
    result.axe = await page.evaluate(async () => (await axe.run()).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ html: n.html, target: n.target })) })));
    await page.emulateMedia({ colorScheme: 'dark' }); await capture('dark-preference', { suppressed: true });
    result.assertions = ['pending not filled', 'unfilled not filled', 'iframe local shielding', 'held callback shielding', 'cross-slot global suppression', 'no reset', 'all viewport resizes', 'SPA route families', 'trust-route removal', 'back remount', 'late polling', 'creative container remains visible'];
  } finally { report.results.push(result); await write(); await context.close(); }
}

async function edgeCases(browser, engine) {
  for (const mode of ['blocked', 'empty-script']) {
    const { context, page, errors, network } = await createPage(browser, 390, mode);
    await open(page, '/png-to-svg-converter', 7600);
    const state = await snapshot(page, mode === 'blocked' ? 'script-blocked' : 'no-executable-ad-script');
    assert.equal(state.pushes.length, 0); assert.ok(state.slots.some(s => s.placeholderPainted));
    report.results.push({ engine, section: mode, states: [state], errors, network });
    await context.close(); await write();
  }
  // Native mutation delivery plus a same-task SPA departure exercises observer cleanup.
  const { context, page, errors, network } = await createPage(browser, 1440);
  await open(page);
  await chooseTarget(page);
  await page.evaluate(() => {
    document.querySelector('[data-test-target="0"]').setAttribute('data-ad-status', 'filled');
    window.__reactRouterDataRouter.navigate('/privacy-policy');
  });
  await page.waitForURL('**/privacy-policy'); await page.waitForTimeout(100);
  await navigate(page, '/how-it-works');
  const state = await snapshot(page, 'fast-navigation-before-detection-settles');
  check(state, { suppressed: true });
  report.results.push({ engine, section: 'fast-navigation', states: [state], errors, network });
  await context.close(); await write();
  const pulse = await createPage(browser, 1440);
  await open(pulse.page);
  await chooseTarget(pulse.page);
  await pulse.page.evaluate(() => {
    const ins = document.querySelector('[data-test-target="0"]');
    ins.setAttribute('data-ad-status', 'filled');
    ins.setAttribute('data-ad-status', 'unfilled');
  });
  await pulse.page.waitForTimeout(100);
  const pulseState = await snapshot(pulse.page, 'first-fill-and-unfilled-in-one-task'); check(pulseState, { suppressed: true });
  report.results.push({ engine, section: 'rapid-status-pulse', states: [pulseState], errors: pulse.errors, network: pulse.network });
  await pulse.context.close(); await write();
  // SSR is examined with application JS disabled, then a separate fresh hydration context.
  const ssr = await createPage(browser, 390, 'blocked', false);
  await ssr.page.goto(base + '/png-to-svg-converter', { waitUntil: 'networkidle' });
  const ssrState = await snapshot(ssr.page, 'server-rendered-no-javascript');
  assert.ok(ssrState.slots.some(s => s.placeholderPainted));
  report.results.push({ engine, section: 'ssr', states: [ssrState], network: ssr.network });
  await ssr.context.close(); await write();
  // Simulate a network-filled SSR slot before application modules hydrate.
  const hydration = await createPage(browser, 1440);
  let releaseModules;
  const moduleGate = new Promise(resolve => { releaseModules = resolve; });
  await hydration.context.route('**/assets/*.js', async route => { await moduleGate; await route.fallback(); });
  try {
    await hydration.page.goto(base + '/png-to-svg-converter', { waitUntil: 'commit' });
    await hydration.page.locator('ins.adsbygoogle').first().waitFor({ state: 'attached' });
    await hydration.page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href?.includes('/assets/')));
    await chooseTarget(hydration.page);
    await creative(hydration.page);
    const before = await snapshot(hydration.page, 'filled-before-application-hydration');
    check(before, { suppressed: true, creativeVisible: true });
    await hydration.page.waitForTimeout(150);
    await hydration.page.locator('ins.adsbygoogle').evaluateAll(nodes => nodes.forEach(ins => { ins.setAttribute('data-ad-status', 'unfilled'); ins.querySelectorAll('iframe').forEach(f => f.remove()); }));
    await hydration.page.waitForTimeout(100);
    const beforeUnfilled = await snapshot(hydration.page, 'filled-then-unfilled-before-hydration'); check(beforeUnfilled, { suppressed: true });
    releaseModules();
    await hydration.page.waitForFunction(() => Boolean(window.__reactRouterDataRouter));
    await hydration.page.waitForTimeout(300);
    const after = await snapshot(hydration.page, 'filled-after-application-hydration');
    check(after, { suppressed: true });
    await hydration.page.locator('ins.adsbygoogle').evaluateAll(nodes => nodes.forEach(ins => { ins.setAttribute('data-ad-status', 'unfilled'); ins.querySelectorAll('iframe').forEach(f => f.remove()); }));
    await hydration.page.waitForTimeout(100);
    const unfilled = await snapshot(hydration.page, 'hydrated-later-unfilled'); check(unfilled, { suppressed: true });
    report.results.push({ engine, section: 'prehydration-fill', states: [before, beforeUnfilled, after, unfilled], errors: hydration.errors, network: hydration.network });
    await write();
  } finally { releaseModules(); await hydration.context.close(); }
}

async function visuals(browser, engine) {
  for (const width of widths) {
    const { context, page, errors, network } = await createPage(browser, width);
    const result = { engine, section: 'visual', width, states: [], errors, network };
    try {
      await open(page, '/png-to-svg-converter', 7600);
      await chooseTarget(page); await page.locator('[data-test-target="0"]').scrollIntoViewIfNeeded();
      result.states.push(await snapshot(page, 'pre-fill'));
      await page.screenshot({ path: `${out}/${engine}-${width}-pending.png` });
      await page.evaluate(() => { window.__adTest.holdObservers = true; });
      await creative(page);
      await page.waitForTimeout(80);
      const first = await snapshot(page, 'first-fill-held-callback'); check(first, { suppressed: true, creativeVisible: true }); result.states.push(first);
      await page.screenshot({ path: `${out}/${engine}-${width}-fill-held.png` });
      await page.evaluate(() => window.__adTest.flush()); await page.waitForTimeout(400);
      const stable = await snapshot(page, 'fill-settled'); check(stable, { suppressed: true, creativeVisible: true }); result.states.push(stable);
      await page.screenshot({ path: `${out}/${engine}-${width}-fill-settled.png` });
      if (width === 2560) {
        await page.locator('[data-ultra-wide-sidebar-ad="left"] ins').evaluate(ins => { ins.setAttribute('data-ad-status', 'filled'); const f = document.createElement('iframe'); f.title = 'Local sidebar mock'; f.dataset.mockCreative = 'true'; f.srcdoc = '<body style="margin:0;background:#146b3a;color:white">LOCAL SIDEBAR MOCK</body>'; f.style.cssText = 'width:300px;height:600px;border:0'; ins.append(f); });
        await page.screenshot({ path: `${out}/${engine}-${width}-sidebar.png` });
        const side = await snapshot(page, 'sidebar-creative'); check(side, { suppressed: true, creativeVisible: true }); result.states.push(side);
      }
      await page.locator('ins.adsbygoogle').evaluateAll(nodes => nodes.forEach(ins => { ins.setAttribute('data-ad-status', 'unfilled'); ins.querySelectorAll('iframe').forEach(f => f.remove()); }));
      await page.waitForTimeout(250);
      const later = await snapshot(page, 'later-unfilled'); check(later, { suppressed: true }); result.states.push(later);
      await page.screenshot({ path: `${out}/${engine}-${width}-later-unfilled.png` });
    } finally { report.results.push(result); await write(); await context.close(); }
  }
}

async function flicker(browser, engine) {
  const session = await createPage(browser, 390);
  const { page, context } = session;
  try {
    await open(page); await chooseTarget(page); await creative(page); await page.waitForTimeout(100);
    await page.evaluate(() => {
      const monitor = window.__adTest.monitor = { frames: 0, visibleFrames: 0, violations: [], running: true };
      const tick = () => {
        if (!monitor.running) return;
        monitor.frames++;
        const visible = [...document.querySelectorAll('ins.adsbygoogle')].filter(ins => {
          const p = ins.parentElement.querySelector('[data-ad-placeholder]') || [...ins.parentElement.children].find(n => n !== ins && n.getAttribute('aria-hidden') === 'true');
          if (!p || !p.getBoundingClientRect().width || !p.getBoundingClientRect().height) return false;
          for (let e = p; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
          return true;
        });
        if (visible.length) { monitor.visibleFrames++; if (monitor.violations.length < 12) monitor.violations.push({ path: location.pathname, slots: visible.map(ins => ins.dataset.adSlot) }); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      document.querySelectorAll('ins.adsbygoogle').forEach(ins => { ins.setAttribute('data-ad-status', 'unfilled'); ins.querySelectorAll('iframe').forEach(f => f.remove()); });
    });
    for (const path of [...routes, '/privacy-policy', '/png-to-svg-converter']) await navigate(page, path);
    for (const width of [2560, 320, 1440]) { await page.setViewportSize({ width, height: 950 }); await page.waitForTimeout(400); }
    const monitor = await page.evaluate(() => { window.__adTest.monitor.running = false; return window.__adTest.monitor; });
    assert.ok(monitor.frames >= 20);
    if (!baseline) assert.equal(monitor.visibleFrames, 0, 'A placeholder flashed after global suppression');
    report.results.push({ engine, section: 'animation-frame-flicker', monitor, errors: session.errors, network: session.network, states: [] });
    await write();
  } finally { await context.close(); }
}

async function sidebarFirst(browser, engine) {
  const session = await createPage(browser, 2560);
  const { page, context } = session;
  try {
    await open(page, '/png-to-svg-converter', 2600);
    await page.locator('[data-ultra-wide-sidebar-ad="left"] ins').evaluate(ins => { ins.dataset.testTarget = '0'; });
    const before = await snapshot(page, 'sidebar-before-any-fill');
    assert.ok(before.slots.some(s => s.placeholderPainted));
    await page.evaluate(() => { window.__adTest.holdObservers = true; });
    await creative(page);
    await page.locator('[data-test-target="0"] iframe').evaluate(frame => { frame.style.height = '600px'; });
    await page.waitForTimeout(80);
    const first = await snapshot(page, 'sidebar-first-fill-observer-held'); check(first, { suppressed: true, creativeVisible: true });
    await page.screenshot({ path: `${out}/${engine}-sidebar-first.png` });
    await page.evaluate(() => window.__adTest.flush());
    await page.locator('[data-test-target="0"]').evaluate(ins => { ins.setAttribute('data-ad-status', 'unfilled'); ins.querySelector('iframe').remove(); });
    await page.waitForTimeout(100);
    const later = await snapshot(page, 'sidebar-later-unfilled'); check(later, { suppressed: true });
    report.results.push({ engine, section: 'sidebar-first-fill', states: [before, first, later], errors: session.errors, network: session.network });
    await write();
  } finally { await context.close(); }
}

for (const engineName of engines) {
  const browser = await ({ chromium, webkit }[engineName]).launch();
  try {
    if (sections.includes('matrix')) { await lifecycle(browser, engineName); await edgeCases(browser, engineName); }
    if (sections.includes('edges')) await edgeCases(browser, engineName);
    if (sections.includes('visual')) await visuals(browser, engineName);
    if (sections.includes('flicker')) await flicker(browser, engineName);
    if (sections.includes('sidebar')) await sidebarFirst(browser, engineName);
  } catch (error) { report.errors.push({ engine: engineName, message: error.stack }); await write(); throw error; }
  finally { await browser.close(); }
}
report.complete = true;
await write();
console.log(JSON.stringify({ base, baseline, complete: true, results: report.results.length, errors: report.errors }));
