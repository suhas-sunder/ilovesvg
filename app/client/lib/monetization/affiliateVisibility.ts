export type AffiliateViewGuardInput = {
  isClient: boolean;
  isReady: boolean;
  isAffiliateRendered: boolean;
  isMobileSuppressed: boolean;
  isTimedOut: boolean;
  alreadyCountedThisSession: boolean;
  elementWidth: number;
  elementHeight: number;
  visibleHeight: number;
  threshold?: number;
  cssDisplay?: string;
  cssVisibility?: string;
  cssOpacity?: string;
};

export function shouldCountAffiliateView({
  isClient,
  isReady,
  isAffiliateRendered,
  isMobileSuppressed,
  isTimedOut,
  alreadyCountedThisSession,
  elementWidth,
  elementHeight,
  visibleHeight,
  threshold = 0.7,
  cssDisplay = "block",
  cssVisibility = "visible",
  cssOpacity = "1",
}: AffiliateViewGuardInput) {
  if (!isClient || !isReady || !isAffiliateRendered) return false;
  if (isMobileSuppressed || isTimedOut || alreadyCountedThisSession) {
    return false;
  }
  if (cssDisplay === "none" || cssVisibility === "hidden") return false;
  if (Number(cssOpacity) === 0) return false;
  if (elementWidth <= 0 || elementHeight <= 0) return false;

  return visibleHeight / elementHeight >= threshold;
}

export function getVisibleAffiliateHeight(
  rect: Pick<DOMRect, "top" | "bottom" | "height">,
  viewportHeight: number,
) {
  if (rect.height <= 0 || viewportHeight <= 0) return 0;
  const visibleTop = Math.max(0, rect.top);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);
  return Math.max(0, visibleBottom - visibleTop);
}

export function isAffiliateElementVisibleEnough(
  element: HTMLElement,
  threshold = 0.7,
) {
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  const computedStyle = view?.getComputedStyle(element);
  const viewportHeight =
    view?.innerHeight ??
    element.ownerDocument.documentElement.clientHeight ??
    0;

  return shouldCountAffiliateView({
    isClient: typeof window !== "undefined",
    isReady: true,
    isAffiliateRendered: true,
    isMobileSuppressed: false,
    isTimedOut: false,
    alreadyCountedThisSession: false,
    elementWidth: rect.width,
    elementHeight: rect.height,
    visibleHeight: getVisibleAffiliateHeight(rect, viewportHeight),
    threshold,
    cssDisplay: computedStyle?.display,
    cssVisibility: computedStyle?.visibility,
    cssOpacity: computedStyle?.opacity,
  });
}
