import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const runName = "run2-high-fidelity-remeasurement";
process.env.HF_BROWSER_OUTPUT_RUN_NAME = runName;
const {
  renderComparison, validateHighFidelityFlatResult, validateQualityTierResult,
  validateProgressiveQualityTierComparison, validateQualityTierFamilyCollapse,
  qualityTierSourceDetailScore,
} = await import("./high-fidelity-browser-output-smoke.mjs");
const root = path.resolve(import.meta.dirname, "..");
const inputReport = process.argv[2] || "tmp/baseline-high-fidelity-report.json";
const outputDirectory = path.join(root, "tmp", runName);
await fs.mkdir(path.join(outputDirectory, "renders"), { recursive: true });
const original = JSON.parse(await fs.readFile(inputReport, "utf8"));
const candidate = structuredClone(original);
const renderByScenario = new Map();
const hashes = [];
for (const row of [...candidate.flatColor, ...candidate.qualityTierComparison]) {
  assert.match(row.scenarioId, /^[a-z0-9_-]+$/i);
  if (!renderByScenario.has(row.scenarioId)) {
    const source = path.join(root, "tests", "fixtures", path.basename(row.fixture.basename));
    const svg = path.join(root, "tmp", "baseline-high-fidelity-artifacts", "downloads", row.scenarioId, "converted.svg");
    const data = await fs.readFile(svg);
    hashes.push({ scenarioId: row.scenarioId, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") });
    renderByScenario.set(row.scenarioId, await renderComparison(source, svg, row.scenarioId));
  }
  row.render = renderByScenario.get(row.scenarioId);
}
candidate.failures = [
  ...candidate.flatColor.flatMap(validateHighFidelityFlatResult),
  ...candidate.qualityTierComparison.flatMap(validateQualityTierResult),
  ...validateProgressiveQualityTierComparison(candidate.qualityTierComparison),
  ...validateQualityTierFamilyCollapse(candidate.qualityTierComparison),
];
const classify = reason => /painted coverage/.test(reason) ? "alpha-coverage" :
  /no longer source-constrained/.test(reason) ? "dark-appearance" :
  /did not improve source-supported detail score/.test(reason) ? "progressive-score" :
  /did not materially improve/.test(reason) ? "amazing-detail-gain" :
  /identical SVG output signatures/.test(reason) ? "same-fixture-family-collapse" :
  /grouped layer count regressed/.test(reason) ? "fixed-layer-minimum" :
  /numeric precision/.test(reason) ? "coordinate-precision" : "other";
const summarize = rows => rows.reduce((counts, row) => { const kind=classify(row.reason); counts[kind]=(counts[kind]||0)+1;return counts; },{});
const report = {
  observation: "Read-only remeasurement of preserved exact SVG outputs, with white display compositing corrected; no tracing or thresholds changed.",
  originalReport: inputReport,
  before: { failures: original.failures.length, groups: summarize(original.failures) },
  after: { failures: candidate.failures.length, groups: summarize(candidate.failures) },
  hashes,
  measurements: candidate.qualityTierComparison.map((row, index) => ({
    scenarioId: row.scenarioId,
    previousDark: original.qualityTierComparison[index].render.pairedDetailMetrics.outputDarkPixelShare,
    displayDark: row.render.pairedDetailMetrics.outputDarkPixelShare,
    previousScore: qualityTierSourceDetailScore(original.qualityTierComparison[index]),
    displayScore: qualityTierSourceDetailScore(row),
    coverage: row.render.outputAlphaMetrics,
  })),
  failures: candidate.failures,
};
await fs.writeFile(path.join(outputDirectory, "remeasured-report.json"), JSON.stringify(candidate,null,2));
await fs.writeFile(path.join(outputDirectory, "triage-summary.json"), JSON.stringify(report,null,2));
console.log(JSON.stringify({ before:report.before,after:report.after,uniqueSvgFiles:hashes.length,artifacts:path.relative(root,outputDirectory) },null,2));
