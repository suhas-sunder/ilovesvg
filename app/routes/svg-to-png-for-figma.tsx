import type { Route } from "./+types/svg-to-png-for-figma";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to PNG for Figma | iLoveSVG";
  const description = "Export SVG assets to PNG for Figma handoff, previews, thumbnails, and flattened sharing files.";
  const canonical = "https://www.ilovesvg.com/svg-to-png-for-figma";

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
