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
