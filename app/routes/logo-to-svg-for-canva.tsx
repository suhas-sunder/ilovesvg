import type { Route } from "./+types/logo-to-svg-for-canva";
import Template, { action, loader } from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  const title = "Logo to SVG for Canva | iLoveSVG";
  const description = "Convert logo images into SVG for Canva brand graphics, scalable marks, and reusable design assets.";
  const canonical = "https://www.ilovesvg.com/logo-to-svg-for-canva";

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
