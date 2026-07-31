import assert from "node:assert/strict";
import { File } from "node:buffer";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import v8 from "node:v8";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const serverEntry = path.join(root, "server.js");
const auditServerEntry = path.join(
  root,
  "scripts",
  "native-memory-server-wrapper.mjs",
);
const builtServer = path.join(root, "build", "server", "index.js");
const fixturePath = path.join(root, "tests", "fixtures", "IMG_8487.PNG");
const port = Number(process.env.NATIVE_MEMORY_AUDIT_PORT || 3198);
const baseUrl = `http://localhost:${port}`;
const MIB = 1024 * 1024;
const MAX_CAPTURED_EVENTS = 8_000;
const MAX_CAPTURED_LOG_LINES = 8_000;
const SHARP_CACHE_POLICY = { files: 0, items: 32, memory: 16 };
const SHARP_CONCURRENCY = 1;

assert.equal(
  typeof global.gc,
  "function",
  "Run this audit with Node --expose-gc.",
);
await access(builtServer).catch(() => {
  throw new Error("Run `npm run build` before the native-memory audit.");
});

const source = await readFile(fixturePath);
const sourceAudit = await auditProductionOwnership();
const sharpLoadBaseline = snapshotSharp("sharp-loaded-without-processing");
const fixtures = await createFixtures(source);
const sharpBaseline = await runDirectSharpMatrix(fixtures, sharpLoadBaseline);
const production = await withProductionServer(async (server) => {
  const checkpoints = [];

  await postBase64(fixtures.onePixel, false);
  checkpoints.push(readLatestSnapshot(server.events, "process-start"));

  const warmupSingle = await postHome(fixtures.medium, "single", "line-accurate");
  await postHome(fixtures.medium, "layered", "layered-flat-color");
  await postBase64(fixtures.medium, true);
  const specializedTrace = await postMultipartRoute(
    "/black-and-white-image-to-svg-converter.data",
    fixtures.medium,
  );
  assert.match(specializedTrace.svg, /<svg\b/i);
  await delay(300);
  checkpoints.push(readLatestSnapshot(server.events, "after-warmup"));

  const identicalFloors = [];
  for (let batch = 0; batch < 5; batch += 1) {
    checkpoints.push(readLatestSnapshot(server.events, `identical-${batch + 1}-before`));
    const result = await postHome(fixtures.medium, "single", "line-accurate");
    assert.equal(
      result.svg,
      warmupSingle.svg,
      "identical requests must preserve deterministic SVG output",
    );
    const gcMemory = await requestServerGc(server.child);
    await delay(150);
    await postBase64(fixtures.onePixel, false);
    const snapshot = readLatestSnapshot(
      server.events,
      `identical-${batch + 1}-post-idle`,
      gcMemory,
    );
    identicalFloors.push(snapshot);
    checkpoints.push(snapshot);
  }

  const uniqueFloors = [];
  for (let batch = 0; batch < fixtures.unique.length; batch += 1) {
    checkpoints.push(readLatestSnapshot(server.events, `unique-${batch + 1}-before`));
    await postHome(fixtures.unique[batch], "single", "line-accurate");
    const gcMemory = await requestServerGc(server.child);
    await delay(200);
    await postBase64(fixtures.onePixel, false);
    const snapshot = readLatestSnapshot(
      server.events,
      `unique-${batch + 1}-post-idle`,
      gcMemory,
    );
    uniqueFloors.push(snapshot);
    checkpoints.push(snapshot);
  }

  const concurrent = await Promise.all([
    postHome(fixtures.large, "single", "line-accurate"),
    postHome(fixtures.large, "single", "line-accurate"),
  ]);
  assert.equal(concurrent[0].svg, concurrent[1].svg);

  const printThenCut = await postMultipartRoute(
    "/png-to-svg-for-cricut-print-then-cut.data",
    fixtures.transparent,
  );
  const stickers = await postMultipartRoute(
    "/png-to-svg-for-cricut-stickers.data",
    fixtures.transparent,
  );
  assert.match(printThenCut.svg, /<svg\b/i);
  assert.match(stickers.svg, /<svg\b/i);

  const aborted = new AbortController();
  const abortedRequest = postHome(
    fixtures.large,
    "single",
    "line-accurate",
    aborted.signal,
  ).catch((error) => {
    assert.equal(error?.name, "AbortError");
    return null;
  });
  await delay(25);
  aborted.abort();
  await abortedRequest;

  const invalidDimensions = await postBase64(fixtures.onePixel, false);
  assert.equal(invalidDimensions.response.ok, false);
  const decodeFailure = await postHomeFailure(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
    "decode-failure.png",
  );
  assert.equal(decodeFailure.response.ok, false);
  const failureFloors = [];
  for (let batch = 0; batch < 3; batch += 1) {
    let oversized = Buffer.alloc(30 * MIB + 1);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
      oversized,
    );
    const oversizedFailure = await postHomeFailure(
      oversized,
      `oversized-${batch + 1}.png`,
    );
    assert.equal(oversizedFailure.response.ok, false);
    oversized = null;
    const gcMemory = await requestServerGc(server.child);
    await delay(200);
    await postBase64(fixtures.onePixel, false);
    failureFloors.push(
      readLatestSnapshot(
        server.events,
        `failure-${batch + 1}-post-idle`,
        gcMemory,
      ),
    );
  }
  await requestServerGc(server.child);
  await delay(500);
  await postBase64(fixtures.onePixel, false);
  checkpoints.push(readLatestSnapshot(server.events, "after-settlement"));
  await delay(350);
  await postBase64(fixtures.onePixel, false);
  checkpoints.push(readLatestSnapshot(server.events, "short-idle"));
  await delay(1_200);
  const longIdleGcMemory = await requestServerGc(server.child);
  await postBase64(fixtures.onePixel, false);
  checkpoints.push(
    readLatestSnapshot(server.events, "long-idle", longIdleGcMemory),
  );

  const final = checkpoints.at(-1);
  assert.ok(final, "a final server memory snapshot is required");
  assert.equal(final.activeConversionJobs, 0);
  assert.equal(final.pendingConversionWaiters, 0);
  assert.equal(final.sharpQueueLength, 0);
  assert.equal(final.sharpProcessCount, 0);
  assert.equal(final.sharpConcurrency, SHARP_CONCURRENCY);
  assert.ok(final.sharpCacheMemoryMaxMb <= SHARP_CACHE_POLICY.memory);
  assert.ok(final.sharpCacheItemsMax <= SHARP_CACHE_POLICY.items);
  assert.ok(final.potraceCacheEntries <= 32);
  assert.ok(final.potraceCacheBytes <= 16 * MIB);

  const identicalPlateau = assertStablePlateau(
    "production identical-input post-idle RSS",
    identicalFloors.map((item) => item.rssBytes),
    24 * MIB,
  );
  const uniquePlateau = assertStablePlateau(
    "production unique-input post-idle RSS",
    uniqueFloors.map((item) => item.rssBytes),
    24 * MIB,
  );
  assertStablePlateau(
    "production unique-input external memory",
    uniqueFloors.map((item) => item.externalBytes),
    16 * MIB,
  );
  assertStablePlateau(
    "production unique-input ArrayBuffer memory",
    uniqueFloors.map((item) => item.arrayBufferBytes),
    16 * MIB,
  );
  const failurePlateau = assertStablePlateau(
    "production failed-input post-idle RSS",
    failureFloors.map((item) => item.rssBytes),
    24 * MIB,
  );
  assertStablePlateau(
    "production failed-input external memory",
    failureFloors.map((item) => item.externalBytes),
    16 * MIB,
  );
  assertStablePlateau(
    "production failed-input ArrayBuffer memory",
    failureFloors.map((item) => item.arrayBufferBytes),
    16 * MIB,
  );

  const errorEvents = server.events.filter(
    (event) => event.checkpoint === "conversion-error",
  );
  const finallyEvents = server.events.filter(
    (event) => event.checkpoint === "conversion-finally",
  );
  assert.ok(finallyEvents.length > 0);
  assert.ok(errorEvents.length > 0);
  assert.ok(
    server.events.some(
      (event) =>
        event.pendingConversionWaiters > 0 ||
        event.gateQueued > 0,
    ),
    "the concurrent workload should exercise the bounded queue",
  );

  return {
    checkpoints,
    identicalPlateau,
    uniquePlateau,
    failurePlateau,
    eventCount: server.events.length,
    completedJobCount: finallyEvents.length,
    failedJobCount: errorEvents.length,
    cancelledClientCount: 1,
    outputParity: true,
    final,
  };
});

global.gc();
await delay(100);
const finalAuditProcess = snapshotProcess("final-audit-process");

console.log(
  JSON.stringify(
    {
      ok: true,
      sourceAudit,
      sharpBaseline,
      production: {
        eventCount: production.eventCount,
        completedJobCount: production.completedJobCount,
        failedJobCount: production.failedJobCount,
        cancelledClientCount: production.cancelledClientCount,
        identicalPlateau: production.identicalPlateau,
        uniquePlateau: production.uniquePlateau,
        failurePlateau: production.failurePlateau,
        final: production.final,
        outputParity: production.outputParity,
      },
      finalAuditProcess,
      scenarios: [
        "Sharp load without processing",
        "metadata reads",
        "small and large resize",
        "PNG, JPEG, and WebP encoding",
        "transparent image processing",
        "production single trace",
        "production layered trace",
        "production Base64 trace",
        "production specialized black-and-white trace",
        "production Print Then Cut",
        "production sticker output",
        "sequential identical inputs",
        "sequential unique inputs",
        "concurrent success through the conversion gate",
        "invalid decode dimensions, decode failure, and oversized input",
        "client cancellation during an active request",
        "post-settlement short and long idle",
      ],
    },
    null,
    2,
  ),
);

async function auditProductionOwnership() {
  const files = {
    sharpRuntime: await readFile(
      path.join(root, "app/utils/sharpRuntime.server.ts"),
      "utf8",
    ),
    conversionModules: await readFile(
      path.join(root, "app/utils/conversionModules.server.ts"),
      "utf8",
    ),
    potrace: await readFile(path.join(root, "app/utils/potraceCompat.ts"), "utf8"),
    bmp: await readFile(path.join(root, "app/utils/bmpDecode.server.ts"), "utf8"),
    gate: await readFile(
      path.join(root, "app/utils/conversionGate.server.ts"),
      "utf8",
    ),
  };
  const routeFiles = [
    "app/routes/black-and-white-image-to-svg-converter.tsx",
    "app/routes/black-and-white-image-to-svg-for-cricut.tsx",
    "app/routes/base64-to-svg.tsx",
    "app/routes/base64-to-svg-for-cricut.tsx",
    "app/routes/png-to-svg-for-cricut-print-then-cut.tsx",
    "app/routes/png-to-svg-for-cricut-stickers.tsx",
  ];
  const routeSources = await Promise.all(
    routeFiles.map((file) => readFile(path.join(root, file), "utf8")),
  );

  assert.match(files.conversionModules, /export \{ getSharp \} from "\.\/sharpRuntime\.server"/);
  assert.match(files.potrace, /getSharp.*sharpRuntime\.server/);
  assert.match(files.bmp, /getSharp.*sharpRuntime\.server/);
  assert.doesNotMatch(files.potrace, /createRequire|requireFromHere\("sharp"\)/);
  assert.doesNotMatch(files.bmp, /createRequire|requireFromHere\("sharp"\)/);
  assert.match(files.sharpRuntime, /memory:\s*16/);
  assert.match(files.sharpRuntime, /items:\s*32/);
  assert.match(files.sharpRuntime, /SHARP_CONCURRENCY\s*=\s*1/);
  assert.match(files.gate, /const maxRunning = options\.maxRunning \?\? 1/);
  assert.match(
    files.potrace,
    /new Uint8ClampedArray\(\s*raw\.data\.buffer,\s*raw\.data\.byteOffset,\s*raw\.data\.byteLength/s,
  );
  for (const [index, sourceText] of routeSources.entries()) {
    assert.doesNotMatch(
      sourceText,
      /\.cache\?\.\(|\.concurrency\?\.\(/,
      `${routeFiles[index]} must not override process-global Sharp policy`,
    );
  }

  return {
    centralizedSharpOwners: [
      "app/utils/conversionModules.server.ts",
      "app/utils/potraceCompat.ts",
      "app/utils/bmpDecode.server.ts",
    ],
    sharpCachePolicy: SHARP_CACHE_POLICY,
    sharpConcurrency: SHARP_CONCURRENCY,
    conversionGateCapacity: 1,
    duplicateRouteOverrides: 0,
    fullRgbaTraceCopies: 0,
  };
}

async function runDirectSharpMatrix(fixtureSet, start) {
  sharp.concurrency(SHARP_CONCURRENCY);
  sharp.cache(SHARP_CACHE_POLICY);

  for (let index = 0; index < 12; index += 1) {
    await sharp(fixtureSet.medium).metadata();
  }
  const afterMetadata = snapshotSharp("after-metadata");

  const floors = [];
  let peakRssBytes = Math.max(start.rssBytes, process.memoryUsage().rss);
  for (let batch = 0; batch < 7; batch += 1) {
    const input = fixtureSet.unique[batch % fixtureSet.unique.length];
    await sharp(input).resize(240, 180, { fit: "inside" }).png().toBuffer();
    await sharp(input).resize(1400, 1000, { fit: "inside" }).png().toBuffer();
    await sharp(input).resize(1200, 900, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
    await sharp(input).resize(1200, 900, { fit: "inside" }).webp({ quality: 88 }).toBuffer();
    await sharp(fixtureSet.transparent)
      .resize(1200, 900, { fit: "inside" })
      .ensureAlpha()
      .png()
      .toBuffer();
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    global.gc();
    await delay(180);
    floors.push(snapshotSharp(`batch-${batch + 1}-post-gc-idle`));
  }

  const plateau = assertStablePlateau(
    "direct Sharp post-GC idle RSS",
    floors.map((item) => item.rssBytes),
    16 * MIB,
  );
  const final = floors.at(-1);
  assert.equal(final.sharpConcurrency, SHARP_CONCURRENCY);
  assert.equal(final.sharpQueueLength, 0);
  assert.equal(final.sharpProcessCount, 0);
  assert.ok(final.sharpCacheMemoryMaxMb <= SHARP_CACHE_POLICY.memory);
  assert.ok(final.sharpCacheItemsMax <= SHARP_CACHE_POLICY.items);
  assertStablePlateau(
    "direct Sharp external memory",
    floors.map((item) => item.externalBytes),
    16 * MIB,
  );
  assertStablePlateau(
    "direct Sharp ArrayBuffer memory",
    floors.map((item) => item.arrayBufferBytes),
    16 * MIB,
  );

  sharp.cache(SHARP_CACHE_POLICY);
  sharp.concurrency(SHARP_CONCURRENCY);
  return {
    start,
    afterMetadata,
    peakRssBytes,
    floors,
    plateau,
    final,
  };
}

function snapshotSharp(checkpoint) {
  const processSnapshot = snapshotProcess(checkpoint);
  const cache = sharp.cache();
  const counters = sharp.counters();
  return {
    ...processSnapshot,
    sharpConcurrency: sharp.concurrency(),
    sharpQueueLength: counters.queue,
    sharpProcessCount: counters.process,
    sharpCacheMemoryCurrentMb: cache.memory.current,
    sharpCacheMemoryHighMb: cache.memory.high,
    sharpCacheMemoryMaxMb: cache.memory.max,
    sharpCacheItemsCurrent: cache.items.current,
    sharpCacheItemsMax: cache.items.max,
    sharpCacheFilesCurrent: cache.files.current,
    sharpCacheFilesMax: cache.files.max,
  };
}

function snapshotProcess(checkpoint) {
  const memory = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  return {
    checkpoint,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBufferBytes: memory.arrayBuffers,
    v8HeapSizeLimitBytes: heap.heap_size_limit,
    v8MallocedBytes: heap.malloced_memory,
    v8ExternalMemoryBytes: heap.external_memory,
  };
}

function readLatestSnapshot(events, checkpoint, processMemory) {
  const event = events.at(-1);
  assert.ok(event, `missing diagnostic event for ${checkpoint}`);
  return {
    checkpoint,
    rssBytes: processMemory?.rss ?? event.rssBytes,
    heapUsedBytes: processMemory?.heapUsed ?? event.heapUsedBytes,
    heapTotalBytes: processMemory?.heapTotal ?? event.heapTotalBytes,
    externalBytes: processMemory?.external ?? event.externalBytes,
    arrayBufferBytes: processMemory?.arrayBuffers ?? event.arrayBufferBytes,
    unclassifiedProcessBytes: event.unclassifiedProcessBytes,
    activeConversionJobs: event.activeConversionJobs ?? 0,
    pendingConversionWaiters: event.pendingConversionWaiters ?? 0,
    conversionGateCapacity: event.conversionGateCapacity ?? 0,
    potraceCacheEntries: event.potraceCacheEntries ?? 0,
    potraceCacheBytes: event.potraceCacheBytes ?? 0,
    sharpLoaded: event.sharpLoaded ?? 0,
    sharpConcurrency: event.sharpConcurrency ?? 0,
    sharpQueueLength: event.sharpQueueLength ?? 0,
    sharpProcessCount: event.sharpProcessCount ?? 0,
    sharpCacheMemoryCurrentMb: event.sharpCacheMemoryCurrentMb ?? 0,
    sharpCacheMemoryHighMb: event.sharpCacheMemoryHighMb ?? 0,
    sharpCacheMemoryMaxMb: event.sharpCacheMemoryMaxMb ?? 0,
    sharpCacheItemsCurrent: event.sharpCacheItemsCurrent ?? 0,
    sharpCacheItemsMax: event.sharpCacheItemsMax ?? 0,
  };
}

function assertStablePlateau(label, values, minimumToleranceBytes) {
  assert.ok(values.length >= 3, `${label} needs at least three batches`);
  const tail = values.slice(-3);
  const spreadBytes = Math.max(...tail) - Math.min(...tail);
  const scaleTolerance = Math.round(Math.max(...tail) * 0.12);
  const toleranceBytes = Math.max(minimumToleranceBytes, scaleTolerance);
  assert.ok(
    spreadBytes <= toleranceBytes,
    `${label} did not plateau: tail=${tail.join(",")}, spread=${spreadBytes}, tolerance=${toleranceBytes}`,
  );
  const firstHalfMax = Math.max(...values.slice(0, Math.ceil(values.length / 2)));
  assert.ok(
    values.at(-1) <= firstHalfMax + Math.round(toleranceBytes / 2),
    `${label} retained a per-batch rise: values=${values.join(",")}`,
  );
  return { values, tail, spreadBytes, toleranceBytes };
}

async function createFixtures(input) {
  const medium = await sharp(input)
    .resize(1200, 800, { fit: "fill" })
    .png()
    .toBuffer();
  const large = await sharp(input)
    .resize(1800, 1200, { fit: "fill" })
    .png()
    .toBuffer();
  const transparent = await sharp(input)
    .resize(1000, 700, { fit: "fill" })
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><circle cx="500" cy="350" r="260" fill="#ef4444"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  const onePixel = await sharp(input).resize(1, 1).png().toBuffer();
  const unique = [];
  for (let index = 0; index < 6; index += 1) {
    unique.push(
      await sharp(medium)
        .modulate({
          brightness: 0.9 + index * 0.025,
          saturation: 0.85 + index * 0.03,
          hue: index * 13,
        })
        .png()
        .toBuffer(),
    );
  }
  return { medium, large, transparent, onePixel, unique };
}

async function withProductionServer(run) {
  const events = [];
  const logLines = [];
  let captureError = null;
  const child = spawn(process.execPath, ["--expose-gc", auditServerEntry], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      ILOVESVG_MEMORY_DIAGNOSTICS: "1",
      ILOVESVG_MEMORY_AUDIT_IPC: "1",
      ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE: "1",
      ILOVESVG_MEMORY_DIAGNOSTICS_ROUTES: [
        "home",
        "base64-to-svg",
        "shared-raster-normalize",
        "shared-potrace",
        "shared-layered-trace",
      ].join(","),
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  const consume = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (!line) continue;
      if (logLines.length < MAX_CAPTURED_LOG_LINES) logLines.push(line);
      try {
        const event = JSON.parse(line);
        if (event?.event !== "ilovesvg-memory-diagnostic") continue;
        if (events.length >= MAX_CAPTURED_EVENTS) {
          captureError ??= new Error("Diagnostic event capture exceeded its safety bound.");
          continue;
        }
        events.push(event);
      } catch (error) {
        if (!(error instanceof SyntaxError)) captureError ??= error;
      }
    }
  };
  child.stdout.on("data", consume);
  child.stderr.on("data", consume);

  try {
    await waitForServer(child, logLines);
    const result = await run({ child, events, logLines });
    if (captureError) throw captureError;
    return result;
  } finally {
    await stopChild(child);
  }
}

async function postHome(buffer, traceMode, presetId, signal) {
  const form = new FormData();
  form.append("file", new File([buffer], "fixture.png", { type: "image/png" }));
  form.append("traceMode", traceMode);
  form.append("presetId", presetId);
  form.append("threshold", "224");
  form.append("turdSize", "2");
  form.append("optTolerance", "0.28");
  form.append("turnPolicy", "minority");
  form.append("transparent", "true");
  form.append("preprocess", "none");
  form.append("colorLayerCount", "4");
  form.append("requestedPaletteCount", "4");
  form.append("layeredQualityTier", "default");
  form.append("clientRunId", `memory-audit-${traceMode}-${Date.now()}`);
  const response = await fetch(`${baseUrl}/_root.data?index`, {
    method: "POST",
    headers: { Origin: baseUrl, Referer: `${baseUrl}/` },
    body: form,
    signal,
  });
  const text = await response.text();
  const svg = extractPayloadString(text, "svg");
  assert.equal(
    response.ok,
    true,
    JSON.stringify({ status: response.status, body: text.slice(0, 240) }),
  );
  assert.match(svg, /<svg\b/i, text.slice(0, 500));
  return { response, text, svg };
}

async function postBase64(buffer, expectSuccess) {
  const routePath = "/base64-to-svg.data";
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Referer: `${baseUrl}${routePath}`,
    },
    body: JSON.stringify({
      rasterDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      rasterMode: "single",
      transparent: true,
      bgColor: "#ffffff",
      presetId: "line-accurate",
      layerCount: 4,
      maxTraceSide: 900,
    }),
  });
  const text = await response.text();
  const svg = extractPayloadString(text, "svg");
  if (expectSuccess) {
    assert.equal(response.ok, true, text.slice(0, 500));
    assert.match(svg, /<svg\b/i);
  }
  return { response, text, svg };
}

async function postHomeFailure(buffer, fileName) {
  const form = new FormData();
  form.append("file", new File([buffer], fileName, { type: "image/png" }));
  form.append("traceMode", "single");
  form.append("presetId", "line-accurate");
  form.append("clientRunId", `memory-audit-failure-${Date.now()}`);
  const response = await fetch(`${baseUrl}/_root.data?index`, {
    method: "POST",
    headers: { Origin: baseUrl, Referer: `${baseUrl}/` },
    body: form,
  });
  return { response, text: await response.text() };
}

async function postMultipartRoute(routePath, buffer) {
  const form = new FormData();
  form.append("file", new File([buffer], "fixture.png", { type: "image/png" }));
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: { Origin: baseUrl, Referer: `${baseUrl}${routePath}` },
    body: form,
  });
  const text = await response.text();
  const svg = extractPayloadString(text, "svg");
  assert.equal(response.ok, true, text.slice(0, 500));
  return { response, text, svg };
}

function extractPayloadString(text, key) {
  const sourceText = String(text || "");
  try {
    const table = JSON.parse(sourceText);
    if (Array.isArray(table)) {
      const encodedKey = `_${table.findIndex((value) => value === key)}`;
      for (const value of table) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        if (!Object.hasOwn(value, encodedKey)) continue;
        const reference = value[encodedKey];
        if (typeof reference === "number" && typeof table[reference] === "string") {
          return table[reference];
        }
      }
      const decoded = decodeReactRouterPayload(table[0], table);
      const value = findPayloadValue(decoded, key);
      if (typeof value === "string") return value;
    }
  } catch {}
  try {
    const parsed = JSON.parse(sourceText);
    const value = findPayloadValue(parsed, key);
    if (typeof value === "string") return value;
  } catch {}
  return "";
}

function decodeReactRouterPayload(value, table) {
  if (typeof value === "number") return decodeReactRouterPayload(table[value], table);
  if (Array.isArray(value)) return value.map((item) => decodeReactRouterPayload(item, table));
  if (!value || typeof value !== "object") return value;
  const decoded = {};
  for (const [encodedKey, encodedValue] of Object.entries(value)) {
    const key = encodedKey.startsWith("_") ? table[Number(encodedKey.slice(1))] : encodedKey;
    decoded[key] = decodeReactRouterPayload(encodedValue, table);
  }
  return decoded;
}

function findPayloadValue(value, key) {
  if (!value || typeof value !== "object") return "";
  if (Object.hasOwn(value, key)) return value[key];
  for (const child of Object.values(value)) {
    const found = findPayloadValue(child, key);
    if (found !== "") return found;
  }
  return "";
}

async function waitForServer(child, logLines) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(
        `Diagnostic server exited early (${child.exitCode}): ${logLines.slice(-8).join("\n")}`,
      );
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function stopChild(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  const gracefulExit = once(child, "exit");
  child.kill();
  if (
    await Promise.race([
      gracefulExit.then(() => true),
      delay(5_000).then(() => false),
    ])
  ) {
    return;
  }
  const forcedExit = once(child, "exit");
  child.kill("SIGKILL");
  const exited = await Promise.race([
    forcedExit.then(() => true),
    delay(5_000).then(() => false),
  ]);
  assert.equal(exited, true, "diagnostic server must terminate");
}

async function requestServerGc(child) {
  assert.equal(child.connected, true, "memory-audit IPC must remain connected");
  const completed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.off("message", onMessage);
      reject(new Error("Timed out waiting for the diagnostic server GC checkpoint."));
    }, 5_000);
    const onMessage = (message) => {
      if (message?.event !== "ilovesvg-memory-audit-gc-complete") return;
      clearTimeout(timeout);
      child.off("message", onMessage);
      resolve(message.memory ?? null);
    };
    child.on("message", onMessage);
  });
  child.send("ilovesvg-memory-audit-gc");
  return completed;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
