export type RouteMonetizationPolicy = {
  ads: boolean;
  affiliate: boolean;
  exclusionReason?: "legal-trust";
};

export const MONETIZATION_EXCLUDED_ROUTES = [
  "/privacy-policy",
  "/terms-of-service",
  "/cookies",
] as const;

const monetizationExcludedRouteSet = new Set<string>(MONETIZATION_EXCLUDED_ROUTES);

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
  if (isMonetizationExcludedRoute(pathname)) {
    return {
      ads: false,
      affiliate: false,
      exclusionReason: "legal-trust",
    };
  }

  return {
    ads: true,
    affiliate: true,
  };
}

export function shouldRenderAdsForPath(pathname: string) {
  return getRouteMonetizationPolicy(pathname).ads;
}

export function shouldRenderAffiliateForPath(pathname: string) {
  return getRouteMonetizationPolicy(pathname).affiliate;
}
