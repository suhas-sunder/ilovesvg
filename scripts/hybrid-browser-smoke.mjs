import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4186").replace(/\/$/, "");
const debugPort = Number(process.env.CDP_PORT || 9237);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-hybrid-browser-smoke", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");

const SMOKE_ROUTES = [
  { path: "/", file: "png", mode: "default", expectedEngine: "potrace" },
  { path: "/", file: "png", mode: "vtracer", expectedEngine: "vtracer" },
  { path: "/png-to-svg-converter", file: "png", mode: "vtracer", expectedEngine: "vtracer" },
  { path: "/jpg-to-svg-converter", file: "jpg", mode: "vtracer", expectedEngine: "vtracer" },
  { path: "/webp-to-svg-converter", file: "webp", mode: "vtracer", expectedEngine: "vtracer" },
  { path: "/png-to-layered-svg-for-cricut", file: "png", mode: "default", expectedEngine: "vtracer" },
  { path: "/line-art-to-svg-converter", file: "png", mode: "default", expectedEngine: "potrace" },
  { path: "/logo-to-svg-converter", file: "png", mode: "default", expectedEngine: "potrace" },
  { path: "/scan-to-svg-converter", file: "png", mode: "default", expectedEngine: "potrace" },
  { path: "/png-to-svg-for-cricut", file: "png", mode: "default", expectedEngine: "potrace" },
];

async function main() {
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  const fixtures = await createFixtures();

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

  const results = [];
  try {
    await waitForCdp();
    const routes = process.env.ROUTE_FILTER
      ? SMOKE_ROUTES.filter((route) => route.path === process.env.ROUTE_FILTER)
      : SMOKE_ROUTES;
    for (const route of routes) {
      console.error(`[hybrid-browser] ${route.path} (${route.mode})`);
      const result = await runRouteSmoke(route, fixtures[route.file]);
      results.push(result);
      console.error(
        `[hybrid-browser] ${route.path} -> ${result.engineUsed || "none"} ${result.ok ? "ok" : "failed"}`,
      );
    }
  } finally {
    browser.kill();
  }

  const report = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    routes: results,
  };

  console.log(JSON.stringify(report, null, 2));

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    process.exit(1);
  }
}

async function runRouteSmoke(route, fixturePath) {
  const client = await openTab(`${baseUrl}${route.path}`);
  const errors = [];
  const network = [];
  let selectedPreset = null;
  let convertButton = null;
  client.onEvent((message) => {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      const text =
        details?.exception?.description ||
        details?.exception?.value ||
        details?.text ||
        "Runtime exception";
      if (!isIgnorableDevConsoleMessage(text)) errors.push(text);
    }
    if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry;
      const text = entry?.text || "Browser log error";
      if (entry?.level === "error" && !isIgnorableDevConsoleMessage(text)) {
        errors.push(text);
      }
    }
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (request?.url?.startsWith(baseUrl)) {
        network.push({ type: "request", method: request.method, url: request.url });
      }
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params?.response;
      if (response?.url?.startsWith(baseUrl)) {
        network.push({ type: "response", status: response.status, url: response.url });
      }
    }
    if (message.method === "Network.loadingFailed") {
      network.push({
        type: "failed",
        errorText: message.params?.errorText,
        requestId: message.params?.requestId,
      });
    }
  });

  try {
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.enable");
    await client.send("DOM.enable");
    await client.send("Network.enable");
    await waitForDocumentReady(client);
    await evaluate(client, `(() => { window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = []; return true; })()`);
    await delay(1_000);

    await setFileInput(client, fixturePath);
    await waitForValue(client, () => textIncludesExpression(path.basename(fixturePath)), 8_000);

    let output = null;
    if (route.mode === "vtracer") {
      selectedPreset = await selectVTracerPreset(client, route);
      if (!selectedPreset) {
        throw new Error("Could not select a VTracer-eligible preset.");
      }
    }

    if (route.mode === "vtracer") {
      output = await waitForOutput(client, 60_000, route.expectedEngine).catch(() => null);
    }

    if (!output) {
      convertButton = await clickConvertButton(client);
      output = await waitForOutput(
        client,
        60_000,
        route.mode === "vtracer" ? route.expectedEngine : null,
      );
    } else {
      convertButton = "preset-triggered conversion";
    }
    const copyDownload = await evaluate(client, `(() => {
      const text = document.body.innerText || "";
      return {
        hasCopy: /Copy SVG/i.test(text),
        hasDownload: /Download/i.test(text),
        hasSettings: /Settings/i.test(text),
      };
    })()`);

    const ok =
      output.engineUsed === route.expectedEngine &&
      !output.hasGenericFailure &&
      output.hasOutput &&
      copyDownload.hasCopy &&
      copyDownload.hasDownload &&
      errors.length === 0;

    return {
      route: route.path,
      mode: route.mode,
      expectedEngine: route.expectedEngine,
      engineUsed: output.engineUsed,
      selectedPreset,
      convertButton,
      hasOutput: output.hasOutput,
      hasCopy: copyDownload.hasCopy,
      hasDownload: copyDownload.hasDownload,
      hasSettings: copyDownload.hasSettings,
      warnings: output.warnings,
      capabilities: output.capabilities,
      traceDebug: await readTraceDebug(client),
      consoleErrors: errors,
      network,
      ok,
      failure: ok
        ? null
        : `Expected ${route.expectedEngine}, saw ${output.engineUsed || "none"}.`,
    };
  } catch (error) {
    const debug = await getPageDebugState(client).catch((debugError) => ({
      error: debugError instanceof Error ? debugError.message : String(debugError),
    }));
    return {
      route: route.path,
      mode: route.mode,
      expectedEngine: route.expectedEngine,
      engineUsed: null,
      selectedPreset,
      convertButton,
      hasOutput: false,
      hasCopy: false,
      hasDownload: false,
      hasSettings: false,
      consoleErrors: errors,
      network,
      traceDebug: await readTraceDebug(client).catch(() => []),
      ok: false,
      failure: error instanceof Error ? error.message : String(error),
      debug,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function readTraceDebug(client) {
  return evaluate(client, `(() => Array.isArray(window.__ILOVESVG_HYBRID_TRACE_DEBUG__) ? window.__ILOVESVG_HYBRID_TRACE_DEBUG__ : [])()`);
}

async function openTab(url) {
  const target = await createCdpTarget(url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  client.targetUrl = target.url || url;
  await client.send("Runtime.enable");
  await ensureTabAtUrl(client, url);
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
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const state = await evaluate(
          this,
          `(() => document.readyState)()`,
        );
        if (state === "interactive" || state === "complete") return;
      } catch {}
      await delay(250);
    }
    throw new Error("Timed out waiting for document readiness after navigation.");
  }

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function setFileInput(client, filePath) {
  const { root } = await client.send("DOM.getDocument", {
    depth: -1,
    pierce: true,
  });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: 'input[type="file"]',
  });
  if (!nodeId) {
    const debug = await getPageDebugState(client);
    throw new Error(`No file input found. Page state: ${JSON.stringify(debug)}`);
  }
  await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  await evaluate(client, `(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
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
      // Fall through to the legacy /json/new endpoint below.
    }
  }

  return cdpJson(`/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
}

async function ensureTabAtUrl(client, url) {
  let href = await evaluate(client, `(() => location.href)()`).catch(() => "");
  if (href !== url) {
    await client.send("Page.enable").catch(() => {});
    await client.send("Page.navigate", { url }).catch(async () => {
      await evaluate(client, `(() => { window.location.assign(${JSON.stringify(url)}); return true; })()`);
    });
  }
  await waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    20_000,
    (state) =>
      state?.href === url &&
      (state.readyState === "interactive" || state.readyState === "complete"),
  );
}

async function getPageDebugState(client) {
  try {
    return await evaluate(client, `(() => ({
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      forms: document.querySelectorAll("form").length,
      buttons: Array.from(document.querySelectorAll("button")).slice(0, 12).map((button) => button.innerText.trim()),
      bodyText: (document.body?.innerText || "").slice(0, 500),
    }))()`);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      targetUrl: client.targetUrl,
    };
  }
}

async function selectVTracerPreset(client, route) {
  await evaluate(client, `(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => /^Show \\d+ more presets/i.test(candidate.innerText || ""));
    if (button) button.click();
    return Boolean(button);
  })()`);
  await delay(250);
  const routeSpecificMatchers = getRoutePresetMatchers(route);
  return evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const reject = /Show|Clear|Convert|Download|Copy|Settings|Search presets|Filter presets/i;
    const preferredMatchers = ${JSON.stringify(routeSpecificMatchers)}.map((source) => new RegExp(source, "i")).concat([
      /^Layered color SVG\\b/i,
      /^Layered - /i,
      /^WebP Edge - /i,
      /^Photo Edge - (Normal|Contour|Strong|Soft|Poster|High Contrast|Minimal)/i,
      /^Sticker - /i,
      /^Sketch - /i,
      /^Drawing - /i,
    ]);
    let button = null;
    for (const matcher of preferredMatchers) {
      button = buttons.find((candidate) => {
        const text = candidate.innerText || "";
        if (candidate.disabled || reject.test(text) || /^Color - /i.test(text)) return false;
        return matcher.test(text.trim());
      });
      if (button) break;
    }
    if (!button) return null;
    button.click();
    return button.innerText.trim();
  })()`);
}

function getRoutePresetMatchers(route) {
  if (route.path === "/webp-to-svg-converter") {
    return ["^Layered color SVG\\b", "^WebP Edge - ", "^Photo Edge - (Minimal|Contour|High Contrast)"];
  }
  if (route.path.includes("layered")) {
    return ["^Layered color SVG\\b", "^Layered - "];
  }
  return ["^Layered color SVG\\b", "^Photo Edge - (Normal|Contour|Strong|Soft|Poster|High Contrast|Minimal)"];
}

async function clickConvertButton(client) {
  const clicked = await evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((candidate) => {
      const text = candidate.innerText || "";
      const rect = candidate.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(candidate).visibility !== "hidden" &&
        getComputedStyle(candidate).display !== "none";
      return /Convert|Create/i.test(text) && !/batch|ZIP|Download/i.test(text) && !candidate.disabled && visible;
    });
    if (!button) return null;
    const label = button.innerText.trim();
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    button.click();
    return label;
  })()`);
  if (!clicked) throw new Error("No enabled convert button found.");
  return clicked;
}

async function waitForOutput(client, timeoutMs, expectedEngine = null) {
  return waitForValue(
    client,
    () => `(() => {
      const output = Array.from(document.querySelectorAll("[data-engine-used]"))
        .find((candidate) => {
          const engine = candidate.getAttribute("data-engine-used");
          return engine === "vtracer" || engine === "potrace";
        });
      const body = document.body.innerText || "";
      return {
        hasOutput: Boolean(output),
        engineUsed: output ? output.getAttribute("data-engine-used") : null,
        sourceKind: output ? output.getAttribute("data-source-kind") : null,
        warnings: output ? output.getAttribute("data-engine-warnings") : "",
        capabilities: {
          worker: typeof Worker !== "undefined",
          wasm: typeof WebAssembly !== "undefined",
          createImageBitmap: typeof createImageBitmap !== "undefined",
          offscreenCanvas: typeof OffscreenCanvas !== "undefined",
        },
        hasGenericFailure: /Conversion failed\\. Please try a smaller image or adjust the output settings\\./i.test(body),
      };
    })()`,
    timeoutMs,
    (value) =>
      value?.hasGenericFailure ||
      (expectedEngine
        ? value?.hasOutput && value.engineUsed === expectedEngine
        : value?.hasOutput),
  );
}

async function waitForDocumentReady(client) {
  return waitForValue(
    client,
    () => `(() => document.readyState)()`,
    20_000,
    (state) => state === "interactive" || state === "complete",
  );
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

function textIncludesExpression(text) {
  return `(() => (document.body.innerText || "").includes(${JSON.stringify(text)}))()`;
}

async function waitForEvent(client, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.listeners.delete(listener);
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    timeout.unref?.();
    const listener = (message) => {
      if (message.method !== method) return;
      clearTimeout(timeout);
      client.listeners.delete(listener);
      resolve(message);
    };
    client.listeners.add(listener);
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

async function createFixtures() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
      <rect width="240" height="160" fill="#ffffff"/>
      <circle cx="72" cy="78" r="38" fill="#0ea5e9"/>
      <rect x="118" y="36" width="72" height="72" rx="14" fill="#f97316"/>
      <path d="M32 132 C58 102, 94 150, 126 118 S190 126, 210 78" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>
      <text x="28" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#111827">Hybrid smoke</text>
    </svg>
  `;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
  const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
  const files = {
    png: path.join(fixturesDir, "hybrid-smoke.png"),
    jpg: path.join(fixturesDir, "hybrid-smoke.jpg"),
    webp: path.join(fixturesDir, "hybrid-smoke.webp"),
  };
  await fs.writeFile(files.png, png);
  await fs.writeFile(files.jpg, jpg);
  await fs.writeFile(files.webp, webp);
  return files;
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
  throw new Error("No Chromium-family browser executable found for browser smoke testing.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIgnorableDevConsoleMessage(message) {
  return (
    /ws:\/\/127\.0\.0\.1:24678/i.test(message) ||
    /WebSocket connection .*24678/i.test(message) ||
    /WebSocket closed without opened/i.test(message) ||
    /server responded with a status of 404/i.test(message)
  );
}

await main();
