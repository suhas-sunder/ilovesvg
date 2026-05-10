export type RouteFamily =
  | "raster-to-svg"
  | "cricut-craft"
  | "layered-svg"
  | "svg-export"
  | "svg-editor"
  | "text-base64-code"
  | "documentation"
  | "legal"
  | "static"
  | "redirect"
  | "api"
  | "sitemap-meta";

export type RouteKind =
  | "public-converter"
  | "public-utility"
  | "svg-export-editor"
  | "static-content"
  | "redirect-alias"
  | "api-action"
  | "sitemap-meta";

export type SitemapPolicy = "xml" | "html" | "xml-and-html" | "exclude";
export type NavPolicy = "none" | "primary" | "nav-or-related" | string;
export type TestCoverageKey =
  | "route-smoke"
  | "conversion-action-smoke"
  | "hybrid-browser-smoke"
  | "utility-layout-smoke"
  | "accessibility-smoke"
  | "output-ux-smoke"
  | "stage1-preset-smoke-candidate"
  | "route-expansion-audit"
  | "route-smoke-candidate";

export type RouteManifestEntry = {
  path: string;
  sourceFile: string;
  family: RouteFamily;
  kind: RouteKind;
  label: string;
  h1?: string;
  title?: string;
  description?: string;
  canonicalPath: string;
  publicRoute: boolean;
  indexable: boolean;
  sitemap: SitemapPolicy;
  nav: NavPolicy;
  related: boolean;
  guide: boolean;
  testCoverage: readonly TestCoverageKey[];
  redirectTo?: string;
};

export type RouteMetaEntry = Pick<
  RouteManifestEntry,
  "label" | "title" | "description" | "canonicalPath"
>;
