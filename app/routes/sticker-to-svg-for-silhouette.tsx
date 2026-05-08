import type { Route } from "./+types/sticker-to-svg-for-silhouette";
import Template, { action } from "./sticker-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  const title = "Sticker to SVG for Silhouette | iLoveSVG";
  const description = "Convert sticker artwork into SVG for Silhouette-style sticker, decal, label, and vinyl workflows.";
  const canonical = "https://www.ilovesvg.com/sticker-to-svg-for-silhouette";

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

export { action };

export default Template;
