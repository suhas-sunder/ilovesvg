import {
  CardGrid,
  DocsContent,
  DocsHero,
  DocsJsonLd,
  DocsPageShell,
  PillLink,
  SectionBlock,
  SimpleCard,
  SpeedBadge,
} from "~/client/components/docs/HowItWorksDocs";
import {
  PRESET_FAMILIES,
  PRESET_GUIDE_ITEMS,
  SITE_URL,
  SPEED_GUIDE,
  type PresetFamily,
} from "~/client/lib/docs/howItWorksContent";

const title = "SVG Converter Preset Guide | iLoveSVG";
const description =
  "Compare actual iLoveSVG presets by family, speed label, output style, best use case, recommended image types, and settings to adjust, including optional stroke/centerline presets.";
const canonical = `${SITE_URL}/how-it-works/presets`;

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

export default function PresetGuideDocs() {
  return (
    <DocsPageShell currentPath="/how-it-works/presets">
      <DocsHero
        eyebrow="Preset Guide"
        title="Choose a preset by goal, not by guesswork"
        description="The guide below is based on the current preset inventory in the app. Presets are grouped by family and speed label so you can choose between lineart, sketch, scan, logo, optional stroke/centerline, photo-edge, diagram, Cricut/cut, sticker, UI mockup, poster, and layered color output without pretending every image converts the same way."
        highlights={[
          "Speed colors match the converter preset picker.",
          "Families explain what the output tries to preserve.",
          "Heavy layered presets are called out honestly.",
        ]}
        actions={
          <>
            <PillLink to="/png-to-svg-converter">Try PNG to SVG</PillLink>
            <PillLink to="/png-to-layered-svg-for-cricut">Try layered SVG</PillLink>
          </>
        }
      />

      <DocsContent>
        <SectionBlock
          title="Speed labels"
          intro="Speed depends on image size, detail, colors, transparency, browser/server workload, and whether the preset creates one trace or many layered/color regions."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {SPEED_GUIDE.map((speed) => (
              <div key={speed.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <SpeedBadge intensity={speed.id} />
                <p className="mt-2 text-sm leading-6 text-slate-700">{speed.summary}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{speed.useWhen}</p>
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock
          title="Most outputs are filled paths"
          intro="Image-to-SVG conversion normally traces visible regions into filled paths. That is useful for logos, silhouettes, scans, stickers, Cricut/cut files, and layered color regions. The new stroke/centerline family is opt-in for simple drawings that should become real SVG strokes."
        >
          <CardGrid>
            {PRESET_FAMILIES.map((family) => (
              <SimpleCard
                key={family.id}
                title={family.label}
                body={family.summary}
                footer={
                  <div className="flex flex-wrap gap-2">
                    {family.routeLinks.slice(0, 2).map((link) => (
                      <PillLink key={link.path} to={link.path}>
                        {link.label}
                      </PillLink>
                    ))}
                  </div>
                }
              />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock
          title={`Current preset inventory (${PRESET_GUIDE_ITEMS.length} entries)`}
          intro="Use the browser preset picker for live search and speed filtering. This table keeps the documentation grounded in the current app data without showing fake before/after images."
        >
          <div className="space-y-4">
            {PRESET_FAMILIES.map((family) => (
              <details
                key={family.id}
                open={family.id === "lineart" || family.id === "layered"}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <summary className="cursor-pointer text-base font-bold text-sky-950">
                  {family.label} presets
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-500">
                        <th className="border-b border-slate-200 py-2 pr-4">Preset</th>
                        <th className="border-b border-slate-200 py-2 pr-4">Speed</th>
                        <th className="border-b border-slate-200 py-2 pr-4">Output style</th>
                        <th className="border-b border-slate-200 py-2 pr-4">Best use</th>
                        <th className="border-b border-slate-200 py-2">Settings to try</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsForFamily(family.id).map((preset) => (
                        <tr key={preset.id} className="align-top">
                          <td className="border-b border-slate-100 py-3 pr-4 font-semibold text-slate-950">
                            {preset.label}
                          </td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                            <SpeedBadge intensity={preset.speed} />
                          </td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                            {preset.outputStyle}
                          </td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                            {preset.bestUse}
                          </td>
                          <td className="border-b border-slate-100 py-3 text-slate-700">
                            {preset.adjustments}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/presets" title={title} description={description} />
    </DocsPageShell>
  );
}

function itemsForFamily(family: PresetFamily) {
  return PRESET_GUIDE_ITEMS.filter((preset) => preset.family === family);
}
