import type { Route } from "./+types/svg-to-ico-converter";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to ICO Converter | iLoveSVG";
  const description = "Create favicon.ico output from an SVG logo or icon using the existing favicon generator and browser-side icon export workflow.";
  const canonical = "https://www.ilovesvg.com/svg-to-ico-converter";

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
