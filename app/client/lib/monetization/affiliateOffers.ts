import type { AffiliateCategory } from "./affiliateRouteIntents";
import {
  type AffiliateProviderId,
  isAffiliateProviderActive,
} from "./affiliateProviders";

export type AffiliateProvider = AffiliateProviderId;

export type AffiliateOffer = {
  id: string;
  providerId: AffiliateProvider;
  label: string;
  href: string;
  categories: AffiliateCategory[];
  enabled: boolean;
  priority: number;
};

export const AMAZON_VINYL_AFFILIATE_URL = "https://amzn.to/4eyJt2K";

export const AFFILIATE_OFFERS: AffiliateOffer[] = [
  {
    id: "amazon-printable-vinyl-sticker-paper",
    providerId: "amazon",
    label: "Amazon printable vinyl sticker paper",
    href: AMAZON_VINYL_AFFILIATE_URL,
    categories: [
      "stickers",
      "print-then-cut",
      "cricut-cut",
      "silhouette-vinyl",
      "general-svg-conversion",
    ],
    enabled: true,
    priority: 10,
  },
];

export function isValidAffiliateHref(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isValidAffiliateOffer(offer: AffiliateOffer) {
  return (
    isAffiliateProviderActive(offer.providerId) &&
    offer.enabled === true &&
    Boolean(offer.id.trim()) &&
    Boolean(offer.label.trim()) &&
    isValidAffiliateHref(offer.href) &&
    offer.categories.length > 0
  );
}

export function filterActiveAffiliateOffers(offers: readonly AffiliateOffer[]) {
  return offers.filter(isValidAffiliateOffer);
}

export function getActiveAffiliateOfferIds() {
  return filterActiveAffiliateOffers(AFFILIATE_OFFERS).map((offer) => offer.id);
}

export function isKnownActiveAffiliateOffer(offerId: string) {
  return getActiveAffiliateOfferIds().includes(offerId);
}

export function offerMatchesRouteCategories(
  offer: AffiliateOffer,
  routeCategories: readonly AffiliateCategory[],
) {
  if (!isValidAffiliateOffer(offer)) return false;
  if (!routeCategories.length) return false;

  const routeCategorySet = new Set(routeCategories);
  return offer.categories.some((category) => routeCategorySet.has(category));
}

export function getRelevantAffiliateOffers({
  offers,
  routeCategories,
  maxOffers = 2,
}: {
  offers: readonly AffiliateOffer[];
  routeCategories: readonly AffiliateCategory[];
  maxOffers?: number;
}) {
  const seenOfferIds = new Set<string>();

  return filterActiveAffiliateOffers(offers)
    .filter((offer) => offerMatchesRouteCategories(offer, routeCategories))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .filter((offer) => {
      if (seenOfferIds.has(offer.id)) return false;
      seenOfferIds.add(offer.id);
      return true;
    })
    .slice(0, Math.max(0, maxOffers));
}
