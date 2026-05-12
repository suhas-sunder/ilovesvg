import type { RouteMetaEntry } from "../routeManifest.types";
import { createRouteMetaFactory } from "./createManifestMeta";

const CANVA_FIGMA_ROUTE_META = {
  "/png-to-svg-for-canva": {
    label: "PNG To SVG For Canva",
    title: "PNG to SVG for Canva | iLoveSVG",
    description:
      "Convert PNG artwork into SVG for cleaner Canva design reuse, scalable logos, icons, and simple graphics.",
    canonicalPath: "/png-to-svg-for-canva",
  },
  "/jpg-to-svg-for-canva": {
    label: "JPG To SVG For Canva",
    title: "JPG to SVG for Canva | iLoveSVG",
    description:
      "Convert JPG graphics into SVG for Canva design reuse, simplified line art, logos, and scalable layout assets.",
    canonicalPath: "/jpg-to-svg-for-canva",
  },
  "/logo-to-svg-for-canva": {
    label: "Logo To SVG For Canva",
    title: "Logo to SVG for Canva | iLoveSVG",
    description:
      "Convert logo images into SVG for Canva brand graphics, scalable marks, and reusable design assets.",
    canonicalPath: "/logo-to-svg-for-canva",
  },
  "/svg-to-png-for-canva": {
    label: "SVG To PNG For Canva",
    title: "SVG to PNG for Canva | iLoveSVG",
    description:
      "Export SVG artwork to PNG for Canva uploads, transparent graphics, predictable sizing, and design handoff.",
    canonicalPath: "/svg-to-png-for-canva",
  },
  "/png-to-svg-for-figma": {
    label: "PNG To SVG For Figma",
    title: "PNG to SVG for Figma | iLoveSVG",
    description:
      "Convert PNG assets into SVG for Figma handoff, scalable graphics, icon prep, and cleanup workflows.",
    canonicalPath: "/png-to-svg-for-figma",
  },
  "/svg-to-png-for-figma": {
    label: "SVG To PNG For Figma",
    title: "SVG to PNG for Figma | iLoveSVG",
    description:
      "Export SVG assets to PNG for Figma handoff, previews, thumbnails, and flattened sharing files.",
    canonicalPath: "/svg-to-png-for-figma",
  },
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type CanvaFigmaRouteMetaPath = keyof typeof CANVA_FIGMA_ROUTE_META;

export const createCanvaFigmaMeta = createRouteMetaFactory(CANVA_FIGMA_ROUTE_META);
