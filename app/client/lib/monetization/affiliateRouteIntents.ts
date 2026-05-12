export type AffiliateCategory =
  | "stickers"
  | "print-then-cut"
  | "cricut-cut"
  | "silhouette-vinyl"
  | "print-on-demand"
  | "printify-pod"
  | "printful-pod"
  | "shopify-storefront"
  | "canva-design"
  | "figma-design"
  | "ecommerce-selling"
  | "logo-icon"
  | "web-design"
  | "general-svg-conversion"
  | "photo-color-conversion"
  | "line-art-sketch"
  | "layered-svg"
  | "technical-utility"
  | "docs-help";

export const DEFAULT_AFFILIATE_CATEGORIES: AffiliateCategory[] = [
  "general-svg-conversion",
];

export const ROUTE_AFFILIATE_INTENTS: Record<string, AffiliateCategory[]> = {
  "/": [
    "general-svg-conversion",
    "photo-color-conversion",
    "line-art-sketch",
    "logo-icon",
    "ecommerce-selling",
  ],

  "/png-to-svg-converter": [
    "general-svg-conversion",
    "photo-color-conversion",
  ],
  "/jpg-to-svg-converter": [
    "general-svg-conversion",
    "photo-color-conversion",
  ],
  "/jpeg-to-svg-converter": [
    "general-svg-conversion",
    "photo-color-conversion",
  ],
  "/webp-to-svg-converter": [
    "general-svg-conversion",
    "photo-color-conversion",
  ],
  "/logo-to-svg-converter": ["logo-icon", "web-design", "ecommerce-selling"],
  "/icon-to-svg-converter": ["logo-icon", "web-design", "ecommerce-selling"],
  "/sticker-to-svg-converter": ["stickers", "ecommerce-selling"],
  "/line-art-to-svg-converter": [
    "line-art-sketch",
    "general-svg-conversion",
  ],
  "/drawing-to-svg-converter": [
    "line-art-sketch",
    "general-svg-conversion",
  ],
  "/scan-to-svg-converter": ["line-art-sketch", "general-svg-conversion"],
  "/sketch-to-svg-converter": [
    "line-art-sketch",
    "general-svg-conversion",
  ],
  "/image-to-svg-outline": ["line-art-sketch", "general-svg-conversion"],
  "/photo-to-svg-outline": ["photo-color-conversion", "line-art-sketch"],
  "/black-and-white-image-to-svg-converter": [
    "line-art-sketch",
    "general-svg-conversion",
  ],

  "/png-to-svg-for-cricut": ["cricut-cut", "general-svg-conversion"],
  "/jpeg-to-svg-for-cricut": ["cricut-cut", "general-svg-conversion"],
  "/jpg-to-svg-for-cricut": ["cricut-cut", "general-svg-conversion"],
  "/webp-to-svg-for-cricut": ["cricut-cut", "general-svg-conversion"],
  "/image-to-svg-for-cricut": ["cricut-cut", "general-svg-conversion"],
  "/photo-to-svg-for-cricut": ["cricut-cut", "photo-color-conversion"],
  "/logo-to-svg-for-cricut": ["logo-icon", "cricut-cut"],
  "/line-art-to-svg-for-cricut": ["cricut-cut", "line-art-sketch"],
  "/drawing-to-svg-for-cricut": ["cricut-cut", "line-art-sketch"],
  "/sketch-to-svg-for-cricut": ["cricut-cut", "line-art-sketch"],
  "/sticker-to-svg-for-cricut": [
    "stickers",
    "print-then-cut",
    "cricut-cut",
    "ecommerce-selling",
  ],
  "/black-and-white-image-to-svg-for-cricut": [
    "cricut-cut",
    "line-art-sketch",
  ],
  "/cricut-svg-converter": ["cricut-cut", "general-svg-conversion"],
  "/png-to-svg-for-cricut-vinyl": [
    "silhouette-vinyl",
    "cricut-cut",
    "ecommerce-selling",
  ],
  "/png-to-svg-for-cricut-stickers": [
    "stickers",
    "print-then-cut",
    "cricut-cut",
    "ecommerce-selling",
  ],
  "/png-to-svg-for-cricut-print-then-cut": [
    "stickers",
    "print-then-cut",
    "cricut-cut",
    "ecommerce-selling",
  ],
  "/png-to-svg-for-laser-cutting": ["technical-utility", "cricut-cut"],
  "/png-to-svg-for-etsy": [
    "ecommerce-selling",
    "print-on-demand",
    "general-svg-conversion",
  ],
  "/png-to-svg-for-silhouette": [
    "silhouette-vinyl",
    "cricut-cut",
    "ecommerce-selling",
  ],

  "/png-to-layered-svg-for-cricut": ["layered-svg", "cricut-cut"],
  "/layered-svg-for-cricut": ["layered-svg", "cricut-cut"],
  "/image-to-layered-svg-for-cricut": ["layered-svg", "cricut-cut"],
  "/jpg-to-layered-svg-for-cricut": ["layered-svg", "cricut-cut"],
  "/logo-to-layered-svg-for-cricut": [
    "layered-svg",
    "logo-icon",
    "cricut-cut",
  ],

  "/svg-to-png-converter": ["print-on-demand", "general-svg-conversion"],
  "/svg-to-jpg-converter": ["print-on-demand", "general-svg-conversion"],
  "/svg-to-webp-converter": ["print-on-demand", "general-svg-conversion"],
  "/svg-to-pdf-converter": ["technical-utility"],

  "/svg-background-editor": ["technical-utility"],
  "/svg-resize-and-scale-editor": ["technical-utility"],
  "/svg-recolor": ["technical-utility"],
  "/svg-minifier": ["technical-utility"],
  "/svg-cleaner": ["technical-utility"],
  "/svg-preview-viewer": ["technical-utility"],
  "/svg-to-favicon-generator": ["web-design", "logo-icon"],
  "/svg-stroke-width-editor": ["technical-utility"],
  "/svg-flip-and-rotate-editor": ["technical-utility"],
  "/svg-dimensions-inspector": ["technical-utility"],
  "/svg-file-size-inspector": ["technical-utility"],
  "/svg-embed-code-generator": ["web-design"],
  "/svg-accessibility-and-contrast-checker": ["technical-utility"],

  "/text-to-svg-converter": ["technical-utility"],
  "/emoji-to-svg-converter": ["technical-utility"],
  "/code-to-svg-for-cricut": ["cricut-cut", "technical-utility"],
  "/svg-to-base64": ["technical-utility"],
  "/base64-to-svg": ["technical-utility"],
  "/base64-to-svg-for-cricut": ["technical-utility", "cricut-cut"],
  "/inline-svg-vs-img": ["web-design", "docs-help"],
  "/free-color-picker": ["technical-utility"],
  // SEO-safe route expansion intents
  "/gif-to-svg-converter": ["photo-color-conversion", "general-svg-conversion"],
  "/avif-to-svg-converter": ["photo-color-conversion", "general-svg-conversion"],
  "/bmp-to-svg-converter": ["line-art-sketch", "general-svg-conversion"],
  "/tiff-to-svg-converter": ["line-art-sketch", "general-svg-conversion"],
  "/svg-to-ico-converter": ["web-design", "logo-icon"],
  "/image-to-favicon-generator": ["web-design", "logo-icon"],
  "/png-to-favicon-generator": ["web-design", "logo-icon"],
  "/jpg-to-favicon-generator": ["web-design", "logo-icon"],
  "/logo-to-favicon-generator": ["web-design", "logo-icon"],
  "/png-to-ico-converter": ["web-design", "logo-icon"],
  "/png-to-svg-for-shopify": ["shopify-storefront"],
  "/logo-to-svg-for-shopify": ["shopify-storefront"],
  "/svg-to-png-for-shopify": ["shopify-storefront"],
  "/svg-to-favicon-for-shopify": ["shopify-storefront"],
  "/svg-resizer-for-shopify": ["shopify-storefront"],
  "/logo-to-favicon-for-shopify": ["shopify-storefront"],
  "/svg-to-png-for-etsy": ["ecommerce-selling", "print-on-demand"],
  "/svg-to-jpg-for-etsy": ["ecommerce-selling"],
  "/logo-to-svg-for-etsy": ["ecommerce-selling", "logo-icon"],
  "/sticker-to-svg-for-etsy": ["stickers", "ecommerce-selling", "print-on-demand"],
  "/image-to-svg-for-etsy": ["ecommerce-selling", "print-on-demand", "general-svg-conversion"],
  "/jpg-to-svg-for-etsy": ["ecommerce-selling", "general-svg-conversion"],
  "/svg-resizer-for-etsy": ["ecommerce-selling"],
  "/svg-to-png-for-printify": [
    "printify-pod",
    "print-on-demand",
    "ecommerce-selling",
  ],
  "/svg-to-png-for-printful": ["printful-pod"],
  "/sticker-to-png-for-printing": ["stickers", "print-on-demand"],
  "/svg-to-transparent-png-for-printing": ["stickers", "print-on-demand"],
  "/png-to-svg-for-glowforge": ["technical-utility"],
  "/jpg-to-svg-for-glowforge": ["technical-utility"],
  "/logo-to-svg-for-glowforge": ["technical-utility"],
  "/svg-cleaner-for-glowforge": ["technical-utility"],
  "/svg-resizer-for-glowforge": ["technical-utility"],
  "/image-to-svg-for-glowforge": ["technical-utility"],
  "/jpg-to-svg-for-silhouette": ["technical-utility"],
  "/image-to-svg-for-silhouette": ["technical-utility"],
  "/logo-to-svg-for-silhouette": ["technical-utility"],
  "/sticker-to-svg-for-silhouette": ["technical-utility"],
  "/svg-cleaner-for-silhouette": ["technical-utility"],
  "/svg-resizer-for-silhouette": ["technical-utility"],
  "/png-to-svg-for-canva": ["canva-design"],
  "/jpg-to-svg-for-canva": ["canva-design"],
  "/svg-to-png-for-canva": ["canva-design"],
  "/logo-to-svg-for-canva": ["canva-design"],
  "/svg-resizer-for-canva": ["canva-design"],
  "/svg-cleaner-for-figma": ["figma-design"],
  "/svg-resizer-for-figma": ["figma-design"],
  "/svg-to-png-for-figma": ["figma-design"],
  "/png-to-svg-for-figma": ["figma-design"],
  "/svg-to-jsx-converter": ["technical-utility"],
  "/image-to-layered-svg-converter": ["layered-svg", "general-svg-conversion"],
  "/jpg-to-layered-svg-converter": ["layered-svg", "general-svg-conversion"],
  "/logo-to-layered-svg-converter": ["layered-svg", "logo-icon"],
  "/transparent-png-to-svg-converter": [
    "photo-color-conversion",
    "print-on-demand",
  ],
  "/tif-to-svg-converter": ["technical-utility"],
  "/image-to-svg-converter": ["general-svg-conversion"],
  "/black-and-white-png-to-svg-converter": ["technical-utility"],
  "/svg-transparent-background-tool": ["technical-utility"],
  "/svg-to-react-component": ["technical-utility"],
  "/svg-to-css-background": ["technical-utility"],
  "/svg-to-data-uri-converter": ["technical-utility"],
  "/svg-inline-code-generator": ["technical-utility"],
  "/svg-viewbox-editor": ["technical-utility"],
  "/svg-code-cleaner": ["technical-utility"],

  "/how-it-works": ["docs-help"],
  "/how-it-works/conversion-workflow": ["docs-help"],
  "/how-it-works/presets": ["docs-help"],
  "/how-it-works/settings": ["docs-help"],
  "/how-it-works/troubleshooting": ["docs-help"],
  "/how-it-works/exporting-and-downloads": ["docs-help"],
  "/cookies": ["docs-help"],
  "/privacy-policy": ["docs-help"],
  "/terms-of-service": ["docs-help"],
  "/sitemap": ["docs-help"],
};

export function normalizeAffiliatePathname(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

export function getAffiliateRouteCategories(pathname: string) {
  const normalized = normalizeAffiliatePathname(pathname);
  return ROUTE_AFFILIATE_INTENTS[normalized] ?? DEFAULT_AFFILIATE_CATEGORIES;
}
