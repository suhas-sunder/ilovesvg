import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const normalizeRoute = (value) => {
  if (!value || value === "/") return "/";
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized.replace(/\/+$/, "") || "/";
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const parseRegisteredRoutes = () => {
  const routesSource = read("app/routes.ts");
  const routes = new Map();

  for (const match of routesSource.matchAll(/index\(\s*"routes\/([^"]+)"/g)) {
    routes.set("/", `app/routes/${match[1]}`);
  }

  for (const match of routesSource.matchAll(
    /route\(\s*"([^"]+)"\s*,\s*"routes\/([^"]+)"/g,
  )) {
    routes.set(normalizeRoute(match[1]), `app/routes/${match[2]}`);
  }

  return routes;
};

const parseHrefList = (source) =>
  Array.from(source.matchAll(/href:\s*"([^"]+)"/g), (match) => match[1]);

const routes = parseRegisteredRoutes();
const navDataSource = read("app/client/components/navigation/toolNavSections.ts");
const navBarSource = read("app/client/components/navigation/NavBar.tsx");

const sectionsStart = navDataSource.indexOf("export const TOOL_NAV_SECTIONS");
const sectionsEnd = navDataSource.indexOf("export const TOOL_NAV_ITEMS");
assert(sectionsStart >= 0 && sectionsEnd > sectionsStart, "Could not find TOOL_NAV_SECTIONS block");

const sectionsBlock = navDataSource.slice(sectionsStart, sectionsEnd);
const sectionLabels = Array.from(
  sectionsBlock.matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g),
  (match) => ({ id: match[1], label: match[2] }),
);

assert(sectionLabels.length > 0, "No navigation sections found");
assert(sectionLabels[0].label === "Most Popular", "Most Popular must be the first nav section");

const requiredSectionLabels = [
  "Most Popular",
  "Image to SVG",
  "Craft & Cut Files",
  "SVG Export",
  "SVG Editing",
  "Developer & Code",
  "Learn",
];

for (const label of requiredSectionLabels) {
  assert(
    sectionLabels.some((section) => section.label === label),
    `Missing nav section: ${label}`,
  );
}

const sectionHrefs = parseHrefList(sectionsBlock);
const duplicateSectionHrefs = sectionHrefs.filter(
  (href, index) => sectionHrefs.indexOf(href) !== index,
);
assert(
  duplicateSectionHrefs.length === 0,
  `Duplicate hrefs inside tool nav sections: ${duplicateSectionHrefs.join(", ")}`,
);

const desktopMenuHrefs = sectionHrefs;
const mobileMenuHrefs = sectionHrefs;
const duplicateDesktopMenuHrefs = desktopMenuHrefs.filter(
  (href, index) => desktopMenuHrefs.indexOf(href) !== index,
);
const duplicateMobileMenuHrefs = mobileMenuHrefs.filter(
  (href, index) => mobileMenuHrefs.indexOf(href) !== index,
);
assert(
  duplicateDesktopMenuHrefs.length === 0,
  `Duplicate hrefs inside desktop More menu: ${duplicateDesktopMenuHrefs.join(", ")}`,
);
assert(
  duplicateMobileMenuHrefs.length === 0,
  `Duplicate hrefs inside mobile menu: ${duplicateMobileMenuHrefs.join(", ")}`,
);

const popularStart = sectionsBlock.indexOf('id: "most-popular"');
const imageSectionStart = sectionsBlock.indexOf('id: "image-to-svg"', popularStart);
assert(popularStart >= 0 && imageSectionStart > popularStart, "Could not isolate Most Popular section");

const popularHrefs = parseHrefList(sectionsBlock.slice(popularStart, imageSectionStart));
const expectedPopularOrder = [
  "/png-to-svg-converter",
  "/svg-to-png-converter",
  "/jpg-to-svg-converter",
  "/jpeg-to-svg-converter",
  "/svg-to-pdf-converter",
  "/svg-to-jpg-converter",
  "/",
  "/svg-to-favicon-generator",
];

assert(
  popularHrefs.join("|") === expectedPopularOrder.join("|"),
  `Unexpected Most Popular order: ${popularHrefs.join(", ")}`,
);

const primaryBlockStart = navDataSource.indexOf("export const PRIMARY_NAV_ITEMS");
const primaryBlockEnd = navDataSource.indexOf("export const TOOL_NAV_SECTIONS");
assert(primaryBlockStart >= 0 && primaryBlockEnd > primaryBlockStart, "Could not find PRIMARY_NAV_ITEMS block");

const primaryHrefs = parseHrefList(navDataSource.slice(primaryBlockStart, primaryBlockEnd));
const duplicatePrimaryHrefs = primaryHrefs.filter(
  (href, index) => primaryHrefs.indexOf(href) !== index,
);
assert(
  duplicatePrimaryHrefs.length === 0,
  `Duplicate hrefs inside primary nav items: ${duplicatePrimaryHrefs.join(", ")}`,
);

const knownAnchors = new Set(["#other-tools"]);
const missingRoutes = [];
const redirectRoutes = [];

for (const href of new Set([...sectionHrefs, ...primaryHrefs])) {
  if (knownAnchors.has(href)) continue;

  const registeredFile = routes.get(normalizeRoute(href));
  if (!registeredFile) {
    missingRoutes.push(href);
    continue;
  }

  const routeSource = read(registeredFile);
  if (routeSource.includes("redirect(")) {
    redirectRoutes.push(href);
  }
}

assert(missingRoutes.length === 0, `Nav hrefs missing registered routes: ${missingRoutes.join(", ")}`);
assert(redirectRoutes.length === 0, `Nav hrefs point to redirect aliases: ${redirectRoutes.join(", ")}`);

assert(
  navBarSource.includes("TOOL_NAV_SECTIONS") &&
    navBarSource.includes("filterNavSections(TOOL_NAV_SECTIONS, desktopSearch)") &&
    navBarSource.includes("filterNavSections(TOOL_NAV_SECTIONS, mobileSearch)"),
  "Desktop and mobile nav must consume TOOL_NAV_SECTIONS",
);

assert(
  navBarSource.includes("DesktopNavGroup") && navBarSource.includes("MobileNavGroup"),
  "Desktop and mobile grouped nav components must remain present",
);

assert(
  navBarSource.includes('data-nav-menu="desktop-more"') &&
    navBarSource.includes('data-nav-menu="mobile-tools"'),
  "Desktop and mobile menus must expose auditable menu containers",
);

assert(
  navBarSource.includes("filteredMobileNavSections") &&
    navBarSource.includes("visibleItems.map") &&
    navBarSource.includes('data-nav-link=""'),
  "Mobile nav must render direct tool links from filtered sections",
);

assert(
  navBarSource.includes("DesktopSearchResults") &&
    navBarSource.includes("MobileSearchResults") &&
    navBarSource.includes('data-nav-search-results=""'),
  "Search mode must render flat direct tool links instead of grouped category blocks",
);

assert(
  !navBarSource.includes("<details") && !navBarSource.includes("<summary"),
  "Mobile nav must not hide all links behind category-only details blocks",
);

assert(
  navBarSource.includes("desktopMoreGridStyle") &&
    navBarSource.includes("gridTemplateColumns") &&
    navBarSource.includes("viewportSize.width >= 1840 ? 6") &&
    navBarSource.includes("viewportSize.width >= 1536 ? 5") &&
    navBarSource.includes("maxHeight") &&
    navBarSource.includes("calc(100vh"),
  "Desktop More menu must use viewport-aware width, columns, and height",
);

assert(
  navBarSource.includes("(viewportWidth - menuWidth) / 2") &&
    !navBarSource.includes("rightEdge - menuWidth"),
  "Desktop More menu should be centered in the viewport instead of right-aligned to the More button",
);

assert(
  navBarSource.includes("rankNavItems") &&
    navBarSource.includes("hasDirectionalSearchIntent") &&
    navBarSource.includes('replace(/\\b(?:two|too|2)\\b/g, " to ")'),
  "Tool search must rank direct results and preserve directional search intent",
);

console.log(
  JSON.stringify(
    {
      sections: sectionLabels.map((section) => section.label),
      sectionHrefCount: sectionHrefs.length,
      primaryHrefCount: primaryHrefs.length,
      mostPopular: popularHrefs,
      missingRoutes: missingRoutes.length,
      redirectRoutes: redirectRoutes.length,
      duplicateSectionHrefs: duplicateSectionHrefs.length,
      duplicateDesktopMenuHrefs: duplicateDesktopMenuHrefs.length,
      duplicateMobileMenuHrefs: duplicateMobileMenuHrefs.length,
    },
    null,
    2,
  ),
);
