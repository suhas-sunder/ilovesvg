import type { Route } from "./+types/image-to-svg-for-silhouette";
import Template, { action, loader } from "./image-to-svg-for-cricut";

export function meta({}: Route.MetaArgs) {
  const title = "Image to SVG for Silhouette | iLoveSVG";
  const description =
    "Convert simple images into SVG starting points for Silhouette Studio, vinyl, sticker, decal, and craft cutting workflows.";
  const canonical = "https://www.ilovesvg.com/image-to-svg-for-silhouette";

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
