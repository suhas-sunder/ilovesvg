/* eslint-disable react/no-unescaped-entities */
import { Link } from "react-router";
import type { Route } from "./+types/terms-of-service";
import SocialLinks from "~/client/components/navigation/SocialLinks";

export const meta: Route.MetaFunction = () => {
  const canonical = "https://www.ilovesvg.com/terms";

  const title = "Terms of Service | i🩵SVG";
  const description =
    "Read the i🩵SVG Terms of Service. Learn about your rights and responsibilities when using the website.";

  const ogImage = "https://www.ilovesvg.com/og/ilovesvg-terms.jpg";

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
    { property: "og:image:alt", content: "i🩵SVG terms of service" },
    { property: "og:locale", content: "en_US" },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },

    { name: "robots", content: "noindex,follow" },
  ];
};

export default function TermsOfService() {
  return (
    <div className="my-8 flex flex-col mx-10 items-center justify-center gap-8 font-nunito text-skull-brown">
      <header className="flex max-w-[1200px] flex-col gap-5 w-full">
        <nav aria-label="Breadcrumb" className="text-sm font-lato">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link to="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li className="opacity-70">&gt;</li>
            <li>
              <Link to="/misc" className="hover:underline">
                Misc
              </Link>
            </li>
            <li className="opacity-70">&gt;</li>
            <li aria-current="page" className="opacity-90">
              Terms of Service
            </li>
          </ol>
        </nav>

        <h1 className="mb-5 flex py-2 text-4xl">TERMS OF SERVICE</h1>
        <h3 className="flex py-2 text-2xl">Last updated January 10, 2026</h3>

        <h2>AGREEMENT TO OUR LEGAL TERMS</h2>

        <p className="flex flex-col gap-4 py-2">
          We are i🩵SVG (https://www.ilovesvg.com) ("Company", "we", "us",
          "our").
        </p>

        <p>
          We operate the website https://www.ilovesvg.com (the "Site"), as
          well as any other related products and services that refer or link to
          these legal terms (the "Legal Terms") (collectively, the "Services").
        </p>

        <p>
          You can contact us by email at admin@ilovesvg.com or by mail to
          https://www.ilovesvg.com, Toronto, Ontario, Canada.
        </p>

        <p>
          These Legal Terms constitute a legally binding agreement made between
          you, whether personally or on behalf of an entity ("you"), and
          i🩵SVG, concerning your access to and use of the Services. You
          agree that by accessing the Services, you have read, understood, and
          agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE
          WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM
          USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
        </p>

        <p>
          Supplemental terms and conditions or documents that may be posted on
          the Services from time to time are hereby expressly incorporated
          herein by reference. We reserve the right, in our sole discretion, to
          make changes or modifications to these Legal Terms from time to time.
          We will alert you about any changes by updating the "Last updated"
          date of these Legal Terms, and you waive any right to receive specific
          notice of each such change. It is your responsibility to periodically
          review these Legal Terms to stay informed of updates. You will be
          subject to, and will be deemed to have been made aware of and to have
          accepted, the changes in any revised Legal Terms by your continued use
          of the Services after the date such revised Legal Terms are posted.
        </p>

        <p>
          The Services are intended for a general audience. If you are under the
          age of 13, you may not use the Services. If you are under the age of
          majority in your jurisdiction, you may use the Services only with the
          involvement and consent of a parent or legal guardian.
        </p>
      </header>

      <main className="flex max-w-[1200px] flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="flex py-2 text-2xl">1. OUR SERVICES</h2>
          <p>
            The Services provide tools, converters, generators, and educational
            content related to SVG graphics, vector design, and web-friendly
            visual assets. The information provided when using the Services is
            not intended for distribution to or use by any person or entity in
            any jurisdiction or country where such distribution or use would be
            contrary to law or regulation or which would subject us to any
            registration requirement within such jurisdiction or country.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="flex py-2 text-2xl">16. PRIVACY POLICY</h2>
          <p>
            We care about data privacy and security. Please review our Privacy
            Policy: https://www.ilovesvg.com/privacy. By using the Services,
            you agree to be bound by our Privacy Policy, which is incorporated
            into these Legal Terms.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="flex py-2 text-2xl">30. CONTACT US</h2>
          <p>
            In order to resolve a complaint regarding the Services or to receive
            further information regarding use of the Services, please contact us
            at:
          </p>
          <p>https://www.ilovesvg.com</p>
          <p>Toronto, Ontario</p>
          <p>Canada</p>
          <p>admin@ilovesvg.com</p>
        </section>

        <SocialLinks />
      </main>
    </div>
  );
}
