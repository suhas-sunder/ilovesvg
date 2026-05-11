import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mode = process.argv[2] || "all";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runResponsiveAudit() {
  const css = read("app/app.css");
  const advanced = read("app/client/components/converter/AdvancedSettingsPanel.tsx");
  const tracePanel = read("app/client/components/converter/TraceOutputPanel.tsx");
  const bespokePanel = read("app/client/components/converter/BespokeTraceOutputPanel.tsx");
  const layers = read("app/client/components/svg/LayerPaletteEditor.tsx");
  const home = read("app/routes/home.tsx");
  const layered = read("app/routes/png-to-layered-svg-for-cricut.tsx");

  assertIncludes(css, "@media (max-width: 767px)", "responsive css");
  assertIncludes(css, ".converter-empty-output-state.hidden", "mobile empty placeholder override");
  assertIncludes(css, ":not([data-output-panel-focused=\"true\"])", "focused editor sibling hiding");
  assertIncludes(advanced, "sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]", "settings field responsive grid");
  assertIncludes(layers, "grid-cols-[auto_auto_minmax(0,1fr)]", "layer row responsive grid");
  assertIncludes(tracePanel, "md:order-2 md:overflow-auto", "shared output mobile order");
  assertIncludes(tracePanel, "Minimize original image", "focused original minimize");
  assertIncludes(tracePanel, "hidden md:flex", "shared idle placeholder mobile hide");
  assertIncludes(bespokePanel, "md:order-2 md:overflow-auto", "bespoke output mobile order");
  assertIncludes(bespokePanel, "hidden md:flex", "bespoke idle placeholder mobile hide");
  assertIncludes(home, "originalPreviewCollapsed", "home original collapse state");
  assertIncludes(home, "Minimize original image", "home original minimize");
  assertIncludes(home, "hidden md:flex", "home idle placeholder mobile hide");
  assertIncludes(layered, "md:order-2 md:overflow-auto", "layered route output mobile order");
  assertIncludes(layered, "hidden md:flex", "layered route idle placeholder mobile hide");
}

function runNavAudit() {
  const nav = read("app/client/components/navigation/NavBar.tsx");
  const navData = read("app/client/components/navigation/toolNavSections.ts");
  const primaryBlockStart = navData.indexOf("export const PRIMARY_NAV_ITEMS");
  const primaryBlockEnd = navData.indexOf("export const TOOL_NAV_SECTIONS");
  assert(primaryBlockStart >= 0 && primaryBlockEnd > primaryBlockStart, "missing primary nav block");
  const primaryBlock = navData.slice(primaryBlockStart, primaryBlockEnd);
  const primaryHrefs = Array.from(primaryBlock.matchAll(/href:\s*"([^"]+)"/g)).map(
    (match) => match[1],
  );

  assertIncludes(nav, "TOOL_NAV_SECTIONS", "shared nav sections");
  assertIncludes(navData, "label: \"Most Popular\"", "most popular section");
  assertIncludes(navData, "label: \"Image to SVG\"", "image to svg section");
  assertIncludes(navData, "label: \"Craft & Cut Files\"", "craft section");
  assertIncludes(navData, "label: \"SVG Export\"", "export section");
  assertIncludes(navData, "label: \"SVG Editing\"", "editing section");
  assertIncludes(navData, "label: \"Developer & Code\"", "developer section");
  assertIncludes(navData, "label: \"Learn\"", "learn section");
  assertIncludes(nav, "DesktopNavGroup", "desktop grouped nav");
  assertIncludes(nav, "MobileNavGroup", "mobile grouped nav");
  assertIncludes(nav, "filterNavSections", "shared nav section filtering");
  assertIncludes(nav, "data-nav-menu=\"desktop-more\"", "auditable desktop nav menu");
  assertIncludes(nav, "data-nav-menu=\"mobile-tools\"", "auditable mobile nav menu");
  assertIncludes(nav, "visibleItems.map", "mobile nav renders direct links");
  assertIncludes(nav, "Show {hiddenCount} more", "large mobile sections expose direct links before show more");
  assertIncludes(nav, "maxHeight", "viewport-aware desktop menu height");
  assertIncludes(nav, "calc(100vh", "desktop menu height uses viewport calculation");
  assertIncludes(nav, "preferredWidth", "responsive dropdown width");
  assertIncludes(nav, "desktopMoreGridStyle", "desktop nav grid uses computed viewport columns");
  assertIncludes(nav, "gridTemplateColumns", "desktop nav grid template is explicit");
  assertIncludes(nav, "viewportSize.width >= 1536 ? 5", "wide desktop nav fifth column");
  assertIncludes(nav, "viewportSize.width >= 1840 ? 6", "very wide desktop nav sixth column");
  assertIncludes(nav, "(viewportWidth - menuWidth) / 2", "desktop nav menu is centered in the viewport");
  assertIncludes(nav, "DesktopSearchResults", "desktop search uses flat direct results");
  assertIncludes(nav, "MobileSearchResults", "mobile search uses flat direct results");
  assertIncludes(nav, "rankNavItems", "nav search uses scored results");
  assertIncludes(nav, "hasDirectionalSearchIntent", "nav search preserves directional intent");
  assertIncludes(nav, "data-nav-search-results=\"\"", "nav search results expose an audit marker");
  assertIncludes(nav, "grid auto-rows-max items-start", "desktop nav cards avoid stretched empty columns");
  assertIncludes(nav, "lg:col-span-2", "large desktop nav sections can use wider cards");
  assertIncludes(nav, "matchMedia(\"(max-width: 1023px)\")", "desktop mobile nav state sync");
  assertIncludes(nav, "!isMobileNavMode && moreOpen", "desktop menu hidden in mobile nav mode");
  assertIncludes(nav, "isMobileNavMode && mobileOpen", "mobile drawer hidden outside mobile nav mode");
  assert(!nav.includes("<details") && !nav.includes("<summary"), "mobile nav should not use category-only details blocks");
  assert(
    primaryHrefs.join(",") ===
      "/svg-to-png-converter,/png-to-svg-converter,/svg-to-jpg-converter,/jpg-to-svg-converter,/svg-to-pdf-converter",
    `unexpected primary nav href order: ${primaryHrefs.join(",")}`,
  );
  assert(!primaryBlock.includes('href: "/"'), "home href should not be in primary nav");
  assert(!primaryBlock.includes('label: "Image to SVG"'), "Image to SVG should not be in primary nav");
  assertIncludes(nav, "getPrimaryLinkVisibilityClassName", "primary nav responsive priority helper");
  assertIncludes(nav, "hidden xl:inline-flex", "secondary primary links hide before xl");
  assertIncludes(nav, "hidden min-[1536px]:inline-flex", "SVG to PDF hides until wide desktop");
  assertIncludes(nav, "whitespace-nowrap", "primary nav prevents label wrapping");

  const categoryOrder = Array.from(
    navData.matchAll(/id:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"/g),
    (match) => match[1],
  ).slice(0, 8);
  assert(
    categoryOrder.join(",") ===
      "most-popular,image-to-svg,craft-cut-files,svg-export,svg-editing,marketplace-design,developer-code,learn",
    `unexpected nav category order: ${categoryOrder.join(",")}`,
  );
}

function runExamplesAudit() {
  const examples = read("app/client/components/layout/ExampleSvgConversion.tsx");

  assertIncludes(examples, "data-example-randomizing=\"true\"", "example skeleton");
  assertIncludes(examples, "createExampleRandomSeed", "example random seed helper");
  assertIncludes(examples, "randomSeed", "example per-render seed state");
  assertIncludes(
    examples,
    "getExamplePair(activeSlug, activeCategory, randomSeed)",
    "example random pair selection",
  );
}

function runLinksAudit() {
  const nav = read("app/client/components/navigation/toolNavSections.ts");
  const routes = read("app/routes.ts");
  const registeredRoutes = new Set(["/"]);
  for (const match of routes.matchAll(/route\(\s*"([^"]+)"/g)) {
    registeredRoutes.add(`/${match[1].replace(/\/+$/, "")}`);
  }
  const hrefs = Array.from(nav.matchAll(/href:\s*"([^"]+)"/g)).map((match) => match[1]);
  const duplicates = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);

  const allowedRepeatedHrefs = new Set([
    "/",
    "/svg-to-png-converter",
    "/png-to-svg-converter",
    "/svg-to-jpg-converter",
    "/jpg-to-svg-converter",
    "/svg-to-pdf-converter",
    "#other-tools",
  ]);
  const unexpectedDuplicates = duplicates.filter((href) => !allowedRepeatedHrefs.has(href));
  assert(unexpectedDuplicates.length === 0, `duplicate nav hrefs: ${unexpectedDuplicates.join(", ")}`);

  for (const href of hrefs) {
    if (href === "/" || href.startsWith("#")) continue;

    assert(registeredRoutes.has(href), `nav href does not map to a route: ${href}`);
  }
}

const audits = {
  responsive: runResponsiveAudit,
  nav: runNavAudit,
  examples: runExamplesAudit,
  links: runLinksAudit,
};

if (mode === "all") {
  Object.values(audits).forEach((audit) => audit());
} else if (audits[mode]) {
  audits[mode]();
} else {
  throw new Error(`Unknown audit mode: ${mode}`);
}

console.log(`responsive-nav-example-audit:${mode}: ok`);
