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
  return (
    <DocsPageShell currentPath="/how-it-works/conversion-workflow">
      <DocsHero
        eyebrow="Conversion Workflow"
        title="From upload to saved SVG"
        description="The converter is designed for comparing results: upload an image, choose a preset, Convert, inspect the output card, adjust settings only when needed, then Copy SVG, Download SVG, use Fullscreen Preview, or run Batch conversion where available."
        highlights={[
          "What each major converter control does.",
          "How queued outputs keep the page usable.",
          "How history preserves source context while comparing.",
        ]}
        actions={
          <>
            <PillLink to="/how-it-works/presets">Choose a preset</PillLink>
            <PillLink to="/how-it-works/settings">Understand settings</PillLink>
          </>
        }
      />

      <DocsContent>
        <SectionBlock title="Basic workflow">
          <ol className="grid gap-3 md:grid-cols-2">
            {[
              "Upload an image. PNG, JPG, JPEG, WebP, and route-specific formats are supported on the relevant converter pages.",
              "Choose a preset. Speed tags estimate backend processing cost and do not change output by themselves.",
              "Click Convert. On queued routes, a pending output card appears immediately and may become running before it finishes.",
              "Review the output. Most raster-to-SVG results are filled paths, which is normal for logos, cut files, scans, and stickers.",
              "Open Settings/Edit if the completed card needs local output edits or click-to-convert setting changes.",
              "Click Update preview only when retrace settings should be applied to that selected output.",
              "Use Copy SVG or Download SVG when the visible result is ready.",
              "Keep comparing. Output history can preserve recent cards, including source context, while you try another preset or upload.",
            ].map((step, index) => (
              <NumberedStepCard key={step} index={index}>
                {step}
              </NumberedStepCard>
            ))}
          </ol>
        </SectionBlock>

        <SectionBlock
          title="Major controls"
          intro="Controls are card-specific where possible. Editing one output should not overwrite another output."
        >
          <CardGrid>
            {WORKFLOW_CONTROLS.map((control) => (
              <SimpleCard key={control.name} title={control.name} body={control.details} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Practical examples">
          <CardGrid>
            <SimpleCard
              title="I want a clean black-and-white cut file"
              body="Upload the image, try a lineart or Cricut cut preset, check for specks, then raise cleanup or use a scan preset if the SVG is too noisy."
            />
            <SimpleCard
              title="I want a layered color SVG"
              body="Use layered presets and expect slower speed labels. More colors and layers can improve color separation but also increase file size and processing time."
            />
            <SimpleCard
              title="I tried a slow preset and want to keep working"
              body="Leave the slow queued card in place, start a faster preset, and compare outputs when each card finishes. Cancel only when you no longer want that job."
            />
          </CardGrid>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/conversion-workflow" title={title} description={description} />
    </DocsPageShell>
  );
}
