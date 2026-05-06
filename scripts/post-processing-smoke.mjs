import {
  DEFAULT_OUTPUT_APPEARANCE,
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  hasOutputAppearanceChanges,
  normalizeOutputAppearance,
} from "../app/client/lib/converter/outputAppearance.ts";
import { injectFillStrokeOutlineGroup } from "../app/shared/tracing/fillStrokeSvg.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, needle, message) {
  assert(String(source).includes(needle), `${message}: missing ${JSON.stringify(needle)}`);
}

function assertNotIncludes(source, needle, message) {
  assert(!String(source).includes(needle), `${message}: unexpected ${JSON.stringify(needle)}`);
}

function extractGroup(svg, marker) {
  const markerIndex = svg.indexOf(marker);
  if (markerIndex < 0) return "";
  const groupStart = svg.lastIndexOf("<g", markerIndex);
  const groupEnd = svg.indexOf("</g>", markerIndex);
  return groupStart >= 0 && groupEnd >= 0 ? svg.slice(groupStart, groupEnd + 4) : "";
}

function assertNoBrokenUrlReferences(svg) {
  const ids = new Set([...String(svg).matchAll(/\sid=(["'])([^"']+)\1/g)].map((match) => match[2]));
  for (const match of String(svg).matchAll(/url\(#([^)]+)\)/g)) {
    assert(ids.has(match[1]), `missing SVG def for url(#${match[1]})`);
  }
}

function assertNoDuplicateIds(svg) {
  const counts = new Map();
  for (const match of String(svg).matchAll(/\sid=(["'])([^"']+)\1/g)) {
    counts.set(match[2], (counts.get(match[2]) || 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `${id} x${count}`);
  assert(duplicates.length === 0, `duplicate SVG IDs found: ${duplicates.join(", ")}`);
}

const fixtureSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><defs><style>.keep{fill:#0f172a}</style></defs><path fill="#ffffff" d="M0 0H100V80H0Z"/><path id="subject" fill="#f97316" d="M20 20H70V60H20Z"/><path fill="none" stroke="#111827" stroke-width="2" d="M10 10L90 70"/></svg>';

const support = detectOutputAppearanceSupport(fixtureSvg);
const defaults = normalizeOutputAppearance();
const defaultOutput = applyOutputAppearanceToSvg(fixtureSvg, defaults, support, {
  idPrefix: "pp-default",
});

assert(defaultOutput === fixtureSvg, "default post-processing must be a byte-for-byte no-op");
assert(!hasOutputAppearanceChanges(defaults), "default appearance should not count as changed");

const sticker = normalizeOutputAppearance({
  stickerBorderEnabled: true,
  stickerBorderWidth: 8,
  stickerBorderColor: "#ff00aa",
  stickerBorderJoin: "round",
});
const stickerSvg = applyOutputAppearanceToSvg(fixtureSvg, sticker, support, {
  idPrefix: "pp-sticker",
});
assert(hasOutputAppearanceChanges(sticker), "enabled sticker border should count as changed");
assertIncludes(stickerSvg, 'data-post-processing="sticker-border"', "sticker border group should be emitted");
assertIncludes(stickerSvg, 'stroke="#ff00aa"', "sticker border should use requested color");
assertIncludes(stickerSvg, 'stroke-width="8"', "sticker border should use requested thickness");
const stickerGroup = extractGroup(stickerSvg, 'data-post-processing="sticker-border"');
assertNotIncludes(stickerGroup, "M0 0H100V80H0Z", "sticker border should not stroke the full canvas background");
assert(
  stickerSvg.indexOf('data-post-processing="sticker-border"') <
    stickerSvg.indexOf('id="subject"'),
  "sticker border should render behind the original artwork",
);

const shapeStickerFixture =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect id="canvas-rect" fill="#ffffff" width="100" height="80"/><circle id="shape-subject" fill="#f97316" cx="50" cy="40" r="16"/></svg>';
const shapeStickerSupport = detectOutputAppearanceSupport(shapeStickerFixture);
assert(shapeStickerSupport.supportsStickerBorder, "sticker border should support foreground filled SVG shapes");
const shapeStickerSvg = applyOutputAppearanceToSvg(
  shapeStickerFixture,
  sticker,
  shapeStickerSupport,
  { idPrefix: "pp-shape-sticker" },
);
const shapeStickerGroup = extractGroup(shapeStickerSvg, 'data-post-processing="sticker-border"');
assertIncludes(shapeStickerGroup, 'cx="50"', "sticker border should include foreground shape geometry");
assertNotIncludes(shapeStickerGroup, 'id="canvas-rect"', "sticker border should exclude full-canvas rect backgrounds");
assertNoDuplicateIds(shapeStickerSvg);

const backgroundOnlySupport = detectOutputAppearanceSupport(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect fill="#ffffff" width="100" height="80"/></svg>',
);
assert(!backgroundOnlySupport.supportsStickerBorder, "sticker border should not be enabled for background-only SVGs");
assert(!backgroundOnlySupport.supportsInternalGapFill, "gap fill should not be enabled for background-only SVGs");

const gapSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  {
    stickerBorderEnabled: true,
    stickerBorderWidth: 4,
    stickerBorderColor: "#00aaff",
    internalGapFillEnabled: true,
    internalGapFillColor: "#00aaff",
  },
  support,
  { idPrefix: "pp-gap" },
);
assertIncludes(gapSvg, 'data-post-processing="internal-gap-fill"', "internal gap fill group should be emitted when enabled");
assertIncludes(gapSvg, 'data-gap-fill-shape="true"', "internal gap fill should emit closed subpath fill shapes");
assertIncludes(gapSvg, 'fill="#00aaff"', "internal gap fill should use the requested gap color");
assertIncludes(gapSvg, 'id="subject" fill="#f97316"', "internal gap fill should preserve original filled artwork");

const gradientSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  {
    gradientEnabled: true,
    gradientType: "linear",
    gradientStartColor: "#ff0000",
    gradientEndColor: "#0000ff",
    gradientAngle: 45,
  },
  support,
  { idPrefix: "pp-grad" },
);
assertIncludes(gradientSvg, '<linearGradient id="pp-grad-gradient-fill"', "gradient fill should define a unique linear gradient");
assertIncludes(gradientSvg, 'fill="url(#pp-grad-gradient-fill)"', "gradient fill should apply to filled shapes");
assertNoBrokenUrlReferences(gradientSvg);
assertNoDuplicateIds(gradientSvg);

const patternSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  {
    patternEnabled: true,
    patternType: "dots",
    patternColor: "#111111",
    patternBackgroundTransparent: true,
    patternScale: 10,
  },
  support,
  { idPrefix: "pp-pattern" },
);
assertIncludes(patternSvg, '<pattern id="pp-pattern-pattern-fill"', "pattern fill should define a unique pattern");
assertIncludes(patternSvg, 'fill="url(#pp-pattern-pattern-fill)"', "pattern fill should apply to filled shapes");
assertNoBrokenUrlReferences(patternSvg);
assertNoDuplicateIds(patternSvg);

const shadowSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  {
    shadowEnabled: true,
    shadowType: "shadow",
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 3,
    shadowOpacity: 0.5,
  },
  support,
  { idPrefix: "pp-shadow" },
);
assertIncludes(shadowSvg, '<filter id="pp-shadow-shadow-effect"', "shadow should define a filter");
assertIncludes(shadowSvg, 'filter="url(#pp-shadow-shadow-effect)"', "shadow should wrap visible artwork with the filter");
assertNoBrokenUrlReferences(shadowSvg);
assertNoDuplicateIds(shadowSvg);

const collisionFixture =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><defs><linearGradient id="pp-collision-gradient-fill"><stop offset="0%" stop-color="#fff"/></linearGradient><pattern id="pp-collision-pattern-fill" width="4" height="4"/><filter id="pp-collision-shadow-effect"/></defs><path fill="#f97316" d="M20 20H70V60H20Z"/></svg>';
const collisionSupport = detectOutputAppearanceSupport(collisionFixture);
const collisionGradientSvg = applyOutputAppearanceToSvg(
  collisionFixture,
  { gradientEnabled: true },
  collisionSupport,
  { idPrefix: "pp-collision" },
);
assertNoDuplicateIds(collisionGradientSvg);
assertNoBrokenUrlReferences(collisionGradientSvg);
assertIncludes(collisionGradientSvg, 'fill="url(#pp-collision-gradient-fill-2)"', "gradient IDs should avoid existing source IDs");

const collisionPatternSvg = applyOutputAppearanceToSvg(
  collisionFixture,
  { patternEnabled: true },
  collisionSupport,
  { idPrefix: "pp-collision" },
);
assertNoDuplicateIds(collisionPatternSvg);
assertNoBrokenUrlReferences(collisionPatternSvg);
assertIncludes(collisionPatternSvg, 'fill="url(#pp-collision-pattern-fill-2)"', "pattern IDs should avoid existing source IDs");

const collisionShadowSvg = applyOutputAppearanceToSvg(
  collisionFixture,
  { shadowEnabled: true },
  collisionSupport,
  { idPrefix: "pp-collision" },
);
assertNoDuplicateIds(collisionShadowSvg);
assertNoBrokenUrlReferences(collisionShadowSvg);
assertIncludes(collisionShadowSvg, 'filter="url(#pp-collision-shadow-effect-2)"', "filter IDs should avoid existing source IDs");

const multiOutputSvg = [
  applyOutputAppearanceToSvg(fixtureSvg, { gradientEnabled: true }, support, { idPrefix: "output-a" }),
  applyOutputAppearanceToSvg(fixtureSvg, { patternEnabled: true }, support, { idPrefix: "output-b" }),
  applyOutputAppearanceToSvg(fixtureSvg, { shadowEnabled: true }, support, { idPrefix: "output-c" }),
];
assertIncludes(multiOutputSvg[0], 'fill="url(#output-a-gradient-fill)"', "first output should keep its own gradient ID");
assertIncludes(multiOutputSvg[1], 'fill="url(#output-b-pattern-fill)"', "second output should keep its own pattern ID");
assertIncludes(multiOutputSvg[2], 'filter="url(#output-c-shadow-effect)"', "third output should keep its own filter ID");
multiOutputSvg.forEach((svg) => {
  assertNoDuplicateIds(svg);
  assertNoBrokenUrlReferences(svg);
});

const precisionSupport = detectOutputAppearanceSupport(fixtureSvg, {
  precisionOutput: true,
});
const precisionShadow = applyOutputAppearanceToSvg(
  fixtureSvg,
  { shadowEnabled: true },
  precisionSupport,
  { idPrefix: "pp-cut" },
);
assert(!precisionSupport.supportsShadowEffect, "shadow/glow should be disabled for precision outputs");
assertNotIncludes(precisionShadow, 'data-post-processing="shadow-effect"', "precision output should not silently add shadow filters");

const weightedSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  { lineWeight: 2 },
  support,
  { idPrefix: "pp-weight" },
);
assertIncludes(weightedSvg, 'stroke-width="4"', "existing line weight control should still update real strokes");

const stickerOnlySvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  {
    stickerBorderEnabled: true,
    stickerBorderWidth: 8,
    stickerBorderColor: "#ff00aa",
    internalGapFillEnabled: false,
  },
  support,
  { idPrefix: "pp-reset" },
);
assertIncludes(stickerOnlySvg, 'data-post-processing="sticker-border"', "sticker reset isolation fixture should keep sticker border");
assertNotIncludes(stickerOnlySvg, 'data-post-processing="internal-gap-fill"', "gap reset should remove only internal gap fill");

const allEffectsSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  {
    stickerBorderEnabled: true,
    stickerBorderWidth: 8,
    internalGapFillEnabled: true,
    gradientEnabled: true,
    patternEnabled: true,
    shadowEnabled: true,
  },
  support,
  { idPrefix: "pp-reset-all" },
);
assertIncludes(allEffectsSvg, 'data-post-processing="sticker-border"', "reset-all fixture should include sticker border before reset");
assertIncludes(allEffectsSvg, 'data-post-processing="internal-gap-fill"', "reset-all fixture should include gap fill before reset");
assertIncludes(allEffectsSvg, 'id="pp-reset-all-gradient-fill"', "reset-all fixture should include gradient before reset");
assertIncludes(allEffectsSvg, 'id="pp-reset-all-pattern-fill"', "reset-all fixture should include pattern before reset");
assertIncludes(allEffectsSvg, 'id="pp-reset-all-shadow-effect"', "reset-all fixture should include shadow before reset");
const resetAllSvg = applyOutputAppearanceToSvg(
  fixtureSvg,
  DEFAULT_OUTPUT_APPEARANCE,
  support,
  { idPrefix: "pp-reset-all" },
);
assert(resetAllSvg === fixtureSvg, "reset all post-processing should restore the original SVG string");

const fillStrokeFixture =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><path id="canvas" fill="#ffffff" d="M0 0H100V80H0Z"/><path id="subject-fill" fill="#f97316" d="M20 20H70V60H20Z"/></svg>';
const fillStrokeSvg = injectFillStrokeOutlineGroup(fillStrokeFixture, {
  fillStrokeWidth: 6,
  fillStrokeColor: "#111111",
});
const fillStrokeGroup = extractGroup(fillStrokeSvg, 'data-layer-id="fill-stroke-outline"');
assertIncludes(fillStrokeGroup, 'd="M20 20H70V60H20Z"', "fill+stroke outline should include foreground filled paths");
assertNotIncludes(fillStrokeGroup, 'id="canvas"', "fill+stroke outline should not stroke the full-canvas background");
assertNoDuplicateIds(fillStrokeSvg);
assert(
  fillStrokeSvg.indexOf('id="subject-fill"') < fillStrokeSvg.indexOf('data-layer-id="fill-stroke-outline"'),
  "fill+stroke outline layer should render above filled artwork",
);

console.log("[post-processing-smoke] ok");
