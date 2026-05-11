import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9257);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-navigation-browser-audit", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const mobileWidths = [320, 360, 390, 430, 768];
const desktopWidths = [1024, 1280, 1440, 1600, 1920];
const compactPrimaryHrefs = [
  "#other-tools",
  "/svg-to-png-converter",
  "/png-to-svg-converter",
];
const requiredPrimaryHrefs = [
  "/svg-to-png-converter",
  "/png-to-svg-converter",
  "/svg-to-jpg-converter",
  "/jpg-to-svg-converter",
];
const widePrimaryHrefs = [
  ...requiredPrimaryHrefs,
  "/svg-to-pdf-converter",
];
const expectedPopularHrefs = [
  "/png-to-svg-converter",
  "/svg-to-png-converter",
  "/jpg-to-svg-converter",
  "/jpeg-to-svg-converter",
  "/svg-to-pdf-converter",
  "/svg-to-jpg-converter",
  "/",
  "/svg-to-favicon-generator",
];

async function main() {
  await assertServerReachable();
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });

  const browser = spawn(browserPath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  const mobile = [];
  const desktop = [];
  try {
    await waitForCdp();

    for (const width of mobileWidths) {
      console.error(`[navigation-browser] mobile ${width}px`);
      const result = await runMobileAudit(width);
      mobile.push(result);
      console.error(`[navigation-browser] mobile ${width}px -> ${result.ok ? "ok" : "failed"}`);
    }

    for (const width of desktopWidths) {
      console.error(`[navigation-browser] desktop ${width}px`);
      const result = await runDesktopAudit(width);
      desktop.push(result);
      console.error(`[navigation-browser] desktop ${width}px -> ${result.ok ? "ok" : "failed"}`);
    }
  } finally {
    browser.kill();
  }

  const report = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    mobile,
    desktop,
  };
  console.log(JSON.stringify(report, null, 2));

  const failures = [...mobile, ...desktop].filter((result) => !result.ok);
  if (failures.length > 0) process.exit(1);
}

async function runMobileAudit(width) {
  const client = await openPage("/", width, width >= 768 ? 960 : 844);
  const errors = [];
  client.onEvent((message) => {
    const rendered = renderConsoleMessage(message);
    if (rendered && !isIgnorableConsoleMessage(rendered)) errors.push(rendered);
  });

  try {
    await client.navigate(`${baseUrl}/`);
    await assertIloveSvgApp(client);
    await evaluate(client, `(() => {
      const button = document.querySelector('button[aria-label="Open menu"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await waitForValue(
      client,
      () => `(() => Boolean(document.querySelector('[role="dialog"][aria-label="Menu"] [data-nav-menu="mobile-tools"]')))()`,
      8_000,
    );

    const initial = await evaluate(client, mobileStateExpression());
    await setSearchValue(client, "#mobile-tool-search", "favicon");
    const search = await waitForValue(
      client,
      () => mobileStateExpression(),
      8_000,
      (state) => state.searchValue === "favicon" && state.searchLinkLabels.some((label) => /favicon/i.test(label)),
    );
    await setSearchValue(client, "#mobile-tool-search", "svg two");
    const directionalSearch = await waitForValue(
      client,
      () => mobileStateExpression(),
      8_000,
      (state) => state.searchValue === "svg two" && state.searchLinkLabels.some((label) => /^SVG to /i.test(label)),
    );

    const ok =
      initial.hasDialog &&
      initial.hasMobileMenu &&
      initial.detailsCount === 0 &&
      initial.directLinkCount > 0 &&
      initial.firstSectionId === "most-popular" &&
      expectedPopularHrefs.every((href) => initial.mostPopularHrefs.includes(href)) &&
      initial.firstPopularLinkVisible &&
      initial.noHorizontalOverflow &&
      search.searchDirectLinkCount > 0 &&
      search.searchDirectLinkCount < initial.directLinkCount &&
      search.searchLinkLabels.some((label) => /favicon/i.test(label)) &&
      search.searchResultContainerCount === 1 &&
      search.sectionCount === 0 &&
      directionalSearch.searchDirectLinkCount > 0 &&
      directionalSearch.searchHrefs.includes("/svg-to-png-converter") &&
      directionalSearch.searchHrefs.includes("/svg-to-pdf-converter") &&
      !directionalSearch.searchHrefs.includes("/png-to-svg-converter") &&
      directionalSearch.searchLinkLabels.every((label) => /(^|\s)SVG to /i.test(label)) &&
      directionalSearch.searchResultContainerCount === 1 &&
      directionalSearch.sectionCount === 0 &&
      search.detailsCount === 0 &&
      errors.length === 0;

    return {
      width,
      ok,
      initial,
      search: {
        searchValue: search.searchValue,
        searchDirectLinkCount: search.searchDirectLinkCount,
        searchLinkLabels: search.searchLinkLabels,
      },
      directionalSearch: {
        searchValue: directionalSearch.searchValue,
        searchDirectLinkCount: directionalSearch.searchDirectLinkCount,
        searchLinkLabels: directionalSearch.searchLinkLabels,
        includesPngToSvg: directionalSearch.searchHrefs.includes("/png-to-svg-converter"),
      },
      consoleErrors: errors,
      failure: ok ? null : "Mobile nav did not expose direct filtered links cleanly.",
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function runDesktopAudit(width) {
  const client = await openPage("/", width, 900);
  const errors = [];
  client.onEvent((message) => {
    const rendered = renderConsoleMessage(message);
    if (rendered && !isIgnorableConsoleMessage(rendered)) errors.push(rendered);
  });

  try {
    await client.navigate(`${baseUrl}/`);
    await assertIloveSvgApp(client);
    const primary = await evaluate(client, desktopPrimaryStateExpression());
    await evaluate(client, `(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((candidate) => /More/i.test(candidate.innerText || '') && candidate.getAttribute('aria-haspopup') === 'menu');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    const state = await waitForValue(
      client,
      () => desktopStateExpression(),
      8_000,
      (value) => value.hasMenu,
    );
    await setSearchValue(client, "#desktop-tool-search", "svg two");
    const directionalSearch = await waitForValue(
      client,
      () => desktopStateExpression(),
      8_000,
      (value) => value.searchValue === "svg two" && value.searchLabels.some((label) => /^SVG to /i.test(label)),
    );

    const expectedColumns = width >= 1840 ? 6 : width >= 1536 ? 5 : 4;
    const expectedVisiblePrimaryHrefs =
      width >= 1536
        ? widePrimaryHrefs
        : width >= 1280
          ? requiredPrimaryHrefs
          : compactPrimaryHrefs;
    const ok =
      primary.hasPrimaryNav &&
      primary.homeLogoHref === "/" &&
      primary.allToolsLinkVisible &&
      primary.moreButtonVisible &&
      primary.noPrimaryWrap &&
      primary.noHorizontalOverflow &&
      !primary.hasImageToSvgPrimary &&
      !primary.visiblePrimaryHrefs.includes("/") &&
      expectedVisiblePrimaryHrefs.every((href) => primary.visiblePrimaryHrefs.includes(href)) &&
      (width >= 1280 || !primary.visiblePrimaryHrefs.includes("/svg-to-jpg-converter")) &&
      (width >= 1280 || !primary.visiblePrimaryHrefs.includes("/jpg-to-svg-converter")) &&
      (width >= 1536 || !primary.visiblePrimaryHrefs.includes("/svg-to-pdf-converter")) &&
      (width < 1536 || primary.visiblePrimaryHrefs.includes("/svg-to-pdf-converter")) &&
      state.hasMenu &&
      state.columnCount >= expectedColumns &&
      state.menuLeft >= 0 &&
      state.menuRight <= width + 1 &&
      state.centerOffset <= 2 &&
      state.menuBottom <= state.viewportHeight + 1 &&
      state.menuWidth >= Math.min(width - 32, width >= 1840 ? 1600 : width >= 1536 ? 1360 : 960) &&
      state.noHorizontalOverflow &&
      state.duplicateHrefCount === 0 &&
      !state.searchHrefs.includes("#other-tools") &&
      directionalSearch.searchResultContainerCount === 1 &&
      directionalSearch.sectionCount === 0 &&
      directionalSearch.searchHrefs.includes("/svg-to-png-converter") &&
      directionalSearch.searchHrefs.includes("/svg-to-pdf-converter") &&
      !directionalSearch.searchHrefs.includes("/png-to-svg-converter") &&
      errors.length === 0;

    return {
      width,
      ok,
      expectedColumns,
      expectedVisiblePrimaryHrefs,
      primary,
      ...state,
      directionalSearch: {
        searchValue: directionalSearch.searchValue,
        searchLabels: directionalSearch.searchLabels,
        includesPngToSvg: directionalSearch.searchHrefs.includes("/png-to-svg-converter"),
      },
      consoleErrors: errors,
      failure: ok ? null : "Desktop More menu did not fit or scale to the viewport cleanly.",
    };
  } finally {
    await client.close().catch(() => {});
  }
}

function mobileStateExpression() {
  return `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Menu"]');
    const menu = dialog?.querySelector('[data-nav-menu="mobile-tools"]');
    const sections = Array.from(menu?.querySelectorAll('[data-nav-section]') || []);
    const links = Array.from(menu?.querySelectorAll('a[data-nav-link]') || []);
    const mostPopular = menu?.querySelector('[data-nav-section="most-popular"]');
    const mostPopularLinks = Array.from(mostPopular?.querySelectorAll('a[data-nav-link]') || []);
    const searchValue = document.querySelector('#mobile-tool-search')?.value || '';
    const searchLinks = Array.from(menu?.querySelectorAll('a[data-nav-link]') || []);
    const searchHrefs = searchLinks.map((link) => link.getAttribute('href'));
    const firstPopularRect = mostPopularLinks[0]?.getBoundingClientRect();
    return {
      hasDialog: Boolean(dialog),
      hasMobileMenu: Boolean(menu),
      firstSectionId: sections[0]?.getAttribute('data-nav-section') || null,
      sectionCount: sections.length,
      searchResultContainerCount: menu?.querySelectorAll('[data-nav-search-results]').length || 0,
      detailsCount: menu?.querySelectorAll('details, summary').length || 0,
      directLinkCount: links.length,
      mostPopularHrefs: mostPopularLinks.map((link) => link.getAttribute('href')),
      firstPopularLinkVisible: Boolean(firstPopularRect && firstPopularRect.top >= 0 && firstPopularRect.top < window.innerHeight),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1,
      searchValue,
      searchDirectLinkCount: searchLinks.length,
      searchHrefs,
      searchLinkLabels: searchLinks.slice(0, 20).map((link) => (link.textContent || '').trim()),
    };
  })()`;
}

function desktopStateExpression() {
  return `(() => {
    const menu = document.querySelector('[data-nav-menu="desktop-more"]');
    const grid = menu?.querySelector('.grid');
    const rect = menu?.getBoundingClientRect();
    const styles = grid ? getComputedStyle(grid) : null;
    const columns = styles?.gridTemplateColumns && styles.gridTemplateColumns !== 'none'
      ? styles.gridTemplateColumns.split(' ').filter(Boolean)
      : [];
    const hrefs = Array.from(menu?.querySelectorAll('a[data-nav-link]') || [])
      .map((link) => link.getAttribute('href'));
    const labels = Array.from(menu?.querySelectorAll('a[data-nav-link]') || [])
      .map((link) => (link.textContent || '').trim());
    const duplicateHrefCount = hrefs.filter((href, index) => hrefs.indexOf(href) !== index).length;
    const leftSpace = rect?.left ?? 0;
    const rightSpace = rect ? window.innerWidth - rect.right : 0;
    return {
      hasMenu: Boolean(menu && rect),
      viewportHeight: window.innerHeight,
      menuLeft: rect?.left ?? -1,
      menuRight: rect?.right ?? -1,
      centerOffset: Math.abs(leftSpace - rightSpace),
      menuBottom: rect?.bottom ?? -1,
      menuWidth: rect?.width ?? 0,
      menuHeight: rect?.height ?? 0,
      columnCount: columns.length,
      maxHeight: menu ? getComputedStyle(menu).maxHeight : '',
      linkCount: hrefs.length,
      duplicateHrefCount,
      searchValue: document.querySelector('#desktop-tool-search')?.value || '',
      sectionCount: menu?.querySelectorAll('[data-nav-section]').length || 0,
      searchResultContainerCount: menu?.querySelectorAll('[data-nav-search-results]').length || 0,
      searchHrefs: hrefs,
      searchLabels: labels.slice(0, 20),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1,
    };
  })()`;
}

function desktopPrimaryStateExpression() {
  return `(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const logo = document.querySelector('a[aria-label="iLoveSVG home"]');
    const topLevelAnchors = Array.from(nav?.querySelectorAll(':scope > a') || [])
      .filter((link) => link.getAttribute('href') !== '/pro-waitlist');
    const visiblePrimaryLinks = topLevelAnchors.filter((link) => {
      const rect = link.getBoundingClientRect();
      const styles = getComputedStyle(link);
      return styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const buttons = Array.from(nav?.querySelectorAll(':scope > button') || []);
    const moreButton = buttons.find((button) => /More/i.test(button.innerText || '') && button.getAttribute('aria-haspopup') === 'menu');
    const visibleNavControls = [
      ...visiblePrimaryLinks,
      ...buttons.filter((button) => {
        const rect = button.getBoundingClientRect();
        const styles = getComputedStyle(button);
        return styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }),
      ...Array.from(nav?.querySelectorAll(':scope > a[href="/pro-waitlist"]') || []).filter((link) => {
        const rect = link.getBoundingClientRect();
        const styles = getComputedStyle(link);
        return styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }),
    ];
    const controlCenters = visibleNavControls.map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const minControlCenter = controlCenters.length ? Math.min(...controlCenters) : 0;
    const maxControlCenter = controlCenters.length ? Math.max(...controlCenters) : 0;
    const allToolsLink = topLevelAnchors.find((link) => link.getAttribute('href') === '#other-tools' && (link.textContent || '').trim() === 'All Tools');
    const allToolsRect = allToolsLink?.getBoundingClientRect();
    const moreRect = moreButton?.getBoundingClientRect();
    return {
      hasPrimaryNav: Boolean(nav),
      homeLogoHref: logo?.getAttribute('href') || null,
      allPrimaryHrefs: topLevelAnchors.map((link) => link.getAttribute('href')),
      allPrimaryLabels: topLevelAnchors.map((link) => (link.textContent || '').trim()),
      visiblePrimaryHrefs: visiblePrimaryLinks.map((link) => link.getAttribute('href')),
      visiblePrimaryLabels: visiblePrimaryLinks.map((link) => (link.textContent || '').trim()),
      hasImageToSvgPrimary: topLevelAnchors.some((link) => {
        const href = link.getAttribute('href');
        const label = (link.textContent || '').trim();
        return href === '/' || label === 'Image to SVG';
      }),
      allToolsLinkVisible: Boolean(
        allToolsLink &&
        allToolsRect &&
        getComputedStyle(allToolsLink).display !== 'none' &&
        allToolsRect.width > 0 &&
        allToolsRect.height > 0
      ),
      moreButtonVisible: Boolean(
        moreButton &&
        moreRect &&
        getComputedStyle(moreButton).display !== 'none' &&
        moreRect.width > 0 &&
        moreRect.height > 0
      ),
      noPrimaryWrap: maxControlCenter - minControlCenter <= 4,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1,
    };
  })()`;
}

async function setSearchValue(client, selector, value) {
  await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
    return true;
  })()`);
}

async function openPage(pathname, width, height) {
  const target = await createCdpTarget("about:blank");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 1024,
  });
  await client.navigate(`${baseUrl}${pathname}`);
  return client;
}

async function assertIloveSvgApp(client) {
  const state = await evaluate(client, `(() => ({
    title: document.title,
    hasHomeLink: Boolean(document.querySelector('a[aria-label="iLoveSVG home"]')),
    hasExpectedText: /iLoveSVG|SVG tools|PNG to SVG/i.test(document.body.innerText || ''),
  }))()`);
  if (!state.hasHomeLink || !state.hasExpectedText) {
    throw new Error(`Base URL does not appear to be iLoveSVG: ${JSON.stringify(state)}`);
  }
}

function renderConsoleMessage(message) {
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params?.exceptionDetails;
    return details?.text || details?.exception?.description || "Runtime exception";
  }
  if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
    return message.params.entry.text || "Log error";
  }
  return null;
}

function isIgnorableConsoleMessage(message) {
  return (
    /ws:\/\/127\.0\.0\.1:24678/i.test(message) ||
    /WebSocket connection .*24678/i.test(message) ||
    /WebSocket closed without opened/i.test(message) ||
    /Failed to load resource: net::ERR_FILE_NOT_FOUND/i.test(message) ||
    /Access to resource at 'https:\/\/script\.google\.com\/macros\/s\//i.test(message) ||
    /Failed to load resource: net::ERR_FAILED/i.test(message)
  );
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30_000).unref?.();
    });
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await waitForValue(
      this,
      () => `(() => document.readyState)()`,
      20_000,
      (state) => state === "interactive" || state === "complete",
    );
    await delay(500);
  }

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory());
    if (isReady(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
  if (browserInfo.webSocketDebuggerUrl) {
    try {
      const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        browserWs.addEventListener("open", resolve, { once: true });
        browserWs.addEventListener("error", reject, { once: true });
      });
      const browserClient = new CdpClient(browserWs);
      const { targetId } = await browserClient.send("Target.createTarget", {
        url,
        newWindow: false,
        background: false,
      });
      await browserClient.close().catch(() => {});
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const targets = await cdpJson("/json/list");
        const target = targets.find((candidate) => candidate.id === targetId);
        if (target?.webSocketDebuggerUrl) return target;
        await delay(150);
      }
    } catch {
      // Fall through to /json/new.
    }
  }

  return cdpJson(`/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
}

async function waitForCdp() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await cdpJson("/json/version");
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("Timed out waiting for browser CDP endpoint.");
}

async function cdpJson(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function assertServerReachable() {
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Base URL ${baseUrl} returned ${response.status}`);
  }
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No Chromium-family browser executable found for navigation browser audit.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
