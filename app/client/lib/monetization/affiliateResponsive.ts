export const AFFILIATE_MOBILE_SUPPRESSION_BREAKPOINT_PX = 1024;

export function shouldSuppressAffiliateForViewport({
  viewportWidth,
  suppressAffiliateOnMobileWhenAdjacentAdExists,
  breakpointPx = AFFILIATE_MOBILE_SUPPRESSION_BREAKPOINT_PX,
}: {
  viewportWidth: number;
  suppressAffiliateOnMobileWhenAdjacentAdExists: boolean;
  breakpointPx?: number;
}) {
  if (!suppressAffiliateOnMobileWhenAdjacentAdExists) return false;
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return false;
  return viewportWidth < breakpointPx;
}
