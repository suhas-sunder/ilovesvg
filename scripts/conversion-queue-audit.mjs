import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [];

const hook = await read("app/client/lib/tracing/useHybridTraceFetcher.ts");
checks.push(assertIncludes(hook, "activeClientJobs", "shared hook tracks multiple active client jobs"));
checks.push(assertIncludes(hook, "cancelClientJob", "shared hook exposes client-job cancellation"));
checks.push(assertIncludes(hook, "AbortController", "shared hook creates abort controllers per client job"));
checks.push(assertIncludes(hook, "client-attempt-canceled", "shared hook treats user cancellation as terminal"));
checks.push(assertIncludes(hook, "suppressedServerDataRef", "shared hook suppresses stale server results when a new client job starts"));
checks.push(assertIncludes(hook, "latest: runIdRef.current === runId", "shared hook records stale/latest job diagnostics"));
checks.push(assertNotIncludes(hook, "if (runIdRef.current !== runId) return;", "shared hook does not discard older successful client jobs"));
checks.push(assertIncludes(hook, "An earlier browser trace did not finish", "shared hook surfaces older job failures instead of silently dropping them"));

const workerClient = await read("app/client/lib/tracing/vtracerWorkerClient.ts");
checks.push(assertIncludes(workerClient, "MAX_ACTIVE_CLIENT_TRACES = 2", "browser VTracer jobs are bounded"));
checks.push(assertIncludes(workerClient, "acquireClientTraceSlot", "browser VTracer jobs use a slot queue"));
checks.push(assertIncludes(workerClient, "signal?: AbortSignal", "browser VTracer accepts cancellation signals"));

const outputPanel = await read("app/client/components/converter/TraceOutputPanel.tsx");
checks.push(assertIncludes(outputPanel, "data-job-status", "shared output panel exposes per-card job status"));
checks.push(assertIncludes(outputPanel, "TraceJobStateCard", "shared output panel renders pending/error job cards"));
checks.push(assertIncludes(outputPanel, "onCancelOutputJob", "shared output panel supports safe job cancellation"));
checks.push(assertIncludes(outputPanel, "onRetryOutputJob", "shared output panel supports failed-job retry"));

const home = await read("app/routes/home.tsx");
checks.push(assertIncludes(home, "submittedByRunIdRef", "home stores per-job submitted settings"));
checks.push(assertIncludes(home, "jobStatus: \"running\"", "home inserts visible pending job cards"));
checks.push(assertIncludes(home, "cancelOutputJob", "home can cancel safe client jobs"));
checks.push(assertIncludes(home, "retryOutputJob", "home can retry failed queued jobs"));
checks.push(assertIncludes(home, "activeClientTraceCount", "home tracks concurrent client jobs without a single stale busy boolean"));
checks.push(assertNotIncludes(home, "clientRunId !== latestSubmittedRunIdRef.current", "home no longer discards older intentional job results"));

const pngConverter = await read("app/routes/png-to-svg-converter.tsx");
checks.push(assertIncludes(pngConverter, "submittedByRunIdRef", "PNG converter stores per-job submitted settings"));
checks.push(assertIncludes(pngConverter, "sanitizeClientRunId(form.get(\"clientRunId\"))", "PNG converter server echoes the submitted job id"));
checks.push(assertIncludes(pngConverter, "jobStatus: \"running\"", "PNG converter inserts visible pending job cards"));
checks.push(assertIncludes(pngConverter, "cancelOutputJob", "PNG converter can cancel safe client jobs"));
checks.push(assertIncludes(pngConverter, "retryOutputJob", "PNG converter can retry failed queued jobs"));
checks.push(assertIncludes(pngConverter, "buttonDisabled = isServer || !hydrated || !file", "PNG converter does not block new jobs just because one is running"));

const pngLayered = await read("app/routes/png-to-layered-svg-for-cricut.tsx");
checks.push(assertIncludes(pngLayered, "submittedByRunIdRef", "PNG layered route stores per-job submitted settings"));
checks.push(assertIncludes(pngLayered, "jobStatus: \"running\"", "PNG layered route inserts visible pending job cards"));
checks.push(assertIncludes(pngLayered, "cancelOutputJob", "PNG layered route can cancel safe client jobs"));
checks.push(assertIncludes(pngLayered, "retryOutputJob", "PNG layered route can retry failed queued jobs"));
checks.push(assertIncludes(pngLayered, 'fd.append("presetId", submittedPresetId)', "PNG layered route submits the actual selected preset id"));
checks.push(assertNotIncludes(pngLayered, "clientRunId !== latestSubmittedRunIdRef.current", "PNG layered route no longer discards older intentional job results"));

const worker = await read("app/client/workers/vtracer.worker.ts");
checks.push(assertIncludes(worker, "maskBuildMode: \"single-pass\"", "worker builds layer masks in one pass"));
checks.push(assertIncludes(worker, "getSafeLayeredPaletteCount", "worker applies adaptive layered palette caps"));

const presetSource = await read("app/client/lib/converter/presetAdditions.ts");
checks.push(assertPresetToken(presetSource, "filled-layers-separate-colors", "requestedPaletteCount: 16"));
checks.push(assertPresetToken(presetSource, "filled-layers-separate-colors", "layerMaxTraceSide: 1400"));
checks.push(assertPresetToken(presetSource, "photo-many-colors", 'layerBuildMode: "raw-vtracer"'));

const report = {
  checkedAt: new Date().toISOString(),
  checks,
};
console.log(JSON.stringify(report, null, 2));

if (checks.some((check) => !check.ok)) {
  process.exit(1);
}

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

function assertIncludes(source, token, label) {
  return {
    label,
    ok: source.includes(token),
    token,
  };
}

function assertNotIncludes(source, token, label) {
  return {
    label,
    ok: !source.includes(token),
    token,
  };
}

function assertPresetToken(source, presetId, token) {
  const block = source.match(
    new RegExp(String.raw`\{\s*id:\s*"${escapeRegExp(presetId)}"[\s\S]*?\n\s*\},`, "m"),
  )?.[0] || "";
  return {
    label: `${presetId} includes ${token}`,
    ok: block.includes(token),
    token,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
