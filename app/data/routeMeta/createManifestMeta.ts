import type { RouteMetaEntry } from "../routeManifest.types";

const SITE_ORIGIN = "https://www.ilovesvg.com";

type RouteMetaRecord<TPath extends string> = Readonly<Record<TPath, RouteMetaEntry>>;

function getRouteMetaCanonicalUrl(entry: RouteMetaEntry) {
  return `${SITE_ORIGIN}${entry.canonicalPath === "/" ? "" : entry.canonicalPath}`;
}

export function createRouteMetaFactory<TPath extends string>(
  entries: RouteMetaRecord<TPath>,
) {
  return (pathname: TPath) => {
    const entry = entries[pathname];
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
  };
}
