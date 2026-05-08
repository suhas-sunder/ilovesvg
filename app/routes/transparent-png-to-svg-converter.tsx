import type { Route } from "./+types/transparent-png-to-svg-converter";
import Template, { action, loader } from "./png-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  const title = "Transparent PNG to SVG Converter | iLoveSVG";
  const description = "Convert transparent PNG logos, stickers, icons, and product artwork into SVG with background-aware tracing guidance.";
  const canonical = "https://www.ilovesvg.com/transparent-png-to-svg-converter";

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
