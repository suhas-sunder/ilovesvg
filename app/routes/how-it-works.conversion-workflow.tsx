import {
  CardGrid,
  DocsContent,
  DocsHero,
  DocsJsonLd,
  DocsPageShell,
  NumberedStepCard,
  PillLink,
  SectionBlock,
  SimpleCard,
} from "~/client/components/docs/HowItWorksDocs";
import { SITE_URL, WORKFLOW_CONTROLS } from "~/client/lib/docs/howItWorksContent";
import { CONVERSION_WORKFLOW_COPY } from "~/content/docs/howItWorksRouteContent";

const title = "Image to SVG Conversion Workflow | iLoveSVG";
const description =
  "A plain-English guide to Upload, Presets, Convert, queued status, Cancel, Retry, Settings/Edit, Update preview, Copy SVG, Download SVG, Fullscreen Preview, Batch, Minimize, Restore, output history, and source previews.";
const canonical = `${SITE_URL}/how-it-works/conversion-workflow`;

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

export default function ConversionWorkflowDocs() {
  const copy = CONVERSION_WORKFLOW_COPY;
  return (
    <DocsPageShell currentPath="/how-it-works/conversion-workflow">
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
        <SectionBlock title="Basic workflow">
          <ol className="grid gap-3 md:grid-cols-2">
            {copy.basicWorkflowSteps.map((step, index) => (
              <NumberedStepCard key={step} index={index}>
                {step}
              </NumberedStepCard>
            ))}
          </ol>
        </SectionBlock>

        <SectionBlock
          title="Major controls"
          intro={copy.majorControlsIntro}
        >
          <CardGrid>
            {WORKFLOW_CONTROLS.map((control) => (
              <SimpleCard key={control.name} title={control.name} body={control.details} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Practical examples">
          <CardGrid>
            {copy.practicalExamples.map((card) => (
              <SimpleCard key={card.title} title={card.title} body={card.body} />
            ))}
          </CardGrid>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/conversion-workflow" title={title} description={description} />
    </DocsPageShell>
  );
}
