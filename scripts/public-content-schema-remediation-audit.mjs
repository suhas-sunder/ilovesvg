import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const checks = [];
const failures = [];

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

function check(condition, label) {
  checks.push({ label, passed: Boolean(condition) });
  if (!condition) failures.push(label);
}

function includes(source, expected, label) {
  check(source.includes(expected), label);
}

function excludes(source, forbidden, label) {
  check(!source.includes(forbidden), label);
}

async function fetchRoute(route) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  check(response.status === 200, `${route} returns 200`);
  return response.text();
}

const [
  shopifyWrapper,
  pngTemplate,
  faviconRoute,
  strokeRoute,
  flipRoute,
  sketchRoute,
  navigationCopy,
  sitemapRoute,
  tracePanel,
  bespokeTracePanel,
  advancedHelp,
  presetSelector,
  presetIntensity,
  howItWorksCopy,
  hybridFetcher,
  worker,
  homeRoute,
  iconRoute,
  imageLayeredRoute,
  jpgRoute,
  pngLayeredRoute,
  routeManifest,
] = await Promise.all([
  read("app/routes/png-to-svg-for-shopify.tsx"),
  read("app/routes/png-to-svg-for-etsy.tsx"),
  read("app/routes/svg-to-favicon-generator.tsx"),
  read("app/routes/svg-stroke-width-editor.tsx"),
  read("app/routes/svg-flip-and-rotate-editor.tsx"),
  read("app/routes/sketch-to-svg-converter.tsx"),
  read("app/client/components/navigation/OtherToolsLinks.tsx"),
  read("app/routes/sitemap.tsx"),
  read("app/client/components/converter/TraceOutputPanel.tsx"),
  read("app/client/components/converter/BespokeTraceOutputPanel.tsx"),
  read("app/client/components/converter/AdvancedSettingsHelpSection.tsx"),
  read("app/client/components/converter/PresetSelector.tsx"),
  read("app/client/lib/converter/presetIntensity.ts"),
  read("app/content/docs/howItWorksRouteContent.ts"),
  read("app/client/lib/tracing/useHybridTraceFetcher.ts"),
  read("app/client/workers/vtracer.worker.ts"),
  read("app/routes/home.tsx"),
  read("app/routes/icon-to-svg-converter.tsx"),
  read("app/routes/image-to-layered-svg-for-cricut.tsx"),
  read("app/routes/jpg-to-svg-converter.tsx"),
  read("app/routes/png-to-layered-svg-for-cricut.tsx"),
  read("app/data/routeManifest.ts"),
]);

includes(
  shopifyWrapper,
  'from "./png-to-svg-for-etsy"',
  "Shopify keeps the established production converter implementation",
);
for (const [id, label] of Object.entries({
  "line-accurate": "Shopify PNG - Accurate trace (default)",
  "line-bold": "Shopify Brand - Bold outline",
  "line-fine": "Shopify Detail - Fine lines",
  "logo-clean": "Shopify Logo - Clean shapes",
  "logo-thin": "Shopify Logo - Thin details",
})) {
  includes(
    pngTemplate,
    `"${id}": "${label}"`,
    `Shopify label override exists for ${id}`,
  );
}
includes(
  pngTemplate,
  'return label ? { ...preset, label } : preset;',
  "Shopify preset correction changes labels only",
);
includes(
  pngTemplate,
  'id: "line-accurate"',
  "Shopify and Etsy retain the established default preset ID",
);
includes(
  pngTemplate,
  'label: "Etsy PNG  -  Accurate trace (default)"',
  "Etsy retains its route-appropriate default wording",
);
includes(
  pngTemplate,
  "presets={routeDisplayPresets}",
  "Rendered preset cards use route-specific labels",
);
includes(
  pngTemplate,
  "getPresetLabelById(routeDisplayPresets, activePreset)",
  "History labels use the route-specific visible identity",
);

for (const [source, invalidPath, correctedPath, label] of [
  [
    faviconRoute,
    "/svg-favicon-generator",
    "/svg-to-favicon-generator",
    "favicon",
  ],
  [
    strokeRoute,
    "/svg-stroke-width-adjust",
    "/svg-stroke-width-editor",
    "stroke-width",
  ],
  [
    flipRoute,
    "/svg-flip-rotate-editor",
    "/svg-flip-and-rotate-editor",
    "flip/rotate",
  ],
]) {
  excludes(source, invalidPath, `${label} invalid target is absent`);
  check(
    source.split(correctedPath).length - 1 >= 2,
    `${label} visible and schema breadcrumbs use the corrected target`,
  );
  includes(
    routeManifest,
    `path: "${correctedPath}"`,
    `${label} corrected destination is registered`,
  );
}

excludes(sketchRoute, "rental agreement", "Sketch page removes rental wording");
excludes(sketchRoute, "budgeting", "Sketch page removes budgeting wording");
includes(
  sketchRoute,
  "Clean, high-contrast scans and photos produce the clearest paths.",
  "Sketch page contains route-specific tracing guidance",
);
includes(
  sketchRoute,
  "choose a filled or outline preset",
  "Sketch guidance reflects supported preset choices",
);

for (const phrase of [
  "PNG to SVG keyword cluster",
  "JPG to SVG keyword cluster",
  "search intent",
]) {
  excludes(navigationCopy, phrase, `Navigation copy removes "${phrase}"`);
}
for (const phrase of ["SEO-safe", "Expanded SVG workflow routes"]) {
  excludes(sitemapRoute, phrase, `Sitemap copy removes "${phrase}"`);
}

for (const source of [advancedHelp, presetSelector, navigationCopy]) {
  excludes(
    source,
    "backend processing cost",
    "Public preset help removes backend-cost wording",
  );
}
excludes(
  presetIntensity,
  "very light backend work",
  "Public speed help removes backend-work wording",
);
excludes(
  howItWorksCopy,
  "backend processing cost",
  "Public workflow help removes backend-cost wording",
);
excludes(
  howItWorksCopy,
  'title: "File size and parity"',
  "Public workflow help removes internal parity terminology",
);
includes(
  tracePanel,
  'if (engineUsed === "vtracer") return "Detailed color trace";',
  "Internal trace identifiers map to user-facing method names",
);
includes(
  tracePanel,
  'normalized.includes("layered") || normalized.includes("vtracer")',
  "Detailed color trace paths retain their user-facing distinction",
);
includes(
  tracePanel,
  "A compatible tracing method was used to complete this conversion.",
  "Internal trace warnings map to user-facing wording",
);
excludes(
  hybridFetcher,
  "VTracer could not convert this image in your browser.",
  "Public conversion errors do not expose VTracer",
);
excludes(
  hybridFetcher,
  "Browser VTracer was not used",
  "Public fallback warnings do not expose VTracer",
);
excludes(worker, "Loading VTracer", "Visible worker progress does not expose VTracer");
includes(
  bespokeTracePanel,
  "getPublicTraceMethodLabel(item.engineUsed)",
  "Bespoke result metadata uses the public trace-method label",
);
excludes(
  bespokeTracePanel,
  "<span>{item.engineUsed}</span>",
  "Bespoke output does not render a raw engine identifier",
);
for (const [source, label] of [
  [homeRoute, "home output"],
  [pngLayeredRoute, "layered PNG output"],
]) {
  excludes(
    source,
    "item.engineUsed ? ` - ${item.engineUsed}`",
    `${label} does not render a raw engine identifier`,
  );
}
excludes(
  navigationCopy,
  "conversion engine",
  "Public route guidance avoids conversion-engine terminology",
);
excludes(
  navigationCopy,
  "tracing engine",
  "Public route guidance avoids tracing-engine terminology",
);
excludes(
  iconRoute,
  "RAM-only + backend safeguards",
  "Icon guidance removes hosting and backend rationale",
);
excludes(
  imageLayeredRoute,
  "Only backend layered SVG conversions",
  "Layered-image guidance removes backend rationale",
);
excludes(
  jpgRoute,
  "same tracing pipeline here",
  "JPG guidance removes pipeline terminology",
);

for (const formatCheck of [
  'f.type === "image/svg+xml"',
  'f.type === "image/png"',
  'f.type === "image/jpeg"',
  'f.type === "image/webp"',
]) {
  includes(
    faviconRoute,
    formatCheck,
    `Favicon input handling retains ${formatCheck}`,
  );
}
includes(
  faviconRoute,
  'setSrcKind("raster")',
  "Favicon raster inputs remain raster sources",
);
includes(
  faviconRoute,
  "rasterizeToSquareCanvas",
  "Favicon generation still rasterizes the source into icon canvases",
);
includes(
  navigationCopy,
  "PNG, JPG, and WebP inputs are resized into PNG and ICO assets; they are not vectorized.",
  "Favicon guidance accurately distinguishes raster handling",
);
includes(
  navigationCopy,
  "SVG sources retain scalable source quality before bitmap icons are generated.",
  "Favicon guidance accurately explains SVG handling",
);

const rendered = Object.fromEntries(
  await Promise.all(
    [
      "/png-to-svg-for-shopify",
      "/png-to-svg-for-etsy",
      "/svg-to-favicon-generator",
      "/svg-stroke-width-editor",
      "/svg-flip-and-rotate-editor",
      "/sketch-to-svg-converter",
      "/png-to-svg-converter",
      "/jpg-to-svg-converter",
      "/sitemap",
    ].map(async (route) => [route, await fetchRoute(route)]),
  ),
);

includes(
  rendered["/png-to-svg-for-shopify"],
  "Shopify PNG - Accurate trace (default)",
  "Shopify renders its corrected default label",
);
excludes(
  rendered["/png-to-svg-for-shopify"],
  "Etsy PNG",
  "Shopify rendered output contains no Etsy preset wording",
);
includes(
  rendered["/png-to-svg-for-etsy"],
  "Etsy PNG  -  Accurate trace (default)",
  "Etsy renders its existing default label",
);

for (const [route, invalidPath, correctedPath] of [
  [
    "/svg-to-favicon-generator",
    "/svg-favicon-generator",
    "/svg-to-favicon-generator",
  ],
  [
    "/svg-stroke-width-editor",
    "/svg-stroke-width-adjust",
    "/svg-stroke-width-editor",
  ],
  [
    "/svg-flip-and-rotate-editor",
    "/svg-flip-rotate-editor",
    "/svg-flip-and-rotate-editor",
  ],
]) {
  excludes(rendered[route], invalidPath, `${route} does not render its invalid target`);
  includes(rendered[route], correctedPath, `${route} renders its corrected target`);
}

excludes(
  rendered["/sketch-to-svg-converter"],
  "rental agreement",
  "Rendered sketch page has no rental wording",
);
excludes(
  rendered["/sketch-to-svg-converter"],
  "budgeting",
  "Rendered sketch page has no budgeting wording",
);
includes(
  rendered["/svg-to-favicon-generator"],
  "not vectorized",
  "Rendered favicon guidance explains raster handling",
);

for (const [route, phrase] of [
  ["/png-to-svg-converter", "PNG to SVG keyword cluster"],
  ["/jpg-to-svg-converter", "JPG to SVG keyword cluster"],
  ["/jpg-to-svg-converter", "search intent"],
  ["/sitemap", "SEO-safe"],
  ["/sitemap", "Expanded SVG workflow routes"],
]) {
  excludes(rendered[route], phrase, `${route} does not render "${phrase}"`);
}

console.log(
  JSON.stringify(
    {
      checks: checks.length,
      passed: checks.filter((entry) => entry.passed).length,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) process.exitCode = 1;
