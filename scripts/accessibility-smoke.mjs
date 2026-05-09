import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9247);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-accessibility-smoke", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");

const REPRESENTATIVE_PAGES = [
  { path: "/", id: "home" },
  { path: "/png-to-svg-converter", id: "png-to-svg-converter" },
  { path: "/jpg-to-svg-converter", id: "jpg-to-svg-converter" },
  { path: "/jpeg-to-svg-converter", id: "jpeg-to-svg-converter" },
  { path: "/svg-to-png-converter", id: "svg-to-png-converter" },
  { path: "/line-art-to-svg-converter", id: "line-art-to-svg-converter" },
  { path: "/logo-to-svg-converter", id: "logo-to-svg-converter" },
  { path: "/photo-to-svg-outline", id: "photo-to-svg-outline" },
  { path: "/code-to-svg-for-cricut", id: "code-to-svg-for-cricut" },
  { path: "/base64-to-svg-for-cricut", id: "base64-to-svg-for-cricut" },
];

const STAGE_3_DOC_PAGES = [
  { path: "/svg-to-jsx-converter", id: "svg-to-jsx-converter" },
  { path: "/svg-background-editor", id: "svg-background-editor" },
];

const CONTROL_SELECTOR = [
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "button",
  "summary",
  "[role='button']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='slider']",
  "[role='tab']",
].join(", ");

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

  const pageResults = [];
  let codeOutput = null;
  let svgExport = null;
  try {
    await waitForCdp();

    for (const page of [...REPRESENTATIVE_PAGES, ...STAGE_3_DOC_PAGES]) {
      console.error(`[accessibility-smoke] ${page.path}`);
      const client = await openTab(`${baseUrl}${page.path}`);
      try {
        await configureViewport(client);
        await assertIloveSvgApp(client, page.path);
        await waitForInteractiveControls(client, page.path);
        await delay(750);
        await expandRepresentativeControls(client);
        const result = await collectControlAccessibility(client, page.id, page.path);
        const expectations = await expectNamedControls(client, getStaticExpectations(page.path));
        result.expectationFailures = expectations.failures;
        result.matchedExpectations = expectations.matches;
        result.ok = result.failures.length === 0 && expectations.failures.length === 0;
        pageResults.push(result);
        console.error(
          `[accessibility-smoke] ${page.path} -> ${result.ok ? "ok" : "failed"} (${result.namedCount}/${result.controlCount} named)`,
        );
      } finally {
        await client.close().catch(() => {});
      }
    }

    codeOutput = await runCodeOutputControlsSmoke();
    svgExport = await runSvgToPngControlsSmoke(fixtures.svg);
  } finally {
    browser.kill();
  }

  const report = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    pages: pageResults,
    outputStates: [codeOutput, svgExport].filter(Boolean),
  };

  console.log(JSON.stringify(report, null, 2));

  const failures = [
    ...pageResults.flatMap((result) => result.failures.map((failure) => ({ page: result.path, ...failure }))),
    ...pageResults.flatMap((result) =>
      (result.expectationFailures || []).map((failure) => ({ page: result.path, expectation: true, ...failure })),
    ),
    ...[codeOutput, svgExport].filter((result) => result && !result.ok),
  ];

  if (failures.length > 0) {
    process.exit(1);
  }
}

async function runCodeOutputControlsSmoke() {
  console.error("[accessibility-smoke] /code-to-svg-for-cricut output controls");
  const client = await openTab(`${baseUrl}/code-to-svg-for-cricut`);
  try {
    await configureViewport(client);
    await assertIloveSvgApp(client, "/code-to-svg-for-cricut");
    await waitForInteractiveControls(client, "/code-to-svg-for-cricut");
    await delay(750);
    await fillFirstTextarea(client, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#e0f2fe"/><path d="M24 76h72M36 48h48" stroke="#0f172a" stroke-width="10" stroke-linecap="round"/></svg>`);
    await waitForValue(
      client,
      () => `(() => Array.from(document.querySelectorAll("textarea")).some((textarea) => textarea.value.trim().length > 0))()`,
      8_000,
    );
    await clickButtonMatching(client, "/Convert to SVG/i");
    await waitForCodeOutput(client);
    await clickButtonIfPresent(client, "/Settings/i", { reject: "/Advanced/i" });
    await expandRepresentativeControls(client);
    const result = await collectControlAccessibility(client, "code-output-controls", "/code-to-svg-for-cricut");
    const expectations = await expectNamedControls(client, [
      { id: "copy", pattern: "Copy SVG", required: true },
      { id: "download", pattern: "Download SVG", required: true },
      { id: "settings-workspace", pattern: "Live Preview|Click To Convert|Update preview", required: true },
      { id: "fullscreen", pattern: "Fullscreen|full screen|Preview fullscreen", required: false },
    ]);
    return {
      ...result,
      id: "code-output-controls",
      ok: result.failures.length === 0 && expectations.failures.length === 0,
      expectationFailures: expectations.failures,
      matchedExpectations: expectations.matches,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function runSvgToPngControlsSmoke(fixturePath) {
  console.error("[accessibility-smoke] /svg-to-png-converter settings and export controls");
  const client = await openTab(`${baseUrl}/svg-to-png-converter`);
  try {
    await configureViewport(client);
    await assertIloveSvgApp(client, "/svg-to-png-converter");
    await waitForInteractiveControls(client, "/svg-to-png-converter");
    await delay(750);
    await setFileInput(client, fixturePath);
    await waitForText(client, path.basename(fixturePath), 8_000);
    await clickButtonMatching(client, "/Convert/i", { reject: "/batch|zip|download/i" });
    await waitForSvgToPngOutput(client);
    await clickButtonIfPresent(client, "/Settings/i", { reject: "/Advanced/i" });
    await expandRepresentativeControls(client);
    const result = await collectControlAccessibility(client, "svg-to-png-export-controls", "/svg-to-png-converter");
    const expectations = await expectNamedControls(client, [
      { id: "file-input", pattern: "Click or drag|Upload SVG", required: false },
      { id: "download-png", pattern: "Download PNG", required: true },
      { id: "settings", pattern: "Settings", required: true },
      { id: "fullscreen", pattern: "Fullscreen|full screen|Preview fullscreen", required: false },
    ]);
    return {
      ...result,
      id: "svg-to-png-export-controls",
      ok: result.failures.length === 0 && expectations.failures.length === 0,
      expectationFailures: expectations.failures,
      matchedExpectations: expectations.matches,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function collectControlAccessibility(client, id, pathName, options = {}) {
  await client.send("DOM.enable").catch(() => {});
  await client.send("Accessibility.enable").catch(() => {});
  const domControls = await getVisibleDomControlsWithRetry(client);
  const controlResults = [];
  const failures = [];

  for (const control of domControls) {
    const ax = await client.send("Accessibility.getPartialAXTree", {
      backendNodeId: control.backendNodeId,
      fetchRelatives: false,
    }).catch((error) => ({ error }));
    const axNode = selectControlAxNode(ax.nodes || []);
    const role = propertyValue(axNode?.role);
    const name = propertyValue(axNode?.name).trim();
    const ignored = Boolean(axNode?.ignored);
    const result = {
      index: control.index,
      tagName: control.tagName,
      type: control.type,
      domText: control.text.slice(0, 120),
      role,
      name,
        disabled: control.disabled,
        ariaHidden: control.ariaHidden,
        ignored,
        selector: control.selector,
      };
    controlResults.push(result);
    if (!ignored && !name) {
      failures.push({
        tagName: control.tagName,
        type: control.type,
        role,
        selector: control.selector,
        attrs: control.attrs,
        domText: control.text.slice(0, 160),
      });
    }
  }

  return {
    id,
    path: pathName,
    controlCount: controlResults.length,
    namedCount: controlResults.filter((control) => control.name).length,
    failures,
    controls: options.includeAllControls ? controlResults : controlResults.slice(0, Number(process.env.ACCESSIBILITY_CONTROL_LIMIT || 6)),
    omittedControlCount: options.includeAllControls
      ? 0
      : Math.max(0, controlResults.length - Number(process.env.ACCESSIBILITY_CONTROL_LIMIT || 6)),
  };
}

async function getVisibleDomControlsWithRetry(client) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getVisibleDomControls(client);
    } catch (error) {
      lastError = error;
      if (!/could not find node|no node with given id|cannot find context/i.test(String(error?.message || error))) {
        throw error;
      }
      await delay(300);
    }
  }
  throw lastError;
}

async function getVisibleDomControls(client) {
  const details = await evaluate(client, `(() => {
    const selector = ${JSON.stringify(CONTROL_SELECTOR)};
    for (const old of document.querySelectorAll("[data-a11y-smoke-id]")) {
      old.removeAttribute("data-a11y-smoke-id");
    }
    const controls = Array.from(document.querySelectorAll(selector));
    let smokeId = 0;
    return controls.map((control, index) => {
      const rect = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      const attrs = {};
      for (const attr of control.getAttributeNames()) attrs[attr] = control.getAttribute(attr);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden";
      const include =
        visible &&
        !control.hidden &&
        !control.closest("[hidden]") &&
        control.getAttribute("aria-hidden") !== "true" &&
        control.closest("[aria-hidden='true']") === null &&
        (control.getAttribute("type") || "").toLowerCase() !== "hidden";
      const assignedSmokeId = include ? String(smokeId++) : "";
      if (assignedSmokeId) control.setAttribute("data-a11y-smoke-id", assignedSmokeId);
      return {
        index,
        smokeId: assignedSmokeId,
        tagName: control.tagName.toLowerCase(),
        type: (control.getAttribute("type") || "").toLowerCase(),
        text: (control.innerText || control.textContent || control.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
        disabled: Boolean(control.disabled || control.getAttribute("aria-disabled") === "true"),
        ariaHidden: control.getAttribute("aria-hidden") === "true" || control.closest("[aria-hidden='true']") !== null,
        hidden: Boolean(control.hidden || control.closest("[hidden]")),
        visible,
        selector: control.tagName.toLowerCase()
          + (control.id ? "#" + control.id : "")
          + (control.getAttribute("name") ? "[name=\\"" + control.getAttribute("name") + "\\"]" : ""),
        attrs,
      };
    }).filter((control) =>
      control.visible &&
      !control.hidden &&
      !control.ariaHidden &&
      control.type !== "hidden"
    );
  })()`);

  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const visibleControls = [];
  for (const control of details) {
    if (!control.smokeId) continue;
    const { nodeId } = await client.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: `[data-a11y-smoke-id="${control.smokeId}"]`,
    });
    if (!nodeId) throw new Error(`Could not find node with smoke id ${control.smokeId}`);
    const { node } = await client.send("DOM.describeNode", { nodeId });
    visibleControls.push({
      ...control,
      nodeId,
      backendNodeId: node.backendNodeId,
    });
  }
  return visibleControls;
}

function selectControlAxNode(nodes) {
  const candidates = nodes.filter((node) => !node.ignored);
  return (
    candidates.find((node) => isControlRole(propertyValue(node.role))) ||
    candidates.find((node) => propertyValue(node.name).trim()) ||
    candidates[0] ||
    nodes[0] ||
    null
  );
}

function isControlRole(role) {
  return /button|checkbox|colorwell|combobox|disclosure ?triangle|link|menu item|radio|searchbox|slider|spinbutton|switch|tab|text ?field|textbox/i.test(role || "");
}

function propertyValue(property) {
  if (!property) return "";
  if (typeof property.value === "string") return property.value;
  if (property.value == null) return "";
  return String(property.value);
}

async function expectNamedControls(client, expectations) {
  const controls = await getNamedControls(client);
  const failures = [];
  const matches = {};
  for (const expectation of expectations) {
    const pattern = new RegExp(expectation.pattern, "i");
    const match = controls.find((control) => pattern.test(control.name) || pattern.test(control.text));
    if (match) {
      matches[expectation.id] = { name: match.name, text: match.text, role: match.role };
    } else if (expectation.required) {
      failures.push({ id: expectation.id, pattern: expectation.pattern });
    }
  }
  return { failures, matches };
}

async function getNamedControls(client) {
  const result = await collectControlAccessibility(
    client,
    "named-control-scan",
    locationPathExpressionPlaceholder(),
    { includeAllControls: true },
  );
  return result.controls.filter((control) => control.name);
}

function locationPathExpressionPlaceholder() {
  return "current-page";
}

function getStaticExpectations(pathName) {
  const fileRoutes = new Set([
    "/",
    "/png-to-svg-converter",
    "/jpg-to-svg-converter",
    "/jpeg-to-svg-converter",
    "/svg-to-png-converter",
    "/line-art-to-svg-converter",
    "/logo-to-svg-converter",
    "/photo-to-svg-outline",
    "/svg-to-jsx-converter",
    "/svg-background-editor",
  ]);
  const presetRoutes = new Set([
    "/",
    "/png-to-svg-converter",
    "/jpg-to-svg-converter",
    "/jpeg-to-svg-converter",
    "/line-art-to-svg-converter",
    "/logo-to-svg-converter",
    "/photo-to-svg-outline",
    "/code-to-svg-for-cricut",
    "/base64-to-svg-for-cricut",
  ]);
  const expectations = [];
  if (fileRoutes.has(pathName)) {
    expectations.push({ id: "file-input", pattern: "Click or drag|Upload SVG", required: true });
  }
  if (presetRoutes.has(pathName)) {
    expectations.push({ id: "preset-pin", pattern: "Pin preset|Unpin preset", required: true });
  }
  if (pathName === "/svg-to-png-converter" || pathName === "/code-to-svg-for-cricut" || pathName === "/base64-to-svg-for-cricut") {
    expectations.push({ id: "settings", pattern: "Settings", required: true });
  }
  return expectations;
}

async function expandRepresentativeControls(client) {
  await evaluate(client, `(() => {
    const click = (control) => {
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
        control.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      control.click();
    };

    const safeButtonPattern = /^(Show \\d+ more presets|Settings|Advanced settings|Live preview|Click to convert|Trace detail|Edges and cleanup|Appearance|Output geometry|SVG\\/raster export|Size|Background|Color|Cleanup|Export|Format|Quality|Layers?)\\b/i;
    for (const control of Array.from(document.querySelectorAll("summary"))) {
      const rect = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
        const parent = control.closest("details");
        if (parent && !parent.open) click(control);
      }
    }
    for (const button of Array.from(document.querySelectorAll("button[aria-expanded='false']"))) {
      const text = (button.innerText || button.getAttribute("aria-label") || "").trim();
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      if (visible && !button.disabled && safeButtonPattern.test(text) && !/Convert|Copy|Download|Reset|Remove|Clear|Pin|Unpin/i.test(text)) {
        click(button);
      }
    }
    const showMore = Array.from(document.querySelectorAll("button")).find((button) => /^Show \\d+ more presets/i.test(button.innerText || ""));
    if (showMore && !showMore.disabled) click(showMore);
    return true;
  })()`);
  await delay(250);
}

async function assertIloveSvgApp(client, pathName) {
  const state = await evaluate(client, `(() => ({
    href: location.href,
    title: document.title,
    canonical: document.querySelector("link[rel='canonical']")?.href || "",
    ogUrl: document.querySelector("meta[property='og:url']")?.content || "",
    bodyText: (document.body?.innerText || "").slice(0, 1500),
  }))()`);
  if (!state.href.startsWith(baseUrl)) {
    throw new Error(`Unexpected URL for ${pathName}: ${state.href}`);
  }
  const identityText = `${state.title}\n${state.canonical}\n${state.ogUrl}\n${state.bodyText}`;
  if (!/iLoveSVG|ilovesvg\.com/i.test(identityText)) {
    throw new Error(`localhost target for ${pathName} does not look like iLoveSVG. Title: ${state.title}`);
  }
}

async function configureViewport(client) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  }).catch(() => {});
}

async function waitForInteractiveControls(client, pathName) {
  const fileUploadRoutes = new Set([
    "/",
    "/png-to-svg-converter",
    "/jpg-to-svg-converter",
    "/jpeg-to-svg-converter",
    "/svg-to-png-converter",
    "/line-art-to-svg-converter",
    "/logo-to-svg-converter",
    "/photo-to-svg-outline",
    "/svg-to-jsx-converter",
    "/svg-background-editor",
  ]);
  return waitForValue(
    client,
    () => `(() => {
      const controls = Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)})).filter((control) => {
        const rect = control.getBoundingClientRect();
        const style = getComputedStyle(control);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
      return {
        readyState: document.readyState,
        controlCount: controls.length,
        fileInputs: document.querySelectorAll("input[type='file']").length,
        bodyText: (document.body?.innerText || "").slice(0, 300),
      };
    })()`,
    10_000,
    (state) =>
      (state?.readyState === "interactive" || state?.readyState === "complete") &&
      state.controlCount >= 8 &&
      (!fileUploadRoutes.has(pathName) || state.fileInputs > 0),
  );
}

async function setFileInput(client, filePath) {
  await client.send("DOM.enable").catch(() => {});
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "input[type='file']",
  });
  if (!nodeId) throw new Error("No file input found on page.");
  await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  const expectedName = path.basename(filePath);
  await evaluate(client, `(() => {
    const input = document.querySelector("input[type='file']");
    if (!input) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return Array.from(input.files || []).map((file) => file.name);
  })()`);
  const attached = await waitForValue(
    client,
    () => `(() => {
      const input = document.querySelector("input[type='file']");
      const files = input ? Array.from(input.files || []).map((file) => file.name) : [];
      const body = document.body?.innerText || "";
      return {
        files,
        bodyHasName: body.includes(${JSON.stringify(expectedName)}),
      };
    })()`,
    2_000,
    (state) => state?.files?.includes(expectedName) || state?.bodyHasName,
  ).catch(() => null);
  if (attached) return;
  const file = {
    name: expectedName,
    type: mimeTypeForPath(filePath),
    base64: (await fs.readFile(filePath)).toString("base64"),
  };
  const fallback = await evaluate(client, `(() => {
    const input = document.querySelector("input[type='file']");
    if (!input) return { ok: false, reason: "missing input" };
    const item = ${JSON.stringify(file)};
    const binary = atob(item.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], item.name, { type: item.type }));
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, files: Array.from(input.files || []).map((selected) => selected.name) };
  })()`);
  if (!fallback?.ok) throw new Error(`Could not attach file through browser fallback: ${fallback?.reason || "unknown"}`);
}

async function fillFirstTextarea(client, value) {
  const applied = await evaluate(client, `(() => {
    const textarea = document.querySelector("textarea");
    if (!textarea) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (setter) {
      setter.call(textarea, ${JSON.stringify(value)});
    } else {
      textarea.value = ${JSON.stringify(value)};
    }
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${JSON.stringify(value)} }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return textarea.value;
  })()`);
  if (!applied) throw new Error("Could not fill textarea for accessibility smoke.");
}

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function clickButtonMatching(client, patternSource, options = {}) {
  const clicked = await clickButtonIfPresent(client, patternSource, options);
  if (!clicked) throw new Error(`No enabled button matched ${patternSource}.`);
  return clicked;
}

async function clickButtonIfPresent(client, patternSource, options = {}) {
  return evaluate(client, `(() => {
    const pattern = ${patternSource};
    const reject = ${options.reject || "null"};
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], summary"));
    const target = buttons.find((candidate) => {
      const text = candidate.innerText || candidate.getAttribute("aria-label") || "";
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      return visible && !candidate.disabled && pattern.test(text) && !(reject && reject.test(text));
    });
    if (!target) return null;
    const label = target.innerText.trim() || target.getAttribute("aria-label") || "";
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    target.click();
    return label;
  })()`);
}

async function waitForRasterOutput(client, timeoutMs) {
  const state = await waitForValue(
    client,
    () => `(() => {
      const body = document.body.innerText || "";
      const output = document.querySelector("[data-engine-used]");
      const namedControls = Array.from(document.querySelectorAll("button, [role='button']"))
        .map((control) => ((control.innerText || "") + " " + (control.getAttribute("aria-label") || "")).trim());
      return {
        hasOutput: Boolean(output),
        hasDownload: namedControls.some((name) => /Download/i.test(name)),
        controlNames: namedControls,
        genericFailure: /Conversion failed\\. Please try a smaller image or adjust the output settings\\./i.test(body),
      };
    })()`,
    timeoutMs,
    (value) => value?.genericFailure || (value?.hasOutput && value?.hasDownload),
  );
  if (state.genericFailure) throw new Error("Raster conversion failed before accessibility output check.");
  return state;
}

async function waitForCodeOutput(client) {
  const state = await waitForValue(
    client,
    () => `(() => {
      const namedControls = Array.from(document.querySelectorAll("button, [role='button']"))
        .map((control) => ((control.innerText || "") + " " + (control.getAttribute("aria-label") || "")).trim());
      const body = document.body.innerText || "";
      return {
        hasCopy: namedControls.some((name) => /Copy SVG/i.test(name)),
        hasDownload: namedControls.some((name) => /Download SVG/i.test(name)),
        hasFullscreen: namedControls.some((name) => /full ?screen/i.test(name)),
        hasError: /Could not process|No extractable|Conversion failed/i.test(body),
        controlNames: namedControls,
      };
    })()`,
    30_000,
    (value) => value?.hasError || (value?.hasCopy && value?.hasDownload),
  );
  if (state.hasError) throw new Error("Code to SVG sample conversion failed before accessibility output check.");
  return state;
}

async function waitForSvgToPngOutput(client) {
  const state = await waitForValue(
    client,
    () => `(() => {
      const body = document.body.innerText || "";
      const downloadButton = Array.from(document.querySelectorAll("button")).find((button) => /Download PNG/i.test(button.innerText || ""));
      const preview = Array.from(document.querySelectorAll("img")).find((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      return {
        hasDownload: Boolean(downloadButton && !downloadButton.disabled),
        previewDecoded: Boolean(preview),
        genericFailure: /Conversion failed|Export failed|Invalid/i.test(body),
      };
    })()`,
    60_000,
    (value) => value?.genericFailure || (value?.hasDownload && value?.previewDecoded),
  );
  if (state.genericFailure) throw new Error("SVG to PNG conversion failed before accessibility output check.");
  return state;
}

async function waitForText(client, text, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => (document.body.innerText || "").includes(${JSON.stringify(text)}))()`,
    timeoutMs,
  );
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
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.bringToFront").catch(() => {});
  await ensureTabAtUrl(client, url);
  return client;
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

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
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
      // Fall through to the legacy endpoint.
    }
  }

  return cdpJson(`/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
}

async function ensureTabAtUrl(client, url) {
  const current = await evaluate(client, `(() => location.href)()`).catch(() => "");
  if (current !== url) {
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

async function waitForCdp() {
  const deadline = Date.now() + 10_000;
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" fill="#fff"/><circle cx="72" cy="78" r="38" fill="#0ea5e9"/><rect x="118" y="36" width="72" height="72" rx="14" fill="#f97316"/><path d="M32 132 C58 102, 94 150, 126 118 S190 126, 210 78" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/><text x="28" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#111827">Accessibility smoke</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const files = {
    svg: path.join(fixturesDir, "accessibility-smoke.svg"),
    png: path.join(fixturesDir, "accessibility-smoke.png"),
  };
  await fs.writeFile(files.svg, svg);
  await fs.writeFile(files.png, png);
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
  throw new Error("No Chromium-family browser executable found for accessibility smoke testing.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
