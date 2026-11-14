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
import { EXPORTING_DOWNLOADS_COPY } from "~/content/docs/howItWorksRouteContent";
import examples from "../../public/examples/output-inspection/manifest.json";

const title = "Exporting and Downloads | iLoveSVG";
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
  const copy = EXPORTING_DOWNLOADS_COPY;
  return (
    <DocsPageShell currentPath="/how-it-works/exporting-and-downloads">
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
        <SectionBlock title="Check what is inside your SVG">
          <div id="inspect-svg-output" className="scroll-mt-24 space-y-4 text-sm leading-7 text-slate-700">
            <p>An SVG filename does not tell you whether a picture has been traced. An SVG can contain vector shapes, an embedded bitmap, or both. Check the downloaded file before sending it to an editor, website or cutting workflow.</p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>Download an SVG from the converter, then open it in the <a className="font-bold text-sky-800 underline" href="/svg-preview-viewer">SVG Preview Viewer</a>. Open <strong>Inspector</strong> if it is hidden, choose <strong>Elements</strong>, and look at <strong>Counts</strong>. Shapes such as <code>path</code>, <code>rect</code> and <code>circle</code> describe geometry. An <code>image</code> element can hold or reference a bitmap; inspect its source to identify the image format.</li>
              <li>Open the inspector’s <strong>Source</strong> tab. A <code>path</code> stores drawing commands in its <code>d</code> attribute. One path can contain several disconnected subpaths and holes. A path count is therefore neither an object count nor a promise of how many cuts a machine will make.</li>
              <li>Zoom into corners, small lettering and holes. Compare them with the input, then check the artwork at the size you intend to use. Smooth zooming proves little about whether tracing preserved the right outline.</li>
              <li>Check the background, dimensions and <code>viewBox</code>, then reopen the download in the destination application. A valid SVG can still contain the wrong geometry, unwanted background or unsupported effects.</li>
            </ol>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="font-bold text-sky-950">Reading a small example</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs" tabIndex={0} aria-label="Illustrative SVG path and bitmap markup">{`<!-- Vector geometry: a triangular outline -->\n<path d="M 10 10 L 90 10 L 50 80 Z"/>\n<!-- A bitmap wrapper: the pixels are still an image -->\n<image href="data:image/png;base64,..." width="100" height="100"/>`}</pre>
              <p className="mt-2">These snippets explain the structure; they are not conversion results. The downloadable examples below are actual converter outputs.</p>
            </div>
            <p>Filled outlines suit solid silhouettes. A thin-looking shape may still have two outline edges rather than a centerline stroke. Traced lettering is geometry, not editable text. Color groups can make selection easier, but they do not reconstruct the original design’s semantic layers.</p>
            <div className="flex flex-wrap gap-3">
              <PillLink to="/svg-file-size-inspector">Inspect file size</PillLink>
              <PillLink to="/svg-dimensions-inspector">Check dimensions</PillLink>
              <PillLink to="/png-to-svg-for-cricut">Check a cutting workflow</PillLink>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock title="Real inputs and downloaded outputs">
          <div id="conversion-examples" className="scroll-mt-24 space-y-6 text-sm leading-7 text-slate-700">
            <p>These small examples were converted with the PNG converter using the named preset. Download the input to repeat a conversion, or inspect the actual SVG. Each preview is a raster rendering of that downloaded SVG; it is not a retouched replacement. The results illustrate tradeoffs, not a guarantee for every image.</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {examples.examples.map((example) => (
                <figure key={example.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <figcaption className="text-base font-black text-sky-950">{example.label}</figcaption>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div><p className="mb-2 text-xs font-bold">Raster input</p><img src={example.source} width={example.width} height={example.height} loading="lazy" decoding="async" alt={`${example.label}: source image`} className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-slate-100 object-contain" /></div>
                    <div><p className="mb-2 text-xs font-bold">Traced SVG preview</p><img src={example.preview} width={example.width} height={example.height} loading="lazy" decoding="async" alt={`${example.label}: rendered conversion output`} className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-slate-100 object-contain" /></div>
                  </div>
                  <p className="mt-3"><strong>{example.presetLabel}</strong> · {example.width} × {example.height} pixels</p>
                  <p>{example.inputBytes.toLocaleString("en-US")} input bytes → {example.outputBytes.toLocaleString("en-US")} SVG bytes. {example.paths} path elements; {example.subpaths} subpaths; {example.images} image elements.</p>
                  <p className="mt-2">{example.observations}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-bold text-sky-800">
                    <a className="underline underline-offset-2" href={example.source} download>Download input</a>
                    <a className="underline underline-offset-2" href={example.traced} download>Download traced SVG</a>
                  </div>
                </figure>
              ))}
            </div>
            <p>The geometric examples are original test artwork. The Earth photograph is NASA/JSC’s <a className="text-sky-800 underline" href="https://svs.gsfc.nasa.gov/30613/">Apollo 17 Blue Marble</a>, reduced for this demonstration; credit: Earth Science and Remote Sensing Unit, NASA Johnson Space Center. NASA does not endorse this tool. A photograph loses tonal and texture detail when reduced to flat color regions.</p>
            <p><a className="font-bold text-sky-800 underline" href="/examples/output-inspection/manifest.json" download>Download the example record</a> for exact settings, file hashes and reproducibility details. Compare visible geometry as well as file size: a smaller SVG is not automatically a better conversion.</p>
          </div>
        </SectionBlock>

        <SectionBlock title="SVG output actions">
          <CardGrid>
            {copy.svgOutputActions.map((card) => (
              <SimpleCard key={card.title} title={card.title} body={card.body} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Raster and document exports">
          <CardGrid>
            {copy.rasterDocumentExports.map((card) => (
              <SimpleCard key={card.title} title={card.title} body={card.body} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Why file size changes">
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            {copy.fileSizeNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <div className="flex flex-wrap gap-3">
              {copy.fileSizeLinks.map((link) => (
                <PillLink key={link.to} to={link.to}>
                  {link.label}
                </PillLink>
              ))}
            </div>
          </div>
        </SectionBlock>
        <SectionBlock title="Choose the next step for your output">
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p>Keep SVG when you need scalable geometry or further vector editing. Use <a className="text-sky-800 underline" href="/svg-to-png-converter">PNG export</a> when the destination expects pixels and you need transparency. JPEG has no alpha channel, so check the background before exporting. For print-oriented sharing, open a <a className="text-sky-800 underline" href="/svg-to-pdf-converter">PDF export</a> and inspect its page size and cropping in the application that will print it.</p>
            <p>If the result has an unwanted solid canvas, inspect it in the <a className="text-sky-800 underline" href="/svg-background-editor">background editor</a>. If it looks right but is clipped, inspect the <a className="text-sky-800 underline" href="/svg-resize-and-scale-editor">viewBox in the resize editor</a> before changing geometry. For a website, the <a className="text-sky-800 underline" href="/svg-embed-code-generator">embed-code generator</a> helps prepare markup; review the generated code in your own page.</p>
            <p className="text-xs">Structure references: <a className="text-sky-800 underline" href="https://www.w3.org/TR/SVG2/paths.html">SVG 2 paths and compound subpaths</a>, <a className="text-sky-800 underline" href="https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image">SVG image elements</a>, and <a className="text-sky-800 underline" href="https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox">viewBox coordinate bounds</a>.</p>
          </div>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/exporting-and-downloads" title={title} description={description} />
    </DocsPageShell>
  );
}
