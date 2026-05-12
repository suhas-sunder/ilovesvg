import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";
import { validateMeaningfulSvgOutput } from "./meaningful-output.mjs";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const routesDir = path.join(rootDir, "app", "routes");
const fullMode = process.env.STAGE1_FULL_PRESET_SMOKE === "1";
const maxPresetsPerRoute = fullMode
  ? Number.POSITIVE_INFINITY
  : Number(process.env.STAGE1_MAX_PRESETS_PER_ROUTE || 12);
const timeoutMs = Number(process.env.STAGE1_PRESET_TIMEOUT_MS || 30_000);
const routeFilter = String(process.env.STAGE1_ROUTE_FILTER || "").trim();
const presetFilter = String(process.env.STAGE1_PRESET_FILTER || "").trim();
const reportPath = process.env.STAGE1_REPORT_PATH
  ? path.resolve(rootDir, process.env.STAGE1_REPORT_PATH)
  : null;
const maxRetries = Number(process.env.STAGE1_MAX_RETRIES || 8);
const requestDelayMs = Number(process.env.STAGE1_REQUEST_DELAY_MS || 0);

const TRACE_DEFAULTS = {
  traceMode: "single",
  threshold: "224",
  turdSize: "2",
  optTolerance: "0.28",
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: "false",
  transparent: "true",
  bgColor: "#ffffff",
  preprocess: "none",
  blurSigma: "0",
  edgeBoost: "1",
  maxTraceSide: "384",
  removeColorTolerance: "18",
  brightness: "0",
  contrast: "0",
  outputWidth: "0",
  outputHeight: "0",
  preserveAspectRatio: "true",
};

const LAYER_DEFAULTS = {
  traceMode: "layered",
  colorLayerCount: "4",
  layerMaxTraceSide: "384",
  minRegionPercent: "0.35",
  layerOptTolerance: "0.45",
  layerTurdSize: "4",
  layerTurnPolicy: "majority",
  posterize: "true",
  posterizeStrength: "45",
  removeWhite: "false",
  removeTransparent: "true",
  colorMergeTolerance: "18",
  transparent: "true",
  bgColor: "#ffffff",
  outputWidth: "0",
  outputHeight: "0",
  preserveAspectRatio: "true",
};

const CENTERLINE_DEFAULTS = {
  traceMode: "centerline",
  strokeOutputMode: "centerline",
  threshold: "224",
  centerlineStrokeWidth: "2",
  centerlineSimplifyTolerance: "1.2",
  centerlineMaxTraceSide: "384",
  lineColor: "#000000",
  transparent: "true",
  bgColor: "#ffffff",
};

const TEXT_DEFAULTS = {
  text: "iLoveSVG",
  outputMode: "grouped",
  splitMode: "line",
  fontSource: "builtin",
  builtinFont: "roboto",
  fontSize: "96",
  lineHeight: "1.2",
  letterSpacing: "0",
  wordSpacing: "0",
  align: "center",
  fill: "#000000",
  stroke: "none",
  strokeWidth: "0",
  pad: "24",
  canvasMode: "auto",
  canvasW: "1024",
  canvasH: "1024",
  fit: "center",
  repeatPad: "40",
  bg: "transparent",
  bgColor: "#ffffff",
  wrapMode: "none",
  wrapWidth: "720",
};

const BASE64_DEFAULTS = {
  rasterMode: "layered",
  transparent: "true",
  bgColor: "#ffffff",
};

const CODE_DEFAULTS = {
  ...TRACE_DEFAULTS,
  traceMode: "single",
};

const KNOWN_REDIRECT_ROUTES = new Set([
  "/black-and-white-png-to-svg-converter",
  "/image-to-svg-converter",
  "/svg-code-cleaner",
  "/svg-inline-code-generator",
  "/svg-to-css-background",
  "/svg-to-data-uri-converter",
  "/svg-to-react-component",
  "/svg-transparent-background-tool",
  "/svg-viewbox-editor",
  "/tif-to-svg-converter",
]);

const ROUTE_GROUPS = {
  home: "raster-to-svg",
  "text-to-svg-converter": "text-svg",
  "emoji-to-svg-converter": "text-svg",
  "code-to-svg-for-cricut": "text-svg",
  "svg-to-base64": "base64",
  "base64-to-svg": "base64",
  "base64-to-svg-for-cricut": "base64",
};

const POTRACE_FIRST_PATTERN =
  /(line-art|black-and-white|scan|cricut|vinyl|laser|silhouette|drawing|sketch|photo-to-svg|image-to-svg-outline|logo-to-svg-converter|logo-to-svg-for-cricut|sticker-to-svg-for-cricut)/;

const routeMappings = await readRouteMappings();
const additions = await readPresetAdditions();
const fixtures = await createFixtures();
const inventory = [];
const results = [];
const failures = [];

for (const route of routeMappings) {
  if (route.path.startsWith("/api/") || KNOWN_REDIRECT_ROUTES.has(route.path)) continue;
  if (routeFilter && !route.path.includes(routeFilter)) continue;

  const sourceFile = path.join(routesDir, route.file);
  const source = await fs.readFile(sourceFile, "utf8");
  if (!hasAction(source) && !importsAction(source)) continue;

  const templateFile = resolveTemplateFile(route.file, source);
  const templateSource = await fs.readFile(path.join(routesDir, templateFile), "utf8");
  const presets = getDisplayPresets(templateSource, additions);
  if (presets.length === 0) continue;

  const routeGroup = classifyRoute(route.path, templateFile);
  const selectedPresets = selectPresetsForSmoke(
    presetFilter
      ? presets.filter((preset) => preset.id.includes(presetFilter) || preset.label.includes(presetFilter))
      : presets,
    maxPresetsPerRoute,
  );
  const routeEntry = {
    route: route.path,
    sourceFile: `app/routes/${route.file}`,
    templateFile: `app/routes/${templateFile}`,
    family: routeGroup,
    visiblePresetCount: presets.length,
    testedPresetCount: selectedPresets.length,
    fullPresetMode: fullMode,
    expectedPolicy: expectedPolicy(route.path, routeGroup),
  };
  inventory.push(routeEntry);

  for (const preset of selectedPresets) {
    const outcome = await runPresetSmoke(route.path, routeGroup, preset);
    results.push({
      ...routeEntry,
      presetId: preset.id,
      presetLabel: preset.label,
      presetCategory: preset.category || null,
      speed: preset.backendIntensity || null,
      ...outcome,
    });
    if (!outcome.ok) {
      failures.push(`${route.path} ${preset.id}: ${outcome.error}`);
    }
  }
}

const report = {
  baseUrl,
  checkedAt: new Date().toISOString(),
  fullPresetMode: fullMode,
  maxPresetsPerRoute: Number.isFinite(maxPresetsPerRoute) ? maxPresetsPerRoute : "all",
  routeFilter: routeFilter || null,
  presetFilter: presetFilter || null,
  routeCount: inventory.length,
  presetSmokeCount: results.length,
  inventory,
  results,
  failures,
};

if (reportPath) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(summarizeReport(report, reportPath), null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}

function summarizeReport(report, savedReportPath) {
  const byFamily = new Map();
  for (const route of report.inventory) {
    const current = byFamily.get(route.family) || {
      routes: 0,
      visiblePresets: 0,
      testedPresets: 0,
    };
    current.routes += 1;
    current.visiblePresets += route.visiblePresetCount;
    current.testedPresets += route.testedPresetCount;
    byFamily.set(route.family, current);
  }
  return {
    baseUrl: report.baseUrl,
    checkedAt: report.checkedAt,
    fullPresetMode: report.fullPresetMode,
    maxPresetsPerRoute: report.maxPresetsPerRoute,
    routeFilter: report.routeFilter,
    presetFilter: report.presetFilter,
    routeCount: report.routeCount,
    presetSmokeCount: report.presetSmokeCount,
    failureCount: report.failures.length,
    failureSample: report.failures.slice(0, 20),
    reportPath: savedReportPath,
    families: Object.fromEntries(byFamily),
  };
}

async function readRouteMappings() {
  const source = await fs.readFile(path.join(rootDir, "app", "routes.ts"), "utf8");
  const mappings = [{ path: "/", file: "home.tsx" }];
  const routeRegex = /route\(\s*"([^"]+)"\s*,\s*"routes\/([^"]+)"/g;
  for (const match of source.matchAll(routeRegex)) {
    mappings.push({ path: `/${match[1]}`, file: match[2] });
  }
  return mappings;
}

async function readPresetAdditions() {
  const source = await fs.readFile(
    path.join(rootDir, "app", "client", "lib", "converter", "presetAdditions.ts"),
    "utf8",
  );
  const arrays = readArrayVariables(source, [
    "TRACE_PRESET_ADDITIONS",
    "STROKE_TRACE_PRESET_ADDITIONS",
  ]);
  const trace = arrays.get("TRACE_PRESET_ADDITIONS") || [];
  const stroke = arrays.get("STROKE_TRACE_PRESET_ADDITIONS") || [];
  return {
    trace,
    stroke,
    layered: trace.filter((preset) => preset.settings?.traceMode === "layered"),
  };
}

function getDisplayPresets(source, addedPresets) {
  const arrays = readArrayVariables(source, ["PRESET_DEFINITIONS", "PRESETS", "DISPLAY_PRESETS"]);
  let local = arrays.get("PRESET_DEFINITIONS") || arrays.get("PRESETS") || [];
  let presets = arrays.get("DISPLAY_PRESETS") || local;

  if (/extendTracePresets/.test(source)) {
    presets = [
      ...local,
      ...addedPresets.trace,
      ...(/includeStrokePresets:\s*true/.test(source) ? addedPresets.stroke : []),
    ];
  } else if (/extendLayeredPresets/.test(source)) {
    presets = [...local, ...addedPresets.layered];
  } else if (/STROKE_TRACE_PRESET_ADDITIONS\.slice\(0,\s*6\)/.test(source)) {
    presets = [...local, ...addedPresets.stroke.slice(0, 6)];
  }

  return dedupePresets(presets).filter((preset) => preset.id && preset.label);
}

function readArrayVariables(source, names) {
  const result = new Map();
  const sourceFile = ts.createSourceFile("route.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const wanted = new Set(names);

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && wanted.has(node.name.text)) {
      const initializer = unwrapExpression(node.initializer);
      if (initializer && ts.isArrayLiteralExpression(initializer)) {
        result.set(node.name.text, initializer.elements.map(evaluateExpression).filter(Boolean));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

function evaluateExpression(node) {
  node = unwrapExpression(node);
  if (!node) return undefined;
  if (ts.isObjectLiteralExpression(node)) {
    const object = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyName(property.name);
      if (!key) continue;
      object[key] = evaluateExpression(property.initializer);
    }
    return object;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluateExpression);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return node.operator === ts.SyntaxKind.MinusToken ? -Number(node.operand.text) : Number(node.operand.text);
  }
  return undefined;
}

function unwrapExpression(node) {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isSatisfiesExpression?.(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isTypeAssertionExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function dedupePresets(presets) {
  const seen = new Set();
  const result = [];
  for (const preset of presets) {
    if (!preset?.id || seen.has(preset.id)) continue;
    seen.add(preset.id);
    result.push(preset);
  }
  return result;
}

function selectPresetsForSmoke(presets, maxCount) {
  if (!Number.isFinite(maxCount) || presets.length <= maxCount) return presets;
  const mustKeepCategories = ["lineart", "layered", "stroke", "logo", "photo-edge", "scan", "diagram"];
  const selected = [];
  for (const preset of presets) {
    if (selected.length >= maxCount) break;
    selected.push(preset);
  }
  for (const category of mustKeepCategories) {
    const candidate = presets.find((preset) => preset.category === category);
    if (candidate && !selected.some((preset) => preset.id === candidate.id)) {
      selected[selected.length - 1] = candidate;
    }
  }
  return dedupePresets(selected);
}

function hasAction(source) {
  return /export\s+(async\s+)?function\s+action\b|export\s+const\s+action\b/.test(source);
}

function importsAction(source) {
  return /import\s+Template,\s*\{\s*action\b/.test(source) || /export\s+\{\s*action\b/.test(source);
}

function resolveTemplateFile(routeFile, source) {
  const match = source.match(/import\s+Template(?:,\s*\{[^}]*\})?\s+from\s+"\.\/([^"]+)"/);
  if (!match) return routeFile;
  return `${match[1]}.tsx`;
}

function classifyRoute(routePath, templateFile) {
  const routeId = routePath === "/" ? "home" : routePath.slice(1);
  if (ROUTE_GROUPS[routeId]) return ROUTE_GROUPS[routeId];
  if (/layered/.test(routePath)) return "layered";
  if (/cricut|silhouette|laser|vinyl/.test(routePath)) return "cricut";
  if (/base64/.test(routePath)) return "base64";
  if (/text|emoji|code/.test(routePath)) return "text-svg";
  if (/to-svg/.test(routePath) || /svg-converter/.test(templateFile)) return "raster-to-svg";
  if (/svg-to-(png|jpg|jpeg|webp|pdf)|favicon|(?:^|-)ico(?:-|$)|resizer|cleaner|background|recolor|viewer|minifier|stroke-width|flip|dimensions|file-size|embed|jsx/.test(routePath)) {
    return "client-utility";
  }
  return "unknown";
}

function expectedPolicy(routePath, routeGroup) {
  if (routeGroup === "text-svg" || routeGroup === "base64" || routeGroup === "client-utility") return "utility";
  if (routeGroup === "layered") return "vtracer-or-potrace-layered";
  if (POTRACE_FIRST_PATTERN.test(routePath)) return "potrace-first";
  return "vtracer-capable";
}

function allowsWhiteOnlyOutput(preset) {
  const intent = `${preset?.id || ""} ${preset?.label || ""}`.toLowerCase();
  return /white[-\s]?on[-\s]?black|dark[-\s]?bg|dark\s+background|invert[-\s]?white/.test(intent);
}

async function runPresetSmoke(routePath, routeGroup, preset) {
  const routePathForPost = routePath === "/" ? "/_root.data?index" : `${routePath}.data`;
  const smokeIdentity = createSmokeIdentity(routePath, preset.id);
  const fields = fieldsForPreset(routeGroup, preset);
  let rateLimitedRetries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (requestDelayMs > 0) await sleep(requestDelayMs);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const form = await buildForm(routePath, routeGroup, preset);
      const response = await fetch(`${baseUrl}${routePathForPost}`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          Referer: `${baseUrl}${routePath}`,
          "User-Agent": smokeIdentity.userAgent,
          "X-Forwarded-For": smokeIdentity.forwardedFor,
        },
        body: form,
        signal: controller.signal,
      });
      const text = await response.text();
      if (response.status === 429 && attempt < maxRetries) {
        rateLimitedRetries += 1;
        clearTimeout(timeout);
        await sleep(readRetryAfterMs(response, text));
        continue;
      }

      const expectLayers = routeGroup === "layered" || fields.traceMode === "layered";
      const validation = validateMeaningfulSvgOutput(text, {
        allowWhiteOnly: allowsWhiteOnlyOutput(preset),
        expectLayers,
      });
      const svgPresent = Boolean(validation.svg);
      const drawablePresent = validation.stats.drawableCount > 0;
      const engineUsed = extractEngineUsed(text);
      const ok = response.ok && validation.ok;
      return {
        ok,
        status: response.status,
        routePath: routePathForPost,
        bytes: Buffer.byteLength(text),
        svgBytes: validation.stats.svgBytes,
        paths: validation.stats.pathCount,
        layerPathTags: validation.stats.layerPathTagsWithPaths,
        svgPresent,
        drawablePresent,
        engineUsed,
        rateLimitedRetries,
        error: ok
          ? null
          : `${response.status} ${validation.reasons.join("; ") || text.slice(0, 180)}`,
      };
    } catch (error) {
      return {
        ok: false,
        status: null,
        routePath: routePathForPost,
        bytes: 0,
        paths: 0,
        svgPresent: false,
        drawablePresent: false,
        engineUsed: null,
        rateLimitedRetries,
        error: error instanceof Error ? error.message : "request failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function createSmokeIdentity(routePath, presetId) {
  const hash = hashString(`${routePath}:${presetId}`);
  const third = 1 + (hash % 254);
  const fourth = 1 + (Math.floor(hash / 254) % 254);
  return {
    userAgent: `ilovesvg-stage1-preset-smoke/${hash.toString(16)}`,
    forwardedFor: `198.18.${third}.${fourth}`,
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readRetryAfterMs(response, text) {
  const headerSeconds = Number(response.headers.get("retry-after") || "");
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.ceil(headerSeconds * 1000) + 250;
  }
  const textMs = Number(text.match(/"retryAfterMs",?(\d+)/)?.[1] || text.match(/"retryAfterMs":(\d+)/)?.[1] || "");
  if (Number.isFinite(textMs) && textMs > 0) return Math.ceil(textMs) + 250;
  const seconds = Number(text.match(/try again in (\d+) second/i)?.[1] || "");
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000 + 250;
  return 12_000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function buildForm(routePath, routeGroup, preset) {
  const form = new FormData();
  const fields = fieldsForPreset(routeGroup, preset);

  if (routeGroup === "text-svg" && routePath === "/text-to-svg-converter") {
    for (const [key, value] of Object.entries({ ...TEXT_DEFAULTS, ...fields, presetId: preset.id })) {
      form.append(key, stringifyFormValue(value));
    }
    return form;
  }

  if (routeGroup === "base64") {
    const rasterDataUrl = `data:image/png;base64,${fixtures.png.toString("base64")}`;
    for (const [key, value] of Object.entries({ ...BASE64_DEFAULTS, ...fields, rasterDataUrl, presetId: preset.id })) {
      form.append(key, stringifyFormValue(value));
    }
    return form;
  }

  const fixture = fixtureForRoute(routePath, routeGroup);
  form.append("file", new File([fixture.buffer], fixture.fileName, { type: fixture.mimeType }));
  for (const [key, value] of Object.entries({ ...fields, presetId: preset.id })) {
    form.append(key, stringifyFormValue(value));
  }
  return form;
}

function fieldsForPreset(routeGroup, preset) {
  const settings = preset.settings || {};
  const traceMode = settings.traceMode || settings.strokeOutputMode || "single";
  if (traceMode === "centerline" || settings.strokeOutputMode === "centerline") {
    return { ...CENTERLINE_DEFAULTS, ...settings };
  }
  if (traceMode === "layered" || routeGroup === "layered") {
    return { ...LAYER_DEFAULTS, ...settings };
  }
  if (routeGroup === "text-svg") {
    return { ...TEXT_DEFAULTS, ...settings };
  }
  return { ...TRACE_DEFAULTS, ...settings };
}

function fixtureForRoute(routePath, routeGroup) {
  if (/sticker|print-then-cut/.test(routePath)) {
    return { buffer: fixtures.stickerPng, fileName: "stage1-sticker.png", mimeType: "image/png" };
  }
  if (/jpg|jpeg|photo/.test(routePath)) return { buffer: fixtures.jpg, fileName: "stage1.jpg", mimeType: "image/jpeg" };
  if (/webp/.test(routePath)) return { buffer: fixtures.webp, fileName: "stage1.webp", mimeType: "image/webp" };
  if (/gif/.test(routePath)) return { buffer: fixtures.gif, fileName: "stage1.gif", mimeType: "image/gif" };
  if (/avif/.test(routePath)) return { buffer: fixtures.avif, fileName: "stage1.avif", mimeType: "image/avif" };
  if (/tiff|tif/.test(routePath)) return { buffer: fixtures.tiff, fileName: "stage1.tiff", mimeType: "image/tiff" };
  if (/bmp/.test(routePath)) return { buffer: fixtures.bmp, fileName: "stage1.bmp", mimeType: "image/bmp" };
  if (routeGroup === "text-svg" && /code/.test(routePath)) return { buffer: fixtures.png, fileName: "stage1.png", mimeType: "image/png" };
  return { buffer: fixtures.png, fileName: "stage1.png", mimeType: "image/png" };
}

async function createFixtures() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" viewBox="0 0 128 96">
      <rect width="128" height="96" fill="white"/>
      <circle cx="38" cy="42" r="22" fill="#101827"/>
      <rect x="72" y="24" width="34" height="34" rx="7" fill="#0ea5e9"/>
      <path d="M16 78 C32 58, 48 86, 66 68 S104 74, 116 48" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const stickerSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
      <rect width="160" height="120" fill="none"/>
      <g fill="#111827">
        <circle cx="58" cy="58" r="28"/>
        <rect x="82" y="36" width="42" height="42" rx="10"/>
      </g>
      <path d="M34 90 C50 70, 72 98, 90 78 S124 86, 136 56" fill="none" stroke="#ef4444" stroke-width="8" stroke-linecap="round"/>
      <circle cx="106" cy="80" r="10" fill="#0ea5e9"/>
    </svg>
  `;
  return {
    png,
    stickerPng: await sharp(Buffer.from(stickerSvg)).png().toBuffer(),
    jpg: await sharp(png).jpeg({ quality: 92 }).toBuffer(),
    webp: await sharp(png).webp({ quality: 90 }).toBuffer(),
    gif: await sharp(png).gif().toBuffer(),
    avif: await sharp(png).avif({ quality: 70 }).toBuffer(),
    tiff: await sharp(png).tiff().toBuffer(),
    bmp: makeBmp(128, 96),
  };
}

function makeBmp(width, height) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = Buffer.alloc(fileSize);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelArraySize, 34);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = 54 + (height - 1 - y) * rowSize + x * 3;
      const inCircle = (x - 40) ** 2 + (y - 45) ** 2 < 24 ** 2;
      const inBox = x > 72 && x < 108 && y > 24 && y < 62;
      buffer[offset] = inCircle ? 30 : inBox ? 220 : 255;
      buffer[offset + 1] = inCircle ? 36 : inBox ? 140 : 255;
      buffer[offset + 2] = inCircle ? 48 : inBox ? 30 : 255;
    }
  }
  return buffer;
}

function stringifyFormValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

function extractEngineUsed(text) {
  return (
    text.match(/"engineUsed","(vtracer|potrace|centerline)"/)?.[1] ||
    text.match(/"engineUsed":"(vtracer|potrace|centerline)"/)?.[1] ||
    null
  );
}
