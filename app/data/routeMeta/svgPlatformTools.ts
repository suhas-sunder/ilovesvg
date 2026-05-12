import type { RouteMetaEntry } from "../routeManifest.types";
import { createRouteMetaFactory } from "./createManifestMeta";

const SVG_PLATFORM_TOOLS_ROUTE_META = {
  "/svg-resizer-for-canva": {
    label: "SVG Resizer For Canva",
    title: "SVG Resizer for Canva Layouts | iLoveSVG",
    description:
      "Resize SVG logos and design assets for Canva layouts, uploads, and placement. Review width, height, and viewBox before using the file.",
    canonicalPath: "/svg-resizer-for-canva",
  },
  "/svg-resizer-for-etsy": {
    label: "SVG Resizer For Etsy",
    title: "SVG Resizer for Etsy Listing Assets | iLoveSVG",
    description:
      "Resize SVG assets for Etsy listings, shop graphics, digital product previews, and downloads. Check dimensions before publishing.",
    canonicalPath: "/svg-resizer-for-etsy",
  },
  "/svg-resizer-for-figma": {
    label: "SVG Resizer For Figma",
    title: "SVG Resizer for Figma Components | iLoveSVG",
    description:
      "Resize SVGs for Figma imports, components, icons, and design handoff. Review width, height, and viewBox before placing assets.",
    canonicalPath: "/svg-resizer-for-figma",
  },
  "/svg-resizer-for-glowforge": {
    label: "SVG Resizer For Glowforge",
    title: "SVG Resizer for Glowforge Laser Prep | iLoveSVG",
    description:
      "Resize SVG artwork before Glowforge laser cutting or engraving review. Check workspace scale, material sizing, and viewBox before use.",
    canonicalPath: "/svg-resizer-for-glowforge",
  },
  "/svg-resizer-for-shopify": {
    label: "SVG Resizer For Shopify",
    title: "SVG Resizer for Shopify Theme Assets | iLoveSVG",
    description:
      "Resize Shopify SVG logos, icons, badges, and storefront graphics for theme assets. Review dimensions before publishing.",
    canonicalPath: "/svg-resizer-for-shopify",
  },
  "/svg-resizer-for-silhouette": {
    label: "SVG Resizer For Silhouette",
    title: "SVG Resizer for Silhouette Studio | iLoveSVG",
    description:
      "Resize SVG artwork for Silhouette Studio projects, decals, labels, and cut files. Check width, height, and viewBox before cutting.",
    canonicalPath: "/svg-resizer-for-silhouette",
  },
  "/svg-cleaner-for-figma": {
    label: "SVG Cleaner For Figma",
    title: "SVG Cleaner for Figma Import and Editing | iLoveSVG",
    description:
      "Clean SVG markup for Figma import and design handoff. Remove editor clutter, review the preview, and keep output easy to inspect.",
    canonicalPath: "/svg-cleaner-for-figma",
  },
  "/svg-cleaner-for-glowforge": {
    label: "SVG Cleaner For Glowforge",
    title: "SVG Cleaner for Glowforge Laser Review | iLoveSVG",
    description:
      "Clean SVG markup before Glowforge laser cutting or engraving review. Remove clutter, preserve geometry, and inspect paths before material tests.",
    canonicalPath: "/svg-cleaner-for-glowforge",
  },
  "/svg-cleaner-for-silhouette": {
    label: "SVG Cleaner For Silhouette",
    title: "SVG Cleaner for Silhouette Studio | iLoveSVG",
    description:
      "Clean SVG markup before Silhouette Studio review. Remove editor clutter, preserve cut paths, and inspect details before sending to a cutter.",
    canonicalPath: "/svg-cleaner-for-silhouette",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type SvgPlatformToolsRouteMetaPath = keyof typeof SVG_PLATFORM_TOOLS_ROUTE_META;

export const createSvgPlatformToolsMeta = createRouteMetaFactory(
  SVG_PLATFORM_TOOLS_ROUTE_META,
);
