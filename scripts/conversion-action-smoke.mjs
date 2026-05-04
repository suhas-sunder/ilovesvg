import { promises as fs } from "node:fs";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const exactRegressionPath =
  process.env.REGRESSION_PNG_PATH ||
  "C:/Users/Suhas/Downloads/iCloud Photos (1)/iCloud Photos/IMG_8487.PNG";

const regressionPng = await loadRegressionPng();
const regressionMeta = await sharp(regressionPng).metadata();
const regressionJpg = await sharp(regressionPng).jpeg({ quality: 92 }).toBuffer();
const regressionWebp = await sharp(regressionPng).webp({ quality: 90 }).toBuffer();
const basicPng = await makePng();

const results = [];

results.push(
  await expectSvgResponse({
    route: "/",
    fileName: "IMG_8487.PNG",
    mimeType: "image/png",
    buffer: regressionPng,
    fields: lineartAccurateFields({
      clientRunId: `regression-home-${Date.now()}`,
      maxTraceSide: "3000",
    }),
    expectEngineUsed: true,
    expectedEngine: "potrace",
    expectedWidth: regressionMeta.width,
    expectedHeight: regressionMeta.height,
    label: "exact-regression-home-lineart-accurate",
  }),
);

results.push(
  await expectBatchSvgResponse({
    fileName: "IMG_8487.PNG",
    mimeType: "image/png",
    buffer: regressionPng,
    fields: lineartAccurateFields({
      intent: "batch-file",
      batchSessionId: `batch-smoke-${Date.now()}`,
      batchIndex: "0",
      maxTraceSide: "900",
    }),
    expectedWidth: regressionMeta.width,
    expectedHeight: regressionMeta.height,
    label: "exact-regression-batch-api-engine-metadata",
  }),
);

for (const route of [
  "/png-to-svg-converter",
  "/image-to-svg-for-cricut",
  "/png-to-svg-for-cricut",
  "/line-art-to-svg-converter",
  "/line-art-to-svg-for-cricut",
  "/logo-to-svg-converter",
  "/logo-to-svg-for-cricut",
  "/scan-to-svg-converter",
  "/black-and-white-image-to-svg-converter",
  "/black-and-white-image-to-svg-for-cricut",
  "/drawing-to-svg-converter",
  "/drawing-to-svg-for-cricut",
  "/sketch-to-svg-converter",
  "/sketch-to-svg-for-cricut",
  "/photo-to-svg-outline",
  "/photo-to-svg-for-cricut",
  "/image-to-svg-outline",
  "/sticker-to-svg-converter",
  "/sticker-to-svg-for-cricut",
  "/icon-to-svg-converter",
  "/cricut-svg-converter",
  "/png-to-svg-for-cricut-stickers",
  "/png-to-svg-for-cricut-vinyl",
  "/png-to-svg-for-etsy",
  "/png-to-svg-for-laser-cutting",
  "/png-to-svg-for-silhouette",
]) {
  results.push(
    await expectSvgResponse({
      route,
      fileName: "IMG_8487.PNG",
      mimeType: "image/png",
      buffer: regressionPng,
      fields: lineartAccurateFields({
        preprocess:
          route.includes("photo") || route.includes("scan") ? "edge" : "none",
        maxTraceSide: "3000",
      }),
      expectedWidth: regressionMeta.width,
      expectedHeight: regressionMeta.height,
      label: `exact-regression-${route}`,
    }),
  );
}

for (const { route, fileName, mimeType, buffer } of [
  {
    route: "/jpg-to-svg-converter",
    fileName: "IMG_8487.jpg",
    mimeType: "image/jpeg",
    buffer: regressionJpg,
  },
  {
    route: "/jpeg-to-svg-converter",
    fileName: "IMG_8487.jpeg",
    mimeType: "image/jpeg",
    buffer: regressionJpg,
  },
  {
    route: "/jpg-to-svg-for-cricut",
    fileName: "IMG_8487.jpg",
    mimeType: "image/jpeg",
    buffer: regressionJpg,
  },
  {
    route: "/jpeg-to-svg-for-cricut",
    fileName: "IMG_8487.jpeg",
    mimeType: "image/jpeg",
    buffer: regressionJpg,
  },
  {
    route: "/webp-to-svg-converter",
    fileName: "IMG_8487.webp",
    mimeType: "image/webp",
    buffer: regressionWebp,
  },
  {
    route: "/webp-to-svg-for-cricut",
    fileName: "IMG_8487.webp",
    mimeType: "image/webp",
    buffer: regressionWebp,
  },
]) {
  results.push(
    await expectSvgResponse({
      route,
      fileName,
      mimeType,
      buffer,
      fields: lineartAccurateFields({ maxTraceSide: "3000" }),
      expectedWidth: regressionMeta.width,
      expectedHeight: regressionMeta.height,
      label: `exact-regression-${route}`,
    }),
  );
}

for (const route of [
  "/image-to-layered-svg-for-cricut",
  "/png-to-layered-svg-for-cricut",
  "/jpg-to-layered-svg-for-cricut",
  "/logo-to-layered-svg-for-cricut",
]) {
  const isJpg = route.includes("/jpg-");
  results.push(
    await expectSvgResponse({
      route,
      fileName: isJpg ? "IMG_8487.jpg" : "IMG_8487.PNG",
      mimeType: isJpg ? "image/jpeg" : "image/png",
      buffer: isJpg ? regressionJpg : regressionPng,
      fields: layeredFields({
        layerMaxTraceSide: "900",
        colorLayerCount: "4",
      }),
      expectLayers: true,
      expectedWidth: regressionMeta.width,
      expectedHeight: regressionMeta.height,
      label: `exact-regression-layered-${route}`,
    }),
  );
}

results.push(
  await expectSvgResponse({
    route: "/",
    fileName: "smoke-layered.png",
    mimeType: "image/png",
    buffer: basicPng,
    fields: layeredFields({
      clientRunId: `smoke-home-layered-${Date.now()}`,
      presetId: "layered-color",
      layerMaxTraceSide: "512",
    }),
    expectEngineUsed: true,
    expectLayers: true,
    label: "home-layered-metadata",
  }),
);

results.push(await expectInvalidUpload());

console.log(
  JSON.stringify(
    {
      baseUrl,
      checkedAt: new Date().toISOString(),
      regressionFixture: {
        exactPathUsed: await fileExists(exactRegressionPath),
        width: regressionMeta.width,
        height: regressionMeta.height,
        bytes: regressionPng.byteLength,
      },
      results,
    },
    null,
    2,
  ),
);

async function expectSvgResponse({
  route,
  fileName,
  mimeType,
  buffer,
  fields,
  expectEngineUsed = true,
  expectedEngine = null,
  expectLayers = false,
  expectedWidth = null,
  expectedHeight = null,
  label,
}) {
  const form = new FormData();
  form.append("file", new File([buffer], fileName, { type: mimeType }));
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  const routePath = dataRoute(route);
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: sameOriginHeaders(routePath),
    body: form,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!/<svg\b/i.test(text)) {
    throw new Error(`${route} did not return SVG output.`);
  }
  if (!/<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image|use)\b/i.test(text)) {
    throw new Error(`${route} returned SVG with no drawable content.`);
  }
  if (/<script\b|on\w+=|javascript:/i.test(text)) {
    throw new Error(`${route} returned unsafe SVG text.`);
  }
  if (expectedWidth && !text.includes(`viewBox=\\\"0 0 ${expectedWidth} ${expectedHeight}\\\"`)) {
    throw new Error(`${route} did not preserve expected ${expectedWidth}x${expectedHeight} dimensions.`);
  }

  const engineUsed = extractEngineUsed(text);
  if (expectEngineUsed && !engineUsed) {
    throw new Error(`${route} did not include engineUsed in the normalized response.`);
  }
  if (expectedEngine && engineUsed !== expectedEngine) {
    throw new Error(`${route} used ${engineUsed || "unknown engine"} instead of ${expectedEngine}.`);
  }
  if (expectLayers && !/"layers"/.test(text)) {
    throw new Error(`${route} did not include layered metadata.`);
  }

  return {
    label,
    route,
    routePath,
    status: response.status,
    bytes: Buffer.byteLength(text),
    paths: (text.match(/<path\b/gi) || []).length,
    layersMentioned: /"layers"/.test(text),
    engineUsed,
  };
}

async function expectInvalidUpload() {
  const route = "/png-to-svg-converter";
  const form = new FormData();
  form.append(
    "file",
    new File([Buffer.from("not really a png")], "fake.png", {
      type: "image/png",
    }),
  );
  const routePath = dataRoute(route);
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: sameOriginHeaders(routePath),
    body: form,
  });
  const text = await response.text();
  if (response.status < 400) {
    throw new Error(`${route} accepted an invalid image upload.`);
  }
  return {
    route,
    routePath,
    status: response.status,
    rejectedInvalidUpload: true,
    message: text.slice(0, 120),
  };
}

async function expectBatchSvgResponse({
  fileName,
  mimeType,
  buffer,
  fields,
  expectedWidth = null,
  expectedHeight = null,
  label,
}) {
  const form = new FormData();
  form.append("file", new File([buffer], fileName, { type: mimeType }));
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  const routePath = "/api/batch-svg";
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: sameOriginHeaders(routePath),
    body: form,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${routePath} returned ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!/<svg\b/i.test(text)) {
    throw new Error(`${routePath} did not return SVG output.`);
  }
  if (expectedWidth && !text.includes(`viewBox=\\\"0 0 ${expectedWidth} ${expectedHeight}\\\"`)) {
    throw new Error(`${routePath} did not preserve expected ${expectedWidth}x${expectedHeight} dimensions.`);
  }
  const engineUsed = extractEngineUsed(text);
  if (!engineUsed) {
    throw new Error(`${routePath} did not include engineUsed in the batch response.`);
  }

  return {
    label,
    route: "/api/batch-svg",
    routePath,
    status: response.status,
    bytes: Buffer.byteLength(text),
    paths: (text.match(/<path\b/gi) || []).length,
    layersMentioned: /"layers"/.test(text),
    engineUsed,
    batch: true,
  };
}

function lineartAccurateFields(overrides = {}) {
  return {
    presetId: "line-accurate",
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
    edgeBoost: "0",
    maxTraceSide: "900",
    removeColorTolerance: "18",
    brightness: "0",
    contrast: "0",
    outputWidth: "0",
    outputHeight: "0",
    preserveAspectRatio: "true",
    ...overrides,
  };
}

function layeredFields(overrides = {}) {
  return {
    presetId: "layered-color",
    traceMode: "layered",
    colorLayerCount: "4",
    layerMaxTraceSide: "900",
    transparent: "true",
    bgColor: "#ffffff",
    removeWhite: "false",
    removeTransparent: "true",
    removeColorTolerance: "18",
    colorMergeTolerance: "18",
    posterize: "true",
    posterizeStrength: "45",
    outputWidth: "0",
    outputHeight: "0",
    preserveAspectRatio: "true",
    ...overrides,
  };
}

function sameOriginHeaders(route) {
  return {
    Origin: baseUrl,
    Referer: `${baseUrl}${route}`,
  };
}

function dataRoute(route) {
  return route === "/" ? "/_root.data?index" : `${route}.data`;
}

function extractEngineUsed(text) {
  return (
    text.match(/"engineUsed","(vtracer|potrace)"/)?.[1] ||
    text.match(/"engineUsed":"(vtracer|potrace)"/)?.[1] ||
    null
  );
}

async function loadRegressionPng() {
  if (await fileExists(exactRegressionPath)) {
    return fs.readFile(exactRegressionPath);
  }
  return makeRegressionPng();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeRegressionPng() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="#f3c2ef" offset="0"/>
          <stop stop-color="#7c83ff" offset="0.55"/>
          <stop stop-color="#f8fafc" offset="1"/>
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#bg)"/>
      <text x="36" y="58" font-family="Arial" font-size="25" font-weight="700" fill="#111827">Silent Moon</text>
      <rect x="190" y="48" width="138" height="286" rx="24" fill="#101b4a"/>
      <rect x="358" y="42" width="126" height="286" rx="22" fill="#ffffff"/>
      <rect x="520" y="78" width="142" height="260" rx="22" fill="#182461"/>
      <rect x="32" y="238" width="118" height="36" rx="8" fill="#b7f7d1"/>
      <text x="34" y="318" font-family="Arial" font-size="34" font-weight="800" fill="#111827">Who needs</text>
      <text x="34" y="354" font-family="Arial" font-size="34" font-weight="800" fill="#111827">Meditation</text>
      <rect x="376" y="88" width="82" height="48" rx="10" fill="#ffbd66"/>
      <rect x="376" y="150" width="82" height="48" rx="10" fill="#6ee7b7"/>
      <rect x="376" y="212" width="82" height="48" rx="10" fill="#c4b5fd"/>
      <circle cx="245" cy="196" r="28" fill="#9ee7c6"/>
      <circle cx="594" cy="170" r="34" fill="#facc15"/>
      <path d="M214 246 C280 190, 312 290, 374 238 S514 280, 612 218" fill="none" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makePng() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
      <rect width="160" height="120" fill="white"/>
      <circle cx="55" cy="56" r="28" fill="#0f172a"/>
      <rect x="86" y="32" width="46" height="46" rx="8" fill="#0ea5e9"/>
      <path d="M24 98 C45 76, 72 118, 98 92 S138 100, 146 72" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
