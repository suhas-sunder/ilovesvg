import type { Route } from "./+types/svg-resizer-for-figma";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Resizer for Figma | iLoveSVG";
  const description = "Resize SVG assets for Figma handoff, viewBox checks, component sizing, and predictable exports.";
  const canonical = "https://www.ilovesvg.com/svg-resizer-for-figma";

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
