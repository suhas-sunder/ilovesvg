import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
  return import(
    `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`
  );
}

const [lifecycle, inFlight, conversionCache, responseCorrelation] =
  await Promise.all([
  importTypescriptModule(
    "app/client/lib/tracing/hybridTraceFallbackLifecycle.ts",
  ),
  importTypescriptModule(
    "app/client/lib/converter/inFlightConversionDedupe.ts",
  ),
  importTypescriptModule("app/client/lib/converter/conversionCache.ts"),
  importTypescriptModule(
    "app/shared/tracing/traceResponseCorrelation.ts",
  ),
]);

const validResult = Object.freeze({
  svg: '<svg width="1" height="1"><path d="M0 0"/></svg>',
  width: 1,
  height: 1,
  layers: [],
  engineUsed: "potrace",
  sourceKind: "raster",
  warnings: [],
});

let activeClientJobs = 0;
const activeRuns = new Map();
const startRun = (clientRunId) => {
  activeClientJobs += 1;
  let run;
  run = lifecycle.createHybridTraceRunLifecycle({
    clientRunId,
    onCleanup: () => {
      if (activeRuns.get(clientRunId) === run) {
        activeRuns.delete(clientRunId);
      }
      activeClientJobs = Math.max(0, activeClientJobs - 1);
    },
  });
  activeRuns.set(clientRunId, run);
  return run;
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createPendingMapWaiter = ({
  pendingMap,
  clientRunId,
  cacheKey = null,
  signal,
  canWriteCache = () => true,
}) => {
  let pending;
  pending = lifecycle.createPendingServerFallback({
    clientRunId,
    cacheKey,
    context: { canWriteCache },
    signal,
    onSettled: () => {
      if (pendingMap.get(clientRunId) === pending) {
        pendingMap.delete(clientRunId);
      }
    },
  });
  pendingMap.set(clientRunId, pending);
  return pending;
};

// Every hybrid server submission carries an exact, bounded correlation ID.
{
  const currentHref =
    "https://www.ilovesvg.com/png-to-svg-converter?existing=1";
  const actionUrl = responseCorrelation.createTraceActionUrl(
    undefined,
    currentHref,
    "png-to-svg-123.Mixed",
  );
  assert.equal(
    actionUrl,
    "/png-to-svg-converter?existing=1&__ilovesvg_trace_client_run_id=png-to-svg-123.Mixed",
  );
  assert.equal(
    responseCorrelation.normalizeTraceClientRunId(
      "png-to-svg-123.Mixed",
    ),
    "png-to-svg-123.Mixed",
  );
  for (const invalid of [
    "",
    "contains spaces",
    "contains/slash",
    "x".repeat(161),
    null,
  ]) {
    assert.equal(
      responseCorrelation.normalizeTraceClientRunId(invalid),
      null,
    );
  }

  const request = new Request(`https://www.ilovesvg.com${actionUrl}`, {
    method: "POST",
  });
  const baseJson = (data, init) => {
    const responseInit =
      typeof init === "number" ? { status: init } : { ...init };
    const headers = new Headers(responseInit.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(data), {
      ...responseInit,
      headers,
    });
  };
  const responseJson = responseCorrelation.createCorrelatedTraceJson(
    request,
    baseJson,
  );

  const directAction = responseCorrelation.createCorrelatedTraceAction(
    async () =>
      responseJson(
        { error: "Server is busy.", code: "BUSY" },
        { status: 429, headers: { "Retry-After": "2" } },
      ),
  );
  const directResponse = await directAction({ request });
  assert.equal(directResponse.status, 429);
  assert.equal(directResponse.headers.get("Retry-After"), "2");
  assert.equal(
    directResponse.headers.has("x-ilovesvg-trace-correlation"),
    false,
  );
  assert.deepEqual(await directResponse.json(), {
    error: "Server is busy.",
    code: "BUSY",
    clientRunId: "png-to-svg-123.Mixed",
    traceResponseCorrelated: true,
  });

  const helperAction = responseCorrelation.createCorrelatedTraceAction(
    async () =>
      baseJson(
        { error: "Invalid upload." },
        { status: 415, headers: { "X-Validation": "preserved" } },
      ),
  );
  const helperResponse = await helperAction({ request });
  assert.equal(helperResponse.status, 415);
  assert.equal(helperResponse.headers.get("X-Validation"), "preserved");
  assert.deepEqual(await helperResponse.json(), {
    error: "Invalid upload.",
    clientRunId: "png-to-svg-123.Mixed",
    traceResponseCorrelated: true,
  });

  const missingIdRequest = new Request(
    "https://www.ilovesvg.com/png-to-svg-converter",
    { method: "POST" },
  );
  const missingIdAction =
    responseCorrelation.createCorrelatedTraceAction(async () =>
      baseJson({ error: "Uncorrelated failure." }, { status: 400 }),
    );
  const missingIdResponse = await missingIdAction({
    request: missingIdRequest,
  });
  assert.deepEqual(await missingIdResponse.json(), {
    error: "Uncorrelated failure.",
  });
}

// Browser success.
{
  const run = startRun("browser-success");
  let activeData = null;
  activeData = await run.waitFor(Promise.resolve(validResult));
  run.cleanup("completed");
  assert.equal(activeData, validResult);
  assert.equal(activeClientJobs, 0);
  assert.equal(activeRuns.size, 0);
}

// Browser failure followed by a successful server fallback.
{
  const run = startRun("fallback-success");
  await assert.rejects(
    run.waitFor(Promise.reject(new Error("browser failed"))),
    /browser failed/,
  );
  const pendingMap = new Map();
  const controller = new AbortController();
  run.attachAbortController(controller);
  const pending = createPendingMapWaiter({
    pendingMap,
    clientRunId: "fallback-success",
    cacheKey: "fallback-success-key",
    signal: controller.signal,
  });
  const resultPromise = run.waitFor(pending.promise);
  assert.equal(
    lifecycle.resolvePendingServerFallback(
      pendingMap,
      "fallback-success",
      validResult,
    ),
    true,
  );
  assert.equal(await resultPromise, validResult);
  assert.equal(pendingMap.size, 0);
  run.cleanup("completed");
  assert.equal(activeClientJobs, 0);
}

// Server fallback error settles exactly once and clears the waiter.
{
  const run = startRun("fallback-error");
  const pendingMap = new Map();
  const controller = new AbortController();
  run.attachAbortController(controller);
  const pending = createPendingMapWaiter({
    pendingMap,
    clientRunId: "fallback-error",
    signal: controller.signal,
  });
  const resultPromise = run.waitFor(pending.promise);
  assert.equal(
    lifecycle.rejectPendingServerFallback(
      pendingMap,
      "fallback-error",
      new Error("server failed"),
    ),
    true,
  );
  assert.equal(
    lifecycle.rejectPendingServerFallback(
      pendingMap,
      "fallback-error",
      new Error("duplicate server failure"),
    ),
    false,
  );
  await assert.rejects(resultPromise, /server failed/);
  assert.equal(pendingMap.size, 0);
  run.cleanup("failed");
  assert.equal(activeClientJobs, 0);
}

// Cancellation before fallback registration.
{
  const run = startRun("cancel-before-fallback");
  assert.equal(run.cleanup("canceled"), true);
  assert.equal(run.cleanup("canceled"), false);
  await assert.rejects(
    run.waitFor(Promise.resolve(validResult)),
    /canceled/,
  );
  assert.equal(activeClientJobs, 0);
  assert.equal(activeRuns.size, 0);
}

// Cancellation immediately after submission and while awaiting a response.
for (const clientRunId of [
  "cancel-immediately-after-submit",
  "cancel-while-waiting",
]) {
  inFlight.clearInFlightConversionsForTests();
  const pendingMap = new Map();
  const run = startRun(clientRunId);
  const handle = inFlight.acquireInFlightConversion(
    `${clientRunId}-key`,
    (signal) =>
      createPendingMapWaiter({
        pendingMap,
        clientRunId,
        cacheKey: `${clientRunId}-key`,
        signal,
      }).promise,
  );
  run.attachInFlightConsumer(handle);
  const resultPromise = run.waitFor(handle.promise);
  await flushMicrotasks();
  assert.equal(pendingMap.size, 1);
  run.cleanup("canceled");
  await assert.rejects(resultPromise, /canceled/);
  await flushMicrotasks();
  assert.equal(pendingMap.size, 0);
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0);
  assert.equal(activeClientJobs, 0);
}

// A newer run can join the same fallback before superseding the old consumer.
{
  inFlight.clearInFlightConversionsForTests();
  conversionCache.clearConversionCache();
  const pendingMap = new Map();
  const oldRun = startRun("superseded-old");
  const oldHandle = inFlight.acquireInFlightConversion(
    "shared-fallback-key",
    (signal) =>
      createPendingMapWaiter({
        pendingMap,
        clientRunId: "superseded-old",
        cacheKey: "shared-fallback-key",
        signal,
      }).promise,
  );
  oldRun.attachInFlightConsumer(oldHandle);
  const oldResultPromise = oldRun.waitFor(oldHandle.promise);
  await flushMicrotasks();

  const newRun = startRun("superseding-new");
  const newHandle = inFlight.acquireInFlightConversion(
    "shared-fallback-key",
    () => Promise.reject(new Error("shared start must not run twice")),
  );
  newRun.attachInFlightConsumer(newHandle);
  const newResultPromise = newRun.waitFor(newHandle.promise);
  assert.equal(oldRun.cleanup("superseded"), true);
  await assert.rejects(oldResultPromise, /canceled/);
  assert.equal(
    inFlight.getInFlightConsumerCountForTests("shared-fallback-key"),
    1,
  );

  let cacheWrites = 0;
  assert.equal(
    lifecycle.resolvePendingServerFallback(
      pendingMap,
      "superseded-old",
      validResult,
      (pending) => {
        if (
          pending.cacheKey &&
          newHandle.getConsumerCount() > 0
        ) {
          cacheWrites += 1;
          conversionCache.writeConversionCache(
            pending.cacheKey,
            validResult,
          );
        }
      },
    ),
    true,
  );
  assert.equal(await newResultPromise, validResult);
  newRun.cleanup("completed");
  await flushMicrotasks();
  assert.equal(cacheWrites, 1);
  assert.ok(conversionCache.lookupConversionCache("shared-fallback-key"));
  assert.equal(pendingMap.size, 0);
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0);
  assert.equal(activeClientJobs, 0);
}

// Late success and error responses from an obsolete final consumer are ignored.
for (const responseKind of ["success", "error"]) {
  inFlight.clearInFlightConversionsForTests();
  conversionCache.clearConversionCache();
  const pendingMap = new Map();
  const clientRunId = `late-${responseKind}`;
  const cacheKey = `${clientRunId}-key`;
  const run = startRun(clientRunId);
  const handle = inFlight.acquireInFlightConversion(
    cacheKey,
    (signal) =>
      createPendingMapWaiter({
        pendingMap,
        clientRunId,
        cacheKey,
        signal,
      }).promise,
  );
  run.attachInFlightConsumer(handle);
  const resultPromise = run.waitFor(handle.promise);
  await flushMicrotasks();
  run.cleanup("superseded");
  await assert.rejects(resultPromise, /canceled/);
  await flushMicrotasks();

  let staleCacheWrites = 0;
  let staleClientActivations = 0;
  if (responseKind === "success") {
    const resolved = lifecycle.resolvePendingServerFallback(
      pendingMap,
      clientRunId,
      validResult,
      () => {
        staleCacheWrites += 1;
      },
    );
    if (resolved && run.isActive()) staleClientActivations += 1;
    assert.equal(resolved, false);
  } else {
    assert.equal(
      lifecycle.rejectPendingServerFallback(
        pendingMap,
        clientRunId,
        new Error("late server error"),
      ),
      false,
    );
  }
  assert.equal(staleCacheWrites, 0);
  assert.equal(staleClientActivations, 0);
  assert.equal(conversionCache.lookupConversionCache(cacheKey), null);
  assert.equal(pendingMap.size, 0);
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0);
  assert.equal(activeClientJobs, 0);
}

// Unmount cleanup rejects a pending fallback without claiming server cancellation.
{
  const pendingMap = new Map();
  const run = startRun("unmount-pending");
  const controller = new AbortController();
  run.attachAbortController(controller);
  const pending = createPendingMapWaiter({
    pendingMap,
    clientRunId: "unmount-pending",
    signal: controller.signal,
  });
  const resultPromise = run.waitFor(pending.promise);
  run.cleanup("unmounted");
  await assert.rejects(resultPromise, /released|canceled/);
  assert.equal(controller.signal.aborted, true);
  assert.equal(pendingMap.size, 0);
  assert.equal(activeClientJobs, 0);
}

// Two shared consumers: one cancellation keeps work alive; final cancellation aborts.
{
  inFlight.clearInFlightConversionsForTests();
  const sharedDeferred = deferred();
  let sharedAborted = false;
  const firstRun = startRun("shared-first");
  const firstHandle = inFlight.acquireInFlightConversion(
    "shared-consumers",
    (signal) => {
      signal.addEventListener(
        "abort",
        () => {
          sharedAborted = true;
          sharedDeferred.reject(new Error("shared operation aborted"));
        },
        { once: true },
      );
      return sharedDeferred.promise;
    },
  );
  firstRun.attachInFlightConsumer(firstHandle);
  const firstResultPromise = firstRun.waitFor(firstHandle.promise);

  const secondRun = startRun("shared-second");
  const secondHandle = inFlight.acquireInFlightConversion(
    "shared-consumers",
    () => Promise.reject(new Error("shared work restarted")),
  );
  secondRun.attachInFlightConsumer(secondHandle);
  const secondResultPromise = secondRun.waitFor(secondHandle.promise);
  await flushMicrotasks();

  firstRun.cleanup("canceled");
  await assert.rejects(firstResultPromise, /canceled/);
  assert.equal(sharedAborted, false);
  assert.equal(secondHandle.getConsumerCount(), 1);
  sharedDeferred.resolve(validResult);
  assert.equal(await secondResultPromise, validResult);
  secondRun.cleanup("completed");
  await flushMicrotasks();
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0);
  assert.equal(activeClientJobs, 0);

  const finalDeferred = deferred();
  const finalRun = startRun("final-consumer");
  const finalHandle = inFlight.acquireInFlightConversion(
    "final-consumer-key",
    (signal) => {
      signal.addEventListener(
        "abort",
        () => finalDeferred.reject(new Error("final consumer aborted")),
        { once: true },
      );
      return finalDeferred.promise;
    },
  );
  finalRun.attachInFlightConsumer(finalHandle);
  const finalResultPromise = finalRun.waitFor(finalHandle.promise);
  await flushMicrotasks();
  finalRun.cleanup("canceled");
  await assert.rejects(finalResultPromise, /canceled/);
  await flushMicrotasks();
  assert.equal(finalHandle.signal.aborted, true);
  assert.equal(inFlight.getInFlightConversionCountForTests(), 0);
  assert.equal(activeClientJobs, 0);
}

// Pending settlement and cleanup calls are idempotent.
{
  const pendingMap = new Map();
  const controller = new AbortController();
  const pending = createPendingMapWaiter({
    pendingMap,
    clientRunId: "settle-once",
    signal: controller.signal,
  });
  assert.equal(pending.resolve(validResult), true);
  assert.equal(pending.resolve(validResult), false);
  assert.equal(pending.reject(new Error("duplicate")), false);
  assert.equal(await pending.promise, validResult);
  assert.equal(pendingMap.size, 0);
}

// Missing and unknown response IDs never resolve another run's waiter.
{
  const pendingMap = new Map();
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = createPendingMapWaiter({
    pendingMap,
    clientRunId: "exact-first",
    signal: firstController.signal,
  });
  const second = createPendingMapWaiter({
    pendingMap,
    clientRunId: "exact-second",
    signal: secondController.signal,
  });
  assert.equal(
    lifecycle.resolvePendingServerFallback(
      pendingMap,
      "",
      validResult,
    ),
    false,
  );
  assert.equal(
    lifecycle.resolvePendingServerFallback(
      pendingMap,
      "unknown-run",
      validResult,
    ),
    false,
  );
  assert.equal(first.isPending(), true);
  assert.equal(second.isPending(), true);
  firstController.abort();
  secondController.abort();
  await assert.rejects(first.promise, /canceled/);
  await assert.rejects(second.promise, /canceled/);
  assert.equal(pendingMap.size, 0);
}

assert.equal(activeClientJobs, 0, "active client job count returns to zero");
assert.equal(activeRuns.size, 0, "per-run lifecycle registry returns to zero");
assert.equal(
  inFlight.getInFlightConversionCountForTests(),
  0,
  "in-flight conversion map returns to zero",
);

const hookSource = await readFile(
  path.join(root, "app/client/lib/tracing/useHybridTraceFetcher.ts"),
  "utf8",
);
for (const token of [
  "createHybridTraceRunLifecycle",
  "createPendingServerFallback",
  "resolvePendingServerFallback",
  "rejectPendingServerFallback",
  "activeClientRunsRef",
  "traceResponseCorrelated",
  "canWriteCache",
  "runLifecycle.waitFor(inFlight.promise)",
]) {
  assert.ok(
    hookSource.includes(token),
    `production hybrid hook must use lifecycle token: ${token}`,
  );
}
assert.doesNotMatch(
  hookSource,
  /pendingServerCacheRef\.current\.size === 1/,
  "missing response IDs must not fall back to the only pending waiter",
);
assert.doesNotMatch(
  hookSource,
  /fetcher\.(?:abort|cancel)\(/,
  "local cleanup must not claim the server fetcher request itself is canceled",
);

const routeDirectory = path.join(root, "app", "routes");
const hybridRouteFiles = [];
for (const entry of await readdir(routeDirectory)) {
  if (!entry.endsWith(".tsx")) continue;
  const source = await readFile(path.join(routeDirectory, entry), "utf8");
  if (!source.includes("useHybridTraceFetcher")) continue;
  hybridRouteFiles.push(entry);
  for (const token of [
    "createCorrelatedTraceAction",
    "createCorrelatedTraceJson",
    "traceActionImplementation",
  ]) {
    assert.ok(
      source.includes(token),
      `${entry} must preserve exact server fallback response correlation via ${token}`,
    );
  }
  assert.doesNotMatch(
    source,
    /export async function action\(/,
    `${entry} must not bypass the correlated action wrapper`,
  );
}
assert.equal(
  hybridRouteFiles.length,
  38,
  "all 38 hybrid fallback route actions must return exact clientRunId correlation",
);

console.log(
  "server fallback lifecycle audit passed: deterministic success, error, cancellation, supersession, late response, unmount, shared-consumer, exact-match, 38-route server correlation, and zero-count cleanup coverage",
);
