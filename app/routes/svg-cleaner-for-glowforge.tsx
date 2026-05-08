import type { Route } from "./+types/svg-cleaner-for-glowforge";
import Template from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Cleaner for Glowforge | iLoveSVG";
  const description = "Clean SVG markup before Glowforge-style laser workflows, import testing, sizing checks, and path review.";
  const canonical = "https://www.ilovesvg.com/svg-cleaner-for-glowforge";

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
