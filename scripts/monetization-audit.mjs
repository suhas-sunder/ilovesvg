import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-monetization-audit");

await fs.rm(tmpDir, { recursive: true, force: true });
await fs.mkdir(tmpDir, { recursive: true });

async function transpile(relativePath, outputName) {
  const source = await fs.readFile(path.join(rootDir, relativePath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: true,
    },
    fileName: relativePath,
  }).outputText;
  await fs.writeFile(path.join(tmpDir, outputName), transpiled);
}

await transpile("app/client/lib/monetization/monetizationPolicy.ts", "policy.mjs");
await transpile("app/data/routeManifest.ts", "routeManifest.mjs");

const policy = await import(pathToFileURL(path.join(tmpDir, "policy.mjs")).href);
const routeManifest = await import(
  pathToFileURL(path.join(tmpDir, "routeManifest.mjs")).href
);

function assertPolicy(route, expected, label = route) {
  assert.deepEqual(
    policy.getRouteMonetizationPolicy(`${route}/?utm_source=test#section`),
    expected,
    label,
  );
}

function expectedRoutePolicy(entry) {
  if (!entry.publicRoute || entry.family === "api") {
    return {
      mode: "excluded",
      ads: false,
      placement: "none",
      exclusionReason: "api",
    };
  }

  if (entry.family === "redirect") {
    return {
      mode: "excluded",
      ads: false,
      placement: "none",
      exclusionReason: "redirect",
    };
  }

  if (entry.family === "legal") {
    return {
      mode: "excluded",
      ads: false,
      placement: "none",
      exclusionReason: "legal-trust",
    };
  }

  if (entry.family === "sitemap-meta") {
    return {
      mode: "excluded",
      ads: false,
      placement: "none",
      exclusionReason: "sitemap-meta",
    };
  }

  if (entry.path === "/pro-waitlist") {
    return {
      mode: "focused-no-monetization",
      ads: false,
      placement: "none",
      exclusionReason: "owned-funnel",
    };
  }

  if (entry.family === "documentation") {
    return {
      mode: "compact-ad",
      ads: true,
      placement: "docs-compact-ad",
    };
  }

  return {
    mode: "compact-ad",
    ads: true,
    placement: "contextual-compact-ad",
  };
}

for (const route of ["/privacy-policy", "/terms-of-service", "/cookies"]) {
  assertPolicy(
    route,
    {
      mode: "excluded",
      ads: false,
      placement: "none",
      exclusionReason: "legal-trust",
    },
    `${route} excludes legal/trust pages from ads`,
  );
  assert.equal(policy.shouldRenderAdsForPath(route), false);
  assert.equal(policy.isMonetizationExcludedRoute(route), true);
}

for (const route of [
  "/how-it-works",
  "/how-it-works/conversion-workflow",
  "/how-it-works/exporting-and-downloads",
  "/how-it-works/presets",
  "/how-it-works/settings",
  "/how-it-works/troubleshooting",
]) {
  assertPolicy(
    route,
    {
      mode: "compact-ad",
      ads: true,
      placement: "docs-compact-ad",
    },
    `${route} keeps the docs compact ad policy`,
  );
  assert.equal(policy.shouldRenderAdsForPath(route), true);
}

for (const route of [
  "/svg-cleaner",
  "/svg-resize-and-scale-editor",
  "/svg-to-base64",
  "/text-to-svg-converter",
  "/png-to-svg-converter",
]) {
  assertPolicy(
    route,
    {
      mode: "compact-ad",
      ads: true,
      placement: "contextual-compact-ad",
    },
    `${route} keeps contextual compact ads`,
  );
  assert.equal(policy.shouldRenderAdsForPath(route), true);
}

for (const route of ["/pro-waitlist", "/sitemap", "/api/batch-svg"]) {
  assert.equal(policy.shouldRenderAdsForPath(route), false);
}

const coverage = routeManifest.ROUTE_MANIFEST.map((entry) => {
  const actual = policy.getRouteMonetizationPolicy(entry.path);
  const expected = expectedRoutePolicy(entry);
  assert.deepEqual(actual, expected, `${entry.path} monetization policy`);

  return {
    route: entry.path,
    family: entry.family,
    eligible: actual.ads,
    placement: actual.placement,
    reason: actual.exclusionReason ?? "",
  };
});

const eligibleCount = coverage.filter((entry) => entry.eligible).length;
const excludedCount = coverage.length - eligibleCount;

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      routes: coverage.length,
      eligibleCount,
      excludedCount,
      coverage,
    },
    null,
    2,
  ),
);
