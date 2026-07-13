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
  return import(
    `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`
  );
}

const {
  releaseOwnedCacheKeys,
  runWithBestEffortCleanup,
  syncOwnedCacheKeys,
} = await importTypescriptModule("app/client/lib/lifecycleCleanup.ts");

const cache = new Map([
  ["current", "current-svg"],
  ["shared", "shared-svg"],
  ["visible", "visible-svg"],
]);
const ownerCounts = new Map();
const firstOwner = new Set();
const secondOwner = new Set();
const deleted = [];
const deleteUnowned = (key) => {
  deleted.push(key);
  cache.delete(key);
};

syncOwnedCacheKeys(
  firstOwner,
  ["current", "shared"],
  ownerCounts,
  deleteUnowned,
);
syncOwnedCacheKeys(
  secondOwner,
  ["shared", "visible"],
  ownerCounts,
  deleteUnowned,
);
assert.equal(ownerCounts.get("shared"), 2);

syncOwnedCacheKeys(firstOwner, ["shared"], ownerCounts, deleteUnowned);
assert.deepEqual(deleted, ["current"]);
assert.equal(cache.has("shared"), true);
assert.equal(cache.has("visible"), true);

releaseOwnedCacheKeys(firstOwner, ownerCounts, deleteUnowned);
assert.equal(cache.has("shared"), true);
assert.equal(ownerCounts.get("shared"), 1);
releaseOwnedCacheKeys(secondOwner, ownerCounts, deleteUnowned);
assert.equal(cache.has("shared"), false);
assert.equal(cache.has("visible"), false);
assert.equal(ownerCounts.size, 0);
const deletedAfterRelease = deleted.length;
releaseOwnedCacheKeys(secondOwner, ownerCounts, deleteUnowned);
assert.equal(deleted.length, deletedAfterRelease);

let cleanupCalls = 0;
assert.equal(
  runWithBestEffortCleanup(
    () => "svg-output",
    () => {
      cleanupCalls += 1;
    },
  ),
  "svg-output",
);
assert.equal(cleanupCalls, 1);

const originalError = new Error("original conversion failure");
assert.throws(
  () =>
    runWithBestEffortCleanup(
      () => {
        throw originalError;
      },
      () => {
        cleanupCalls += 1;
        throw new Error("cleanup failure");
      },
    ),
  (error) => error === originalError,
);
assert.equal(cleanupCalls, 2);

const { cleanupUnusedSourceSnapshots } = await importTypescriptModule(
  "app/client/lib/converter/sourceSnapshots.ts",
);
const originalRevoke = URL.revokeObjectURL;
const revoked = [];
URL.revokeObjectURL = (url) => revoked.push(url);
try {
  const visibleHistory = [{ sourcePreviewUrl: "blob:visible" }];
  cleanupUnusedSourceSnapshots(
    [
      { sourcePreviewUrl: "blob:visible" },
      { sourcePreviewUrl: "blob:removed" },
      { sourcePreviewUrl: "https://example.com/not-owned" },
    ],
    visibleHistory,
  );
  assert.deepEqual(revoked, ["blob:removed"]);
  cleanupUnusedSourceSnapshots(visibleHistory, []);
  assert.deepEqual(revoked, ["blob:removed", "blob:visible"]);
  cleanupUnusedSourceSnapshots(visibleHistory, []);
  assert.deepEqual(revoked, [
    "blob:removed",
    "blob:visible",
    "blob:visible",
  ]);
} finally {
  URL.revokeObjectURL = originalRevoke;
}

const sources = new Map();
async function source(relativePath) {
  if (!sources.has(relativePath)) {
    sources.set(relativePath, await readFile(path.join(root, relativePath), "utf8"));
  }
  return sources.get(relativePath);
}

const favicon = await source("app/routes/svg-to-favicon-generator.tsx");
assert.match(favicon, /ownedPreviewUrlsRef/);
assert.match(favicon, /new Set\(Object\.values\(ownedPreviewUrlsRef\.current\)\)/);
assert.match(
  favicon,
  /finally \{\s*img\.onload = null;\s*img\.onerror = null;\s*URL\.revokeObjectURL\(url\);/,
);
assert.match(favicon, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 1500\)/);

for (const relativePath of [
  "app/routes/png-to-svg-for-cricut.tsx",
  "app/routes/png-to-svg-for-silhouette.tsx",
]) {
  const route = await source(relativePath);
  assert.match(route, /const historyRef = React\.useRef\(history\)/);
  assert.match(route, /Array\.from\(submittedByRunIdRef\.current\.values\(\)\)/);
  assert.match(route, /submittedByRunIdRef\.current\.clear\(\)/);
  assert.match(route, /cleanupUnusedSourceSnapshots\(/);
}
assert.match(
  await source("app/routes/png-to-svg-for-cricut.tsx"),
  /fetcher\.data\.code === "BUSY"[\s\S]*submittedByRunIdRef\.current\.delete\(clientRunId\)/,
);
assert.match(
  await source("app/routes/png-to-svg-for-silhouette.tsx"),
  /for \(const clientRunId of submittedByRunIdRef\.current\.keys\(\)\)[\s\S]*fetcher\.cancelClientJob\(clientRunId\)/,
);

const hybridHook = await source(
  "app/client/lib/tracing/useHybridTraceFetcher.ts",
);
assert.match(hybridHook, /mountedRef\.current = false/);
assert.match(hybridHook, /for \(const cancel of clientCancelHandlersRef\.current\.values\(\)\)/);
assert.match(hybridHook, /clientCancelHandlersRef\.current\.clear\(\)/);
assert.match(hybridHook, /runIdRef\.current \+= 1/);
assert.match(hybridHook, /if \(!isActiveClientRun\(\)\) return/);
assert.doesNotMatch(
  hybridHook,
  /const isActiveClientRun = \(\) =>[\s\S]{0,120}runIdRef\.current === runId/,
  "active intentional jobs must keep their independent successful results",
);
assert.match(hybridHook, /if \(mountedRef\.current\) \{\s*setActiveClientJobs/);

const home = await source("app/routes/home.tsx");
assert.match(home, /componentAbortControllerRef/);
assert.match(home, /for \(const controller of clientAbortControllersRef\.current\.values\(\)\)/);
assert.match(home, /clientAbortControllersRef\.current\.clear\(\)/);
assert.match(home, /signal: componentAbortControllerRef\.current\?\.signal/);
assert.match(home, /if \(!mountedRef\.current \|\| abortController\.signal\.aborted\) return false/);

for (const relativePath of [
  "app/client/components/converter/TraceOutputPanel.tsx",
  "app/client/components/converter/BespokeTraceOutputPanel.tsx",
]) {
  const panel = await source(relativePath);
  assert.match(panel, /syncOwnedCacheKeys\(/);
  assert.match(panel, /releaseOwnedCacheKeys\(/);
  assert.match(panel, /OwnerCounts = new Map<string, number>\(\)/);
}

const worker = await source("app/client/workers/vtracer.worker.ts");
assert.match(worker, /runWithBestEffortCleanup\(/);
assert.match(worker, /\(\) => config\.free\(\)/);
const workerClient = await source(
  "app/client/lib/tracing/vtracerWorkerClient.ts",
);
assert.ok(
  (workerClient.match(/finally \{\s*worker\?\.terminate\(\);/g) || []).length >= 2,
  "both VTracer and centerline worker paths must terminate in finally",
);
assert.ok(
  (workerClient.match(/const abortHandler = \(\) => \{\s*worker\?\.terminate\(\);/g) || [])
    .length >= 2,
  "both worker paths must terminate when aborted",
);

console.log(
  "client lifecycle audit passed: URL ownership, snapshots, cache ownership, worker cancellation, stale-result guards, and best-effort native cleanup",
);
