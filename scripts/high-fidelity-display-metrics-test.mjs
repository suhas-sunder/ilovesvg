import assert from "node:assert/strict";
import sharp from "sharp";
import {
  displayRgb,
  imageDarkMetrics,
  imageAlphaMetrics,
  pairedSourceOutputDetailMetrics,
  validateRenderMetrics,
  validateHighFidelityFlatResult,
  validatePresetTriageResult,
} from "./high-fidelity-browser-output-smoke.mjs";

const transparentBlack = await sharp(Buffer.from([0, 0, 0, 0, 255, 255, 255, 255]), {
  raw: { width: 2, height: 1, channels: 4 },
}).png().toBuffer();
const legacy = await sharp(transparentBlack).removeAlpha().raw().toBuffer();
assert.equal(imageDarkMetrics(legacy).darkPixelShare, 0.5, "baseline proves invisible RGB is counted as black");
const displayed = await displayRgb(transparentBlack, 2, 1);
assert.deepEqual([...displayed], [255, 255, 255, 255, 255, 255], "transparent RGB must composite onto the visible white sheet");
assert.equal(imageDarkMetrics(displayed).darkPixelShare, 0);
const alpha = await sharp(transparentBlack).ensureAlpha().raw().toBuffer();
assert.equal(imageAlphaMetrics(alpha).paintedCoverage, 0.5, "alpha coverage is measured separately and must not be flattened");

const semitransparent = await sharp(Buffer.from([0, 0, 0, 128, 30, 120, 220, 255]), {
  raw: { width: 2, height: 1, channels: 4 },
}).png().toBuffer();
const reference = await sharp({ create: { width: 2, height: 1, channels: 3, background: "white" } })
  .composite([{ input: semitransparent }]).removeAlpha().raw().toBuffer();
const actual = await displayRgb(semitransparent, 2, 1);
assert.ok(actual.every((value, index) => Math.abs(value - reference[index]) <= 1), "partial alpha must match independently composited display within rounding");
assert.deepEqual([...actual.subarray(3)], [30, 120, 220], "opaque RGB must remain unchanged");

const white = Buffer.from([255, 255, 255, 255, 255, 255]);
const result = output => ({
  scenarioId: "transparent-metric-proof", presetId: "layered-flat-color-high-quality",
  render: {
    sourceMetrics: imageDarkMetrics(white), outputMetrics: imageDarkMetrics(output),
    pairedDetailMetrics: pairedSourceOutputDetailMetrics(white, output, 2, 1),
  },
});
assert.ok(validateRenderMetrics(result(legacy), "proof").some(row => /no longer source-constrained/.test(row.reason)), "baseline metric must reproduce false dark-detail failure");
assert.equal(validateRenderMetrics(result(displayed), "proof").length, 0, "visible white-on-white comparison must not fail darkness checks");
const flat = {
  scenarioId: "current-flat-preset", presetId: "layered-flat-color", presetLabel: "Layered - Flat Color",
  fixture: { basename: "synthetic.png", bytes: 1000, width: 100, height: 100 },
  selectedPreset: { selected: "Layered - Flat Color" }, completed: true,
  ui: { outputTitle: "Layered - Flat Color", settingsOpened: true, layerTotalCount: 15, requestedPaletteCount: 16 },
  download: { bytes: 500 }, copyDownloadParity: { ok: true },
  svg: { width: 100, height: 100, visibleColorCount: 15 },
  structure: { totalBytes: 500, pathCount: 15, averageDecimalPlaces: 2 },
};
assert.deepEqual(validateHighFidelityFlatResult(flat), [], "a current 16-color request may merge to 15 editable colors; it cannot require 20");
assert.ok(validateHighFidelityFlatResult({ ...flat, ui: { ...flat.ui, layerTotalCount: 17 } }).some(row => /processing budget/.test(row.reason)), "measured palette budget remains enforced");
assert.ok(validateHighFidelityFlatResult({ ...flat, ui: { ...flat.ui, layerTotalCount: 0 } }).some(row => /no editable layers/.test(row.reason)), "empty output remains a failure");
const failedPreset = validatePresetTriageResult({ presetId: "layered-flat-color", presetLabel: "Flat", fixture: { basename: "own-fixture.png" }, completed: false });
assert.ok(failedPreset.length > 0 && failedPreset.every(row => row.fixture === "own-fixture.png"), "a failing preset must report its own fixture instead of throwing an undefined-variable error");
console.log("High-fidelity display metrics passed: transparent RGB, independent alpha coverage, partial alpha, opaque color, and baseline false-positive reproduction.");
