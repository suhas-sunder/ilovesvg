import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STARTING_MAIN = "6103f5d195bb5ef9e8b6f6fa653ed129a4b83761";
const CONTEXT_FILE =
  "app/client/lib/converter/rasterToSvgRouteContexts.ts";

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readAtBase(relativePath) {
  return execFileSync(
    "git",
    ["show", `${STARTING_MAIN}:${relativePath}`],
    { cwd: ROOT, encoding: "utf8" },
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
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

function assertUnchanged(relativePath) {
  assert.equal(
    normalize(read(relativePath)),
    normalize(readAtBase(relativePath)),
    `${relativePath} changed from the validated starting main`,
  );
}

const contextSource = read(CONTEXT_FILE);
const routeConfig = read("app/routes.ts");
const routeManifest = read("app/data/routeManifest.ts");
const startingRouteManifest = readAtBase("app/data/routeManifest.ts");

const routePathBlock = contextSource.match(
  /export const RASTER_TO_SVG_ROUTE_PATHS = \[([\s\S]*?)\] as const;/,
);
assert(routePathBlock, "Could not locate the finite route-path tuple.");
const routePaths = [
  ...routePathBlock[1].matchAll(/"([^"]+)"/g),
].map((match) => match[1]);

const definitionBlock = contextSource.match(
  /const definitions = \[([\s\S]*?)\] as const satisfies readonly ContextDefinition\[\];/,
);
assert(definitionBlock, "Could not locate the finite context definitions.");
const definitions = [
  ...definitionBlock[1].matchAll(
    /key: "([^"]+)",\s+path: "([^"]+)",\s+routeSource: "([^"]+)",\s+implementationOwner: "([^"]+)",\s+inputPolicy: "([^"]+)",\s+defaultPresetId: "([^"]+)",\s+outputFilename: "([^"]+)"/g,
  ),
].map((match) => ({
  key: match[1],
  path: match[2],
  routeSource: match[3],
  implementationOwner: match[4],
  inputPolicy: match[5],
  defaultPresetId: match[6],
  outputFilename: match[7],
}));

assert.equal(routePaths.length, 30, "Unexpected confirmed family size.");
assert.equal(
  definitions.length,
  routePaths.length,
  "Every family path must have exactly one content-contract definition.",
);
assert.equal(
  new Set(routePaths).size,
  routePaths.length,
  "Duplicate family path detected.",
);
assert.equal(
  new Set(definitions.map(({ key }) => key)).size,
  definitions.length,
  "Duplicate route key detected.",
);
assert.deepEqual(
  definitions.map(({ path }) => path).sort(),
  [...routePaths].sort(),
  "Route tuple and content-contract paths differ.",
);
assert.match(
  contextSource,
  /currentContentOwner: definition\.implementationOwner/,
);
assert.match(
  contextSource,
  /metadataOwner: definition\.routeSource/,
);
assert.match(
  contextSource,
  /schemaOwner: definition\.implementationOwner/,
);
assert.match(
  contextSource,
  /breadcrumbOwner:\s+"app\/client\/components\/navigation\/OtherToolsLinks\.tsx"/,
);
assert.match(
  contextSource,
  /presetOwner: definition\.implementationOwner/,
);

const contextMapSources = walkFiles("app")
  .filter((relativePath) => /\.(?:ts|tsx)$/.test(relativePath))
  .filter((relativePath) =>
    read(relativePath).includes("export const RASTER_TO_SVG_ROUTE_CONTEXTS"),
  )
  .map((relativePath) => relativePath.replaceAll("\\", "/"));
assert.deepEqual(
  contextMapSources,
  [CONTEXT_FILE],
  "The family must have exactly one production route-context map.",
);

for (const definition of definitions) {
  const registered = new RegExp(
    `route\\(\\s*"${definition.path.slice(1).replaceAll("-", "\\-")}"`,
  ).test(routeConfig);
  assert(registered, `${definition.path} is not registered.`);

  const manifestLine = routeManifest
    .split(/\r?\n/)
    .find((line) => line.includes(`path: "${definition.path}"`));
  assert(manifestLine, `${definition.path} is absent from the route manifest.`);
  assert.match(manifestLine, /kind: "public-converter"/);
  assert.match(
    manifestLine,
    new RegExp(
      `canonicalPath: "${definition.path.replaceAll("-", "\\-")}"`,
    ),
  );
  assert.match(manifestLine, /publicRoute: true/);
  assert.match(manifestLine, /indexable: true/);
  assert.match(manifestLine, /sitemap: "xml-and-html"/);
  assert.doesNotMatch(manifestLine, /redirectTo:/);

  assert(
    fs.existsSync(path.join(ROOT, definition.routeSource)),
    `${definition.routeSource} does not exist.`,
  );
  assert(
    fs.existsSync(path.join(ROOT, definition.implementationOwner)),
    `${definition.implementationOwner} does not exist.`,
  );

  const routeSource = read(definition.routeSource);
  const implementationSource = read(definition.implementationOwner);
  assert(
    routeSource.includes(`routeKey="${definition.key}"`) ||
      routeSource.includes(
        `getRasterToSvgRouteContextByKey("${definition.key}")`,
    ),
    `${definition.path} does not supply its explicit typed route key.`,
  );
  assert(
    implementationSource.includes(`"${definition.defaultPresetId}"`),
    `${definition.path} default preset is absent from its implementation owner.`,
  );
  assert(
    implementationSource.includes(definition.outputFilename),
    `${definition.path} output filename is absent from its implementation owner.`,
  );
}

for (const implementationOwner of new Set(
  definitions.map(({ implementationOwner }) => implementationOwner),
)) {
  const source = read(implementationOwner);
  assert.match(
    source,
    /useHybridTraceFetcher<ServerResult>/,
    `${implementationOwner} bypasses the shared hybrid trace lifecycle.`,
  );
  assert.match(
    source,
    /runSharedPotraceSvgTrace/,
    `${implementationOwner} bypasses the shared server fallback tracer.`,
  );
  assert.match(
    source,
    /TraceOutputPanel/,
    `${implementationOwner} bypasses the shared result/action implementation.`,
  );
}

for (const implementationOwner of new Set(
  definitions.map(({ implementationOwner }) => implementationOwner),
)) {
  const source = read(implementationOwner);
  assert.doesNotMatch(
    source,
    /\buseLocation\b/,
    `${implementationOwner} still selects route content from browser location.`,
  );
}

assert.match(
  contextSource,
  /throw new Error\(`Unknown raster-to-SVG route path:/,
);
assert.match(
  contextSource,
  /throw new Error\(`Unknown raster-to-SVG route key:/,
);
assert.doesNotMatch(contextSource, /URLSearchParams|\?context=|localStorage|cookie/i);
assert.doesNotMatch(contextSource, /process\.env|import\.meta\.env/);
assert.doesNotMatch(contextSource, /\bredirectTo\b|\bredirect\s*\(|\baliases?\b/i);
assert.match(
  contextSource,
  /reconsiderationPolicy: "requires-new-evidence"/,
);

const excluded = [
  "/png-to-svg-for-cricut-print-then-cut",
  "/png-to-svg-for-cricut-stickers",
];
for (const routePath of excluded) {
  assert(
    !routePaths.includes(routePath),
    `${routePath} must remain outside the standard family.`,
  );
  assert(
    new RegExp(
      `route\\(\\s*"${routePath.slice(1).replaceAll("-", "\\-")}"`,
    ).test(routeConfig),
    `${routePath} specialized route is no longer registered.`,
  );
}

const jpgSource = read("app/routes/jpg-to-svg-converter.tsx");
const jpegSource = read("app/routes/jpeg-to-svg-converter.tsx");
const jpgCricutSource = read("app/routes/jpg-to-svg-for-cricut.tsx");
const jpegCricutSource = read("app/routes/jpeg-to-svg-for-cricut.tsx");
assert.match(
  jpgSource,
  /const ALLOWED_EXTENSIONS = new Set\(\["png", "jpg", "jpeg", "webp", "svg"\]\)/,
);
assert.match(jpegSource, /"gif",[\s\S]*"avif",[\s\S]*"bmp",[\s\S]*"tiff"/);
assert.match(
  jpgCricutSource,
  /const ALLOWED_EXTENSIONS = new Set\(\["png", "jpg", "jpeg", "webp", "svg"\]\)/,
);
assert.match(
  jpegCricutSource,
  /"gif",[\s\S]*"avif",[\s\S]*"bmp",[\s\S]*"tiff"/,
);
assert.match(contextSource, /key: "jpeg-base"[\s\S]*distinct-accepted-input-policy/);

const existingRedirects = [
  ["/image-to-svg-converter", "/", "app/routes/image-to-svg-converter.tsx"],
  ["/tif-to-svg-converter", "/tiff-to-svg-converter", "app/routes/tif-to-svg-converter.tsx"],
  ["/png-to-vector-converter", "/png-to-svg-converter", "app/routes/png-to-vector-converter.tsx"],
  ["/jpg-to-vector-converter", "/jpg-to-svg-converter", "app/routes/jpg-to-vector-converter.tsx"],
];
for (const [sourcePath, destinationPath, sourceFile] of existingRedirects) {
  const source = read(sourceFile);
  assert.match(
    source,
    new RegExp(
      `return redirect\\("${destinationPath.replaceAll("/", "\\/")}", 301\\)`,
    ),
    `${sourcePath} is not a direct permanent redirect to ${destinationPath}.`,
  );
  const manifestLine = routeManifest
    .split(/\r?\n/)
    .find((line) => line.includes(`path: "${sourcePath}"`));
  assert(manifestLine, `${sourcePath} redirect is absent from the manifest.`);
  assert.match(manifestLine, /kind: "redirect-alias"/);
  assert.match(manifestLine, /indexable: false/);
  assert.match(manifestLine, /sitemap: "exclude"/);
  assert(
    manifestLine.includes(`canonicalPath: "${destinationPath}"`),
    `${sourcePath} manifest canonical does not match ${destinationPath}.`,
  );
  assert(
    manifestLine.includes(`redirectTo: "${destinationPath}"`),
    `${sourcePath} manifest redirect target does not match ${destinationPath}.`,
  );
}

const startingImageRedirectLine = startingRouteManifest
  .split(/\r?\n/)
  .find((line) => line.includes('path: "/image-to-svg-converter"'));
const currentImageRedirectLine = routeManifest
  .split(/\r?\n/)
  .find((line) => line.includes('path: "/image-to-svg-converter"'));
assert(startingImageRedirectLine && currentImageRedirectLine);
assert.equal(
  normalize(routeManifest).replace(
    normalize(currentImageRedirectLine),
    normalize(startingImageRedirectLine),
  ),
  normalize(startingRouteManifest),
  "The route manifest contains changes beyond the approved image redirect record.",
);

for (const protectedPath of [
  "app/routes.ts",
  "app/routes/sitemap.tsx",
  "public/sitemap.xml",
  "app/client/components/navigation/OtherToolsLinks.tsx",
  "Dockerfile",
  "server.js",
  "package-lock.json",
]) {
  assertUnchanged(protectedPath);
}

console.log(
  `Raster-to-SVG route-family audit passed: ${routePaths.length} retained routes, ` +
    `${new Set(definitions.map(({ implementationOwner }) => implementationOwner)).size} ` +
    "preserved route-configured implementations over shared trace/lifecycle/output primitives, " +
    "2 specialized workflows excluded, 4 existing direct redirects verified.",
);
