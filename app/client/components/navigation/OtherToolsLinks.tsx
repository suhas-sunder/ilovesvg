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
 * Compact grid of small tiles.
 * - 4-column layout
 * - No "coming soon"
 * - All tools have real URLs
 * - SEO-friendly descriptions
 *
 * NOTE:
 * Home page ("/") is Image → SVG on your site.
 * Legal pages exist in routes but are intentionally excluded from this list.
 */
export function OtherToolsLinks({
  title = "Other SVG tools",
  subtitle = "Quick links to related SVG converters, editors, and utilities.",
  maxItems = 40,
}: Props) {
  const { pathname } = useLocation();

  const current = React.useMemo(() => {
    return (
      UTILITIES.find(
        (u) => pathname === u.to || pathname.startsWith(u.to + "/")
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
        .map((s) => s.toLowerCase())
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
      className="mt-10 border-t border-slate-200 bg-white"
    >
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-600 max-w-[90ch]">{subtitle}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="h-20 rounded-xl border border-slate-200 bg-white p-2 transition hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label={item.title}
              title={item.title}
            >
              <div className="text-[11px] font-semibold text-slate-900 leading-snug line-clamp-1">
                {item.shortTitle}
              </div>
              <div className="mt-1 text-[11px] text-slate-600 leading-snug line-clamp-2">
                {item.description}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {item.group}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
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
 * - converters/editors/inspectors/optimizers/base64 included
 * - legal pages intentionally excluded
 */
export const UTILITIES: UtilityLink[] = [
  // Home (Convert)
  {
    id: "image-to-svg",
    title: "Image to SVG Converter",
    shortTitle: "Image→SVG",
    description: "Convert an image into an SVG (vector) for scaling, logos, and clean print output.",
    to: "/",
    group: "Convert",
    keywords: ["image to svg", "convert image", "vectorize", "png to svg", "jpg to svg"],
  },

  // Convert
  {
    id: "svg-to-png",
    title: "SVG to PNG Converter",
    shortTitle: "SVG→PNG",
    description:
      "Convert SVG to PNG with clean edges and transparent background support.",
    to: "/svg-to-png-converter",
    group: "Convert",
    keywords: ["svg to png", "convert svg", "raster", "export png"],
  },
  {
    id: "svg-to-jpg",
    title: "SVG to JPG Converter",
    shortTitle: "SVG→JPG",
    description:
      "Export SVG as JPG/JPEG for sharing, email, and fast previews.",
    to: "/svg-to-jpg-converter",
    group: "Convert",
    keywords: ["svg to jpg", "svg to jpeg", "convert", "export jpg"],
  },
  {
    id: "svg-to-webp",
    title: "SVG to WebP Converter",
    shortTitle: "SVG→WebP",
    description: "Convert SVG to WebP for smaller files and modern web delivery.",
    to: "/svg-to-webp-converter",
    group: "Convert",
    keywords: ["svg to webp", "webp", "image optimization", "convert svg"],
  },
  {
    id: "svg-to-pdf",
    title: "SVG to PDF Converter",
    shortTitle: "SVG→PDF",
    description: "Convert SVG to PDF for printing, sharing, and design handoff.",
    to: "/svg-to-pdf-converter",
    group: "Convert",
    keywords: ["svg to pdf", "vector pdf", "print svg", "export pdf"],
  },
  {
    id: "svg-to-favicon",
    title: "Favicon Generator (ICO) + App Icon Generator",
    shortTitle: "Favicon + App",
    description: "Generate favicon.ico and app icon sizes from SVG/PNG/JPG/WEBP.",
    to: "/svg-to-favicon-generator",
    group: "Convert",
    keywords: ["favicon generator", "favicon.ico", "app icons", "ico", "pwa icons"],
  },

  // Edit
  {
    id: "svg-background-editor",
    title: "SVG Background Editor",
    shortTitle: "Background",
    description:
      "Add or remove an SVG background rectangle for solid or transparent output.",
    to: "/svg-background-editor",
    group: "Edit",
    keywords: ["svg background", "transparent svg", "remove background", "add background"],
  },
  {
    id: "svg-resize-scale",
    title: "SVG Resize and Scale Editor",
    shortTitle: "Resize/Scale",
    description: "Resize and scale SVGs safely by updating viewBox and size attributes.",
    to: "/svg-resize-and-scale-editor",
    group: "Edit",
    keywords: ["resize svg", "scale svg", "viewbox", "width height"],
  },
  {
    id: "svg-recolor",
    title: "SVG Recolor Tool",
    shortTitle: "Recolor",
    description: "Replace SVG fill and stroke colors quickly, with live preview.",
    to: "/svg-recolor",
    group: "Edit",
    keywords: ["recolor svg", "change svg color", "fill", "stroke"],
  },
  {
    id: "svg-stroke-width-editor",
    title: "SVG Stroke Width Editor",
    shortTitle: "Stroke Width",
    description:
      "Make SVG lines thicker or thinner by adjusting stroke widths (attribute/style/CSS).",
    to: "/svg-stroke-width-editor",
    group: "Edit",
    keywords: ["svg stroke width", "stroke-width", "thicken lines", "thin lines"],
  },
  {
    id: "svg-flip-rotate-editor",
    title: "SVG Flip and Rotate Editor",
    shortTitle: "Flip/Rotate",
    description: "Flip horizontally/vertically and rotate SVGs without rasterizing.",
    to: "/svg-flip-and-rotate-editor",
    group: "Edit",
    keywords: ["rotate svg", "flip svg", "mirror svg", "transform"],
  },

  // Inspect
  {
    id: "svg-preview-viewer",
    title: "SVG Preview Viewer",
    shortTitle: "Preview",
    description: "Preview SVGs instantly in the browser to verify rendering and layout.",
    to: "/svg-preview-viewer",
    group: "Inspect",
    keywords: ["svg viewer", "preview svg", "view svg", "render svg"],
  },
  {
    id: "svg-dimensions-inspector",
    title: "SVG Dimensions Inspector",
    shortTitle: "Dimensions",
    description: "Inspect width, height, viewBox, and computed pixel size for an SVG.",
    to: "/svg-dimensions-inspector",
    group: "Inspect",
    keywords: ["svg dimensions", "viewbox", "width height", "pixel size"],
  },
  {
    id: "svg-size-inspector",
    title: "SVG Size Inspector",
    shortTitle: "Size",
    description: "Inspect artwork bounds and sizing behavior to prevent clipping and scaling issues.",
    to: "/svg-size-inspector",
    group: "Inspect",
    keywords: ["svg size", "bounds", "bounding box", "clip", "scale"],
  },
  {
    id: "svg-embed-code-generator",
    title: "SVG Embed Code Generator",
    shortTitle: "Embed Code",
    description: "Generate embed snippets for inline SVG, <img>, and CSS background usage.",
    to: "/svg-embed-code-generator",
    group: "Inspect",
    keywords: ["embed svg", "inline svg", "svg html", "img tag"],
  },
  {
    id: "inline-svg-vs-img",
    title: "Inline SVG vs IMG",
    shortTitle: "Inline vs IMG",
    description: "Compare inline SVG vs <img> for styling, caching, and performance.",
    to: "/inline-svg-vs-img",
    group: "Inspect",
    keywords: ["inline svg", "img tag", "svg vs img", "svg styling"],
  },

  // Optimize
  {
    id: "svg-minifier",
    title: "SVG Minifier",
    shortTitle: "Minify",
    description: "Minify SVG markup to reduce file size while preserving appearance.",
    to: "/svg-minifier",
    group: "Optimize",
    keywords: ["svg minify", "minify svg", "compress svg", "reduce size"],
  },
  {
    id: "svg-cleaner",
    title: "SVG Cleaner",
    shortTitle: "Cleaner",
    description: "Clean SVG files by removing metadata, comments, and unnecessary attributes.",
    to: "/svg-cleaner",
    group: "Optimize",
    keywords: ["svg cleaner", "clean svg", "optimize svg", "remove metadata"],
  },

  // Base64
  {
    id: "svg-to-base64",
    title: "SVG to Base64 Encoder",
    shortTitle: "SVG→Base64",
    description: "Encode SVG as Base64 for embedding in CSS, HTML, or data URLs.",
    to: "/svg-to-base64",
    group: "Base64",
    keywords: ["svg base64", "encode svg", "data url", "base64 svg"],
  },
  {
    id: "base64-to-svg",
    title: "Base64 to SVG Decoder",
    shortTitle: "Base64→SVG",
    description: "Decode Base64 back into an SVG file you can preview and download.",
    to: "/base64-to-svg",
    group: "Base64",
    keywords: ["base64 to svg", "decode svg", "data url", "base64 decoder"],
  },
];
