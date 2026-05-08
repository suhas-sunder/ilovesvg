import type { Route } from "./+types/svg-to-transparent-png-for-printing";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to Transparent PNG for Printing | iLoveSVG";
  const description = "Export SVG artwork as a transparent PNG for print previews, product mockups, stickers, and clean handoff files.";
  const canonical = "https://www.ilovesvg.com/svg-to-transparent-png-for-printing";

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
