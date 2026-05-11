import type { RouteMetaEntry } from "../routeManifest.types";
import { createRouteMetaFactory } from "./createManifestMeta";

const MARKETPLACE_CRAFT_ROUTE_META = {
  "/logo-to-svg-for-etsy": {
    label: "Logo To SVG For Etsy",
    title: "Logo to SVG for Etsy | iLoveSVG",
    description:
      "Convert Etsy shop logos and brand marks into SVG for shop branding, listing graphics, digital downloads, and seller review.",
    canonicalPath: "/logo-to-svg-for-etsy",
  },
  "/logo-to-svg-for-shopify": {
    label: "Logo To SVG For Shopify",
    title: "Logo to SVG for Shopify | iLoveSVG",
    description:
      "Convert Shopify logos, icons, and badges into SVG storefront assets for theme graphics, brand marks, and review before publishing.",
    canonicalPath: "/logo-to-svg-for-shopify",
  },
  "/sticker-to-svg-for-etsy": {
    label: "Sticker To SVG For Etsy",
    title: "Sticker to SVG for Etsy | iLoveSVG",
    description:
      "Convert sticker artwork into SVG for Etsy listing assets, digital sticker products, transparent decals, and seller review before publishing.",
    canonicalPath: "/sticker-to-svg-for-etsy",
  },
  "/sticker-to-svg-for-silhouette": {
    label: "Sticker To SVG For Silhouette",
    title: "Sticker to SVG for Silhouette | iLoveSVG",
    description:
      "Convert sticker artwork into SVG for Silhouette-style sticker, decal, label, and vinyl workflows.",
    canonicalPath: "/sticker-to-svg-for-silhouette",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type MarketplaceCraftRouteMetaPath = keyof typeof MARKETPLACE_CRAFT_ROUTE_META;

export const createMarketplaceCraftMeta = createRouteMetaFactory(
  MARKETPLACE_CRAFT_ROUTE_META,
);
