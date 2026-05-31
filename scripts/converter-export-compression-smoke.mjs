import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const ROOT = process.cwd();
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const DEBUG_PORT = Number(
  process.env.CDP_PORT || 12_900 + Math.floor(Math.random() * 400),
);
const TMP_DIR = path.join(os.tmpdir(), "ilovesvg-converter-export-compression", String(DEBUG_PORT));
const DOWNLOADS_DIR = path.join(TMP_DIR, "downloads");
const PROFILE_DIR = path.join(TMP_DIR, "profile");
const FIXTURES_DIR = path.join(ROOT, "tmp", "converter-export-compression-fixtures");
const CONVERSION_TIMEOUT_MS = Number(process.env.CONVERTER_EXPORT_COMPRESSION_TIMEOUT_MS || 90_000);

const SCENARIOS = [
  { id: "home", route: "/", fixture: "png" },
  { id: "png-to-svg", route: "/png-to-svg-converter", fixture: "png" },
  { id: "silhouette", route: "/png-to-svg-for-silhouette", fixture: "png" },
  { id: "png-layered", route: "/png-to-layered-svg-for-cricut", fixture: "png" },
  { id: "jpg-layered", route: "/jpg-to-layered-svg-for-cricut", fixture: "jpg" },
  { id: "image-layered", route: "/image-to-layered-svg-for-cricut", fixture: "png" },
  { id: "code-to-svg", route: "/code-to-svg-for-cricut", fixture: "svg", input: "textarea" },
];
const SCENARIO_FILTER = String(process.env.CONVERTER_EXPORT_COMPRESSION_ROUTE_FILTER || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const SELECTED_SCENARIOS = SCENARIO_FILTER.length
  ? SCENARIOS.filter((scenario) =>
      SCENARIO_FILTER.includes(scenario.id) || SCENARIO_FILTER.includes(scenario.route),
    )
  : SCENARIOS;

const LEVELS = ["none", "tiny", "tiniest"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  await fs.mkdir(PROFILE_DIR, { recursive: true });

  const fixtures = await createFixtures();
  await assertServer();

  const browser = spawn(await findBrowserExecutable(), [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
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
  const failures = [];

  try {
    await waitForCdp();
    for (const scenario of SELECTED_SCENARIOS) {
      try {
        console.log(`[converter-export-compression] starting ${scenario.id} ${scenario.route}`);
        const result = await runScenario(scenario, fixtures);
        results.push(result);
        console.log(
          `[converter-export-compression] ${scenario.id}: none=${result.none.bytes} tiny=${result.tiny.bytes} tiniest=${result.tiniest.bytes}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ scenario: scenario.id, message });
        console.error(`[converter-export-compression] ${scenario.id}: ${message}`);
      }
    }
  } finally {
    browser.kill();
    await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  }

  const metadataCases = results.filter((result) => result.none.hasLayerMetadata);
  const tinyPreservedMetadata = metadataCases.every((result) => result.tiny.hasLayerMetadata);
  const tiniestWarned = results.every((result) => result.tiniest.warningVisible);
  const copyDownloadParity = results.every((result) =>
    LEVELS.every((level) => result[level].copyHash === result[level].downloadHash),
  );
  const previewUnchanged = results.every((result) => result.previewUnchanged);

  const summary = {
    ok:
      failures.length === 0 &&
      results.length === SELECTED_SCENARIOS.length &&
      copyDownloadParity &&
      previewUnchanged &&
      tinyPreservedMetadata &&
      tiniestWarned,
    scenarios: results.length,
    failures,
    copyDownloadParity,
    previewUnchanged,
    metadataCases: metadataCases.map((result) => result.id),
    tinyPreservedMetadata,
    tiniestWarned,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exit(1);
  }
}

async function runScenario(scenario, fixturesByKind) {
  const fixturePath = fixturesByKind[scenario.fixture];
  const client = await openTab(`${BASE_URL}${scenario.route}`);
  try {
    await configurePage(client);
    await installClipboardCapture(client);
    await delay(1_000);
    if (scenario.input === "sample") {
      await clickPageButton(client, [/Load sample/i]);
    } else if (scenario.input === "textarea") {
      await setTextareaInput(client, await fs.readFile(fixturePath, "utf8"));
    } else {
      await setFileInput(client, fixturePath);
    }

    await delay(1_200);
    const quickState = await readLatestOutputState(client).catch(() => null);
    if (
      !quickState?.previewSvg &&
      !quickState?.activeJobs &&
      !quickState?.cardCount
    ) {
      await clickConvertIfPresent(client);
    }
    let state = await waitForCompletedOutput(client, CONVERSION_TIMEOUT_MS);
    state = await waitForStableLatestOutput(client);

    assert(state.previewSvg, `${scenario.id}: could not read visible preview SVG`);
    assert(state.exportLevel === "none", `${scenario.id}: default export compression was ${state.exportLevel || "missing"}`);
    assert(state.previewSvg.includes("<svg"), `${scenario.id}: preview SVG was not readable`);

    await openSettingsForLatestOutput(client);
    const control = await waitForExportControl(client);
    assert(control.level === "none", `${scenario.id}: Settings/Edit default compression was ${control.level}`);
    const settingsState = await waitForStableLatestOutput(client);
    const previewBefore = settingsState.previewSvg;
    assert(previewBefore, `${scenario.id}: could not read stable Settings/Edit preview SVG`);
    const expectedNoneBytes = Number(settingsState.svgBytesAttr || 0) || byteSize(previewBefore);

    const levelResults = {};
    let exportGeometryBaseline = null;
    for (const level of LEVELS) {
      await selectExportCompressionLevel(client, level);
      const afterSelect = await readLatestOutputState(client);
      assert(afterSelect.previewSvg === previewBefore, `${scenario.id}: preview changed after selecting ${level}`);
      const copied = await copyLatestOutput(client);
      const downloaded = await downloadLatestOutput(client);
      assert(copied === downloaded, `${scenario.id}: Copy and Download mismatch for ${level}`);
      assert(isParsableSvg(downloaded), `${scenario.id}: downloaded ${level} output does not parse as SVG`);
      const downloadedGeometry = readRootGeometry(downloaded);
      assert(
        rootGeometryCompatibleWithPreview(previewBefore, downloaded),
        `${scenario.id}: ${level} changed dimensions or viewBox ${JSON.stringify({
          before: readRootGeometry(previewBefore),
          after: downloadedGeometry,
        })}`,
      );
      if (!exportGeometryBaseline) {
        exportGeometryBaseline = downloadedGeometry;
      } else {
        assert(
          rootGeometryObjectsMatch(exportGeometryBaseline, downloadedGeometry),
          `${scenario.id}: ${level} changed export dimensions or viewBox from None ${JSON.stringify({
            none: exportGeometryBaseline,
            after: downloadedGeometry,
          })}`,
        );
      }
      levelResults[level] = {
        bytes: byteSize(downloaded),
        copyHash: hashString(copied),
        downloadHash: hashString(downloaded),
        hasLayerMetadata: hasLayerMetadata(downloaded),
        warningVisible: await hasTiniestWarning(client),
      };
    }

    assert(
      levelResults.none.bytes === expectedNoneBytes,
      `${scenario.id}: None did not preserve current export size (${levelResults.none.bytes} !== ${expectedNoneBytes})`,
    );
    assert(levelResults.tiny.bytes <= levelResults.none.bytes, `${scenario.id}: Tiny was larger than None`);
    assert(levelResults.tiniest.bytes <= levelResults.tiny.bytes, `${scenario.id}: Tiniest was larger than Tiny`);
    if (levelResults.none.hasLayerMetadata) {
      assert(levelResults.tiny.hasLayerMetadata, `${scenario.id}: Tiny stripped layer/editor metadata`);
    }
    assert(levelResults.tiniest.warningVisible, `${scenario.id}: Tiniest warning was not visible`);

    state = await readLatestOutputState(client);
    return {
      id: scenario.id,
      route: scenario.route,
      fixture: path.basename(fixturePath),
      presetTitle: state.title,
      previewUnchanged: state.previewSvg === previewBefore,
      none: levelResults.none,
      tiny: levelResults.tiny,
      tiniest: levelResults.tiniest,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function createFixtures() {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" viewBox="0 0 128 96">
  <defs>
    <linearGradient id="grad-a" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0ea5e9"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
    <clipPath id="clip-a"><rect x="8" y="8" width="112" height="80" rx="10"/></clipPath>
  </defs>
  <g data-layer-id="background" data-layer-name="Background" data-layer-color="#0ea5e9" clip-path="url(#clip-a)">
    <rect x="8" y="8" width="112" height="80" fill="url(#grad-a)"/>
  </g>
  <g data-layer-id="mark" data-fill-layer-id="mark-fill" data-layer-name="Mark" data-layer-color="#111827">
    <path d="M20 72 C 36 26, 52 26, 68 72 S 100 118, 116 24" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>
    <circle cx="48" cy="38" r="13" fill="#f8fafc"/>
    <circle cx="82" cy="52" r="17" fill="#ef4444"/>
  </g>
</svg>`;
  const svgPath = path.join(FIXTURES_DIR, "export-compression-source.svg");
  const pngPath = path.join(FIXTURES_DIR, "export-compression-source.png");
  const jpgPath = path.join(FIXTURES_DIR, "export-compression-source.jpg");
  await fs.writeFile(svgPath, svg, "utf8");
  const raster = sharp(Buffer.from(svg)).resize(96, 72, { fit: "contain" });
  await raster.png().toFile(pngPath);
  await sharp(Buffer.from(svg)).resize(96, 72, { fit: "contain" }).jpeg({ quality: 92 }).toFile(jpgPath);
  return { svg: svgPath, png: pngPath, jpg: jpgPath };
}

async function assertServer() {
  const response = await fetch(BASE_URL).catch((error) => {
    throw new Error(`Could not reach ${BASE_URL}: ${error.message}`);
  });
  const text = await response.text();
  assert(response.ok, `Could not reach ${BASE_URL}: HTTP ${response.status}`);
  assert(/iLoveSVG|SVG/i.test(text), `${BASE_URL} does not look like the iLoveSVG app`);
}

async function configurePage(client) {
  await client.send("Runtime.enable").catch(() => {});
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOADS_DIR,
  }, 8_000).catch(async () => {
    await client.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: DOWNLOADS_DIR,
    }, 8_000);
  });
  await waitForDocumentReady(client);
}

async function installClipboardCapture(client) {
  await evaluate(client, `(() => {
    window.__CONVERTER_EXPORT_COMPRESSION__ = { clipboardWrites: [] };
    const capture = async (text) => {
      window.__CONVERTER_EXPORT_COMPRESSION__.clipboardWrites.push(String(text || ""));
      return undefined;
    };
    try {
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: capture } });
      } else {
        navigator.clipboard.writeText = capture;
      }
    } catch {
      try {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: capture } });
      } catch {}
    }
    return true;
  })()`);
}

async function setFileInput(client, filePath) {
  await waitForValue(
    client,
    () => `(() => document.querySelectorAll('input[type="file"]').length)()`,
    15_000,
    (count) => Number(count) > 0,
  );
  const expectedName = path.basename(filePath);

  try {
    await setFileInputViaChooser(client, filePath);
    const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
    if (accepted) return;
  } catch {}

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nodeId = await queryFileInputNodeId(client, primaryFileInputSelector);
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 8_000);
      await dispatchFileInputChange(client);
      const accepted = await waitForUploadAccepted(client, expectedName, 10_000).catch(() => null);
      if (accepted) return;
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }

  await setFileInputFromBuffer(client, filePath);
  const accepted = await waitForUploadAccepted(client, expectedName, 15_000).catch(() => null);
  if (accepted) return;

  throw lastError || new Error(`File upload did not appear in page state for ${expectedName}.`);
}

const primaryFileInputSelector = 'label input[type="file"], input[type="file"]';

async function setFileInputViaChooser(client, filePath) {
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true }, 8_000);
  try {
    const chooserPromise = waitForEvent(client, "Page.fileChooserOpened", 8_000);
    const point = await evaluate(client, `(() => {
      const input = document.querySelector(${JSON.stringify(primaryFileInputSelector)});
      if (!input) return null;
      input.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = input.getBoundingClientRect();
      return {
        x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
        y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
      };
    })()`, 6_000);
    assert(point, "Could not find file input click point");
    await trustedClickAtPoint(client, point);
    const event = await chooserPromise;
    const backendNodeId = event.params?.backendNodeId;
    if (!backendNodeId) throw new Error("File chooser did not expose a backend node id");
    await client.send("DOM.setFileInputFiles", { files: [filePath], backendNodeId }, 8_000);
  } finally {
    await client.send("Page.setInterceptFileChooserDialog", { enabled: false }, 8_000).catch(() => {});
  }
}

async function queryFileInputNodeId(client, selector) {
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true }, 8_000);
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  }, 8_000);
  if (!nodeId) throw new Error("No file input found");
  return nodeId;
}

async function dispatchFileInputChange(client) {
  await evaluate(client, `(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`, 6_000);
}

async function setFileInputFromBuffer(client, filePath) {
  const file = {
    name: path.basename(filePath),
    type: fileMimeType(filePath),
    base64: (await fs.readFile(filePath)).toString("base64"),
  };
  const applied = await evaluate(client, `(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return { ok: false, reason: "missing input" };
    const binary = atob(${JSON.stringify(file.base64)});
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([bytes], ${JSON.stringify(file.name)}, { type: ${JSON.stringify(file.type)} }));
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  })()`, 12_000);
  if (!applied?.ok) {
    throw new Error(`Could not set file through browser DataTransfer: ${applied?.reason || "unknown"}`);
  }
}

async function waitForUploadAccepted(client, filename, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => {
      const body = document.body?.innerText || "";
      const buttons = Array.from(document.querySelectorAll("button"));
      const enabledConvert = buttons.some((button) => {
        const text = button.innerText || button.textContent || "";
        return !button.disabled && /^\\s*(Convert|Create)\\b/i.test(text);
      });
      const routeBusy = buttons.some((button) => {
        const text = button.innerText || button.textContent || "";
        return button.disabled && /\\b(Building|Converting|Running|Creating)\\b/i.test(text);
      });
      const outputCards = document.querySelectorAll("[data-output-stamp]").length;
      return {
        bodyHasName: body.includes(${JSON.stringify(filename)}),
        enabledConvert,
        routeBusy,
        outputCards,
      };
    })()`,
    timeoutMs,
    (value) => value?.enabledConvert || value?.routeBusy || value?.outputCards > 0,
  );
}

function fileMimeType(filePath) {
  if (/\.svg$/i.test(filePath)) return "image/svg+xml";
  if (/\.jpe?g$/i.test(filePath)) return "image/jpeg";
  if (/\.png$/i.test(filePath)) return "image/png";
  return "application/octet-stream";
}

async function clickConvertIfPresent(client) {
  await clickPageButton(client, [/^(Convert|Trace|Build|Create|Generate|Vectorize)\b/i]).catch(
    () => false,
  );
}

async function setTextareaInput(client, value) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector("textarea")))()`,
    15_000,
    Boolean,
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await evaluate(client, `(() => {
      const textarea = document.querySelector("textarea");
      if (!textarea) return false;
      textarea.focus();
      const previousValue = textarea.value;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) {
        setter.call(textarea, ${JSON.stringify(value)});
      } else {
        textarea.value = ${JSON.stringify(value)};
      }
      textarea._valueTracker?.setValue(previousValue);
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`, 10_000);
    const accepted = await waitForValue(
      client,
      () => `(() => {
        const textarea = document.querySelector("textarea");
        const buttons = Array.from(document.querySelectorAll("button"));
        const enabledConvert = buttons.some((button) => {
          const text = button.innerText || button.textContent || "";
          return !button.disabled && /^\\s*Convert to SVG\\s*$/i.test(text);
        });
        return { length: textarea?.value?.length || 0, enabledConvert };
      })()`,
      2_500,
      (state) => Number(state?.length || 0) > 0 && state?.enabledConvert,
    ).catch(() => null);
    if (accepted) return;
    await delay(500);
  }

  const point = await evaluate(client, `(() => {
    const textarea = document.querySelector("textarea");
    if (!textarea) return null;
    textarea.focus();
    textarea.select();
    const rect = textarea.getBoundingClientRect();
    return {
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + Math.min(24, rect.width / 2))),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + Math.min(24, rect.height / 2))),
    };
  })()`, 10_000);
  assert(point, "Could not focus code input textarea");
  await trustedClickAtPoint(client, point);
  await client.send("Input.insertText", { text: value }, 15_000);
  await waitForValue(
    client,
    () => `(() => {
      const textarea = document.querySelector("textarea");
      const buttons = Array.from(document.querySelectorAll("button"));
      const enabledConvert = buttons.some((button) => {
        const text = button.innerText || button.textContent || "";
        return !button.disabled && /^\\s*Convert to SVG\\s*$/i.test(text);
      });
      return { length: textarea?.value?.length || 0, enabledConvert };
    })()`,
    15_000,
    (state) => Number(state?.length || 0) > 0 && state?.enabledConvert,
  );
}

async function clickPageButton(client, patterns) {
  const target = await evaluate(client, `(() => {
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || "").trim();
      return !candidate.disabled && patterns.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    return {
      text: (button.innerText || button.textContent || "").trim(),
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
    };
  })()`, 8_000);
  assert(target, `Could not click page button: ${patterns.map((pattern) => pattern.source).join(", ")}`);
  await trustedClickAtPoint(client, target);
  await delay(300);
}

async function waitForCompletedOutput(client, timeoutMs) {
  return waitForValue(
    client,
    () => latestOutputStateExpression(),
    timeoutMs,
    (state) =>
      state?.cardCount >= 1 &&
      state?.previewSvg &&
      state?.jobStatus !== "queued" &&
      state?.jobStatus !== "running" &&
      state?.hasActionRow,
  );
}

async function readLatestOutputState(client) {
  return evaluate(client, latestOutputStateExpression(), 15_000);
}

async function waitForStableLatestOutput(client, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let previousSvg = "";
  let stableReads = 0;
  let lastState = null;
  while (Date.now() < deadline) {
    lastState = await readLatestOutputState(client);
    if (lastState?.previewSvg && lastState.previewSvg === previousSvg) {
      stableReads += 1;
      if (stableReads >= 2) return lastState;
    } else {
      previousSvg = lastState?.previewSvg || "";
      stableReads = previousSvg ? 1 : 0;
    }
    await delay(250);
  }
  if (lastState?.previewSvg) return lastState;
  throw new Error(`Timed out waiting for stable preview. Last: ${JSON.stringify(lastState)}`);
}

function latestOutputStateExpression() {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = cards.reduce((best, card) => {
      if (!best) return card;
      const a = Number(card.getAttribute("data-output-stamp") || 0);
      const b = Number(best.getAttribute("data-output-stamp") || 0);
      return a >= b ? card : best;
    }, null);
    const actionRow = latest?.querySelector("[data-output-action-row]");
    const img = latest ? Array.from(latest.querySelectorAll("img")).reverse().find((candidate) => String(candidate.getAttribute("src") || "").startsWith("data:image/svg+xml")) : null;
    const src = img?.getAttribute("src") || "";
    let previewSvg = "";
    if (src.startsWith("data:image/svg+xml")) {
      const comma = src.indexOf(",");
      const payload = comma >= 0 ? src.slice(comma + 1) : "";
      try { previewSvg = decodeURIComponent(payload); } catch { previewSvg = ""; }
    }
    return {
      href: location.href,
      pageTitle: document.title,
      cardCount: cards.length,
      latestStamp: latest ? Number(latest.getAttribute("data-output-stamp") || 0) : null,
      jobStatus: latest?.getAttribute("data-job-status") || "",
      title: latest ? (latest.innerText || latest.textContent || "").slice(0, 400) : "",
      hasActionRow: Boolean(actionRow),
      activeJobs: cards.filter((card) => {
        const status = card.getAttribute("data-job-status") || "";
        return status === "queued" || status === "running";
      }).length,
      exportLevel: actionRow?.getAttribute("data-export-compression-level") || "none",
      svgBytesAttr: latest?.getAttribute("data-svg-bytes") || "",
      fileInputCount: document.querySelectorAll('input[type="file"]').length,
      textareaLength: document.querySelector("textarea")?.value?.length || 0,
      convertButtons: Array.from(document.querySelectorAll("button"))
        .map((button) => ({
          text: (button.innerText || button.textContent || "").trim(),
          disabled: button.disabled,
        }))
        .filter((button) => /Convert|Create|Generate|Update preview/i.test(button.text))
        .slice(0, 8),
      uploadDebug: window.__CONVERTER_EXPORT_COMPRESSION__?.uploadDebug || null,
      bodySnippet: (document.body?.innerText || "").slice(0, 500),
      previewSvg,
      previewBytes: previewSvg ? new TextEncoder().encode(previewSvg).length : 0,
    };
  })()`;
}

async function openSettingsForLatestOutput(client) {
  await evaluate(client, `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = cards[cards.length - 1];
    const buttons = Array.from((latest || document).querySelectorAll("button"));
    const button = buttons.find((candidate) => /Settings\\s*\\/\\s*Edit/i.test(candidate.innerText || candidate.textContent || ""));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await waitForExportControl(client);
}

async function waitForExportControl(client) {
  return waitForValue(
    client,
    () => `(() => {
      const control = document.querySelector("[data-export-compression-control='true']");
      return {
        exists: Boolean(control),
        level: control?.getAttribute("data-export-compression-level") || "",
      };
    })()`,
    12_000,
    (state) => state?.exists,
  );
}

async function selectExportCompressionLevel(client, level) {
  await evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("[data-export-compression-level-option]"));
    const button = buttons.find((candidate) => candidate.getAttribute("data-export-compression-level-option") === ${JSON.stringify(level)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await waitForValue(
    client,
    () => `(() => document.querySelector("[data-export-compression-control='true']")?.getAttribute("data-export-compression-level") || "")()`,
    8_000,
    (value) => value === level,
  );
}

async function copyLatestOutput(client) {
  await installClipboardCapture(client);
  const before = await clipboardWriteCount(client);
  await clickLatestOutputButton(client, [/Copy SVG/i, /^Copy$/i]);
  return waitForValue(
    client,
    () => `(() => {
      const writes = window.__CONVERTER_EXPORT_COMPRESSION__?.clipboardWrites || [];
      return { count: writes.length, value: writes[writes.length - 1] || "" };
    })()`,
    8_000,
    (state) => state?.count > before && state.value.includes("<svg"),
  ).then((state) => state.value);
}

async function downloadLatestOutput(client) {
  await fs.rm(DOWNLOADS_DIR, { recursive: true, force: true });
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  await clickLatestOutputButton(client, [/Download.*SVG/i, /^Download$/i]);
  const file = await waitForDownloadedSvg(10_000);
  return fs.readFile(file, "utf8");
}

async function clickLatestOutputButton(client, patterns) {
  const target = await evaluate(client, `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = cards[cards.length - 1];
    if (!latest) return null;
    const buttons = Array.from(latest.querySelectorAll("button"));
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || "").trim();
      return !candidate.disabled && patterns.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    return {
      text: (button.innerText || button.textContent || "").trim(),
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
    };
  })()`);
  assert(target, `Could not click latest output button: ${patterns.map((pattern) => pattern.source).join(", ")}`);
  await trustedClickAtPoint(client, target);
}

async function clipboardWriteCount(client) {
  return evaluate(
    client,
    `(() => (window.__CONVERTER_EXPORT_COMPRESSION__?.clipboardWrites || []).length)()`,
    8_000,
  );
}

async function hasTiniestWarning(client) {
  return evaluate(
    client,
    `(() => Boolean(document.querySelector("[data-export-compression-warning='tiniest']")))()`,
    8_000,
  );
}

async function waitForDownloadedSvg(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await fs.readdir(DOWNLOADS_DIR).catch(() => []);
    const svg = last.find((file) => /\.svg$/i.test(file) && !/\.crdownload$/i.test(file));
    if (svg) return path.join(DOWNLOADS_DIR, svg);
    await delay(150);
  }
  throw new Error(`Timed out waiting for downloaded SVG. Files: ${last.join(", ")}`);
}

async function trustedClickAtPoint(client, point) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  }, 6_000);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, 6_000);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, 6_000);
}

function waitForEvent(client, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    timeout.unref?.();
    const unsubscribe = client.onEvent((message) => {
      if (message.method !== method) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(message);
    });
  });
}

function isParsableSvg(svg) {
  return /^(\uFEFF|\s)*<svg\b[\s\S]*<\/svg\s*>/i.test(String(svg || ""));
}

function rootGeometryMatches(before, after) {
  const a = readRootGeometry(before);
  const b = readRootGeometry(after);
  return rootGeometryObjectsMatch(a, b);
}

function rootGeometryObjectsMatch(a, b) {
  return a.width === b.width && a.height === b.height && a.viewBox === b.viewBox;
}

function rootGeometryCompatibleWithPreview(before, after) {
  const a = readRootGeometry(before);
  const b = readRootGeometry(after);
  if (a.viewBox && b.viewBox && a.viewBox !== b.viewBox) return false;
  if (a.width && b.width && a.width !== b.width) return false;
  if (a.height && b.height && a.height !== b.height) return false;
  return Boolean(b.viewBox || (b.width && b.height));
}

function readRootGeometry(svg) {
  const open = String(svg || "").match(/<svg\b[^>]*>/i)?.[0] || "";
  return {
    width: readAttr(open, "width"),
    height: readAttr(open, "height"),
    viewBox: readAttr(open, "viewBox"),
  };
}

function readAttr(tag, name) {
  return tag.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasLayerMetadata(svg) {
  return /\sdata-(?:layer|fill-layer|stroke-layer)-/i.test(String(svg || ""));
}

function byteSize(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function openTab(url) {
  const target = await createCdpTarget(url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  await client.send("Runtime.enable").catch(() => {});
  await client.send("Page.enable").catch(() => {});
  await waitForDocumentReady(client);
  return client;
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
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
      const targets = await cdpJson("/json/list");
      const target = targets.find((candidate) => candidate.id === targetId);
      if (target?.webSocketDebuggerUrl) return target;
      await delay(100);
    }
  }
  return cdpJson(`/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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
        const { resolve, reject, timeout } = this.pending.get(message.id);
        clearTimeout(timeout);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}, timeoutMs = 15_000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      timeout.unref?.();
      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(payload);
    });
  }

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

async function evaluate(client, expression, timeoutMs = 15_000) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, timeoutMs);
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        "Runtime evaluation failed",
    );
  }
  return response.result?.value;
}

async function waitForValue(client, expressionFactory, timeoutMs, predicate) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(
      client,
      typeof expressionFactory === "function" ? expressionFactory() : expressionFactory,
      8_000,
    ).catch((error) => ({ error: error.message }));
    if (predicate(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last: ${JSON.stringify(last)}`);
}

async function waitForDocumentReady(client) {
  return waitForValue(
    client,
    () => `(() => ({ readyState: document.readyState, title: document.title }))()`,
    30_000,
    (state) => state?.readyState === "interactive" || state?.readyState === "complete",
  );
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
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Could not find Chrome or Edge. Set CHROME_PATH to run the browser smoke.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
