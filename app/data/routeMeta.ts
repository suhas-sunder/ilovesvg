import type { RouteMetaEntry } from "./routeManifest.types";

const SITE_ORIGIN = "https://www.ilovesvg.com";

export const ROUTE_META_BY_PATH = {
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
} as const satisfies Readonly<Record<string, RouteMetaEntry>>;

export type RouteMetaPath = keyof typeof ROUTE_META_BY_PATH;

function normalizeRouteMetaPath(pathname: string) {
  return pathname === "/"
    ? "/"
    : `/${pathname.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function getRouteMetaEntry(pathname: string): RouteMetaEntry | undefined {
  const normalized = normalizeRouteMetaPath(pathname);
  return ROUTE_META_BY_PATH[normalized as RouteMetaPath];
}

export function getRouteMetaCanonicalUrl(entry: RouteMetaEntry) {
  return `${SITE_ORIGIN}${entry.canonicalPath === "/" ? "" : entry.canonicalPath}`;
}

export function createManifestMeta(pathname: string) {
  const entry = getRouteMetaEntry(pathname);
  if (!entry) {
    throw new Error(`Missing route metadata entry for ${pathname}`);
  }

  const title = entry.title ?? `${entry.label} | iLoveSVG`;
  const description = entry.description ?? `${entry.label} on iLoveSVG.`;
  const canonical = getRouteMetaCanonicalUrl(entry);

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}
