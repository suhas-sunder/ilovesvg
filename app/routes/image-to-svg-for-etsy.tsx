import type { Route } from "./+types/image-to-svg-for-etsy";
import Template, { action, loader } from "./image-to-svg-for-cricut";

export function meta({}: Route.MetaArgs) {
  const title = "Image to SVG for Etsy | iLoveSVG";
  const description = "Convert images into SVG for Etsy seller workflows, listing assets, digital downloads, mockup prep, and reusable graphics.";
  const canonical = "https://www.ilovesvg.com/image-to-svg-for-etsy";

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
