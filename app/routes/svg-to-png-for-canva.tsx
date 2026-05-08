import type { Route } from "./+types/svg-to-png-for-canva";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to PNG for Canva | iLoveSVG";
  const description = "Export SVG artwork to PNG for Canva uploads, transparent graphics, predictable sizing, and design handoff.";
  const canonical = "https://www.ilovesvg.com/svg-to-png-for-canva";

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
