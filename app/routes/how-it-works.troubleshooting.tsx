import {
  CardGrid,
  DocsContent,
  DocsHero,
  DocsJsonLd,
  DocsPageShell,
  PillLink,
  SectionBlock,
  SimpleCard,
} from "~/client/components/docs/HowItWorksDocs";
import { SITE_URL, TROUBLESHOOTING_ITEMS } from "~/client/lib/docs/howItWorksContent";
import { TROUBLESHOOTING_DOCS_COPY } from "~/content/docs/howItWorksRouteContent";

const title = "SVG Converter Troubleshooting | iLoveSVG";
const description =
  "Fix image-to-SVG conversion problems: preview does not appear, failed conversion, output too dark, too many specks, lost detail, unwanted transparent background layer, file too large, rate limit, queued slow preset, disabled line weight, and batch issues.";
const canonical = `${SITE_URL}/how-it-works/troubleshooting`;

export function meta() {
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonical },
  ];
}

export default function TroubleshootingDocs() {
  const copy = TROUBLESHOOTING_DOCS_COPY;
  return (
    <DocsPageShell currentPath="/how-it-works/troubleshooting">
      <DocsHero
        eyebrow={copy.hero.eyebrow}
        title={copy.hero.title}
        description={copy.hero.description}
        highlights={copy.hero.highlights}
        actions={
          <>
            {copy.hero.actions.map((action) => (
              <PillLink key={action.to} to={action.to}>
                {action.label}
              </PillLink>
            ))}
          </>
        }
      />

      <DocsContent>
        <SectionBlock title="Common problems and fixes">
          <CardGrid>
            {TROUBLESHOOTING_ITEMS.map((item) => (
              <SimpleCard key={item.problem} title={item.problem} body={item.fix} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Limits to keep in mind">
          <div className="grid gap-3 md:grid-cols-2">
            {copy.limits.map((limit) => (
              <div key={limit} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {limit}
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Frequently asked questions">
          <div className="space-y-3">
            {copy.faqs.map((faq) => (
              <details key={faq.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-bold text-slate-950">{faq.q}</summary>
                <p className="mt-2 text-sm leading-6 text-slate-700">{faq.a}</p>
              </details>
            ))}
          </div>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/troubleshooting" title={title} description={description} faqs={copy.faqs} />
    </DocsPageShell>
  );
}
