import * as React from "react";
import { Link } from "react-router";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import {
  getPresetIntensityBadge,
  type PresetBackendIntensity,
} from "~/client/lib/converter/presetIntensity";
import { DOCS_PAGES, SITE_URL, type DocsPage } from "~/client/lib/docs/howItWorksContent";
import { getRouteMonetizationPolicy } from "~/client/lib/monetization/monetizationPolicy";

type DocsTone = "sky" | "emerald" | "violet" | "amber" | "rose" | "cyan";

const TONE_STYLES: Record<
  DocsTone,
  {
    border: string;
    background: string;
    accent: string;
    text: string;
    ring: string;
  }
> = {
  sky: {
    border: "border-sky-200",
    background: "bg-sky-50",
    accent: "bg-sky-500",
    text: "text-sky-800",
    ring: "focus-visible:ring-sky-300",
  },
  emerald: {
    border: "border-emerald-200",
    background: "bg-emerald-50",
    accent: "bg-emerald-500",
    text: "text-emerald-800",
    ring: "focus-visible:ring-emerald-300",
  },
  violet: {
    border: "border-violet-200",
    background: "bg-violet-50",
    accent: "bg-violet-500",
    text: "text-violet-800",
    ring: "focus-visible:ring-violet-300",
  },
  amber: {
    border: "border-amber-200",
    background: "bg-amber-50",
    accent: "bg-amber-500",
    text: "text-amber-800",
    ring: "focus-visible:ring-amber-300",
  },
  rose: {
    border: "border-rose-200",
    background: "bg-rose-50",
    accent: "bg-rose-500",
    text: "text-rose-800",
    ring: "focus-visible:ring-rose-300",
  },
  cyan: {
    border: "border-cyan-200",
    background: "bg-cyan-50",
    accent: "bg-cyan-500",
    text: "text-cyan-800",
    ring: "focus-visible:ring-cyan-300",
  },
};

const TONES: DocsTone[] = ["sky", "emerald", "violet", "amber", "rose", "cyan"];
const HERO_SPEEDS: PresetBackendIntensity[] = [
  "lightning-fast",
  "extreme-speed",
  "high-speed",
  "low-speed",
  "slow-speed",
  "very-slow",
  "insanely-slow",
];
const DOCS_COMPACT_AD_SLOT = "8102088582";

export function DocsPageShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#f8fafc_46%,#ffffff_100%)] text-slate-900">
        {children}
        <DocsCompactAd currentPath={currentPath} />
        <DocsRelatedReads currentPath={currentPath} />
      </main>
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

function DocsCompactAd({ currentPath }: { currentPath: string }) {
  const monetizationPolicy = getRouteMonetizationPolicy(currentPath);
  if (
    !monetizationPolicy.ads ||
    monetizationPolicy.placement !== "docs-compact-ad"
  ) {
    return null;
  }

  return (
    <section
      aria-label="Sponsored advertisement"
      className="mx-auto max-w-6xl overflow-hidden px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8"
      style={{ maxHeight: 180, overflow: "hidden" }}
      data-monetization-kind="adsense"
      data-monetization-slot="docs-help-compact"
      data-monetization-reserve="compact"
    >
      <div className="mx-auto flex min-h-[120px] w-full max-w-[970px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white/85 p-2 shadow-sm">
        <AdSenseDelayed
          slot={DOCS_COMPACT_AD_SLOT}
          delayMs={1500}
          minHeight={120}
          maxHeight={120}
          format="horizontal"
          fullWidth={false}
          className="mx-auto w-full max-w-[970px]"
        />
      </div>
    </section>
  );
}

export function DocsHero({
  eyebrow,
  title,
  description,
  actions,
  highlights,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  highlights?: readonly string[];
}) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#effaff_0%,#ffffff_47%,#eef4ff_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_92%_18%,rgba(124,58,237,0.12),transparent_24%),linear-gradient(90deg,rgba(14,165,233,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(14,165,233,0.04)_1px,transparent_1px)] bg-[length:auto,auto,44px_44px,44px_44px]" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-center lg:px-8 lg:py-16">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-sky-700">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-sky-950 sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
            {description}
          </p>
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        <aside className="rounded-[1.35rem] border border-white/80 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-sky-950">Guide focus</p>
            <Link
              to="/how-it-works"
              className="cursor-pointer rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Hub
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Preset speed color scale">
            {HERO_SPEEDS.map((speed) => {
              const badge = getPresetIntensityBadge({ backendIntensity: speed });
              return (
                <span
                  key={speed}
                  className={["h-2.5 flex-1 rounded-full border", badge.className].join(" ")}
                  title={badge.label}
                />
              );
            })}
          </div>
          <ul className="mt-5 space-y-3">
            {(highlights && highlights.length > 0
              ? highlights
              : [
                  "Current app behavior only.",
                  "Preset speed and output tradeoffs.",
                  "Practical next steps, not filler.",
                ]
            ).map((item, index) => {
              const tone = TONE_STYLES[TONES[index % TONES.length]];
              return (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <span
                    className={[
                      "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white",
                      tone.accent,
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            These guides are intentionally separate from the active converter so the tool stays upload-first.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function DocsContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {children}
    </div>
  );
}

export function SectionBlock({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  const tone = TONE_STYLES[toneForKey(title)];
  return (
    <section
      className={[
        "mt-8 overflow-hidden rounded-[1.35rem] border bg-white shadow-[0_14px_44px_rgba(15,23,42,0.08)]",
        tone.border,
      ].join(" ")}
    >
      <div className={["h-1.5", tone.accent].join(" ")} />
      <div className="p-5 sm:p-7">
        <h2 className="text-2xl font-black leading-tight text-sky-950">{title}</h2>
        {intro ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{intro}</p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

export function CardGrid({
  children,
  columns = "lg:grid-cols-3",
}: {
  children: React.ReactNode;
  columns?: string;
}) {
  return <div className={["grid gap-4 sm:grid-cols-2", columns].join(" ")}>{children}</div>;
}

export function LinkCard({ page }: { page: DocsPage }) {
  const tone = TONE_STYLES[toneForKey(page.path)];
  return (
    <Link
      to={page.path}
      className={[
        "group flex h-full min-w-0 flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 cursor-pointer",
        tone.border,
        tone.ring,
      ].join(" ")}
    >
      <span className={["mb-4 h-2 w-14 rounded-full", tone.accent].join(" ")} />
      <span className="text-base font-black text-slate-950 group-hover:text-sky-800">{page.title}</span>
      <span className="mt-2 text-sm leading-6 text-slate-600">{page.description}</span>
      <span className={["mt-auto pt-4 text-xs font-black", tone.text].join(" ")}>Read guide</span>
    </Link>
  );
}

export function SimpleCard({
  title,
  body,
  footer,
  tone,
}: {
  title: string;
  body: React.ReactNode;
  footer?: React.ReactNode;
  tone?: DocsTone;
}) {
  const resolvedTone = TONE_STYLES[tone ?? toneForKey(title)];
  return (
    <div
      className={[
        "h-full min-w-0 rounded-2xl border bg-white p-4 shadow-sm",
        resolvedTone.border,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className={["mt-1 h-3 w-3 shrink-0 rounded-full", resolvedTone.accent].join(" ")} />
        <h3 className="text-base font-black leading-6 text-slate-950">{title}</h3>
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{body}</div>
      {footer ? <div className="mt-4 text-sm">{footer}</div> : null}
    </div>
  );
}

export function NumberedStepCard({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const tone = TONE_STYLES[TONES[index % TONES.length]];
  return (
    <li
      className={[
        "flex min-w-0 gap-3 rounded-2xl border p-4 text-sm leading-6 text-slate-700 shadow-sm",
        tone.border,
        tone.background,
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm",
          tone.accent,
        ].join(" ")}
      >
        {index + 1}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function PillLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex cursor-pointer items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      {children}
    </Link>
  );
}

export function SpeedBadge({ intensity }: { intensity: PresetBackendIntensity }) {
  const badge = getPresetIntensityBadge({ backendIntensity: intensity });
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black",
        badge.className,
      ].join(" ")}
      title={badge.title}
    >
      {badge.label}
    </span>
  );
}

export function DocsRelatedReads({ currentPath }: { currentPath: string }) {
  const relatedPages = DOCS_PAGES.filter((page) => page.path !== currentPath);
  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16 lg:px-8">
      <div className="overflow-hidden rounded-[1.45rem] border border-rose-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
        <div className="h-2 bg-[linear-gradient(90deg,#ff2b6a,#f59e0b,#14b8a6,#2563eb,#8b5cf6)]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black leading-tight text-sky-950 sm:text-3xl">
                Useful next reads
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Keep moving through the converter guides without turning the page header into another nav bar.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {relatedPages.map((page) => (
              <PillLink key={page.path} to={page.path}>
                {page.title}
              </PillLink>
            ))}
            <Link
              to="/sitemap"
              className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Browse all tools
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DocsJsonLd({
  path,
  title,
  description,
  faqs,
}: {
  path: string;
  title: string;
  description: string;
  faqs?: Array<{ q: string; a: string }>;
}) {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      name: title,
      url,
      description,
      isPartOf: {
        "@type": "WebSite",
        name: "iLoveSVG",
        url: SITE_URL,
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "How It Works",
          item: `${SITE_URL}/how-it-works`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: title,
          item: url,
        },
      ],
    },
  ];

  if (faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}

function toneForKey(key: string): DocsTone {
  let total = 0;
  for (let index = 0; index < key.length; index += 1) {
    total += key.charCodeAt(index);
  }
  return TONES[total % TONES.length];
}
