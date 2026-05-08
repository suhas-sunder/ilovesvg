import type { Route } from "./+types/jpg-to-svg-for-etsy";
import Template, { action, loader } from "./jpg-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  const title = "JPG to SVG for Etsy | iLoveSVG";
  const description = "Convert JPG artwork into SVG for Etsy shop assets, listing graphics, digital downloads, and simplified seller artwork.";
  const canonical = "https://www.ilovesvg.com/jpg-to-svg-for-etsy";

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
