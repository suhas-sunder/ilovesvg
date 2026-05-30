import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REPORT_PATH =
  process.env.SVG_COMPRESSION_RESEARCH_REPORT_PATH ||
  path.join(ROOT, "tmp", "svg-compression-research.json");

const GENERATED_AT = new Date().toISOString();

const byteSize = (value) => Buffer.byteLength(String(value), "utf8");

const percentSaved = (before, after) =>
  before > 0 ? Number(((1 - after / before) * 100).toFixed(2)) : 0;

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const roundNumber = (value, precision) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  const rounded = Number(numeric.toFixed(precision));
  if (Object.is(rounded, -0)) {
    return "0";
  }
  let text = String(rounded);
  if (text.startsWith("0.")) {
    text = text.slice(1);
  } else if (text.startsWith("-0.")) {
    text = `-${text.slice(2)}`;
  }
  return text;
};

const compactNumberList = (value) =>
  String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .replace(/ ?([A-Za-z]) ?/g, "$1")
    .replace(/,?(-?\.\d+)/g, "$1")
    .replace(/(-?\d+)\.0+\b/g, "$1")
    .replace(/(\.\d*?)0+\b/g, "$1")
    .replace(/\s?-\s?/g, "-")
    .replace(/,+/g, ",")
    .trim();

const compactPathData = (value) =>
  compactNumberList(value)
    .replace(/([A-Za-z]),/g, "$1")
    .replace(/,([A-Za-z])/g, "$1")
    .replace(/(\d)-/g, "$1-")
    .replace(/\s*([A-Za-z])\s*/g, "$1")
    .replace(/\s+/g, " ");

const minifyAttributeValue = (svg, attrName, mapper) =>
  svg.replace(
    new RegExp(`\\s${attrName}\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi"),
    (match, full, doubleValue, singleValue) => {
      const quote = full.startsWith("'") ? "'" : '"';
      const value = doubleValue ?? singleValue ?? "";
      return ` ${attrName}=${quote}${mapper(value)}${quote}`;
    },
  );

const minifyStyleAttributes = (svg) =>
  svg.replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (_match, full, doubleValue, singleValue) => {
    const quote = full.startsWith("'") ? "'" : '"';
    const value = doubleValue ?? singleValue ?? "";
    const minified = value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) =>
        part
          .replace(/\s*:\s*/g, ":")
          .replace(/\s*,\s*/g, ",")
          .replace(/\s+/g, " "),
      )
      .join(";");
    return ` style=${quote}${minified}${quote}`;
  });

const collapseTagWhitespace = (svg) =>
  svg.replace(/<[^>]+>/g, (tag) =>
    tag
      .replace(/\s+/g, " ")
      .replace(/\s*=\s*/g, "=")
      .replace(/\s+\/>/g, "/>")
      .trim(),
  );

const ensureSvgXmlns = (svg) => {
  if (!/<svg\b/i.test(svg) || /\sxmlns\s*=/i.test(svg)) {
    return svg;
  }
  return svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
};

const removeEditorNamespacesAndAttrs = (svg) =>
  svg
    .replace(/\sxmlns:(?:inkscape|sodipodi|cc|dc|rdf)="[^"]*"/gi, "")
    .replace(/\s(?:inkscape|sodipodi):[A-Za-z0-9_.:-]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\senable-background\s*=\s*"[^"]*"/gi, "");

const removeCommonBoilerplate = (svg) =>
  ensureSvgXmlns(svg)
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");

const removeEmptyAttrs = (svg) =>
  svg.replace(/\s[A-Za-z_:][-A-Za-z0-9_:.]*\s*=\s*(?:""|'')/g, "");

const removeEmptyContainers = (svg) => {
  let next = svg;
  for (let pass = 0; pass < 5; pass += 1) {
    const previous = next;
    next = next.replace(/<(g|defs|symbol|clipPath|mask)\b([^>]*)>\s*<\/\1>/gi, "");
    if (next === previous) {
      break;
    }
  }
  return next;
};

const removeUnusedDefsBestEffort = (svg) =>
  svg.replace(/<defs\b[^>]*>([\s\S]*?)<\/defs>/gi, (defsMatch, defsBody) => {
    const kept = [];
    for (const element of defsBody.match(/<([A-Za-z][\w:-]*)\b[^>]*\bid\s*=\s*["'][^"']+["'][\s\S]*?(?:<\/\1>|\/>)/g) || []) {
      const id = element.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!id) {
        kept.push(element);
        continue;
      }
      const outsideDefs = svg.replace(defsMatch, "");
      const referenced =
        new RegExp(`url\\(\\s*#${escapeRegExp(id)}\\s*\\)`).test(outsideDefs) ||
        new RegExp(`(?:href|xlink:href)\\s*=\\s*["']#${escapeRegExp(id)}["']`, "i").test(outsideDefs);
      if (referenced) {
        kept.push(element);
      }
    }
    return kept.length ? `<defs>${kept.join("")}</defs>` : "";
  });

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const spacingMinify = (input) => {
  let svg = String(input).replace(/\r\n?/g, "\n");
  svg = minifyStyleAttributes(svg);
  svg = minifyAttributeValue(svg, "d", compactPathData);
  svg = minifyAttributeValue(svg, "points", compactNumberList);
  svg = minifyAttributeValue(svg, "transform", compactNumberList);
  svg = collapseTagWhitespace(svg);
  return svg.replace(/>\s+</g, "><").replace(/\n+/g, "").trim();
};

const currentMinifierDefaults = (input) => {
  let svg = removeCommonBoilerplate(input);
  svg = removeEditorNamespacesAndAttrs(svg);
  svg = minifyStyleAttributes(svg);
  svg = minifyAttributeValue(svg, "d", compactPathData);
  svg = minifyAttributeValue(svg, "points", compactNumberList);
  svg = minifyAttributeValue(svg, "transform", compactNumberList);
  svg = removeEmptyAttrs(svg);
  svg = collapseTagWhitespace(svg);
  return svg.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
};

const safeStructural = (input) => {
  let svg = currentMinifierDefaults(input);
  svg = removeUnusedDefsBestEffort(svg);
  svg = removeEmptyContainers(svg);
  return spacingMinify(svg);
};

const roundGeometryValues = (input, precision) => {
  let svg = safeStructural(input);
  const roundList = (value) =>
    value.replace(/-?(?:\d*\.\d+|\d+\.)(?:e[-+]?\d+)?/gi, (number) =>
      roundNumber(number, precision),
    );
  svg = minifyAttributeValue(svg, "d", (value) => compactPathData(roundList(value)));
  svg = minifyAttributeValue(svg, "points", (value) => compactNumberList(roundList(value)));
  svg = minifyAttributeValue(svg, "transform", (value) => compactNumberList(roundList(value)));
  svg = minifyAttributeValue(svg, "x", (value) => roundNumber(value, precision));
  svg = minifyAttributeValue(svg, "y", (value) => roundNumber(value, precision));
  svg = minifyAttributeValue(svg, "cx", (value) => roundNumber(value, precision));
  svg = minifyAttributeValue(svg, "cy", (value) => roundNumber(value, precision));
  svg = minifyAttributeValue(svg, "r", (value) => roundNumber(value, precision));
  svg = minifyAttributeValue(svg, "rx", (value) => roundNumber(value, precision));
  svg = minifyAttributeValue(svg, "ry", (value) => roundNumber(value, precision));
  return spacingMinify(svg);
};

const cleanupIdsBestEffort = (input) => {
  let svg = safeStructural(input);
  if (/<(?:script|style)\b/i.test(svg)) {
    return svg;
  }
  const ids = [...svg.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const unique = [...new Set(ids)];
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const nextName = (index) =>
    index < alphabet.length ? alphabet[index] : `i${index - alphabet.length}`;
  const replacements = new Map();
  unique.forEach((id, index) => {
    replacements.set(id, nextName(index));
  });
  for (const [from, to] of replacements) {
    const escaped = escapeRegExp(from);
    svg = svg
      .replace(new RegExp(`\\bid\\s*=\\s*(["'])${escaped}\\1`, "g"), `id="${to}"`)
      .replace(new RegExp(`url\\(\\s*#${escaped}\\s*\\)`, "g"), `url(#${to})`)
      .replace(new RegExp(`((?:href|xlink:href)\\s*=\\s*["'])#${escaped}(["'])`, "gi"), `$1#${to}$2`);
  }
  return spacingMinify(svg);
};

const stripEditorDataForExport = (input) => {
  let svg = cleanupIdsBestEffort(input);
  svg = svg
    .replace(/\sdata-(?:editor-opacity|layer-label|layer-color|layer-id|fill-layer-id|stroke-layer-id)\s*=\s*"[^"]*"/gi, "")
    .replace(/\sdata-(?:editor-opacity|layer-label|layer-color|layer-id|fill-layer-id|stroke-layer-id)\s*=\s*'[^']*'/gi, "");
  return spacingMinify(svg);
};

const extractSvgOpeningTag = (svg) => String(svg).match(/<svg\b[^>]*>/i)?.[0] || "";

const readAttr = (tag, name) =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || "";

const readDimensions = (svg) => {
  const tag = extractSvgOpeningTag(svg);
  return {
    width: readAttr(tag, "width"),
    height: readAttr(tag, "height"),
    viewBox: readAttr(tag, "viewBox"),
  };
};

const countMatches = (svg, regex) => (String(svg).match(regex) || []).length;

const visibleColorCount = (svg) => {
  const colors = new Set();
  for (const match of String(svg).matchAll(/(?:fill|stroke)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1].trim().toLowerCase();
    if (value && value !== "none" && !value.startsWith("url(")) {
      colors.add(value);
    }
  }
  for (const match of String(svg).matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    colors.add(match[0].toLowerCase());
  }
  return colors.size;
};

const hasLayerMetadata = (svg) =>
  /\bdata-(?:layer-id|fill-layer-id|stroke-layer-id|layer-label|layer-color)\s*=/i.test(svg);

const hasEditorMetadata = (svg) =>
  /<metadata\b|<!--|xmlns:(?:inkscape|sodipodi|rdf|cc|dc)|\b(?:inkscape|sodipodi):|\bdata-(?:editor|layer|fill-layer|stroke-layer)/i.test(svg);

const analyzeVariant = (sample, variant) => {
  const output = variant.run(sample.svg);
  const originalDimensions = readDimensions(sample.svg);
  const outputDimensions = readDimensions(output);
  const originalLayerMetadata = hasLayerMetadata(sample.svg);
  const outputLayerMetadata = hasLayerMetadata(output);
  const originalBytes = byteSize(sample.svg);
  const outputBytes = byteSize(output);

  return {
    id: variant.id,
    label: variant.label,
    bytes: outputBytes,
    savedBytes: originalBytes - outputBytes,
    savedPercent: percentSaved(originalBytes, outputBytes),
    sha256: sha256(output),
    dimensionsPreserved:
      originalDimensions.width === outputDimensions.width &&
      originalDimensions.height === outputDimensions.height,
    viewBoxPreserved: originalDimensions.viewBox === outputDimensions.viewBox,
    pathCount: countMatches(output, /<path\b/gi),
    groupCount: countMatches(output, /<g\b/gi),
    visibleColorCount: visibleColorCount(output),
    layerEditingWouldSurvive: !originalLayerMetadata || outputLayerMetadata,
    renderRisk: variant.renderRisk,
    editabilityRisk:
      originalLayerMetadata && !outputLayerMetadata ? "high" : variant.editabilityRisk,
    notes: variant.notes,
  };
};

const makeLayeredTraceSample = () => {
  const colors = ["#111827", "#2563eb", "#f97316", "#16a34a", "#facc15", "#db2777"];
  const groups = colors
    .map((color, groupIndex) => {
      const paths = Array.from({ length: 18 }, (_unused, pathIndex) => {
        const x = 8 + pathIndex * 9.842 + groupIndex * 1.23;
        const y = 10 + groupIndex * 24.61 + Math.sin(pathIndex) * 2.75;
        const w = 6.425 + (pathIndex % 5) * 0.635;
        const h = 9.825 + (groupIndex % 4) * 0.47;
        return `<path data-fill-layer-id="layer-${groupIndex}" d="M ${x.toFixed(4)} ${y.toFixed(4)} L ${(x + w).toFixed(4)} ${(
          y + 0.3187
        ).toFixed(4)} C ${(x + w + 1.31).toFixed(4)} ${(y + 3.6666).toFixed(4)}, ${(x + 1.12).toFixed(4)} ${(
          y + h
        ).toFixed(4)}, ${x.toFixed(4)} ${(y + h - 0.221).toFixed(4)} Z"/>`;
      }).join("\n      ");
      return `<g id="layer-${groupIndex}" data-layer-id="layer-${groupIndex}" data-layer-label="Layer ${groupIndex + 1}" data-layer-color="${color}" fill="${color}">
      ${paths}
    </g>`;
    })
    .join("\n    ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="900" height="640" viewBox="0 0 900 640" xmlns="http://www.w3.org/2000/svg">
  <metadata>Generated layered trace metadata that is useful to editors but not to renderers.</metadata>
  <!-- Layered trace with editable layer metadata. -->
  ${groups}
</svg>`;
};

const makeDetailPathSample = () => {
  const segments = Array.from({ length: 240 }, (_unused, index) => {
    const x = 42 + index * 2.41739;
    const y = 160 + Math.sin(index / 6) * 34.82917 + Math.cos(index / 13) * 11.492;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(5)} ${y.toFixed(5)}`;
  }).join(" ");
  return `<svg width="1024" height="768" viewBox="0 0 1024 768" xmlns="http://www.w3.org/2000/svg">
  <g fill="#101010">
    <path d="${segments} Z"/>
  </g>
</svg>`;
};

const makeEditorExportSample = () => `<svg
  width="512"
  height="512"
  viewBox="0 0 512 512"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  inkscape:version="1.3"
  sodipodi:docname="sample.svg">
  <!-- This is a designer note that does not affect rendering. -->
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>
  </metadata>
  <defs>
    <linearGradient id="used-gradient"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
    <linearGradient id="unused-gradient"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
  </defs>
  <title>Sample export</title>
  <desc>Readable title and desc can matter to accessibility.</desc>
  <g id="group-with-style" style=" fill : url(#used-gradient) ; stroke : #111827 ; stroke-width : 2.0000 ; ">
    <path id="designer-path-long-name" d="M 24.0000 42.5000 C 80.0000 11.1250, 140.3333 11.1250, 196.0000 42.5000 L 260.0000 242.0000 L 24.0000 242.0000 Z"/>
  </g>
</svg>`;

const makePostProcessedSample = () => `<svg width="720" height="420" viewBox="0 0 720 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="editor-shadow-filter"><feDropShadow dx="4.000" dy="5.000" stdDeviation="2.500" flood-color="#000000" flood-opacity="0.320"/></filter>
    <pattern id="editor-pattern" width="12.0000" height="12.0000" patternUnits="userSpaceOnUse"><path d="M 0 0 L 12 12" stroke="#0f172a"/></pattern>
  </defs>
  <g id="editable-layer-main" data-layer-id="editable-layer-main" data-layer-label="Main editable layer" data-layer-color="#14b8a6" data-editor-opacity="0.875" fill="url(#editor-pattern)" filter="url(#editor-shadow-filter)">
    <path data-fill-layer-id="editable-layer-main" d="M 61.2345 80.8765 L 652.3456 82.4567 L 612.2345 344.6789 L 89.8756 330.3456 Z"/>
    <path data-fill-layer-id="editable-layer-main" d="M 112.4567 131.9876 C 202.3333 91.7777, 411.2222 91.7777, 522.2222 137.5555 C 468.1111 214.2222, 215.4444 232.8888, 112.4567 131.9876 Z"/>
  </g>
</svg>`;

const makeStickerCutSample = () => `<svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
  <g id="border-layer" data-layer-id="border-layer" data-layer-label="Sticker border" data-layer-color="#ffffff" fill="#ffffff" stroke="#111827" stroke-width="8.000">
    <path data-stroke-layer-id="border-layer" d="M 58.0000 78.0000 C 136.2500 22.5000, 349.5000 25.7500, 431.0000 89.0000 C 502.0000 144.2500, 480.5000 350.7500, 392.0000 426.0000 C 295.5000 508.2500, 91.0000 461.0000, 42.0000 342.0000 C 1.2500 242.5000, 8.5000 113.7500, 58.0000 78.0000 Z"/>
  </g>
  <g id="art-layer" data-layer-id="art-layer" data-layer-label="Artwork" data-layer-color="#ef4444" fill="#ef4444">
    <path data-fill-layer-id="art-layer" d="M 130.2500 155.1250 L 362.8750 162.5000 L 340.7500 342.8750 L 151.1250 336.2500 Z"/>
  </g>
</svg>`;

const makeSimpleLogoSample = () => `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <circle cx="128.0000" cy="128.0000" r="98.5000" fill="#2563eb"/>
  <path fill="#ffffff" d="M 72.0000 136.0000 L 112.0000 176.0000 L 188.0000 82.0000"/>
</svg>`;

const readOptionalText = async (relativePath) => {
  try {
    return await fs.readFile(path.join(ROOT, relativePath), "utf8");
  } catch {
    return "";
  }
};

const collectSamples = async () => {
  const generated = [
    {
      id: "generated-simple-logo",
      source: "generated",
      description: "Small logo-like SVG with simple geometry.",
      svg: makeSimpleLogoSample(),
    },
    {
      id: "generated-editor-export",
      source: "generated",
      description: "Designer export with metadata, comments, editor namespaces, style attributes, and unused defs.",
      svg: makeEditorExportSample(),
    },
    {
      id: "generated-layered-trace",
      source: "generated",
      description: "Layered trace with many editable layer metadata attributes and path decimals.",
      svg: makeLayeredTraceSample(),
    },
    {
      id: "generated-detail-path",
      source: "generated",
      description: "Detailed single path with many decimal coordinates.",
      svg: makeDetailPathSample(),
    },
    {
      id: "generated-post-processed-output",
      source: "generated",
      description: "Edited converter output with filters, pattern fills, and editor metadata.",
      svg: makePostProcessedSample(),
    },
    {
      id: "generated-sticker-cut-file",
      source: "generated",
      description: "Cricut-style cut file with separate border and artwork layers.",
      svg: makeStickerCutSample(),
    },
  ];

  const optionalFiles = [
    ["app-welcome-logo-light", "app/welcome/logo-light.svg"],
    ["app-welcome-logo-dark", "app/welcome/logo-dark.svg"],
  ];

  const optional = [];
  for (const [id, relativePath] of optionalFiles) {
    const svg = await readOptionalText(relativePath);
    if (svg.trim()) {
      optional.push({
        id,
        source: relativePath,
        description: "Checked-in project SVG asset.",
        svg,
      });
    }
  }

  return [...generated, ...optional];
};

const variants = [
  {
    id: "current-route-defaults",
    label: "Current SVG Minifier Defaults",
    run: currentMinifierDefaults,
    renderRisk: "low",
    editabilityRisk: "low",
    notes: "Approximates app/routes/svg-minifier.tsx defaults: boilerplate, editor namespace, whitespace, style, path spacing, and empty-attribute cleanup.",
  },
  {
    id: "tiny-safe-structural",
    label: "Tiny Safe Structural",
    run: safeStructural,
    renderRisk: "low-to-medium",
    editabilityRisk: "low",
    notes: "Adds empty container removal and conservative unused defs cleanup while preserving title/desc and layer metadata.",
  },
  {
    id: "tiniest-precision-2",
    label: "Tiniest Geometry Precision 2",
    run: (svg) => roundGeometryValues(svg, 2),
    renderRisk: "medium",
    editabilityRisk: "low",
    notes: "Rounds geometry-bearing attributes to 2 decimals without changing root width, height, or viewBox.",
  },
  {
    id: "tiniest-cleanup-ids",
    label: "Tiniest Cleanup IDs",
    run: cleanupIdsBestEffort,
    renderRisk: "medium",
    editabilityRisk: "medium",
    notes: "Best-effort ID minification and reference rewriting. Skips documents with script/style, but still needs renderer tests.",
  },
  {
    id: "export-only-strip-editor-data",
    label: "Export-only Strip Editor Data",
    run: stripEditorDataForExport,
    renderRisk: "medium",
    editabilityRisk: "high",
    notes: "Removes layer/editor data attributes after export; render-oriented only and unsafe for the live layer editor.",
  },
];

const summarize = (samples) => {
  const byVariant = variants.map((variant) => {
    const rows = samples.map((sample) => sample.variants.find((row) => row.id === variant.id));
    const totalOriginal = samples.reduce((sum, sample) => sum + sample.original.bytes, 0);
    const totalVariant = rows.reduce((sum, row) => sum + row.bytes, 0);
    return {
      id: variant.id,
      label: variant.label,
      totalBytes: totalVariant,
      savedBytes: totalOriginal - totalVariant,
      savedPercent: percentSaved(totalOriginal, totalVariant),
      maxSampleSavedPercent: Math.max(...rows.map((row) => row.savedPercent)),
      minSampleSavedPercent: Math.min(...rows.map((row) => row.savedPercent)),
      failedDimensionChecks: rows.filter((row) => !row.dimensionsPreserved || !row.viewBoxPreserved).length,
      failedLayerMetadataChecks: rows.filter((row) => !row.layerEditingWouldSurvive).length,
    };
  });

  return {
    sampleCount: samples.length,
    totalOriginalBytes: samples.reduce((sum, sample) => sum + sample.original.bytes, 0),
    byVariant,
  };
};

const main = async () => {
  const rawSamples = await collectSamples();
  const samples = rawSamples.map((sample) => {
    const originalDimensions = readDimensions(sample.svg);
    const original = {
      bytes: byteSize(sample.svg),
      sha256: sha256(sample.svg),
      dimensions: originalDimensions,
      pathCount: countMatches(sample.svg, /<path\b/gi),
      groupCount: countMatches(sample.svg, /<g\b/gi),
      visibleColorCount: visibleColorCount(sample.svg),
      hasLayerMetadata: hasLayerMetadata(sample.svg),
      hasEditorMetadata: hasEditorMetadata(sample.svg),
    };
    return {
      id: sample.id,
      source: sample.source,
      description: sample.description,
      original,
      variants: variants.map((variant) => analyzeVariant(sample, variant)),
    };
  });

  const report = {
    ok: true,
    generatedAt: GENERATED_AT,
    baseUrl: process.env.BASE_URL || null,
    reportPath: path.relative(ROOT, REPORT_PATH).replaceAll("\\", "/"),
    summary: summarize(samples),
    samples,
    recommendations: {
      none: "Return the live/current SVG unchanged.",
      tiny:
        "Use safe structural cleanup that preserves dimensions, viewBox, IDs required by rendering, and all layer/editor metadata.",
      tiniest:
        "Use opt-in export-only cleanup with precision rounding and ID/data stripping only after visual/editability tests prove the tradeoff is acceptable.",
    },
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        reportPath: report.reportPath,
        sampleCount: report.summary.sampleCount,
        variants: report.summary.byVariant.map((variant) => ({
          id: variant.id,
          savedPercent: variant.savedPercent,
          failedDimensionChecks: variant.failedDimensionChecks,
          failedLayerMetadataChecks: variant.failedLayerMetadataChecks,
        })),
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
