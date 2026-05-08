import type { Route } from "./+types/jpg-to-favicon-generator";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  const title = "JPG to Favicon Generator | iLoveSVG";
  const description = "Create favicon assets from a JPG or JPEG logo image with square padding, background controls, ICO output, and app icon sizes.";
  const canonical = "https://www.ilovesvg.com/jpg-to-favicon-generator";

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
