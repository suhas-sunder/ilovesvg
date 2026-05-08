import type { AffiliateCategory } from "./affiliateRouteIntents";

export type AffiliateProvider =
  | "cricut"
  | "printify"
  | "stickerMule"
  | "namecheap";

export type AffiliateOffer = {
  id: string;
  provider: AffiliateProvider;
  label: string;
  href: string;
  categories: AffiliateCategory[];
  enabled: boolean;
  priority: number;
};

export const CRICUT_URL = "";

export const PRINTIFY_URL =
  "https://try.printify.com/ilovesvg?utm_source=ilovesvg&utm_medium=affiliate&utm_campaign=printify_pod";

export const STICKER_MULE_URL =
  "https://www.stickermule.com/ca/unlock?ref_id=1974725801&utm_medium=embed&utm_source=invite&utm_content=728x90";

export const NAMECHEAP_URL =
  "https://namecheap.pxf.io/c/7235182/738167/5618?utm_source=ilovesvg&utm_medium=affiliate&utm_campaign=domain_hosting_bundle";

export const AFFILIATE_OFFERS: AffiliateOffer[] = [
  {
    id: "printify-product-mockups",
    provider: "printify",
    label: "Printify product mockups",
    href: PRINTIFY_URL,
    categories: [
      "stickers",
      "print-then-cut",
      "print-on-demand",
      "ecommerce-selling",
      "logo-icon",
      "line-art-sketch",
      "photo-color-conversion",
      "layered-svg",
    ],
    enabled: true,
    priority: 10,
  },
  {
    id: "sticker-mule-custom-stickers",
    provider: "stickerMule",
    label: "Sticker Mule custom stickers",
    href: STICKER_MULE_URL,
    categories: ["stickers", "print-then-cut", "silhouette-vinyl"],
    enabled: true,
    priority: 20,
  },
  {
    id: "namecheap-domain-hosting",
    provider: "namecheap",
    label: "Namecheap domains and hosting",
    href: NAMECHEAP_URL,
    categories: ["web-design", "ecommerce-selling", "logo-icon"],
    enabled: true,
    priority: 30,
  },
  {
    id: "cricut-project-workflow",
    provider: "cricut",
    label: "Cricut project workflow",
    href: CRICUT_URL,
    categories: ["cricut-cut", "print-then-cut", "silhouette-vinyl"],
    enabled: Boolean(CRICUT_URL),
    priority: 40,
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
    offer.enabled === true &&
    Boolean(offer.id.trim()) &&
    Boolean(offer.label.trim()) &&
    isValidAffiliateHref(offer.href) &&
    offer.categories.length > 0
  );
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

  return [...offers]
    .filter((offer) => offerMatchesRouteCategories(offer, routeCategories))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .filter((offer) => {
      if (seenOfferIds.has(offer.id)) return false;
      seenOfferIds.add(offer.id);
      return true;
    })
    .slice(0, Math.max(0, maxOffers));
}
