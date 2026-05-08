import type { Route } from "./+types/svg-to-jpg-for-etsy";
import Template from "./svg-to-jpg-converter";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to JPG for Etsy | iLoveSVG";
  const description = "Export flattened JPG listing previews from SVG artwork for Etsy product images, mockups, and shop visuals.";
  const canonical = "https://www.ilovesvg.com/svg-to-jpg-for-etsy";

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
