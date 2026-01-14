/* eslint-disable react/no-unescaped-entities */

import * as React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/privacy-policy";
import SocialLinks from "../client/components/navigation/SocialLinks";
import { OtherToolsLinks } from "../client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "../client/components/navigation/RelatedSites";

export const meta: Route.MetaFunction = () => {
  const canonical = "https://www.ilovesvg.com/privacy-policy";

  const title = "Privacy Policy | i🩵SVG";
  const description =
    "Read the i🩵SVG privacy policy. Learn how your data is handled and protected when using the i🩵SVG website and tools.";

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
              <li aria-current="page" className="text-slate-900 font-semibold">
                Privacy Policy
              </li>
            </ol>
          </nav>

          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Last updated January 10, 2026
          </p>

          <div className="mt-5 space-y-4 text-slate-700 leading-relaxed">
            <p>
              <span>
                This privacy notice for i🩵SVG (https://www.ilovesvg.com) ("we",
                "us", or "our"), describes how and why we might collect, store,
                use, and/or share ("process") your information when you use our
                services ("Services"), such as when you:
              </span>

              <ul className="mt-4 list-inside list-disc flex flex-col gap-2 pl-5">
                <li>
                  Visit our website at https://www.ilovesvg.com, or any website
                  of ours that links to this privacy notice
                </li>
                <li>
                  Engage with us in other related ways, including any sales,
                  marketing, or events (for example, if we offer optional
                  accounts, subscriptions, or purchases in the future)
                </li>
              </ul>
            </p>

            <p>
              Questions or concerns? Reading this privacy notice will help you
              understand your privacy rights and choices. If you do not agree
              with our policies and practices, please do not use our Services.
            </p>

            <p className="space-y-1">
              <span className="block">
                Data controller: i🩵SVG is responsible for deciding how your
                personal information is processed for the purposes described in
                this privacy notice.
              </span>
              <span className="block">
                Contact: admin@ilovesvg.com (Toronto, Ontario, Canada).
              </span>
            </p>
          </div>
        </header>

        {/* Content */}
        <article className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="prose prose-slate max-w-none">
            <Section title="SUMMARY OF KEY POINTS">
              <p>
                This summary provides key points from our privacy notice, but
                you can find out more details about any of these topics by
                clicking the link following each key point or by using our table
                of contents below to find the section you are looking for.
              </p>
              <p>
                What personal information do we process? When you visit, use, or
                navigate our Services, we may process personal information
                depending on how you interact with us and the Services, the
                choices you make, and the products and features you use.
              </p>
              <p>
                How do we process your information? We process your information
                to provide, improve, and administer our Services, communicate
                with you, for security and fraud prevention, and to comply with
                law. We may also process your information for other purposes
                with your consent. We process your information only when we have
                a valid legal reason to do so.
              </p>
              <p>
                In what situations and with which parties do we share personal
                information? We may share information in specific situations and
                with specific third parties.
              </p>
              <p>
                What are your rights? Depending on where you are located
                geographically, the applicable privacy law may mean you have
                certain rights regarding your personal information.
              </p>
            </Section>

            <Section title="1. WHAT INFORMATION DO WE COLLECT?">
              <h3 className="text-lg font-bold text-slate-900">
                Personal information you disclose to us
              </h3>
              <p>
                In Short: We collect personal information that you provide to
                us.
              </p>

              <p>
                We collect personal information that you voluntarily provide to
                us when you register on the Services (if we offer optional
                accounts in the future), express an interest in obtaining
                information about us or our products and Services, when you
                participate in activities on the Services, or otherwise when you
                contact us.
              </p>

              <p>
                <span>
                  Personal Information Provided by You. The personal information
                  that we collect depends on the context of your interactions
                  with us and the Services, the choices you make, and the
                  products and features you use. The personal information we
                  collect may include the following:
                </span>
              </p>

              <ul>
                <li>email addresses</li>
                <li>usernames</li>
                <li>passwords</li>
                <li>contact preferences</li>
                <li>billing addresses</li>
                <li>debit/credit card numbers</li>
                <li>mailing addresses</li>
                <li>phone numbers</li>
                <li>names</li>
                <li>contact or authentication data</li>
              </ul>

              <p>
                Sensitive Information. We do not process sensitive information.
              </p>

              <p>
                Payment Data. We may collect data necessary to process your
                payment if you make purchases, such as your payment instrument
                number, and the security code associated with your payment
                instrument. If we offer payments, subscriptions, or paid
                content, payment processing may be handled by third-party
                payment processors (such as Stripe). We do not store full
                payment card details on our servers. You may find Stripe’s
                privacy notice here:{" "}
                <a
                  href="https://stripe.com/en-ca/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://stripe.com/en-ca/privacy
                </a>
                .
              </p>

              <p>
                Social Media Login Data. We may provide you with the option to
                register with us using your existing social media account
                details, like your Facebook, X (Twitter), or other social media
                account. If you choose to register in this way, we will collect
                the information described in the section called "HOW DO WE
                HANDLE YOUR SOCIAL LOGINS?" below.
              </p>

              <p>
                Affiliate Links and Referrals. We may include affiliate links on
                our Services. If you click an affiliate link and make a
                purchase, we may receive a commission. Affiliate partners may
                use cookies or similar technologies to track referrals according
                to their own privacy policies.
              </p>

              <p>
                Merch and Third-Party Stores. We may link to third-party stores
                or platforms where merchandise or digital products can be
                purchased. Any purchase you make through a third-party store is
                governed by that third party’s terms and privacy policy.
              </p>

              <p>
                All personal information that you provide to us must be true,
                complete, and accurate, and you must notify us of any changes to
                such personal information.
              </p>

              <h3 className="text-lg font-bold text-slate-900 mt-8">
                Information automatically collected
              </h3>
              <p>
                <b>In Short:</b> Some information, such as your Internet
                Protocol (IP) address and/or browser and device characteristics,
                is collected automatically when you visit our Services.
              </p>

              <p>
                We automatically collect certain information when you visit,
                use, or navigate the Services. This information does not reveal
                your specific identity (like your name or contact information)
                but may include device and usage information, such as your IP
                address, browser and device characteristics, operating system,
                language preferences, referring URLs, device name, country,
                approximate location, information about how and when you use our
                Services, and other technical information. This information is
                primarily needed to maintain the security and operation of our
                Services, for analytics, and for advertising measurement and
                fraud prevention.
              </p>

              <p>
                Like many businesses, we also collect information through
                cookies and similar technologies. You can find out more about
                this in our Cookie Notice: https://www.ilovesvg.com/cookies.
              </p>

              <p>
                Analytics. We use PostHog to help us understand usage and
                improve the Services. PostHog may collect information such as
                your device and browser details, pages viewed, interactions, and
                approximate location (based on IP).{" "}
                <span>
                  If available, you may be able to limit analytics collection
                  via cookie preferences or browser settings.
                </span>
              </p>

              <p className="mt-4">
                <span>The information we collect includes:</span>
              </p>

              <ul>
                <li>
                  Log and Usage Data. Log and usage data is service-related,
                  diagnostic, usage, and performance information our servers
                  automatically collect when you access or use our Services and
                  which we record in log files. Depending on how you interact
                  with us, this log data may include your IP address, device
                  information, browser type, and settings and information about
                  your activity in the Services (such as the date/time stamps
                  associated with your usage, pages and files viewed, searches,
                  and other actions you take such as which features you use),
                  device event information (such as system activity, error
                  reports (sometimes called "crash dumps"), and hardware
                  settings).
                </li>
                <li>
                  Device Data. We collect device data such as information about
                  your computer, phone, tablet, or other device you use to
                  access the Services. Depending on the device used, this device
                  data may include information such as your IP address (or proxy
                  server), device and application identification numbers,
                  location, browser type, hardware model, Internet service
                  provider and/or mobile carrier, operating system, and system
                  configuration information.
                </li>
                <li>
                  Location Data. We may collect approximate location data (for
                  example, based on IP address) and, if you enable it on your
                  device and our Services request it, more precise location
                  data. You can opt out of precise location sharing by refusing
                  access or disabling your Location setting. If you choose to
                  opt out, you may not be able to use certain aspects of the
                  Services.
                </li>
                <li>
                  Advertising and Measurement Data. If we show ads, ad networks
                  and their partners may collect or receive information (such as
                  cookies, device identifiers, IP address, and ad interaction
                  events) to provide, measure, and improve advertising, limit ad
                  frequency, and help detect fraud.
                </li>
              </ul>
            </Section>

            <Section title="2. HOW DO WE PROCESS YOUR INFORMATION?">
              <p>
                In Short: We process your information to provide, improve, and
                administer our Services, communicate with you, for security and
                fraud prevention, and to comply with law. We may also process
                your information for other purposes with your consent.
              </p>

              <p>
                <span>
                  We process your personal information for a variety of reasons,
                  depending on how you interact with our Services, including:
                </span>
              </p>

              <ul>
                <li>
                  To provide and improve the Services (including core site
                  functionality, performance, debugging, and feature
                  improvements).
                </li>
                <li>
                  To facilitate account creation and authentication and
                  otherwise manage user accounts (if we offer optional accounts
                  in the future).
                </li>
                <li>
                  To deliver and facilitate delivery of services to the user.
                </li>
                <li>
                  To respond to user inquiries and offer support to users.
                </li>
                <li>
                  To send administrative information to you, such as changes to
                  our terms and policies.
                </li>
                <li>
                  To fulfill and manage orders (if we offer purchases,
                  subscriptions, or merch), including payments, returns, and
                  exchanges.
                </li>
                <li>
                  To request feedback and understand how the Services are used.
                </li>
                <li>
                  To deliver and measure advertising, including contextual and
                  personalized ads where permitted by law and settings.
                </li>
                <li>
                  To provide analytics (including via PostHog) and identify
                  usage trends so we can improve the Services.
                </li>
                <li>
                  To protect our Services, including security monitoring, abuse
                  prevention, and fraud detection.
                </li>
                <li>
                  To comply with legal obligations and enforce our rights.
                </li>
              </ul>
            </Section>

            <Section title="3. WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR INFORMATION?">
              <p>
                In Short: We only process your personal information when we
                believe it is necessary and we have a valid legal reason (i.e.,
                legal basis) to do so under applicable law, like with your
                consent, to comply with laws, to provide you with services to
                enter into or fulfill our contractual obligations, to protect
                your rights, or to fulfill our legitimate business interests.
              </p>

              <h3 className="text-lg font-bold text-slate-900">
                If you are located in the EU or UK, this section applies to you.
              </h3>

              <p>
                The General Data Protection Regulation (GDPR) and UK GDPR
                require us to explain the valid legal bases we rely on in order
                to process your personal information. As such, we may rely on
                the following legal bases to process your personal information:
              </p>

              <ul>
                <li>
                  Consent. We may process your information if you have given us
                  permission (i.e., consent) to use your personal information
                  for a specific purpose. You can withdraw your consent at any
                  time.
                </li>
                <li>
                  Performance of a Contract. We may process your personal
                  information when we believe it is necessary to fulfill our
                  contractual obligations to you, including providing our
                  Services or at your request prior to entering into a contract
                  with you.
                </li>
                <li>
                  Legitimate Interests. We may process your information when we
                  believe it is reasonably necessary to achieve our legitimate
                  business interests (such as improving the Services, ensuring
                  security, preventing fraud, measuring performance, and showing
                  ads) and those interests do not outweigh your interests and
                  fundamental rights and freedoms.
                </li>
                <li>
                  Legal Obligations. We may process your information where we
                  believe it is necessary for compliance with our legal
                  obligations.
                </li>
                <li>
                  Vital Interests. We may process your information where we
                  believe it is necessary to protect your vital interests or the
                  vital interests of a third party.
                </li>
              </ul>

              <h3 className="text-lg font-bold text-slate-900 mt-6">
                If you are located in Canada, this section applies to you.
              </h3>

              <p>
                We may process your information if you have given us specific
                permission (i.e., express consent) to use your personal
                information for a specific purpose, or in situations where your
                permission can be inferred (i.e., implied consent).
              </p>
            </Section>

            <Section title="4. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?">
              <p>
                In Short: We may share information in specific situations
                described in this section and/or with the following categories
                of third parties.
              </p>

              <p>We may share your information with third parties such as:</p>

              <ul>
                <li>
                  Analytics providers (for example, PostHog) to help us
                  understand usage and improve the Services.
                </li>
                <li>
                  Advertising networks and partners (for example, Google AdSense
                  or other ad networks) to display, measure, and improve ads.
                </li>
                <li>
                  Payment processors (for example, Stripe) if we offer
                  purchases, subscriptions, or paid content.
                </li>
                <li>
                  Affiliate partners when you click affiliate links or make a
                  purchase via a referral link.
                </li>
                <li>
                  Merch or fulfillment partners and third-party storefronts if
                  we offer merchandise.
                </li>
                <li>
                  Service providers who help us operate the site (hosting,
                  security, customer support tools, email providers, etc.).
                </li>
              </ul>

              <p>
                We may also share your personal information in the following
                situations:
              </p>

              <ul>
                <li>
                  Business Transfers. We may share or transfer your information
                  in connection with, or during negotiations of, any merger,
                  sale of company assets, financing, or acquisition of all or a
                  portion of our business to another company.
                </li>
                <li>
                  Legal Requirements. We may disclose information where required
                  to do so by law, court order, or governmental regulation, or
                  when we believe disclosure is necessary to protect rights,
                  safety, and prevent fraud or abuse.
                </li>
              </ul>
            </Section>

            <Section title="5. WHAT IS OUR STANCE ON THIRD-PARTY WEBSITES?">
              <p>
                In Short: We are not responsible for the safety of any
                information that you share with third parties that we may link
                to or who advertise on our Services, but are not affiliated with
                our Services.
              </p>

              <p>
                The Services may link to third-party websites, online services,
                or mobile applications and/or contain advertisements from third
                parties that are not affiliated with us. We do not control those
                third parties and are not responsible for their content,
                policies, or practices. We recommend you review the privacy
                policies of any third-party services you interact with.
              </p>

              <h3 className="text-lg font-bold text-slate-900">
                Advertising (Google AdSense and other ad networks)
              </h3>

              <ul>
                <li>
                  Third-party vendors, including Google, use cookies and/or
                  device identifiers to serve ads based on a user's prior visits
                  to this website or other websites.
                </li>
                <li>
                  Google’s use of advertising cookies enables it and its
                  partners to serve ads to users based on their visit to this
                  site and/or other sites on the Internet.
                </li>
                <li>
                  Users may opt out of personalized advertising by visiting
                  Google Ads Settings and/or by visiting{" "}
                  <a
                    href="https://optout.aboutads.info/?c=2&lang=EN"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    www.aboutads.info
                  </a>
                  .
                </li>
                <li>
                  Where required by law, we will request consent for certain
                  cookies (including advertising cookies) before they are set.
                </li>
              </ul>

              <h3 className="text-lg font-bold text-slate-900 mt-6">
                Affiliate links
              </h3>

              <p>
                If we include affiliate links, third parties may use cookies or
                similar technologies to track referrals and attribute purchases.
                The handling of that data is governed by the third party’s
                privacy policy.
              </p>

              <h3 className="text-lg font-bold text-slate-900 mt-6">
                Merch links
              </h3>

              <p>
                If we link to merchandise or third-party storefronts, any
                purchase you make is between you and the third party. Their
                privacy policy will apply.
              </p>
            </Section>

            <Section title="6. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?">
              <p>
                In Short: We may use cookies and other tracking technologies to
                collect and store your information.
              </p>

              <p>
                We may use cookies and similar tracking technologies (like web
                beacons and pixels) to access or store information. Specific
                information about how we use such technologies and how you can
                refuse certain cookies is set out in our Cookie Notice:
                https://www.ilovesvg.com/cookies.
              </p>

              <p>
                You can control cookies through your browser settings. If you
                choose to remove or reject cookies, this could affect certain
                features or services of our Services.
              </p>
            </Section>

            <Section title="7. HOW LONG DO WE KEEP YOUR INFORMATION?">
              <p>
                In Short: We keep your information for as long as necessary to
                fulfill the purposes outlined in this privacy notice unless
                otherwise required by law.
              </p>

              <p>
                We will only keep your personal information for as long as it is
                necessary for the purposes set out in this privacy notice,
                unless a longer retention period is required or permitted by
                law. For example, if we introduce accounts in the future, we
                typically keep account information while your account is active.
                We may retain certain information for security, fraud
                prevention, compliance, and legitimate business purposes.
              </p>
            </Section>

            <Section title="8. DO WE COLLECT INFORMATION FROM MINORS?">
              <p>
                In Short: We do not knowingly collect personal information from
                children under 13 years of age.
              </p>

              <p>
                The Services are intended for a general audience and are not
                directed to children under 13. We do not knowingly collect
                personal information from children under 13. If you believe a
                child has provided personal information to us, please contact us
                at admin@ilovesvg.com and we will take appropriate steps to
                delete the information.
              </p>
            </Section>

            <Section title="9. WHAT ARE YOUR PRIVACY RIGHTS?">
              <p>
                In Short: Depending on where you are located, you may have
                certain rights regarding your personal information.
              </p>

              <p>
                You can request access to, correction of, or deletion of your
                personal information by contacting us at admin@ilovesvg.com. We
                may need to verify your identity before responding. Where
                applicable, you may also have the right to object to certain
                processing or request portability of your information.
              </p>
            </Section>

            <Section title="10. DO WE MAKE UPDATES TO THIS NOTICE?">
              <p>
                In Short: Yes, we will update this notice as necessary to stay
                compliant with relevant laws.
              </p>

              <p>
                We may update this privacy notice from time to time. The updated
                version will be indicated by an updated "Last updated" date and
                will be effective as soon as it is accessible.
              </p>
            </Section>

            <Section title="11. CONTACT US">
              <p>
                If you have questions or comments about this notice, you may
                email us at admin@ilovesvg.com or contact us by post at:
              </p>
              <p>https://www.ilovesvg.com/</p>
              <p>Toronto, Ontario</p>
              <p>Canada</p>
            </Section>
          </div>

          <div className="mt-10">
            <SocialLinks />
          </div>
        </article>

        <OtherToolsLinks />
        <RelatedSites />
      </div>
    </main>
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
