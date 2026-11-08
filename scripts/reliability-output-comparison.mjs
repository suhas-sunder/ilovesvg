import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const read = async file => JSON.parse(await readFile(file, 'utf8'));
if (![4, 6].includes(args.length)) throw new Error('Usage: node scripts/reliability-output-comparison.mjs baseline-browser.json candidate-browser.json baseline-quality.json candidate-quality.json [corrected-baseline-focused.json corrected-candidate-focused.json]');
const [before, after, qualityBefore, qualityAfter, focusedBefore, focusedAfter] = await Promise.all(args.map(read));
const key = row => `${row.route}|${row.scenario}`;
const corroborated = new Set();
if (focusedBefore && focusedAfter) {
  for (const candidate of focusedAfter.routes) {
    const baseline = focusedBefore.routes.find(row => key(row) === key(candidate));
    assert.ok(baseline && baseline.ok && candidate.ok, 'corrected focused workflow must pass on both builds');
    for (const row of [baseline, candidate]) {
      const identity = row.outputIdentity;
      assert.ok(identity?.presetId && identity?.expectedClientRunId, 'focused evidence must identify the intended preset/job');
      assert.equal(identity.expectedClientRunId, identity.completedClientRunId);
      assert.equal(identity.cardStatus, 'succeeded');
      assert.ok(Number(identity.cardStamp) >= identity.completionTime);
      assert.ok(identity.cardHeading.includes(identity.expectedPreset));
    }
    assert.equal(candidate.outputIdentity.presetId, baseline.outputIdentity.presetId);
    assert.equal(candidate.actions.downloadSha256, baseline.actions.downloadSha256);
    assert.equal(candidate.actions.copySha256, baseline.actions.copySha256);
    corroborated.add(key(candidate));
  }
}
assert.equal(after.routes.length, before.routes.length, 'same full browser corpus must run');
const previous = new Map(before.routes.map(row => [key(row), row]));
const compared = [];
const harnessRaces = [];
for (const row of after.routes) {
  const old = previous.get(key(row));
  assert.ok(old, `missing baseline ${key(row)}`);
  assert.equal(row.ok, true, `candidate workflow failed ${key(row)}`);
  for (const field of ['downloadSha256', 'copySha256']) {
    assert.ok(old.actions?.[field], `missing baseline ${field} for ${key(row)}`);
    if (row.actions?.[field] !== old.actions[field]) {
      assert.ok(corroborated.has(key(row)), `output changed without corrected same-job proof ${key(row)} ${field}`);
      if (!harnessRaces.includes(key(row))) harnessRaces.push(key(row));
    }
  }
  compared.push(key(row));
}
const allQuality = report => ['flatColor', 'qualityTierComparison'].flatMap(section =>
  report[section].map(row => ({ ...row, comparisonId: `${section}:${row.scenarioId}` })));
const qualityIndex = new Map(allQuality(qualityBefore).map(row => [row.comparisonId, row]));
assert.equal(allQuality(qualityAfter).length, qualityIndex.size);
for (const row of allQuality(qualityAfter)) {
  const old = qualityIndex.get(row.comparisonId);
  assert.ok(old, `new quality scenario ${row.scenarioId}`);
  assert.equal(row.completed, true, `candidate did not finish ${row.scenarioId}`);
  const hash = item => item.download?.hash || item.downloadHash;
  assert.ok(hash(old) && hash(row), `missing downloaded output hash ${row.comparisonId}`);
  assert.equal(hash(row), hash(old), `quality SVG changed ${row.scenarioId}`);
  assert.deepEqual(row.svg, old.svg, `quality geometry/colors changed ${row.scenarioId}`);
  assert.deepEqual(row.structure, old.structure, `quality paths/layers changed ${row.scenarioId}`);
  assert.deepEqual(row.render?.outputMetrics, old.render?.outputMetrics, `render metrics changed ${row.scenarioId}`);
  assert.deepEqual(row.render?.outputAlphaMetrics, old.render?.outputAlphaMetrics, `alpha changed ${row.scenarioId}`);
}
const failureKey = row => `${row.scenarioId}|${row.reason}`;
assert.deepEqual(qualityAfter.failures.map(failureKey).sort(), qualityBefore.failures.map(failureKey).sort(), 'quality failure inventory must not worsen or silently disappear');
const report = { browserScenarios: compared.length, broadSignaturesIdentical: compared.length - harnessRaces.length, correctedSameJobParity: [...corroborated], originalHarnessRaces: harnessRaces, highFidelityScenarios: qualityIndex.size, unchangedQualityFailures: qualityBefore.failures.length, note: 'Parity preserves the existing quality baseline; it does not make pre-existing quality failures pass. Original race-affected reports are retained; focused proof must match the intended completed job on both builds.' };
console.log(JSON.stringify(report, null, 2));
if (process.env.RELIABILITY_COMPARISON_REPORT) await writeFile(process.env.RELIABILITY_COMPARISON_REPORT, JSON.stringify(report, null, 2));
