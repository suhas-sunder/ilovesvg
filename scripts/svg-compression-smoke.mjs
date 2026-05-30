import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

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
  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString(
    "base64",
  )}`;
  return import(dataUrl);
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

console.log(
  JSON.stringify(
    {
      ok: true,
      samples: 2,
      noneBytes: none.outputBytes,
      tinySavingsPercent: tiny.savedPercent,
      tiniestSavingsPercent: tiniest.savedPercent,
      tinyPreservedLayerMetadata: true,
      tiniestRemovedExportMetadata: true,
      referencedDefsPreserved: true,
    },
    null,
    2,
  ),
);
