import type { RouteMetaEntry } from "../routeManifest.types";
import { createRouteMetaFactory } from "./createManifestMeta";

const MARKETPLACE_EXPORT_ROUTE_META = {
  "/svg-to-png-for-etsy": {
    label: "SVG To PNG For Etsy",
    title: "SVG to PNG for Etsy | iLoveSVG",
    description:
      "Export Etsy listing preview images and digital product visuals from SVG with transparent or solid backgrounds.",
    canonicalPath: "/svg-to-png-for-etsy",
  },
  "/svg-to-jpg-for-etsy": {
    label: "SVG To JPG For Etsy",
    title: "SVG to JPG for Etsy | iLoveSVG",
    description:
      "Export flattened JPG listing previews from SVG artwork for Etsy product images, mockups, and shop visuals.",
    canonicalPath: "/svg-to-jpg-for-etsy",
  },
  "/svg-to-png-for-shopify": {
    label: "SVG To PNG For Shopify",
    title: "SVG to PNG for Shopify | iLoveSVG",
    description:
      "Export Shopify-ready PNG copies from SVG assets with transparent backgrounds, exact sizing, and browser-side previews.",
    canonicalPath: "/svg-to-png-for-shopify",
  },
  "/svg-to-png-for-printify": {
    label: "SVG To PNG For Printify",
    title: "SVG to PNG for Printify | iLoveSVG",
    description:
      "Export transparent PNG product artwork from SVG for Printify mockups, product previews, and seller workflows.",
    canonicalPath: "/svg-to-png-for-printify",
  },
  "/svg-to-png-for-printful": {
    label: "SVG To PNG For Printful",
    title: "SVG to PNG for Printful | iLoveSVG",
    description:
      "Export SVG artwork to PNG for Printful-style product mockups, print previews, and seller asset preparation.",
    canonicalPath: "/svg-to-png-for-printful",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type MarketplaceExportRouteMetaPath = keyof typeof MARKETPLACE_EXPORT_ROUTE_META;

export const createMarketplaceExportMeta = createRouteMetaFactory(
  MARKETPLACE_EXPORT_ROUTE_META,
);
