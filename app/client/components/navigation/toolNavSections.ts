export type ToolNavItem = {
  label: string;
  href: string;
  keywords?: string[];
};

export type ToolNavSection = {
  id: string;
  label: string;
  description: string;
  items: ToolNavItem[];
};

export const PRIMARY_NAV_ITEMS: ToolNavItem[] = [
  {
    label: "All Tools",
    href: "#other-tools",
    keywords: ["all tools", "tools", "navigation", "browse tools"],
  },
  {
    label: "Image to SVG",
    href: "/",
    keywords: ["image to svg", "svg converter", "vectorize"],
  },
  {
    label: "PNG to SVG",
    href: "/png-to-svg-converter",
    keywords: ["png to svg", "vectorize png"],
  },
  {
    label: "SVG to PNG",
    href: "/svg-to-png-converter",
    keywords: ["svg to png", "export png"],
  },
];

export const TOOL_NAV_SECTIONS: ToolNavSection[] = [
  {
    id: "most-popular",
    label: "Most Popular",
    description: "The highest-demand conversion and export tools.",
    items: [
      {
        label: "PNG to SVG",
        href: "/png-to-svg-converter",
        keywords: ["png to svg", "vectorize png"],
      },
      {
        label: "SVG to PNG",
        href: "/svg-to-png-converter",
        keywords: ["svg to png", "export png", "transparent png"],
      },
      {
        label: "JPG to SVG",
        href: "/jpg-to-svg-converter",
        keywords: ["jpg to svg", "jpeg", "photo"],
      },
      {
        label: "JPEG to SVG",
        href: "/jpeg-to-svg-converter",
        keywords: ["jpeg to svg", "jpg", "photo"],
      },
      {
        label: "SVG to PDF",
        href: "/svg-to-pdf-converter",
        keywords: ["svg to pdf", "print", "document"],
      },
      {
        label: "SVG to JPG",
        href: "/svg-to-jpg-converter",
        keywords: ["svg to jpg", "svg to jpeg", "export jpg"],
      },
      {
        label: "Image to SVG",
        href: "/",
        keywords: ["image to svg", "svg converter", "vectorize"],
      },
      {
        label: "SVG to Favicon",
        href: "/svg-to-favicon-generator",
        keywords: ["favicon", "ico", "app icon"],
      },
    ],
  },
  {
    id: "image-to-svg",
    label: "Image to SVG",
    description: "Raster, logo, icon, outline, and scan tracing routes.",
    items: [
      { label: "WebP to SVG", href: "/webp-to-svg-converter" },
      { label: "Logo to SVG", href: "/logo-to-svg-converter" },
      { label: "Icon to SVG", href: "/icon-to-svg-converter" },
      { label: "Emoji to SVG", href: "/emoji-to-svg-converter" },
      { label: "Line Art to SVG", href: "/line-art-to-svg-converter" },
      { label: "Drawing to SVG", href: "/drawing-to-svg-converter" },
      { label: "Sketch to SVG", href: "/sketch-to-svg-converter" },
      { label: "Scan to SVG", href: "/scan-to-svg-converter" },
      { label: "Photo Outline", href: "/photo-to-svg-outline" },
      { label: "Image Outline", href: "/image-to-svg-outline" },
      {
        label: "Black and White to SVG",
        href: "/black-and-white-image-to-svg-converter",
        keywords: ["black and white", "b&w", "monochrome", "stencil"],
      },
      { label: "Transparent PNG to SVG", href: "/transparent-png-to-svg-converter" },
      { label: "Sticker to SVG", href: "/sticker-to-svg-converter" },
      { label: "GIF to SVG", href: "/gif-to-svg-converter" },
      { label: "AVIF to SVG", href: "/avif-to-svg-converter" },
      { label: "BMP to SVG", href: "/bmp-to-svg-converter" },
      { label: "TIFF to SVG", href: "/tiff-to-svg-converter", keywords: ["tif to svg"] },
    ],
  },
  {
    id: "craft-cut-files",
    label: "Craft & Cut Files",
    description: "Cricut, Silhouette, Glowforge, vinyl, stickers, and layered files.",
    items: [
      { label: "Cricut SVG Converter", href: "/cricut-svg-converter" },
      { label: "Image to SVG for Cricut", href: "/image-to-svg-for-cricut" },
      { label: "PNG to SVG for Cricut", href: "/png-to-svg-for-cricut" },
      { label: "JPG to SVG for Cricut", href: "/jpg-to-svg-for-cricut" },
      { label: "JPEG to SVG for Cricut", href: "/jpeg-to-svg-for-cricut" },
      { label: "WebP to SVG for Cricut", href: "/webp-to-svg-for-cricut" },
      { label: "Photo to SVG for Cricut", href: "/photo-to-svg-for-cricut" },
      {
        label: "B&W Image to SVG for Cricut",
        href: "/black-and-white-image-to-svg-for-cricut",
        keywords: ["black and white", "b&w", "monochrome"],
      },
      { label: "Line Art to SVG for Cricut", href: "/line-art-to-svg-for-cricut" },
      { label: "Drawing to SVG for Cricut", href: "/drawing-to-svg-for-cricut" },
      { label: "Sketch to SVG for Cricut", href: "/sketch-to-svg-for-cricut" },
      { label: "Logo to SVG for Cricut", href: "/logo-to-svg-for-cricut" },
      { label: "Sticker to SVG for Cricut", href: "/sticker-to-svg-for-cricut" },
      { label: "Layered SVG for Cricut", href: "/layered-svg-for-cricut" },
      { label: "Image to Layered SVG for Cricut", href: "/image-to-layered-svg-for-cricut" },
      { label: "PNG to Layered SVG for Cricut", href: "/png-to-layered-svg-for-cricut" },
      { label: "JPG to Layered SVG for Cricut", href: "/jpg-to-layered-svg-for-cricut" },
      { label: "Logo to Layered SVG for Cricut", href: "/logo-to-layered-svg-for-cricut" },
      {
        label: "Print Then Cut",
        href: "/png-to-svg-for-cricut-print-then-cut",
        keywords: ["print then cut", "stickers", "labels"],
      },
      { label: "Cricut Stickers", href: "/png-to-svg-for-cricut-stickers" },
      { label: "Cricut Vinyl", href: "/png-to-svg-for-cricut-vinyl" },
      { label: "PNG to SVG for Silhouette", href: "/png-to-svg-for-silhouette" },
      { label: "JPG to SVG for Silhouette", href: "/jpg-to-svg-for-silhouette" },
      { label: "Image to SVG for Silhouette", href: "/image-to-svg-for-silhouette" },
      { label: "Logo to SVG for Silhouette", href: "/logo-to-svg-for-silhouette" },
      { label: "Sticker to SVG for Silhouette", href: "/sticker-to-svg-for-silhouette" },
      { label: "PNG to SVG for Laser Cutting", href: "/png-to-svg-for-laser-cutting" },
      { label: "PNG to SVG for Glowforge", href: "/png-to-svg-for-glowforge" },
      { label: "JPG to SVG for Glowforge", href: "/jpg-to-svg-for-glowforge" },
      { label: "Image to SVG for Glowforge", href: "/image-to-svg-for-glowforge" },
      { label: "Logo to SVG for Glowforge", href: "/logo-to-svg-for-glowforge" },
      { label: "Sticker to SVG for Etsy", href: "/sticker-to-svg-for-etsy" },
    ],
  },
  {
    id: "svg-export",
    label: "SVG Export",
    description: "Raster, icon, favicon, PDF, print, and marketplace exports.",
    items: [
      { label: "SVG to WebP", href: "/svg-to-webp-converter" },
      { label: "SVG to ICO", href: "/svg-to-ico-converter" },
      { label: "Image to Favicon", href: "/image-to-favicon-generator" },
      { label: "PNG to Favicon", href: "/png-to-favicon-generator" },
      { label: "JPG to Favicon", href: "/jpg-to-favicon-generator" },
      { label: "Logo to Favicon", href: "/logo-to-favicon-generator" },
      { label: "PNG to ICO", href: "/png-to-ico-converter" },
      { label: "SVG to Transparent PNG", href: "/svg-to-transparent-png-for-printing" },
      { label: "Sticker SVG to PNG", href: "/sticker-to-png-for-printing" },
      { label: "SVG to PNG for Etsy", href: "/svg-to-png-for-etsy" },
      { label: "SVG to JPG for Etsy", href: "/svg-to-jpg-for-etsy" },
      { label: "SVG to PNG for Shopify", href: "/svg-to-png-for-shopify" },
      { label: "SVG to Favicon for Shopify", href: "/svg-to-favicon-for-shopify" },
      { label: "Logo to Favicon for Shopify", href: "/logo-to-favicon-for-shopify" },
      { label: "SVG to PNG for Printify", href: "/svg-to-png-for-printify" },
      { label: "SVG to PNG for Printful", href: "/svg-to-png-for-printful" },
      { label: "SVG to PNG for Canva", href: "/svg-to-png-for-canva" },
      { label: "SVG to PNG for Figma", href: "/svg-to-png-for-figma" },
    ],
  },
  {
    id: "svg-editing",
    label: "SVG Editing",
    description: "Resize, recolor, clean, inspect, preview, and repair SVG files.",
    items: [
      { label: "SVG Background Editor", href: "/svg-background-editor" },
      { label: "Resize SVG", href: "/svg-resize-and-scale-editor" },
      { label: "SVG Recolor", href: "/svg-recolor" },
      { label: "Stroke Width", href: "/svg-stroke-width-editor" },
      { label: "Flip / Rotate", href: "/svg-flip-and-rotate-editor" },
      { label: "SVG Minifier", href: "/svg-minifier" },
      { label: "SVG Cleaner", href: "/svg-cleaner" },
      { label: "SVG Preview Viewer", href: "/svg-preview-viewer" },
      { label: "SVG Dimensions Inspector", href: "/svg-dimensions-inspector" },
      { label: "SVG File Size Inspector", href: "/svg-file-size-inspector" },
      { label: "SVG Accessibility & Contrast", href: "/svg-accessibility-and-contrast-checker" },
      { label: "SVG Cleaner for Figma", href: "/svg-cleaner-for-figma" },
      { label: "SVG Cleaner for Glowforge", href: "/svg-cleaner-for-glowforge" },
      { label: "SVG Cleaner for Silhouette", href: "/svg-cleaner-for-silhouette" },
      { label: "SVG Resizer for Canva", href: "/svg-resizer-for-canva" },
      { label: "SVG Resizer for Etsy", href: "/svg-resizer-for-etsy" },
      { label: "SVG Resizer for Figma", href: "/svg-resizer-for-figma" },
      { label: "SVG Resizer for Glowforge", href: "/svg-resizer-for-glowforge" },
      { label: "SVG Resizer for Shopify", href: "/svg-resizer-for-shopify" },
      { label: "SVG Resizer for Silhouette", href: "/svg-resizer-for-silhouette" },
    ],
  },
  {
    id: "marketplace-design",
    label: "Marketplace & Design",
    description: "Seller, ecommerce, POD, Canva, Figma, and platform-specific SVG routes.",
    items: [
      { label: "PNG to SVG for Etsy", href: "/png-to-svg-for-etsy" },
      { label: "Image to SVG for Etsy", href: "/image-to-svg-for-etsy" },
      { label: "JPG to SVG for Etsy", href: "/jpg-to-svg-for-etsy" },
      { label: "Logo to SVG for Etsy", href: "/logo-to-svg-for-etsy" },
      { label: "PNG to SVG for Shopify", href: "/png-to-svg-for-shopify" },
      { label: "Logo to SVG for Shopify", href: "/logo-to-svg-for-shopify" },
      { label: "PNG to SVG for Canva", href: "/png-to-svg-for-canva" },
      { label: "JPG to SVG for Canva", href: "/jpg-to-svg-for-canva" },
      { label: "Logo to SVG for Canva", href: "/logo-to-svg-for-canva" },
      { label: "PNG to SVG for Figma", href: "/png-to-svg-for-figma" },
    ],
  },
  {
    id: "developer-code",
    label: "Developer & Code",
    description: "Base64, JSX, text, code, embed, and preview-oriented utilities.",
    items: [
      { label: "SVG to Base64", href: "/svg-to-base64", keywords: ["data uri", "data url"] },
      { label: "Base64 to SVG", href: "/base64-to-svg" },
      { label: "Base64 to SVG for Cricut", href: "/base64-to-svg-for-cricut" },
      { label: "Text to SVG", href: "/text-to-svg-converter" },
      { label: "Code to SVG for Cricut", href: "/code-to-svg-for-cricut" },
      { label: "SVG to JSX", href: "/svg-to-jsx-converter", keywords: ["react component"] },
      { label: "SVG Embed Code", href: "/svg-embed-code-generator" },
      { label: "Inline SVG vs Img", href: "/inline-svg-vs-img" },
      { label: "Color Picker", href: "/free-color-picker" },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    description: "Workflow, preset, settings, export, and troubleshooting guides.",
    items: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Conversion Workflow", href: "/how-it-works/conversion-workflow" },
      { label: "Presets", href: "/how-it-works/presets" },
      { label: "Settings", href: "/how-it-works/settings" },
      { label: "Exporting and Downloads", href: "/how-it-works/exporting-and-downloads" },
      { label: "Troubleshooting", href: "/how-it-works/troubleshooting" },
      { label: "All Tools", href: "#other-tools" },
    ],
  },
];

export const TOOL_NAV_ITEMS: ToolNavItem[] = TOOL_NAV_SECTIONS.flatMap(
  (section) => section.items,
);
