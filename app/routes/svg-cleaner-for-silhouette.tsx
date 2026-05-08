import type { Route } from "./+types/svg-cleaner-for-silhouette";
import Template from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Cleaner for Silhouette | iLoveSVG";
  const description = "Clean SVG markup before Silhouette-style import, cutting software prep, sizing checks, and path review.";
  const canonical = "https://www.ilovesvg.com/svg-cleaner-for-silhouette";

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
