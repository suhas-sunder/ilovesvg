import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routesFile = path.join(rootDir, "app", "routes.ts");
const routesDir = path.join(rootDir, "app", "routes");
const sitemapFile = path.join(routesDir, "sitemap.tsx");
const footerFile = path.join(
  rootDir,
  "app",
  "client",
  "components",
  "navigation",
  "SiteFooter.tsx",
);
const docsComponentFile = path.join(
  rootDir,
  "app",
  "client",
  "components",
  "docs",
  "HowItWorksDocs.tsx",
);
const docsContentFile = path.join(
  rootDir,
  "app",
  "client",
  "lib",
  "docs",
  "howItWorksContent.ts",
);
const presetIntensityFile = path.join(
  rootDir,
  "app",
  "client",
  "lib",
  "converter",
  "presetIntensity.ts",
);

const requiredDocs = [
  {
    path: "/how-it-works",
    file: "how-it-works.tsx",
    title: "How It Works",
    terms: ["filled paths", "centerline", "presets", "settings", "queue", "output history"],
  },
  {
    path: "/how-it-works/conversion-workflow",
    file: "how-it-works.conversion-workflow.tsx",
    title: "Conversion Workflow",
    terms: ["Upload", "Convert", "Copy SVG", "Download SVG", "queued"],
  },
  {
    path: "/how-it-works/presets",
    file: "how-it-works.presets.tsx",
    title: "Preset Guide",
    terms: [
      "Lightning Fast",
      "Extreme Speed",
      "High Speed",
      "Low Speed",
      "Slow Speed",
      "Very Slow",
      "Insanely Slow",
      "filled paths",
      "centerline",
    ],
  },
  {
    path: "/how-it-works/settings",
    file: "how-it-works.settings.tsx",
    title: "Settings Guide",
    terms: ["Stroke output mode", "Line weight", "Fill spread", "Update preview", "Layer colors"],
  },
  {
    path: "/how-it-works/troubleshooting",
    file: "how-it-works.troubleshooting.tsx",
    title: "Troubleshooting",
    terms: ["transparent", "background", "rate limit", "too many specks"],
  },
  {
    path: "/how-it-works/exporting-and-downloads",
    file: "how-it-works.exporting-and-downloads.tsx",
    title: "Exporting and Downloads",
    terms: ["Copy SVG", "Download SVG", "file size", "batch ZIP"],
  },
];

const failures = [];
const routeTable = await readText(routesFile);
const sitemap = await readText(sitemapFile);
const footer = await readText(footerFile);
const docsComponent = await readText(docsComponentFile);
const docsContent = await readText(docsContentFile);
const presetIntensity = await readText(presetIntensityFile);
const knownRoutes = collectKnownRoutes(routeTable);

if (/aria-label=["']How it works pages["']/.test(docsComponent)) {
  failures.push("Docs shell should not add a second nested How it works nav bar");
}
assertIncludes(docsComponent, "DocsRelatedReads", "docs shell renders useful next reads cross-links");
assertIncludes(docsComponent, "Useful next reads", "docs shell labels the cross-link block clearly");

for (const doc of requiredDocs) {
  if (!knownRoutes.has(doc.path)) {
    failures.push(`Missing route registration for ${doc.path}`);
  }

  const filePath = path.join(routesDir, doc.file);
  const source = await readText(filePath);
  if (!source) {
    failures.push(`Missing docs route file ${doc.file}`);
    continue;
  }

  assertIncludes(source, "export function meta", `${doc.file} exports meta`);
  assertIncludes(source, "canonical", `${doc.file} defines canonical metadata`);
  assertCanonical(source, doc);
  assertIncludes(source, "og:title", `${doc.file} defines Open Graph title`);
  assertIncludes(source, "og:description", `${doc.file} defines Open Graph description`);
  assertIncludes(source, doc.title, `${doc.file} contains expected page title`);

  const searchableSource = `${source}\n${docsContent}\n${presetIntensity}`;
  for (const term of doc.terms) {
    assertIncludes(searchableSource, term, `${doc.file} documents ${term}`);
  }

  if (/\bTODO\b|coming soon|placeholder/i.test(source)) {
    failures.push(`${doc.file} contains TODO/placeholder-style copy`);
  }

  const links = collectInternalLinks(source);
  for (const link of links) {
    if (!knownRoutes.has(link)) {
      failures.push(`${doc.file} links to missing route ${link}`);
    }
  }
}

for (const doc of requiredDocs) {
  assertIncludes(sitemap, doc.path, `sitemap links ${doc.path}`);
}
assertIncludes(footer, "/how-it-works", "footer links the docs hub");

if (failures.length > 0) {
  console.error(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        failures,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      docsRoutes: requiredDocs.map((doc) => doc.path),
      knownRoutes: knownRoutes.size,
      ok: true,
    },
    null,
    2,
  ),
);

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) failures.push(label);
}

function assertCanonical(source, doc) {
  const exact = `https://www.ilovesvg.com${doc.path}`;
  const viaSiteUrl = "${SITE_URL}" + doc.path;
  if (source.includes(exact) || source.includes(viaSiteUrl)) return;
  failures.push(`${doc.file} canonical URL matches route`);
}

function collectKnownRoutes(source) {
  const routes = new Set(["/"]);
  const pattern = /route\(\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1].startsWith("api/")) continue;
    routes.add(`/${match[1]}`);
  }
  return routes;
}

function collectInternalLinks(source) {
  const links = new Set();
  const patterns = [
    /\bto=\{?["'](\/[^"'}#?]+)(?:[#?][^"'}]*)?["']\}?/g,
    /\bhref=\{?["'](\/[^"'}#?]+)(?:[#?][^"'}]*)?["']\}?/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const link = match[1].replace(/\/$/, "") || "/";
      if (!link.startsWith("//")) links.add(link);
    }
  }
  return [...links];
}
