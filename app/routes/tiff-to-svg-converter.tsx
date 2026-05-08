import type { Route } from "./+types/tiff-to-svg-converter";
import Template, { action, loader } from "./image-to-svg-for-cricut";

export function meta({}: Route.MetaArgs) {
  const title = "TIFF to SVG Converter | iLoveSVG";
  const description = "Convert TIFF and TIF scans to SVG with the existing raster tracing workflow for archival artwork, scanned drawings, paperwork, and print handoff prep.";
  const canonical = "https://www.ilovesvg.com/tiff-to-svg-converter";

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
