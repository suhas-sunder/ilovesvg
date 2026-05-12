import type { RouteMetaEntry } from "../routeManifest.types";
import { createRouteMetaFactory } from "./createManifestMeta";

const FAVICON_EXPORT_ROUTE_META = {
  "/svg-to-favicon-for-shopify": {
    label: "SVG To Favicon For Shopify",
    title: "SVG to Favicon for Shopify | iLoveSVG",
    description:
      "Generate favicon and app icon assets from a Shopify store SVG logo or brand mark.",
    canonicalPath: "/svg-to-favicon-for-shopify",
  },
  "/logo-to-favicon-for-shopify": {
    label: "Logo To Favicon For Shopify",
    title: "Logo to Favicon for Shopify | iLoveSVG",
    description:
      "Generate Shopify favicon assets from a logo image or SVG using the existing favicon workflow.",
    canonicalPath: "/logo-to-favicon-for-shopify",
  },
  "/png-to-ico-converter": {
    label: "PNG To ICO Converter",
    title: "PNG to ICO Converter - Create favicon.ico Files | iLoveSVG",
    description:
      "Convert a PNG logo or icon into a multi-size favicon.ico with preview, square padding, and supporting PNG icon sizes.",
    canonicalPath: "/png-to-ico-converter",
  },
  "/svg-to-ico-converter": {
    label: "SVG To ICO Converter",
    title: "SVG to ICO Converter - Create favicon.ico Files | iLoveSVG",
    description:
      "Convert an SVG logo or icon into a multi-size favicon.ico with browser-side previews, square padding, and icon-size exports.",
    canonicalPath: "/svg-to-ico-converter",
  },
  "/png-to-favicon-generator": {
    label: "PNG To Favicon Generator",
    title: "PNG to Favicon Generator - Create Website Icons | iLoveSVG",
    description:
      "Generate favicon.ico and PNG icon sizes from a PNG logo or app icon with square padding, previews, and ZIP download.",
    canonicalPath: "/png-to-favicon-generator",
  },
  "/jpg-to-favicon-generator": {
    label: "JPG To Favicon Generator",
    title: "JPG to Favicon Generator - Create Website Icons | iLoveSVG",
    description:
      "Generate favicon.ico and PNG icon sizes from a JPG or JPEG logo with background controls, previews, and ZIP download.",
    canonicalPath: "/jpg-to-favicon-generator",
  },
  "/logo-to-favicon-generator": {
    label: "Logo To Favicon Generator",
    title: "Logo to Favicon Generator - Create Site Icons | iLoveSVG",
    description:
      "Turn a logo image into favicon.ico and PNG site icons with square padding, browser previews, app icon sizes, and ZIP download.",
    canonicalPath: "/logo-to-favicon-generator",
  },
  "/image-to-favicon-generator": {
    label: "Image To Favicon Generator",
    title: "Image to Favicon Generator - Create Website Icons | iLoveSVG",
    description:
      "Generate favicon.ico and PNG icon sizes from SVG, PNG, JPG, or WebP images with previews, app icon sizes, and ZIP download.",
    canonicalPath: "/image-to-favicon-generator",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type FaviconExportRouteMetaPath = keyof typeof FAVICON_EXPORT_ROUTE_META;

export const createFaviconExportMeta = createRouteMetaFactory(FAVICON_EXPORT_ROUTE_META);
