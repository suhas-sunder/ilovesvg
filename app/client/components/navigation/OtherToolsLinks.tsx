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
 */
export function OtherToolsLinks({
  title = "Other SVG tools",
  subtitle = "Quick links to related SVG converters, editors, and utilities.",
  maxItems = 40,
}: Props) {
  const { pathname } = useLocation();

  const current = React.useMemo(() => {
    return UTILITIES.find((u) => pathname.startsWith(u.to)) ?? null;
  }, [pathname]);

  const items = React.useMemo(() => {
    const base = UTILITIES.filter((u) => {
      if (u.to === "/") return pathname !== "/";
      return !pathname.startsWith(u.to);
    });

    if (!current) return base.slice(0, maxItems);

    const currentKeys = new Set(
      (current.keywords ?? []).concat(current.group).map((s) => s.toLowerCase())
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
 */
export const UTILITIES: UtilityLink[] = [
  {
    id: "svg-to-png",
    title: "SVG to PNG Converter",
    shortTitle: "SVG→PNG",
    description: "Convert SVG files to high-quality PNG images.",
    to: "/svg-to-png-converter",
    group: "Convert",
    keywords: ["svg to png", "convert svg", "raster"],
  },
  {
    id: "svg-to-jpg",
    title: "SVG to JPG Converter",
    shortTitle: "SVG→JPG",
    description: "Export SVG graphics as JPG images for sharing.",
    to: "/svg-to-jpg-converter",
    group: "Convert",
    keywords: ["svg to jpg", "jpeg", "convert"],
  },
  {
    id: "svg-to-webp",
    title: "SVG to WebP Converter",
    shortTitle: "SVG→WebP",
    description: "Convert SVG to WebP for smaller, modern images.",
    to: "/svg-to-webp-converter",
    group: "Convert",
    keywords: ["svg to webp", "image optimization"],
  },
  {
    id: "svg-to-pdf",
    title: "SVG to PDF Converter",
    shortTitle: "SVG→PDF",
    description: "Export SVG files as printable PDF documents.",
    to: "/svg-to-pdf",
    group: "Convert",
    keywords: ["svg to pdf", "vector pdf"],
  },
  {
    id: "svg-resize-scale",
    title: "SVG Resize and Scale Tool",
    shortTitle: "Resize",
    description: "Resize and scale SVG files without distortion.",
    to: "/svg-resize-and-scale-editor",
    group: "Edit",
    keywords: ["resize svg", "scale svg", "viewbox"],
  },
  {
    id: "svg-recolor",
    title: "SVG Recolor Tool",
    shortTitle: "Recolor SVG",
    description: "Change SVG fill and stroke colors easily.",
    to: "/svg-recolor",
    group: "Edit",
    keywords: ["recolor svg", "change svg color"],
  },
  {
    id: "svg-background",
    title: "SVG Background Editor",
    shortTitle: "SVG Background Editor",
    description: "Add or remove backgrounds from SVG files.",
    to: "/svg-background-editor",
    group: "Edit",
    keywords: ["svg background", "transparent svg"],
  },
  {
    id: "svg-stroke-width",
    title: "SVG Stroke Width Adjuster",
    shortTitle: "SVG Stroke Editor",
    description: "Adjust and normalize stroke widths in SVGs.",
    to: "/svg-stroke-width-adjust",
    group: "Edit",
    keywords: ["svg stroke width", "edit svg"],
  },
  {
    id: "svg-flip-rotate",
    title: "SVG Flip and Rotate Tool",
    shortTitle: "Flip and Rotate SVG",
    description: "Flip or rotate SVG graphics safely.",
    to: "/svg-flip-rotate",
    group: "Edit",
    keywords: ["rotate svg", "flip svg"],
  },
  {
    id: "svg-viewer",
    title: "SVG Viewer",
    shortTitle: "SVG Viewer",
    description: "Preview SVG files with zoom and pan.",
    to: "/svg-viewer",
    group: "Inspect",
    keywords: ["svg viewer", "preview svg"],
  },
  {
    id: "svg-dimensions-inspector",
    title: "SVG Dimensions Inspector",
    shortTitle: "SVG Dimensions",
    description: "Inspect SVG width, height, and viewBox.",
    to: "/svg-dimensions-inspector",
    group: "Inspect",
    keywords: ["svg dimensions", "viewbox"],
  },
  {
    id: "svg-size-inspector",
    title: "SVG Size Inspector",
    shortTitle: "SVG Size",
    description: "Analyze SVG paths and bounding boxes.",
    to: "/svg-size-inspector",
    group: "Inspect",
    keywords: ["svg size", "bounding box"],
  },
  {
    id: "svg-embed-code",
    title: "SVG Embed Code Generator",
    shortTitle: "SVG Embed",
    description: "Generate inline SVG and embed code.",
    to: "/svg-embed-code-generator",
    group: "Inspect",
    keywords: ["embed svg", "inline svg"],
  },
  {
    id: "inline-vs-img",
    title: "Inline SVG vs IMG Comparison",
    shortTitle: "Inline SVG vs IMG",
    description: "Compare inline SVG and image tag usage.",
    to: "/inline-svg-vs-img",
    group: "Inspect",
    keywords: ["inline svg", "img tag"],
  },
  {
    id: "svg-minify",
    title: "SVG Minifier",
    shortTitle: "Minify SVG",
    description: "Minify SVG files to reduce file size.",
    to: "/svg-minify",
    group: "Optimize",
    keywords: ["svg minify", "compress svg"],
  },
  {
    id: "svg-cleaner",
    title: "SVG Cleaner",
    shortTitle: "SVG Cleaner",
    description: "Remove metadata and comments from SVGs.",
    to: "/svg-cleaner",
    group: "Optimize",
    keywords: ["svg cleaner", "optimize svg"],
  },
  {
    id: "svg-optimize",
    title: "SVG Optimizer",
    shortTitle: "Optimize SVG",
    description: "Optimize SVG files using SVGO.",
    to: "/svg-optimize",
    group: "Optimize",
    keywords: ["svg optimizer", "svgo"],
  },
  {
    id: "svg-sprite",
    title: "SVG Sprite Generator",
    shortTitle: "SVG Sprite",
    description: "Generate SVG sprites from multiple icons.",
    to: "/svg-sprite-generator",
    group: "Optimize",
    keywords: ["svg sprite", "icon sprite"],
  },
  {
    id: "svg-to-base64",
    title: "SVG to Base64 Encoder",
    shortTitle: "SVG→Base64",
    description: "Encode SVG files as Base64 strings.",
    to: "/svg-to-base64",
    group: "Base64",
    keywords: ["svg base64", "encode svg"],
  },
  {
    id: "base64-to-svg",
    title: "Base64 to SVG Decoder",
    shortTitle: "Base64→SVG",
    description: "Decode Base64 strings back into SVG files.",
    to: "/base64-to-svg",
    group: "Base64",
    keywords: ["base64 to svg", "decode svg"],
  },
  {
    id: "image-to-svg",
    title: "Image to SVG Converter",
    shortTitle: "Image→SVG",
    description: "Convert images to SVG files.",
    to: "/",
    group: "Convert",
    keywords: ["image to svg", "convert image"],
  },
];
