import type { Route } from "./+types/logo-to-favicon-generator";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  const title = "Logo to Favicon Generator | iLoveSVG";
  const description = "Turn an SVG, PNG, JPG, or WebP logo into favicon-ready ICO and PNG icon assets with browser-side previews.";
  const canonical = "https://www.ilovesvg.com/logo-to-favicon-generator";

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
