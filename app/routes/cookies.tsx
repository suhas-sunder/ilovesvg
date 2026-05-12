/* eslint-disable react/no-unescaped-entities */

import * as React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/cookies";
import SocialLinks from "../client/components/navigation/SocialLinks";
import { OtherToolsLinks } from "../client/components/navigation/OtherToolsLinks";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import { COOKIE_POLICY_COPY, COOKIE_RELATED_SITES } from "~/content/legal/policyRouteContent";

export const meta: Route.MetaFunction = () => {
  const canonical = "https://www.ilovesvg.com/cookies";

  const title = "Cookies Policy | i🩵SVG";
  const description =
    "Read the i🩵SVG cookies policy. Learn how cookies and similar technologies are used on the i🩵SVG website.";

  const ogImage = "https://www.ilovesvg.com/og/ilovesvg-cookies.jpg";

  return [
    { title },
    { name: "description", content: description },

    { tagName: "link", rel: "canonical", href: canonical },

    { property: "og:site_name", content: "i🩵SVG" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { property: "og:image", content: ogImage },
    { property: "og:image:alt", content: "i🩵SVG cookies policy" },
    { property: "og:locale", content: "en_US" },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },

    { name: "robots", content: "noindex,follow" },
  ];
};

export default function CookiesPolicy() {
  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          {/* Header */}
          <header className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="text-sm">
              <ol className="flex flex-wrap items-center gap-2 text-slate-600">
                <li>
                  <Link
                    to="/"
                    className="hover:text-slate-900 hover:underline underline-offset-4"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden className="opacity-60">
                  /
                </li>
                <li
                  aria-current="page"
                  className="text-slate-900 font-semibold"
                >
                  Cookies Policy
                </li>
              </ol>
            </nav>

            <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">
              Cookies Policy
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {COOKIE_POLICY_COPY.lastUpdated}
            </p>

            <div className="mt-5 space-y-4 text-slate-700 leading-relaxed">
              {COOKIE_POLICY_COPY.introParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </header>

          {/* Content */}
          <article className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="prose prose-slate max-w-none">
              <CookieTextSection section={COOKIE_POLICY_COPY.cookieBasics} />
              <CookieTextSection section={COOKIE_POLICY_COPY.whyUseCookies} />
              <CookieTextSection section={COOKIE_POLICY_COPY.analytics} />

              <Section title={COOKIE_POLICY_COPY.advertising.title}>
                {COOKIE_POLICY_COPY.advertising.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <h3 className="text-lg font-bold text-slate-900 mt-6">
                  {COOKIE_POLICY_COPY.advertising.googleTitle}
                </h3>
                <p>{COOKIE_POLICY_COPY.advertising.googleParagraph}</p>

                <div className="mt-4 flex flex-col gap-2">
                  {COOKIE_POLICY_COPY.advertising.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-900 hover:underline underline-offset-4"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </Section>

              <CookieTextSection section={COOKIE_POLICY_COPY.cookieControls} />

              <Section title={COOKIE_POLICY_COPY.browserControls.title}>
                {COOKIE_POLICY_COPY.browserControls.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p>
                  {COOKIE_POLICY_COPY.browserControls.prompt}
                  <span className="block mt-2">
                    {COOKIE_POLICY_COPY.browserControls.browsers}
                  </span>
                </p>
              </Section>

              <CookieTextSection section={COOKIE_POLICY_COPY.otherTracking} />
              <CookieTextSection section={COOKIE_POLICY_COPY.localStorage} />
              <CookieTextSection section={COOKIE_POLICY_COPY.updates} />
              <CookieTextSection section={COOKIE_POLICY_COPY.contact} />
            </div>

            <div >
              <SocialLinks />
            </div>
          </article>

          {/* Bottom sections */}
          <OtherToolsLinks />
          <RelatedSites />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg md:text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 text-sm md:text-base text-slate-700 leading-relaxed space-y-4">
        {children}
      </div>
    </section>
  );
}

function CookieTextSection({
  section,
}: {
  section: { title: string; paragraphs: string[] };
}) {
  return (
    <Section title={section.title}>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </Section>
  );
}

/* ========================
   Related sites (full-card clickable, safe linking)
======================== */
export function RelatedSites() {
  return (
    <section className="mt-10 border-t border-slate-200 bg-white">
      <div className="max-w-[1180px] mx-auto px-4 py-10">
        <h2 className="text-base font-bold text-slate-900">Related sites</h2>
        <p className="mt-1 text-sm text-slate-600 max-w-[85ch]">
          Related projects you may enjoy. Each one is a focused site built to be
          fast, simple, and useful.
        </p>

        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {COOKIE_RELATED_SITES.map((site) => (
            <li key={site.id} className="min-w-0">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "group block rounded-xl border border-slate-200 bg-white p-5 transition",
                  "hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-slate-400",
                ].join(" ")}
                aria-label={`${site.name} - ${site.description}`}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 group-hover:underline underline-offset-4">
                      {site.name}
                    </span>
                    <span className="text-[11px] text-slate-400">↗</span>
                  </div>
                  <p className="text-sm text-slate-600">{site.description}</p>
                  <span className="mt-2 text-xs text-slate-500">
                    Visit {new URL(site.url).hostname}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
