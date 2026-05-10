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
    title: "PNG to ICO Converter | iLoveSVG",
    description:
      "Convert a PNG logo or icon into favicon.ico output and supporting icon sizes with the existing favicon generator.",
    canonicalPath: "/png-to-ico-converter",
  },
  "/svg-to-ico-converter": {
    label: "SVG To ICO Converter",
    title: "SVG to ICO Converter | iLoveSVG",
    description:
      "Create favicon.ico output from an SVG logo or icon using the existing favicon generator and browser-side icon export workflow.",
    canonicalPath: "/svg-to-ico-converter",
  },
  "/png-to-favicon-generator": {
    label: "PNG To Favicon Generator",
    title: "PNG to Favicon Generator | iLoveSVG",
    description:
      "Create favicon assets from a PNG logo or app icon, including ICO and PNG icon sizes, using the existing favicon generator.",
    canonicalPath: "/png-to-favicon-generator",
  },
  "/jpg-to-favicon-generator": {
    label: "JPG To Favicon Generator",
    title: "JPG to Favicon Generator | iLoveSVG",
    description:
      "Create favicon assets from a JPG or JPEG logo image with square padding, background controls, ICO output, and app icon sizes.",
    canonicalPath: "/jpg-to-favicon-generator",
  },
  "/logo-to-favicon-generator": {
    label: "Logo To Favicon Generator",
    title: "Logo to Favicon Generator | iLoveSVG",
    description:
      "Turn an SVG, PNG, JPG, or WebP logo into favicon-ready ICO and PNG icon assets with browser-side previews.",
    canonicalPath: "/logo-to-favicon-generator",
  },
  "/image-to-favicon-generator": {
    label: "Image To Favicon Generator",
    title: "Image to Favicon Generator | iLoveSVG",
    description:
      "Generate favicon assets from SVG, PNG, JPG, or WebP inputs with browser-side icon previews, ICO output, PNG sizes, and app icon snippets.",
    canonicalPath: "/image-to-favicon-generator",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type FaviconExportRouteMetaPath = keyof typeof FAVICON_EXPORT_ROUTE_META;

export const createFaviconExportMeta = createRouteMetaFactory(FAVICON_EXPORT_ROUTE_META);
