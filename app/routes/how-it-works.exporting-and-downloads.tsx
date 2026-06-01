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
      </DocsContent>
      <DocsJsonLd path="/how-it-works/exporting-and-downloads" title={title} description={description} />
    </DocsPageShell>
  );
}
