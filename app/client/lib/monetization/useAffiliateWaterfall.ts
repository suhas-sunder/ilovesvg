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
  createEmptyAffiliateSuppressionState,
  getAffiliateWaterfallEntry,
  getBrowserAffiliateSuppressionStorage,
  getBrowserAffiliateStorage,
  incrementAffiliateView,
  isAffiliateSlotSuppressed,
  isAffiliateWaterfallEntryTimedOut,
  markAffiliateSlotSuppressed,
  markAffiliateClicked,
  readAffiliateSuppressionState,
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
  const [suppressionState, setSuppressionState] = React.useState(
    createEmptyAffiliateSuppressionState,
  );
  const [bannerElement, setBannerElement] = React.useState<HTMLElement | null>(
    null,
  );

  const storageRef = React.useRef<AffiliateStorageLike | null>(null);
  const suppressionStorageRef = React.useRef<AffiliateStorageLike | null>(null);
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

  const readCurrentSuppressionState = React.useCallback(
    () =>
      readAffiliateSuppressionState(suppressionStorageRef.current, {
        validSlotIds: [slotId],
      }),
    [slotId],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    storageRef.current = getBrowserAffiliateStorage();
    suppressionStorageRef.current = getBrowserAffiliateSuppressionStorage();
    setState(readCurrentState());
    setSuppressionState(readCurrentSuppressionState());

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
  }, [
    mobileBreakpointPx,
    readCurrentState,
    readCurrentSuppressionState,
    routeContext,
    slotId,
  ]);

  const relevantOffers = React.useMemo(
    () =>
      getRelevantAffiliateOffers({
        offers: activeOffers,
        routeCategories,
        maxOffers: 2,
      }),
    [activeOffers, routeCategories],
  );

  const isSessionSuppressed =
    isReady &&
    isAffiliateSlotSuppressed(suppressionState, {
      slotId,
    });
  const shouldSuppressForAdjacentAd =
    isReady &&
    shouldSuppressAdsenseFallbackForViewport({
      viewportWidth: isMobileLayout ? mobileBreakpointPx - 1 : mobileBreakpointPx,
      suppressAffiliateOnMobileWhenAdjacentAdExists,
      breakpointPx: mobileBreakpointPx,
    });
  const shouldSuppressAffiliate =
    isSessionSuppressed || shouldSuppressForAdjacentAd;
  const shouldSuppressAdsenseFallback = shouldSuppressForAdjacentAd;

  const selection = React.useMemo(() => {
    if (!isReady || shouldSuppressForAdjacentAd) {
      return {
        selectedOffer: null,
        shouldShowAdsense: false,
      };
    }

    if (isSessionSuppressed) {
      return {
        selectedOffer: null,
        shouldShowAdsense: true,
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
    isSessionSuppressed,
    shouldSuppressForAdjacentAd,
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

  const refreshSuppressionState = React.useCallback(() => {
    setSuppressionState(readCurrentSuppressionState());
  }, [readCurrentSuppressionState]);

  const suppressAffiliateSlot = React.useCallback(
    (reason: "clicked" | "exhausted" | "view-cap") => {
      if (!isReady) return null;
      const entry = markAffiliateSlotSuppressed(suppressionStorageRef.current, {
        slotId,
        routeContext,
        reason,
        validSlotIds: [slotId],
      });
      refreshSuppressionState();
      return entry;
    },
    [isReady, refreshSuppressionState, routeContext, slotId],
  );

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
      suppressAffiliateSlot("clicked");
      refreshState();
    },
    [
      isReady,
      refreshState,
      routeContext,
      shouldSuppressAffiliate,
      selection.selectedOffer?.id,
      selection.selectedOffer?.providerId,
      suppressAffiliateSlot,
      slotId,
      validOfferIds,
      validOffers,
    ],
  );

  React.useEffect(() => {
    if (!isReady) return;
    if (shouldSuppressForAdjacentAd || isSessionSuppressed) return;
    if (!relevantOffers.length) return;
    if (selection.selectedOffer || !selection.shouldShowAdsense) return;
    suppressAffiliateSlot("exhausted");
  }, [
    isReady,
    isSessionSuppressed,
    relevantOffers.length,
    selection.selectedOffer,
    selection.shouldShowAdsense,
    shouldSuppressForAdjacentAd,
    suppressAffiliateSlot,
  ]);

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
          const nextEntry = incrementAffiliateView(storageRef.current, {
            providerId: selectedOffer.providerId,
            offerId: selectedOffer.id,
            slotId,
            routeContext,
            validOfferIds,
            validOffers,
            validProviderIds: ACTIVE_AFFILIATE_PROVIDER_IDS,
          });
          if (nextEntry?.timedOut) {
            suppressAffiliateSlot("view-cap");
          }
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
    suppressAffiliateSlot,
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
