import type { Route } from "./+types/png-to-ico-converter";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  const title = "PNG to ICO Converter | iLoveSVG";
  const description = "Convert a PNG logo or icon into favicon.ico output and supporting icon sizes with the existing favicon generator.";
  const canonical = "https://www.ilovesvg.com/png-to-ico-converter";

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
