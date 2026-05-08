import type { Route } from "./+types/image-to-layered-svg-converter";
import Template, { action, loader } from "./image-to-layered-svg-for-cricut";

export function meta({}: Route.MetaArgs) {
  const title = "Image to Layered SVG Converter | iLoveSVG";
  const description = "Convert images into layered SVG output for editable color regions, creator artwork, stickers, and design prep.";
  const canonical = "https://www.ilovesvg.com/image-to-layered-svg-converter";

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
