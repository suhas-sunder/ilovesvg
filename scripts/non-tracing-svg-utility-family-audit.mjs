import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STARTING_MAIN = "59053aaffa3bb5e96d03bd0e77976eff3dfcec11";
const CONTEXT_FILE =
  "app/client/lib/converter/nonTracingSvgUtilityRouteContexts.ts";
const ALL_TOOLS_FILE =
  "app/client/components/navigation/OtherToolsLinks.tsx";

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readAtBase(relativePath) {
  return execFileSync(
    "git",
    ["show", `${STARTING_MAIN}:${relativePath}`],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
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

function parseSource(relativePath, source) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function findNamedNode(relativePath, source, name) {
  const sourceFile = parseSource(relativePath, source);
  let found;
  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === name
    ) {
      found = node;
      return;
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name
        ) {
          found = declaration.initializer;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(found, `${name} was not found in ${relativePath}`);
  return normalize(found.getText(sourceFile));
}

function assertNamedNodesUnchanged(relativePath, names) {
  const current = read(relativePath);
  const baseline = readAtBase(relativePath);
  for (const name of names) {
    assert.equal(
      findNamedNode(relativePath, current, name),
      findNamedNode(relativePath, baseline, name),
      `${relativePath}:${name} changed from the validated starting main`,
    );
  }
}

function publicStringInventory(relativePath, source) {
  const sourceFile = parseSource(relativePath, normalize(source));
  const values = new Set();
  function record(rawValue) {
    const value = rawValue.replace(/\s+/g, " ").trim();
    if (value.length < 18) return;
    if (
      /^(?:~\/|\.\/|app\/routes\/|app\/client\/|image\/|https:\/\/schema\.org\/)/.test(
        value,
      ) ||
      /^(?:favicon|resize|inspect|serialize|cleanup|redirect)-[a-z0-9-]+$/.test(
        value,
      ) ||
      value.startsWith("Unknown non-tracing SVG utility")
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

function walkFiles(relativeDirectory) {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = path
        .join(relativeDirectory, entry.name)
        .replaceAll("\\", "/");
      return entry.isDirectory() ? walkFiles(relativePath) : [relativePath];
    },
  );
}

const expectedRetained = [
  ["favicon-svg", "/svg-to-favicon-generator", "app/routes/svg-to-favicon-generator.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-svg-ico", "/svg-to-ico-converter", "app/routes/svg-to-ico-converter.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-image", "/image-to-favicon-generator", "app/routes/image-to-favicon-generator.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-png", "/png-to-favicon-generator", "app/routes/png-to-favicon-generator.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-jpg", "/jpg-to-favicon-generator", "app/routes/jpg-to-favicon-generator.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-logo", "/logo-to-favicon-generator", "app/routes/logo-to-favicon-generator.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-png-ico", "/png-to-ico-converter", "app/routes/png-to-ico-converter.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-shopify-svg", "/svg-to-favicon-for-shopify", "app/routes/svg-to-favicon-for-shopify.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["favicon-shopify-logo", "/logo-to-favicon-for-shopify", "app/routes/logo-to-favicon-for-shopify.tsx", "app/routes/svg-to-favicon-generator.tsx", "favicon-ico-generation"],
  ["resize-base", "/svg-resize-and-scale-editor", "app/routes/svg-resize-and-scale-editor.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["resize-shopify", "/svg-resizer-for-shopify", "app/routes/svg-resizer-for-shopify.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["resize-etsy", "/svg-resizer-for-etsy", "app/routes/svg-resizer-for-etsy.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["resize-glowforge", "/svg-resizer-for-glowforge", "app/routes/svg-resizer-for-glowforge.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["resize-silhouette", "/svg-resizer-for-silhouette", "app/routes/svg-resizer-for-silhouette.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["resize-canva", "/svg-resizer-for-canva", "app/routes/svg-resizer-for-canva.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["resize-figma", "/svg-resizer-for-figma", "app/routes/svg-resizer-for-figma.tsx", "app/routes/svg-resize-and-scale-editor.tsx", "resize-scale"],
  ["inspect-dimensions", "/svg-dimensions-inspector", "app/routes/svg-dimensions-inspector.tsx", "app/routes/svg-dimensions-inspector.tsx", "dimensions-file-inspection"],
  ["inspect-file-size", "/svg-file-size-inspector", "app/routes/svg-file-size-inspector.tsx", "app/routes/svg-file-size-inspector.tsx", "dimensions-file-inspection"],
  ["inspect-preview", "/svg-preview-viewer", "app/routes/svg-preview-viewer.tsx", "app/routes/svg-preview-viewer.tsx", "dimensions-file-inspection"],
  ["serialize-base64-encode", "/svg-to-base64", "app/routes/svg-to-base64.tsx", "app/routes/svg-to-base64.tsx", "code-base64-serialization"],
  ["serialize-base64-decode", "/base64-to-svg", "app/routes/base64-to-svg.tsx", "app/routes/base64-to-svg.tsx", "code-base64-serialization"],
  ["serialize-embed-code", "/svg-embed-code-generator", "app/routes/svg-embed-code-generator.tsx", "app/routes/svg-embed-code-generator.tsx", "code-base64-serialization"],
  ["serialize-inline-vs-img", "/inline-svg-vs-img", "app/routes/inline-svg-vs-img.tsx", "app/routes/inline-svg-vs-img.tsx", "code-base64-serialization"],
  ["serialize-jsx", "/svg-to-jsx-converter", "app/routes/svg-to-jsx-converter.tsx", "app/routes/svg-to-jsx-converter.tsx", "code-base64-serialization"],
  ["cleanup-minifier", "/svg-minifier", "app/routes/svg-minifier.tsx", "app/routes/svg-minifier.tsx", "svg-cleanup-normalization"],
  ["cleanup-base", "/svg-cleaner", "app/routes/svg-cleaner.tsx", "app/routes/svg-cleaner.tsx", "svg-cleanup-normalization"],
  ["cleanup-glowforge", "/svg-cleaner-for-glowforge", "app/routes/svg-cleaner-for-glowforge.tsx", "app/routes/svg-cleaner.tsx", "svg-cleanup-normalization"],
  ["cleanup-silhouette", "/svg-cleaner-for-silhouette", "app/routes/svg-cleaner-for-silhouette.tsx", "app/routes/svg-cleaner.tsx", "svg-cleanup-normalization"],
  ["cleanup-figma", "/svg-cleaner-for-figma", "app/routes/svg-cleaner-for-figma.tsx", "app/routes/svg-cleaner.tsx", "svg-cleanup-normalization"],
];

const expectedRedirects = [
  ["redirect-viewbox-editor", "/svg-viewbox-editor", "/svg-resize-and-scale-editor", "resize-scale"],
  ["redirect-svg-resizer", "/svg-resizer", "/svg-resize-and-scale-editor", "resize-scale"],
  ["redirect-resize-svg", "/resize-svg", "/svg-resize-and-scale-editor", "resize-scale"],
  ["redirect-scale-svg", "/scale-svg", "/svg-resize-and-scale-editor", "resize-scale"],
  ["redirect-svg-inspector", "/svg-inspector", "/svg-preview-viewer", "dimensions-file-inspection"],
  ["redirect-react-component", "/svg-to-react-component", "/svg-to-jsx-converter", "code-base64-serialization"],
  ["redirect-css-background", "/svg-to-css-background", "/svg-embed-code-generator", "code-base64-serialization"],
  ["redirect-data-uri", "/svg-to-data-uri-converter", "/svg-to-base64", "code-base64-serialization"],
  ["redirect-inline-code", "/svg-inline-code-generator", "/svg-embed-code-generator", "code-base64-serialization"],
  ["redirect-code-cleaner", "/svg-code-cleaner", "/svg-cleaner", "svg-cleanup-normalization"],
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
const contexts = contextModule.NON_TRACING_SVG_UTILITY_ROUTE_CONTEXTS;
const retained = contexts.filter(({ redirectTo }) => redirectTo === null);
const redirects = contexts.filter(({ redirectTo }) => redirectTo !== null);
const routeConfig = read("app/routes.ts");
const routeManifest = read("app/data/routeManifest.ts");
const htmlSitemap = read("app/routes/sitemap.tsx");
const xmlSitemap = read("public/sitemap.xml");

assert.equal(contexts.length, 39, "Unexpected non-tracing utility family size.");
assert.equal(retained.length, 29, "Unexpected retained utility route count.");
assert.equal(redirects.length, 10, "Unexpected utility redirect count.");
assert.deepEqual(
  retained.map(({ key, path: routePath, routeSource, implementationOwner, subfamily }) => [
    key,
    routePath,
    routeSource,
    implementationOwner,
    subfamily,
  ]),
  expectedRetained,
  "Retained context inventory differs from the audited family.",
);
assert.deepEqual(
  redirects.map(({ key, path: routePath, redirectTo, subfamily }) => [
    key,
    routePath,
    redirectTo,
    subfamily,
  ]),
  expectedRedirects,
  "Redirect context inventory differs from the established aliases.",
);
assert.equal(
  contextModule.NON_TRACING_SVG_UTILITY_RETAINED_PATHS.length,
  retained.length,
);
assert.equal(
  contextModule.NON_TRACING_SVG_UTILITY_REDIRECT_PATHS.length,
  redirects.length,
);
assert.equal(new Set(contexts.map(({ key }) => key)).size, contexts.length);
assert.equal(
  new Set(contexts.map(({ path: routePath }) => routePath)).size,
  contexts.length,
);
assert.ok(Object.isFrozen(contexts), "Context collection must be frozen.");
for (const context of contexts) {
  assert.ok(Object.isFrozen(context), `${context.path} context is mutable.`);
}

assert.throws(
  () =>
    contextModule.getNonTracingSvgUtilityRouteContextByKey("unknown"),
  /Unknown non-tracing SVG utility route key:/,
);
assert.throws(
  () =>
    contextModule.getNonTracingSvgUtilityRouteContextByPath(
      "/svg-cleaner?context=figma",
    ),
  /Unknown non-tracing SVG utility route path:/,
);
assert.throws(
  () => contextModule.assertNonTracingSvgUtilityOperation("unknown"),
  /Unknown non-tracing SVG utility operation:/,
);

for (const context of contexts) {
  assert.ok(
    routeConfig.includes(`"${context.path.slice(1)}"`),
    `${context.path} is missing from route registration.`,
  );
  assert.ok(
    routeManifest.includes(`path: "${context.path}"`),
    `${context.path} is missing from the route manifest.`,
  );
  assert.ok(fs.existsSync(path.join(ROOT, context.routeSource)));
}

for (const context of retained) {
  assert.equal(context.canonicalPath, context.path);
  assert.equal(context.redirectTo, null);
  assert.ok(context.contentContract, `${context.path} has no content contract.`);
  assert.ok(
    Object.isFrozen(context.contentContract),
    `${context.path} content contract is mutable.`,
  );
  assert.equal(
    context.contentContract.allToolsOwner,
    ALL_TOOLS_FILE,
    `${context.path} changed All Tools ownership.`,
  );
  assert.equal(
    context.contentContract.routeSpecificCopyRemainsAtSource,
    true,
  );
  assert.equal(
    context.decision,
    "retain-independently",
  );
  assert.equal(
    context.contentContract.consolidation.reconsiderationPolicy,
    "requires-new-evidence",
  );
  assert.ok(
    xmlSitemap.includes(`<loc>https://www.ilovesvg.com${context.path}</loc>`),
    `${context.path} is missing from the XML sitemap.`,
  );
  assert.ok(
    htmlSitemap.includes(`path: "${context.path}"`),
    `${context.path} is missing from the HTML sitemap.`,
  );
  const routeSource = read(context.routeSource);
  assert.ok(
    routeSource.includes(`"${context.key}"`),
    `${context.path} does not bind its explicit typed route key.`,
  );
}

const redirectPaths = new Set(redirects.map(({ path: routePath }) => routePath));
for (const context of redirects) {
  assert.equal(context.canonicalPath, context.redirectTo);
  assert.equal(context.decision, "safe-to-redirect");
  assert.equal(context.contentContract, null, `${context.path} has a dead content contract.`);
  assert.ok(!redirectPaths.has(context.redirectTo), `${context.path} chains.`);
  assert.notEqual(context.path, context.redirectTo, `${context.path} loops.`);
  const source = read(context.routeSource);
  assert.ok(
    source.includes(`redirect("${context.redirectTo}", 301)`),
    `${context.path} is not a direct permanent redirect.`,
  );
  assert.ok(
    !xmlSitemap.includes(`<loc>https://www.ilovesvg.com${context.path}</loc>`),
    `${context.path} must be excluded from the XML sitemap.`,
  );
  assert.ok(
    !htmlSitemap.includes(`path: "${context.path}"`),
    `${context.path} must be excluded from the HTML sitemap.`,
  );
}

const implicitSelectionOwners = [
  "app/routes/svg-to-favicon-generator.tsx",
  "app/routes/svg-resize-and-scale-editor.tsx",
  "app/routes/svg-cleaner.tsx",
];
for (const owner of implicitSelectionOwners) {
  const source = read(owner);
  assert.ok(!/\buseLocation\b/.test(source), `${owner} still uses useLocation.`);
  assert.ok(
    !/window\.location\.pathname|location\.pathname/.test(source),
    `${owner} still selects route behavior from the browser pathname.`,
  );
}
assert.ok(
  !/window\.location\.pathname/.test(read("app/routes/base64-to-svg.tsx")),
  "Base64 action routing still depends on window.location.pathname.",
);
assert.ok(
  /settings\.previewUseLocalBlobForFileEmbeds\r?\n\s+\? previewUrl/.test(
    read("app/routes/svg-embed-code-generator.tsx"),
  ),
  "The local-blob preview must not request a placeholder asset before input.",
);
assert.equal(
  (
    walkFiles("app/client/lib/converter").filter((relativePath) =>
      /nonTracingSvgUtilityRouteContexts\.ts$/.test(relativePath),
    )
  ).length,
  1,
  "More than one non-tracing utility context map exists.",
);

const algorithmNodes = new Map([
  [
    "app/routes/svg-to-favicon-generator.tsx",
    [
      "DEFAULTS",
      "rasterizeToSquareCanvas",
      "buildIcoFromCanvas",
      "encodeIcoFromPngs",
      "buildManifest",
      "buildBrowserConfig",
      "buildHtmlSnippet",
    ],
  ],
  [
    "app/routes/svg-resize-and-scale-editor.tsx",
    ["DEFAULTS", "resizeSvg", "parseSvgInfo"],
  ],
  [
    "app/routes/svg-cleaner.tsx",
    [
      "DEFAULTS",
      "cleanSvg",
      "stripEditorJunk",
      "removeUnusedDefsBestEffort",
      "removeEmptyGroupsBestEffort",
      "prettySvg",
    ],
  ],
  [
    "app/routes/svg-dimensions-inspector.tsx",
    ["DEFAULTS", "inspectSvg", "applyFix"],
  ],
  [
    "app/routes/svg-file-size-inspector.tsx",
    ["DEFAULTS", "inspectSvg", "minifySvgForSize"],
  ],
  [
    "app/routes/svg-preview-viewer.tsx",
    ["DEFAULTS", "buildSafeSvg", "parseSvgInfo", "analyzeSvgDom"],
  ],
  [
    "app/routes/svg-to-base64.tsx",
    [
      "DEFAULTS",
      "preprocessSvg",
      "toOutput",
      "base64EncodeUtf8",
      "encodeSvgForDataUri",
    ],
  ],
  [
    "app/routes/base64-to-svg.tsx",
    [
      "DEFAULTS",
      "decodeAndCleanSvg",
      "parseInput",
      "cleanSvg",
      "safeBase64Decode",
      "inferRasterDataUrl",
    ],
  ],
  [
    "app/routes/svg-embed-code-generator.tsx",
    ["DEFAULTS", "prepareSvg", "generateEmbed"],
  ],
  [
    "app/routes/inline-svg-vs-img.tsx",
    [
      "DEFAULTS",
      "generateInlineSnippet",
      "generateImgSnippet",
      "normalizeSvg",
      "decodeSvgDataUriToSvg",
      "encodeSvgForUtf8DataUri",
    ],
  ],
  [
    "app/routes/svg-to-jsx-converter.tsx",
    ["convertSvgToJsx", "formatJsx"],
  ],
  ["app/routes/svg-minifier.tsx", ["DEFAULTS"]],
]);
for (const [relativePath, names] of algorithmNodes) {
  assertNamedNodesUnchanged(relativePath, names);
}

for (const context of retained) {
  assert.deepEqual(
    publicStringInventory(context.routeSource, read(context.routeSource)),
    publicStringInventory(context.routeSource, readAtBase(context.routeSource)),
    `${context.routeSource} changed public copy or metadata strings.`,
  );
}

for (const protectedFile of [
  ALL_TOOLS_FILE,
  "app/routes.ts",
  "app/data/routeManifest.ts",
  "app/routes/sitemap.tsx",
  "public/sitemap.xml",
  "Dockerfile",
  "server.js",
  "package-lock.json",
]) {
  assertUnchanged(protectedFile);
}

const trackedGenerated = execFileSync(
  "git",
  ["ls-files", "docs/audits/runtime-verification", "*.log", "coverage", "test-results"],
  { cwd: ROOT, encoding: "utf8" },
).trim();
assert.equal(trackedGenerated, "", "Generated verification output is tracked.");

console.log(
  JSON.stringify(
    {
      startingMain: STARTING_MAIN,
      retainedRoutes: retained.length,
      establishedRedirects: redirects.length,
      subfamilies: Object.fromEntries(
        [...new Set(retained.map(({ subfamily }) => subfamily))].map(
          (subfamily) => [
            subfamily,
            retained.filter((context) => context.subfamily === subfamily)
              .length,
          ],
        ),
      ),
      algorithmOwnersProtected: algorithmNodes.size,
      allToolsSha256: sourceHash(ALL_TOOLS_FILE),
      routeRegistrationPreserved: true,
      metadataAndPublicStringsPreserved: true,
      outputAlgorithmsAndDefaultsPreserved: true,
      directRedirectsOnly: true,
      generatedArtifactsTracked: false,
      ok: true,
    },
    null,
    2,
  ),
);
