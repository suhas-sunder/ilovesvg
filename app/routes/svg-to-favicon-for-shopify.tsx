import type { Route } from "./+types/svg-to-favicon-for-shopify";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to Favicon for Shopify | iLoveSVG";
  const description = "Generate favicon and app icon assets from a Shopify store SVG logo or brand mark.";
  const canonical = "https://www.ilovesvg.com/svg-to-favicon-for-shopify";

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
