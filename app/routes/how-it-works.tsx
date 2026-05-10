import {
  CardGrid,
  DocsContent,
  DocsHero,
  DocsJsonLd,
  DocsPageShell,
  LinkCard,
  PillLink,
  SectionBlock,
  SimpleCard,
} from "~/client/components/docs/HowItWorksDocs";
import { DOCS_PAGES, SITE_URL } from "~/client/lib/docs/howItWorksContent";
import { HOW_IT_WORKS_HUB_COPY } from "~/content/docs/howItWorksRouteContent";

const title = "How the Image to SVG Converter Works | iLoveSVG";
const description =
  "Learn the iLoveSVG workflow for image-to-SVG conversion, presets, settings, filled paths, optional centerline strokes, queueing, output history, source previews, copy, download, and limits.";
const canonical = `${SITE_URL}/how-it-works`;

export function meta() {
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

export default function HowItWorksHub() {
  const guidePages = DOCS_PAGES.filter((page) => page.path !== "/how-it-works");
  const copy = HOW_IT_WORKS_HUB_COPY;
  return (
    <DocsPageShell currentPath="/how-it-works">
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
        <SectionBlock
          title="Start here"
          intro={copy.startIntro}
        >
          <CardGrid>
            {guidePages.map((page) => (
              <LinkCard key={page.path} page={page} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="What the converter does">
          <CardGrid>
            {copy.whatConverterDoes.map((card) => (
              <SimpleCard key={card.title} title={card.title} body={card.body} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="What it does not guarantee">
          <div className="grid gap-3 md:grid-cols-2">
            {copy.doesNotGuarantee.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock
          title="Choose by goal"
          intro="Use a route and preset family that matches the output you want, then adjust settings only if the first result needs help."
        >
          <CardGrid>
            {copy.chooseByGoal.map((card) => (
              <SimpleCard
                key={card.title}
                title={card.title}
                body={card.body}
                footer={
                  card.footerLinks?.map((link) => (
                    <PillLink key={link.to} to={link.to}>
                      {link.label}
                    </PillLink>
                  ))
                }
              />
            ))}
          </CardGrid>
        </SectionBlock>

      </DocsContent>
      <DocsJsonLd path="/how-it-works" title={title} description={description} />
    </DocsPageShell>
  );
}
