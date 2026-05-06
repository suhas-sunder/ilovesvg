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
  return (
    <DocsPageShell currentPath="/how-it-works/settings">
      <DocsHero
        eyebrow="Settings Guide"
        title="Know which settings edit now and which settings retrace"
        description="The output editor separates Live preview edits from Click to convert settings. Live edits adjust the selected output card. Click-to-convert settings retrace the original source when you click Convert or Update preview."
        highlights={[
          "Live preview edits stay card-specific.",
          "Click-to-convert settings retrace from the original source.",
          "Stroke output mode, line weight, and fill spread are documented with limits.",
        ]}
        actions={
          <>
            <PillLink to="/how-it-works/conversion-workflow">Workflow first</PillLink>
            <PillLink to="/how-it-works/troubleshooting">Fix a bad result</PillLink>
          </>
        }
      />

      <DocsContent>
        <SectionBlock
          title="Settings inventory"
          intro="Visible settings are route-aware. Unsupported settings are hidden instead of pretending to work."
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
            <SimpleCard
              title="Stroke output mode"
              body="Compatible line-art outputs can retrace the original source as Filled shapes or Centerline strokes. Centerline strokes are best for simple sketches, handwriting, and diagrams; filled shapes remain best for logos, cut files, and most conversions."
            />
            <SimpleCard
              title="Line weight"
              body="Line weight changes stroke width only when the SVG contains actual stroke attributes. Many image-to-SVG conversions produce filled paths instead, so the control can be hidden or disabled for those outputs."
            />
            <SimpleCard
              title="Fill spread"
              body="Fill spread expands filled regions by adding a same-color under-stroke where safe. It is manual, off by default, disabled for precision cut outputs, and can increase file size or make tight details heavier."
            />
            <SimpleCard
              title="File size and parity"
              body="Preview, Copy SVG, Download SVG, fullscreen review, and file size display should use the same finalized SVG for the selected output card."
            />
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Recommended settings by goal">
          <CardGrid>
            <SimpleCard
              title="Cricut/cut files"
              body="Favor simpler filled paths, higher cleanup, fewer tiny islands, transparent output when appropriate, and fewer layers unless the project needs color separation."
            />
            <SimpleCard
              title="Layered color SVGs"
              body="Tune color layer count, requested palette count, min region percent, layer max trace side, min island px, hole fill px, and remove transparent."
            />
            <SimpleCard
              title="Noisy images"
              body="Try scan or cleanup presets, increase turd size or min island px, use noise reduction, and consider resizing the source before converting."
            />
            <SimpleCard
              title="Centerline stroke drawings"
              body="Use Stroke Trace or Centerline presets on clean line art. Increase centerline stroke width for heavier lines, or simplify more when a plotter-style SVG should have fewer segments."
            />
          </CardGrid>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/settings" title={title} description={description} />
    </DocsPageShell>
  );
}
