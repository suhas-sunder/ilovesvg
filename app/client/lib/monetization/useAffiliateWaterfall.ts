import * as React from "react";
import {
  type AffiliateOffer,
  getRelevantAffiliateOffers,
} from "./affiliateOffers";
import type { AffiliateCategory } from "./affiliateRouteIntents";
import {
  shouldSuppressAdsenseFallbackForViewport,
  AFFILIATE_MOBILE_SUPPRESSION_BREAKPOINT_PX,
} from "./affiliateResponsive";
import { selectAffiliateWaterfallOffer } from "./affiliateWaterfallSelection";
import {
  type AffiliateStorageLike,
  createEmptyAffiliateWaterfallState,
  getAffiliateWaterfallEntry,
  getBrowserAffiliateStorage,
  incrementAffiliateView,
  isAffiliateWaterfallEntryTimedOut,
  markAffiliateClicked,
  readAffiliateWaterfallState,
} from "./affiliateWaterfallStorage";
import { isAffiliateElementVisibleEnough } from "./affiliateVisibility";

export type UseAffiliateWaterfallInput = {
  slotId: string;
  routeContext: string;
  routeCategories: readonly AffiliateCategory[];
  offers: readonly AffiliateOffer[];
  suppressAffiliateOnMobileWhenAdjacentAdExists?: boolean;
  mobileBreakpointPx?: number;
};

export function useAffiliateWaterfall({
  slotId,
  routeContext,
  routeCategories,
  offers,
  suppressAffiliateOnMobileWhenAdjacentAdExists = false,
  mobileBreakpointPx = AFFILIATE_MOBILE_SUPPRESSION_BREAKPOINT_PX,
}: UseAffiliateWaterfallInput) {
  const [isReady, setIsReady] = React.useState(false);
  const [isMobileLayout, setIsMobileLayout] = React.useState(false);
  const [state, setState] = React.useState(createEmptyAffiliateWaterfallState);
  const [bannerElement, setBannerElement] = React.useState<HTMLElement | null>(
    null,
  );

  const storageRef = React.useRef<AffiliateStorageLike | null>(null);
  const countedThisSessionRef = React.useRef(new Set<string>());
  const validOfferIds = React.useMemo(() => offers.map((offer) => offer.id), [
    offers,
  ]);

  const readCurrentState = React.useCallback(
    () =>
      readAffiliateWaterfallState(storageRef.current, {
        validOfferIds,
        validSlotIds: [slotId],
      }),
    [slotId, validOfferIds],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    storageRef.current = getBrowserAffiliateStorage();
    setState(readCurrentState());

    const updateMobileLayout = () => {
      setIsMobileLayout(window.innerWidth < mobileBreakpointPx);
    };

    updateMobileLayout();
    setIsReady(true);

    const media = window.matchMedia(`(max-width: ${mobileBreakpointPx - 1}px)`);
    const onChange = () => updateMobileLayout();
    media.addEventListener?.("change", onChange);
    window.addEventListener("resize", onChange);

    return () => {
      media.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [mobileBreakpointPx, readCurrentState, routeContext, slotId]);

  const relevantOffers = React.useMemo(
    () =>
      getRelevantAffiliateOffers({
        offers,
        routeCategories,
        maxOffers: 2,
      }),
    [offers, routeCategories],
  );

  const shouldSuppressAdsenseFallback =
    isReady &&
    shouldSuppressAdsenseFallbackForViewport({
      viewportWidth: isMobileLayout ? mobileBreakpointPx - 1 : mobileBreakpointPx,
      suppressAffiliateOnMobileWhenAdjacentAdExists,
      breakpointPx: mobileBreakpointPx,
    });

  const selection = React.useMemo(() => {
    if (!isReady) {
      return {
        selectedOffer: null,
        shouldShowAdsense: false,
      };
    }

    return selectAffiliateWaterfallOffer({
      offers: relevantOffers,
      state,
      slotId,
      routeContext,
    });
  }, [
    isReady,
    relevantOffers,
    routeContext,
    slotId,
    state,
  ]);

  const selectedEntry = selection.selectedOffer
    ? getAffiliateWaterfallEntry(state, {
        offerId: selection.selectedOffer.id,
        slotId,
        routeContext,
      })
    : null;

  const selectedOfferTimedOut = isAffiliateWaterfallEntryTimedOut(selectedEntry);

  const registerBannerElement = React.useCallback((element: HTMLElement | null) => {
    setBannerElement(element);
  }, []);

  const refreshState = React.useCallback(() => {
    setState(readCurrentState());
  }, [readCurrentState]);

  const trackAffiliateClick = React.useCallback(
    (offerId?: string) => {
      if (!isReady) return;

      const selectedOfferId = offerId ?? selection.selectedOffer?.id;
      if (!selectedOfferId) return;

      markAffiliateClicked(storageRef.current, {
        offerId: selectedOfferId,
        slotId,
        routeContext,
      });
      refreshState();
    },
    [
      isReady,
      refreshState,
      routeContext,
      selection.selectedOffer?.id,
      slotId,
    ],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isReady) return;
    const selectedOffer = selection.selectedOffer;
    if (!selectedOffer || !bannerElement) return;
    if (selectedOfferTimedOut) return;
    if (!storageRef.current) return;
    if (!("IntersectionObserver" in window)) return;

    const sessionKey = `${slotId}::${routeContext}::${selectedOffer.id}`;
    if (countedThisSessionRef.current.has(sessionKey)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((item) => item.target === bannerElement);
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.7) return;
        if (countedThisSessionRef.current.has(sessionKey)) return;
        if (!isAffiliateElementVisibleEnough(bannerElement, 0.7)) return;

        countedThisSessionRef.current.add(sessionKey);
        incrementAffiliateView(storageRef.current, {
          offerId: selectedOffer.id,
          slotId,
          routeContext,
        });
        refreshState();
        observer.disconnect();
      },
      { threshold: [0, 0.7, 1] },
    );

    observer.observe(bannerElement);

    return () => {
      observer.disconnect();
    };
  }, [
    bannerElement,
    isReady,
    refreshState,
    routeContext,
    selectedOfferTimedOut,
    selection.selectedOffer,
    slotId,
  ]);

  return {
    selectedOffer: selection.selectedOffer,
    relevantOffers,
    shouldShowAdsense: selection.shouldShowAdsense,
    shouldSuppressAdsenseFallback,
    registerBannerElement,
    trackAffiliateClick,
    isReady,
  };
}
