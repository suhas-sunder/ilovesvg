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
import { SITE_URL } from "~/client/lib/docs/howItWorksContent";

const title = "Exporting and Downloading SVG Results | iLoveSVG";
const description =
  "Learn Copy SVG, Download SVG, output file size, dimensions, fullscreen preview, batch ZIP behavior, SVG naming, PNG/JPG/WebP/PDF export routes, transparency, and why detailed SVGs can be large.";
const canonical = `${SITE_URL}/how-it-works/exporting-and-downloads`;

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

export default function ExportingDocs() {
  return (
    <DocsPageShell currentPath="/how-it-works/exporting-and-downloads">
      <DocsHero
        eyebrow="Exporting and Downloads"
        title="Save the SVG you actually reviewed"
        description="Output cards show dimensions and SVG file size when available. Copy SVG, Download SVG, fullscreen preview, and batch conversion should use the same finalized visible SVG, including supported local output edits."
        highlights={[
          "Copy and download use the finalized visible SVG.",
          "File size and dimensions help compare outputs.",
          "Batch ZIP behavior is documented where available.",
        ]}
        actions={
          <>
            <PillLink to="/svg-to-png-converter">SVG to PNG</PillLink>
            <PillLink to="/svg-to-jpg-converter">SVG to JPG</PillLink>
            <PillLink to="/svg-to-webp-converter">SVG to WebP</PillLink>
            <PillLink to="/svg-to-pdf-converter">SVG to PDF</PillLink>
          </>
        }
      />

      <DocsContent>
        <SectionBlock title="SVG output actions">
          <CardGrid>
            <SimpleCard
              title="Download SVG"
              body="Downloads the current finalized SVG for that output card. Use this when the SVG is large or another app rejects pasted SVG text."
            />
            <SimpleCard
              title="Copy SVG"
              body="Copies the current finalized SVG markup. Some design apps paste SVG differently, so download can be more reliable for large files."
            />
            <SimpleCard
              title="Fullscreen Preview"
              body="Opens a larger view for inspecting transparency, path detail, dimensions, and local output edits before saving."
            />
            <SimpleCard
              title="Batch ZIP"
              body="Batch conversion downloads multiple results as a ZIP file where the route supports batch output. Individual failed items should not break unrelated completed outputs."
            />
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Raster and document exports">
          <CardGrid>
            <SimpleCard
              title="PNG and WebP"
              body="Use PNG or WebP export routes when you need a raster image. These routes render SVG to canvas with size, aspect, background, and quality controls where available."
            />
            <SimpleCard
              title="JPG"
              body="JPG export always uses a solid background because JPEG does not support transparency. Choose the background color before downloading."
            />
            <SimpleCard
              title="PDF"
              body="Use SVG to PDF for document and print handoff when a PDF is the required format instead of editable SVG markup."
            />
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Why file size changes">
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p>
              Detailed SVGs can be large because every path, color layer, tiny region, and local output edit must be represented as markup. More colors, more layers, lower cleanup, higher trace size, Fill spread, and very detailed presets can all increase file size.
            </p>
            <p>
              If a design tool becomes slow, try a simpler preset, reduce layers, increase cleanup, resize the source before tracing, or use an SVG cleanup/minifier route after download.
            </p>
            <div className="flex flex-wrap gap-3">
              <PillLink to="/svg-minifier">SVG Minifier</PillLink>
              <PillLink to="/svg-cleaner">SVG Cleaner</PillLink>
              <PillLink to="/svg-file-size-inspector">SVG File Size Inspector</PillLink>
            </div>
          </div>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/exporting-and-downloads" title={title} description={description} />
    </DocsPageShell>
  );
}
