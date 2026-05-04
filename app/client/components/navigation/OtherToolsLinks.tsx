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
  questions?: Array<{
    q: string;
    a: string;
  }>;
};

type Props = {
  title?: string;
  subtitle?: string;
};

const LONG_CONTENT_AD_SLOT = "2346286299";
const SITE_ORIGIN = "https://www.ilovesvg.com";
const ROUTES_WITH_LOCAL_BREADCRUMBS = new Set([
  "/inline-svg-vs-img",
  "/line-art-to-svg-converter",
  "/sketch-to-svg-converter",
  "/svg-background-editor",
  "/svg-cleaner",
  "/svg-dimensions-inspector",
  "/svg-embed-code-generator",
  "/svg-file-size-inspector",
  "/svg-flip-and-rotate-editor",
  "/svg-minifier",
  "/svg-preview-viewer",
  "/svg-recolor",
  "/svg-resize-and-scale-editor",
  "/svg-stroke-width-editor",
  "/svg-to-base64",
  "/svg-to-favicon-generator",
  "/svg-to-jpg-converter",
  "/svg-to-pdf-converter",
  "/svg-to-png-converter",
  "/svg-to-webp-converter",
]);

/**
 * Full site navigation for all public SVG tools.
 * - Shows every non-legal route
 * - Organized by practical user intent
 * - Preserves compact card layout
 * - Highlights the current page instead of hiding it
 *
 * NOTE:
 * Home page ("/") is Image -> SVG on your site.
 * Legal pages exist in routes but are intentionally excluded from this list.
 */
export function OtherToolsLinks({
  title = "All SVG tools",
  subtitle = "Browse every SVG converter, editor, inspector, optimizer, and craft-file utility available on iLoveSVG.",
}: Props) {
  const { pathname } = useLocation();

  const normalizedPathname = normalizePath(pathname);
  const currentUtility = React.useMemo(
    () =>
      UTILITIES.find((item) => normalizePath(item.to) === normalizedPathname) ??
      null,
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
        {currentUtility &&
        currentUtility.to !== "/" &&
        !ROUTES_WITH_LOCAL_BREADCRUMBS.has(normalizedPathname) ? (
          <BottomBreadcrumbs utility={currentUtility} />
        ) : null}

        <div className="flex flex-col gap-2">
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
                        {isCurrent ? null : <span aria-hidden>{"->"}</span>}
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

function BottomBreadcrumbs({ utility }: { utility: UtilityLink }) {
  const crumbs = [
    { name: "Home", to: "/" },
    { name: "All SVG tools", to: "/sitemap" },
    { name: utility.title, to: utility.to },
  ];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.to),
    })),
  };

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-sm font-semibold text-slate-600"
      >
        <ol className="flex flex-wrap items-center gap-2">
          {crumbs.map((crumb, index) => {
            const isCurrent = index === crumbs.length - 1;

            return (
              <li key={crumb.to} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="text-slate-400">
                    /
                  </span>
                ) : null}
                {isCurrent ? (
                  <span aria-current="page" className="text-slate-800">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    to={crumb.to}
                    className="cursor-pointer rounded text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2"
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}

export function CurrentRouteGuide() {
  const { pathname } = useLocation();
  const normalizedPathname = normalizePath(pathname);
  const routeGuide = React.useMemo(
    () => getRouteGuide(normalizedPathname),
    [normalizedPathname],
  );

  if (!routeGuide) return null;
  return <RouteIntentGuide guide={routeGuide} />;
}

function RouteIntentGuide({ guide }: { guide: RouteGuide }) {
  return (
    <section
      aria-labelledby="current-tool-guide-heading"
      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-6"
    >
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_336px] 2xl:items-start">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            {guide.eyebrow}
          </p>
          <h2
            id="current-tool-guide-heading"
            className="mt-2 max-w-[820px] text-2xl font-extrabold tracking-tight text-sky-950 sm:text-3xl"
          >
            {guide.heading}
          </h2>
          <p className="mt-3 max-w-[78ch] text-[15px] leading-7 text-slate-700">
            {guide.intro}
          </p>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <GuideList title="Best for" items={guide.bestFor} />
            <GuideList title="Settings to try" items={guide.settings} />
            <GuideList title="Useful limits" items={guide.limitations} />
          </div>
        </div>

        <LongContentAd />
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

function LongContentAd() {
  return (
    <aside
      aria-label="Sponsored"
      className="mx-auto w-full max-w-[360px] rounded-xl border border-slate-200 bg-white/80 p-2 shadow-sm sm:p-3 2xl:mx-0 2xl:justify-self-end"
    >
      <div className="mx-auto flex min-h-[336px] w-full max-w-[336px] items-center justify-center overflow-hidden">
        <AdSenseDelayed
          slot={LONG_CONTENT_AD_SLOT}
          delayMs={2500}
          afterInteraction={true}
          minHeight={336}
          maxHeight={336}
          format="rectangle"
          fullWidth={false}
          className="mx-auto w-full max-w-[336px]"
          showPlaceholder={true}
        />
      </div>
    </aside>
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

function absoluteUrl(path: string) {
  return path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
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
    questions: groupDefaults.questions,
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
      questions: [
        {
          q: "Does this route trace images?",
          a: "No. SVG export routes render an existing SVG into PNG, JPG, WebP, PDF, or favicon output instead of retracing raster pixels.",
        },
        {
          q: "Can I keep transparency?",
          a: "Use PNG or WebP export when transparency matters. JPG and most PDF workflows need a solid background.",
        },
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
      questions: [
        {
          q: "Is this officially affiliated with Cricut?",
          a: "No. The page is built for common Cricut Design Space workflows, but iLoveSVG is not affiliated with Cricut.",
        },
        {
          q: "What should I check before cutting?",
          a: "Inspect tiny islands, line thickness, final size, background cleanup, and layer separation before sending the SVG to a cutter.",
        },
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
      questions: [
        {
          q: "Are SVG utility files uploaded?",
          a: "These browser utility pages work with pasted or uploaded SVG data locally unless the specific page says otherwise.",
        },
        {
          q: "When should I use an image-to-SVG converter instead?",
          a: "Use image-to-SVG when your source is a PNG, JPG, JPEG, WebP, scan, photo, logo, or drawing that needs vector tracing.",
        },
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
      questions: [
        {
          q: "Is Base64 conversion the same as image tracing?",
          a: "No. Base64 tools encode or decode SVG strings and data URLs; they do not turn raster pixels into vector paths.",
        },
        {
          q: "When should I use Base64 output?",
          a: "Use it for small SVG embeds in CSS, HTML, documentation, prototypes, or code snippets where a data URL is useful.",
        },
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
    questions: [
      {
        q: "Which tool should I use next?",
        a: "Use the related links below when you need a different input type, output format, cleanup step, or craft-file workflow.",
      },
      {
        q: "Will this change the conversion engine?",
        a: "No. These notes explain the current route behavior and point you toward the right existing tool.",
      },
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
    questions: [
      {
        q: "Does the home converter upload files?",
        a: "Yes. Raster-to-SVG tracing is server-assisted, protected by upload and concurrency limits, and files are not stored after conversion.",
      },
      {
        q: "What do the preset speed tags mean?",
        a: "Speed tags estimate backend processing cost. They help you choose between quick single-trace presets and heavier layered or high-detail presets.",
      },
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
    questions: [
      {
        q: "Can a transparent PNG become an editable SVG?",
        a: "Yes, when the trace can separate useful shapes. Layered presets can help when the PNG has clear color regions.",
      },
      {
        q: "Is PNG to SVG lossless?",
        a: "No. Tracing interprets pixels as vector paths, so cleanup and preset choice matter for smooth SVG output.",
      },
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
    questions: [
      {
        q: "Why can a JPG trace look different from the photo?",
        a: "JPG files are continuous-tone raster images. The converter simplifies them into paths, so outlines, contrast, and cleanup settings shape the result.",
      },
      {
        q: "Which preset should I start with for JPG?",
        a: "Use Photo Edge for contour art, Scan for paper or whiteboard images, and Lineart presets for clear drawings or black ink.",
      },
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
    questions: [
      {
        q: "Can I export a transparent PNG?",
        a: "Yes. Keep the transparent background option when you need icons, overlays, product graphics, or social assets with alpha.",
      },
      {
        q: "Does SVG to PNG use the tracing engine?",
        a: "No. It renders the SVG in the browser and exports pixels, so raster tracing presets are intentionally not shown here.",
      },
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
    questions: [
      {
        q: "Can this remove a photo background?",
        a: "No. This tool edits SVG background shapes and canvas behavior. It does not use AI photo background removal.",
      },
      {
        q: "What should I do before exporting a transparent PNG?",
        a: "Remove or change the SVG background here first, then export with the SVG to PNG converter using transparency enabled.",
      },
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
    questions: [
      {
        q: "Can I turn text into SVG paths?",
        a: "Yes. The text tool can export SVG text graphics and path-style output depending on the selected settings.",
      },
      {
        q: "Can I use uploaded fonts?",
        a: "Yes, when you have the right to use the font. Check the exported result before using it in commercial or craft projects.",
      },
    ],
  },
  "/svg-to-pdf-converter": {
    eyebrow: "SVG to PDF export workflow",
    heading: "SVG to PDF for print, documents, classroom handouts, and design handoff",
    intro:
      "Use this browser export route when an existing SVG needs to become a PDF for printing, sharing, documentation, client review, or classroom materials. It uses PDF export settings instead of raster-to-SVG tracing presets.",
    bestFor: [
      "svg to pdf, convert svg to pdf, and svg to pdf converter searches.",
      "Print-ready documents, worksheets, product labels, icon sheets, and design handoff.",
      "Users who need paper size, orientation, margin, DPI, and preview controls.",
    ],
    settings: [
      "Choose paper size and orientation before exporting.",
      "Set margin and DPI based on print or document use.",
      "Use SVG cleaner first when the source has editor metadata or unsafe markup.",
    ],
    limitations: [
      "PDF export preserves the visual result, not every editing feature from the original design app.",
      "External fonts, filters, or linked images can affect browser-rendered export output.",
      "Use SVG to PNG or JPG when you need an image instead of a document.",
    ],
    related: [
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Export transparent or exact-size raster images." },
      { to: "/svg-to-jpg-converter", label: "SVG to JPG", reason: "Flatten SVG onto a solid image background." },
      { to: "/svg-resize-and-scale-editor", label: "SVG Resize and Scale", reason: "Adjust viewBox or dimensions before PDF export." },
      { to: "/svg-cleaner", label: "SVG Cleaner", reason: "Clean markup before print or document handoff." },
    ],
    questions: [
      {
        q: "Is SVG to PDF good for printing?",
        a: "Yes for many SVG graphics, worksheets, labels, and documents. Check paper size, margin, and preview before downloading.",
      },
      {
        q: "Does this upload my SVG?",
        a: "No. This route exports the SVG to PDF in the browser with client-side PDF/rendering tools.",
      },
    ],
  },
  "/svg-to-jpg-converter": {
    eyebrow: "SVG to JPG export workflow",
    heading: "SVG to JPG for flattened previews, email, social uploads, and web sharing",
    intro:
      "Use SVG to JPG when the destination does not support transparency or SVG files. The route renders SVG in the browser and exports JPEG with size, background, and quality controls.",
    bestFor: [
      "svg to jpg, svg to jpeg, and convert svg to jpg searches.",
      "Flattened previews, email attachments, social uploads, product mockups, and white-background graphics.",
      "Users who need a standard JPEG instead of transparent PNG.",
    ],
    settings: [
      "Choose a solid background because JPG does not preserve transparency.",
      "Set exact width and height for production or upload requirements.",
      "Adjust JPEG quality when file size matters.",
    ],
    limitations: [
      "JPG is raster output and can introduce compression artifacts.",
      "Transparent SVG areas are flattened onto the selected background.",
      "Use SVG to PNG when transparency matters.",
    ],
    related: [
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Use when transparent output is required." },
      { to: "/svg-to-pdf-converter", label: "SVG to PDF", reason: "Use for print or document workflows." },
      { to: "/svg-background-editor", label: "SVG Background Editor", reason: "Set the SVG background before flattening to JPG." },
      { to: "/svg-resize-and-scale-editor", label: "SVG Resize and Scale", reason: "Fix dimensions before export." },
    ],
    questions: [
      {
        q: "Can JPG keep transparency?",
        a: "No. JPG output is flattened onto a solid background. Use SVG to PNG when you need transparency.",
      },
      {
        q: "Does this retrace the SVG?",
        a: "No. It renders the existing SVG to a JPEG image in the browser.",
      },
    ],
  },
  "/svg-to-base64": {
    eyebrow: "SVG Base64 workflow",
    heading: "SVG to Base64 for data URLs, CSS embeds, HTML snippets, and prototypes",
    intro:
      "Use this page when you already have SVG markup and need encoded output for a data URL, CSS background, HTML image source, documentation, or quick prototype.",
    bestFor: [
      "svg to base64, SVG data URL, Base64 SVG, and encode SVG searches.",
      "Small SVG icons, code snippets, CSS embeds, email prototypes, and documentation examples.",
      "Users who need copy-ready Base64 or UTF-8 data URI output.",
    ],
    settings: [
      "Choose Base64 or UTF-8 data URL output based on where the SVG will be pasted.",
      "Use sanitization and minification before encoding unknown or messy SVG markup.",
      "Copy snippets for code, or download output when you need a reusable file.",
    ],
    limitations: [
      "Base64 makes source text longer and can be awkward for large SVGs.",
      "This route encodes SVG data; it does not trace PNG or JPG files.",
      "Use SVG cleaner first if the markup contains editor junk or unsafe content.",
    ],
    related: [
      { to: "/base64-to-svg", label: "Base64 to SVG", reason: "Decode SVG data URLs back into editable SVG source." },
      { to: "/svg-cleaner", label: "SVG Cleaner", reason: "Clean and sanitize before encoding." },
      { to: "/svg-minifier", label: "SVG Minifier", reason: "Reduce SVG text size before embedding." },
      { to: "/svg-embed-code-generator", label: "SVG Embed Code Generator", reason: "Generate HTML, CSS, and React embed snippets." },
    ],
    questions: [
      {
        q: "Should I use Base64 for every SVG?",
        a: "No. It is best for small embeds and snippets. Larger SVGs are usually easier to maintain as normal files.",
      },
      {
        q: "Can I decode the result later?",
        a: "Yes. Use Base64 to SVG to decode a Base64 SVG string or data URL back into SVG markup.",
      },
    ],
  },
  "/svg-cleaner": {
    eyebrow: "SVG cleanup workflow",
    heading: "SVG cleaner for safer markup, smaller files, and easier export",
    intro:
      "Use SVG Cleaner when an SVG has editor metadata, comments, unsafe script-like content, duplicated markup, or extra whitespace that gets in the way of embedding, export, or handoff.",
    bestFor: [
      "svg cleaner, clean svg, optimize svg, and remove SVG metadata searches.",
      "Web icons, app assets, design-system SVGs, craft files, and SVGs before Base64 or raster export.",
      "Users who need preview, copy, and download after cleanup.",
    ],
    settings: [
      "Remove metadata, comments, unsafe content, and unneeded markup where supported.",
      "Preview the cleaned output before copying or downloading.",
      "Use minifier next if the main goal is file size reduction.",
    ],
    limitations: [
      "Cleanup can remove unsafe or unnecessary markup, but it cannot fix every malformed SVG.",
      "Visual output should be checked after cleaning complex files.",
      "This route edits SVG markup and does not trace raster images.",
    ],
    related: [
      { to: "/svg-minifier", label: "SVG Minifier", reason: "Compress cleaned markup further." },
      { to: "/svg-background-editor", label: "SVG Background Editor", reason: "Change background behavior after cleanup." },
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Export cleaned SVG to PNG." },
      { to: "/svg-to-base64", label: "SVG to Base64", reason: "Encode cleaned SVG for embeds." },
    ],
    questions: [
      {
        q: "Does SVG Cleaner change the artwork?",
        a: "It is intended to remove unnecessary or unsafe markup while preserving visual output, but always preview complex files after cleanup.",
      },
      {
        q: "Should I clean SVG before Base64?",
        a: "Yes, cleaning and minifying before encoding usually makes data URLs easier to use.",
      },
    ],
  },
  "/image-to-svg-outline": {
    eyebrow: "Image outline workflow",
    heading: "Image to SVG outline for contour art, decals, maps, and simplified line work",
    intro:
      "Use this outline-focused route when the goal is not full-color vectorization, but a simplified edge, contour, or line-art SVG from a PNG or JPG image.",
    bestFor: [
      "image to SVG outline, photo outline SVG, line art outline, and laser/CNC outline searches.",
      "Decals, contour posters, simplified maps, classroom art, and maker paths.",
      "Users who want edge presets, cleanup controls, and full-screen output inspection.",
    ],
    settings: [
      "Start with Photo Edge or Lineart presets depending on the source image.",
      "Use edge threshold and cleanup controls for noisy photos or screenshots.",
      "Use SVG to PNG after tracing if you need a raster preview of the outline.",
    ],
    limitations: [
      "Outline conversion intentionally simplifies detail and may omit subtle tones.",
      "Very busy photos can produce too many paths unless edge cleanup is increased.",
      "Use PNG to SVG or JPG to SVG when you want a broader vector trace instead of outline-first output.",
    ],
    related: [
      { to: "/photo-to-svg-outline", label: "Photo to SVG Outline", reason: "Use a photo-specific contour workflow." },
      { to: "/line-art-to-svg-converter", label: "Line Art to SVG", reason: "Trace clear ink or drawing lines." },
      { to: "/scan-to-svg-converter", label: "Scan to SVG", reason: "Clean paper shadows and scanned marks." },
      { to: "/png-to-svg-for-laser-cutting", label: "PNG to SVG for Laser Cutting", reason: "Prepare outline-style paths for maker workflows." },
    ],
    questions: [
      {
        q: "Is outline SVG the same as layered SVG?",
        a: "No. Outline mode focuses on edges and contours. Layered SVG splits color regions into editable groups.",
      },
      {
        q: "What images work best?",
        a: "High-contrast images with clear subjects usually trace into cleaner outlines than low-contrast, busy photos.",
      },
    ],
  },
  "/cricut-svg-converter": {
    eyebrow: "Cricut SVG workflow",
    heading: "Cricut SVG converter for vinyl, stickers, labels, stencils, and cut-file prep",
    intro:
      "Use this route for craft-oriented SVG conversion. It keeps the tool focused on cut-friendly presets, cleanup, backgrounds, editable layers, and practical checks before importing into Cricut Design Space.",
    bestFor: [
      "Cricut SVG converter, PNG to SVG for Cricut, cut file SVG, vinyl SVG, and sticker SVG searches.",
      "Vinyl decals, sticker sheets, labels, stencils, classroom projects, Etsy files, and small-business craft graphics.",
      "Users who need route-specific Cricut presets without claiming official compatibility.",
    ],
    settings: [
      "Start with clean cut, vinyl, sticker, print then cut, or layered presets.",
      "Use cleanup settings to reduce tiny islands before cutting.",
      "Inspect layer visibility, colors, and final size before download.",
    ],
    limitations: [
      "iLoveSVG is not affiliated with Cricut.",
      "Material, blade, mat, and Design Space import behavior still need user review.",
      "No converter can guarantee perfect cut results for every noisy image or material.",
    ],
    related: [
      { to: "/png-to-svg-for-cricut", label: "PNG to SVG for Cricut", reason: "Use a PNG-specific craft workflow." },
      { to: "/png-to-svg-for-cricut-vinyl", label: "PNG to SVG for Cricut Vinyl", reason: "Focus on simple vinyl cut paths." },
      { to: "/png-to-svg-for-cricut-stickers", label: "PNG to SVG for Cricut Stickers", reason: "Prepare sticker and label artwork." },
      { to: "/layered-svg-for-cricut", label: "Layered SVG for Cricut", reason: "Create multicolor editable layers." },
      { to: "/png-to-svg-for-cricut-print-then-cut", label: "Print Then Cut SVG", reason: "Use printable artwork with cut-outline intent." },
    ],
    questions: [
      {
        q: "What preset should I use for Cricut?",
        a: "Start with clean cut for simple art, vinyl for decals, sticker for label edges, and layered presets for multicolor designs.",
      },
      {
        q: "Does this guarantee Cricut compatibility?",
        a: "No. It prepares cleaner SVG output, but you should inspect the file in your cutter software before cutting.",
      },
    ],
  },
  "/svg-to-favicon-generator": {
    eyebrow: "Favicon workflow",
    heading: "SVG to favicon generator for browser icons, app icons, and web projects",
    intro:
      "Use this route when an SVG logo or icon needs favicon output: browser icon sizes, favicon.ico, touch icons, manifest snippets, and preview assets.",
    bestFor: [
      "svg to favicon, favicon from SVG, favicon generator from SVG, and create favicon from SVG searches.",
      "Website launches, landing pages, portfolios, small-business sites, and app icon handoff.",
      "Users who need browser icon assets from an existing SVG mark.",
    ],
    settings: [
      "Start with a simple square SVG for best small-size readability.",
      "Generate the icon sizes your project needs rather than every possible file.",
      "Use SVG cleaner first if the source logo has extra editor markup.",
    ],
    limitations: [
      "Tiny favicons need simple shapes; detailed logos can become unreadable at 16 px.",
      "Different browsers may choose different favicon assets from your markup.",
      "This generator starts from SVG and does not vectorize raster logos.",
    ],
    related: [
      { to: "/svg-to-png-converter", label: "SVG to PNG", reason: "Create PNG exports for icons and previews." },
      { to: "/svg-resize-and-scale-editor", label: "SVG Resize and Scale", reason: "Fix square canvas and viewBox sizing." },
      { to: "/svg-cleaner", label: "SVG Cleaner", reason: "Clean logo markup before icon generation." },
      { to: "/logo-to-svg-converter", label: "Logo to SVG", reason: "Vectorize a raster logo before making favicons." },
    ],
    questions: [
      {
        q: "What SVG works best for favicons?",
        a: "Simple, high-contrast marks with a square viewBox usually survive small browser icon sizes best.",
      },
      {
        q: "Can I make a favicon from a PNG logo?",
        a: "First convert or trace the PNG with Logo to SVG, then use this favicon generator from the SVG result.",
      },
    ],
  },
  "/logo-to-svg-converter": {
    eyebrow: "Logo vectorization workflow",
    heading: "Logo to SVG for brand marks, small-business graphics, stickers, and web assets",
    intro:
      "Use this route when the source is a logo or simple brand mark rather than a general photo. Logo-tuned presets emphasize sharper edges, cleaner curves, transparent backgrounds, and editable SVG output.",
    bestFor: [
      "logo to SVG, vectorize logo, convert logo to SVG, and PNG logo to SVG searches.",
      "Small-business logos, sticker labels, web headers, favicons, decals, and merch graphics.",
      "Users who need copy, download, preview, and cleanup controls after tracing.",
    ],
    settings: [
      "Start with Logo - Sharp, Logo - Smooth, Icon - Bold, or clean lineart presets.",
      "Use transparent or white-remove presets when the logo sits on a plain canvas.",
      "Use layer editing to check brand colors before copy or download.",
    ],
    limitations: [
      "Logo tracing works best on clear, high-contrast source images.",
      "Tiny text, gradients, shadows, and compression artifacts may need cleanup or manual editing.",
      "Use SVG to Favicon after the logo is already a clean SVG.",
    ],
    related: [
      { to: "/png-to-svg-converter", label: "PNG to SVG", reason: "Use for transparent PNG logos and icons." },
      { to: "/svg-to-favicon-generator", label: "SVG to Favicon", reason: "Turn the finished logo SVG into browser icons." },
      { to: "/svg-background-editor", label: "SVG Background Editor", reason: "Remove or change logo backgrounds." },
      { to: "/svg-recolor", label: "SVG Recolor", reason: "Adjust brand colors after conversion." },
      { to: "/logo-to-svg-for-cricut", label: "Logo to SVG for Cricut", reason: "Prepare logo artwork for decals, labels, and craft files." },
    ],
    questions: [
      {
        q: "Can I convert a JPG logo to SVG?",
        a: "Yes, but JPG compression can add noise. Use logo or cleanup presets and inspect the SVG before using it commercially.",
      },
      {
        q: "Will the logo remain editable?",
        a: "The SVG output can be copied, downloaded, previewed, and edited with supported layer/color controls when metadata is available.",
      },
    ],
  },
  "/png-to-svg-for-cricut": {
    eyebrow: "PNG to Cricut SVG workflow",
    heading: "PNG to SVG for Cricut Design Space, vinyl decals, stickers, and labels",
    intro:
      "This route keeps PNG-to-SVG conversion focused on craft use. It emphasizes cut-friendly presets, background cleanup, visible speed tags, editable output, and practical review before importing into Cricut Design Space.",
    bestFor: [
      "png to SVG for Cricut, Cricut SVG converter, cut file SVG, vinyl SVG, and sticker SVG searches.",
      "Transparent PNG craft art, decals, labels, sticker sheets, stencils, and small-shop SVG files.",
      "Creators who need a more specific workflow than the general PNG to SVG page.",
    ],
    settings: [
      "Use clean cut for simple artwork, vinyl for decals, and sticker presets for edge-focused designs.",
      "Use remove white or transparent/background controls for PNGs with plain backgrounds.",
      "Use full-screen preview and layer editing before downloading the SVG.",
    ],
    limitations: [
      "The tool prepares SVG output, but it cannot guarantee final cutter, material, or Design Space behavior.",
      "Noisy PNGs, tiny islands, and thin lines can make weeding or cutting harder.",
      "Use layered SVG routes when each color needs a separate editable layer.",
    ],
    related: [
      { to: "/cricut-svg-converter", label: "Cricut SVG Converter", reason: "Use the broader craft SVG workflow." },
      { to: "/png-to-svg-for-cricut-vinyl", label: "PNG to SVG for Vinyl", reason: "Focus on simpler vinyl decals and weedable paths." },
      { to: "/png-to-svg-for-cricut-stickers", label: "PNG to SVG for Stickers", reason: "Prepare sticker and label artwork." },
      { to: "/png-to-layered-svg-for-cricut", label: "PNG to Layered SVG", reason: "Split multicolor PNG artwork into layers." },
      { to: "/png-to-svg-converter", label: "PNG to SVG", reason: "Use the general PNG vectorizer for non-craft output." },
    ],
    questions: [
      {
        q: "What PNG works best for Cricut SVG?",
        a: "Clean, high-contrast PNG artwork with simple shapes usually converts into more usable craft SVG output.",
      },
      {
        q: "Should I use layered SVG for Cricut?",
        a: "Use layered SVG when colors need to be separated and edited. Use a single cut preset for simpler vinyl or stencil output.",
      },
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
    shortTitle: "Image -> SVG",
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
    shortTitle: "PNG -> SVG",
    description:
      "Convert PNG images to SVG vectors for scalable logos, icons, graphics, and print-ready artwork.",
    to: "/png-to-svg-converter",
    group: "Image to SVG",
    keywords: ["png to svg", "vectorize png", "transparent png to svg"],
  },
  {
    id: "jpg-to-svg",
    title: "JPG to SVG Converter",
    shortTitle: "JPG -> SVG",
    description:
      "Convert JPG images into scalable SVG files for web graphics, posters, and print projects.",
    to: "/jpg-to-svg-converter",
    group: "Image to SVG",
    keywords: ["jpg to svg", "vectorize jpg", "image to svg"],
  },
  {
    id: "jpeg-to-svg",
    title: "JPEG to SVG Converter",
    shortTitle: "JPEG -> SVG",
    description:
      "Convert JPEG images to SVG with clean vector-style output for resizing without blur.",
    to: "/jpeg-to-svg-converter",
    group: "Image to SVG",
    keywords: ["jpeg to svg", "vectorize jpeg", "photo to svg"],
  },
  {
    id: "webp-to-svg",
    title: "WebP to SVG Converter",
    shortTitle: "WebP -> SVG",
    description:
      "Convert WebP images to SVG for scalable assets and consistent rendering across sizes.",
    to: "/webp-to-svg-converter",
    group: "Image to SVG",
    keywords: ["webp to svg", "vectorize webp", "image to svg"],
  },
  {
    id: "logo-to-svg",
    title: "Logo to SVG Converter",
    shortTitle: "Logo -> SVG",
    description:
      "Turn a logo into a scalable SVG for brand kits, websites, printing, and sharp resizing.",
    to: "/logo-to-svg-converter",
    group: "Image to SVG",
    keywords: ["logo to svg", "brand", "vector logo", "vectorize logo"],
  },
  {
    id: "icon-to-svg",
    title: "Icon to SVG Converter",
    shortTitle: "Icon -> SVG",
    description:
      "Convert icons to SVG for crisp scaling, theming, UI use, and consistent rendering.",
    to: "/icon-to-svg-converter",
    group: "Image to SVG",
    keywords: ["icon to svg", "vector icon", "ui icon svg"],
  },
  {
    id: "emoji-to-svg",
    title: "Emoji to SVG Converter",
    shortTitle: "Emoji -> SVG",
    description:
      "Convert emoji-style images to SVG for scalable stickers, icons, overlays, and graphics.",
    to: "/emoji-to-svg-converter",
    group: "Image to SVG",
    keywords: ["emoji to svg", "vector emoji", "sticker svg"],
  },
  {
    id: "text-to-svg",
    title: "Text to SVG Converter",
    shortTitle: "Text -> SVG",
    description:
      "Convert text into SVG for logos, wordmarks, headings, and scalable typography graphics.",
    to: "/text-to-svg-converter",
    group: "Image to SVG",
    keywords: ["text to svg", "wordmark", "typography", "vector text"],
  },
  {
    id: "sticker-to-svg",
    title: "Sticker to SVG Converter",
    shortTitle: "Sticker -> SVG",
    description:
      "Convert sticker images to SVG for clean cut lines, scaling, decals, and print-ready output.",
    to: "/sticker-to-svg-converter",
    group: "Image to SVG",
    keywords: ["sticker to svg", "decal", "decal svg", "cut file"],
  },
  {
    id: "line-art-to-svg",
    title: "Line Art to SVG Converter",
    shortTitle: "Line Art -> SVG",
    description:
      "Convert line art into SVG for crisp outlines, coloring pages, decals, and cut-friendly paths.",
    to: "/line-art-to-svg-converter",
    group: "Image to SVG",
    keywords: ["line art to svg", "outline to svg", "trace line art"],
  },
  {
    id: "drawing-to-svg",
    title: "Drawing to SVG Converter",
    shortTitle: "Drawing -> SVG",
    description:
      "Convert a drawing into SVG so it stays sharp at any size for prints, merch, and design edits.",
    to: "/drawing-to-svg-converter",
    group: "Image to SVG",
    keywords: ["drawing to svg", "hand drawn to svg", "vectorize drawing"],
  },
  {
    id: "scan-to-svg",
    title: "Scan to SVG Converter",
    shortTitle: "Scan -> SVG",
    description:
      "Convert scanned images to SVG for cleanup, scaling, document graphics, and printable art.",
    to: "/scan-to-svg-converter",
    group: "Image to SVG",
    keywords: ["scan to svg", "scanned image to svg", "vectorize scan"],
  },
  {
    id: "sketch-to-svg",
    title: "Sketch to SVG Converter",
    shortTitle: "Sketch -> SVG",
    description:
      "Vectorize sketches into SVG for clean scaling, editing, and consistent line output.",
    to: "/sketch-to-svg-converter",
    group: "Image to SVG",
    keywords: ["sketch to svg", "pencil sketch to svg", "vectorize sketch"],
  },
  {
    id: "image-to-svg-outline",
    title: "Image to SVG Outline Converter",
    shortTitle: "Image -> Outline",
    description:
      "Generate an outline SVG from an image for clean line art, decals, and cut-ready shapes.",
    to: "/image-to-svg-outline",
    group: "Image to SVG",
    keywords: ["image to svg outline", "outline svg", "line art svg"],
  },
  {
    id: "photo-to-svg-outline",
    title: "Photo to SVG Outline Converter",
    shortTitle: "Photo -> Outline",
    description:
      "Create an outline-style SVG from a photo for posters, stickers, simplified art, and decals.",
    to: "/photo-to-svg-outline",
    group: "Image to SVG",
    keywords: ["photo to svg outline", "outline svg", "trace photo"],
  },
  {
    id: "black-and-white-image-to-svg",
    title: "Black and White Image to SVG Converter",
    shortTitle: "B&W -> SVG",
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
    shortTitle: "Image -> Cricut SVG",
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
    shortTitle: "PNG -> Cricut SVG",
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
    shortTitle: "JPG -> Cricut SVG",
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
    shortTitle: "JPEG -> Cricut SVG",
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
    shortTitle: "WebP -> Cricut SVG",
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
    shortTitle: "Photo -> Cricut SVG",
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
    shortTitle: "B&W -> Cricut SVG",
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
    shortTitle: "Line Art -> Cricut SVG",
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
    shortTitle: "Drawing -> Cricut SVG",
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
    shortTitle: "Sketch -> Cricut SVG",
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
    shortTitle: "Sticker -> Cricut SVG",
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
    shortTitle: "Logo -> Cricut SVG",
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
    shortTitle: "Base64 -> Cricut SVG",
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
    shortTitle: "Code -> Cricut SVG",
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
    shortTitle: "Image -> Layered SVG",
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
    shortTitle: "PNG -> Layered SVG",
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
    shortTitle: "JPG -> Layered SVG",
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
    shortTitle: "Logo -> Layered SVG",
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
    shortTitle: "PNG -> Etsy SVG",
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
    shortTitle: "PNG -> Silhouette SVG",
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
    shortTitle: "SVG -> PNG",
    description:
      "Convert SVG to PNG with clean edges, transparent background support, and fast export.",
    to: "/svg-to-png-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to png", "export png", "transparent png"],
  },
  {
    id: "svg-to-jpg",
    title: "SVG to JPG Converter",
    shortTitle: "SVG -> JPG",
    description:
      "Export SVG as JPG or JPEG for sharing, email, previews, and standard image workflows.",
    to: "/svg-to-jpg-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to jpg", "svg to jpeg", "export jpg"],
  },
  {
    id: "svg-to-webp",
    title: "SVG to WebP Converter",
    shortTitle: "SVG -> WebP",
    description:
      "Convert SVG to WebP for smaller files, modern websites, and efficient image delivery.",
    to: "/svg-to-webp-converter",
    group: "SVG to image/PDF",
    keywords: ["svg to webp", "convert svg", "image optimization"],
  },
  {
    id: "svg-to-pdf",
    title: "SVG to PDF Converter",
    shortTitle: "SVG -> PDF",
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
    shortTitle: "SVG -> Base64",
    description:
      "Encode SVG as Base64 for embedding in CSS, HTML, image tags, or data URLs.",
    to: "/svg-to-base64",
    group: "Base64",
    keywords: ["svg base64", "encode svg", "data url", "base64 svg"],
  },
  {
    id: "base64-to-svg",
    title: "Base64 to SVG Decoder",
    shortTitle: "Base64 -> SVG",
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
