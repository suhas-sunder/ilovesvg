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

  assertIncludes(nav, "const NAV_CATEGORIES", "nav categories");
  assertIncludes(nav, "DesktopNavGroup", "desktop grouped nav");
  assertIncludes(nav, "MobileNavGroup", "mobile grouped nav");
  assertIncludes(nav, "groupNavItems", "nav grouping helper");
  assertIncludes(nav, "max-h-[min(72vh,680px)]", "larger desktop menu");
  assertIncludes(nav, "preferredWidth", "responsive dropdown width");
  assertIncludes(nav, "2xl:grid-cols-4", "comfortable wide desktop nav column");
  assertIncludes(nav, "grid items-start", "desktop nav cards avoid stretched empty columns");
  assertIncludes(nav, "matchMedia(\"(max-width: 1023px)\")", "desktop mobile nav state sync");
  assertIncludes(nav, "!isMobileNavMode && moreOpen", "desktop menu hidden in mobile nav mode");
  assertIncludes(nav, "isMobileNavMode && mobileOpen", "mobile drawer hidden outside mobile nav mode");

  const categoryOrder = Array.from(
    nav.matchAll(/id:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"/g),
    (match) => match[1],
  ).slice(0, 9);
  assert(
    categoryOrder.join(",") ===
      "line-art,cricut,logo-icon,file-types,layered,svg-export,svg-tools,general,more",
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
  const nav = read("app/client/components/navigation/NavBar.tsx");
  const routeDir = path.join(root, "app/routes");
  const hrefs = Array.from(nav.matchAll(/href:\s*"([^"]+)"/g)).map((match) => match[1]);
  const duplicates = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);

  assert(duplicates.length === 0, `duplicate nav hrefs: ${duplicates.join(", ")}`);

  for (const href of hrefs) {
    if (href === "/" || href.startsWith("#")) continue;

    const slug = href.replace(/^\/+/, "");
    const file = path.join(routeDir, `${slug}.tsx`);
    assert(fs.existsSync(file), `nav href does not map to a route file: ${href}`);
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
