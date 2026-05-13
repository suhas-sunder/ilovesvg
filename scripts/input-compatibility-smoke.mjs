import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { validateMeaningfulSvgOutput } from "./meaningful-output.mjs";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();

const fixtures = await createFixtures();
const results = [];

for (const fixture of [
  fixtures.visibleSvg,
  fixtures.styledSvg,
  fixtures.embeddedImageSvg,
  fixtures.png,
  fixtures.jpg,
  fixtures.jpeg,
  fixtures.webp,
]) {
  results.push(
    await expectMeaningfulSvg({
      route: "/",
      fixture,
      label: `home-${fixture.id}`,
    }),
  );
}

for (const route of [
  "/png-to-svg-converter",
  "/jpg-to-svg-converter",
  "/jpeg-to-svg-converter",
  "/webp-to-svg-converter",
  "/jpg-to-svg-for-cricut",
  "/jpeg-to-svg-for-cricut",
  "/image-to-svg-for-cricut",
  "/cricut-svg-converter",
  "/drawing-to-svg-converter",
  "/drawing-to-svg-for-cricut",
  "/icon-to-svg-converter",
  "/black-and-white-image-to-svg-converter",
  "/black-and-white-image-to-svg-for-cricut",
  "/code-to-svg-for-cricut",
]) {
  results.push(
    await expectNoBlankSuccess({
      route,
      fixture: fixtures.visibleSvg,
      label: `${route}-svg-input`,
    }),
  );
}

for (const { route, acceptedFixtures } of [
  {
    route: "/png-to-svg-converter",
    acceptedFixtures: [fixtures.jpg, fixtures.jpeg, fixtures.webp],
  },
  {
    route: "/jpg-to-svg-converter",
    acceptedFixtures: [fixtures.png, fixtures.jpeg, fixtures.webp],
  },
  {
    route: "/jpeg-to-svg-converter",
    acceptedFixtures: [fixtures.png, fixtures.jpg, fixtures.webp],
  },
  {
    route: "/webp-to-svg-converter",
    acceptedFixtures: [fixtures.png, fixtures.jpg, fixtures.jpeg],
  },
  {
    route: "/png-to-svg-for-cricut",
    acceptedFixtures: [fixtures.jpg, fixtures.jpeg, fixtures.webp],
  },
  {
    route: "/jpg-to-svg-for-cricut",
    acceptedFixtures: [fixtures.png, fixtures.jpeg, fixtures.webp],
  },
  {
    route: "/jpg-to-layered-svg-for-cricut",
    acceptedFixtures: [fixtures.png, fixtures.jpeg, fixtures.webp],
  },
  {
    route: "/image-to-layered-svg-for-cricut",
    acceptedFixtures: [fixtures.webp],
  },
]) {
  for (const fixture of acceptedFixtures) {
    results.push(
      await expectMeaningfulSvg({
        route,
        fixture,
        label: `${route}-${fixture.id}-common-raster-input`,
      }),
    );
  }
}

for (const route of [
  "/png-to-layered-svg-for-cricut",
  "/jpg-to-layered-svg-for-cricut",
  "/image-to-layered-svg-for-cricut",
]) {
  results.push(
    await expectNoBlankSuccess({
      route,
      fixture: fixtures.visibleSvg,
      label: `${route}-svg-layered-input`,
    }),
  );
}

for (const route of [
  "/svg-to-png-converter",
  "/svg-to-jpg-converter",
  "/svg-to-webp-converter",
]) {
  results.push(
    await expectSvgExportAcceptsSvg({
      route,
      label: `${route}-accepts-svg-ui`,
    }),
  );
  results.push(
    await expectSvgExportRejectsRaster({
      route,
      fixture: fixtures.png,
      label: `${route}-rejects-raster-ui`,
    }),
  );
}

results.push(
  await expectNoUnsafeSvgPassThrough({
    route: "/",
    fixture: fixtures.unsafeSvg,
    label: "home-unsafe-svg-sanitized",
  }),
);

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

async function expectMeaningfulSvg({
  route,
  fixture,
  label,
}) {
  const { response, text, routePath } = await postFile(route, fixture);
  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}: ${text.slice(0, 240)}`);
  }

  const validation = validateMeaningfulSvgOutput(text, {
    allowWhiteOnly: false,
  });
  if (!validation.ok) {
    throw new Error(`${label} returned blank or non-renderable SVG: ${validation.reasons.join("; ")}`);
  }

  return {
    label,
    route,
    routePath,
    status: response.status,
    outcome: "meaningful-output",
    svgBytes: validation.stats.svgBytes,
    drawableCount: validation.stats.drawableCount,
    sourceKind: extractJsonString(text, "sourceKind"),
    engineUsed: extractJsonString(text, "engineUsed"),
  };
}

async function expectNoBlankSuccess({ route, fixture, label }) {
  const { response, text, routePath } = await postFile(route, fixture);
  if (response.ok) {
    const validation = validateMeaningfulSvgOutput(text, {
      allowWhiteOnly: false,
      expectLayers: /layered/.test(route),
    });
    if (!validation.ok) {
      throw new Error(`${label} accepted SVG input as blank success: ${validation.reasons.join("; ")}`);
    }
    return {
      label,
      route,
      routePath,
      status: response.status,
      outcome: "meaningful-output",
      svgBytes: validation.stats.svgBytes,
      drawableCount: validation.stats.drawableCount,
      sourceKind: extractJsonString(text, "sourceKind"),
    };
  }

  assertClearUnsupported(response, text, label);
  return {
    label,
    route,
    routePath,
    status: response.status,
    outcome: "clear-error",
    message: safeSnippet(text),
  };
}

async function expectNoUnsafeSvgPassThrough({ route, fixture, label }) {
  const { response, text, routePath } = await postFile(route, fixture);
  if (!response.ok) {
    assertClearUnsupported(response, text, label);
    return {
      label,
      route,
      routePath,
      status: response.status,
      outcome: "clear-error",
      message: safeSnippet(text),
    };
  }

  if (/<script\b|onload\s*=|javascript:/i.test(text)) {
    throw new Error(`${label} passed unsafe SVG markup through.`);
  }
  const validation = validateMeaningfulSvgOutput(text);
  if (!validation.ok) {
    throw new Error(`${label} sanitized SVG but returned blank success: ${validation.reasons.join("; ")}`);
  }
  return {
    label,
    route,
    routePath,
    status: response.status,
    outcome: "sanitized-meaningful-output",
    svgBytes: validation.stats.svgBytes,
  };
}

async function expectSvgExportAcceptsSvg({ route, label }) {
  const source = await readRouteSource(route);
  if (!/accept\s*=\s*["'][^"']*(?:image\/svg\+xml|\.svg)/i.test(source)) {
    throw new Error(`${label} does not expose SVG upload accept markup.`);
  }
  return {
    label,
    route,
    routePath: route,
    status: "source-audit",
    outcome: "svg-upload-ui-present",
  };
}

async function expectSvgExportRejectsRaster({ route, fixture, label }) {
  const source = await readRouteSource(route);
  const acceptMatch = source.match(/accept\s*=\s*["']([^"']*)["']/i);
  const accept = acceptMatch?.[1] || "";
  if (/image\/png|\.png|image\/jpeg|\.jpe?g|image\/webp|\.webp/i.test(accept)) {
    throw new Error(`${label} advertises unsupported raster upload in accept="${accept}".`);
  }
  return {
    label,
    route,
    routePath: route,
    status: "source-audit",
    outcome: "raster-not-advertised",
    fixture: fixture.id,
  };
}

async function readRouteSource(route) {
  const routeFile = `${route.replace(/^\//, "") || "home"}.tsx`;
  return fs.readFile(path.join(rootDir, "app", "routes", routeFile), "utf8");
}

async function postFile(route, fixture) {
  const routePath = dataRoute(route);
  const form = new FormData();
  form.append("file", new File([fixture.buffer], fixture.fileName, { type: fixture.mimeType }));
  for (const [key, value] of Object.entries(defaultFieldsFor(route, fixture))) {
    form.append(key, value);
  }
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: sameOriginHeaders(route, routePath),
    body: form,
  });
  const text = await response.text();
  return { response, text, routePath };
}

function defaultFieldsFor(route, fixture) {
  const common = {
    traceMode: route.includes("layered") ? "layered" : "single",
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
    maxTraceSide: "512",
    clientRunId: `${slug(route)}-${fixture.id}-${Date.now()}`,
  };
  if (!route.includes("layered")) return common;
  return {
    ...common,
    colorLayerCount: "4",
    layerMaxTraceSide: "512",
    minRegionPercent: "0.35",
    layerOptTolerance: "0.45",
    layerTurdSize: "4",
    layerTurnPolicy: "majority",
    posterize: "true",
    posterizeStrength: "45",
    removeWhite: "false",
    removeTransparent: "true",
    colorMergeTolerance: "18",
  };
}

function assertClearUnsupported(response, text, label) {
  if (response.status < 400 || response.status >= 500) {
    throw new Error(`${label} returned ${response.status} instead of a clear bounded 4xx response: ${safeSnippet(text)}`);
  }
  if (!/(unsupported|please upload|only|svg|file|image|visible artwork|could not read)/i.test(text)) {
    throw new Error(`${label} 4xx response did not include a clear user-facing upload error: ${safeSnippet(text)}`);
  }
  if (/<script\b|javascript:|node_modules|[A-Z]:\\|\/Users\/|at\s+.*:\d+:\d+/i.test(text)) {
    throw new Error(`${label} returned unsafe error details: ${safeSnippet(text)}`);
  }
}

function dataRoute(route) {
  return route === "/" ? "/_root.data?index" : `${route}.data`;
}

function sameOriginHeaders(route, routePath) {
  return {
    Origin: baseUrl,
    Referer: `${baseUrl}${route === "/" ? "/" : route}`,
    "User-Agent": `ilovesvg-input-compatibility-smoke/${slug(routePath)}`,
    "X-Forwarded-For": `198.18.42.${1 + (hashString(routePath) % 200)}`,
  };
}

function extractJsonString(text, key) {
  return String(text || "").match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))?.[1] || "";
}

function safeSnippet(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 180);
}

function slug(value) {
  return String(value || "root").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "root";
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function createFixtures() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
    `<text x="24" y="92" font-size="64" font-family="Arial" fill="#111827">SVG</text>` +
    `</svg>`;
  const styledSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
    `<style>.outline{fill:none;stroke:#1d4ed8;stroke-width:14;stroke-linecap:round}.label{fill:#dc2626;font:700 42px Arial}</style>` +
    `<path class="outline" d="M24 122 H216 M52 42 L188 42"/>` +
    `<text class="label" x="58" y="94">SVG</text>` +
    `</svg>`;
  const unsafeSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80" onload="alert(1)">` +
    `<script>alert(1)</script>` +
    `<rect x="10" y="10" width="80" height="48" fill="#16a34a"/>` +
    `<path d="M20 65 L100 65" stroke="#111827" stroke-width="6"/>` +
    `</svg>`;
  const png = await sharp({
    create: {
      width: 180,
      height: 120,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120">` +
            `<rect x="18" y="16" width="70" height="70" rx="10" fill="#111827"/>` +
            `<circle cx="126" cy="52" r="34" fill="#2563eb"/>` +
            `<path d="M24 102 H154" stroke="#ef4444" stroke-width="10" stroke-linecap="round"/>` +
          `</svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();
  const embeddedImageSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120">` +
    `<image x="0" y="0" width="180" height="120" href="data:image/png;base64,${png.toString("base64")}"/>` +
    `</svg>`;
  const jpg = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
  return {
    visibleSvg: {
      id: "svg",
      fileName: "visible-logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(svg, "utf8"),
    },
    styledSvg: {
      id: "styled-svg",
      fileName: "styled-logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(styledSvg, "utf8"),
    },
    embeddedImageSvg: {
      id: "embedded-image-svg",
      fileName: "embedded-image-logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(embeddedImageSvg, "utf8"),
    },
    unsafeSvg: {
      id: "unsafe-svg",
      fileName: "unsafe-logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(unsafeSvg, "utf8"),
    },
    png: { id: "png", fileName: "visible-logo.png", mimeType: "image/png", buffer: png },
    jpg: { id: "jpg", fileName: "visible-logo.jpg", mimeType: "image/jpeg", buffer: jpg },
    jpeg: { id: "jpeg", fileName: "visible-logo.jpeg", mimeType: "image/jpeg", buffer: jpg },
    webp: { id: "webp", fileName: "visible-logo.webp", mimeType: "image/webp", buffer: webp },
  };
}
