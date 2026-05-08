import type { Route } from "./+types/bmp-to-svg-converter";
import Template, { action, loader } from "./image-to-svg-for-cricut";

export function meta({}: Route.MetaArgs) {
  const title = "BMP to SVG Converter | iLoveSVG";
  const description = "Convert BMP images to SVG for legacy bitmap art, scans, line art, old design archives, and black-and-white cleanup workflows.";
  const canonical = "https://www.ilovesvg.com/bmp-to-svg-converter";

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
