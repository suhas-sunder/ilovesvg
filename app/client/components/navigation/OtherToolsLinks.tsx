import * as React from "react";
import { Link, useLocation } from "react-router";
import { AdSenseDelayed } from "../ads/AdsenseDelayed";

type UtilityGroup =
  | "SVG to image/PDF"
  | "Image to SVG"
  | "Cricut & cutting"
  | "Edit SVG"
  | "Inspect SVG"
  | "Optimize SVG"
  | "Base64"
  | "Color";

export type UtilityLink = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  to: string;
  group: UtilityGroup;
  keywords?: string[];
};

type UtilitySection = {
  id: string;
  title: string;
  description: string;
  groups: UtilityGroup[];
};

type RouteGuide = {
  eyebrow: string;
  heading: string;
  intro: string;
  bestFor: string[];
  settings: string[];
  limitations: string[];
  related: Array<{
    to: string;
    label: string;
    reason: string;
  }>;
};

type Props = {
  title?: string;
  subtitle?: string;
};

/**
 * Full site navigation for all public SVG tools.
 * - Shows every non-legal route
 * - Organized by practical user intent
 * - Preserves compact card layout
 * - Highlights the current page instead of hiding it
 *
 * NOTE:
 * Home page ("/") is Image → SVG on your site.
 * Legal pages exist in routes but are intentionally excluded from this list.
 */
export function OtherToolsLinks({
  title = "All SVG tools",
  subtitle = "Browse every SVG converter, editor, inspector, optimizer, and craft-file utility available on iLoveSVG.",
}: Props) {
  const { pathname } = useLocation();

  const normalizedPathname = normalizePath(pathname);
  const routeGuide = React.useMemo(
    () => getRouteGuide(normalizedPathname),
    [normalizedPathname],
  );

  const sections = React.useMemo(() => {
    return UTILITY_SECTIONS.map((section) => {
      const items = UTILITIES.filter((item) =>
        section.groups.includes(item.group),
      );

      return {
        ...section,
        items,
      };
    }).filter((section) => section.items.length > 0);
  }, []);

  return (
    <section
      id="other-tools"
      className="mt-12 border-t border-slate-200 bg-white"
    >
      <div className="max-w-[1180px] mx-auto px-4 py-10">
        {routeGuide ? <RouteIntentGuide guide={routeGuide} /> : null}

        <div className={routeGuide ? "mt-10 flex flex-col gap-2" : "flex flex-col gap-2"}>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-sky-800">
            {title}
          </h2>
          <p className="text-sm sm:text-base font-semibold text-slate-700 max-w-[80ch] leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="py-6">
          <div className="mx-auto w-full max-w-[970px] min-h-[120px] overflow-hidden flex items-center justify-center">
            <AdSenseDelayed
              slot="8102088582"
              delayMs={1500}
              minHeight={120}
              maxHeight={120}
              format="horizontal"
              fullWidth={true}
              className="mx-auto w-full max-w-[970px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-10">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-sky-800">
                  {section.title}
                </h3>
                <p className="text-sm text-slate-700 max-w-[80ch] leading-relaxed">
                  {section.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {section.items.map((item) => {
                  const isCurrent =
                    normalizedPathname === normalizePath(item.to);

                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      className={[
                        "group cursor-pointer rounded-2xl border bg-white p-4",
                        "transition",
                        "hover:border-slate-300 hover:shadow-sm hover:-translate-y-[1px]",
                        "focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2",
                        isCurrent
                          ? "border-sky-300 ring-1 ring-sky-200"
                          : "border-slate-200",
                      ].join(" ")}
                      aria-label={item.title}
                      aria-current={isCurrent ? "page" : undefined}
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
                          {shortBadge(item.group)}
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
                        {isCurrent ? "Current tool" : "Open tool"}{" "}
                        <span aria-hidden>{isCurrent ? "✓" : "→"}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RouteIntentGuide({ guide }: { guide: RouteGuide }) {
  return (
    <section
      aria-labelledby="current-tool-guide-heading"
      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-6"
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
        {guide.eyebrow}
      </p>
      <h2
        id="current-tool-guide-heading"
        className="mt-2 max-w-[920px] text-2xl font-extrabold tracking-tight text-sky-950 sm:text-3xl"
      >
        {guide.heading}
      </h2>
      <p className="mt-3 max-w-[88ch] text-[15px] leading-7 text-slate-700">
        {guide.intro}
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <GuideList title="Best for" items={guide.bestFor} />
        <GuideList title="Settings to try" items={guide.settings} />
        <GuideList title="Useful limits" items={guide.limitations} />
      </div>

      {guide.related.length ? (
        <div className="mt-5 rounded-xl border border-white bg-white/80 p-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-600">
            Related tools
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guide.related.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition hover:border-sky-200 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2"
              >
                <span className="block text-sm font-extrabold text-slate-900 group-hover:text-sky-900">
                  {link.label}
                </span>
                <span className="mt-1 block text-[13px] leading-5 text-slate-600">
                  {link.reason}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white bg-white/80 p-4">
      <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
      <ul className="mt-2 space-y-2 text-[13px] leading-5 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function shortBadge(group: UtilityGroup) {
  switch (group) {
    case "SVG to image/PDF":
      return "Export";
    case "Image to SVG":
      return "Convert";
    case "Cricut & cutting":
      return "Craft";
    case "Edit SVG":
      return "Edit";
    case "Inspect SVG":
      return "Inspect";
    case "Optimize SVG":
      return "Optimize";
    case "Base64":
      return "Base64";
    case "Color":
      return "Color";
    default:
      return "Tool";
  }
}

function badgeClass(group: UtilityGroup) {
  switch (group) {
    case "SVG to image/PDF":
      return "bg-sky-50 text-sky-800 border border-sky-100";
    case "Image to SVG":
      return "bg-blue-50 text-blue-800 border border-blue-100";
    case "Cricut & cutting":
      return "bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-100";
    case "Edit SVG":
      return "bg-indigo-50 text-indigo-800 border border-indigo-100";
    case "Inspect SVG":
      return "bg-emerald-50 text-emerald-800 border border-emerald-100";
    case "Optimize SVG":
      return "bg-amber-50 text-amber-900 border border-amber-100";
    case "Base64":
      return "bg-slate-50 text-slate-800 border border-slate-200";
    case "Color":
      return "bg-rose-50 text-rose-800 border border-rose-100";
    default:
      return "bg-slate-50 text-slate-800 border border-slate-200";
  }
}

function getRouteGuide(pathname: string): RouteGuide | null {
  const exactGuide = ROUTE_GUIDES[pathname];
  if (exactGuide) return exactGuide;

  const utility = UTILITIES.find((item) => normalizePath(item.to) === pathname);
  if (!utility) return null;

  const groupDefaults = fallbackGuideByGroup(utility.group);

  return {
    eyebrow: `${shortBadge(utility.group)} workflow`,
    heading: `${utility.title}: practical workflow notes`,
    intro: `${utility.description} Use this page when that specific output is the fastest path, then jump to the related tools below if you need a different export, cleanup, or craft-file workflow.`,
    bestFor: [
      utility.keywords?.[0] ?? utility.title.toLowerCase(),
      ...groupDefaults.bestFor,
    ].slice(0, 4),
    settings: groupDefaults.settings,
    limitations: groupDefaults.limitations,
    related: relatedForUtility(utility),
  };
}

function fallbackGuideByGroup(group: UtilityGroup) {
  if (group === "SVG to image/PDF") {
    return {
      bestFor: [
        "Browser-safe SVG export",
        "Specific pixel sizes or document output",
        "Transparent PNG/WebP or flattened JPG/PDF handoff",
      ],
      settings: [
        "Set width, height, scale, and aspect lock before export.",
        "Use transparent backgrounds for PNG/WebP and solid backgrounds for JPG/PDF.",
        "Preview the raster output before downloading.",
      ],
      limitations: [
        "SVG export routes render with browser canvas or PDF libraries, not Potrace tracing.",
        "External fonts or linked images may render differently unless embedded.",
        "Use SVG cleanup first if the source markup is messy or unsafe.",
      ],
    };
  }

  if (group === "Cricut & cutting") {
    return {
      bestFor: [
        "Cricut Design Space prep",
        "Vinyl decals, stickers, labels, stencils, and maker files",
        "US creator, classroom, Etsy, and small-business craft workflows",
      ],
      settings: [
        "Start with clean cut, vinyl, sticker, or layered presets.",
        "Use Click to Convert settings for threshold, cleanup, and trace detail.",
        "Use Live Preview edits for layer colors, opacity, visibility, copy, and download checks.",
      ],
      limitations: [
        "These tools help prepare SVGs but cannot guarantee every cutter or material result.",
        "Very small islands, noisy photos, and busy backgrounds may need manual cleanup.",
        "Cricut is a trademark of its owner; iLoveSVG is not affiliated with Cricut.",
      ],
    };
  }

  if (group === "Edit SVG" || group === "Optimize SVG" || group === "Inspect SVG") {
    return {
      bestFor: [
        "Cleaning, checking, editing, or exporting existing SVG markup",
        "Web, app, print, design-system, and handoff workflows",
        "Fast local SVG adjustments before export",
      ],
      settings: [
        "Use the visible controls for the exact SVG attribute or export behavior you need.",
        "Preview the output before copying or downloading.",
        "Run SVG cleaner or minifier when file size or editor markup gets in the way.",
      ],
      limitations: [
        "SVG utility tools edit SVG markup and do not trace raster images.",
        "Complex filters, external references, or missing fonts can affect browser previews.",
        "Use image-to-SVG tools when your source is PNG, JPG, JPEG, or WebP.",
      ],
    };
  }

  if (group === "Base64") {
    return {
      bestFor: [
        "SVG data URLs, CSS embeds, HTML snippets, and encoded SVG strings",
        "Debugging Base64 output before using it in production",
        "Copy-ready Base64 or decoded SVG source",
      ],
      settings: [
        "Choose Base64-only or data URI output based on where the result will be pasted.",
        "Keep sanitization enabled when decoding unknown SVG data.",
        "Use copy actions for code snippets and download actions for reusable files.",
      ],
      limitations: [
        "Base64 tools encode or decode SVG data; they are not raster tracing pages.",
        "Very large encoded assets can be awkward in CSS or HTML.",
        "Sanitization can remove unsafe scripts or event handlers from decoded SVG.",
      ],
    };
  }

  return {
    bestFor: [
      "Creator, design, web, and SVG production workflows",
      "Fast visual checks before copy or download",
      "Moving between related SVG tools without restarting from scratch",
    ],
    settings: [
      "Use the route-specific controls shown inside the tool.",
      "Preview the result before downloading or copying.",
      "Open related tools when you need cleanup, export, color, or sizing changes.",
    ],
    limitations: [
      "This tool only exposes controls that affect the current output.",
      "Use a related converter if your input or output format is different.",
      "Some browser-rendered previews can differ when external assets are missing.",
    ],
  };
}

function relatedForUtility(utility: UtilityLink) {
  const byPath = new Map(UTILITIES.map((item) => [normalizePath(item.to), item]));
  const configured = RELATED_LINKS[normalizePath(utility.to)] ?? [];

  const links = configured
    .map((path) => byPath.get(path))
    .filter((item): item is UtilityLink => Boolean(item))
    .map((item) => ({
      to: item.to,
      label: item.title,
      reason: relatedReason(utility, item),
    }));

  if (links.length) return links.slice(0, 6);

  return UTILITIES.filter(
    (item) => item.group === utility.group && item.to !== utility.to,
  )
    .slice(0, 6)
    .map((item) => ({
      to: item.to,
      label: item.title,
      reason: item.description,
    }));
}

function relatedReason(source: UtilityLink, target: UtilityLink) {
  if (target.group === "SVG to image/PDF") {
    return "Export the SVG result to a browser, print, or sharing format.";
  }
  if (target.group === "Edit SVG") {
    return "Adjust the SVG after conversion without retracing the source.";
  }
  if (target.group === "Optimize SVG") {
    return "Clean or reduce the SVG before publishing, embedding, or handoff.";
  }
  if (target.group === "Cricut & cutting") {
    return "Use a more specific craft-file workflow for vinyl, stickers, or layered cuts.";
  }
  if (target.group === "Image to SVG" && source.group !== "Image to SVG") {
    return "Trace a raster image into SVG before editing or exporting.";
  }
  return target.description;
}

const RELATED_LINKS: Record<string, string[]> = {
  "/": [
    "/png-to-svg-converter",
    "/jpg-to-svg-converter",
    "/svg-to-png-converter",
    "/cricut-svg-converter",
    "/svg-background-editor",
    "/logo-to-svg-converter",
  ],
  "/png-to-svg-converter": [
    "/jpg-to-svg-converter",
    "/logo-to-svg-converter",
    "/png-to-svg-for-cricut",
    "/svg-to-png-converter",
    "/svg-background-editor",
    "/png-to-layered-svg-for-cricut",
  ],
  "/jpg-to-svg-converter": [
    "/jpeg-to-svg-converter",
    "/photo-to-svg-outline",
    "/scan-to-svg-converter",
    "/image-to-svg-outline",
    "/svg-to-jpg-converter",
    "/jpg-to-svg-for-cricut",
  ],
  "/jpeg-to-svg-converter": [
    "/jpg-to-svg-converter",
    "/photo-to-svg-outline",
    "/scan-to-svg-converter",
    "/image-to-svg-outline",
    "/jpeg-to-svg-for-cricut",
    "/svg-to-jpg-converter",
  ],
  "/webp-to-svg-converter": [
    "/png-to-svg-converter",
    "/jpg-to-svg-converter",
    "/webp-to-svg-for-cricut",
    "/svg-to-webp-converter",
    "/logo-to-svg-converter",
    "/svg-cleaner",
  ],
  "/svg-to-png-converter": [
    "/svg-to-jpg-converter",
    "/svg-to-pdf-converter",
    "/svg-to-webp-converter",
    "/svg-background-editor",
    "/svg-resize-and-scale-editor",
    "/svg-cleaner",
  ],
  "/svg-to-jpg-converter": [
    "/svg-to-png-converter",
    "/svg-to-pdf-converter",
    "/svg-background-editor",
    "/svg-resize-and-scale-editor",
    "/svg-cleaner",
  ],
  "/svg-to-pdf-converter": [
    "/svg-to-png-converter",
    "/svg-to-jpg-converter",
    "/svg-resize-and-scale-editor",
    "/svg-cleaner",
    "/svg-preview-viewer",
  ],
  "/svg-background-editor": [
    "/svg-to-png-converter",
    "/svg-cleaner",
    "/svg-recolor",
    "/svg-resize-and-scale-editor",
    "/svg-to-pdf-converter",
  ],
  "/svg-to-base64": [
    "/base64-to-svg",
    "/svg-cleaner",
    "/svg-minifier",
    "/svg-embed-code-generator",
    "/inline-svg-vs-img",
  ],
  "/base64-to-svg": [
    "/svg-to-base64",
    "/svg-cleaner",
    "/svg-preview-viewer",
    "/svg-recolor",
    "/base64-to-svg-for-cricut",
  ],
  "/svg-cleaner": [
    "/svg-minifier",
    "/svg-background-editor",
    "/svg-recolor",
    "/svg-to-png-converter",
    "/svg-to-base64",
  ],
  "/text-to-svg-converter": [
    "/svg-to-png-converter",
    "/svg-to-favicon-generator",
    "/cricut-svg-converter",
    "/svg-cleaner",
    "/svg-recolor",
  ],
  "/emoji-to-svg-converter": [
    "/text-to-svg-converter",
    "/svg-to-png-converter",
    "/svg-to-favicon-generator",
    "/sticker-to-svg-converter",
  ],
  "/image-to-svg-outline": [
    "/photo-to-svg-outline",
    "/line-art-to-svg-converter",
    "/png-to-svg-for-laser-cutting",
    "/scan-to-svg-converter",
    "/svg-to-png-converter",
  ],
  "/photo-to-svg-outline": [
    "/image-to-svg-outline",
    "/jpg-to-svg-converter",
    "/photo-to-svg-for-cricut",
    "/svg-to-png-converter",
  ],
  "/cricut-svg-converter": [
    "/png-to-svg-for-cricut",
    "/png-to-layered-svg-for-cricut",
    "/png-to-svg-for-cricut-vinyl",
    "/png-to-svg-for-cricut-stickers",
    "/png-to-svg-for-cricut-print-then-cut",
    "/png-to-svg-for-etsy",
  ],
  "/png-to-svg-for-cricut": [
    "/cricut-svg-converter",
    "/png-to-svg-for-cricut-vinyl",
    "/png-to-svg-for-cricut-stickers",
    "/png-to-layered-svg-for-cricut",
    "/png-to-svg-for-silhouette",
    "/png-to-svg-for-laser-cutting",
  ],
  "/png-to-svg-for-cricut-vinyl": [
    "/png-to-svg-for-cricut",
    "/png-to-svg-for-cricut-stickers",
    "/png-to-svg-for-cricut-print-then-cut",
    "/png-to-svg-for-silhouette",
    "/png-to-svg-for-laser-cutting",
  ],
  "/png-to-svg-for-cricut-stickers": [
    "/png-to-svg-for-cricut-print-then-cut",
    "/sticker-to-svg-for-cricut",
    "/sticker-to-svg-converter",
    "/png-to-svg-for-cricut",
    "/png-to-svg-for-etsy",
  ],
  "/png-to-svg-for-cricut-print-then-cut": [
    "/png-to-svg-for-cricut-stickers",
    "/sticker-to-svg-for-cricut",
    "/png-to-svg-for-cricut",
    "/svg-to-png-converter",
  ],
  "/layered-svg-for-cricut": [
    "/png-to-layered-svg-for-cricut",
    "/image-to-layered-svg-for-cricut",
    "/jpg-to-layered-svg-for-cricut",
    "/logo-to-layered-svg-for-cricut",
    "/cricut-svg-converter",
  ],
  "/png-to-layered-svg-for-cricut": [
    "/layered-svg-for-cricut",
    "/image-to-layered-svg-for-cricut",
    "/png-to-svg-for-cricut",
    "/png-to-svg-for-cricut-vinyl",
  ],
  "/svg-to-favicon-generator": [
    "/svg-to-png-converter",
    "/svg-resize-and-scale-editor",
    "/svg-cleaner",
    "/logo-to-svg-converter",
  ],
};

const ROUTE_GUIDES: Record<string, RouteGuide> = {
  "/": {
    eyebrow: "Image to SVG vectorizer",
    heading: "Free SVG converter for PNG, JPG, WebP, logos, scans, and creator artwork",
    intro:
      "Use the home converter when you want one flexible image-to-SVG workflow with searchable presets, backend speed tags, advanced trace controls, editable layer metadata, output history, copy/download actions, and full-screen preview. Uploaded images are processed for conversion and are not stored after conversion.",
    bestFor: [
      "General image to SVG searches like png to svg, jpg to svg, convert to svg, and image to svg converter.",
      "Creators preparing logos, icons, classroom graphics, Etsy files, stickers, or small-business artwork.",
      "Users who want presets first, then advanced controls only when the source image needs cleanup.",
    ],
    settings: [
      "Start with Lineart - Accurate or Lineart - Bold for simple artwork.",
      "Use preset search for Cricut, vinyl, sticker, scan, logo, photo edge, layered, or transparent workflows.",
      "Use Live Preview edits for layer styling and Click to Convert settings for threshold, cleanup, trace detail, and layers.",
    ],
    limitations: [
      "Raster-to-SVG tracing is server-assisted and protected by upload, dimension, rate, and concurrency limits.",
      "Photos and busy backgrounds may need outline, scan, or cleanup presets instead of a simple trace.",
      "No AI background removal is claimed; color and background controls work within the supported SVG/raster pipeline.",
    ],
    related: [
      { to: "/png-to-svg-converter", label: "PNG to SVG Converter", reason: "Best for transparent PNG logos, icons, and sticker artwork." },
      { to: "/jpg-to-svg-converter", label: "JPG to SVG Converter", reason: "Use this for JPEG-style photos, screenshots, and camera images." },
      { to: "/cricut-svg-converter", label: "Cricut SVG Converter", reason: "Move from a general SVG trace into a craft-file workflow." },
      { to: "/svg-to-png-converter", label: "SVG to PNG Converter", reason: "Export a finished SVG back to a transparent PNG." },
      { to: "/svg-background-editor", label: "SVG Background Editor", reason: "Change or remove SVG backgrounds after conversion." },
      { to: "/logo-to-svg-converter", label: "Logo to SVG Converter", reason: "Use a logo-specific workflow for brand marks and small-business files." },
    ],
  },
  "/png-to-svg-converter": {
    eyebrow: "PNG to SVG keyword cluster",
    heading: "PNG to SVG for transparent logos, icons, stickers, and web graphics",
    intro:
      "This page targets PNG sources: transparent logos, flat icons, screenshots, sticker artwork, and clean web graphics. It uses server-assisted tracing with route-aware presets, searchable speed filters, editable layer output, and copy/download controls.",
    bestFor: [
      "Transparent PNG to SVG and png to svg converter free searches.",
      "Logos, icons, decals, clipart, flat marks, and sticker-style art.",
      "US creators preparing brand assets, classroom graphics, Etsy files, or merch artwork.",
    ],
    settings: [
      "Try Logo - Sharp or Lineart - Clean for flat PNG artwork.",
      "Use remove white or transparent/background presets when a PNG has a plain canvas.",
      "Switch to layered presets when the PNG has distinct color regions you want editable.",
    ],
    limitations: [
      "Tracing converts pixels into paths; it is not a lossless PNG wrapper.",
      "Tiny texture, antialiasing, and shadows can create extra paths unless cleanup settings are used.",
      "Use SVG to PNG if you already have an SVG and only need raster export.",
    ],
    related: [
      { to: "/jpg-to-svg-converter", label: "JPG to SVG", reason: "Use for non-transparent camera or web images." },
      { to: "/logo-to-svg-converter", label: "Logo to SVG", reason: "Use logo-tuned presets and cleanup language." },
      { to: "/png-to-svg-for-cricut", label: "PNG to SVG for Cricut", reason: "Prepare a PNG as a cut-friendly craft file." },
      { to: "/png-to-layered-svg-for-cricut", label: "PNG to Layered SVG", reason: "Split color PNG artwork into editable layers." },
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Export the finished SVG back to transparent PNG." },
      { to: "/svg-background-editor", label: "SVG Background Editor", reason: "Fix background color or transparency after conversion." },
    ],
  },
  "/jpg-to-svg-converter": {
    eyebrow: "JPG to SVG keyword cluster",
    heading: "JPG to SVG for photos, screenshots, scans, and non-transparent images",
    intro:
      "JPG files usually contain compression noise and no transparency, so this page emphasizes photo outline, scan cleanup, contrast, threshold, and edge presets instead of treating JPG like a clean logo PNG.",
    bestFor: [
      "jpg to svg, convert jpg to svg, and jpg to svg converter searches.",
      "Camera photos, screenshots, scans, worksheet marks, and whiteboard images.",
      "Designers who need a simplified outline or ink-style SVG from a JPEG-style source.",
    ],
    settings: [
      "Use Photo Edge or Scan presets when the JPG is photographic or unevenly lit.",
      "Use threshold, edge cleanup, and noise settings for compression artifacts.",
      "Use full-screen preview to inspect whether the trace is too detailed before downloading.",
    ],
    limitations: [
      "JPG tracing is interpretive; it will not reproduce every photo tone as editable vector art.",
      "Low-contrast photos may need cleanup or an outline preset.",
      "Use JPEG to SVG if your search intent or source wording specifically says JPEG.",
    ],
    related: [
      { to: "/jpeg-to-svg-converter", label: "JPEG to SVG", reason: "Camera-file wording and JPEG-specific search intent." },
      { to: "/photo-to-svg-outline", label: "Photo to SVG Outline", reason: "Simplify photos into contour-style SVG output." },
      { to: "/scan-to-svg-converter", label: "Scan to SVG", reason: "Better for paper shadows, ink, and scanned documents." },
      { to: "/image-to-svg-outline", label: "Image to SVG Outline", reason: "Use an outline-first workflow for line extraction." },
      { to: "/jpg-to-svg-for-cricut", label: "JPG to SVG for Cricut", reason: "Prepare a JPG as a craft or cut-file SVG." },
    ],
  },
  "/svg-to-png-converter": {
    eyebrow: "SVG export workflow",
    heading: "SVG to PNG with transparency, size control, and browser raster export",
    intro:
      "This is not an image-tracing page. It renders your SVG in the browser and exports a PNG with width, height, scale, aspect ratio, transparency, and background controls.",
    bestFor: [
      "svg to png, convert svg to png, transparent svg to png, and resize svg to png searches.",
      "Icons, logos, social graphics, app assets, design handoff, and quick PNG previews.",
      "Users who need transparent PNG output without retracing or changing the SVG paths.",
    ],
    settings: [
      "Set exact width and height for production exports.",
      "Keep transparent background for overlays or choose a solid background for previews.",
      "Increase scale for sharper edges on small icons or text-heavy SVGs.",
    ],
    limitations: [
      "Browser raster export can differ if the SVG references external fonts, images, or unsupported filters.",
      "This route exports pixels from SVG; it does not convert PNG back into SVG.",
      "Use SVG background editor first when the source SVG has an unwanted background shape.",
    ],
    related: [
      { to: "/svg-to-jpg-converter", label: "SVG to JPG", reason: "Flatten SVG onto a solid background for standard image sharing." },
      { to: "/svg-to-pdf-converter", label: "SVG to PDF", reason: "Save SVG artwork into a print or document format." },
      { to: "/svg-background-editor", label: "SVG Background Editor", reason: "Change transparent or solid backgrounds before export." },
      { to: "/svg-resize-and-scale-editor", label: "SVG Resize and Scale", reason: "Edit the SVG dimensions before raster export." },
      { to: "/svg-cleaner", label: "SVG Cleaner", reason: "Clean markup before exporting difficult SVGs." },
    ],
  },
  "/svg-background-editor": {
    eyebrow: "SVG background workflow",
    heading: "Change, add, or remove SVG backgrounds without rasterizing the file",
    intro:
      "This route edits SVG background behavior. It can detect common full-canvas background rectangles, add a solid or transparent background, or place an SVG underlay behind artwork when replace mode is supported.",
    bestFor: [
      "remove SVG background, SVG background editor, transparent SVG, and SVG background color searches.",
      "Designers preparing icons, logos, stickers, PDFs, or transparent PNG exports.",
      "Users who need SVG markup edited before exporting to PNG, JPG, PDF, or Base64.",
    ],
    settings: [
      "Use remove mode when a full-canvas background shape is detected.",
      "Use add mode when you need an explicit white, brand-color, or transparent canvas.",
      "Use replace mode only for supported SVG underlays, not AI background removal.",
    ],
    limitations: [
      "This is SVG background editing, not AI background removal from photographs.",
      "Complex masked, filtered, or path-based backgrounds may require manual SVG editing.",
      "If you need a transparent PNG, edit the SVG here first and then export with SVG to PNG.",
    ],
    related: [
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Export the edited SVG as transparent or solid PNG." },
      { to: "/svg-cleaner", label: "SVG Cleaner", reason: "Remove editor markup before background editing." },
      { to: "/svg-recolor", label: "SVG Recolor", reason: "Change fill and stroke colors after background cleanup." },
      { to: "/svg-resize-and-scale-editor", label: "SVG Resize and Scale", reason: "Fix viewBox and canvas sizing." },
    ],
  },
  "/text-to-svg-converter": {
    eyebrow: "Text and font workflow",
    heading: "Text to SVG for wordmarks, labels, craft files, and typography graphics",
    intro:
      "This page turns typed text into SVG output with font, spacing, alignment, padding, stroke, fill, background, and split-export controls. It is useful for logos, classroom labels, product mockups, craft text, and small-business graphics.",
    bestFor: [
      "text to svg, font to svg, text to svg path, and text to svg online searches.",
      "Wordmarks, signs, labels, stickers, templates, and reusable typography assets.",
      "US creators making shop graphics, classroom materials, packaging labels, or merch text.",
    ],
    settings: [
      "Use custom font upload only when you have rights to use that font.",
      "Adjust spacing, padding, canvas sizing, stroke, fill, and background before export.",
      "Split by line, word, or character when a project needs separate SVG pieces.",
    ],
    limitations: [
      "Font rendering depends on the selected built-in or uploaded font file.",
      "Converted text paths are no longer editable as live text in every design app.",
      "Use SVG to PNG if the final destination needs a raster image instead of SVG.",
    ],
    related: [
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Export finished SVG text as a transparent PNG." },
      { to: "/cricut-svg-converter", label: "Cricut SVG Converter", reason: "Prepare text graphics for craft and cut-file workflows." },
      { to: "/svg-cleaner", label: "SVG Cleaner", reason: "Clean text SVG markup before sharing or embedding." },
      { to: "/svg-recolor", label: "SVG Recolor", reason: "Change fill or stroke colors after export." },
    ],
  },
};

const UTILITY_SECTIONS: UtilitySection[] = [
  {
    id: "image-to-svg",
    title: "Image to SVG converters",
    description:
      "Convert raster images, logos, drawings, sketches, scans, text, stickers, and outlines into scalable SVG files.",
    groups: ["Image to SVG"],
  },
  {
    id: "cricut-and-cutting",
    title: "Cricut, stickers, vinyl, Etsy, Silhouette, and laser cutting",
    description:
      "Tools for craft workflows, cut files, layered SVG output, vinyl projects, stickers, Print Then Cut, Etsy listings, Silhouette projects, and laser cutting prep.",
    groups: ["Cricut & cutting"],
  },
  {
    id: "svg-export",
    title: "SVG to image and PDF converters",
    description:
      "Export SVG files to PNG, JPG, WebP, PDF, and favicon formats for web, print, sharing, and app icons.",
    groups: ["SVG to image/PDF"],
  },
  {
    id: "svg-editing",
    title: "SVG editors",
    description:
      "Edit common SVG properties such as background, size, scale, color, stroke width, rotation, and flipping.",
    groups: ["Edit SVG"],
  },
  {
    id: "svg-inspection",
    title: "SVG viewers, inspectors, and embed tools",
    description:
      "Preview SVGs, inspect dimensions and file size, generate embed code, compare inline SVG vs img, and check accessibility.",
    groups: ["Inspect SVG"],
  },
  {
    id: "svg-optimization",
    title: "SVG cleanup and optimization",
    description:
      "Clean and minify SVG markup so files are easier to ship, embed, and maintain.",
    groups: ["Optimize SVG"],
  },
  {
    id: "base64-and-color",
    title: "Base64 and color tools",
    description:
      "Encode or decode SVG Base64 data, generate data URLs, and pick or extract colors from graphics.",
    groups: ["Base64", "Color"],
  },
];

/**
 * FULL list synced to the current routes config.
 * Legal pages are intentionally excluded.
 */
export const UTILITIES: UtilityLink[] = [
  {
    id: "image-to-svg",
    title: "Image to SVG Converter",
    shortTitle: "Image → SVG",
    description:
      "Convert an image into an SVG vector for scaling, logos, icons, and clean print output.",
    to: "/",
    group: "Image to SVG",
    keywords: [
      "image to svg",
      "vectorize",
      "png to svg",
      "jpg to svg",
      "jpeg to svg",
      "webp to svg",
    ],
  },
  {
    id: "png-to-svg",
    title: "PNG to SVG Converter",
    shortTitle: "PNG → SVG",
    description:
      "Convert PNG images to SVG vectors for scalable logos, icons, graphics, and print-ready artwork.",
    to: "/png-to-svg-converter",
    group: "Image to SVG",
    keywords: ["png to svg", "vectorize png", "transparent png to svg"],
  },
  {
    id: "jpg-to-svg",
    title: "JPG to SVG Converter",
    shortTitle: "JPG → SVG",
    description:
      "Convert JPG images into scalable SVG files for web graphics, posters, and print projects.",
    to: "/jpg-to-svg-converter",
    group: "Image to SVG",
    keywords: ["jpg to svg", "vectorize jpg", "image to svg"],
  },
  {
    id: "jpeg-to-svg",
    title: "JPEG to SVG Converter",
    shortTitle: "JPEG → SVG",
    description:
      "Convert JPEG images to SVG with clean vector-style output for resizing without blur.",
    to: "/jpeg-to-svg-converter",
    group: "Image to SVG",
    keywords: ["jpeg to svg", "vectorize jpeg", "photo to svg"],
  },
  {
    id: "webp-to-svg",
    title: "WebP to SVG Converter",
    shortTitle: "WebP → SVG",
    description:
      "Convert WebP images to SVG for scalable assets and consistent rendering across sizes.",
    to: "/webp-to-svg-converter",
    group: "Image to SVG",
    keywords: ["webp to svg", "vectorize webp", "image to svg"],
  },
  {
    id: "logo-to-svg",
    title: "Logo to SVG Converter",
    shortTitle: "Logo → SVG",
    description:
      "Turn a logo into a scalable SVG for brand kits, websites, printing, and sharp resizing.",
    to: "/logo-to-svg-converter",
    group: "Image to SVG",
    keywords: ["logo to svg", "brand", "vector logo", "vectorize logo"],
  },
  {
    id: "icon-to-svg",
    title: "Icon to SVG Converter",
    shortTitle: "Icon → SVG",
    description:
      "Convert icons to SVG for crisp scaling, theming, UI use, and consistent rendering.",
    to: "/icon-to-svg-converter",
    group: "Image to SVG",
    keywords: ["icon to svg", "vector icon", "ui icon svg"],
  },
  {
    id: "emoji-to-svg",
    title: "Emoji to SVG Converter",
    shortTitle: "Emoji → SVG",
    description:
      "Convert emoji-style images to SVG for scalable stickers, icons, overlays, and graphics.",
    to: "/emoji-to-svg-converter",
    group: "Image to SVG",
    keywords: ["emoji to svg", "vector emoji", "sticker svg"],
  },
  {
    id: "text-to-svg",
    title: "Text to SVG Converter",
    shortTitle: "Text → SVG",
    description:
      "Convert text into SVG for logos, wordmarks, headings, and scalable typography graphics.",
    to: "/text-to-svg-converter",
    group: "Image to SVG",
    keywords: ["text to svg", "wordmark", "typography", "vector text"],
  },
  {
    id: "sticker-to-svg",
    title: "Sticker to SVG Converter",
    shortTitle: "Sticker → SVG",
    description:
      "Convert sticker images to SVG for clean cut lines, scaling, decals, and print-ready output.",
    to: "/sticker-to-svg-converter",
    group: "Image to SVG",
    keywords: ["sticker to svg", "decal", "decal svg", "cut file"],
  },
  {
    id: "line-art-to-svg",
    title: "Line Art to SVG Converter",
    shortTitle: "Line Art → SVG",
    description:
      "Convert line art into SVG for crisp outlines, coloring pages, decals, and cut-friendly paths.",
    to: "/line-art-to-svg-converter",
    group: "Image to SVG",
    keywords: ["line art to svg", "outline to svg", "trace line art"],
  },
  {
    id: "drawing-to-svg",
    title: "Drawing to SVG Converter",
    shortTitle: "Drawing → SVG",
    description:
      "Convert a drawing into SVG so it stays sharp at any size for prints, merch, and design edits.",
    to: "/drawing-to-svg-converter",
    group: "Image to SVG",
    keywords: ["drawing to svg", "hand drawn to svg", "vectorize drawing"],
  },
  {
    id: "scan-to-svg",
    title: "Scan to SVG Converter",
    shortTitle: "Scan → SVG",
    description:
      "Convert scanned images to SVG for cleanup, scaling, document graphics, and printable art.",
    to: "/scan-to-svg-converter",
    group: "Image to SVG",
    keywords: ["scan to svg", "scanned image to svg", "vectorize scan"],
  },
  {
    id: "sketch-to-svg",
    title: "Sketch to SVG Converter",
    shortTitle: "Sketch → SVG",
    description:
      "Vectorize sketches into SVG for clean scaling, editing, and consistent line output.",
    to: "/sketch-to-svg-converter",
    group: "Image to SVG",
    keywords: ["sketch to svg", "pencil sketch to svg", "vectorize sketch"],
  },
  {
    id: "image-to-svg-outline",
    title: "Image to SVG Outline Converter",
    shortTitle: "Image → Outline",
    description:
      "Generate an outline SVG from an image for clean line art, decals, and cut-ready shapes.",
    to: "/image-to-svg-outline",
    group: "Image to SVG",
    keywords: ["image to svg outline", "outline svg", "line art svg"],
  },
  {
    id: "photo-to-svg-outline",
    title: "Photo to SVG Outline Converter",
    shortTitle: "Photo → Outline",
    description:
      "Create an outline-style SVG from a photo for posters, stickers, simplified art, and decals.",
    to: "/photo-to-svg-outline",
    group: "Image to SVG",
    keywords: ["photo to svg outline", "outline svg", "trace photo"],
  },
  {
    id: "black-and-white-image-to-svg",
    title: "Black and White Image to SVG Converter",
    shortTitle: "B&W → SVG",
    description:
      "Convert black and white images to SVG with clear edges for stencils, decals, signs, and prints.",
    to: "/black-and-white-image-to-svg-converter",
    group: "Image to SVG",
    keywords: ["black and white to svg", "bw to svg", "b&w", "stencil svg"],
  },

  {
    id: "cricut-svg-converter",
    title: "Cricut SVG Converter",
    shortTitle: "Cricut SVG Converter",
    description:
      "Convert artwork into SVG files for Cricut Design Space, vinyl decals, stickers, labels, stencils, cards, and craft projects.",
    to: "/cricut-svg-converter",
    group: "Cricut & cutting",
    keywords: [
      "cricut svg converter",
      "cricut svg",
      "design space",
      "craft svg",
      "vinyl",
      "stickers",
      "cut file",
    ],
  },
  {
    id: "image-to-svg-for-cricut",
    title: "Image to SVG for Cricut",
    shortTitle: "Image → Cricut SVG",
    description:
      "Convert PNG, JPG, WebP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, or SVG files into Cricut-friendly SVG output.",
    to: "/image-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "image to svg for cricut",
      "all image formats",
      "heic to svg",
      "tiff to svg",
      "webp to svg",
      "svg for cricut",
      "design space",
      "cut file",
    ],
  },
  {
    id: "png-to-svg-for-cricut",
    title: "PNG to SVG for Cricut",
    shortTitle: "PNG → Cricut SVG",
    description:
      "Convert PNG images into Cricut-friendly SVG files for cut files, decals, stickers, and crafts.",
    to: "/png-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "png to svg for cricut",
      "cricut svg",
      "cut file",
      "vinyl",
      "stickers",
      "craft svg",
    ],
  },
  {
    id: "jpg-to-svg-for-cricut",
    title: "JPG to SVG for Cricut",
    shortTitle: "JPG → Cricut SVG",
    description:
      "Convert JPG images into Cricut-friendly SVG files for stickers, decals, vinyl, labels, and craft projects.",
    to: "/jpg-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "jpg to svg for cricut",
      "jpeg to svg for cricut",
      "cricut svg",
      "design space",
      "cut file",
      "stickers",
    ],
  },
  {
    id: "jpeg-to-svg-for-cricut",
    title: "JPEG to SVG for Cricut",
    shortTitle: "JPEG → Cricut SVG",
    description:
      "Convert JPEG images into Cricut-friendly SVG files for cut files, decals, stickers, and craft use.",
    to: "/jpeg-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "jpeg to svg for cricut",
      "jpg to svg for cricut",
      "cricut svg",
      "cut file",
      "design space",
    ],
  },
  {
    id: "webp-to-svg-for-cricut",
    title: "WebP to SVG for Cricut",
    shortTitle: "WebP → Cricut SVG",
    description:
      "Convert WebP images into Cricut-friendly SVG files for Design Space, vinyl, stickers, and crafts.",
    to: "/webp-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "webp to svg for cricut",
      "webp to svg",
      "cricut svg",
      "design space",
      "cut file",
    ],
  },
  {
    id: "photo-to-svg-for-cricut",
    title: "Photo to SVG for Cricut",
    shortTitle: "Photo → Cricut SVG",
    description:
      "Convert photos into Cricut-friendly SVG output for simplified art, decals, stickers, and craft projects.",
    to: "/photo-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "photo to svg for cricut",
      "photo svg",
      "cricut photo",
      "design space",
      "cut file",
    ],
  },
  {
    id: "black-and-white-image-to-svg-for-cricut",
    title: "Black and White Image to SVG for Cricut",
    shortTitle: "B&W → Cricut SVG",
    description:
      "Convert black and white images into Cricut-friendly SVG files for stencils, decals, stickers, and signs.",
    to: "/black-and-white-image-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "black and white image to svg for cricut",
      "b&w svg for cricut",
      "stencil svg",
      "cut file",
      "design space",
    ],
  },
  {
    id: "line-art-to-svg-for-cricut",
    title: "Line Art to SVG for Cricut",
    shortTitle: "Line Art → Cricut SVG",
    description:
      "Convert line art into Cricut-friendly SVG outlines for decals, coloring pages, vinyl, and cut projects.",
    to: "/line-art-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "line art to svg for cricut",
      "outline svg for cricut",
      "line art svg",
      "cut file",
    ],
  },
  {
    id: "drawing-to-svg-for-cricut",
    title: "Drawing to SVG for Cricut",
    shortTitle: "Drawing → Cricut SVG",
    description:
      "Convert drawings into Cricut-friendly SVG files for craft projects, stickers, decals, and vinyl cuts.",
    to: "/drawing-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "drawing to svg for cricut",
      "hand drawing svg",
      "cricut drawing",
      "cut file",
    ],
  },
  {
    id: "sketch-to-svg-for-cricut",
    title: "Sketch to SVG for Cricut",
    shortTitle: "Sketch → Cricut SVG",
    description:
      "Convert sketches into Cricut-friendly SVG files for decals, labels, stickers, and cut-file workflows.",
    to: "/sketch-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "sketch to svg for cricut",
      "pencil sketch svg",
      "cricut sketch",
      "cut file",
    ],
  },
  {
    id: "sticker-to-svg-for-cricut",
    title: "Sticker to SVG for Cricut",
    shortTitle: "Sticker → Cricut SVG",
    description:
      "Convert sticker artwork into Cricut-friendly SVG files for Print Then Cut, decals, labels, and sticker sheets.",
    to: "/sticker-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "sticker to svg for cricut",
      "cricut stickers",
      "print then cut",
      "sticker svg",
      "labels",
    ],
  },
  {
    id: "logo-to-svg-for-cricut",
    title: "Logo to SVG for Cricut",
    shortTitle: "Logo → Cricut SVG",
    description:
      "Convert logo files into Cricut-friendly SVG cut files for decals, branding, signs, labels, and craft projects.",
    to: "/logo-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "logo to svg for cricut",
      "logo svg",
      "cricut logo",
      "brand svg",
      "design space",
      "vinyl decal",
      "cut file",
    ],
  },
  {
    id: "base64-to-svg-for-cricut",
    title: "Base64 to SVG for Cricut",
    shortTitle: "Base64 → Cricut SVG",
    description:
      "Decode Base64 SVG data and prepare the SVG for Cricut Design Space, downloads, and craft workflows.",
    to: "/base64-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "base64 to svg for cricut",
      "decode svg",
      "svg data url",
      "cricut svg",
      "design space",
    ],
  },
  {
    id: "code-to-svg-for-cricut",
    title: "Code to SVG for Cricut",
    shortTitle: "Code → Cricut SVG",
    description:
      "Convert SVG code or markup into a downloadable Cricut-friendly SVG file for Design Space.",
    to: "/code-to-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "code to svg for cricut",
      "svg code",
      "svg markup",
      "cricut svg",
      "design space",
    ],
  },
  {
    id: "layered-svg-for-cricut",
    title: "Layered SVG for Cricut",
    shortTitle: "Layered Cricut SVG",
    description:
      "Create or prepare layered SVG files for Cricut projects, multicolor artwork, vinyl, stickers, and craft designs.",
    to: "/layered-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "layered svg for cricut",
      "multicolor svg",
      "cricut layers",
      "vinyl layers",
      "cut file",
    ],
  },
  {
    id: "image-to-layered-svg-for-cricut",
    title: "Image to Layered SVG for Cricut",
    shortTitle: "Image → Layered SVG",
    description:
      "Convert PNG or JPG images into color-separated layered SVG files for Cricut Design Space.",
    to: "/image-to-layered-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "image to layered svg for cricut",
      "layered svg",
      "multicolor svg",
      "cricut layers",
      "cut file",
    ],
  },
  {
    id: "png-to-layered-svg-for-cricut",
    title: "PNG to Layered SVG for Cricut",
    shortTitle: "PNG → Layered SVG",
    description:
      "Create layered SVG output from PNG artwork for Cricut projects, vinyl, stickers, and multicolor designs.",
    to: "/png-to-layered-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "png to layered svg",
      "layered svg for cricut",
      "multicolor svg",
      "cricut layers",
      "cut file",
    ],
  },
  {
    id: "jpg-to-layered-svg-for-cricut",
    title: "JPG to Layered SVG for Cricut",
    shortTitle: "JPG → Layered SVG",
    description:
      "Convert JPG or JPEG images into color-separated layered SVG files for Cricut Design Space.",
    to: "/jpg-to-layered-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "jpg to layered svg",
      "jpeg to layered svg",
      "layered svg for cricut",
      "multicolor svg",
      "cricut layers",
    ],
  },
  {
    id: "logo-to-layered-svg-for-cricut",
    title: "Logo to Layered SVG for Cricut",
    shortTitle: "Logo → Layered SVG",
    description:
      "Convert logos into layered SVG files for Cricut projects with editable color-separated layers.",
    to: "/logo-to-layered-svg-for-cricut",
    group: "Cricut & cutting",
    keywords: [
      "logo to layered svg",
      "layered logo svg",
      "logo svg for cricut",
      "multicolor logo",
      "cricut layers",
    ],
  },
  {
    id: "png-to-svg-for-cricut-print-then-cut",
    title: "PNG to SVG for Cricut Print Then Cut",
    shortTitle: "Print Then Cut SVG",
    description:
      "Prepare PNG artwork for Cricut Print Then Cut workflows, stickers, labels, and printable designs.",
    to: "/png-to-svg-for-cricut-print-then-cut",
    group: "Cricut & cutting",
    keywords: [
      "print then cut",
      "png to svg for cricut",
      "cricut stickers",
      "printable stickers",
      "labels",
    ],
  },
  {
    id: "png-to-svg-for-cricut-vinyl",
    title: "PNG to SVG for Cricut Vinyl",
    shortTitle: "Vinyl Cricut SVG",
    description:
      "Convert PNG artwork into SVG files for Cricut vinyl projects, decals, and cut-friendly designs.",
    to: "/png-to-svg-for-cricut-vinyl",
    group: "Cricut & cutting",
    keywords: [
      "png to svg for vinyl",
      "cricut vinyl",
      "vinyl decal",
      "cut file",
      "decal svg",
    ],
  },
  {
    id: "png-to-svg-for-cricut-stickers",
    title: "PNG to SVG for Cricut Stickers",
    shortTitle: "Sticker Cricut SVG",
    description:
      "Turn PNG sticker artwork into SVG files for Cricut sticker projects, decals, labels, and prints.",
    to: "/png-to-svg-for-cricut-stickers",
    group: "Cricut & cutting",
    keywords: [
      "png to svg for stickers",
      "cricut stickers",
      "sticker svg",
      "decals",
      "labels",
      "print then cut",
    ],
  },
  {
    id: "png-to-svg-for-etsy",
    title: "PNG to SVG for Etsy",
    shortTitle: "PNG → Etsy SVG",
    description:
      "Convert PNG designs into SVG files for Etsy digital downloads, craft bundles, decals, stickers, and printable product listings.",
    to: "/png-to-svg-for-etsy",
    group: "Cricut & cutting",
    keywords: [
      "png to svg for etsy",
      "etsy svg",
      "digital download",
      "svg bundle",
      "craft file",
      "cut file",
      "stickers",
      "decals",
    ],
  },
  {
    id: "png-to-svg-for-silhouette",
    title: "PNG to SVG for Silhouette",
    shortTitle: "PNG → Silhouette SVG",
    description:
      "Convert PNG artwork into SVG files for Silhouette Studio projects, decals, stickers, labels, and cut-file workflows.",
    to: "/png-to-svg-for-silhouette",
    group: "Cricut & cutting",
    keywords: [
      "png to svg for silhouette",
      "silhouette svg",
      "silhouette studio",
      "cameo",
      "cut file",
      "stickers",
      "vinyl",
    ],
  },
  {
    id: "png-to-svg-for-laser-cutting",
    title: "PNG to SVG for Laser Cutting",
    shortTitle: "Laser Cut SVG",
    description:
      "Convert PNG artwork into SVG files for laser cutting, engraving prep, outlines, and cut paths.",
    to: "/png-to-svg-for-laser-cutting",
    group: "Cricut & cutting",
    keywords: [
      "png to svg for laser cutting",
      "laser cut svg",
      "engraving",
      "cut paths",
      "outline svg",
    ],
  },

  {
    id: "svg-to-png",
    title: "SVG to PNG Converter",
    shortTitle: "SVG → PNG",
    description:
      "Convert SVG to PNG with clean edges, transparent background support, and fast export.",
    to: "/svg-to-png-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to png", "export png", "transparent png"],
  },
  {
    id: "svg-to-jpg",
    title: "SVG to JPG Converter",
    shortTitle: "SVG → JPG",
    description:
      "Export SVG as JPG or JPEG for sharing, email, previews, and standard image workflows.",
    to: "/svg-to-jpg-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to jpg", "svg to jpeg", "export jpg"],
  },
  {
    id: "svg-to-webp",
    title: "SVG to WebP Converter",
    shortTitle: "SVG → WebP",
    description:
      "Convert SVG to WebP for smaller files, modern websites, and efficient image delivery.",
    to: "/svg-to-webp-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to webp", "convert svg", "image optimization"],
  },
  {
    id: "svg-to-pdf",
    title: "SVG to PDF Converter",
    shortTitle: "SVG → PDF",
    description:
      "Convert SVG to PDF for printing, sharing, design handoff, and document workflows.",
    to: "/svg-to-pdf-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to pdf", "export pdf", "print svg"],
  },
  {
    id: "svg-to-favicon",
    title: "SVG to Favicon Generator",
    shortTitle: "Favicon Generator",
    description:
      "Generate favicon.ico and common icon sizes from an SVG for browsers and app shortcuts.",
    to: "/svg-to-favicon-generator",
    group: "SVG to image/PDF",
    keywords: ["favicon generator", "favicon.ico", "ico", "app icons"],
  },

  {
    id: "svg-background-editor",
    title: "SVG Background Editor",
    shortTitle: "Background Editor",
    description:
      "Add or remove an SVG background rectangle for solid color or transparent output.",
    to: "/svg-background-editor",
    group: "Edit SVG",
    keywords: ["svg background", "transparent svg", "remove background"],
  },
  {
    id: "svg-resize-scale",
    title: "SVG Resize and Scale Editor",
    shortTitle: "Resize & Scale",
    description:
      "Resize and scale SVGs safely by updating viewBox, width, height, and sizing attributes.",
    to: "/svg-resize-and-scale-editor",
    group: "Edit SVG",
    keywords: ["resize svg", "scale svg", "viewbox", "width height"],
  },
  {
    id: "svg-recolor",
    title: "SVG Recolor Tool",
    shortTitle: "Recolor",
    description:
      "Replace SVG fill and stroke colors quickly with live preview and copy-ready output.",
    to: "/svg-recolor",
    group: "Edit SVG",
    keywords: ["recolor svg", "change svg color", "fill", "stroke"],
  },
  {
    id: "svg-stroke-width-editor",
    title: "SVG Stroke Width Editor",
    shortTitle: "Stroke Width",
    description:
      "Adjust SVG line thickness by editing stroke widths across attributes, styles, or CSS.",
    to: "/svg-stroke-width-editor",
    group: "Edit SVG",
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
      "Flip horizontally or vertically, and rotate SVGs without rasterizing the original file.",
    to: "/svg-flip-and-rotate-editor",
    group: "Edit SVG",
    keywords: ["rotate svg", "flip svg", "mirror svg", "transform"],
  },

  {
    id: "svg-preview-viewer",
    title: "SVG Preview Viewer",
    shortTitle: "Preview Viewer",
    description:
      "Preview SVGs instantly in the browser to verify rendering, layout, and visible output.",
    to: "/svg-preview-viewer",
    group: "Inspect SVG",
    keywords: ["svg viewer", "preview svg", "render svg"],
  },
  {
    id: "svg-embed-code-generator",
    title: "SVG Embed Code Generator",
    shortTitle: "Embed Code",
    description:
      "Generate embed snippets for inline SVG, img tags, CSS backgrounds, and HTML usage.",
    to: "/svg-embed-code-generator",
    group: "Inspect SVG",
    keywords: ["embed svg", "inline svg", "svg html", "img tag"],
  },
  {
    id: "inline-svg-vs-img",
    title: "Inline SVG vs IMG",
    shortTitle: "Inline vs IMG",
    description:
      "Compare inline SVG vs img for styling, caching, accessibility, and performance tradeoffs.",
    to: "/inline-svg-vs-img",
    group: "Inspect SVG",
    keywords: ["inline svg", "img tag", "svg vs img", "svg styling"],
  },
  {
    id: "svg-dimensions-inspector",
    title: "SVG Dimensions Inspector",
    shortTitle: "Dimensions",
    description:
      "Inspect width, height, viewBox, aspect ratio, and computed pixel size for an SVG.",
    to: "/svg-dimensions-inspector",
    group: "Inspect SVG",
    keywords: ["svg dimensions", "viewbox", "width height", "pixel size"],
  },
  {
    id: "svg-file-size-inspector",
    title: "SVG File Size Inspector",
    shortTitle: "File Size",
    description:
      "Check SVG file size and see what changes affect KB, bytes, and optimization potential.",
    to: "/svg-file-size-inspector",
    group: "Inspect SVG",
    keywords: ["svg file size", "svg size kb", "optimize size", "bytes"],
  },
  {
    id: "svg-accessibility-and-contrast-checker",
    title: "SVG Accessibility and Contrast Checker",
    shortTitle: "A11y + Contrast",
    description:
      "Check WCAG contrast, preview color blindness modes, and test higher-contrast options.",
    to: "/svg-accessibility-and-contrast-checker",
    group: "Inspect SVG",
    keywords: [
      "contrast checker",
      "wcag",
      "aa",
      "aaa",
      "color blindness",
      "contrast ratio",
    ],
  },

  {
    id: "svg-minifier",
    title: "SVG Minifier",
    shortTitle: "Minifier",
    description:
      "Minify SVG markup to reduce file size while preserving visual appearance.",
    to: "/svg-minifier",
    group: "Optimize SVG",
    keywords: ["svg minify", "compress svg", "reduce size"],
  },
  {
    id: "svg-cleaner",
    title: "SVG Cleaner",
    shortTitle: "Cleaner",
    description:
      "Clean SVG files by removing metadata, comments, unnecessary attributes, and extra markup.",
    to: "/svg-cleaner",
    group: "Optimize SVG",
    keywords: ["svg cleaner", "clean svg", "remove metadata", "optimize svg"],
  },

  {
    id: "svg-to-base64",
    title: "SVG to Base64 Encoder",
    shortTitle: "SVG → Base64",
    description:
      "Encode SVG as Base64 for embedding in CSS, HTML, image tags, or data URLs.",
    to: "/svg-to-base64",
    group: "Base64",
    keywords: ["svg base64", "encode svg", "data url", "base64 svg"],
  },
  {
    id: "base64-to-svg",
    title: "Base64 to SVG Decoder",
    shortTitle: "Base64 → SVG",
    description:
      "Decode Base64 or SVG data URLs back into SVG source you can preview, copy, and download.",
    to: "/base64-to-svg",
    group: "Base64",
    keywords: ["base64 to svg", "decode svg", "data url", "base64 decoder"],
  },
  {
    id: "free-color-picker",
    title: "Free Color Picker",
    shortTitle: "Color Picker",
    description:
      "Pick colors and extract palettes from SVG, PNG, JPG, JPEG, or WebP with HEX, RGB, and HSL output.",
    to: "/free-color-picker",
    group: "Color",
    keywords: [
      "color picker",
      "palette extractor",
      "hex",
      "rgb",
      "hsl",
      "svg color picker",
    ],
  },
];
