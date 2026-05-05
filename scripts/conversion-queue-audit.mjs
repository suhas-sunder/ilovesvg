import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [];

const hook = await read("app/client/lib/tracing/useHybridTraceFetcher.ts");
checks.push(assertIncludes(hook, "activeClientJobs", "shared hook tracks multiple active client jobs"));
checks.push(assertIncludes(hook, "latest: runIdRef.current === runId", "shared hook records stale/latest job diagnostics"));
checks.push(assertNotIncludes(hook, "if (runIdRef.current !== runId) return;", "shared hook does not discard older successful client jobs"));
checks.push(assertIncludes(hook, "An earlier browser trace did not finish", "shared hook surfaces older job failures instead of silently dropping them"));

const home = await read("app/routes/home.tsx");
checks.push(assertIncludes(home, "submittedByRunIdRef", "home stores per-job submitted settings"));
checks.push(assertNotIncludes(home, "clientRunId !== latestSubmittedRunIdRef.current", "home no longer discards older intentional job results"));

const pngLayered = await read("app/routes/png-to-layered-svg-for-cricut.tsx");
checks.push(assertIncludes(pngLayered, "submittedByRunIdRef", "PNG layered route stores per-job submitted settings"));
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
