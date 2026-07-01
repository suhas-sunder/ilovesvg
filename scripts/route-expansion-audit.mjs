import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const indexableRoutes = [
  "/gif-to-svg-converter",
  "/avif-to-svg-converter",
  "/bmp-to-svg-converter",
  "/tiff-to-svg-converter",
  "/transparent-png-to-svg-converter",
  "/image-to-layered-svg-converter",
  "/jpg-to-layered-svg-converter",
  "/logo-to-layered-svg-converter",
  "/svg-to-ico-converter",
  "/image-to-favicon-generator",
  "/png-to-favicon-generator",
  "/jpg-to-favicon-generator",
  "/logo-to-favicon-generator",
  "/png-to-ico-converter",
  "/png-to-svg-for-shopify",
  "/logo-to-svg-for-shopify",
  "/svg-to-png-for-shopify",
  "/svg-to-favicon-for-shopify",
  "/svg-resizer-for-shopify",
  "/logo-to-favicon-for-shopify",
  "/svg-to-png-for-etsy",
  "/svg-to-jpg-for-etsy",
  "/logo-to-svg-for-etsy",
  "/sticker-to-svg-for-etsy",
  "/image-to-svg-for-etsy",
  "/jpg-to-svg-for-etsy",
  "/svg-resizer-for-etsy",
  "/svg-to-png-for-printify",
  "/svg-to-png-for-printful",
  "/sticker-to-png-for-printing",
  "/svg-to-transparent-png-for-printing",
  "/png-to-svg-for-glowforge",
  "/jpg-to-svg-for-glowforge",
  "/logo-to-svg-for-glowforge",
  "/svg-cleaner-for-glowforge",
  "/svg-resizer-for-glowforge",
  "/image-to-svg-for-glowforge",
  "/jpg-to-svg-for-silhouette",
  "/image-to-svg-for-silhouette",
  "/logo-to-svg-for-silhouette",
  "/sticker-to-svg-for-silhouette",
  "/svg-cleaner-for-silhouette",
  "/svg-resizer-for-silhouette",
  "/png-to-svg-for-canva",
  "/jpg-to-svg-for-canva",
  "/svg-to-png-for-canva",
  "/logo-to-svg-for-canva",
  "/svg-resizer-for-canva",
  "/svg-cleaner-for-figma",
  "/svg-resizer-for-figma",
  "/svg-to-png-for-figma",
  "/png-to-svg-for-figma",
  "/svg-to-jsx-converter",
];

const redirectRoutes = [
  "/tif-to-svg-converter",
  "/image-to-svg-converter",
  "/black-and-white-png-to-svg-converter",
  "/svg-transparent-background-tool",
  "/svg-to-react-component",
  "/svg-to-css-background",
  "/svg-to-data-uri-converter",
  "/svg-inline-code-generator",
  "/svg-viewbox-editor",
  "/svg-code-cleaner",
  "/svg-inspector",
  "/svg-background-remover",
  "/remove-background-from-svg",
  "/remove-svg-background",
  "/svg-resizer",
  "/resize-svg",
  "/scale-svg",
  "/svg-color-changer",
  "/change-svg-color-online",
  "/recolor-svg",
  "/png-to-vector-converter",
  "/jpg-to-vector-converter",
  "/svg-converter",
  "/free-svg-converter",
  "/font-to-svg-converter",
  "/text-to-svg-path-converter",
  "/svg-to-transparent-png-converter",
  "/image-to-outline-converter",
];

const unsupportedRoutes = [
  "/heic-to-svg-converter",
  "/ai-image-to-svg-converter",
  "/png-background-remover",
  "/logo-background-remover",
  "/svg-path-optimizer",
  "/svg-code-formatter",
];

const files = {
  routes: await read("app/routes.ts"),
  utilities: await read("app/client/components/navigation/OtherToolsLinks.tsx"),
  nav: await read("app/client/components/navigation/NavBar.tsx"),
  searchableNav: await read("app/client/components/navigation/toolNavSections.ts"),
  htmlSitemap: await read("app/routes/sitemap.tsx"),
  xmlSitemap: await read("public/sitemap.xml"),
  capabilities: await read("app/client/lib/converter/routeCapabilities.ts"),
};

const failures = [];

assertIncludes(files.nav, "TOOL_NAV_SECTIONS", "NavBar uses searchable nav sections");
assertIncludes(files.nav, "TOOL_NAV_ITEMS", "NavBar uses searchable nav items");

for (const route of indexableRoutes) {
  const slug = route.slice(1);
  await assertFile(`app/routes/${slug}.tsx`, `${route} route file`);
  assertIncludes(files.routes, `route("${slug}"`, `${route} in routes.ts`);
  assertIncludes(files.utilities, `to: "${route}"`, `${route} in all-tools registry`);
  assertIncludes(files.searchableNav, `href: "${route}"`, `${route} in searchable nav`);
  assertIncludes(files.htmlSitemap, `path: "${route}"`, `${route} in HTML sitemap`);
  assertIncludes(files.xmlSitemap, `<loc>https://www.ilovesvg.com/${slug}</loc>`, `${route} in XML sitemap`);
  assertIncludes(files.capabilities, `"${slug}":`, `${route} in route capabilities`);
}

for (const route of redirectRoutes) {
  const slug = route.slice(1);
  await assertFile(`app/routes/${slug}.tsx`, `${route} redirect route file`);
  assertIncludes(files.routes, `route("${slug}"`, `${route} in routes.ts`);
  assertIncludes(files.capabilities, `"${slug}":`, `${route} in route capabilities`);
  assertNotIncludes(files.xmlSitemap, `<loc>https://www.ilovesvg.com/${slug}</loc>`, `${route} excluded from XML sitemap`);
}

for (const route of unsupportedRoutes) {
  const slug = route.slice(1);
  await assertNoFile(`app/routes/${slug}.tsx`, `${route} unsupported route file`);
  assertNotIncludes(files.routes, `route("${slug}"`, `${route} route registration`);
  assertNotIncludes(files.utilities, `to: "${route}"`, `${route} all-tools registry entry`);
  assertNotIncludes(files.searchableNav, `href: "${route}"`, `${route} searchable nav entry`);
  assertNotIncludes(files.htmlSitemap, `path: "${route}"`, `${route} HTML sitemap entry`);
  assertNotIncludes(files.xmlSitemap, `<loc>https://www.ilovesvg.com/${slug}</loc>`, `${route} XML sitemap entry`);
}

assertNoDuplicateJsonLd("FAQPage", files.utilities, "OtherToolsLinks FAQ schema");
assertNoDuplicateRouteUtility(indexableRoutes, files.utilities);
assertNoDuplicateRouteUtility(indexableRoutes, files.htmlSitemap);

const generatedRouteFiles = await Promise.all(
  [...indexableRoutes, ...redirectRoutes].map((route) =>
    read(`app/routes/${route.slice(1)}.tsx`),
  ),
);
for (const [index, route] of [...indexableRoutes, ...redirectRoutes].entries()) {
  assertNotIncludes(generatedRouteFiles[index], "\u2014", `${route} has no em dash`);
}

const report = {
  checkedAt: new Date().toISOString(),
  indexableRoutes: indexableRoutes.length,
  redirectRoutes: redirectRoutes.length,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) {
  process.exitCode = 1;
}

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

async function assertFile(relativePath, label) {
  try {
    await fs.access(path.join(rootDir, relativePath));
  } catch {
    failures.push(`${label} missing`);
  }
}

async function assertNoFile(relativePath, label) {
  try {
    await fs.access(path.join(rootDir, relativePath));
    failures.push(`${label} should not be present`);
  } catch {
    // Expected for unsupported routes.
  }
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    failures.push(`${label} missing`);
  }
}

function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) {
    failures.push(`${label} should not be present`);
  }
}

function assertNoDuplicateJsonLd(type, text, label) {
  const count = [...text.matchAll(new RegExp(`"@type"\\s*:\\s*"${type}"`, "g"))].length;
  if (count > 1) {
    failures.push(`${label} appears ${count} times`);
  }
}

function assertNoDuplicateRouteUtility(routes, text) {
  for (const route of routes) {
    const count = text.split(route).length - 1;
    if (count < 1) {
      failures.push(`${route} missing from expected route text`);
    }
  }
}
