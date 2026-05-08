import type { Route } from "./+types/svg-to-png-for-etsy";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to PNG for Etsy | iLoveSVG";
  const description = "Export Etsy listing preview images and digital product visuals from SVG with transparent or solid backgrounds.";
  const canonical = "https://www.ilovesvg.com/svg-to-png-for-etsy";

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
