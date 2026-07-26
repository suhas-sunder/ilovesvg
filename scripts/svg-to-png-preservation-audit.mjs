import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");
const baseUrl = getSmokeBaseUrl();
const origin = "https://www.ilovesvg.com";

const expected = [
  {
    key: "base",
    path: "/svg-to-png-converter",
    h1: "SVG to PNG Converter",
    sourceFile: "app/routes/svg-to-png-converter.tsx",
    platformName: null,
    hasDedicatedInlineSeoCopy: false,
  },
  {
    key: "shopify",
    path: "/svg-to-png-for-shopify",
    h1: "SVG to PNG for Shopify",
    sourceFile: "app/routes/svg-to-png-for-shopify.tsx",
    platformName: "Shopify",
    hasDedicatedInlineSeoCopy: false,
  },
  {
    key: "etsy",
    path: "/svg-to-png-for-etsy",
    h1: "SVG to PNG for Etsy",
    sourceFile: "app/routes/svg-to-png-for-etsy.tsx",
    platformName: "Etsy",
    hasDedicatedInlineSeoCopy: false,
  },
  {
    key: "printify",
    path: "/svg-to-png-for-printify",
    h1: "SVG to PNG for Printify",
    sourceFile: "app/routes/svg-to-png-for-printify.tsx",
    platformName: "Printify",
    hasDedicatedInlineSeoCopy: true,
  },
  {
    key: "printful",
    path: "/svg-to-png-for-printful",
    h1: "SVG to PNG for Printful",
    sourceFile: "app/routes/svg-to-png-for-printful.tsx",
    platformName: "Printful",
    hasDedicatedInlineSeoCopy: true,
  },
  {
    key: "sticker-printing",
    path: "/sticker-to-png-for-printing",
    h1: "Sticker SVG to PNG for Printing",
    sourceFile: "app/routes/sticker-to-png-for-printing.tsx",
    platformName: "Sticker printing",
    hasDedicatedInlineSeoCopy: false,
  },
  {
    key: "transparent-printing",
    path: "/svg-to-transparent-png-for-printing",
    h1: "SVG to Transparent PNG for Printing",
    sourceFile: "app/routes/svg-to-transparent-png-for-printing.tsx",
    platformName: "Transparent printing",
    hasDedicatedInlineSeoCopy: false,
  },
  {
    key: "canva",
    path: "/svg-to-png-for-canva",
    h1: "SVG to PNG for Canva",
    sourceFile: "app/routes/svg-to-png-for-canva.tsx",
    platformName: "Canva",
    hasDedicatedInlineSeoCopy: false,
  },
  {
    key: "figma",
    path: "/svg-to-png-for-figma",
    h1: "SVG to PNG for Figma",
    sourceFile: "app/routes/svg-to-png-for-figma.tsx",
    platformName: "Figma",
    hasDedicatedInlineSeoCopy: false,
  },
];

const expectedDefaults = {
  width: 1024,
  height: 1024,
  lockAspect: true,
  dpiScale: 1,
  background: "transparent",
  bgColor: "#ffffff",
  antiAlias: true,
  fileName: "converted",
};

const preChangeBaselines = {
  "transparent-and-partial-alpha": {
    sha256:
      "b1e32dc2d798c7154786093b5b61f30987a7b8a72432b115f50a61183bbf9cee",
    pixelSha256:
      "120832406404225fc4210c236eee5e441f84eb746de311f9fffc1f896af92f2c",
    width: 120,
    height: 80,
    filename: "transparentSvg.png",
  },
  "opaque-fills": {
    sha256:
      "b838e283fb83a7d9474d495cc6e6d08c5f20ef71cb34af49581bb3199891ff1f",
    pixelSha256:
      "5614893e12e33d953aa6ad4e1d89ab29a22beea37523eae7fdbafe45ed5c59f3",
    width: 96,
    height: 64,
    filename: "fillsSvg.png",
  },
  strokes: {
    sha256:
      "61203930b1c3ac4bedb3d65d2183956271ae35dbcfa9f240990180b68d0fa44a",
    pixelSha256:
      "bec90023046efb6d11e759f1c0365858dd4e4bc19337bde38b34a124d2647d95",
    width: 120,
    height: 80,
    filename: "strokesSvg.png",
  },
  "non-square-viewbox": {
    sha256:
      "f295cdbecf364ed98a1c1cfabe2180a91fdefe490b25f3ad27f9f4df86c3f0da",
    pixelSha256:
      "256247a0f9b7fec04a445d9e52b59b201fd6d9a3dc0e2962b1f5360ffcafa18d",
    width: 120,
    height: 80,
    filename: "nonSquareSvg.png",
  },
  "width-only": {
    sha256:
      "10ce99addfa7baaaaba84b296d8d7abdf695d9ce57ee8cfe96f2b6694ac97525",
    pixelSha256:
      "3b0c5716f1e264af3c28ef9d67268c7444e8e7bc6b12b358183cedf103e06d92",
    width: 150,
    height: 60,
    filename: "widthOnlySvg.png",
  },
  "viewbox-only": {
    sha256:
      "ebdc4051b2dbd9f68459b44a1435d4e8d04a54f569269bf2d592caf10b2d968a",
    pixelSha256:
      "3a9d96fdbf67a6737dcaf14b45b3099f3d2d42aadef4f99f4c0454e340fdabce",
    width: 90,
    height: 140,
    filename: "viewBoxOnlySvg.png",
  },
  "canvas-edges": {
    sha256:
      "1bffa07dc60e1c5131fef44c31acbb4d2f43bb76807ddc51465fedaaf4361437",
    pixelSha256:
      "81d0ef566feaf067ef6a91aa3ed8364eba89e16f5d50cc6044a1141c14003242",
    width: 128,
    height: 72,
    filename: "edgeSvg.png",
  },
};

async function main() {
  await assertLocalApp();
  const contexts = await loadTsModule(
    "app/client/lib/converter/svgToPngRouteContexts.ts",
  );
  const manifestModule = await loadTsModule("app/data/routeManifest.ts");
  const routesSource = await read("app/routes.ts");
  const capabilitySource = await read(
    "app/client/lib/converter/routeCapabilities.ts",
  );
  const baseSource = await read("app/routes/svg-to-png-converter.tsx");
  const sitemapXml = await read("public/sitemap.xml");
  const sitemapRouteSource = await read("app/routes/sitemap.tsx");

  auditContexts(contexts);
  auditRegistration(
    manifestModule.ROUTE_MANIFEST,
    routesSource,
    capabilitySource,
    sitemapXml,
    sitemapRouteSource,
  );
  await auditRouteSources(baseSource);
  const rendered = await auditRenderedIdentity(
    manifestModule.ROUTE_MANIFEST,
    contexts,
  );
  const parity = await runParityAudit();

  const summary = {
    familyRoutes: expected.map((item) => item.path),
    routeContextKeys: expected.map((item) => item.key),
    defaults: expectedDefaults,
    renderedIdentity: rendered,
    parity: {
      fixtureCount: parity.fixtureComparisons.length,
      fixtures: parity.fixtureComparisons.map((item) => ({
        fixture: item.fixture,
        routeCount: item.routes.length,
        allByteIdentical: item.allByteIdentical,
        allPixelIdentical: item.allPixelIdentical,
        dimensions: item.dimensions,
        filenames: item.filenames,
      })),
      background: {
        transparentPixels: parity.background.transparent.transparentPixels,
        partialAlphaPixels:
          parity.background.transparent.partialAlphaPixels,
        white: parity.background.whiteComparison,
        custom: parity.background.customComparison,
      },
      invalidInputs: parity.invalidInputs,
      lifecycle: parity.lifecycle,
      mobile: parity.mobile,
      preChangeBaselines,
    },
    preservation: {
      redirectsAdded: false,
      canonicalsConsolidated: false,
      sitemapMembershipChanged: false,
      artworkRecoloringAdded: false,
      schemaIdentity:
        "Existing base SVG-to-PNG breadcrumb identity preserved on all family routes.",
      resetModel:
        "The current Remove selected file action clears input/results; no settings-reset control exists.",
      historyModel:
        "The current family has live and final results, not a multi-entry history.",
      copyModel: "No Copy PNG action is currently exposed.",
    },
    redirectReady: false,
    ok: true,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function auditContexts(module) {
  const contexts = module.SVG_TO_PNG_ROUTE_CONTEXTS;
  const paths = module.SVG_TO_PNG_ROUTE_PATHS;
  assert(Array.isArray(paths), "SVG_TO_PNG_ROUTE_PATHS must be an array.");
  assert(contexts && typeof contexts === "object", "Missing route contexts.");
  assert(paths.length === expected.length, "Unexpected route path count.");
  assert(
    new Set(paths).size === paths.length,
    "Duplicate SVG-to-PNG route path.",
  );

  const keys = [];
  for (const item of expected) {
    const context = contexts[item.path];
    assert(context, `Missing route context for ${item.path}.`);
    assert(context.key === item.key, `${item.path} context key changed.`);
    assert(context.path === item.path, `${item.path} path changed.`);
    assert(context.h1 === item.h1, `${item.path} H1 changed.`);
    assert(
      context.platformName === item.platformName,
      `${item.path} platform name changed.`,
    );
    assert(
      context.canonicalPath === item.path,
      `${item.path} canonical was consolidated.`,
    );
    assert(
      context.inputAccept === "image/svg+xml,.svg",
      `${item.path} input accept changed.`,
    );
    assert(
      JSON.stringify(context.defaults) === JSON.stringify(expectedDefaults),
      `${item.path} defaults changed.`,
    );
    assert(
      context.outputFilenameMode === "source-basename",
      `${item.path} filename mode changed.`,
    );
    assert(
      context.breadcrumb.path === "/svg-to-png-converter" &&
        context.schema.path === "/svg-to-png-converter",
      `${item.path} existing breadcrumb/schema identity changed.`,
    );
    assert(
      context.hasDedicatedInlineSeoCopy ===
        item.hasDedicatedInlineSeoCopy,
      `${item.path} SEO-copy ownership changed.`,
    );
    keys.push(context.key);
  }
  assert(new Set(keys).size === keys.length, "Duplicate route-context key.");
  assertThrows(
    () => module.getSvgToPngRouteContext("/not-a-family-route"),
    "Unknown route context must fail instead of falling back.",
  );
}

function auditRegistration(
  manifest,
  routesSource,
  capabilitySource,
  sitemapXml,
  sitemapRouteSource,
) {
  const manifestByPath = new Map(manifest.map((entry) => [entry.path, entry]));
  const canonicals = new Set();
  for (const item of expected) {
    const entry = manifestByPath.get(item.path);
    assert(entry, `${item.path} missing from route manifest.`);
    assert(entry.sourceFile === item.sourceFile, `${item.path} source changed.`);
    assert(entry.family === "svg-export", `${item.path} family changed.`);
    assert(entry.publicRoute === true, `${item.path} is no longer public.`);
    assert(entry.indexable === true, `${item.path} indexing changed.`);
    assert(
      entry.sitemap === "xml-and-html",
      `${item.path} sitemap policy changed.`,
    );
    assert(!entry.redirectTo, `${item.path} became a redirect.`);
    assert(
      entry.canonicalPath === item.path,
      `${item.path} manifest canonical changed.`,
    );
    assert(entry.title && entry.description, `${item.path} metadata missing.`);
    canonicals.add(entry.canonicalPath);

    const routeToken = `route("${item.path.slice(1)}"`;
    assert(
      routesSource.includes(routeToken),
      `${item.path} missing from app/routes.ts.`,
    );
    const capabilityToken = `"${item.path.slice(1)}": "svg-export"`;
    assert(
      capabilitySource.includes(capabilityToken),
      `${item.path} capability changed.`,
    );
    assert(
      count(sitemapXml, `<loc>${origin}${item.path}</loc>`) === 1,
      `${item.path} XML sitemap membership changed.`,
    );
    assert(
      sitemapRouteSource.includes(`path: "${item.path}"`),
      `${item.path} HTML sitemap membership changed.`,
    );
  }
  assert(
    canonicals.size === expected.length,
    "Family canonicals are no longer self-referential and distinct.",
  );
}

async function auditRouteSources(baseSource) {
  assert(
    baseSource.includes("getSvgToPngRouteContext(pathname)"),
    "Base converter is not using the bounded context lookup.",
  );
  assert(
    baseSource.includes("accept={routeContext.inputAccept}"),
    "Input accept is not context-owned.",
  );
  assert(
    baseSource.includes("ctx.fillRect(0, 0, pxW, pxH)") &&
      baseSource.indexOf("ctx.fillRect(0, 0, pxW, pxH)") <
        baseSource.indexOf("ctx.drawImage(img, 0, 0, pxW, pxH)"),
    "Canvas background compositing order changed.",
  );
  assert(
    baseSource.includes("Please choose an SVG file."),
    "Invalid-input error changed.",
  );
  assert(
    baseSource.includes("Download PNG") && !baseSource.includes("Copy PNG"),
    "Current copy/download action surface changed.",
  );
  assert(
    baseSource.includes("setFile(null)") &&
      baseSource.includes("setLiveResult(null)") &&
      baseSource.includes("setResult(null)"),
    "Current clear/result cleanup behavior changed.",
  );

  for (const item of expected.slice(1)) {
    const source = await read(item.sourceFile);
    assert(
      source.includes('from "./svg-to-png-converter"'),
      `${item.path} no longer renders the production converter.`,
    );
    assert(
      !/\bredirect\s*\(/.test(source),
      `${item.path} route source contains a redirect.`,
    );
  }
}

async function auditRenderedIdentity(manifest, contextModule) {
  const manifestByPath = new Map(manifest.map((entry) => [entry.path, entry]));
  const results = [];
  for (const item of expected) {
    const response = await fetch(`${baseUrl}${item.path}`, {
      redirect: "manual",
    });
    assert(response.status === 200, `${item.path} did not return 200.`);
    assert(!response.headers.get("location"), `${item.path} redirected.`);
    const html = await response.text();
    const entry = manifestByPath.get(item.path);
    const context = contextModule.SVG_TO_PNG_ROUTE_CONTEXTS[item.path];
    const title = textContent(matchTag(html, "title"));
    const h1 = textContent(matchTag(html, "h1"));
    const description = getMeta(html, "name", "description");
    const canonical = getLink(html, "canonical");
    const ogUrl = getMeta(html, "property", "og:url");
    const breadcrumbs = getBreadcrumbJsonLd(html);
    const inputAccept = getFileInputAccept(html);

    assert(title === entry.title, `${item.path} title changed.`);
    assert(h1 === context.h1, `${item.path} rendered H1 changed.`);
    assert(
      description === entry.description,
      `${item.path} description changed.`,
    );
    assert(
      canonical === `${origin}${item.path}`,
      `${item.path} canonical changed.`,
    );
    assert(ogUrl === canonical, `${item.path} Open Graph URL changed.`);
    assert(
      breadcrumbs.some(
        (list) =>
          list.at(-1)?.item === `${origin}/svg-to-png-converter` &&
          list.at(-1)?.name === "SVG to PNG",
      ),
      `${item.path} existing SVG-to-PNG schema identity changed.`,
    );
    assert(
      inputAccept === context.inputAccept,
      `${item.path} rendered input accept changed.`,
    );
    assert(
      html.includes("Convert to PNG") &&
        html.includes("Download PNG") &&
        html.includes("Transparent backgrounds stay transparent"),
      `${item.path} converter actions or guidance missing.`,
    );
    results.push({
      path: item.path,
      title,
      h1,
      canonical,
      schemaPath: context.schema.path,
      inputAccept,
    });
  }
  return results;
}

async function runParityAudit() {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(rootDir, "scripts/converter-parity-audit.mjs")],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        CONVERTER_PARITY_SECTIONS: "svg-png",
      },
      timeout: 12 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
  const report = JSON.parse(stdout);
  assert(report.failures.length === 0, report.failures.join("; "));
  const family = report.svgToPng;
  assert(
    family.routes.length === expected.length,
    "Parity route count changed.",
  );
  assert(
    family.allByteIdentical && family.allPixelIdentical,
    "Default equivalent output diverged.",
  );
  assert(
    family.fixtureComparisons.length === 7,
    "SVG-to-PNG fixture matrix is incomplete.",
  );
  assert(
    family.invalidInputs.length === expected.length &&
      family.invalidInputs.every(
        (item) =>
          item.fixtureType === "image/png" &&
          item.errorVisible &&
          !item.hasResult &&
          item.downloadDisabled,
      ),
    "SVG-to-PNG invalid-input coverage failed.",
  );
  assert(
    family.lifecycle?.clearState?.hasFileInput &&
      !family.lifecycle?.clearState?.hasResult &&
      family.lifecycle?.clearState?.downloadDisabled &&
      family.lifecycle?.secondUploadState?.previewNaturalWidth === 192 &&
      family.lifecycle?.secondUploadState?.previewNaturalHeight === 128 &&
      family.lifecycle?.output?.filename === "fillsSvg.png" &&
      family.lifecycle?.output?.width === 192 &&
      family.lifecycle?.output?.height === 128,
    "SVG-to-PNG clear/second-upload lifecycle coverage failed.",
  );
  const expectedH1ByPath = new Map(
    expected.map((item) => [item.path, item.h1]),
  );
  assert(
    family.mobile.length === 4 &&
      family.mobile.every(
        (item) =>
          item.viewport[0] === 390 &&
          item.h1 === expectedH1ByPath.get(item.route) &&
          item.hasFileInput &&
          item.hasConvert &&
          item.hasDownload &&
          item.hasWidth &&
          item.hasBackground &&
          typeof item.horizontalOverflow === "boolean",
      ),
    "SVG-to-PNG mobile coverage failed.",
  );
  for (const comparison of family.fixtureComparisons) {
    const baseline = preChangeBaselines[comparison.fixture];
    assert(baseline, `Missing pre-change baseline for ${comparison.fixture}.`);
    assert(
      comparison.routes.length === expected.length,
      `${comparison.fixture} route coverage is incomplete.`,
    );
    assert(
      comparison.allByteIdentical && comparison.allPixelIdentical,
      `${comparison.fixture} output diverged.`,
    );
    assert(
      comparison.filenames.length === 1,
      `${comparison.fixture} filename behavior diverged.`,
    );
    assert(
      comparison.routes.every((route) =>
        Object.entries(baseline).every(
          ([key, value]) => route[key] === value,
        ),
      ),
      `${comparison.fixture} changed from its detached-main output baseline.`,
    );
  }
  for (const comparison of [
    report.backgroundPixels.whiteComparison,
    report.backgroundPixels.customComparison,
  ]) {
    assert(
      comparison.fullyOpaqueArtworkChanged === 0,
      "Canvas background changed opaque artwork.",
    );
    assert(
      comparison.transparentCanvasChanged ===
          report.backgroundPixels.transparent.transparentPixels &&
        comparison.partialAlphaChanged ===
          report.backgroundPixels.transparent.partialAlphaPixels,
      "Canvas background did not composite transparent/partial-alpha pixels.",
    );
  }
  return {
    fixtureComparisons: family.fixtureComparisons,
    background: report.backgroundPixels,
    invalidInputs: family.invalidInputs,
    lifecycle: family.lifecycle,
    mobile: family.mobile,
  };
}

async function loadTsModule(relativePath) {
  const source = await read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

async function assertLocalApp() {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert(
    response.ok && /iLoveSVG/i.test(html) && !/WRONG_APP_SENTINEL/.test(html),
    `Expected iLoveSVG at ${baseUrl}.`,
  );
}

function getBreadcrumbJsonLd(html) {
  const results = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const value = JSON.parse(match[1]);
      if (value?.["@type"] === "BreadcrumbList") {
        results.push(value.itemListElement || []);
      }
    } catch {}
  }
  return results;
}

function getMeta(html, attribute, value) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (getAttribute(tag, attribute) === value) {
      return decode(getAttribute(tag, "content") || "");
    }
  }
  return "";
}

function getLink(html, rel) {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (getAttribute(tag, "rel") === rel) {
      return decode(getAttribute(tag, "href") || "");
    }
  }
  return "";
}

function getFileInputAccept(html) {
  const tag = (html.match(/<input\b[^>]*type="file"[^>]*>/i) || [])[0] || "";
  return decode(getAttribute(tag, "accept") || "");
}

function getAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] || "";
}

function matchTag(html, tagName) {
  return (
    html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"))
      ?.[1] || ""
  );
}

function textContent(value) {
  return decode(String(value).replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function decode(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

function count(value, needle) {
  return String(value).split(needle).length - 1;
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
