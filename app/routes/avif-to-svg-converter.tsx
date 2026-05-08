import type { Route } from "./+types/avif-to-svg-converter";
import Template, { action, loader } from "./image-to-svg-for-cricut";

export function meta({}: Route.MetaArgs) {
  const title = "AVIF to SVG Converter | iLoveSVG";
  const description = "Convert AVIF graphics to SVG using the existing image tracing workflow for modern compressed web artwork, icons, logos, and illustration exports.";
  const canonical = "https://www.ilovesvg.com/avif-to-svg-converter";

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
