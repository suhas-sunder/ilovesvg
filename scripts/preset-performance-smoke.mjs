import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const fixture = path.join(rootDir, "tests/fixtures/IMG_8487.PNG");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-preset-performance-smoke");
const upscaledFixture = path.join(tmpDir, "IMG_8487-upscaled.png");

const cases = [
  {
    route: "/png-to-svg-converter",
    preset: "Filled Layers - Separate Colors",
    pattern: "^Filled Layers - Separate Colors\\b",
    fixture: upscaledFixture,
    maxMs: 45_000,
    minColors: 12,
  },
  {
    route: "/png-to-svg-converter",
    preset: "Filled Layers - Smooth",
    pattern: "^Filled Layers - Smooth\\b",
    fixture,
    maxMs: 35_000,
    minColors: 16,
  },
  {
    route: "/png-to-svg-converter",
    preset: "UI Mockup / App Screen",
    pattern: "^UI Mockup / App Screen\\b",
    fixture,
    maxMs: 35_000,
    minColors: 20,
  },
  {
    route: "/png-to-svg-converter",
    preset: "Photo Many Colors",
    pattern: "^Photo Many Colors\\b",
    fixture,
    maxMs: 35_000,
    minColors: 16,
  },
  {
    route: "/png-to-layered-svg-for-cricut",
    preset: "Filled Layers - Separate Colors",
    pattern: "^Filled Layers - Separate Colors\\b",
    fixture,
    maxMs: 35_000,
    minColors: 12,
  },
  {
    route: "/image-to-layered-svg-for-cricut",
    preset: "UI Mockup / App Screen",
    pattern: "^UI Mockup / App Screen\\b",
    fixture,
    maxMs: 35_000,
    minColors: 20,
  },
];

await fs.mkdir(tmpDir, { recursive: true });
await sharp(fixture, { limitInputPixels: false })
  .resize({ width: 2200, fit: "inside", withoutEnlargement: false })
  .png()
  .toFile(upscaledFixture);

const results = [];
let cdpPort = Number(process.env.CDP_PORT || 9310);

for (const testCase of cases) {
  let result = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    result = runCase(testCase, attempt);
    if (result.ok) break;
  }
  results.push(result);
}

function getLatestClientConversionElapsedMs(routeResult) {
  const events = Array.isArray(routeResult?.traceDebug) ? routeResult.traceDebug : [];
  const successes = events
    .filter((event) => event?.stage === "client-attempt-success" && event.latest === true)
    .sort((a, b) => Number(b.time || 0) - Number(a.time || 0));
  const success = successes[0];
  if (!success?.clientRunId || !Number.isFinite(Number(success.time))) return null;
  const start = events.find(
    (event) =>
      event?.stage === "client-attempt-start" &&
      event.clientRunId === success.clientRunId &&
      Number.isFinite(Number(event.time)),
  );
  if (!start) return null;
  return Math.max(0, Number(success.time) - Number(start.time));
}

const report = {
  baseUrl,
  checkedAt: new Date().toISOString(),
  results,
};
console.log(JSON.stringify(report, null, 2));

if (results.some((result) => !result.ok)) {
  process.exit(1);
}

function parseSmokeJson(stdout) {
  const text = String(stdout || "").trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

function runCase(testCase, attempt) {
  const started = Date.now();
  const env = {
    ...process.env,
    BASE_URL: baseUrl,
    CDP_PORT: String(cdpPort++),
    ROUTE_FILTER: testCase.route,
    SCENARIO_FILTER: "vtracer-preset",
    INCLUDE_BATCH: "0",
    FIXTURE_PNG: testCase.fixture,
    FIXTURE_MAX_SIDE: "2600",
    VTRACER_PRESET_PATTERN: testCase.pattern,
  };

  const run = spawnSync(process.execPath, ["scripts/hybrid-browser-smoke.mjs"], {
    cwd: rootDir,
    env,
    encoding: "utf8",
    timeout: Math.max(90_000, testCase.maxMs + 45_000),
  });
  const elapsedMs = Date.now() - started;
  const parsed = parseSmokeJson(run.stdout);
  const routeResult = parsed?.routes?.[0] || null;
  const metrics = routeResult?.metrics || {};
  const conversionElapsedMs = getLatestClientConversionElapsedMs(routeResult);
  const measuredMs = conversionElapsedMs ?? elapsedMs;
  const outputDetectedColors = Number(metrics.outputDetectedColors || 0);
  const colorMetricAvailable = Number.isFinite(outputDetectedColors) && outputDetectedColors > 0;
  const ok =
    run.status === 0 &&
    routeResult?.ok === true &&
    routeResult?.previewDecoded === true &&
    routeResult?.engineUsed === "vtracer" &&
    measuredMs <= testCase.maxMs &&
    (!colorMetricAvailable || outputDetectedColors >= testCase.minColors);

  return {
    route: testCase.route,
    preset: testCase.preset,
    fixture: path.basename(testCase.fixture),
    attempt,
    elapsedMs,
    conversionElapsedMs,
    maxMs: testCase.maxMs,
    engineUsed: routeResult?.engineUsed || null,
    selectedPreset: routeResult?.selectedPreset || null,
    metrics,
    ok,
    failure: ok
      ? null
      : routeResult?.failure ||
        run.error?.message ||
        run.stderr?.slice(-1000) ||
        `Preset exceeded ${testCase.maxMs}ms or did not render.`,
  };
}
