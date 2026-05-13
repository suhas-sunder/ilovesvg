import { promises as fs } from "node:fs";
import sharp from "sharp";
import { validateMeaningfulSvgOutput } from "./meaningful-output.mjs";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const failures = [];
const results = [];

await auditSourceGuardrails();
await auditRuntimeGuardrails();

if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        baseUrl,
        checkedAt: new Date().toISOString(),
        failures,
        results,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      checkedAt: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);

async function auditSourceGuardrails() {
  const backendSecurity = await read("app/utils/backendSecurity.server.ts");
  const potraceCompat = await read("app/utils/potraceCompat.ts");
  const enginePolicy = await read("app/shared/tracing/enginePolicy.ts");
  const centerlineTrace = await read("app/shared/tracing/centerlineTrace.ts");
  const vtracerClient = await read("app/client/lib/tracing/vtracerWorkerClient.ts");
  const sharedFallback = await read("app/shared/tracing/serverFallback.server.ts");
  const tracePanel = await read("app/client/components/converter/TraceOutputPanel.tsx");
  const bespokePanel = await read("app/client/components/converter/BespokeTraceOutputPanel.tsx");
  const packageJson = await read("package.json");

  expectSource(backendSecurity, "MAX_UPLOAD_BYTES", "shared upload byte limit is documented");
  expectSource(backendSecurity, "MAX_IMAGE_PIXELS", "shared image pixel limit is documented");
  expectSource(backendSecurity, "MAX_OUTPUT_SVG_BYTES", "shared SVG output byte limit is documented");
  expectSource(potraceCompat, "TRACE_MAX_INPUT_BYTES", "Potrace input byte limit is present");
  expectSource(potraceCompat, "TRACE_MAX_PIXELS", "Potrace pixel limit is present");
  expectSource(potraceCompat, "TRACE_TIMEOUT_MS", "Potrace timeout is present");
  expectSource(enginePolicy, "CLIENT_MAX_BYTES", "VTracer client byte cap is present");
  expectSource(enginePolicy, "CLIENT_MAX_PIXELS", "VTracer client pixel cap is present");
  expectSource(enginePolicy, "CLIENT_MAX_SIDE", "VTracer client side cap is present");
  expectSource(centerlineTrace, "MAX_CENTERLINE_PIXELS", "centerline pixel cap is present");
  expectSource(centerlineTrace, "MAX_POLYLINES", "centerline path cap is present");
  expectSource(vtracerClient, "oversized SVG", "browser output-size rejection remains present");
  expectSource(vtracerClient, "too many paths", "browser path-count rejection remains present");
  expectSource(sharedFallback, "validateMeaningfulSvgOutput", "server Potrace fallback rejects blank SVG output");
  expectSource(sharedFallback, "No visible vector output found", "server Potrace fallback has a clear blank-output error");
  await expectFile("app/shared/tracing/outputComplexity.ts", "shared output complexity warning helper exists");
  expectSource(tracePanel, "data-output-warning-list", "shared output panel renders visible warnings");
  expectSource(bespokePanel, "OutputWarningList", "bespoke output panel renders visible warnings");
  expectSource(packageJson, "test:image-complexity", "package exposes image complexity audit");
}

async function auditRuntimeGuardrails() {
  await assertLocalServer();

  const cleanPng = await makeCleanLogoPng();
  const cleanJpg = await sharp(cleanPng).jpeg({ quality: 92 }).toBuffer();
  const transparentPng = await makeTransparentPng();
  const noisyJpg = await makeNoisyJpg();
  const largeSafePng = await makeLargeSafePng();

  results.push(
    await expectMeaningfulSvgResponse({
      label: "clean-logo-png-single-trace",
      route: "/png-to-svg-converter",
      fileName: "clean-logo.png",
      mimeType: "image/png",
      buffer: cleanPng,
      fields: singleTraceFields({ maxTraceSide: "512" }),
    }),
  );

  results.push(
    await expectMeaningfulSvgResponse({
      label: "clean-logo-jpg-single-trace",
      route: "/jpg-to-svg-converter",
      fileName: "clean-logo.jpg",
      mimeType: "image/jpeg",
      buffer: cleanJpg,
      fields: singleTraceFields({ maxTraceSide: "512" }),
    }),
  );

  results.push(
    await expectRejectedOrNoSuccessBlank({
      label: "fully-transparent-png-rejected",
      route: "/png-to-svg-converter",
      fileName: "transparent.png",
      mimeType: "image/png",
      buffer: transparentPng,
      fields: singleTraceFields({ maxTraceSide: "512" }),
    }),
  );

  results.push(
    await expectMeaningfulSvgResponse({
      label: "layered-clean-logo-has-path-tags",
      route: "/png-to-layered-svg-for-cricut",
      fileName: "layered-logo.png",
      mimeType: "image/png",
      buffer: cleanPng,
      fields: layeredTraceFields({ layerMaxTraceSide: "512" }),
      expectLayers: true,
    }),
  );

  results.push(
    await expectNoServerCrash({
      label: "noisy-jpg-cricut-bounded",
      route: "/jpg-to-svg-for-cricut",
      fileName: "noisy-photo-like.jpg",
      mimeType: "image/jpeg",
      buffer: noisyJpg,
      fields: singleTraceFields({ preprocess: "edge", maxTraceSide: "512" }),
    }),
  );

  results.push(
    await expectMeaningfulSvgResponse({
      label: "large-safe-png-auto-resizes-and-renders",
      route: "/png-to-svg-converter",
      fileName: "large-safe-logo.png",
      mimeType: "image/png",
      buffer: largeSafePng,
      fields: singleTraceFields({ maxTraceSide: "900" }),
    }),
  );
}

async function expectMeaningfulSvgResponse({
  label,
  route,
  fileName,
  mimeType,
  buffer,
  fields,
  expectLayers = false,
}) {
  const { response, text, routePath } = await postRoute({
    route,
    fileName,
    mimeType,
    buffer,
    fields,
  });
  if (!response.ok) {
    fail(`${label}: ${route} returned ${response.status}: ${text.slice(0, 240)}`);
  }
  const validation = validateMeaningfulSvgOutput(text, { expectLayers });
  if (!validation.ok) {
    fail(`${label}: ${route} returned non-renderable SVG output: ${validation.reasons.join("; ")}`);
  }
  return {
    label,
    route,
    routePath,
    status: response.status,
    bytes: Buffer.byteLength(text, "utf8"),
    svgBytes: validation.stats.svgBytes,
    paths: validation.stats.pathCount,
    layerPathTags: validation.stats.layerPathTagsWithPaths,
  };
}

async function expectRejectedOrNoSuccessBlank({
  label,
  route,
  fileName,
  mimeType,
  buffer,
  fields,
}) {
  const { response, text, routePath } = await postRoute({
    route,
    fileName,
    mimeType,
    buffer,
    fields,
  });

  if (response.status >= 400 && response.status < 500) {
    return {
      label,
      route,
      routePath,
      status: response.status,
      rejectedBlankInput: true,
      message: text.slice(0, 160),
    };
  }

  if (!response.ok) {
    fail(`${label}: expected bounded 4xx or meaningful output, got ${response.status}: ${text.slice(0, 240)}`);
  }

  const validation = validateMeaningfulSvgOutput(text);
  if (!validation.ok) {
    fail(`${label}: blank or transparent input was accepted as a successful non-renderable SVG: ${validation.reasons.join("; ")}`);
  }

  return {
    label,
    route,
    routePath,
    status: response.status,
    meaningfulFallback: true,
    svgBytes: validation.stats.svgBytes,
    paths: validation.stats.pathCount,
  };
}

async function expectNoServerCrash({
  label,
  route,
  fileName,
  mimeType,
  buffer,
  fields,
}) {
  const { response, text, routePath } = await postRoute({
    route,
    fileName,
    mimeType,
    buffer,
    fields,
  });
  if (response.status >= 500) {
    fail(`${label}: ${route} returned server error ${response.status}: ${text.slice(0, 240)}`);
  }
  if (response.ok) {
    const validation = validateMeaningfulSvgOutput(text);
    if (!validation.ok) {
      fail(`${label}: ${route} returned successful but non-renderable noisy output: ${validation.reasons.join("; ")}`);
    }
    return {
      label,
      route,
      routePath,
      status: response.status,
      svgBytes: validation.stats.svgBytes,
      paths: validation.stats.pathCount,
      ok: true,
    };
  }
  return {
    label,
    route,
    routePath,
    status: response.status,
    boundedFailure: true,
    message: text.slice(0, 160),
  };
}

async function postRoute({ route, fileName, mimeType, buffer, fields }) {
  const routePath = dataRoute(route);
  const form = new FormData();
  form.append("file", new File([buffer], fileName, { type: mimeType }));
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      Referer: `${baseUrl}${route}`,
    },
    body: form,
  });
  const text = await response.text();
  return { response, text, routePath };
}

async function assertLocalServer() {
  try {
    const response = await fetch(baseUrl, {
      headers: { "User-Agent": "ilovesvg-image-complexity-audit" },
    });
    const text = await response.text();
    if (!response.ok || !/iLoveSVG|SVG/i.test(text)) {
      fail(`BASE_URL ${baseUrl} is not serving the expected iLoveSVG app.`);
    }
  } catch (error) {
    fail(
      `BASE_URL ${baseUrl} is not reachable for image complexity runtime checks: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function singleTraceFields(overrides = {}) {
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

function layeredTraceFields(overrides = {}) {
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

async function makeCleanLogoPng() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="160" viewBox="0 0 220 160">
      <rect width="220" height="160" fill="white"/>
      <circle cx="70" cy="76" r="38" fill="#111827"/>
      <rect x="120" y="36" width="58" height="58" rx="10" fill="#0ea5e9"/>
      <path d="M28 128 C58 96, 94 146, 132 112 S184 118, 198 72" fill="none" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeTransparentPng() {
  return sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
}

async function makeNoisyJpg() {
  const width = 256;
  const height = 256;
  const raw = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let i = 0; i < raw.length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    raw[i] = seed & 255;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 82 })
    .toBuffer();
}

async function makeLargeSafePng() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200">
      <rect width="1800" height="1200" fill="white"/>
      <circle cx="520" cy="560" r="260" fill="#111827"/>
      <rect x="980" y="320" width="420" height="420" rx="72" fill="#0ea5e9"/>
      <path d="M180 980 C440 720, 760 1120, 1080 840 S1480 930, 1640 540" fill="none" stroke="#ef4444" stroke-width="64" stroke-linecap="round"/>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function dataRoute(route) {
  return route === "/" ? "/_root.data?index" : `${route}.data`;
}

async function read(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function expectFile(filePath, description) {
  try {
    await fs.access(filePath);
    results.push({ label: description, source: filePath, ok: true });
  } catch {
    fail(`${description}: missing ${filePath}`);
  }
}

function expectSource(source, token, description) {
  if (source.includes(token)) {
    results.push({ label: description, token, ok: true });
    return;
  }
  fail(`${description}: missing token ${token}`);
}

function fail(message) {
  failures.push(message);
}
