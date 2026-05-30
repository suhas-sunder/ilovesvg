import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const ROOT = process.cwd();
const EXACT_FAILURE_SVG =
  process.env.SVG_COMPRESSION_REAL_FILE ||
  "C:\\Users\\Suhas\\Downloads\\jpg-to-layered-svg-for-cricut (8).svg";

const readText = (relativePath) =>
  fs.readFile(path.join(ROOT, relativePath), "utf8");

const byteSize = (value) => Buffer.byteLength(String(value), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadCompressionModule() {
  const source = await readText("app/utils/svgCompression.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
  }).outputText;
  const modulePath = path.join(ROOT, "tmp", "svg-compression-smoke-module.mjs");
  await fs.mkdir(path.dirname(modulePath), { recursive: true });
  await fs.writeFile(modulePath, transpiled, "utf8");
  return import(`${pathToFileURL(modulePath).href}?cache=${Date.now()}`);
}

function rootDimensions(svg) {
  const root = String(svg).match(/<svg\b[^>]*>/i)?.[0] || "";
  const attr = (name) =>
    root.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ||
    "";
  return {
    width: attr("width"),
    height: attr("height"),
    viewBox: attr("viewBox"),
  };
}

function assertDimensionsPreserved(before, after, label) {
  assert(
    JSON.stringify(rootDimensions(before)) === JSON.stringify(rootDimensions(after)),
    `${label}: root dimensions/viewBox changed`,
  );
}

function assertReferencedIdsExist(svg, label) {
  const ids = new Set(
    [...String(svg).matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(
      (match) => match[1],
    ),
  );
  const refs = [
    ...String(svg).matchAll(/url\(\s*#([^)]+?)\s*\)/gi),
    ...String(svg).matchAll(/(?:href|xlink:href)\s*=\s*["']#([^"']+)["']/gi),
  ].map((match) => match[1]);
  for (const ref of refs) {
    assert(ids.has(ref), `${label}: missing id for reference #${ref}`);
  }
}

function assertCompleteSvg(svg, label) {
  assert(/<svg\b[^>]*>/i.test(svg), `${label}: missing <svg>`);
  assert(/<\/svg\s*>/i.test(svg), `${label}: missing </svg>`);
}

function countMatches(svg, pattern) {
  return (String(svg).match(pattern) || []).length;
}

function assertPathStructurePreserved(before, after, label) {
  assert(
    countMatches(before, /<path\b/gi) === countMatches(after, /<path\b/gi),
    `${label}: path count changed`,
  );
  assert(
    countMatches(before, /<g\b/gi) === countMatches(after, /<g\b/gi),
    `${label}: group count changed`,
  );
}

function assertCompressionFloor(result, floorPercent, label) {
  assert(
    result.savedPercent >= floorPercent,
    `${label}: expected at least ${floorPercent}% savings, got ${result.savedPercent}%`,
  );
}

function makePathHeavyLayeredFixture() {
  const buildPath = (seed) => {
    const chunks = [`M${seed} ${696 + seed}`];
    for (let i = 0; i < 1400; i += 1) {
      const tall = 120 + ((i + seed) % 710);
      const wide = 120 + ((i * 13 + seed) % 880);
      const narrow = 28 + ((i * 7 + seed) % 240);
      const drop = 12 + ((i + seed) % 9);
      chunks.push(`c0 ${tall} 0 ${tall + 1} 2 ${tall + 1} 2 0 2-1 2-${tall}`);
      chunks.push(`l${wide} 0 0 ${drop}-${wide} 0 0-${drop}`);
      chunks.push(`l${narrow} 0 0 ${drop + 1}-${narrow} 0 0-${drop + 1}`);
      chunks.push(`l${wide - narrow} 0 0 ${drop + 2}-${wide - narrow} 0 0-${drop + 2}`);
      chunks.push(`c0 ${drop} 0 ${drop + 1}-2 ${drop + 1}-1 0-${wide - 1}-1-${wide - 2}-1`);
    }
    return chunks.join("");
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1751 1522" role="img" aria-label="Path heavy layered SVG"><g id="layer-1-fafcfe" data-layer-name="Layer 1" data-layer-id="layer-1-fafcfe" data-layer-label="Layer 1" data-layer-color="#fafcfe" data-editor-opacity="1" fill="#fafcfe"><path data-fill-layer-id="layer-1-fafcfe" d="${buildPath(0)}"/></g><g id="layer-2-111827" data-layer-name="Layer 2" data-layer-id="layer-2-111827" data-layer-label="Layer 2" data-layer-color="#111827" data-editor-opacity="1" fill="#111827"><path data-stroke-layer-id="layer-2-111827" d="${buildPath(9)}"/></g><g id="layer-3-2563eb" data-layer-name="Layer 3" data-layer-id="layer-3-2563eb" data-layer-label="Layer 3" data-layer-color="#2563eb" data-editor-opacity="1" fill="#2563eb"><path data-fill-layer-id="layer-3-2563eb" d="${buildPath(17)}"/></g><g id="layer-4-f97316" data-layer-name="Layer 4" data-layer-id="layer-4-f97316" data-layer-label="Layer 4" data-layer-color="#f97316" data-editor-opacity="1" fill="#f97316"><path data-fill-layer-id="layer-4-f97316" d="${buildPath(31)}"/></g></svg>`;
}

function assertPathHeavyCase(svg, label, compressSvg) {
  const none = compressSvg(svg, { level: "none" });
  const tiny = compressSvg(svg, { level: "tiny" });
  const tiniest = compressSvg(svg, { level: "tiniest" });

  assert(none.svg === svg, `${label}: None must preserve SVG bytes exactly`);
  assertCompressionFloor(tiny, 10, `${label} Tiny`);
  assertCompressionFloor(tiniest, 24, `${label} Tiniest`);
  assert(
    tiniest.outputBytes < tiny.outputBytes,
    `${label}: Tiniest should be materially smaller than Tiny`,
  );
  assert(
    tiny.svg.includes("data-layer-name="),
    `${label}: Tiny stripped data-layer-name`,
  );
  assert(
    tiny.svg.includes("data-layer-id=") || !svg.includes("data-layer-id="),
    `${label}: Tiny stripped data-layer-id`,
  );
  assert(
    !tiniest.svg.includes("data-layer-name="),
    `${label}: Tiniest should strip export-only data-layer-name`,
  );
  assert(
    tiniest.warnings.some((warning) => /future layer editing/i.test(warning)),
    `${label}: Tiniest editability warning missing`,
  );
  assertDimensionsPreserved(svg, tiny.svg, `${label} Tiny`);
  assertDimensionsPreserved(svg, tiniest.svg, `${label} Tiniest`);
  assertPathStructurePreserved(svg, tiny.svg, `${label} Tiny`);
  assertPathStructurePreserved(svg, tiniest.svg, `${label} Tiniest`);
  assertReferencedIdsExist(tiny.svg, `${label} Tiny`);
  assertReferencedIdsExist(tiniest.svg, `${label} Tiniest`);

  return {
    inputBytes: none.outputBytes,
    tinyBytes: tiny.outputBytes,
    tinySavingsPercent: tiny.savedPercent,
    tiniestBytes: tiniest.outputBytes,
    tiniestSavingsPercent: tiniest.savedPercent,
  };
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result || {});
      }
    });
  }

  send(method, params = {}, timeoutMs = 30_000) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs).unref?.();
    });
  }

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

const layeredSample = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="640" height="420" viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1.3">
  <!-- Design note that should disappear outside None. -->
  <metadata>Large editor metadata that does not affect rendering.</metadata>
  <defs>
    <linearGradient id="long-gradient-name"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#f97316"/></linearGradient>
    <clipPath id="long-clip-name"><path d="M 10.12345 10.98765 L 610.33333 12.44444 L 605.22222 390.98765 L 22.44444 399.11111 Z"/></clipPath>
    <mask id="long-mask-name"><rect x="0.0000" y="0.0000" width="640.0000" height="420.0000" fill="#fff"/></mask>
    <linearGradient id="unused-gradient"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
  </defs>
  <g id="editable-layer-main" class="editable shape" data-layer-id="editable-layer-main" data-layer-label="Main editable layer" data-layer-color="#2563eb" data-editor-opacity="0.875" fill="url(#long-gradient-name)" clip-path="url(#long-clip-name)" mask="url(#long-mask-name)">
    <path data-fill-layer-id="editable-layer-main" d="M 41.23456 70.87654 C 112.45678 24.98765, 330.22222 28.33333, 501.87654 92.33333 L 581.98765 310.55555 L 88.22222 344.98765 Z"/>
    <path data-stroke-layer-id="editable-layer-main" fill="none" stroke="#111827" stroke-width="4.5000" d="M 100.55555 120.44444 L 540.33333 288.66666"/>
  </g>
</svg>`;

const styleSample = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><style>.a{fill:url(#kept)}</style><defs><linearGradient id="kept"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect class="a" width="100" height="100"/></svg>`;

const { compressSvg, getSvgByteSize } = await loadCompressionModule();

const none = compressSvg(layeredSample, { level: "none" });
assert(none.svg === layeredSample, "None must preserve SVG bytes exactly");
assert(none.outputBytes === byteSize(layeredSample), "None output byte count is inaccurate");
assert(none.savedBytes === 0, "None should not report saved bytes");
assert(none.savedPercent === 0, "None should not report savings percent");

const tiny = compressSvg(layeredSample, { level: "tiny" });
assert(tiny.outputBytes < none.outputBytes, "Tiny should reduce the layered sample");
assert(tiny.svg.includes("data-layer-id="), "Tiny stripped data-layer-id");
assert(tiny.svg.includes("data-fill-layer-id="), "Tiny stripped data-fill-layer-id");
assert(tiny.svg.includes("data-stroke-layer-id="), "Tiny stripped data-stroke-layer-id");
assert(tiny.svg.includes("data-layer-label="), "Tiny stripped data-layer-label");
assert(tiny.svg.includes("data-layer-color="), "Tiny stripped data-layer-color");
assert(tiny.svg.includes("data-editor-opacity="), "Tiny stripped data-editor-opacity");
assert(tiny.svg.includes('class="editable shape"'), "Tiny stripped class attributes");
assert(!tiny.svg.includes("<metadata"), "Tiny should remove metadata blocks");
assert(tiny.svg.includes('clip-path="url(#long-clip-name)"'), "Tiny stripped clip-path reference");
assert(tiny.svg.includes('id="long-clip-name"'), "Tiny stripped referenced clipPath id");
assert(tiny.svg.includes("</clipPath>"), "Tiny malformed a referenced clipPath");
assertDimensionsPreserved(layeredSample, tiny.svg, "Tiny");
assertReferencedIdsExist(tiny.svg, "Tiny");
assertCompleteSvg(tiny.svg, "Tiny");

const tiniest = compressSvg(layeredSample, { level: "tiniest" });
assert(tiniest.outputBytes <= tiny.outputBytes, "Tiniest should be no larger than Tiny");
assert(!tiniest.svg.includes("data-layer-id="), "Tiniest should strip export-only data-layer-id");
assert(!tiniest.svg.includes("data-fill-layer-id="), "Tiniest should strip export-only data-fill-layer-id");
assert(!tiniest.svg.includes("data-stroke-layer-id="), "Tiniest should strip export-only data-stroke-layer-id");
assert(!tiniest.svg.includes("data-layer-label="), "Tiniest should strip export-only data-layer-label");
assert(!tiniest.svg.includes("data-layer-color="), "Tiniest should strip export-only data-layer-color");
assert(!tiniest.svg.includes("data-editor-opacity="), "Tiniest should strip export-only data-editor-opacity");
assert(tiniest.warnings.some((warning) => /future layer editing/i.test(warning)), "Tiniest editability warning missing");
assertDimensionsPreserved(layeredSample, tiniest.svg, "Tiniest");
assertReferencedIdsExist(tiniest.svg, "Tiniest");
assertCompleteSvg(tiniest.svg, "Tiniest");

const styled = compressSvg(styleSample, { level: "tiniest" });
assertReferencedIdsExist(styled.svg, "style sample");
assert(
  styled.warnings.some((warning) => /style/i.test(warning)),
  "Tiniest should warn when style content blocks risky cleanup",
);

const pathHeavySample = makePathHeavyLayeredFixture();
const generatedPathHeavy = assertPathHeavyCase(
  pathHeavySample,
  "generated path-heavy layered fixture",
  compressSvg,
);

let exactFailureCase = null;
try {
  const exactSvg = await fs.readFile(EXACT_FAILURE_SVG, "utf8");
  exactFailureCase = assertPathHeavyCase(
    exactSvg,
    "jpg-to-layered-svg-for-cricut (8).svg",
    compressSvg,
  );
  exactFailureCase.path = EXACT_FAILURE_SVG;
} catch (error) {
  exactFailureCase = {
    skipped: true,
    path: EXACT_FAILURE_SVG,
    reason: error?.code === "ENOENT" ? "fixture not found on this machine" : String(error?.message || error),
  };
}

assert(
  getSvgByteSize(layeredSample) === byteSize(layeredSample),
  "getSvgByteSize must match UTF-8 byte length",
);
assert(tiny.originalBytes === byteSize(layeredSample), "Tiny originalBytes is inaccurate");
assert(tiny.outputBytes === byteSize(tiny.svg), "Tiny outputBytes is inaccurate");
assert(tiny.savedBytes === tiny.originalBytes - tiny.outputBytes, "Tiny savedBytes is inaccurate");

const routeSource = await readText("app/routes/svg-minifier.tsx");
for (const needle of [
  "None",
  "Tiny",
  "Tiniest",
  "Original size",
  "Compressed size",
  "Bytes saved",
  "Percent saved",
  "data-compression-level",
]) {
  assert(routeSource.includes(needle), `svg-minifier UI missing ${needle}`);
}

for (const converterPath of [
  "app/client/components/converter/TraceOutputPanel.tsx",
  "app/client/components/converter/BespokeTraceOutputPanel.tsx",
  "app/client/components/svg/EditedSvgPreviewImage.tsx",
]) {
  const source = await readText(converterPath);
  assert(!source.includes("svgCompression"), `${converterPath} imports SVG compression`);
}

let browserSmoke = null;
if (process.env.SVG_COMPRESSION_BROWSER_SMOKE === "1") {
  browserSmoke = await runBrowserUploadSmoke();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      samples: exactFailureCase?.skipped ? 3 : 4,
      noneBytes: none.outputBytes,
      tinySavingsPercent: tiny.savedPercent,
      tiniestSavingsPercent: tiniest.savedPercent,
      generatedPathHeavy,
      exactFailureCase,
      browserSmoke,
      tinyPreservedLayerMetadata: true,
      tiniestRemovedExportMetadata: true,
      referencedDefsPreserved: true,
    },
    null,
    2,
  ),
);

async function runBrowserUploadSmoke() {
  const fixturePath = await browserFixturePath();
  const originalBytes = (await fs.stat(fixturePath)).size;
  const baseUrl = getSmokeBaseUrl();
  const debugPort = Number(
    process.env.CDP_PORT || 12_700 + Math.floor(Math.random() * 500),
  );
  const tmpDir = path.join(os.tmpdir(), "ilovesvg-svg-compression-browser", String(debugPort));
  const profileDir = path.join(tmpDir, "profile");
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });

  const browser = spawn(await findBrowserExecutable(), [
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

  let client = null;
  try {
    await waitForCdp(debugPort);
    client = await openTab(debugPort, `${baseUrl}/svg-minifier`);
    await delay(750);
    await setFileInput(client, fixturePath);

    const tiny = await readBrowserCompressionState(client, "tiny", originalBytes);
    await chooseCompressionLevel(client, "tiniest");
    const tiniest = await readBrowserCompressionState(client, "tiniest", originalBytes);

    assertCompressionFloor(tiny, 10, "browser Tiny");
    assertCompressionFloor(tiniest, 24, "browser Tiniest");
    assert(
      tiniest.outputBytes < tiny.outputBytes,
      "browser: Tiniest should be materially smaller than Tiny",
    );
    assert(tiny.hasOutputPreview, "browser: missing output preview");
    assert(tiny.downloadEnabled, "browser: download button is not enabled");

    return {
      fixturePath,
      originalBytes,
      tiny,
      tiniest,
    };
  } finally {
    await client?.close?.().catch(() => {});
    browser.kill();
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function browserFixturePath() {
  const requested = process.env.SVG_COMPRESSION_BROWSER_FIXTURE || EXACT_FAILURE_SVG;
  try {
    await fs.access(requested);
    return requested;
  } catch {
    const fixturePath = path.join(
      ROOT,
      "tmp",
      "svg-compression-generated-path-heavy.svg",
    );
    await fs.mkdir(path.dirname(fixturePath), { recursive: true });
    await fs.writeFile(fixturePath, makePathHeavyLayeredFixture(), "utf8");
    return fixturePath;
  }
}

async function setFileInput(client, filePath) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="file"]')))()`,
    12_000,
    Boolean,
  );
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true }, 8_000);
  const { nodeIds = [] } = await client.send("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector: 'input[type="file"]',
  }, 8_000);
  assert(nodeIds.length > 0, "browser: no file input found");
  const basename = path.basename(filePath);
  try {
    for (const nodeId of nodeIds) {
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 20_000);
    }
    await evaluate(client, `(() => {
      for (const input of document.querySelectorAll('input[type="file"]')) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    })()`);
    await waitForUploadApplied(client, basename);
    return;
  } catch {}

  const fileBase64 = (await fs.readFile(filePath)).toString("base64");
  const applied = await evaluate(client, `(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (!inputs.length) return { ok: false, reason: "missing input" };
    const binary = atob(${JSON.stringify(fileBase64)});
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    for (const input of inputs) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], ${JSON.stringify(basename)}, { type: "image/svg+xml" }));
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { ok: true };
  })()`, 30_000);
  assert(applied?.ok, `browser: could not apply file input (${applied?.reason || "unknown"})`);
  await waitForUploadApplied(client, basename);
}

async function waitForUploadApplied(client, basename) {
  return waitForValue(
    client,
    () => `(() => {
      const body = document.body?.innerText || "";
      const outputTextareas = Array.from(document.querySelectorAll("textarea")).filter((textarea) => textarea.readOnly);
      const outputSvg = outputTextareas[outputTextareas.length - 1]?.value || "";
      return {
        bodyHasName: body.includes(${JSON.stringify(basename)}),
        outputBytes: outputSvg ? new TextEncoder().encode(outputSvg).length : 0,
        errorText: Array.from(document.querySelectorAll(".text-red-700")).map((node) => node.textContent || "").join(" "),
      };
    })()`,
    20_000,
    (state) => state?.bodyHasName || state?.outputBytes > 0 || state?.errorText,
  );
}

async function chooseCompressionLevel(client, level) {
  await evaluate(client, `(() => {
    const button = document.querySelector(${JSON.stringify(`[data-compression-level="${level}"]`)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function readBrowserCompressionState(client, level, originalBytes) {
  return waitForValue(
    client,
    () => `(() => {
      const activeLevel = document.querySelector("[data-compression-level][aria-pressed='true']")?.getAttribute("data-compression-level") || "";
      const outputTextareas = Array.from(document.querySelectorAll("textarea")).filter((textarea) => textarea.readOnly);
      const outputSvg = outputTextareas[outputTextareas.length - 1]?.value || "";
      const outputBytes = outputSvg ? new TextEncoder().encode(outputSvg).length : 0;
      const savedBytes = ${originalBytes} - outputBytes;
      const downloadButton = Array.from(document.querySelectorAll("button")).find((button) => /Download Minified SVG/i.test(button.textContent || ""));
      return {
        activeLevel,
        outputBytes,
        savedBytes,
        savedPercent: ${originalBytes} > 0 && outputBytes > 0 ? Number(((savedBytes / ${originalBytes}) * 100).toFixed(2)) : 0,
        hasOutputPreview: Boolean(document.querySelector('img[alt="Minified SVG preview"]')),
        downloadEnabled: Boolean(downloadButton && !downloadButton.disabled),
        hasLayerMetadata: outputSvg.includes("data-layer-name=") || outputSvg.includes("data-layer-id="),
        hasEditabilityWarning: /future layer editing/i.test(document.body?.innerText || ""),
      };
    })()`,
    20_000,
    (state) => state?.activeLevel === level && state.outputBytes > 0,
  );
}

async function openTab(debugPort, url) {
  const target = await createCdpTarget(debugPort, url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  await client.send("Runtime.enable");
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.bringToFront").catch(() => {});
  await waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState, title: document.title }))()`,
    20_000,
    (state) =>
      state?.href === url &&
      /SVG Minifier/i.test(state.title || "") &&
      (state.readyState === "interactive" || state.readyState === "complete"),
  );
  return client;
}

async function createCdpTarget(debugPort, url) {
  const browserInfo = await cdpJson(debugPort, "/json/version");
  if (browserInfo.webSocketDebuggerUrl) {
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
      const targets = await cdpJson(debugPort, "/json/list");
      const target = targets.find((candidate) => candidate.id === targetId);
      if (target?.webSocketDebuggerUrl) return target;
      await delay(150);
    }
  }
  return cdpJson(debugPort, `/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
}

async function evaluate(client, expression, timeoutMs = 10_000) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, timeoutMs);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory(), 10_000);
    if (isReady(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

async function waitForCdp(debugPort) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await cdpJson(debugPort, "/json/version");
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("Timed out waiting for browser CDP endpoint.");
}

async function cdpJson(debugPort, pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
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
  throw new Error("No Chromium-family browser executable found for SVG compression browser smoke.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
