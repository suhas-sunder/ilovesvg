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
import { SETTING_GROUPS, SITE_URL } from "~/client/lib/docs/howItWorksContent";
import { SETTINGS_GUIDE_COPY } from "~/content/docs/howItWorksRouteContent";

const title = "SVG Converter Settings Guide | iLoveSVG";
const description =
  "Understand live preview edits, output appearance, Stroke output mode, Line weight, Fill spread, Layer colors, Remove colors, Size and export, Line tracing, Edges and cleanup, Appearance, Batch conversion, and Update preview behavior.";
const canonical = `${SITE_URL}/how-it-works/settings`;

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

export default function SettingsGuideDocs() {
  const copy = SETTINGS_GUIDE_COPY;
  return (
    <DocsPageShell currentPath="/how-it-works/settings">
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
          title="Settings inventory"
          intro={copy.settingsInventoryIntro}
        >
          <div className="space-y-4">
            {SETTING_GROUPS.map((group) => (
              <div key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-bold text-sky-950">{group.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{group.summary}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {group.settings.map((setting) => (
                    <SimpleCard key={setting.name} title={setting.name} body={setting.details} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Stroke and fill / output appearance">
          <CardGrid>
            {copy.strokeAndFillCards.map((card) => (
              <SimpleCard key={card.title} title={card.title} body={card.body} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Recommended settings by goal">
          <CardGrid>
            {copy.recommendedGoalCards.map((card) => (
              <SimpleCard key={card.title} title={card.title} body={card.body} />
            ))}
          </CardGrid>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/settings" title={title} description={description} />
    </DocsPageShell>
  );
}
