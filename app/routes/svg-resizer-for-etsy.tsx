import type { Route } from "./+types/svg-resizer-for-etsy";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Resizer for Etsy | iLoveSVG";
  const description = "Resize SVG assets for Etsy listing visuals, digital download previews, product graphics, and seller files.";
  const canonical = "https://www.ilovesvg.com/svg-resizer-for-etsy";

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
