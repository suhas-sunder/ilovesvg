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
  return (
    <DocsPageShell currentPath="/how-it-works">
      <DocsHero
        eyebrow="How It Works"
        title="Understand the converter before you tweak it"
        description="This hub explains how iLoveSVG turns raster images into SVG files, how presets and speed labels work, why most outputs are filled paths, when opt-in centerline stroke presets help, and how output history, queueing, copy, download, fullscreen preview, batch conversion, and source previews behave."
        highlights={[
          "Current converter behavior, not planned features.",
          "Preset and speed guidance tied to real app data.",
          "Troubleshooting paths for messy SVG output.",
        ]}
        actions={
          <>
            <PillLink to="/how-it-works/conversion-workflow">Start with the workflow</PillLink>
            <PillLink to="/png-to-svg-converter">Open PNG to SVG</PillLink>
          </>
        }
      />

      <DocsContent>
        <SectionBlock
          title="Start here"
          intro="The converter is upload-first: choose an image, pick a preset, convert, inspect the output, then edit or export the result that actually fits your goal."
        >
          <CardGrid>
            {guidePages.map((page) => (
              <LinkCard key={page.path} page={page} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="What the converter does">
          <CardGrid>
            <SimpleCard
              title="Traces image regions into SVG"
              body="Raster-to-SVG conversion usually traces visible regions into filled paths. Filled paths are normal for logos, silhouettes, scans, stickers, cut files, and many editable SVG workflows."
            />
            <SimpleCard
              title="Adds optional centerline strokes"
              body="New stroke/centerline presets retrace simple line drawings, sketches, handwriting, and diagrams into real SVG strokes. They are opt-in and do not replace the existing filled-path presets."
            />
            <SimpleCard
              title="Lets slow work keep running"
              body="Queued conversions can stay pending or running while you start another preset. A later fast output can finish first, and the slow card should update when its own job finishes."
            />
            <SimpleCard
              title="Keeps recent output context"
              body="Output history can keep recent cards visible after the active upload changes. Cards may show source context and source previews so older outputs are still understandable."
            />
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="What it does not guarantee">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "It cannot promise perfect background removal from every image. Transparency depends on the source and selected preset.",
              "It does not turn every black line into strokes by default. Existing presets remain filled-path based; use opt-in centerline stroke presets when real SVG strokes are the goal.",
              "It cannot guarantee Cricut, cutter, material, or design-app behavior after download.",
              "It cannot make very noisy photos lightweight without simplifying detail or reducing colors.",
            ].map((item) => (
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
            <SimpleCard
              title="Clean black-and-white cut file"
              body="Start with lineart, black-and-white, scan, or Cricut cut presets. Favor fewer specks and simpler filled paths."
              footer={<PillLink to="/png-to-svg-for-cricut">Cricut SVG routes</PillLink>}
            />
            <SimpleCard
              title="Layered color SVG"
              body="Use layered color presets when color separation matters. Expect larger SVGs and slower speed labels as layers increase."
              footer={<PillLink to="/png-to-layered-svg-for-cricut">Layered SVG routes</PillLink>}
            />
            <SimpleCard
              title="Logo or icon"
              body="Use logo/icon presets for transparent artwork with clean edges. Preserve transparency when the source should not have a background."
              footer={<PillLink to="/logo-to-svg-converter">Logo to SVG</PillLink>}
            />
          </CardGrid>
        </SectionBlock>

      </DocsContent>
      <DocsJsonLd path="/how-it-works" title={title} description={description} />
    </DocsPageShell>
  );
}
