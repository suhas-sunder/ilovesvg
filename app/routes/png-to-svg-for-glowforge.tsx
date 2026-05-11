import type { Route } from "./+types/png-to-svg-for-glowforge";
import Template, { action, loader } from "./png-to-svg-for-laser-cutting";

export function meta({}: Route.MetaArgs) {
  const title = "PNG to SVG for Glowforge | iLoveSVG";
  const description =
    "Convert PNG artwork into SVG starting points for Glowforge laser cutting, engraving prep, and path complexity review.";
  const canonical = "https://www.ilovesvg.com/png-to-svg-for-glowforge";

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
