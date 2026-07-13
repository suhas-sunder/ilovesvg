import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

async function importTypescriptModule(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = await readFile(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
    reportDiagnostics: true,
  });
  assert.deepEqual(
    transpiled.diagnostics ?? [],
    [],
    `${relativePath} should transpile without diagnostics`,
  );
  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`
    ),
    source,
  };
}

const memoryModule = await importTypescriptModule(
  "app/utils/memoryDiagnostics.server.ts",
);
const {
  MEMORY_DIAGNOSTIC_EVENT,
  classifyMemoryDiagnosticError,
  createMemoryDiagnosticRuntime,
  readMemoryDiagnosticStoreCounts,
  resolveMemoryDiagnosticsConfig,
} = memoryModule.module;

const disabledConfig = resolveMemoryDiagnosticsConfig({});
assert.equal(disabledConfig.enabled, false);

let disabledSideEffects = 0;
const disabledRuntime = createMemoryDiagnosticRuntime({
  config: disabledConfig,
  logLine: () => {
    disabledSideEffects += 1;
  },
  memoryUsage: () => {
    disabledSideEffects += 1;
    return { rss: 1, heapTotal: 1, heapUsed: 1, external: 1, arrayBuffers: 1 };
  },
  now: () => {
    disabledSideEffects += 1;
    return 1;
  },
  random: () => {
    disabledSideEffects += 1;
    return 0;
  },
  createCorrelationId: () => {
    disabledSideEffects += 1;
    return "unused";
  },
  storeSnapshot: () => {
    disabledSideEffects += 1;
    return {};
  },
});
assert.equal(
  disabledRuntime.createJob({ routeId: "home", conversionFamily: "raster" }),
  null,
);
assert.equal(disabledSideEffects, 0);

assert.equal(
  resolveMemoryDiagnosticsConfig({
    ILOVESVG_MEMORY_DIAGNOSTICS: "1",
    ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE: "invalid",
  }).sampleRate,
  0.1,
);
assert.equal(
  resolveMemoryDiagnosticsConfig({
    ILOVESVG_MEMORY_DIAGNOSTICS: "1",
    ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE: "2",
  }).sampleRate,
  0.1,
);

const lines = [];
let now = 1_000;
let samplingCalls = 0;
const runtime = createMemoryDiagnosticRuntime({
  config: resolveMemoryDiagnosticsConfig({
    ILOVESVG_MEMORY_DIAGNOSTICS: "1",
    ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE: "0.5",
    ILOVESVG_MEMORY_DIAGNOSTICS_ROUTES: "home, layered-raster-to-svg",
  }),
  logLine: (line) => lines.push(line),
  memoryUsage: () => ({
    rss: 100,
    heapTotal: 80,
    heapUsed: -5,
    external: 50,
    arrayBuffers: 12,
  }),
  now: () => now,
  random: () => {
    samplingCalls += 1;
    return 0.25;
  },
  createCorrelationId: () => "diagnostic-only-id",
  storeSnapshot: () => ({ backendRateLimitStoreEntries: 3 }),
});

assert.equal(
  runtime.createJob({ routeId: "filtered-out", conversionFamily: "other" }),
  null,
);
assert.equal(samplingCalls, 0);

const job = runtime.createJob({
  routeId: "HOME",
  conversionFamily: "raster-to-svg",
  conversionMode: "single",
  presetId: "line-accurate",
  inputBytes: 2048,
});
assert.ok(job);
assert.equal(samplingCalls, 1);
assert.equal(job.correlationId, "diagnostic-only-id");
assert.doesNotMatch(job.correlationId, /home|filename|session|user/i);

now += 10;
job.checkpoint("conversion-start", {
  sourceWidth: 240,
  sourceHeight: 160,
  gateActive: 1,
});
now += 15;
job.checkpoint("output-created", { outputBytes: 4096, pathCount: 4 });
job.finish();
job.finish();
job.checkpoint("response-ready");

assert.equal(samplingCalls, 1, "one sampling decision should cover the whole job");
assert.equal(lines.length, 3, "finished jobs must ignore repeated cleanup and late events");
const events = lines.map((line) => JSON.parse(line));
for (const event of events) {
  assert.equal(event.event, MEMORY_DIAGNOSTIC_EVENT);
  assert.equal(event.correlationId, "diagnostic-only-id");
  assert.equal(event.routeId, "home");
  assert.equal(event.inputBytes, 2048);
  assert.equal(event.rssBytes, 100);
  assert.equal(event.heapTotalBytes, 80);
  assert.equal(event.heapUsedBytes, 0);
  assert.equal(event.externalBytes, 50);
  assert.equal(event.arrayBufferBytes, 12);
  assert.equal(event.unclassifiedProcessBytes, 0);
  assert.equal(event.backendRateLimitStoreEntries, 3);
  assert.ok(Object.values(event).every((value) => value === null || typeof value !== "object"));
  assert.ok(Object.keys(event).length < 48, "diagnostic event should stay small and flat");
  for (const forbidden of [
    "filename",
    "fileName",
    "ip",
    "userAgent",
    "cookie",
    "sessionId",
    "stack",
    "buffer",
    "svg",
    "base64",
    "requestBody",
  ]) {
    assert.equal(Object.hasOwn(event, forbidden), false);
  }
}
assert.equal(events.at(-1).checkpoint, "conversion-finally");

const failingRuntime = createMemoryDiagnosticRuntime({
  config: resolveMemoryDiagnosticsConfig({
    ILOVESVG_MEMORY_DIAGNOSTICS: "1",
    ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE: "1",
  }),
  logLine: () => {
    throw new Error("logger unavailable");
  },
  memoryUsage: () => ({
    rss: 20,
    heapTotal: 5,
    heapUsed: 4,
    external: 2,
    arrayBuffers: 1,
  }),
  now: () => 1,
  random: () => 0,
  createCorrelationId: () => "safe-id",
  storeSnapshot: () => ({}),
});
assert.doesNotThrow(() => {
  const failingJob = failingRuntime.createJob({
    routeId: "home",
    conversionFamily: "raster-to-svg",
  });
  failingJob?.checkpoint("conversion-error", { errorClass: "conversion" });
  failingJob?.finish();
});

const aggregateCounts = readMemoryDiagnosticStoreCounts({
  __ilovesvg_backend_rate_limits: new Map([["private-key", { secret: true }]]),
  __ilovesvg_batch_sessions: new Map([
    ["private-session", {}],
    ["private-session-2", {}],
  ]),
});
assert.deepEqual(aggregateCounts.backendRateLimitStoreEntries, 1);
assert.deepEqual(aggregateCounts.batchSessionStoreEntries, 2);
assert.equal(JSON.stringify(aggregateCounts).includes("private"), false);
assert.equal(classifyMemoryDiagnosticError({ code: "BUSY" }), "busy");
assert.equal(classifyMemoryDiagnosticError({ name: "AbortError" }), "aborted");
assert.equal(classifyMemoryDiagnosticError(new Error("private upload text")), "conversion");

assert.doesNotMatch(memoryModule.source, /new Map\s*</);
assert.doesNotMatch(memoryModule.source, /(?:events|history|completedJobs)\s*=\s*\[/i);

const gateModule = await importTypescriptModule(
  "app/utils/conversionGate.server.ts",
);
const gate = await gateModule.module.getConversionGate({
  maxRunning: 1,
  maxQueued: 1,
});
const before = gate.getDiagnosticSnapshot();
assert.equal(Object.isFrozen(before), true);
assert.deepEqual(before, {
  activeJobs: 0,
  waitingJobs: 0,
  capacity: 1,
  queueCapacity: 1,
});
assert.throws(() => {
  before.activeJobs = 99;
}, TypeError);
assert.equal(gate.running, 0, "mutating a snapshot cannot mutate the gate");

for (const relativePath of [
  "app/routes/home.tsx",
  "app/routes/base64-to-svg.tsx",
]) {
  const routeSource = await readFile(path.join(root, relativePath), "utf8");
  assert.match(
    routeSource,
    /if \(process\.env\.ILOVESVG_MEMORY_DIAGNOSTICS === "1"\) \{[\s\S]{0,180}import\([\s\S]{0,80}memoryDiagnostics\.server/,
    `${relativePath} should avoid loading route-level diagnostics while disabled`,
  );
}

console.log(
  "memory diagnostics audit passed: disabled guard, safe fields, sampling, filters, privacy, bounded payloads, store counts, logger isolation, and read-only gate snapshots",
);
