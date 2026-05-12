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
      "Export SVG artwork as transparent PNG for Printify product artwork, mockups, previews, and print-on-demand upload prep.",
    canonicalPath: "/svg-to-png-for-printify",
  },
  "/svg-to-png-for-printful": {
    label: "SVG To PNG For Printful",
    title: "SVG to PNG for Printful | iLoveSVG",
    description:
      "Export SVG artwork as transparent PNG for Printful product artwork, mockups, previews, and print-on-demand upload prep.",
    canonicalPath: "/svg-to-png-for-printful",
  },
  "/sticker-to-png-for-printing": {
    label: "Sticker To PNG For Printing",
    title: "Sticker SVG to PNG for Printing | iLoveSVG",
    description:
      "Export sticker SVG artwork to transparent PNG for printing previews, labels, decals, and product mockups.",
    canonicalPath: "/sticker-to-png-for-printing",
  },
  "/svg-to-transparent-png-for-printing": {
    label: "SVG To Transparent PNG For Printing",
    title: "SVG to Transparent PNG for Printing | iLoveSVG",
    description:
      "Export SVG artwork as a transparent PNG for print previews, product mockups, stickers, and clean handoff files.",
    canonicalPath: "/svg-to-transparent-png-for-printing",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type MarketplaceExportRouteMetaPath = keyof typeof MARKETPLACE_EXPORT_ROUTE_META;

export const createMarketplaceExportMeta = createRouteMetaFactory(
  MARKETPLACE_EXPORT_ROUTE_META,
);
