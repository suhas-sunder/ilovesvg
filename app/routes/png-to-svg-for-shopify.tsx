import type { Route } from "./+types/png-to-svg-for-shopify";
import Template, { action, loader } from "./png-to-svg-for-etsy";

export function meta({}: Route.MetaArgs) {
  const title = "PNG to SVG for Shopify | iLoveSVG";
  const description =
    "Convert transparent PNG logos, icons, and store graphics into SVG assets for Shopify themes, storefront branding, and review before publishing.";
  const canonical = "https://www.ilovesvg.com/png-to-svg-for-shopify";

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
