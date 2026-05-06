import {
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  hasOutputAppearanceChanges,
  normalizeOutputAppearance,
} from "../app/client/lib/converter/outputAppearance.ts";

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

console.log("[post-processing-smoke] ok");
