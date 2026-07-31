import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STARTING_MAIN = "b8c59d60cd667932a85fbb2544402e403d60c467";
const CONTEXT_FILE =
  "app/client/lib/converter/svgToJpgRouteContexts.ts";
const PRESERVED_FILES = [
  "app/client/components/navigation/OtherToolsLinks.tsx",
  "Dockerfile",
  "server.js",
  "package-lock.json",
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readAtBase(relativePath) {
  return execFileSync("git", ["show", `${STARTING_MAIN}:${relativePath}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
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

async function importTypescriptModule(relativePath) {
  const source = read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    fileName: relativePath,
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

const manifestModule = await importTypescriptModule("app/data/routeManifest.ts");
const manifest = manifestModule.ROUTE_MANIFEST;
const publicRoutes = manifest.filter((entry) => entry.publicRoute);
const retainedRoutes = publicRoutes.filter((entry) => !entry.redirectTo);
const redirects = publicRoutes.filter((entry) => entry.redirectTo);

assert.equal(manifest.length, 157, "The authoritative manifest size changed.");
assert.equal(publicRoutes.length, 156, "The public route count changed.");
assert.equal(retainedRoutes.length, 128, "The retained route count changed.");
assert.equal(redirects.length, 28, "The established redirect count changed.");
assert.equal(
  new Set(manifest.map(({ path: routePath }) => routePath)).size,
  manifest.length,
  "The route manifest contains a duplicate path.",
);

const routeConfig = normalize(read("app/routes.ts"));
const registered = new Map([["/", "app/routes/home.tsx"]]);
for (const match of routeConfig.matchAll(
  /route\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,?\s*\)/gs,
)) {
  const routePath = `/${match[1]}`;
  assert.ok(!registered.has(routePath), `Duplicate registered path: ${routePath}`);
  registered.set(routePath, `app/${match[2]}`);
}
assert.equal(registered.size, manifest.length, "Route registry size differs from the manifest.");

for (const entry of manifest) {
  assert.equal(
    registered.get(entry.path),
    entry.sourceFile,
    `Registration owner differs for ${entry.path}`,
  );
  assert.ok(entry.family, `${entry.path} has no implementation family.`);
  assert.ok(fs.existsSync(path.join(ROOT, entry.sourceFile)), `${entry.sourceFile} is missing.`);
  if (!entry.redirectTo) {
    assert.equal(entry.canonicalPath, entry.path, `${entry.path} is not self-canonical.`);
  }
}

const redirectPaths = new Set(redirects.map(({ path: routePath }) => routePath));
for (const entry of redirects) {
  assert.equal(entry.kind, "redirect-alias", `${entry.path} has the wrong redirect kind.`);
  assert.equal(entry.indexable, false, `${entry.path} is an indexable redirect.`);
  assert.equal(entry.sitemap, "exclude", `${entry.path} is present in a sitemap.`);
  assert.equal(entry.canonicalPath, entry.redirectTo, `${entry.path} has a stale canonical target.`);
  assert.ok(!redirectPaths.has(entry.redirectTo), `${entry.path} creates a redirect chain.`);
  assert.ok(
    retainedRoutes.some(({ path: routePath }) => routePath === entry.redirectTo),
    `${entry.path} does not target a retained route.`,
  );
  const source = read(entry.sourceFile);
  const redirectCall = source.match(/redirect\(\s*"([^"]+)"\s*,\s*(\d+)\s*\)/);
  assert.ok(redirectCall, `${entry.sourceFile} has no static redirect call.`);
  assert.equal(redirectCall[1], entry.redirectTo, `${entry.path} has the wrong destination.`);
  assert.equal(redirectCall[2], "301", `${entry.path} is not permanent.`);
}

const contextModule = await importTypescriptModule(CONTEXT_FILE);
const baseContext = contextModule.getSvgToJpgRouteContext("svg-jpg-base");
const etsyContext = contextModule.getSvgToJpgRouteContext("svg-jpg-etsy");
assert.deepEqual(
  [baseContext.publicPath, etsyContext.publicPath],
  ["/svg-to-jpg-converter", "/svg-to-jpg-for-etsy"],
  "SVG-to-JPG route contexts do not cover the exact two routes.",
);
assert.equal(baseContext.faqSchemaOwner, "routes/svg-to-jpg-converter");
assert.equal(etsyContext.faqSchemaOwner, null);
assert.equal(
  contextModule.getSvgToJpgRouteContextByPath("/svg-to-jpg-for-etsy").key,
  "svg-jpg-etsy",
  "Exact path lookup did not preserve Etsy ownership.",
);
assert.throws(
  () => contextModule.getSvgToJpgRouteContext("unknown-route"),
  /Unknown SVG-to-JPG route key/,
  "Unknown route keys must fail explicitly.",
);
assert.throws(
  () => contextModule.getSvgToJpgRouteContextByPath("/svg-to-jpg-converter?context=etsy"),
  /Unknown SVG-to-JPG public path/,
  "Query-bearing paths must not resolve.",
);

const jpgImplementation = read("app/routes/svg-to-jpg-converter.tsx");
const jpgEtsyWrapper = read("app/routes/svg-to-jpg-for-etsy.tsx");
assert.doesNotMatch(jpgImplementation, /useLocation|location\.pathname|window\.location/);
assert.match(jpgImplementation, /routeKey="svg-jpg-base"/);
assert.match(jpgEtsyWrapper, /routeKey="svg-jpg-etsy"/);
assert.match(jpgImplementation, /SvgToJpgConverterImplementation/);
assert.match(jpgEtsyWrapper, /SvgToJpgConverterImplementation/);

const colorPicker = read("app/routes/free-color-picker.tsx");
const privacyContent = read("app/content/legal/privacyPolicyContent.tsx");
const accessibilityRoute = read(
  "app/routes/svg-accessibility-and-contrast-checker.tsx",
);
const applicationCss = read("app/app.css");
assert.doesNotMatch(
  colorPicker,
  /<svg[^>]*\bheight="auto"/,
  "The color-picker preview must not emit an invalid SVG height attribute.",
);
assert.doesNotMatch(
  privacyContent,
  /<p>\s*<span>\s*This privacy notice/,
  "Privacy content must not render a list inside a paragraph.",
);
assert.match(privacyContent, /<div>\s*<span>\s*This privacy notice/);
assert.match(
  accessibilityRoute,
  /accessibility-route-guide-containment/,
  "The accessibility route guide must retain its scoped mobile containment.",
);
assert.match(
  accessibilityRoute,
  /lg:grid-cols-\[minmax\(0,5fr\)_minmax\(0,7fr\)\]/,
  "The accessibility workspace must use bounded grid tracks.",
);
assert.match(
  applicationCss,
  /\.accessibility-route-guide-containment > section/,
  "The accessibility guide containment rule is missing.",
);

const remainingSubfamilies = new Map([
  ["svg-raster-and-document-export", [
    "/svg-to-jpg-converter",
    "/svg-to-jpg-for-etsy",
    "/svg-to-webp-converter",
    "/svg-to-pdf-converter",
  ]],
  ["svg-appearance-editing", [
    "/svg-background-editor",
    "/svg-recolor",
    "/svg-stroke-width-editor",
  ]],
  ["svg-geometry-editing", ["/svg-flip-and-rotate-editor"]],
  ["svg-accessibility-analysis", ["/svg-accessibility-and-contrast-checker"]],
  ["generative-svg-utilities", [
    "/free-color-picker",
    "/emoji-to-svg-converter",
    "/text-to-svg-converter",
  ]],
  ["site-documentation-and-meta", [
    "/how-it-works",
    "/how-it-works/conversion-workflow",
    "/how-it-works/presets",
    "/how-it-works/settings",
    "/how-it-works/troubleshooting",
    "/how-it-works/exporting-and-downloads",
    "/pro-waitlist",
    "/cookies",
    "/privacy-policy",
    "/terms-of-service",
    "/sitemap",
  ]],
]);
const publicPathSet = new Set(publicRoutes.map(({ path: routePath }) => routePath));
for (const [subfamily, paths] of remainingSubfamilies) {
  assert.equal(new Set(paths).size, paths.length, `${subfamily} contains duplicate paths.`);
  for (const routePath of paths) {
    assert.ok(publicPathSet.has(routePath), `${subfamily} references unknown ${routePath}.`);
    assert.ok(!redirectPaths.has(routePath), `${routePath} cannot be classified as retained.`);
  }
}

for (const relativePath of PRESERVED_FILES) assertUnchanged(relativePath);

const routeFilesUsingImplicitSelection = fs
  .readdirSync(path.join(ROOT, "app/routes"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .filter((entry) => {
    const source = read(`app/routes/${entry.name}`);
    return (
      /useLocation/.test(source) ||
      /(?:window\.)?location\.pathname\s*(?:===|==|\.includes|\.startsWith)/.test(
        source,
      )
    );
  })
  .map((entry) => entry.name);
assert.deepEqual(
  routeFilesUsingImplicitSelection,
  [],
  "Route implementations still derive ownership from the current pathname.",
);

const result = {
  status: "pass",
  manifestEntries: manifest.length,
  publicRoutes: publicRoutes.length,
  retainedRoutes: retainedRoutes.length,
  establishedRedirects: redirects.length,
  newRedirects: 0,
  remainingSubfamilies: Object.fromEntries(remainingSubfamilies),
  explicitSvgToJpgContexts: [baseContext.key, etsyContext.key],
  preservedFiles: PRESERVED_FILES,
};

console.log("Final repository closure audit passed.");
console.log(JSON.stringify(result, null, 2));
