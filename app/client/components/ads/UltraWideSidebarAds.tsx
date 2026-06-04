import * as React from "react";
import { useLocation } from "react-router";
import { shouldRenderAdsForPath } from "~/client/lib/monetization/monetizationPolicy";
import { AdSenseDelayed } from "./AdsenseDelayed";

const CONSERVATIVE_LAYOUT_WIDTH_PX = 1440;
const MIN_ULTRA_WIDE_VIEWPORT_PX = 2400;
const SIDE_AD_WIDTH_PX = 300;
const SIDE_AD_HEIGHT_PX = 600;
const CONTENT_GAP_PX = 24;
const EDGE_PADDING_PX = 16;
const SIDE_AD_TOP_PX = 112;

const REQUIRED_SIDE_SPACE_PX =
  SIDE_AD_WIDTH_PX + CONTENT_GAP_PX + EDGE_PADDING_PX;

const LAYOUT_WIDTH_SELECTORS = [
  "header > div",
  "main > div",
  "footer > div",
  '[class*="max-w-[1180px]"]',
  '[class*="max-w-[1200px]"]',
  '[class*="max-w-6xl"]',
  '[class*="max-w-7xl"]',
  ".container",
].join(", ");

type SidebarState = {
  leftOffset: number;
  rightOffset: number;
};

function getLayoutViewportWidth() {
  return document.documentElement.clientWidth || window.innerWidth;
}

function getMeasuredLayoutBounds(viewportWidth: number) {
  let left = viewportWidth;
  let right = 0;
  let foundLayoutNode = false;

  document
    .querySelectorAll<HTMLElement>(LAYOUT_WIDTH_SELECTORS)
    .forEach((node) => {
      if (node.closest("[data-ultra-wide-sidebar-ads]")) return;

      const rect = node.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.width >= viewportWidth - EDGE_PADDING_PX * 2
      ) {
        return;
      }

      foundLayoutNode = true;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    });

  const fallbackLeft = Math.max(
    0,
    (viewportWidth - CONSERVATIVE_LAYOUT_WIDTH_PX) / 2,
  );
  const fallbackRight = Math.min(
    viewportWidth,
    fallbackLeft + CONSERVATIVE_LAYOUT_WIDTH_PX,
  );

  return {
    left: Math.min(foundLayoutNode ? left : viewportWidth, fallbackLeft),
    right: Math.max(foundLayoutNode ? right : 0, fallbackRight),
  };
}

function getSidebarState(): SidebarState | null {
  const viewportWidth = getLayoutViewportWidth();

  if (viewportWidth < MIN_ULTRA_WIDE_VIEWPORT_PX) return null;

  const layoutBounds = getMeasuredLayoutBounds(viewportWidth);
  const leftSideSpace = layoutBounds.left;
  const rightSideSpace = viewportWidth - layoutBounds.right;

  if (
    leftSideSpace < REQUIRED_SIDE_SPACE_PX ||
    rightSideSpace < REQUIRED_SIDE_SPACE_PX
  ) {
    return null;
  }

  return {
    leftOffset: Math.max(
      EDGE_PADDING_PX,
      Math.floor(leftSideSpace - SIDE_AD_WIDTH_PX - CONTENT_GAP_PX),
    ),
    rightOffset: Math.max(
      EDGE_PADDING_PX,
      Math.floor(rightSideSpace - SIDE_AD_WIDTH_PX - CONTENT_GAP_PX),
    ),
  };
}

function sameSidebarState(a: SidebarState | null, b: SidebarState | null) {
  return a?.leftOffset === b?.leftOffset && a?.rightOffset === b?.rightOffset;
}

export function UltraWideSidebarAds() {
  const { pathname } = useLocation();
  const shouldRenderAds = shouldRenderAdsForPath(pathname);
  const [sidebarState, setSidebarState] = React.useState<SidebarState | null>(
    null,
  );

  React.useEffect(() => {
    if (!shouldRenderAds) {
      setSidebarState(null);
      return;
    }

    let frame = 0;
    const stabilizeTimers: number[] = [];

    const updateSidebarState = () => {
      if (frame) window.cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const nextState = getSidebarState();
        setSidebarState((currentState) =>
          sameSidebarState(currentState, nextState) ? currentState : nextState,
        );
      });
    };

    updateSidebarState();
    [250, 1000, 2500].forEach((delayMs) => {
      stabilizeTimers.push(window.setTimeout(updateSidebarState, delayMs));
    });
    window.addEventListener("resize", updateSidebarState);
    window.addEventListener("orientationchange", updateSidebarState);
    window.addEventListener("load", updateSidebarState);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      stabilizeTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", updateSidebarState);
      window.removeEventListener("orientationchange", updateSidebarState);
      window.removeEventListener("load", updateSidebarState);
    };
  }, [pathname, shouldRenderAds]);

  if (!shouldRenderAds || !sidebarState) return null;

  return (
    <div data-ultra-wide-sidebar-ads="" className="print:hidden">
      <SidebarAdRail
        side="left"
        offset={sidebarState.leftOffset}
        slot="8650882332"
        placementName="ilovesvg-banner-ad-left"
      />
      <SidebarAdRail
        side="right"
        offset={sidebarState.rightOffset}
        slot="2113394143"
        placementName="ilovesvg-banner-ad-right"
      />
    </div>
  );
}

function SidebarAdRail({
  side,
  offset,
  slot,
  placementName,
}: {
  side: "left" | "right";
  offset: number;
  slot: string;
  placementName: string;
}) {
  return (
    <aside
      aria-label="Sponsored advertisement"
      className="pointer-events-auto fixed z-20 hidden min-[2400px]:block"
      style={{
        top: SIDE_AD_TOP_PX,
        [side]: offset,
        width: SIDE_AD_WIDTH_PX,
      }}
      data-monetization-kind="adsense"
      data-monetization-slot={placementName}
      data-monetization-reserve="ultra-wide-sidebar"
      data-ultra-wide-sidebar-ad={side}
    >
      <AdSenseDelayed
        slot={slot}
        delayMs={1800}
        minHeight={SIDE_AD_HEIGHT_PX}
        maxHeight={SIDE_AD_HEIGHT_PX}
        format="auto"
        fullWidth={true}
        className="mx-auto"
        showPlaceholder={false}
      />
    </aside>
  );
}
