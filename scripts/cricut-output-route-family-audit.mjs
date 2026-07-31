import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STARTING_MAIN = "7d431cdd0948bf5686bf491347f8ff126dfbcfa0";
const CONTEXT_FILE =
  "app/client/lib/converter/cricutOutputRouteContexts.ts";
const RASTER_CONTEXT_FILE =
  "app/client/lib/converter/rasterToSvgRouteContexts.ts";
const ALL_TOOLS_FILE =
  "app/client/components/navigation/OtherToolsLinks.tsx";

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readAtBase(relativePath) {
  return execFileSync(
    "git",
    ["show", `${STARTING_MAIN}:${relativePath}`],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function assertUnchanged(relativePath) {
  assert.equal(
    normalize(read(relativePath)),
    normalize(readAtBase(relativePath)),
    `${relativePath} changed from the validated starting main`,
  );
}

function sourceHash(relativePath) {
  return crypto.createHash("sha256").update(read(relativePath)).digest("hex");
}

function walkFiles(relativeDirectory) {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? walkFiles(relativePath) : [relativePath];
    },
  );
}

function publicStringInventory(source) {
  source = normalize(source);
  const values = new Set();
  const sourceFile = ts.createSourceFile(
    "route.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function record(rawValue) {
    const value = rawValue.replace(/\s+/g, " ").trim();
    if (value.length < 18) return;
    if (
      /^(?:~\/|\.\/|app\/routes\/|image\/|https:\/\/schema\.org\/)/.test(
        value,
      )
    ) {
      return;
    }
    if (
      /^(?:layered|cricut|print-then-cut)[a-z-]*$/.test(value) ||
      /^[a-z]+(?:-[a-z]+){2,}$/.test(value) ||
      value.includes("[&>section]")
    ) {
      return;
    }
    values.add(value);
  }
  function visit(node) {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      record(node.text);
    } else if (ts.isJsxText(node)) {
      record(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...values].sort();
}

const expected = [
  {
    key: "layered-cricut",
    path: "/layered-svg-for-cricut",
    source: "app/routes/layered-svg-for-cricut.tsx",
    owner: "app/routes/layered-svg-for-cricut.tsx",
    lifecycleRouteId: "layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "layered-svg-for-cricut.svg",
  },
  {
    key: "layered-image-cricut",
    path: "/image-to-layered-svg-for-cricut",
    source: "app/routes/image-to-layered-svg-for-cricut.tsx",
    owner: "app/routes/image-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "image-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "image-to-layered-svg-for-cricut.svg",
  },
  {
    key: "layered-png-cricut",
    path: "/png-to-layered-svg-for-cricut",
    source: "app/routes/png-to-layered-svg-for-cricut.tsx",
    owner: "app/routes/png-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "png-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "png-to-layered-svg-for-cricut.svg",
  },
  {
    key: "layered-jpg-cricut",
    path: "/jpg-to-layered-svg-for-cricut",
    source: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    owner: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "jpg-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "jpg-to-layered-svg-for-cricut.svg",
  },
  {
    key: "layered-logo-cricut",
    path: "/logo-to-layered-svg-for-cricut",
    source: "app/routes/logo-to-layered-svg-for-cricut.tsx",
    owner: "app/routes/logo-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "logo-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "logo-to-layered-svg-for-cricut.svg",
  },
  {
    key: "layered-image-general",
    path: "/image-to-layered-svg-converter",
    source: "app/routes/image-to-layered-svg-converter.tsx",
    owner: "app/routes/image-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "image-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "image-to-layered-svg-for-cricut.svg",
  },
  {
    key: "layered-jpg-general",
    path: "/jpg-to-layered-svg-converter",
    source: "app/routes/jpg-to-layered-svg-converter.tsx",
    owner: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "jpg-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "jpg-to-layered-svg-for-cricut.svg",
  },
  {
    key: "layered-logo-general",
    path: "/logo-to-layered-svg-converter",
    source: "app/routes/logo-to-layered-svg-converter.tsx",
    owner: "app/routes/logo-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "logo-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    defaultPresetId: "layered-color",
    outputFilename: "logo-to-layered-svg-for-cricut.svg",
  },
  {
    key: "print-then-cut",
    path: "/png-to-svg-for-cricut-print-then-cut",
    source: "app/routes/png-to-svg-for-cricut-print-then-cut.tsx",
    owner: "app/routes/png-to-svg-for-cricut-print-then-cut.tsx",
    lifecycleRouteId: "png-to-svg-for-cricut-print-then-cut",
    subfamily: "print-then-cut",
    defaultPresetId: "sticker-clean-offset",
    outputFilename: "print-then-cut.svg",
  },
  {
    key: "cricut-stickers",
    path: "/png-to-svg-for-cricut-stickers",
    source: "app/routes/png-to-svg-for-cricut-stickers.tsx",
    owner: "app/routes/png-to-svg-for-cricut-stickers.tsx",
    lifecycleRouteId: "png-to-svg-for-cricut-stickers",
    subfamily: "sticker-cut-outline",
    defaultPresetId: "white-border",
    outputFilename: "cricut-sticker.svg",
  },
  {
    key: "cricut-vinyl",
    path: "/png-to-svg-for-cricut-vinyl",
    source: "app/routes/png-to-svg-for-cricut-vinyl.tsx",
    owner: "app/routes/png-to-svg-for-cricut-vinyl.tsx",
    lifecycleRouteId: "png-to-svg-for-cricut-vinyl",
    subfamily: "vinyl-cut-file",
    defaultPresetId: "vinyl-clean-weed",
    outputFilename: "png-to-svg-for-cricut-vinyl.svg",
  },
];

const contextSource = read(CONTEXT_FILE);
const transpiledContext = ts.transpileModule(contextSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
  fileName: CONTEXT_FILE,
}).outputText;
const contextModule = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledContext).toString("base64")}`
);
const productionContexts = Object.values(
  contextModule.CRICUT_OUTPUT_ROUTE_CONTEXTS,
);
const routeConfig = read("app/routes.ts");
const routeManifest = read("app/data/routeManifest.ts");
const allTools = read(ALL_TOOLS_FILE);

assert.equal(productionContexts.length, 11, "Unexpected Cricut output family size.");
assert.equal(
  contextModule.CRICUT_OUTPUT_ROUTE_PATHS.length,
  productionContexts.length,
  "The finite path tuple and context map differ in size.",
);
assert.equal(
  new Set(productionContexts.map(({ path: routePath }) => routePath)).size,
  productionContexts.length,
  "Duplicate Cricut output route path detected.",
);
assert.equal(
  new Set(productionContexts.map(({ key }) => key)).size,
  productionContexts.length,
  "Duplicate Cricut output route key detected.",
);
assert.deepEqual(
  productionContexts.map(({ path: routePath }) => routePath).sort(),
  expected.map(({ path: routePath }) => routePath).sort(),
  "The context map does not match the audited route family.",
);

assert.throws(
  () => contextModule.getCricutOutputRouteContext("/unknown-route"),
  /Unknown Cricut output route path:/,
);
assert.throws(
  () =>
    contextModule.getCricutOutputRouteContext(
      "/layered-svg-for-cricut?context=stickers",
    ),
  /Unknown Cricut output route path:/,
);
assert.throws(
  () => contextModule.getCricutOutputRouteContextByKey("unknown-key"),
  /Unknown Cricut output route key:/,
);
assert(Object.isFrozen(contextModule.CRICUT_OUTPUT_ROUTE_CONTEXTS));
for (const context of productionContexts) {
  assert(Object.isFrozen(context), `${context.path} context is mutable.`);
  assert(
    Object.isFrozen(context.contentContract),
    `${context.path} content contract is mutable.`,
  );
  assert(
    Object.isFrozen(context.contentContract.consolidation),
    `${context.path} consolidation decision is mutable.`,
  );
}

const contextMapSources = walkFiles("app")
  .filter((relativePath) => /\.(?:ts|tsx)$/.test(relativePath))
  .filter((relativePath) =>
    read(relativePath).includes("export const CRICUT_OUTPUT_ROUTE_CONTEXTS"),
  )
  .map((relativePath) => relativePath.replaceAll("\\", "/"));
assert.deepEqual(
  contextMapSources,
  [CONTEXT_FILE],
  "The family must have exactly one production route-context map.",
);

for (const expectedRoute of expected) {
  const context = productionContexts.find(
    ({ path: routePath }) => routePath === expectedRoute.path,
  );
  assert(context, `${expectedRoute.path} has no route context.`);
  assert.equal(context.key, expectedRoute.key);
  assert.equal(context.routeSource, expectedRoute.source);
  assert.equal(context.implementationOwner, expectedRoute.owner);
  assert.equal(context.lifecycleRouteId, expectedRoute.lifecycleRouteId);
  assert.equal(context.subfamily, expectedRoute.subfamily);
  assert.equal(context.defaultPresetId, expectedRoute.defaultPresetId);
  assert.equal(context.outputFilename, expectedRoute.outputFilename);
  assert.equal(context.canonicalPath, expectedRoute.path);
  assert.equal(context.contentContract.currentContentOwner, expectedRoute.owner);
  assert.equal(context.contentContract.metadataOwner, expectedRoute.source);
  assert.equal(context.contentContract.schemaOwner, expectedRoute.owner);
  assert.equal(context.contentContract.presetOwner, expectedRoute.owner);
  assert.equal(context.contentContract.acceptedInputOwner, expectedRoute.owner);
  assert.equal(context.contentContract.filenameOwner, expectedRoute.owner);
  assert.equal(context.contentContract.breadcrumbOwner, ALL_TOOLS_FILE);
  assert.equal(
    context.contentContract.consolidation.decision,
    "retain-independently",
  );
  assert.equal(
    context.contentContract.consolidation.reconsiderationPolicy,
    "requires-new-evidence",
  );
  assert(
    context.contentContract.consolidation.reasons.length > 0,
    `${expectedRoute.path} has no evidence-backed retention reason.`,
  );

  assert(
    new RegExp(
      `route\\(\\s*"${expectedRoute.path.slice(1).replaceAll("-", "\\-")}"`,
    ).test(routeConfig),
    `${expectedRoute.path} is not registered.`,
  );
  const manifestLine = routeManifest
    .split(/\r?\n/)
    .find((line) => line.includes(`path: "${expectedRoute.path}"`));
  assert(manifestLine, `${expectedRoute.path} is absent from the manifest.`);
  assert.match(manifestLine, /kind: "public-converter"/);
  assert.match(manifestLine, /publicRoute: true/);
  assert.match(manifestLine, /indexable: true/);
  assert.match(manifestLine, /sitemap: "xml-and-html"/);
  assert.doesNotMatch(manifestLine, /redirectTo:/);
  assert(
    manifestLine.includes(`canonicalPath: "${expectedRoute.path}"`),
    `${expectedRoute.path} canonical changed.`,
  );
  assert(
    manifestLine.includes(`title: ${JSON.stringify(context.title)}`),
    `${expectedRoute.path} title differs from the manifest.`,
  );

  const routeSource = read(expectedRoute.source);
  const ownerSource = read(expectedRoute.owner);
  assert(
    routeSource.includes(`routeKey="${expectedRoute.key}"`) ||
      routeSource.includes(
        `getCricutOutputRouteContextByKey("${expectedRoute.key}")`,
      ) ||
      routeSource.includes(
        `getCricutOutputRouteContextByKey(\n    "${expectedRoute.key}"`,
      ),
    `${expectedRoute.path} does not supply its explicit typed route key.`,
  );
  assert(
    ownerSource.includes(`"${expectedRoute.defaultPresetId}"`),
    `${expectedRoute.path} default preset is absent from its owner.`,
  );
  assert(
    ownerSource.includes(expectedRoute.outputFilename),
    `${expectedRoute.path} filename is absent from its owner.`,
  );
  assert(
    ownerSource.includes(context.h1) || allTools.includes(context.h1),
    `${expectedRoute.path} H1 identity is not owned by its route sources.`,
  );
}

const owners = [...new Set(expected.map(({ owner }) => owner))];
for (const owner of owners) {
  const source = read(owner);
  assert.match(
    source,
    /useHybridTraceFetcher<ServerResult>/,
    `${owner} bypasses the shared hybrid lifecycle.`,
  );
  assert.match(
    source,
    /runSharedPotraceSvgTrace/,
    `${owner} bypasses the shared server fallback tracer.`,
  );
  assert.match(
    source,
    /TraceOutputPanel/,
    `${owner} bypasses the shared output action primitives.`,
  );
  assert.doesNotMatch(
    source,
    /\buseLocation\b|window\.location\.pathname/,
    `${owner} still selects action or route behavior from browser location.`,
  );
  assert.doesNotMatch(
    source,
    /\bpathname\s*\.\s*(?:includes|startsWith|endsWith|match)\b/,
    `${owner} still guesses route behavior from pathname text.`,
  );
  assert.match(
    source,
    /routeId: routeContext\.lifecycleRouteId/,
    `${owner} does not bind lifecycle ownership to its typed context.`,
  );
  assert.match(
    source,
    /`\$\{routeContext\.path\}\?index`/,
    `${owner} does not submit to its explicit typed route path.`,
  );
}

for (const [source, implementationName] of [
  [
    "app/routes/image-to-layered-svg-converter.tsx",
    "ImageToLayeredSvgRouteImplementation",
  ],
  [
    "app/routes/jpg-to-layered-svg-converter.tsx",
    "JpgToLayeredSvgRouteImplementation",
  ],
  [
    "app/routes/logo-to-layered-svg-converter.tsx",
    "LogoToLayeredSvgRouteImplementation",
  ],
]) {
  assert.match(
    read(source),
    new RegExp(implementationName),
    `${source} bypasses its compatible shared implementation.`,
  );
}

const rasterContextSource = read(RASTER_CONTEXT_FILE);
assert.doesNotMatch(
  rasterContextSource.match(
    /export const RASTER_TO_SVG_ROUTE_PATHS = \[([\s\S]*?)\] as const;/,
  )?.[1] || "",
  /png-to-svg-for-cricut-vinyl/,
  "Vinyl still has an overlapping standard-family route context.",
);
assert.match(
  rasterContextSource,
  /single-color-vinyl-production-workflow/,
  "The standard family does not document vinyl's ownership transfer.",
);

assert.doesNotMatch(
  contextSource,
  /URLSearchParams|\?context=|localStorage|sessionStorage|cookie/i,
);
assert.doesNotMatch(contextSource, /process\.env|import\.meta\.env/);
assert.doesNotMatch(contextSource, /\bredirectTo\b|\bredirect\s*\(|\balias/i);
assert.match(
  contextSource,
  /throw new Error\(`Unknown Cricut output route path:/,
);
assert.match(
  contextSource,
  /throw new Error\(`Unknown Cricut output route key:/,
);

const paritySource = read("scripts/converter-route-parity-smoke.mjs");
assert.match(
  paritySource,
  /route: "\/image-to-layered-svg-for-cricut"[\s\S]*preset: presets\.flatAmazing/,
  "The layered image route is absent from converter route parity.",
);
assert.match(
  paritySource,
  /ensureSettingsSectionOpen\(client, \/Layer colors\/i, "layer-colors"\)/,
  "Route parity no longer requires layered color controls.",
);
assert.match(
  paritySource,
  /Settings\/Edit did not open:/,
  "Route parity no longer fails when the output editor cannot open.",
);
assert.match(
  read("app/routes/image-to-layered-svg-for-cricut.tsx"),
  /renderSettings=\{\([\s\S]*LayeredAdvancedSettingsPanel[\s\S]*Layer colors/,
  "The layered image route no longer exposes its output layer editor.",
);

for (const route of expected) {
  assert.deepEqual(
    publicStringInventory(read(route.source)),
    publicStringInventory(readAtBase(route.source)),
    `${route.path} public strings changed during ownership integration.`,
  );
}

for (const protectedPath of [
  "app/routes.ts",
  "app/data/routeManifest.ts",
  "app/routes/sitemap.tsx",
  "public/sitemap.xml",
  ALL_TOOLS_FILE,
  "app/client/components/converter/BespokeTraceOutputPanel.tsx",
  "app/client/components/converter/TraceOutputPanel.tsx",
  "app/shared/tracing/serverFallback.server.ts",
  "Dockerfile",
  "server.js",
  "package-lock.json",
]) {
  assertUnchanged(protectedPath);
}
assert.equal(
  sourceHash(ALL_TOOLS_FILE),
  "b1cea2a32ff7ee56d89d3cb86e02e355e05f32dbe1926a82f3305712dbb1b84a",
  "All Tools changed from its validated byte hash.",
);

const trackedArtifacts = execFileSync(
  "git",
  [
    "ls-files",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.webp",
    "*.log",
    "*coverage*",
    "*test-results*",
  ],
  { cwd: ROOT, encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) =>
    /^(?:docs\/audits\/runtime-verification\/|test-artifacts\/|tmp\/|coverage\/|test-results\/)/i.test(
      file,
    ),
  );
assert.deepEqual(
  trackedArtifacts,
  [],
  `Generated verification artifacts are tracked: ${trackedArtifacts.join(", ")}`,
);

console.log(
  JSON.stringify(
    {
      startingMain: STARTING_MAIN,
      routeCount: productionContexts.length,
      retainedRouteCount: productionContexts.length,
      redirectedRouteCount: 0,
      subfamilies: Object.fromEntries(
        [...new Set(productionContexts.map(({ subfamily }) => subfamily))].map(
          (subfamily) => [
            subfamily,
            productionContexts.filter(
              (context) => context.subfamily === subfamily,
            ).length,
          ],
        ),
      ),
      implementationOwnerCount: owners.length,
      sharedLayeredWrapperCount: expected.filter(
        ({ owner, source }) => owner !== source,
      ).length,
      imageLayeredParityGate: "required-and-passing",
      allToolsHash: sourceHash(ALL_TOOLS_FILE),
      routeRegistryChanged: false,
      manifestChanged: false,
      sitemapChanged: false,
      redirectsAdded: 0,
      status:
        "CRICUT OUTPUT FAMILIES COMPLETE: all routes intentionally retained because they serve distinct public intent and output workflows.",
    },
    null,
    2,
  ),
);
