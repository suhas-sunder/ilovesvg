/* eslint-disable react/no-unescaped-entities */

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/privacy-policy";
import SocialLinks from "../client/components/navigation/SocialLinks";
import { OtherToolsLinks } from "../client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "../client/components/navigation/RelatedSites";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import { PRIVACY_POLICY_COPY } from "~/content/legal/privacyPolicyContent";

export const meta: Route.MetaFunction = () => {
  const canonical = "https://www.ilovesvg.com/privacy-policy";

  const title = "Privacy Policy | i🩵SVG";
  const description =
    "Read the i🩵SVG privacy policy. Learn how data is handled and protected when you use i🩵SVG tools.";

  const ogImage = "https://www.ilovesvg.com/og/ilovesvg-privacy.jpg";

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
    { property: "og:image:alt", content: "i🩵SVG privacy policy" },
    { property: "og:locale", content: "en_US" },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },

    { name: "robots", content: "noindex,follow" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <>

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          {/* Header */}
          <header className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
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
                  Privacy Policy
                </li>
              </ol>
            </nav>

            <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">
              Privacy Policy
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {PRIVACY_POLICY_COPY.lastUpdated}
            </p>

            <div className="mt-5 space-y-4 text-slate-700 leading-relaxed">
              {PRIVACY_POLICY_COPY.intro}
            </div>
          </header>

          {/* Content */}
          <article className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="prose prose-slate max-w-none">
              {PRIVACY_POLICY_COPY.sections.map((section) => (
                <Section key={section.title} title={section.title}>
                  {section.content}
                </Section>
              ))}
            </div>

            <div >
              <SocialLinks />
            </div>
          </article>

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
  children: ReactNode;
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
