import sharp from "sharp";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4175").replace(/\/$/, "");

const png = await makePng();
const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
const webp = await sharp(png).webp({ quality: 90 }).toBuffer();

const results = [];

results.push(
  await expectSvgResponse({
    route: "/",
    fileName: "smoke.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      clientRunId: `smoke-home-${Date.now()}`,
      presetId: "photo-edge-clean",
      traceMode: "single",
      preprocess: "edge",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
    expectEngineUsed: true,
  }),
);

results.push(
  await expectSvgResponse({
    route: "/",
    fileName: "smoke-layered.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      clientRunId: `smoke-home-layered-${Date.now()}`,
      presetId: "layered-color",
      traceMode: "layered",
      colorLayerCount: "4",
      layerMaxTraceSide: "512",
      transparent: "true",
    },
    expectEngineUsed: true,
    expectLayers: true,
  }),
);

results.push(
  await expectSvgResponse({
    route: "/png-to-svg-converter",
    fileName: "smoke.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      traceMode: "single",
      preprocess: "none",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(
  await expectSvgResponse({
    route: "/jpg-to-svg-converter",
    fileName: "smoke.jpg",
    mimeType: "image/jpeg",
    buffer: jpg,
    fields: {
      traceMode: "single",
      preprocess: "none",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(
  await expectSvgResponse({
    route: "/webp-to-svg-converter",
    fileName: "smoke.webp",
    mimeType: "image/webp",
    buffer: webp,
    fields: {
      traceMode: "single",
      preprocess: "none",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(
  await expectSvgResponse({
    route: "/webp-to-svg-for-cricut",
    fileName: "smoke.webp",
    mimeType: "image/webp",
    buffer: webp,
    fields: {
      traceMode: "single",
      preprocess: "none",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(
  await expectSvgResponse({
    route: "/logo-to-svg-converter",
    fileName: "smoke-logo.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      traceMode: "single",
      preprocess: "none",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(
  await expectSvgResponse({
    route: "/scan-to-svg-converter",
    fileName: "smoke-scan.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      traceMode: "single",
      preprocess: "edge",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(
  await expectSvgResponse({
    route: "/png-to-layered-svg-for-cricut",
    fileName: "smoke-layered.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      traceMode: "layered",
      colorLayerCount: "4",
      layerMaxTraceSide: "512",
      transparent: "true",
    },
    expectLayers: true,
  }),
);

results.push(
  await expectSvgResponse({
    route: "/code-to-svg-for-cricut",
    fileName: "smoke-code.png",
    mimeType: "image/png",
    buffer: png,
    fields: {
      traceMode: "single",
      preprocess: "none",
      maxTraceSide: "512",
      lineColor: "#000000",
      transparent: "true",
    },
  }),
);

results.push(await expectInvalidUpload());

console.log(JSON.stringify({ baseUrl, checkedAt: new Date().toISOString(), results }, null, 2));

async function expectSvgResponse({
  route,
  fileName,
  mimeType,
  buffer,
  fields,
  expectEngineUsed = false,
  expectLayers = false,
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
  if (/<script\b|on\w+=|javascript:/i.test(text)) {
    throw new Error(`${route} returned unsafe SVG text.`);
  }
  if (expectEngineUsed && !/"engineUsed".*"(vtracer|potrace)"/s.test(text)) {
    throw new Error(`${route} did not include engineUsed in the normalized response.`);
  }
  if (expectLayers && !/"layers"/.test(text)) {
    throw new Error(`${route} did not include layered metadata.`);
  }

  return {
    route,
    routePath,
    status: response.status,
    bytes: Buffer.byteLength(text),
    paths: (text.match(/<path\b/gi) || []).length,
    layersMentioned: /"layers"/.test(text),
    engineUsed: text.match(/"engineUsed","(vtracer|potrace)"/)?.[1] || null,
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

function sameOriginHeaders(route) {
  return {
    Origin: baseUrl,
    Referer: `${baseUrl}${route}`,
  };
}

function dataRoute(route) {
  return route === "/" ? "/_root.data?index" : `${route}.data`;
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
