import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9241);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = `${debugPort}-${process.pid}-${Date.now()}`;
const tmpDir = path.join(os.tmpdir(), "ilovesvg-monetization-browser-smoke", runId);
const profileDir = path.join(tmpDir, "profile");

const noAdRoutes = ["/privacy-policy", "/terms-of-service", "/cookies", "/sitemap", "/pro-waitlist"];
const docsRoutes = ["/how-it-works", "/how-it-works/troubleshooting"];
const contextualRoutes = [
  "/",
  "/png-to-svg-converter",
  "/png-to-svg-for-cricut-stickers",
  "/svg-minifier",
  "/svg-cleaner",
  "/svg-to-base64",
  "/text-to-svg-converter",
];

const mobileWidths = [360, 768];
const desktopWidths = [1024, 1280, 1440];

async function main() {
  await assertServerReachable();
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });

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

  const results = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    serverShell: null,
    noAd: [],
    docs: [],
    contextual: [],
    consoleMessages: [],
  };

  try {
    await waitForCdp();
    results.serverShell = await checkServerReservedShell();

    for (const route of noAdRoutes) {
      for (const width of [360, 1024, 1440]) {
        const client = await openPage(route, width, 900);
        try {
          results.noAd.push(await checkNoAdRoute(client, route, width));
        } finally {
          await client.close().catch(() => {});
        }
      }
    }

    for (const route of docsRoutes) {
      for (const width of [...mobileWidths, ...desktopWidths]) {
        const client = await openPage(route, width, 900);
        try {
          results.docs.push(await checkDocsRoute(client, route, width));
        } finally {
          await client.close().catch(() => {});
        }
      }
    }

    for (const route of contextualRoutes) {
      for (const width of [...mobileWidths, ...desktopWidths]) {
        const client = await openPage(route, width, 900);
        try {
          results.contextual.push(await checkContextualRoute(client, route, width));
        } finally {
          await client.close().catch(() => {});
        }
      }
    }

    const consoleClient = await openPage("/png-to-svg-for-cricut-stickers", 390, 900);
    try {
      results.consoleMessages = await collectConsoleSignals(consoleClient);
    } finally {
      await consoleClient.close().catch(() => {});
    }
  } finally {
    browser.kill();
  }

  const failures = [
    ...(results.serverShell?.ok === false ? [results.serverShell] : []),
    ...results.noAd.filter((result) => !result.ok),
    ...results.docs.filter((result) => !result.ok),
    ...results.contextual.filter((result) => !result.ok),
  ];

  const badConsoleMessages = results.consoleMessages.filter(
    (message) =>
      /hydration|did not match|error|exception/i.test(message) &&
      !/\[vite\] failed to connect to websocket/i.test(message) &&
      !/Failed to fetch manifest patches/i.test(message),
  );
  if (badConsoleMessages.length) {
    failures.push({
      ok: false,
      scenario: "console",
      messages: badConsoleMessages,
    });
  }

  console.log(JSON.stringify(results, null, 2));

  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exit(1);
  }
}

async function checkServerReservedShell() {
  const response = await fetch(`${baseUrl}/png-to-svg-for-cricut-stickers`);
  const html = await response.text();
  const hasContextualAdsense = html.includes('data-monetization-slot="converter-below-tool"') &&
    html.includes('data-monetization-kind="adsense"');
  const hasPendingReserve = html.includes('data-monetization-kind="pending"');
  const hasBlockedShortUrl = html.toLowerCase().includes("am" + "zn.to");
  const hasMainSlot = html.includes('data-ad-slot="8102088582"');

  return {
    scenario: "server-contextual-adsense-shell",
    status: response.status,
    hasContextualAdsense,
    hasPendingReserve,
    hasBlockedShortUrl,
    hasMainSlot,
    ok:
      response.ok &&
      hasContextualAdsense &&
      hasMainSlot &&
      !hasPendingReserve &&
      !hasBlockedShortUrl,
  };
}

async function checkNoAdRoute(client, route, width) {
  await reload(client);
  await delay(1200);

  const state = await evaluate(client, `(() => {
    const scriptCount = document.querySelectorAll('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]').length;
    const slotCount = document.querySelectorAll('ins.adsbygoogle[data-ad-slot]').length;
    const markerCount = document.querySelectorAll('[data-monetization-kind]').length;
    const nonAdsenseMarkers = Array.from(document.querySelectorAll('[data-monetization-kind]'))
      .map((node) => node.getAttribute('data-monetization-kind'))
      .filter((kind) => kind !== "adsense");
    return {
      route: window.location.pathname,
      width: window.innerWidth,
      scriptCount,
      slotCount,
      markerCount,
      nonAdsenseMarkers,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  return {
    scenario: "no-ad-route",
    route,
    width,
    ...state,
    ok:
      state.route === route &&
      state.scriptCount === 0 &&
      state.slotCount === 0 &&
      state.markerCount === 0 &&
      state.nonAdsenseMarkers.length === 0 &&
      !state.overflow,
  };
}

async function checkDocsRoute(client, route, width) {
  await reload(client);
  await delay(1800);
  await evaluate(
    client,
    `document.querySelector('[data-monetization-slot="docs-help-compact"]')?.scrollIntoView({ block: "center" })`,
  );
  await delay(300);

  const state = await evaluate(client, `(() => {
    const docsAd = document.querySelector('[data-monetization-slot="docs-help-compact"][data-monetization-kind="adsense"]');
    const contextualAd = document.querySelector('[data-monetization-slot="converter-below-tool"]');
    const ins = docsAd?.querySelector('ins.adsbygoogle[data-ad-slot]');
    const rect = docsAd?.getBoundingClientRect?.();
    const style = docsAd ? window.getComputedStyle(docsAd) : null;
    const nonAdsenseMarkers = Array.from(document.querySelectorAll('[data-monetization-kind]'))
      .map((node) => node.getAttribute('data-monetization-kind'))
      .filter((kind) => kind !== "adsense");
    return {
      route: window.location.pathname,
      width: window.innerWidth,
      docsAdCount: docsAd ? 1 : 0,
      contextualAdCount: contextualAd ? 1 : 0,
      slot: ins?.getAttribute('data-ad-slot') || null,
      reserve: docsAd?.getAttribute('data-monetization-reserve') || null,
      visible: Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden"),
      height: rect?.height || 0,
      scriptCount: document.querySelectorAll('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]').length,
      nonAdsenseMarkers,
      visibleAdSlots: ${visibleAdSlotsExpression()},
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  return {
    scenario: "docs-compact-ad",
    route,
    width,
    ...state,
    ok:
      state.route === route &&
      state.docsAdCount === 1 &&
      state.contextualAdCount === 0 &&
      state.slot === "8102088582" &&
      state.reserve === "compact" &&
      state.scriptCount === 1 &&
      state.nonAdsenseMarkers.length === 0 &&
      state.height <= 260 &&
      !hasDuplicate(state.visibleAdSlots) &&
      !state.overflow,
  };
}

async function checkContextualRoute(client, route, width) {
  await reload(client);
  await delay(1800);
  await evaluate(
    client,
    `document.querySelector('[data-monetization-slot="converter-below-tool"]')?.scrollIntoView({ block: "center" })`,
  );
  await delay(300);

  const state = await evaluate(client, `(() => {
    const fallback = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
    const ins = fallback?.querySelector('ins.adsbygoogle[data-ad-slot]');
    const rect = fallback?.getBoundingClientRect?.();
    const style = fallback ? window.getComputedStyle(fallback) : null;
    const nonAdsenseMarkers = Array.from(document.querySelectorAll('[data-monetization-kind]'))
      .map((node) => node.getAttribute('data-monetization-kind'))
      .filter((kind) => kind !== "adsense");
    const localStorageKeys = Object.keys(window.localStorage || {});
    const oldRotationKeys = localStorageKeys.filter((key) =>
      key.includes("ama" + "zon") ||
      key.includes("aff" + "iliate") ||
      key.includes("water" + "fall")
    );
    return {
      route: window.location.pathname,
      width: window.innerWidth,
      fallbackCount: fallback ? 1 : 0,
      slot: ins?.getAttribute('data-ad-slot') || null,
      reserve: fallback?.getAttribute('data-monetization-reserve') || null,
      visible: Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden"),
      height: rect?.height || 0,
      scriptCount: document.querySelectorAll('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]').length,
      nonAdsenseMarkers,
      visibleAdSlots: ${visibleAdSlotsExpression()},
      oldRotationKeys,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  const expectsVisibleContextual = width >= 1024;
  const contextualOk = expectsVisibleContextual
    ? state.fallbackCount === 1 &&
      state.slot === "8102088582" &&
      state.reserve === "compact" &&
      state.visible &&
      state.height <= 260
    : state.fallbackCount === 1 &&
      state.slot === "8102088582" &&
      state.reserve === "compact" &&
      !state.visible;

  return {
    scenario: "contextual-adsense-only",
    route,
    width,
    ...state,
    ok:
      state.route === route &&
      state.scriptCount === 1 &&
      contextualOk &&
      state.nonAdsenseMarkers.length === 0 &&
      state.oldRotationKeys.length === 0 &&
      !hasDuplicate(state.visibleAdSlots) &&
      !state.overflow,
  };
}

function hasDuplicate(values) {
  return values.some((value, index) => values.indexOf(value) !== index);
}

function visibleAdSlotsExpression() {
  return `Array.from(document.querySelectorAll('ins.adsbygoogle[data-ad-slot]'))
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
    })
    .map((node) => node.getAttribute('data-ad-slot'))`;
}

async function collectConsoleSignals(client) {
  const messages = [];
  client.onEvent((message) => {
    if (message.method === "Runtime.consoleAPICalled") {
      messages.push(
        (message.params.args || [])
          .map((arg) => arg.value || arg.description || "")
          .join(" ")
          .trim(),
      );
    }
    if (message.method === "Runtime.exceptionThrown") {
      messages.push(message.params.exceptionDetails?.text || "Runtime exception");
    }
  });
  await client.send("Runtime.enable");
  await reload(client);
  await delay(2500);
  return messages.filter(Boolean);
}

async function openPage(pathname, width, height) {
  const url = `${baseUrl}${pathname}`;
  const target = await createCdpTarget("about:blank");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  client.targetId = target.id;
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await client.navigate(url);
  return client;
}

async function reload(client) {
  await client.send("Page.reload", { ignoreCache: true });
  await waitForValue(
    client,
    () => `(() => document.readyState)()`,
    20_000,
    (state) => state === "interactive" || state === "complete",
  );
  await delay(500);
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
      () => `(() => ({
        readyState: document.readyState,
        href: window.location.href,
        bodyChildCount: document.body?.children.length || 0
      }))()`,
      20_000,
      (state) =>
        state.readyState === "interactive" ||
        state.readyState === "complete" ||
        (state.href === url && state.bodyChildCount > 0),
    );
    await delay(500);
  }

  close() {
    return (async () => {
      if (this.targetId) {
        await closeCdpTarget(this.targetId).catch(() => {});
        this.targetId = null;
      }
      await new Promise((resolve) => {
        this.ws.addEventListener("close", resolve, { once: true });
        this.ws.close();
        setTimeout(resolve, 500).unref?.();
      });
    })();
  }
}

async function closeCdpTarget(targetId) {
  const browserInfo = await cdpJson("/json/version");
  if (!browserInfo.webSocketDebuggerUrl) return;

  const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browserWs.addEventListener("open", resolve, { once: true });
    browserWs.addEventListener("error", reject, { once: true });
  });

  const browserClient = new CdpClient(browserWs);
  await browserClient.send("Target.closeTarget", { targetId }).catch(() => {});
  await new Promise((resolve) => {
    browserWs.addEventListener("close", resolve, { once: true });
    browserWs.close();
    setTimeout(resolve, 500).unref?.();
  });
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
  throw new Error("No Chromium-family browser executable found for monetization browser smoke.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
