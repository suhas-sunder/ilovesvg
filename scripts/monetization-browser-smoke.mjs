import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9241);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-monetization-browser-smoke", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const storageKey = "ilovesvg:affiliate-waterfall:v1";
const stickerRoute = "/png-to-svg-for-cricut-stickers";

const mobileWidths = [320, 360, 390, 430, 768];
const desktopWidths = [1024, 1280, 1440, 1920];

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
    mobile: [],
    desktop: [],
    tracking: {},
    consoleMessages: [],
  };

  try {
    await waitForCdp();

    for (const width of mobileWidths) {
      const client = await openPage(stickerRoute, width, 900);
      try {
        const result = await checkMobileSuppression(client, width);
        results.mobile.push(result);
      } finally {
        await client.close().catch(() => {});
      }
    }

    for (const width of desktopWidths) {
      const client = await openPage(stickerRoute, width, 900);
      try {
        const result = await checkDesktopAffiliate(client, width);
        results.desktop.push(result);
      } finally {
        await client.close().catch(() => {});
      }
    }

    const trackingClient = await openPage(stickerRoute, 1280, 900);
    try {
      results.tracking = await checkTrackingAndFallback(trackingClient);
    } finally {
      await trackingClient.close().catch(() => {});
    }

    const consoleClient = await openPage(stickerRoute, 390, 900);
    try {
      results.consoleMessages = await collectConsoleSignals(consoleClient);
    } finally {
      await consoleClient.close().catch(() => {});
    }
  } finally {
    browser.kill();
  }

  const failures = [
    ...results.mobile.filter((result) => !result.ok),
    ...results.desktop.filter((result) => !result.ok),
  ];
  if (results.tracking?.ok === false) failures.push(results.tracking);
  const badConsoleMessages = results.consoleMessages.filter(
    (message) => /hydration|did not match|error|exception/i.test(message),
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

async function checkMobileSuppression(client, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  await delay(1300);

  const state = await evaluate(client, `(() => {
    const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
    const slotAdsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
    const ads = Array.from(document.querySelectorAll('[aria-label="Advertisement"]'));
    const stored = window.localStorage.getItem(${JSON.stringify(storageKey)});
    const scrollWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    return {
      width: viewportWidth,
      affiliateCount: affiliate ? 1 : 0,
      slotAdsenseCount: slotAdsense ? 1 : 0,
      adCount: ads.length,
      stored,
      scrollWidth,
      overflow: scrollWidth > viewportWidth + 2,
    };
  })()`);

  return {
    scenario: "mobile-suppression",
    width,
    ...state,
    ok:
      state.affiliateCount === 0 &&
      state.slotAdsenseCount === 0 &&
      state.adCount >= 1 &&
      !state.stored &&
      !state.overflow,
  };
}

async function checkDesktopAffiliate(client, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  const state = await waitForValue(
    client,
    () => `(() => {
      const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
      const adsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const rect = affiliate?.getBoundingClientRect?.();
      return {
        width: window.innerWidth,
        affiliateCount: affiliate ? 1 : 0,
        adsenseCount: adsense ? 1 : 0,
        offerId: affiliate?.getAttribute('data-affiliate-offer-id') || null,
        visible: Boolean(rect && rect.width > 0 && rect.height > 0),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    })()`,
    8000,
    (state) => state?.affiliateCount === 1,
  );

  return {
    scenario: "desktop-affiliate",
    width,
    ...state,
    ok:
      state.affiliateCount === 1 &&
      state.adsenseCount === 0 &&
      state.offerId === "printify-product-mockups" &&
      state.visible &&
      !state.overflow,
  };
}

async function checkTrackingAndFallback(client) {
  await clearAffiliateStorage(client);
  await reload(client);

  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('[data-affiliate-offer-id="printify-product-mockups"]')))()`,
    8000,
  );
  await evaluate(client, `(() => {
    document.querySelector('[data-monetization-kind="affiliate"]')?.scrollIntoView({ block: "center" });
    return true;
  })()`);

  const afterView = await waitForWaterfallEntry(client, "printify-product-mockups", (entry) => entry?.viewCount === 1);

  await evaluate(client, `(() => {
    const link = document.querySelector('[data-affiliate-offer-id="printify-product-mockups"] a[href]');
    if (!link) return false;
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`);

  const afterClick = await waitForWaterfallEntry(client, "printify-product-mockups", (entry) => entry?.clicked === true && entry?.timedOut === true);

  await reload(client);
  await waitForValue(
    client,
    () => `(() => document.querySelector('[data-monetization-kind="affiliate"]')?.getAttribute('data-affiliate-offer-id') || null)()`,
    8000,
    (offerId) => offerId === "sticker-mule-custom-stickers",
  );

  await evaluate(client, `(() => {
    const state = JSON.parse(window.localStorage.getItem(${JSON.stringify(storageKey)}));
    state.entries.push({
      offerId: "sticker-mule-custom-stickers",
      slotId: "converter-below-tool",
      routeContext: ${JSON.stringify(stickerRoute)},
      viewCount: 5,
      clicked: false,
      timedOut: true,
      lastViewedAt: Date.now()
    });
    window.localStorage.setItem(${JSON.stringify(storageKey)}, JSON.stringify(state));
    return true;
  })()`);

  await reload(client);
  const fallback = await waitForValue(
    client,
    () => `(() => {
      const adsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
      return { adsense: Boolean(adsense), affiliate: Boolean(affiliate) };
    })()`,
    8000,
    (state) => state?.adsense === true,
  );

  return {
    scenario: "tracking-and-fallback",
    afterView,
    afterClick,
    fallback,
    ok:
      afterView?.viewCount === 1 &&
      afterClick?.clicked === true &&
      afterClick?.timedOut === true &&
      fallback.adsense === true &&
      fallback.affiliate === false,
  };
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

async function waitForWaterfallEntry(client, offerId, predicate) {
  return waitForValue(
    client,
    () => `(() => {
      const raw = window.localStorage.getItem(${JSON.stringify(storageKey)});
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state.entries.find((entry) =>
        entry.offerId === ${JSON.stringify(offerId)} &&
        entry.slotId === "converter-below-tool" &&
        entry.routeContext === ${JSON.stringify(stickerRoute)}
      ) || null;
    })()`,
    8000,
    predicate,
  );
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

async function clearAffiliateStorage(client) {
  await evaluate(client, `(() => {
    window.localStorage.removeItem(${JSON.stringify(storageKey)});
    return true;
  })()`);
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
  throw new Error("No Chromium-family browser executable found for monetization browser smoke.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
