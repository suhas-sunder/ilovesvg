import * as React from "react";
import {
  type AffiliateOffer,
  filterActiveAffiliateOffers,
  getRelevantAffiliateOffers,
} from "./affiliateOffers";
import { ACTIVE_AFFILIATE_PROVIDER_IDS } from "./affiliateProviders";
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
  const viewDwellTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const activeOffers = React.useMemo(() => filterActiveAffiliateOffers(offers), [
    offers,
  ]);
  const validOfferIds = React.useMemo(
    () => activeOffers.map((offer) => offer.id),
    [activeOffers],
  );
  const validOffers = React.useMemo(
    () =>
      activeOffers.map((offer) => ({
        id: offer.id,
        providerId: offer.providerId,
      })),
    [activeOffers],
  );

  const readCurrentState = React.useCallback(
    () =>
      readAffiliateWaterfallState(storageRef.current, {
        validOfferIds,
        validOffers,
        validProviderIds: ACTIVE_AFFILIATE_PROVIDER_IDS,
        validSlotIds: [slotId],
      }),
    [slotId, validOfferIds, validOffers],
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
        offers: activeOffers,
        routeCategories,
        maxOffers: 2,
      }),
    [activeOffers, routeCategories],
  );

  const shouldSuppressAffiliate =
    isReady &&
    shouldSuppressAdsenseFallbackForViewport({
      viewportWidth: isMobileLayout ? mobileBreakpointPx - 1 : mobileBreakpointPx,
      suppressAffiliateOnMobileWhenAdjacentAdExists,
      breakpointPx: mobileBreakpointPx,
    });
  const shouldSuppressAdsenseFallback = shouldSuppressAffiliate;

  const selection = React.useMemo(() => {
    if (!isReady || shouldSuppressAffiliate) {
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
    shouldSuppressAffiliate,
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
      if (shouldSuppressAffiliate) return;

      const selectedOffer = selection.selectedOffer;
      if (!selectedOffer) return;

      const selectedOfferId = offerId ?? selectedOffer.id;
      if (!selectedOfferId || selectedOfferId !== selectedOffer.id) return;

      markAffiliateClicked(storageRef.current, {
        providerId: selectedOffer.providerId,
        offerId: selectedOfferId,
        slotId,
        routeContext,
        validOfferIds,
        validOffers,
        validProviderIds: ACTIVE_AFFILIATE_PROVIDER_IDS,
      });
      refreshState();
    },
    [
      isReady,
      refreshState,
      routeContext,
      shouldSuppressAffiliate,
      selection.selectedOffer?.id,
      selection.selectedOffer?.providerId,
      slotId,
      validOfferIds,
      validOffers,
    ],
  );

  React.useEffect(() => {
    const clearDwellTimer = () => {
      if (viewDwellTimerRef.current) {
        clearTimeout(viewDwellTimerRef.current);
        viewDwellTimerRef.current = null;
      }
    };

    if (typeof window === "undefined") return;
    if (!isReady) return;
    if (shouldSuppressAffiliate) return;
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
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.7) {
          clearDwellTimer();
          return;
        }
        if (countedThisSessionRef.current.has(sessionKey)) {
          clearDwellTimer();
          return;
        }
        if (!isAffiliateElementVisibleEnough(bannerElement, 0.7)) {
          clearDwellTimer();
          return;
        }
        if (viewDwellTimerRef.current) return;

        viewDwellTimerRef.current = setTimeout(() => {
          viewDwellTimerRef.current = null;
          if (countedThisSessionRef.current.has(sessionKey)) return;
          if (!isAffiliateElementVisibleEnough(bannerElement, 0.7)) return;

          countedThisSessionRef.current.add(sessionKey);
          incrementAffiliateView(storageRef.current, {
            providerId: selectedOffer.providerId,
            offerId: selectedOffer.id,
            slotId,
            routeContext,
            validOfferIds,
            validOffers,
            validProviderIds: ACTIVE_AFFILIATE_PROVIDER_IDS,
          });
          refreshState();
          observer.disconnect();
        }, 1000);
      },
      { threshold: [0, 0.7, 1] },
    );

    observer.observe(bannerElement);

    return () => {
      clearDwellTimer();
      observer.disconnect();
    };
  }, [
    bannerElement,
    isReady,
    refreshState,
    routeContext,
    selectedOfferTimedOut,
    selection.selectedOffer,
    shouldSuppressAffiliate,
    slotId,
    validOfferIds,
    validOffers,
  ]);

  return {
    selectedOffer: selection.selectedOffer,
    relevantOffers,
    shouldShowAdsense: selection.shouldShowAdsense,
    shouldSuppressAffiliate,
    shouldSuppressAdsenseFallback,
    registerBannerElement,
    trackAffiliateClick,
    isReady,
  };
}
