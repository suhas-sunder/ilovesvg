import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SITE_URL = "https://www.ilovesvg.com";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const REPORT_PATH =
  process.env.ROUTE_COVERAGE_REPORT_PATH ||
  path.join(ROOT, "tmp", "route-coverage-audit.json");

const readText = async (relativePath) => {
  try {
    return await fs.readFile(path.join(ROOT, relativePath), "utf8");
  } catch {
    return "";
  }
};

const exists = async (relativePath) => {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
};

const normalizeRoutePath = (value) => {
  if (!value || value === "/") {
    return "/";
  }
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized.replace(/\/+$/, "") || "/";
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const routePathToFile = (routeFile) => path.join("app", "routes", routeFile);

const parseRouteConfig = (routesSource) => {
  const routes = [];
  const seen = new Set();

  const addRoute = (routePath, routeFile) => {
    const normalizedPath = normalizeRoutePath(routePath);
    const sourceFile = routePathToFile(routeFile);
    const key = `${normalizedPath}|${sourceFile}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    routes.push({
      path: normalizedPath,
      sourceFile,
      sourceKind: "app route",
    });
  };

  for (const match of routesSource.matchAll(/index\(\s*"routes\/([^"]+)"/g)) {
    addRoute("/", match[1]);
  }

  for (const match of routesSource.matchAll(
    /route\(\s*"([^"]+)"\s*,\s*"routes\/([^"]+)"/g,
  )) {
    addRoute(match[1], match[2]);
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path));
};

const parseSitemapPaths = (sitemapXml) => {
  const paths = new Set();
  for (const match of sitemapXml.matchAll(/<loc>https:\/\/www\.ilovesvg\.com([^<]*)<\/loc>/g)) {
    paths.add(normalizeRoutePath(match[1] || "/"));
  }
  return paths;
};

const parseLocalPaths = (source) => {
  const paths = new Set();
  for (const match of source.matchAll(/["'`](\/[a-z0-9][^"'`\s?#]*)["'`]/gi)) {
    const routePath = normalizeRoutePath(match[1]);
    if (!routePath.includes("{") && !routePath.includes("$")) {
      paths.add(routePath);
    }
  }
  return paths;
};

const extractArrayBlock = (source, name) => {
  const regex = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  return source.match(regex)?.[1] || "";
};

const sourceIncludesPath = (source, routePath) =>
  new RegExp(`["'\`]${escapeRegExp(routePath)}["'\`]`).test(source);

const parseMeta = (html) => {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  const description =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() ||
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1]?.trim() ||
    "";
  const canonical =
    html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1]?.trim() ||
    html.match(/<link\s+href=["']([^"']*)["']\s+rel=["']canonical["']/i)?.[1]?.trim() ||
    "";
  const robots =
    html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() ||
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']robots["']/i)?.[1]?.trim() ||
    "";
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  return {
    title,
    description,
    canonical,
    robots,
    h1Count,
  };
};

const fetchRoute = async (routePath, isRedirect) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${BASE_URL}${routePath}`, {
      redirect: isRedirect ? "manual" : "follow",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const location = response.headers.get("location") || "";
    const body = contentType.includes("text") || contentType.includes("html") || contentType.includes("xml")
      ? await response.text()
      : "";
    return {
      ok: response.ok,
      status: response.status,
      redirected: response.redirected,
      location,
      contentType,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      body: "",
    };
  } finally {
    clearTimeout(timeout);
  }
};

const classifyRouteType = (routePath, sourceFile, source, redirectDestination) => {
  if (routePath.startsWith("/api/")) {
    return "API/action endpoint";
  }
  if (redirectDestination) {
    return "redirect/alias";
  }
  if (routePath === "/sitemap") {
    return "sitemap/robots/meta";
  }
  if (
    routePath.includes("privacy") ||
    routePath.includes("terms") ||
    routePath.includes("cookies") ||
    routePath.includes("how-it-works") ||
    routePath.includes("pro-waitlist")
  ) {
    return "static/content page";
  }
  if (
    routePath.includes("base64") ||
    routePath.includes("color") ||
    routePath.includes("text-to-svg") ||
    routePath.includes("code-to-svg") ||
    routePath.includes("emoji-to-svg")
  ) {
    return "public utility";
  }
  if (
    routePath === "/" ||
    (routePath.includes("-to-svg") && !routePath.startsWith("/svg-to-")) ||
    routePath.includes("-to-layered-svg") ||
    routePath.includes("cricut") ||
    routePath.includes("cut-file") ||
    routePath.includes("laser-cutting") ||
    routePath.includes("silhouette") ||
    routePath.includes("vinyl") ||
    routePath.includes("sticker")
  ) {
    return "public converter";
  }
  if (
    routePath.startsWith("/svg-to-") ||
    routePath.startsWith("/svg-") ||
    routePath.includes("favicon") ||
    routePath.includes("ico-") ||
    routePath.includes("transparent-background") ||
    routePath.includes("viewbox")
  ) {
    return "SVG export/editor tool";
  }
  if (
    source.includes("TraceOutputPanel") ||
    source.includes("BespokeTraceOutputPanel") ||
    source.includes("convert") ||
    source.includes("preset") ||
    source.includes("upload") ||
    source.includes("action")
  ) {
    return "public converter";
  }
  return "static/content page";
};

const expectedCanonical = (routePath) => `${SITE_URL}${routePath === "/" ? "" : routePath}`;

const main = async () => {
  const routesSource = await readText("app/routes.ts");
  const sitemapXml = await readText("public/sitemap.xml");
  const sitemapRouteSource = await readText("app/routes/sitemap.tsx");
  const robotsText = await readText("public/robots.txt");
  const navSource = [
    await readText("app/client/components/navigation/NavBar.tsx"),
    await readText("app/client/components/navigation/OtherToolsLinks.tsx"),
  ].join("\n");
  const conversionActionSmoke = await readText("scripts/conversion-action-smoke.mjs");
  const hybridBrowserSmoke = await readText("scripts/hybrid-browser-smoke.mjs");
  const accessibilitySmoke = await readText("scripts/accessibility-smoke.mjs");
  const outputUxSmoke = await readText("scripts/output-card-ux-audit.mjs");
  const routeExpansionAudit = await readText("scripts/route-expansion-audit.mjs");
  const stage1Smoke = await readText("scripts/stage1-route-preset-smoke.mjs");

  const routeSmokeKnownRedirects = new Set([
    "/black-and-white-png-to-svg-converter",
    "/image-to-svg-converter",
    "/svg-code-cleaner",
    "/svg-inline-code-generator",
    "/svg-to-css-background",
    "/svg-to-data-uri-converter",
    "/svg-to-react-component",
    "/svg-transparent-background-tool",
    "/svg-viewbox-editor",
    "/tif-to-svg-converter",
  ]);

  const utilityLayoutBlock = extractArrayBlock(hybridBrowserSmoke, "UTILITY_LAYOUT_ROUTES");
  const outputUxBlock = outputUxSmoke;
  const sitemapPaths = parseSitemapPaths(sitemapXml);
  const htmlSitemapPaths = parseLocalPaths(sitemapRouteSource);
  const navPaths = parseLocalPaths(navSource);
  const appRoutes = parseRouteConfig(routesSource);

  const appRouteFilePaths = new Set(appRoutes.map((route) => route.sourceFile.replaceAll("\\", "/")));
  const routeFiles = (await fs.readdir(path.join(ROOT, "app", "routes")))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => `app/routes/${file}`)
    .sort();
  const unregisteredRouteFiles = routeFiles.filter((file) => !appRouteFilePaths.has(file));

  const staticEndpoints = [];
  for (const endpoint of [
    { path: "/sitemap.xml", sourceFile: "public/sitemap.xml", type: "sitemap/robots/meta" },
    { path: "/robots.txt", sourceFile: "public/robots.txt", type: "sitemap/robots/meta" },
    { path: "/ads.txt", sourceFile: "public/ads.txt", type: "sitemap/robots/meta" },
    { path: "/favicon.ico", sourceFile: "public/favicon.ico", type: "sitemap/robots/meta" },
  ]) {
    if (await exists(endpoint.sourceFile)) {
      staticEndpoints.push({
        ...endpoint,
        sourceKind: "public static",
        public: true,
        shouldIndex: false,
        shouldAppearInSitemap: false,
        shouldAppearInNavOrRelated: false,
        hasCanonical: "n/a",
        hasMetadata: "n/a",
        hasH1: "n/a",
        layoutStatus: "n/a",
        sharedOrRouteLocal: "static file",
        hasUploadOrConversion: false,
        hasPresetBehavior: false,
        hasOutputActions: false,
        testCoverage: endpoint.path === "/sitemap.xml" ? ["route smoke candidate"] : [],
        riskNotes: [],
      });
    }
  }

  const rootProbe = await fetchRoute("/", false);
  const wrongApp = !rootProbe.body.includes("iLoveSVG") && !rootProbe.body.includes("Convert images to SVG");

  const matrix = [];

  for (const route of appRoutes) {
    const source = await readText(route.sourceFile);
    const redirectMatch = source.match(/redirect\(\s*"([^"]+)"\s*,\s*(\d+)/);
    const redirectDestination = redirectMatch?.[1] || "";
    const isApi = route.path.startsWith("/api/");
    const isRedirect = Boolean(redirectDestination) || routeSmokeKnownRedirects.has(route.path);
    const hasAction =
      /export\s+async\s+function\s+action/.test(source) ||
      /export\s+\{\s*action\s*\}/.test(source) ||
      /action as/.test(source);
    const hasFileUploadSurface =
      /type=["']file["']|FileUpload|dropzone|arrayBuffer|new FormData|accept=|useFetcher/i.test(source);
    const hasUploadOrConversion =
      hasAction ||
      hasFileUploadSurface ||
      source.includes("TraceOutputPanel") ||
      source.includes("BespokeTraceOutputPanel");
    const hasPresetBehavior = /Preset|preset|PRESETS/.test(source);
    const hasOutputActions =
      source.includes("TraceOutputPanel") ||
      source.includes("BespokeTraceOutputPanel") ||
      /copyButton|downloadButton|fullscreen|Update preview/i.test(source);
    const routeType = classifyRouteType(route.path, route.sourceFile, source, redirectDestination);
    const publicRoute = !isApi;

    let fetchResult = null;
    let meta = null;
    if (!isApi) {
      fetchResult = await fetchRoute(route.path, isRedirect);
      if (!isRedirect && fetchResult.body) {
        meta = parseMeta(fetchResult.body);
      }
    }

    const robotsNoindex =
      meta?.robots?.toLowerCase().includes("noindex") ||
      /robots["']\s*,\s*content:\s*["'][^"']*noindex/i.test(source);
    const shouldIndex = publicRoute && !isRedirect && !robotsNoindex;
    const shouldAppearInSitemap = shouldIndex;
    const inXmlSitemap = sitemapPaths.has(route.path);
    const inHtmlSitemap = htmlSitemapPaths.has(route.path);
    const inNavigationOrRelated = navPaths.has(route.path);
    const expected = expectedCanonical(route.path);
    const canonicalMatches = isRedirect || isApi || route.path === "/sitemap" || meta?.canonical === expected;
    const titlePresent = Boolean(meta?.title);
    const descriptionPresent = Boolean(meta?.description);
    const h1Present = Boolean(meta && meta.h1Count > 0);

    const sharedOrRouteLocal = isRedirect
      ? "redirect"
      : source.includes("TraceOutputPanel")
        ? "shared TraceOutputPanel"
        : source.includes("BespokeTraceOutputPanel")
          ? "route-local with bespoke output panel"
          : source.includes("Shared")
            ? "shared route utilities"
            : isApi
              ? "API action"
              : "route-local";

    const testCoverage = [];
    if (!isApi) {
      testCoverage.push("route smoke");
    }
    if (sourceIncludesPath(conversionActionSmoke, route.path)) {
      testCoverage.push("conversion action smoke");
    }
    if (sourceIncludesPath(hybridBrowserSmoke, route.path)) {
      testCoverage.push("hybrid browser smoke");
    }
    if (sourceIncludesPath(utilityLayoutBlock, route.path)) {
      testCoverage.push("utility layout smoke");
    }
    if (sourceIncludesPath(accessibilitySmoke, route.path)) {
      testCoverage.push("accessibility smoke");
    }
    if (sourceIncludesPath(outputUxBlock, route.path)) {
      testCoverage.push("output UX smoke");
    }
    if (sourceIncludesPath(routeExpansionAudit, route.path)) {
      testCoverage.push("route expansion audit");
    }
    if (
      hasAction &&
      hasPresetBehavior &&
      !isApi &&
      !isRedirect &&
      stage1Smoke.includes("STAGE1_FULL_PRESET_SMOKE")
    ) {
      testCoverage.push("Stage 1 preset smoke candidate");
    }

    const layoutStatus = isApi || isRedirect || routeType === "static/content page" || routeType === "sitemap/robots/meta"
      ? "n/a"
      : sourceIncludesPath(utilityLayoutBlock, route.path)
        ? "utility-first browser smoke covered"
        : route.path === "/" || source.includes("tool-card") || source.includes("TraceOutputPanel")
          ? "tool layout present, not utility-layout-smoked"
          : "needs manual route-layout review";

    const riskNotes = [];
    if (wrongApp) {
      riskNotes.push(`BASE_URL ${BASE_URL} did not look like iLoveSVG`);
    }
    if (fetchResult && !isRedirect && !isApi && fetchResult.status >= 400) {
      riskNotes.push(`HTTP ${fetchResult.status}`);
    }
    if (isRedirect && fetchResult && fetchResult.status < 300) {
      riskNotes.push(`redirect expected but returned ${fetchResult.status}`);
    }
    if (shouldAppearInSitemap && !inXmlSitemap) {
      riskNotes.push("indexable public route missing from XML sitemap");
    }
    if (!shouldAppearInSitemap && inXmlSitemap) {
      riskNotes.push("non-indexable route appears in XML sitemap");
    }
    if (publicRoute && !isRedirect && route.path !== "/sitemap" && !titlePresent) {
      riskNotes.push("missing title metadata");
    }
    if (publicRoute && !isRedirect && route.path !== "/sitemap" && !descriptionPresent) {
      riskNotes.push("missing description metadata");
    }
    if (publicRoute && !isRedirect && route.path !== "/sitemap" && !meta?.canonical) {
      riskNotes.push("missing canonical URL");
    } else if (!canonicalMatches) {
      riskNotes.push(`canonical mismatch: ${meta?.canonical || "none"}`);
    }
    if (publicRoute && !isRedirect && route.path !== "/sitemap" && !h1Present) {
      riskNotes.push("missing H1");
    }
    if (
      routeType === "public converter" &&
      !isRedirect &&
      !sourceIncludesPath(utilityLayoutBlock, route.path)
    ) {
      riskNotes.push("converter route not directly covered by utility layout smoke");
    }
    if (
      hasUploadOrConversion &&
      routeType !== "static/content page" &&
      routeType !== "sitemap/robots/meta" &&
      !isRedirect &&
      !isApi &&
      !sourceIncludesPath(conversionActionSmoke, route.path) &&
      !sourceIncludesPath(hybridBrowserSmoke, route.path) &&
      !testCoverage.includes("Stage 1 preset smoke candidate")
    ) {
      riskNotes.push("upload/conversion path lacks direct action or browser conversion smoke classification");
    }
    if (
      hasOutputActions &&
      routeType !== "static/content page" &&
      routeType !== "sitemap/robots/meta" &&
      !sourceIncludesPath(outputUxBlock, route.path) &&
      !sourceIncludesPath(hybridBrowserSmoke, route.path)
    ) {
      riskNotes.push("output actions not directly covered by output UX or hybrid browser smoke");
    }

    matrix.push({
      path: route.path,
      sourceFile: route.sourceFile,
      routeType,
      public: publicRoute,
      shouldIndex,
      inXmlSitemap,
      inHtmlSitemap,
      inNavigationOrRelated,
      hasCanonical: meta?.canonical ? canonicalMatches : false,
      canonical: meta?.canonical || "",
      hasMetadata: titlePresent && descriptionPresent,
      titlePresent,
      descriptionPresent,
      hasH1: h1Present,
      h1Count: meta?.h1Count || 0,
      layoutStatus,
      sharedOrRouteLocal,
      hasUploadOrConversion,
      hasPresetBehavior,
      hasOutputActions,
      testCoverage,
      httpStatus: fetchResult?.status || "not-fetched",
      redirectDestination,
      riskNotes,
    });
  }

  matrix.push(...staticEndpoints);

  const routePathSet = new Set(appRoutes.map((route) => route.path));
  const staticPathSet = new Set(staticEndpoints.map((endpoint) => endpoint.path));
  const missingNavTargets = [...navPaths]
    .filter((routePath) => !routePathSet.has(routePath) && !staticPathSet.has(routePath))
    .sort();
  const sitemapOnlyPaths = [...sitemapPaths]
    .filter((routePath) => !routePathSet.has(routePath))
    .sort();
  const htmlSitemapOnlyPaths = [...htmlSitemapPaths]
    .filter((routePath) => !routePathSet.has(routePath) && !staticPathSet.has(routePath))
    .sort();

  const routeConfigOnly = matrix.filter((route) => route.sourceKind !== "public static");
  const counts = {
    appRoutes: routeConfigOnly.length,
    publicStaticEndpoints: staticEndpoints.length,
    totalInventoryRows: matrix.length,
    publicRoutes: routeConfigOnly.filter((route) => route.public).length,
    apiActionRoutes: routeConfigOnly.filter((route) => route.routeType === "API/action endpoint").length,
    redirectAliasRoutes: routeConfigOnly.filter((route) => route.routeType === "redirect/alias").length,
    staticContentRoutes: routeConfigOnly.filter((route) => route.routeType === "static/content page").length,
    converterRoutes: routeConfigOnly.filter((route) => route.routeType === "public converter").length,
    svgExportEditorRoutes: routeConfigOnly.filter((route) => route.routeType === "SVG export/editor tool").length,
    publicUtilityRoutes: routeConfigOnly.filter((route) => route.routeType === "public utility").length,
    sitemapRoutes: routeConfigOnly.filter((route) => route.routeType === "sitemap/robots/meta").length,
    xmlSitemapPaths: sitemapPaths.size,
    htmlSitemapPaths: htmlSitemapPaths.size,
    navOrRelatedPaths: navPaths.size,
  };

  const gaps = matrix
    .filter((route) => route.riskNotes?.length)
    .map((route) => ({
      path: route.path,
      sourceFile: route.sourceFile,
      riskNotes: route.riskNotes,
    }));
  const missingXmlSitemapRoutes = matrix
    .filter(
      (route) =>
        route.sourceKind !== "public static" &&
        route.public &&
        route.shouldIndex &&
        !route.inXmlSitemap,
    )
    .map((route) => route.path)
    .sort();
  const missingMetadataRoutes = matrix.filter(
    (route) =>
      route.public &&
      route.hasMetadata === false &&
      route.routeType !== "redirect/alias" &&
      route.routeType !== "API/action endpoint",
  );
  const missingCanonicalRoutes = matrix.filter(
    (route) =>
      route.public &&
      route.hasCanonical === false &&
      route.routeType !== "redirect/alias" &&
      route.routeType !== "API/action endpoint",
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    wrongApp,
    counts,
    unregisteredRouteFiles,
    sitemapOnlyPaths,
    htmlSitemapOnlyPaths,
    missingNavTargets,
    missingXmlSitemapRoutes,
    gaps,
    matrix,
    robots: {
      hasSitemapDirective: robotsText.includes(`${SITE_URL}/sitemap.xml`),
    },
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const print = (label, value) => {
    console.log(`${label}: ${value}`);
  };

  print("Base URL", BASE_URL);
  print("Wrong app detected", wrongApp ? "yes" : "no");
  print("Total app routes", counts.appRoutes);
  print("Public routes", counts.publicRoutes);
  print("API/action routes", counts.apiActionRoutes);
  print("Redirect/alias routes", counts.redirectAliasRoutes);
  print("Static/content routes", counts.staticContentRoutes);
  print("Converter routes", counts.converterRoutes);
  print("SVG export/editor routes", counts.svgExportEditorRoutes);
  print("Public utility routes", counts.publicUtilityRoutes);
  print("XML sitemap paths", counts.xmlSitemapPaths);
  print("Routes missing XML sitemap", missingXmlSitemapRoutes.length);
  print("Routes missing metadata", missingMetadataRoutes.length);
  print("Routes missing canonical", missingCanonicalRoutes.length);
  print("Broken nav or related targets", missingNavTargets.length);
  print("Routes missing test classification", matrix.filter((route) => route.public && route.sourceKind !== "public static" && route.testCoverage.length === 0).length);
  print("Gap rows", gaps.length);
  print("Report", path.relative(ROOT, REPORT_PATH));

  if (missingXmlSitemapRoutes.length) {
    console.error(
      `Canonical indexable routes missing from XML sitemap: ${missingXmlSitemapRoutes.join(", ")}`,
    );
    process.exitCode = 1;
  }
  if (missingNavTargets.length) {
    console.log(`Missing nav or related targets: ${missingNavTargets.join(", ")}`);
  }
  if (sitemapOnlyPaths.length) {
    console.log(`XML sitemap paths without app route: ${sitemapOnlyPaths.join(", ")}`);
  }
  if (unregisteredRouteFiles.length) {
    console.log(`Unregistered route files: ${unregisteredRouteFiles.join(", ")}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
