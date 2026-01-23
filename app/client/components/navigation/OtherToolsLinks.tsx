import * as React from "react";
import { Link, useLocation } from "react-router";

type UtilityGroup = "Convert" | "Edit" | "Inspect" | "Optimize" | "Base64";

export type UtilityLink = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  to: string;
  group: UtilityGroup;
  keywords?: string[];
};

type Props = {
  title?: string;
  subtitle?: string;
  maxItems?: number;
};

/**
 * Compact grid of medium tiles.
 * - Readable text sizes (mobile-first)
 * - Good contrast
 * - Clear hover/focus states
 * - No "coming soon"
 * - All tools have real URLs
 *
 * NOTE:
 * Home page ("/") is Image → SVG on your site.
 * Legal pages exist in routes but are intentionally excluded from this list.
 */
export function OtherToolsLinks({
  title = "Other SVG tools",
  subtitle = "Related SVG converters, editors, and utilities you can use right now.",
  maxItems = 24,
}: Props) {
  const { pathname } = useLocation();

  const current = React.useMemo(() => {
    return (
      UTILITIES.find(
        (u) => pathname === u.to || pathname.startsWith(u.to + "/"),
      ) ?? null
    );
  }, [pathname]);

  const items = React.useMemo(() => {
    const base = UTILITIES.filter((u) => {
      if (u.to === "/") return pathname !== "/";
      return !(pathname === u.to || pathname.startsWith(u.to + "/"));
    });

    if (!current) return base.slice(0, maxItems);

    const currentKeys = new Set(
      (current.keywords ?? [])
        .concat(current.group)
        .map((s) => s.toLowerCase()),
    );

    return base
      .map((u) => {
        let score = 0;
        if (u.group === current.group) score += 100;

        const uKeys = (u.keywords ?? [])
          .concat(u.group)
          .map((s) => s.toLowerCase());

        for (const k of uKeys) if (currentKeys.has(k)) score += 5;
        score += affinityBonus(current.group, u.group);

        return { u, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.u)
      .slice(0, maxItems);
  }, [pathname, current, maxItems]);

  return (
    <section
      id="other-tools"
      className="mt-12 border-t border-slate-200 bg-white"
    >
      <div className="max-w-[1180px] mx-auto px-4 py-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="text-sm sm:text-base text-slate-700 max-w-[80ch] leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={[
                "group rounded-2xl border border-slate-200 bg-white p-4",
                "transition",
                "hover:border-slate-300 hover:shadow-sm hover:-translate-y-[1px]",
                "focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2",
              ].join(" ")}
              aria-label={item.title}
              title={item.title}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900 leading-snug truncate">
                    {item.shortTitle}
                  </div>
                  <div className="mt-1 text-sm text-slate-700 leading-relaxed line-clamp-2">
                    {item.description}
                  </div>
                </div>

                <span
                  className={[
                    "shrink-0 inline-flex items-center rounded-full",
                    "px-2.5 py-1 text-xs font-semibold",
                    badgeClass(item.group),
                  ].join(" ")}
                >
                  {item.group}
                </span>
              </div>

              <div className="mt-3 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
                Open tool <span aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function badgeClass(group: UtilityGroup) {
  switch (group) {
    case "Convert":
      return "bg-sky-50 text-sky-800 border border-sky-100";
    case "Edit":
      return "bg-indigo-50 text-indigo-800 border border-indigo-100";
    case "Inspect":
      return "bg-emerald-50 text-emerald-800 border border-emerald-100";
    case "Optimize":
      return "bg-amber-50 text-amber-900 border border-amber-100";
    case "Base64":
      return "bg-slate-50 text-slate-800 border border-slate-200";
    default:
      return "bg-slate-50 text-slate-800 border border-slate-200";
  }
}

function affinityBonus(current: UtilityGroup, candidate: UtilityGroup) {
  const order: UtilityGroup[] = [
    "Convert",
    "Edit",
    "Inspect",
    "Optimize",
    "Base64",
  ];
  const a = order.indexOf(current);
  const b = order.indexOf(candidate);
  if (a < 0 || b < 0) return 0;
  const d = Math.abs(a - b);
  if (d === 0) return 25;
  if (d === 1) return 10;
  if (d === 2) return 3;
  return 0;
}

/**
 * FULL list with real URLs and SEO-friendly descriptions
 * Synced to your routes config:
 * - "/" home is Image → SVG
 * - legal pages intentionally excluded
 */
export const UTILITIES: UtilityLink[] = [
  // Home
  {
    id: "image-to-svg",
    title: "Image to SVG Converter",
    shortTitle: "Image → SVG",
    description:
      "Convert an image into an SVG (vector) for scaling, logos, and clean print output.",
    to: "/",
    group: "Convert",
    keywords: [
      "image to svg",
      "vectorize",
      "png to svg",
      "jpg to svg",
      "jpeg to svg",
      "webp to svg",
    ],
  },

  // SVG -> other formats
  {
    id: "svg-to-png",
    title: "SVG to PNG Converter",
    shortTitle: "SVG → PNG",
    description:
      "Convert SVG to PNG with clean edges and transparent background support.",
    to: "/svg-to-png-converter",
    group: "Convert",
    keywords: ["svg to png", "export png", "transparent png"],
  },
  {
    id: "svg-to-jpg",
    title: "SVG to JPG Converter",
    shortTitle: "SVG → JPG",
    description:
      "Export SVG as JPG/JPEG for sharing, email, and fast previews.",
    to: "/svg-to-jpg-converter",
    group: "Convert",
    keywords: ["svg to jpg", "svg to jpeg", "export jpg"],
  },
  {
    id: "svg-to-webp",
    title: "SVG to WebP Converter",
    shortTitle: "SVG → WebP",
    description:
      "Convert SVG to WebP for smaller files and modern web delivery.",
    to: "/svg-to-webp-converter",
    group: "Convert",
    keywords: ["svg to webp", "convert svg", "image optimization"],
  },
  {
    id: "svg-to-pdf",
    title: "SVG to PDF Converter",
    shortTitle: "SVG → PDF",
    description:
      "Convert SVG to PDF for printing, sharing, and design handoff.",
    to: "/svg-to-pdf-converter",
    group: "Convert",
    keywords: ["svg to pdf", "export pdf", "print svg"],
  },
  {
    id: "svg-to-favicon",
    title: "SVG to Favicon Generator",
    shortTitle: "Favicon Generator",
    description: "Generate favicon.ico and common icon sizes from SVG.",
    to: "/svg-to-favicon-generator",
    group: "Convert",
    keywords: ["favicon generator", "favicon.ico", "ico", "app icons"],
  },

  // Raster -> SVG (format-specific)
  {
    id: "png-to-svg",
    title: "PNG to SVG Converter",
    shortTitle: "PNG → SVG",
    description:
      "Convert PNG images to SVG vectors for scalable logos, icons, and crisp printing.",
    to: "/png-to-svg-converter",
    group: "Convert",
    keywords: ["png to svg", "vectorize png", "transparent png to svg"],
  },
  {
    id: "jpg-to-svg",
    title: "JPG to SVG Converter",
    shortTitle: "JPG → SVG",
    description:
      "Convert JPG images into scalable SVGs for web graphics, posters, and print.",
    to: "/jpg-to-svg-converter",
    group: "Convert",
    keywords: ["jpg to svg", "vectorize jpg", "image to svg"],
  },
  {
    id: "jpeg-to-svg",
    title: "JPEG to SVG Converter",
    shortTitle: "JPEG → SVG",
    description:
      "Convert JPEG images to SVG with clean vector output for resizing without blur.",
    to: "/jpeg-to-svg-converter",
    group: "Convert",
    keywords: ["jpeg to svg", "vectorize jpeg", "photo to svg"],
  },
  {
    id: "webp-to-svg",
    title: "WebP to SVG Converter",
    shortTitle: "WebP → SVG",
    description:
      "Convert WebP images to SVG for scalable assets and consistent rendering across sizes.",
    to: "/webp-to-svg-converter",
    group: "Convert",
    keywords: ["webp to svg", "vectorize webp", "image to svg"],
  },

  // Raster -> SVG (intent-based)
  {
    id: "logo-to-svg",
    title: "Logo to SVG Converter",
    shortTitle: "Logo → SVG",
    description:
      "Turn a logo into a scalable SVG for brand kits, print, and sharp resizing.",
    to: "/logo-to-svg-converter",
    group: "Convert",
    keywords: ["logo to svg", "vector logo", "vectorize logo"],
  },
  {
    id: "icon-to-svg",
    title: "Icon to SVG Converter",
    shortTitle: "Icon → SVG",
    description:
      "Convert icons to SVG for crisp scaling, theming, and consistent UI usage.",
    to: "/icon-to-svg-converter",
    group: "Convert",
    keywords: ["icon to svg", "vector icon", "ui icon svg"],
  },
  {
    id: "emoji-to-svg",
    title: "Emoji to SVG Converter",
    shortTitle: "Emoji → SVG",
    description:
      "Convert emoji-style images to SVG for scalable stickers, icons, and overlays.",
    to: "/emoji-to-svg-converter",
    group: "Convert",
    keywords: ["emoji to svg", "vector emoji", "sticker svg"],
  },
  {
    id: "text-to-svg",
    title: "Text to SVG Converter",
    shortTitle: "Text → SVG",
    description:
      "Convert text into SVG for logos, wordmarks, and scalable typography graphics.",
    to: "/text-to-svg-converter",
    group: "Convert",
    keywords: ["text to svg", "wordmark", "vector text"],
  },
  {
    id: "sticker-to-svg",
    title: "Sticker to SVG Converter",
    shortTitle: "Sticker → SVG",
    description:
      "Convert sticker images to SVG for clean cut lines, scaling, and print-ready output.",
    to: "/sticker-to-svg-converter",
    group: "Convert",
    keywords: ["sticker to svg", "decal svg", "cut file"],
  },
  {
    id: "scan-to-svg",
    title: "Scan to SVG Converter",
    shortTitle: "Scan → SVG",
    description:
      "Convert scanned images to SVG for cleanup, scaling, and crisp document graphics.",
    to: "/scan-to-svg-converter",
    group: "Convert",
    keywords: ["scan to svg", "scanned image to svg", "vectorize scan"],
  },
  {
    id: "drawing-to-svg",
    title: "Drawing to SVG Converter",
    shortTitle: "Drawing → SVG",
    description:
      "Convert a drawing into SVG so it stays sharp at any size for prints and merch.",
    to: "/drawing-to-svg-converter",
    group: "Convert",
    keywords: ["drawing to svg", "hand drawn to svg", "vectorize drawing"],
  },
  {
    id: "sketch-to-svg",
    title: "Sketch to SVG Converter",
    shortTitle: "Sketch → SVG",
    description:
      "Vectorize sketches into SVG for clean scaling, editing, and consistent line output.",
    to: "/sketch-to-svg-converter",
    group: "Convert",
    keywords: ["sketch to svg", "pencil sketch to svg", "vectorize sketch"],
  },
  {
    id: "line-art-to-svg",
    title: "Line Art to SVG Converter",
    shortTitle: "Line Art → SVG",
    description:
      "Convert line art into SVG for crisp outlines, coloring pages, and cut-friendly paths.",
    to: "/line-art-to-svg-converter",
    group: "Convert",
    keywords: ["line art to svg", "outline to svg", "trace line art"],
  },
  {
    id: "photo-to-svg-outline",
    title: "Photo to SVG Outline Converter",
    shortTitle: "Photo → Outline",
    description:
      "Create an outline-style SVG from a photo for posters, stickers, and simplified art.",
    to: "/photo-to-svg-outline",
    group: "Convert",
    keywords: ["photo to svg outline", "outline svg", "trace photo"],
  },
  {
    id: "image-to-svg-outline",
    title: "Image to SVG Outline Converter",
    shortTitle: "Image → Outline",
    description:
      "Generate an outline SVG from an image for clean line art, decals, and cut-ready shapes.",
    to: "/image-to-svg-outline",
    group: "Convert",
    keywords: ["image to svg outline", "outline svg", "line art svg"],
  },
  {
    id: "black-and-white-image-to-svg",
    title: "Black and White Image to SVG Converter",
    shortTitle: "B&W → SVG",
    description:
      "Convert black and white images to SVG with clear edges for stencils, decals, and prints.",
    to: "/black-and-white-image-to-svg-converter",
    group: "Convert",
    keywords: ["black and white to svg", "bw to svg", "stencil svg"],
  },

  // Edit
  {
    id: "svg-background-editor",
    title: "SVG Background Editor",
    shortTitle: "Background Editor",
    description:
      "Add or remove an SVG background rectangle for solid or transparent output.",
    to: "/svg-background-editor",
    group: "Edit",
    keywords: ["svg background", "transparent svg", "remove background"],
  },
  {
    id: "svg-resize-scale",
    title: "SVG Resize and Scale Editor",
    shortTitle: "Resize & Scale",
    description:
      "Resize and scale SVGs safely by updating viewBox and size attributes.",
    to: "/svg-resize-and-scale-editor",
    group: "Edit",
    keywords: ["resize svg", "scale svg", "viewbox", "width height"],
  },
  {
    id: "svg-recolor",
    title: "SVG Recolor Tool",
    shortTitle: "Recolor",
    description:
      "Replace SVG fill and stroke colors quickly, with live preview.",
    to: "/svg-recolor",
    group: "Edit",
    keywords: ["recolor svg", "change svg color", "fill", "stroke"],
  },
  {
    id: "svg-stroke-width-editor",
    title: "SVG Stroke Width Editor",
    shortTitle: "Stroke Width",
    description:
      "Adjust SVG line thickness by editing stroke widths (attribute, style, or CSS).",
    to: "/svg-stroke-width-editor",
    group: "Edit",
    keywords: [
      "svg stroke width",
      "stroke-width",
      "thicken lines",
      "thin lines",
    ],
  },
  {
    id: "svg-flip-rotate-editor",
    title: "SVG Flip and Rotate Editor",
    shortTitle: "Flip & Rotate",
    description:
      "Flip horizontally or vertically, and rotate SVGs without rasterizing.",
    to: "/svg-flip-and-rotate-editor",
    group: "Edit",
    keywords: ["rotate svg", "flip svg", "mirror svg", "transform"],
  },
  {
    id: "free-color-picker",
    title: "Free Color Picker",
    shortTitle: "Color Picker",
    description:
      "Pick colors and extract palettes from SVG, PNG, JPG, or WebP with copy-ready HEX/RGB/HSL.",
    to: "/free-color-picker",
    group: "Edit",
    keywords: [
      "color picker",
      "palette extractor",
      "hex",
      "rgb",
      "hsl",
      "svg color picker",
    ],
  },

  // Inspect
  {
    id: "svg-preview-viewer",
    title: "SVG Preview Viewer",
    shortTitle: "Preview Viewer",
    description:
      "Preview SVGs instantly in the browser to verify rendering and layout.",
    to: "/svg-preview-viewer",
    group: "Inspect",
    keywords: ["svg viewer", "preview svg", "render svg"],
  },
  {
    id: "svg-dimensions-inspector",
    title: "SVG Dimensions Inspector",
    shortTitle: "Dimensions",
    description:
      "Inspect width, height, viewBox, and computed pixel size for an SVG.",
    to: "/svg-dimensions-inspector",
    group: "Inspect",
    keywords: ["svg dimensions", "viewbox", "width height", "pixel size"],
  },
  {
    id: "svg-file-size-inspector",
    title: "SVG File Size Inspector",
    shortTitle: "File Size",
    description:
      "Check SVG file size and see what changes affect KB, so you can ship lighter assets.",
    to: "/svg-file-size-inspector",
    group: "Inspect",
    keywords: ["svg file size", "svg size kb", "optimize size", "bytes"],
  },
  {
    id: "svg-embed-code-generator",
    title: "SVG Embed Code Generator",
    shortTitle: "Embed Code",
    description:
      "Generate embed snippets for inline SVG, img tags, and CSS background usage.",
    to: "/svg-embed-code-generator",
    group: "Inspect",
    keywords: ["embed svg", "inline svg", "svg html", "img tag"],
  },
  {
    id: "inline-svg-vs-img",
    title: "Inline SVG vs IMG",
    shortTitle: "Inline vs IMG",
    description:
      "Compare inline SVG vs img for styling, caching, and performance tradeoffs.",
    to: "/inline-svg-vs-img",
    group: "Inspect",
    keywords: ["inline svg", "img tag", "svg vs img", "svg styling"],
  },
  {
    id: "svg-accessibility-and-contrast-checker",
    title: "SVG Accessibility and Contrast Checker",
    shortTitle: "A11y + Contrast",
    description:
      "Check WCAG contrast, preview color blindness modes, and try higher-contrast options.",
    to: "/svg-accessibility-and-contrast-checker",
    group: "Inspect",
    keywords: [
      "contrast checker",
      "wcag",
      "aa",
      "aaa",
      "color blindness",
      "contrast ratio",
    ],
  },

  // Optimize
  {
    id: "svg-minifier",
    title: "SVG Minifier",
    shortTitle: "Minifier",
    description:
      "Minify SVG markup to reduce file size while preserving appearance.",
    to: "/svg-minifier",
    group: "Optimize",
    keywords: ["svg minify", "compress svg", "reduce size"],
  },
  {
    id: "svg-cleaner",
    title: "SVG Cleaner",
    shortTitle: "Cleaner",
    description:
      "Clean SVG files by removing metadata, comments, and unnecessary attributes.",
    to: "/svg-cleaner",
    group: "Optimize",
    keywords: ["svg cleaner", "clean svg", "remove metadata", "optimize svg"],
  },

  // Base64
  {
    id: "svg-to-base64",
    title: "SVG to Base64 Encoder",
    shortTitle: "SVG → Base64",
    description:
      "Encode SVG as Base64 for embedding in CSS, HTML, or data URLs.",
    to: "/svg-to-base64",
    group: "Base64",
    keywords: ["svg base64", "encode svg", "data url", "base64 svg"],
  },
  {
    id: "base64-to-svg",
    title: "Base64 to SVG Decoder",
    shortTitle: "Base64 → SVG",
    description: "Decode Base64 back into an SVG you can preview and download.",
    to: "/base64-to-svg",
    group: "Base64",
    keywords: ["base64 to svg", "decode svg", "data url", "base64 decoder"],
  },
];
