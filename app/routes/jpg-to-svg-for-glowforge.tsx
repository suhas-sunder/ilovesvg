import type { Route } from "./+types/jpg-to-svg-for-glowforge";
import Template, { action, loader } from "./jpg-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  const title = "JPG to SVG for Glowforge | iLoveSVG";
  const description = "Convert JPG artwork into SVG for Glowforge-style laser prep, outline cleanup, engraving references, and test cuts.";
  const canonical = "https://www.ilovesvg.com/jpg-to-svg-for-glowforge";

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

export { action, loader };

export default Template;
