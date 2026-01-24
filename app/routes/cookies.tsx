/* eslint-disable react/no-unescaped-entities */

import * as React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/cookies";
import SocialLinks from "../client/components/navigation/SocialLinks";
import { OtherToolsLinks } from "../client/components/navigation/OtherToolsLinks";

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
      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
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
              Last updated January 10, 2026
            </p>

            <div className="mt-5 space-y-4 text-slate-700 leading-relaxed">
              <p>
                This Cookie Policy explains how https://www.ilovesvg.com
                ("Company", "we", "us", and "our") uses cookies and similar
                technologies to recognize you when you visit our website at
                https://www.ilovesvg.com ("Website"). It explains what these
                technologies are and why we use them, as well as your rights to
                control our use of them.
              </p>

              <p>
                In some cases we may use cookies and similar technologies to
                collect personal information, or that becomes personal
                information if we combine it with other information. For more
                information about how we handle personal information, please see
                our Privacy Policy.
              </p>
            </div>
          </header>

          {/* Content */}
          <article className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="prose prose-slate max-w-none">
              <Section title="What are cookies?">
                <p>
                  Cookies are small data files that are placed on your computer
                  or mobile device when you visit a website. Cookies are widely
                  used by website owners in order to make their websites work,
                  or to work more efficiently, as well as to provide reporting
                  information.
                </p>
                <p>
                  Cookies set by the website owner (in this case,
                  https://www.ilovesvg.com) are called "first-party cookies."
                  Cookies set by parties other than the website owner are called
                  "third-party cookies." Third-party cookies enable third-party
                  features or functionality to be provided on or through the
                  website (for example, advertising, interactive content, and
                  analytics). The parties that set these third-party cookies can
                  recognize your device both when it visits the website in
                  question and also when it visits certain other websites.
                </p>
              </Section>

              <Section title="Why do we use cookies?">
                <p>
                  We use first- and third-party cookies for several reasons.
                  Some cookies are required for technical reasons in order for
                  our Website to operate, and we refer to these as "essential"
                  or "strictly necessary" cookies. Other cookies enable us to
                  understand how our Website is used and to improve performance
                  and user experience. We may also use cookies for advertising
                  purposes, including serving ads and measuring ad performance.
                  This is described in more detail below.
                </p>
              </Section>

              <Section title="Analytics and performance cookies">
                <p>
                  These cookies (and similar technologies) collect information
                  that is used either in aggregate form to help us understand
                  how our Website is being used, to improve site performance,
                  and to help diagnose errors. We currently use PostHog for
                  analytics, which may set cookies or use similar identifiers
                  depending on your browser and our configuration.
                </p>
                <p>
                  Note: The specific cookies and identifiers used can vary over
                  time (for example, based on configuration changes or vendor
                  updates).
                </p>
              </Section>

              <Section title="Advertising cookies">
                <p>
                  We may display advertisements on our Website through Google
                  AdSense and/or other advertising partners. Advertising
                  providers may use cookies or similar technologies to serve
                  ads, limit ad frequency, measure ad performance, and deliver
                  ads that may be relevant to your interests.
                </p>

                <h3 className="text-lg font-bold text-slate-900 mt-6">
                  Google advertising cookies
                </h3>
                <p>
                  Google uses cookies to help serve the ads it displays on the
                  websites of its partners, such as websites displaying Google
                  ads or participating in Google certified ad networks. When
                  users visit a Google partner website, a cookie may be dropped
                  on that user's browser.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="https://policies.google.com/technologies/cookies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-900 hover:underline underline-offset-4"
                  >
                    Find out how Google uses cookies...
                  </a>
                  <a
                    href="https://adssettings.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-900 hover:underline underline-offset-4"
                  >
                    Manage Google Ads Settings...
                  </a>
                  <a
                    href="https://optout.aboutads.info/?c=2&lang=EN"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-900 hover:underline underline-offset-4"
                  >
                    Opt out via aboutads.info...
                  </a>
                </div>
              </Section>

              <Section title="How can I control cookies?">
                <p>
                  You have the right to decide whether to accept or reject
                  cookies. You can usually exercise your cookie rights by
                  setting your preferences in a cookie banner or consent manager
                  (if we display one), or by changing your browser settings.
                </p>
                <p>
                  Please note that essential cookies cannot be rejected in some
                  cases because they are strictly necessary to provide you with
                  core site functionality. If you choose to reject cookies, you
                  may still use our Website, though your access to some
                  functionality and areas of our Website may be restricted.
                </p>
              </Section>

              <Section title="How can I control cookies on my browser?">
                <p>
                  The means by which you can refuse cookies through your browser
                  controls vary from browser to browser, so you should visit
                  your browser's help menu for more information.
                </p>
                <p>
                  Useful starting points:
                  <span className="block mt-2">
                    Chrome, Firefox, Safari, Edge, Opera
                  </span>
                </p>
              </Section>

              <Section title="What about other tracking technologies, like web beacons?">
                <p>
                  Cookies are not the only way to recognize or track visitors to
                  a website. We may use other, similar technologies from time to
                  time, like web beacons (sometimes called "tracking pixels" or
                  "clear gifs"). These are tiny graphics files that contain a
                  unique identifier that enables us to recognize when someone
                  has visited our Website or interacted with our content. In
                  many instances, these technologies rely on cookies to function
                  properly, so declining cookies may impair their functioning.
                </p>
              </Section>

              <Section title="Do you use local storage or similar technologies?">
                <p>
                  Some site features and third-party tools may use local storage
                  (such as Local Storage, Session Storage, IndexedDB, or
                  similar) to store information on your device. These
                  technologies are used for purposes similar to cookies, such as
                  remembering preferences, improving site performance, and
                  measuring usage.
                </p>
                <p>
                  You can typically clear or control local storage through your
                  browser settings. Disabling or clearing it may impact certain
                  website functionality.
                </p>
              </Section>

              <Section title="How often will you update this Cookie Policy?">
                <p>
                  We may update this Cookie Policy from time to time in order to
                  reflect changes to the cookies and technologies we use or for
                  other operational, legal, or regulatory reasons. Please
                  revisit this Cookie Policy regularly to stay informed about
                  our use of cookies and related technologies.
                </p>
                <p>
                  The date at the top of this Cookie Policy indicates when it
                  was last updated.
                </p>
              </Section>

              <Section title="Where can I get further information?">
                <p>
                  If you have any questions about our use of cookies or other
                  technologies, please contact us at: admin@ilovesvg.com.
                </p>
              </Section>
            </div>

            <div className="mt-10">
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

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-6 text-sm text-slate-600 flex items-center justify-between">
        <span>© {new Date().getFullYear()} i🩵SVG</span>
        <span className="space-x-3">
          <a href="/privacy-policy" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="/terms-of-service" className="hover:text-slate-900">
            Terms
          </a>
          <a href="/cookies" className="hover:text-slate-900">
            Cookies
          </a>
        </span>
      </div>
    </footer>
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

/* ========================
   Related sites (full-card clickable, safe linking)
======================== */
type RelatedSite = {
  id: string;
  name: string;
  url: string;
  description: string;
};

const SITES: RelatedSite[] = [
  {
    id: "freetypingcamp",
    name: "FreeTypingCamp",
    url: "https://freetypingcamp.com/",
    description:
      "Typing practice with clean drills and simple progress tracking. Good if you want to improve speed and accuracy without signups.",
  },
  {
    id: "emojikitchengame",
    name: "EmojiKitchenGame",
    url: "https://emojikitchengame.com/",
    description:
      "Mix and match emoji-style combos and explore fun results. Quick, lightweight, and easy to share.",
  },
  {
    id: "ilovecoloringpage",
    name: "ILoveColoringPage",
    url: "https://ilovecoloringpage.com/",
    description:
      "Printable coloring pages and creative activities. Built for quick browsing and easy downloads.",
  },
  {
    id: "alltextconverters",
    name: "AllTextConverters",
    url: "https://alltextconverters.com/",
    description:
      "A toolbox for formatting and transforming text. Handy for developers, writers, and anyone cleaning up content.",
  },
  {
    id: "morsewords",
    name: "MorseWords",
    url: "https://morsewords.com/",
    description:
      "Learn and practice Morse code with simple tools and bite-size lessons. Great for curiosity and skill-building.",
  },
  {
    id: "mythologyschool",
    name: "MythologySchool",
    url: "https://mythologyschool.com/",
    description:
      "Mythology explained in a clear, structured way. Good for students, writers, and quick research rabbit holes.",
  },
  {
    id: "wordmythology",
    name: "WordMythology",
    url: "https://wordmythology.com/",
    description:
      "Word origins and mythology-inspired language notes. Useful if you like etymology and story lore.",
  },
  {
    id: "ilovetimers",
    name: "ILoveTimers",
    url: "https://ilovetimers.com/",
    description:
      "Minimal timers you can start instantly. Great for studying, workouts, cooking, or focus sprints.",
  },
  {
    id: "allplantcare",
    name: "AllPlantCare",
    url: "https://allplantcare.com/",
    description:
      "Plant care guides with quick answers and practical tips. Helpful when you just want to keep a plant alive.",
  },
  {
    id: "focusclimber",
    name: "FocusClimber",
    url: "https://focusclimber.com/",
    description:
      "Focus and habit tools that stay out of your way. Built for simple routines and momentum.",
  },
  {
    id: "ilovesteps",
    name: "ILoveSteps",
    url: "https://ilovesteps.com/",
    description:
      "Step tracking tools and simple walking goals. Good for keeping motivation light and consistent.",
  },
];

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
          {SITES.map((site) => (
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
