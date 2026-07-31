import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9264);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditLabel =
  process.env.ROUTE_FAMILY_AUDIT_LABEL || "raster-family-browser";
const contextRelativePath =
  process.env.ROUTE_FAMILY_CONTEXT ||
  "app/client/lib/converter/rasterToSvgRouteContexts.ts";
const routePathTuple =
  process.env.ROUTE_FAMILY_PATH_TUPLE || "RASTER_TO_SVG_ROUTE_PATHS";
const tmpDir = path.join(
  os.tmpdir(),
  `ilovesvg-${auditLabel}`,
  String(debugPort),
);
const profileDir = path.join(tmpDir, "profile");
const routePaths = process.env.ROUTE_FAMILY_PATHS
  ? process.env.ROUTE_FAMILY_PATHS.split(",").filter(Boolean)
  : await readRoutePathsFromContext();

async function readRoutePathsFromContext() {
  const contextSource = await fs.readFile(
    path.join(rootDir, contextRelativePath),
    "utf8",
  );
  const escapedRoutePathTuple = routePathTuple.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const pathBlock = contextSource.match(
    new RegExp(
      `export const ${escapedRoutePathTuple} = \\[([\\s\\S]*?)\\] as const;`,
    ),
  );
  if (!pathBlock) {
    throw new Error(`${routePathTuple} route tuple not found.`);
  }
  return [...pathBlock[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
}

const allRouteViewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
];
const representativeRoutes = process.env.ROUTE_FAMILY_REPRESENTATIVES
  ? process.env.ROUTE_FAMILY_REPRESENTATIVES.split(",").filter(Boolean)
  : [
      "/png-to-svg-converter",
      "/png-to-svg-for-cricut",
      "/png-to-svg-for-etsy",
      "/png-to-svg-for-silhouette",
      "/png-to-svg-for-laser-cutting",
      "/cricut-svg-converter",
      "/jpg-to-svg-converter",
      "/jpeg-to-svg-converter",
      "/webp-to-svg-converter",
    ];
const inputOptionalRoutes = new Set(
  String(process.env.ROUTE_FAMILY_INPUT_OPTIONAL_ROUTES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const representativeViewports = [
  { width: 320, height: 800 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const existingRedirects = process.env.ROUTE_FAMILY_REDIRECTS
  ? JSON.parse(process.env.ROUTE_FAMILY_REDIRECTS)
  : [
      ["/image-to-svg-converter", "/"],
      ["/tif-to-svg-converter", "/tiff-to-svg-converter"],
      ["/png-to-vector-converter", "/png-to-svg-converter"],
      ["/jpg-to-vector-converter", "/jpg-to-svg-converter"],
    ];

async function main() {
  await assertServerReachable();
  const redirectRows = await Promise.all(
    existingRedirects.map(([source, destination]) =>
      inspectRedirect(source, destination),
    ),
  );
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });

  const browser = spawn(
    browserPath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  const rows = [];
  try {
    await waitForCdp();
    const client = await openPage();
    const consoleErrors = [];
    client.onEvent((message) => {
      const rendered = renderConsoleMessage(message);
      if (rendered && !isIgnorableConsoleMessage(rendered)) {
        consoleErrors.push(rendered);
      }
    });

    try {
      for (const routePath of routePaths) {
        for (const viewport of allRouteViewports) {
          rows.push(
            await inspectRoute(client, consoleErrors, routePath, viewport),
          );
        }
      }
      for (const routePath of representativeRoutes) {
        for (const viewport of representativeViewports) {
          rows.push(
            await inspectRoute(client, consoleErrors, routePath, viewport),
          );
        }
      }
    } finally {
      await client.close().catch(() => {});
    }
  } finally {
    browser.kill();
    await Promise.race([
      new Promise((resolve) => browser.once("exit", resolve)),
      delay(2_000),
    ]);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  const failures = rows.filter((row) => !row.ok);
  console.log(
    JSON.stringify(
      {
        routeCount: routePaths.length,
        allRouteViewportCount: routePaths.length * allRouteViewports.length,
        representativeRouteCount: representativeRoutes.length,
        representativeViewportCount:
          representativeRoutes.length * representativeViewports.length,
        totalMeasurements: rows.length,
        maximumDocumentScrollWidth: Math.max(
          ...rows.map((row) => row.documentScrollWidth),
        ),
        maximumBodyScrollWidth: Math.max(
          ...rows.map((row) => row.bodyScrollWidth),
        ),
        failures,
        redirects: redirectRows,
        screenshotsRetained: false,
        downloadsRetained: false,
        browserProfileRetained: false,
        ok: failures.length === 0,
      },
      null,
      2,
    ),
  );
  if (failures.length > 0) process.exitCode = 1;
}

async function inspectRedirect(source, destination) {
  const response = await fetch(`${baseUrl}${source}`, {
    redirect: "manual",
  });
  const location = response.headers.get("location");
  const destinationResponse = await fetch(`${baseUrl}${destination}`);
  const ok =
    response.status === 301 &&
    location === destination &&
    destinationResponse.status === 200;
  if (!ok) {
    throw new Error(
      `${source} redirect mismatch: ${response.status} ${location}; ` +
        `destination ${destinationResponse.status}.`,
    );
  }
  return {
    source,
    destination,
    status: response.status,
    destinationStatus: destinationResponse.status,
    direct: true,
  };
}

async function inspectRoute(client, consoleErrors, routePath, viewport) {
  const errorStart = consoleErrors.length;
  await client.send("Emulation.setDeviceMetricsOverride", {
    ...viewport,
    deviceScaleFactor: 1,
    mobile: viewport.width < 1024,
  });
  await client.navigate(`${baseUrl}${routePath}`);
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('h1')))()`,
    20_000,
  );

  const state = await evaluate(
    client,
    `(() => {
      const root = document.documentElement;
      const body = document.body;
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || 1) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      };
      let widest = null;
      let maximumVisibleRightEdge = 0;
      const overflowingElements = [];
      for (const element of document.querySelectorAll('body *')) {
        if (!visible(element)) continue;
        const rect = element.getBoundingClientRect();
        maximumVisibleRightEdge = Math.max(maximumVisibleRightEdge, rect.right);
        if (rect.right > root.clientWidth + 1 || rect.left < -1) {
          const style = getComputedStyle(element);
          overflowingElements.push({
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className: typeof element.className === 'string'
              ? element.className.slice(0, 160)
              : null,
            text: (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
            width: Math.round(rect.width * 100) / 100,
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            minWidth: style.minWidth,
            widthRule: style.width,
            display: style.display,
            position: style.position,
            overflowX: style.overflowX,
            whiteSpace: style.whiteSpace,
            transform: style.transform,
          });
        }
        if (!widest || rect.width > widest.width) {
          widest = {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className: typeof element.className === 'string'
              ? element.className.slice(0, 160)
              : null,
            width: Math.round(rect.width * 100) / 100,
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
          };
        }
      }
      const clippedFocusable = [
        ...document.querySelectorAll(
          'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ].filter(visible).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > root.clientWidth + 1 || rect.left < -1;
      }).slice(0, 10).map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || element.getAttribute('aria-label') || '')
          .trim()
          .slice(0, 100),
      }));
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        fileInputCount: document.querySelectorAll('input[type="file"]').length,
        documentClientWidth: root.clientWidth,
        documentScrollWidth: root.scrollWidth,
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        maximumVisibleRightEdge:
          Math.round(maximumVisibleRightEdge * 100) / 100,
        widest,
        overflowingElements: overflowingElements
          .sort((left, right) => right.right - left.right)
          .slice(0, 12),
        clippedFocusable,
      };
    })()`,
  );

  const newErrors = consoleErrors.slice(errorStart);
  const expectedCanonical = `https://www.ilovesvg.com${routePath}`;
  const ok =
    state.title.length > 0 &&
    state.h1.length > 0 &&
    state.canonical === expectedCanonical &&
    (state.fileInputCount > 0 || inputOptionalRoutes.has(routePath)) &&
    state.documentScrollWidth <= state.documentClientWidth + 1 &&
    state.bodyScrollWidth <= state.bodyClientWidth + 1 &&
    state.clippedFocusable.length === 0 &&
    newErrors.length === 0;

  console.error(
    `[${auditLabel}] ${routePath} ${viewport.width}x${viewport.height} ` +
      `document=${state.documentClientWidth}/${state.documentScrollWidth} ` +
      `body=${state.bodyClientWidth}/${state.bodyScrollWidth} ${ok ? "ok" : "failed"}`,
  );
  return {
    routePath,
    viewport,
    ...state,
    consoleErrors: newErrors,
    ok,
  };
}

async function openPage() {
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
  return client;
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
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
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
    await delay(300);
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

async function waitForValue(
  client,
  expressionFactory,
  timeoutMs,
  isReady = Boolean,
) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory());
    if (isReady(last)) return last;
    await delay(200);
  }
  throw new Error(
    `Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`,
  );
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
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
    await delay(100);
  }
  throw new Error("Timed out creating browser target.");
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
  const response = await fetch(
    `http://127.0.0.1:${debugPort}${pathname}`,
    options,
  );
  if (!response.ok) {
    throw new Error(
      `CDP request failed: ${response.status} ${await response.text()}`,
    );
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
    path.join(
      process.env.PROGRAMFILES || "",
      "Microsoft/Edge/Application/msedge.exe",
    ),
    path.join(
      process.env["PROGRAMFILES(X86)"] || "",
      "Microsoft/Edge/Application/msedge.exe",
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft/Edge/Application/msedge.exe",
    ),
    path.join(
      process.env.PROGRAMFILES || "",
      "Google/Chrome/Application/chrome.exe",
    ),
    path.join(
      process.env["PROGRAMFILES(X86)"] || "",
      "Google/Chrome/Application/chrome.exe",
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Google/Chrome/Application/chrome.exe",
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No Chromium-family browser executable found.");
}

function renderConsoleMessage(message) {
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params?.exceptionDetails;
    return details?.exception?.description || details?.text || "Runtime exception";
  }
  if (
    message.method === "Log.entryAdded" &&
    message.params?.entry?.level === "error"
  ) {
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
    /Access to resource at 'https:\/\/script\.google\.com\/macros\/s\//i.test(
      message,
    ) ||
    /Failed to load resource: net::ERR_FAILED/i.test(message)
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
