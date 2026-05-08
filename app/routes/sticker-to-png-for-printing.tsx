import type { Route } from "./+types/sticker-to-png-for-printing";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  const title = "Sticker SVG to PNG for Printing | iLoveSVG";
  const description = "Export sticker SVG artwork to transparent PNG for printing previews, labels, decals, and product mockups.";
  const canonical = "https://www.ilovesvg.com/sticker-to-png-for-printing";

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


export default Template;
