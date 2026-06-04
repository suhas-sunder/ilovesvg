export type RouteMonetizationPolicy = {
  mode:
    | "excluded"
    | "focused-no-monetization"
    | "compact-ad"
    | "affiliate-with-fallback";
  ads: boolean;
  affiliate: boolean;
  placement:
    | "none"
    | "docs-compact-ad"
    | "contextual-compact-ad"
    | "contextual-affiliate-with-compact-fallback";
  exclusionReason?:
    | "legal-trust"
    | "api"
    | "redirect"
    | "sitemap-meta"
    | "owned-funnel";
};

export const LEGAL_TRUST_MONETIZATION_EXCLUDED_ROUTES = [
  "/privacy-policy",
  "/terms-of-service",
  "/cookies",
] as const;

export const API_MONETIZATION_EXCLUDED_ROUTES = ["/api/batch-svg"] as const;

export const REDIRECT_MONETIZATION_EXCLUDED_ROUTES = [
  "/tif-to-svg-converter",
  "/image-to-svg-converter",
  "/black-and-white-png-to-svg-converter",
  "/svg-to-react-component",
  "/svg-to-css-background",
  "/svg-to-data-uri-converter",
  "/svg-inline-code-generator",
  "/svg-viewbox-editor",
  "/svg-code-cleaner",
  "/svg-transparent-background-tool",
] as const;

export const META_MONETIZATION_EXCLUDED_ROUTES = ["/sitemap"] as const;

export const FOCUSED_NO_MONETIZATION_ROUTES = ["/pro-waitlist"] as const;

export const DOCS_HELP_COMPACT_AD_ROUTES = [
  "/how-it-works",
  "/how-it-works/conversion-workflow",
  "/how-it-works/exporting-and-downloads",
  "/how-it-works/presets",
  "/how-it-works/settings",
  "/how-it-works/troubleshooting",
] as const;

export const TECHNICAL_COMPACT_AD_ROUTES = [
  "/svg-to-base64",
  "/base64-to-svg",
  "/svg-to-jsx-converter",
  "/text-to-svg-converter",
  "/emoji-to-svg-converter",
  "/svg-resize-and-scale-editor",
  "/svg-minifier",
  "/svg-cleaner",
  "/svg-preview-viewer",
  "/svg-background-editor",
  "/svg-recolor",
  "/svg-stroke-width-editor",
  "/svg-flip-and-rotate-editor",
  "/svg-dimensions-inspector",
  "/svg-file-size-inspector",
  "/svg-embed-code-generator",
  "/inline-svg-vs-img",
  "/svg-accessibility-and-contrast-checker",
  "/free-color-picker",
] as const;

export const MONETIZATION_EXCLUDED_ROUTES = [
  ...LEGAL_TRUST_MONETIZATION_EXCLUDED_ROUTES,
  ...API_MONETIZATION_EXCLUDED_ROUTES,
  ...REDIRECT_MONETIZATION_EXCLUDED_ROUTES,
  ...META_MONETIZATION_EXCLUDED_ROUTES,
] as const;

const monetizationExcludedRouteSet = new Set<string>(MONETIZATION_EXCLUDED_ROUTES);
const legalTrustExcludedRouteSet = new Set<string>(
  LEGAL_TRUST_MONETIZATION_EXCLUDED_ROUTES,
);
const apiExcludedRouteSet = new Set<string>(API_MONETIZATION_EXCLUDED_ROUTES);
const redirectExcludedRouteSet = new Set<string>(
  REDIRECT_MONETIZATION_EXCLUDED_ROUTES,
);
const metaExcludedRouteSet = new Set<string>(META_MONETIZATION_EXCLUDED_ROUTES);
const focusedNoMonetizationRouteSet = new Set<string>(
  FOCUSED_NO_MONETIZATION_ROUTES,
);
const docsHelpCompactAdRouteSet = new Set<string>(DOCS_HELP_COMPACT_AD_ROUTES);
const technicalCompactAdRouteSet = new Set<string>(TECHNICAL_COMPACT_AD_ROUTES);

export function normalizeMonetizationPathname(pathname: string) {
  const cleanPath = (pathname || "/").split(/[?#]/, 1)[0] || "/";
  if (cleanPath === "/") return "/";
  return cleanPath.replace(/\/+$/, "") || "/";
}

export function isMonetizationExcludedRoute(pathname: string) {
  return monetizationExcludedRouteSet.has(normalizeMonetizationPathname(pathname));
}

export function getRouteMonetizationPolicy(
  pathname: string,
): RouteMonetizationPolicy {
  const normalizedPathname = normalizeMonetizationPathname(pathname);

  if (legalTrustExcludedRouteSet.has(normalizedPathname)) {
    return {
      mode: "excluded",
      ads: false,
      affiliate: false,
      placement: "none",
      exclusionReason: "legal-trust",
    };
  }

  if (apiExcludedRouteSet.has(normalizedPathname)) {
    return {
      mode: "excluded",
      ads: false,
      affiliate: false,
      placement: "none",
      exclusionReason: "api",
    };
  }

  if (redirectExcludedRouteSet.has(normalizedPathname)) {
    return {
      mode: "excluded",
      ads: false,
      affiliate: false,
      placement: "none",
      exclusionReason: "redirect",
    };
  }

  if (metaExcludedRouteSet.has(normalizedPathname)) {
    return {
      mode: "excluded",
      ads: false,
      affiliate: false,
      placement: "none",
      exclusionReason: "sitemap-meta",
    };
  }

  if (focusedNoMonetizationRouteSet.has(normalizedPathname)) {
    return {
      mode: "focused-no-monetization",
      ads: false,
      affiliate: false,
      placement: "none",
      exclusionReason: "owned-funnel",
    };
  }

  if (docsHelpCompactAdRouteSet.has(normalizedPathname)) {
    return {
      mode: "compact-ad",
      ads: true,
      affiliate: false,
      placement: "docs-compact-ad",
    };
  }

  if (technicalCompactAdRouteSet.has(normalizedPathname)) {
    return {
      mode: "compact-ad",
      ads: true,
      affiliate: false,
      placement: "contextual-compact-ad",
    };
  }

  return {
    mode: "compact-ad",
    ads: true,
    affiliate: false,
    placement: "contextual-compact-ad",
  };
}

export function shouldRenderAdsForPath(pathname: string) {
  return getRouteMonetizationPolicy(pathname).ads;
}

export function shouldRenderAffiliateForPath(pathname: string) {
  return getRouteMonetizationPolicy(pathname).affiliate;
}
