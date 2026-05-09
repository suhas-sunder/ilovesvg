import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "app", "client", "lib", "converter");
const tracingDir = path.join(rootDir, "app", "client", "lib", "tracing");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-conversion-cache-audit");

const moduleFiles = [
  "settings",
  "conversionCacheVersion",
  "stableSerialize",
  "sourceFingerprint",
  "normalizeConversionRequestForCache",
  "buildConversionCacheKey",
  "conversionCache",
  "inFlightConversionDedupe",
];

await fs.rm(tmpDir, { recursive: true, force: true });
await fs.mkdir(path.join(tmpDir, "converter"), { recursive: true });
await fs.mkdir(path.join(tmpDir, "tracing"), { recursive: true });

for (const moduleName of moduleFiles) {
  await transpileModule(
    path.join(srcDir, `${moduleName}.ts`),
    path.join(tmpDir, "converter", `${moduleName}.mjs`),
  );
}

await transpileModule(
  path.join(tracingDir, "useHybridTraceFetcher.ts"),
  path.join(tmpDir, "tracing", "useHybridTraceFetcher.mjs"),
);

const importConverterModule = (moduleName) =>
  import(pathToFileURL(path.join(tmpDir, "converter", `${moduleName}.mjs`)).href);

const [
  version,
  stableSerialize,
  sourceFingerprint,
  normalizeRequest,
  cacheKey,
  conversionCache,
  inFlight,
] = await Promise.all([
  importConverterModule("conversionCacheVersion"),
  importConverterModule("stableSerialize"),
  importConverterModule("sourceFingerprint"),
  importConverterModule("normalizeConversionRequestForCache"),
  importConverterModule("buildConversionCacheKey"),
  importConverterModule("conversionCache"),
  importConverterModule("inFlightConversionDedupe"),
]);

const hookSource = await fs.readFile(
  path.join(tracingDir, "useHybridTraceFetcher.ts"),
  "utf8",
);

await testStableSerialization();
await testCacheKeyNormalization();
await testSourceFingerprinting();
await testLruCache();
await testInFlightDedupe();
await testHookIntegrationTokens();

console.log("[conversion-cache-audit] all checks passed");

async function transpileModule(sourcePath, targetPath) {
  const source = await fs.readFile(sourcePath, "utf8");
  const rewritten = source
    .replace(/from "~\/client\/lib\/converter\/([^"]+)"/g, 'from "../converter/$1.mjs"')
    .replace(/from "~\/shared\/tracing\/types"/g, 'from "../shared/tracing/types.mjs"')
    .replace(/from "\.\/([^"]+)"/g, 'from "./$1.mjs"');
  const transpiled = ts.transpileModule(rewritten, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  await fs.writeFile(targetPath, transpiled);
}

async function testStableSerialization() {
  assert.equal(
    stableSerialize.stableSerialize({ b: 2, a: 1 }),
    stableSerialize.stableSerialize({ a: 1, b: 2 }),
    "stable serialization sorts object keys",
  );
  assert.notEqual(
    stableSerialize.stableSerialize({ a: [1, 2] }),
    stableSerialize.stableSerialize({ a: [2, 1] }),
    "stable serialization preserves array order",
  );
}

async function testCacheKeyNormalization() {
  assert.ok(version.CONVERSION_CACHE_VERSION, "cache version is exported");

  const fingerprint = {
    sha256: "abc123",
    size: 12,
    mime: "image/png",
    width: 100,
    height: 80,
  };

  const base = {
    routeId: "png-to-svg-converter",
    presetId: "line-accurate",
    engine: "auto",
    traceMode: "single",
    threshold: 224,
    removeColors: ["#fff", "red", "#ffffff"],
    transparent: true,
    outputAppearance: { stickerBorderEnabled: true },
  };

  const explicitDefaults = cacheKey.buildConversionCacheKey({
    routeId: "png-to-svg-converter",
    source: fingerprint,
    settings: base,
  });
  const omittedDefaults = cacheKey.buildConversionCacheKey({
    routeId: "png-to-svg-converter",
    source: fingerprint,
    settings: {
      ...base,
      removeColors: ["#ff0000", "#ffffff"],
      outputAppearance: { stickerBorderEnabled: false },
    },
  });

  assert.equal(
    explicitDefaults,
    omittedDefaults,
    "semantic defaults and post-processing-only values do not change the base key",
  );

  assert.notEqual(
    omittedDefaults,
    cacheKey.buildConversionCacheKey({
      routeId: "png-to-svg-converter",
      source: fingerprint,
      settings: { ...base, presetId: "line-bold" },
    }),
    "preset id participates in the base cache key",
  );

  assert.notEqual(
    omittedDefaults,
    cacheKey.buildConversionCacheKey({
      routeId: "png-to-svg-converter",
      source: fingerprint,
      settings: { ...base, engine: "potrace" },
    }),
    "engine participates in the base cache key",
  );

  assert.notEqual(
    omittedDefaults,
    cacheKey.buildConversionCacheKey({
      routeId: "png-to-svg-converter",
      source: { ...fingerprint, sha256: "different" },
      settings: base,
    }),
    "source bytes participate in the base cache key",
  );

  const normalized = normalizeRequest.normalizeConversionRequestForCache(base);
  assert.deepEqual(
    normalized.removeColors,
    ["#ff0000", "#ffffff"],
    "removeColors are normalized, deduped, and sorted for cache keys",
  );
  assert.equal(
    Object.hasOwn(normalized, "outputAppearance"),
    false,
    "output appearance state is excluded from normalized base conversion settings",
  );
}

async function testSourceFingerprinting() {
  const first = new File([new Uint8Array([1, 2, 3])], "same.png", {
    type: "image/png",
  });
  const sameBytes = new File([new Uint8Array([1, 2, 3])], "renamed.png", {
    type: "image/png",
  });
  const differentBytes = new File([new Uint8Array([1, 2, 4])], "same.png", {
    type: "image/png",
  });

  const firstFingerprint = await sourceFingerprint.getSourceFingerprint(first, {
    width: 10,
    height: 12,
  });
  const sameBytesFingerprint = await sourceFingerprint.getSourceFingerprint(sameBytes, {
    width: 10,
    height: 12,
  });
  const differentFingerprint = await sourceFingerprint.getSourceFingerprint(differentBytes, {
    width: 10,
    height: 12,
  });

  assert.equal(
    firstFingerprint?.sha256,
    sameBytesFingerprint?.sha256,
    "same bytes produce the same SHA-256 fingerprint even with a different filename",
  );
  assert.notEqual(
    firstFingerprint?.sha256,
    differentFingerprint?.sha256,
    "different bytes with the same filename produce different fingerprints",
  );
  assert.equal(firstFingerprint?.size, 3, "fingerprint includes byte size");
  assert.equal(firstFingerprint?.mime, "image/png", "fingerprint includes MIME");
  assert.equal(firstFingerprint?.width, 10, "fingerprint includes known width");
  assert.equal(firstFingerprint?.height, 12, "fingerprint includes known height");

  const firstPromise = sourceFingerprint.getSourceFingerprint(first);
  const secondPromise = sourceFingerprint.getSourceFingerprint(first);
  assert.equal(
    firstPromise,
    secondPromise,
    "the same File object reuses its fingerprint promise",
  );
}

async function testLruCache() {
  conversionCache.clearConversionCache();
  const result = {
    svg: '<svg width="1" height="1"><path d="M0 0"/></svg>',
    width: 1,
    height: 1,
    layers: [],
    engineUsed: "potrace",
    sourceKind: "raster",
    warnings: [],
  };

  assert.equal(conversionCache.lookupConversionCache("missing"), null);
  conversionCache.writeConversionCache("one", result);
  assert.deepEqual(
    conversionCache.lookupConversionCache("one")?.svg,
    result.svg,
    "cache lookup returns written result",
  );

  const cached = conversionCache.lookupConversionCache("one");
  cached.layers.push({ id: "mutated", label: "Mutated", color: "#000000", originalColor: "#000000", visible: true });
  assert.equal(
    conversionCache.lookupConversionCache("one")?.layers.length,
    0,
    "cached results are cloned on read and cannot mutate the stored entry",
  );

  conversionCache.writeConversionCache("bad-empty-svg", { ...result, svg: "" });
  assert.equal(
    conversionCache.lookupConversionCache("bad-empty-svg"),
    null,
    "failed or invalid base results are not cached",
  );

  conversionCache.configureConversionCacheForTests({ maxEntries: 2, maxBytes: 10_000 });
  conversionCache.clearConversionCache();
  conversionCache.writeConversionCache("a", result);
  conversionCache.writeConversionCache("b", result);
  conversionCache.lookupConversionCache("a");
  conversionCache.writeConversionCache("c", result);
  assert.ok(conversionCache.lookupConversionCache("a"), "recently used entry survives LRU eviction");
  assert.equal(conversionCache.lookupConversionCache("b"), null, "least recently used entry is evicted");
  assert.ok(conversionCache.lookupConversionCache("c"), "new entry is kept");

  conversionCache.configureConversionCacheForTests({ maxEntries: 30, maxBytes: 25 * 1024 * 1024 });
  conversionCache.clearConversionCache();
}

async function testInFlightDedupe() {
  inFlight.clearInFlightConversionsForTests();
  let calls = 0;
  const first = inFlight.joinOrStartInFlightConversion("same-key", async () => {
    calls += 1;
    return {
      svg: '<svg width="1" height="1"><path d="M0 0"/></svg>',
      width: 1,
      height: 1,
      layers: [],
      engineUsed: "vtracer",
      sourceKind: "raster",
      warnings: [],
    };
  });
  const second = inFlight.joinOrStartInFlightConversion("same-key", async () => {
    calls += 1;
    throw new Error("should not run");
  });
  assert.equal(first, second, "identical in-flight requests join one promise");
  await first;
  assert.equal(calls, 1, "in-flight operation runs once");
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0, "in-flight map cleans after success");

  await assert.rejects(
    inFlight.joinOrStartInFlightConversion("fail-key", async () => {
      throw new Error("boom");
    }),
  );
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0, "in-flight map cleans after failure");

  let retryCalls = 0;
  await inFlight.joinOrStartInFlightConversion("fail-key", async () => {
    retryCalls += 1;
    return {
      svg: '<svg width="1" height="1"><path d="M0 0"/></svg>',
      width: 1,
      height: 1,
      layers: [],
      engineUsed: "potrace",
      sourceKind: "raster",
      warnings: [],
    };
  });
  assert.equal(retryCalls, 1, "failure does not poison a future request");
}

async function testHookIntegrationTokens() {
  for (const token of [
    "buildConversionCacheKeyForFile",
    "lookupConversionCache",
    "writeConversionCache",
    "joinOrStartInFlightConversion",
    "canShareInFlightConversion",
    "cache-hit",
    "in-flight-join",
    "server-cache-write",
  ]) {
    assert.ok(
      hookSource.includes(token),
      `shared hybrid fetcher includes cache integration token: ${token}`,
    );
  }
}
