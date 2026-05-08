import type { AffiliateOffer } from "./affiliateOffers";
import {
  type AffiliateWaterfallState,
  getAffiliateWaterfallEntry,
  isAffiliateWaterfallEntryTimedOut,
} from "./affiliateWaterfallStorage";

export type AffiliateWaterfallSelection = {
  selectedOffer: AffiliateOffer | null;
  shouldShowAdsense: boolean;
};

export function selectAffiliateWaterfallOffer({
  offers,
  state,
  slotId,
  routeContext,
}: {
  offers: readonly AffiliateOffer[];
  state: AffiliateWaterfallState;
  slotId: string;
  routeContext: string;
}): AffiliateWaterfallSelection {
  if (!offers.length) {
    return {
      selectedOffer: null,
      shouldShowAdsense: true,
    };
  }

  for (const offer of offers.slice(0, 2)) {
    const entry = getAffiliateWaterfallEntry(state, {
      offerId: offer.id,
      slotId,
      routeContext,
    });
    if (!isAffiliateWaterfallEntryTimedOut(entry)) {
      return {
        selectedOffer: offer,
        shouldShowAdsense: false,
      };
    }
  }

  return {
    selectedOffer: null,
    shouldShowAdsense: true,
  };
}
