import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STARTING_MAIN = "b89d4c005fea126866bd0121f1de26d289bf4d86";
const CONTEXT_FILE =
  "app/client/lib/converter/specializedTraceRouteContexts.ts";
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
      /^(?:outline|line-art|drawing|sketch|black-white|logo|sticker)-[a-z-]+$/.test(
        value,
      )
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

function sourceHash(relativePath) {
  return crypto.createHash("sha256").update(read(relativePath)).digest("hex");
}

const expected = [
  {
    key: "outline-image",
    path: "/image-to-svg-outline",
    source: "app/routes/image-to-svg-outline.tsx",
    owner: "app/routes/image-to-svg-outline.tsx",
    subfamily: "outline-and-line-art",
    defaultPresetId: "outline-clean",
    outputFilename: "image-to-svg-outline.svg",
  },
  {
    key: "outline-photo",
    path: "/photo-to-svg-outline",
    source: "app/routes/photo-to-svg-outline.tsx",
    owner: "app/routes/photo-to-svg-outline.tsx",
    subfamily: "outline-and-line-art",
    defaultPresetId: "photo-outline-clean",
    outputFilename: "photo-to-svg-outline.svg",
  },
  {
    key: "line-art-base",
    path: "/line-art-to-svg-converter",
    source: "app/routes/line-art-to-svg-converter.tsx",
    owner: "app/routes/line-art-to-svg-converter.tsx",
    subfamily: "outline-and-line-art",
    defaultPresetId: "line-accurate",
    outputFilename: "line-art-to-svg-converter.svg",
  },
  {
    key: "line-art-cricut",
    path: "/line-art-to-svg-for-cricut",
    source: "app/routes/line-art-to-svg-for-cricut.tsx",
    owner: "app/routes/line-art-to-svg-for-cricut.tsx",
    subfamily: "outline-and-line-art",
    defaultPresetId: "line-art-clean-cut",
    outputFilename: "line-art-to-svg-for-cricut.svg",
  },
  {
    key: "drawing-base",
    path: "/drawing-to-svg-converter",
    source: "app/routes/drawing-to-svg-converter.tsx",
    owner: "app/routes/drawing-to-svg-converter.tsx",
    subfamily: "sketch-and-drawing",
    defaultPresetId: "drawing-accurate",
    outputFilename: "drawing-to-svg-converter.svg",
  },
  {
    key: "drawing-cricut",
    path: "/drawing-to-svg-for-cricut",
    source: "app/routes/drawing-to-svg-for-cricut.tsx",
    owner: "app/routes/drawing-to-svg-for-cricut.tsx",
    subfamily: "sketch-and-drawing",
    defaultPresetId: "drawing-clean",
    outputFilename: "drawing-to-svg-for-cricut.svg",
  },
  {
    key: "sketch-base",
    path: "/sketch-to-svg-converter",
    source: "app/routes/sketch-to-svg-converter.tsx",
    owner: "app/routes/sketch-to-svg-converter.tsx",
    subfamily: "sketch-and-drawing",
    defaultPresetId: "sketch-pencil-light",
    outputFilename: "sketch-to-svg-converter.svg",
  },
  {
    key: "sketch-cricut",
    path: "/sketch-to-svg-for-cricut",
    source: "app/routes/sketch-to-svg-for-cricut.tsx",
    owner: "app/routes/sketch-to-svg-for-cricut.tsx",
    subfamily: "sketch-and-drawing",
    defaultPresetId: "sketch-balanced",
    outputFilename: "sketch-to-svg-for-cricut.svg",
  },
  {
    key: "black-white-base",
    path: "/black-and-white-image-to-svg-converter",
    source: "app/routes/black-and-white-image-to-svg-converter.tsx",
    owner: "app/routes/black-and-white-image-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "bw-clean",
    outputFilename: "converted.svg",
  },
  {
    key: "black-white-cricut",
    path: "/black-and-white-image-to-svg-for-cricut",
    source: "app/routes/black-and-white-image-to-svg-for-cricut.tsx",
    owner: "app/routes/black-and-white-image-to-svg-for-cricut.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "bw-clean-cut",
    outputFilename: "black-and-white-image-to-svg-for-cricut.svg",
  },
  {
    key: "logo-base",
    path: "/logo-to-svg-converter",
    source: "app/routes/logo-to-svg-converter.tsx",
    owner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
  },
  {
    key: "logo-cricut",
    path: "/logo-to-svg-for-cricut",
    source: "app/routes/logo-to-svg-for-cricut.tsx",
    owner: "app/routes/logo-to-svg-for-cricut.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean-cut",
    outputFilename: "logo-to-svg-for-cricut.svg",
  },
  {
    key: "logo-shopify",
    path: "/logo-to-svg-for-shopify",
    source: "app/routes/logo-to-svg-for-shopify.tsx",
    owner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
  },
  {
    key: "logo-etsy",
    path: "/logo-to-svg-for-etsy",
    source: "app/routes/logo-to-svg-for-etsy.tsx",
    owner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
  },
  {
    key: "logo-glowforge",
    path: "/logo-to-svg-for-glowforge",
    source: "app/routes/logo-to-svg-for-glowforge.tsx",
    owner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
  },
  {
    key: "logo-silhouette",
    path: "/logo-to-svg-for-silhouette",
    source: "app/routes/logo-to-svg-for-silhouette.tsx",
    owner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
  },
  {
    key: "logo-canva",
    path: "/logo-to-svg-for-canva",
    source: "app/routes/logo-to-svg-for-canva.tsx",
    owner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
  },
  {
    key: "sticker-base",
    path: "/sticker-to-svg-converter",
    source: "app/routes/sticker-to-svg-converter.tsx",
    owner: "app/routes/sticker-to-svg-converter.tsx",
    subfamily: "sticker",
    defaultPresetId: "line-accurate",
    outputFilename: "sticker-to-svg-converter.svg",
  },
  {
    key: "sticker-cricut",
    path: "/sticker-to-svg-for-cricut",
    source: "app/routes/sticker-to-svg-for-cricut.tsx",
    owner: "app/routes/sticker-to-svg-for-cricut.tsx",
    subfamily: "sticker",
    defaultPresetId: "sticker-clean",
    outputFilename: "sticker-to-svg-for-cricut.svg",
  },
  {
    key: "sticker-etsy",
    path: "/sticker-to-svg-for-etsy",
    source: "app/routes/sticker-to-svg-for-etsy.tsx",
    owner: "app/routes/sticker-to-svg-converter.tsx",
    subfamily: "sticker",
    defaultPresetId: "line-accurate",
    outputFilename: "sticker-to-svg-converter.svg",
  },
  {
    key: "sticker-silhouette",
    path: "/sticker-to-svg-for-silhouette",
    source: "app/routes/sticker-to-svg-for-silhouette.tsx",
    owner: "app/routes/sticker-to-svg-converter.tsx",
    subfamily: "sticker",
    defaultPresetId: "line-accurate",
    outputFilename: "sticker-to-svg-converter.svg",
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
const contexts = Object.values(
  contextModule.SPECIALIZED_TRACE_ROUTE_CONTEXTS,
);
const routeConfig = read("app/routes.ts");
const routeManifest = read("app/data/routeManifest.ts");
const allTools = read(ALL_TOOLS_FILE);

assert.equal(contexts.length, 21, "Unexpected specialized family size.");
assert.equal(
  contextModule.SPECIALIZED_TRACE_ROUTE_PATHS.length,
  contexts.length,
  "The finite path tuple and context map differ in size.",
);
assert.equal(
  new Set(contexts.map(({ path }) => path)).size,
  contexts.length,
  "Duplicate specialized route path detected.",
);
assert.equal(
  new Set(contexts.map(({ key }) => key)).size,
  contexts.length,
  "Duplicate specialized route key detected.",
);
assert.deepEqual(
  contexts.map(({ path }) => path).sort(),
  expected.map(({ path }) => path).sort(),
  "The context map does not match the audited route family.",
);

assert.throws(
  () => contextModule.getSpecializedTraceRouteContext("/unknown-route"),
  /Unknown specialized trace route path:/,
);
assert.throws(
  () =>
    contextModule.getSpecializedTraceRouteContext(
      "/logo-to-svg-converter?context=etsy",
    ),
  /Unknown specialized trace route path:/,
);
assert.throws(
  () => contextModule.getSpecializedTraceRouteContextByKey("unknown-key"),
  /Unknown specialized trace route key:/,
);
assert(Object.isFrozen(contextModule.SPECIALIZED_TRACE_ROUTE_CONTEXTS));
for (const context of contexts) {
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
    read(relativePath).includes(
      "export const SPECIALIZED_TRACE_ROUTE_CONTEXTS",
    ),
  )
  .map((relativePath) => relativePath.replaceAll("\\", "/"));
assert.deepEqual(
  contextMapSources,
  [CONTEXT_FILE],
  "The family must have exactly one production route-context map.",
);

for (const expectedRoute of expected) {
  const context = contexts.find(
    ({ path: routePath }) => routePath === expectedRoute.path,
  );
  assert(context, `${expectedRoute.path} has no route context.`);
  assert.equal(context.key, expectedRoute.key);
  assert.equal(context.routeSource, expectedRoute.source);
  assert.equal(context.implementationOwner, expectedRoute.owner);
  assert.equal(context.subfamily, expectedRoute.subfamily);
  assert.equal(context.defaultPresetId, expectedRoute.defaultPresetId);
  assert.equal(context.outputFilename, expectedRoute.outputFilename);
  assert.equal(context.canonicalPath, expectedRoute.path);
  assert.equal(
    context.contentContract.currentContentOwner,
    expectedRoute.owner,
  );
  assert.equal(context.contentContract.metadataOwner, expectedRoute.source);
  assert.equal(context.contentContract.schemaOwner, expectedRoute.owner);
  assert.equal(context.contentContract.presetOwner, expectedRoute.owner);
  assert.equal(context.contentContract.acceptedInputOwner, expectedRoute.owner);
  assert.equal(context.contentContract.filenameOwner, expectedRoute.owner);
  assert.equal(
    context.contentContract.breadcrumbOwner,
    ALL_TOOLS_FILE,
  );
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
  const implementationSource = read(expectedRoute.owner);
  assert(
    routeSource.includes(`routeKey="${expectedRoute.key}"`) ||
      routeSource.includes(
        `getSpecializedTraceRouteContextByKey("${expectedRoute.key}")`,
      ),
    `${expectedRoute.path} does not supply its explicit typed route key.`,
  );
  assert(
    implementationSource.includes(`"${expectedRoute.defaultPresetId}"`),
    `${expectedRoute.path} default preset is absent from its owner.`,
  );
  assert(
    implementationSource.includes(expectedRoute.outputFilename),
    `${expectedRoute.path} filename is absent from its owner.`,
  );
  assert(
    implementationSource.includes(context.h1) || allTools.includes(context.h1),
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
    `${owner} bypasses the shared server tracer.`,
  );
  assert.match(
    source,
    /TraceOutputPanel/,
    `${owner} bypasses the shared output action panel.`,
  );
  assert.doesNotMatch(
    source,
    /\buseLocation\b/,
    `${owner} still selects route behavior from location.`,
  );
  assert.doesNotMatch(
    source,
    /\bpathname\s*\.\s*(?:includes|startsWith|endsWith|match)\b/,
    `${owner} still guesses route behavior from pathname text.`,
  );
}

assert.match(
  read("app/routes/logo-to-svg-converter.tsx"),
  /export function LogoToSvgRouteImplementation/,
);
assert.match(
  read("app/routes/sticker-to-svg-converter.tsx"),
  /export function StickerToSvgRouteImplementation/,
);
for (const route of expected.filter(
  ({ owner, source }) => owner !== source,
)) {
  assert(
    read(route.source).includes(
      route.owner.endsWith("logo-to-svg-converter.tsx")
        ? "LogoToSvgRouteImplementation"
        : "StickerToSvgRouteImplementation",
    ),
    `${route.path} bypasses its compatible shared implementation.`,
  );
}

assert.doesNotMatch(
  contextSource,
  /URLSearchParams|\?context=|localStorage|sessionStorage|cookie/i,
);
assert.doesNotMatch(contextSource, /process\.env|import\.meta\.env/);
assert.doesNotMatch(contextSource, /\bredirectTo\b|\bredirect\s*\(|\balias/i);
assert.match(
  contextSource,
  /throw new Error\(`Unknown specialized trace route path:/,
);
assert.match(
  contextSource,
  /throw new Error\(`Unknown specialized trace route key:/,
);
assert.doesNotMatch(
  read("app/routes/sticker-to-svg-converter.tsx"),
  /\?\?\s*BASE_FAQ_ITEMS/,
  "Sticker content still has a silent base-route fallback.",
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
  ALL_TOOLS_FILE,
  "Dockerfile",
  "server.js",
  "package-lock.json",
]) {
  assertUnchanged(protectedPath);
}

const rasterRouteContextSource = read(
  "app/client/lib/converter/rasterToSvgRouteContexts.ts",
);
const rasterRoutePathDeclaration =
  rasterRouteContextSource.match(
    /export const RASTER_TO_SVG_ROUTE_PATHS = \[(?<paths>[\s\S]*?)\] as const;/,
  )?.groups?.paths ?? "";
assert.doesNotMatch(
  rasterRoutePathDeclaration,
  /\/png-to-svg-for-cricut-vinyl/,
  "The vinyl production workflow remains owned by the standard raster family.",
);
assert.match(
  rasterRouteContextSource,
  /path: "\/png-to-svg-for-cricut-vinyl",[\s\S]*?reason: "single-color-vinyl-production-workflow"/,
  "The standard-family exclusion does not record the exact vinyl ownership transfer.",
);

assertUnchanged("app/routes/image-to-outline-converter.tsx");
assertUnchanged("app/routes/black-and-white-png-to-svg-converter.tsx");
assert.equal(
  sourceHash(ALL_TOOLS_FILE),
  "b1cea2a32ff7ee56d89d3cb86e02e355e05f32dbe1926a82f3305712dbb1b84a",
  "All Tools changed from its validated byte hash.",
);

for (const excludedPath of [
  "/png-to-svg-converter",
  "/png-to-svg-for-cricut-print-then-cut",
  "/png-to-svg-for-cricut-stickers",
  "/png-to-layered-svg-for-cricut",
  "/svg-to-png-converter",
  "/svg-to-favicon-converter",
]) {
  assert(
    !contextModule.SPECIALIZED_TRACE_ROUTE_PATHS.includes(excludedPath),
    `${excludedPath} was incorrectly absorbed into the specialized family.`,
  );
}

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
      routeCount: contexts.length,
      retainedRouteCount: contexts.length,
      redirectedRouteCount: 0,
      subfamilies: Object.fromEntries(
        [...new Set(contexts.map(({ subfamily }) => subfamily))].map(
          (subfamily) => [
            subfamily,
            contexts.filter((context) => context.subfamily === subfamily)
              .length,
          ],
        ),
      ),
      implementationOwnerCount: owners.length,
      sharedLogoRoutes: contexts.filter(
        ({ implementationOwner }) =>
          implementationOwner === "app/routes/logo-to-svg-converter.tsx",
      ).length,
      sharedStickerRoutes: contexts.filter(
        ({ implementationOwner }) =>
          implementationOwner === "app/routes/sticker-to-svg-converter.tsx",
      ).length,
      allToolsHash: sourceHash(ALL_TOOLS_FILE),
      routeRegistryChanged: false,
      manifestChanged: false,
      sitemapChanged: false,
      redirectsAdded: false,
      publicStringsChanged: false,
      deploymentChanged: false,
      ok: true,
    },
    null,
    2,
  ),
);
