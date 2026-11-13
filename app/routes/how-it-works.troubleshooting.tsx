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
import { SITE_URL, TROUBLESHOOTING_ITEMS } from "~/client/lib/docs/howItWorksContent";
import { TROUBLESHOOTING_DOCS_COPY } from "~/content/docs/howItWorksRouteContent";

const title = "SVG Converter Troubleshooting | iLoveSVG";
const description =
  "Fix image-to-SVG conversion problems: preview does not appear, failed conversion, output too dark, too many specks, lost detail, unwanted transparent background layer, file too large, rate limit, queued slow preset, disabled line weight, and batch issues.";
const canonical = `${SITE_URL}/how-it-works/troubleshooting`;

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

export default function TroubleshootingDocs() {
  const copy = TROUBLESHOOTING_DOCS_COPY;
  return (
    <DocsPageShell currentPath="/how-it-works/troubleshooting">
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
        <div id="mobile-image-recovery" className="scroll-mt-24">
          <SectionBlock title="A phone photo won’t upload or convert">
            <CardGrid>
              <SimpleCard
                title="Export a copy in a supported format"
                body={
                  <div className="space-y-3">
                    <p>
                      PNG to SVG accepts PNG, JPG/JPEG, and WebP. Check the upload instructions on other converters.
                      An iPhone photo can be HEIC (a compressed HEIF image) or ProRAW (a raw photo saved as DNG).
                      Open the file in an editor that can read it and export a JPEG copy for a photo or a PNG copy for artwork with transparent areas.
                      Keep the original. Renaming the file extension leaves the format unchanged.
                    </p>
                    <p>
                      On an iPhone with Preview, open the HEIC image, tap the menu next to the filename, choose Export, and select JPEG or PNG.
                      Leave Alpha on if the PNG needs transparency, then choose a location and save the copy.
                      Apple Photos can share an edited ProRAW photo as a JPEG via AirDrop, Mail, or Messages. Select the saved copy in the converter.
                    </p>
                    <p className="text-xs leading-5">
                      <a className="font-semibold text-sky-800 underline" href="https://support.apple.com/en-gb/guide/iphone/iph61c20afe1/27/ios/27">Export in Preview</a>
                      {" · "}
                      <a className="font-semibold text-sky-800 underline" href="https://support.apple.com/en-am/119916">Share a ProRAW photo</a>
                    </p>
                  </div>
                }
              />
              <SimpleCard
                title="Reduce the pixel dimensions"
                body={
                  <div className="space-y-3">
                    <p>
                      File size measures storage. A 6,000 × 4,000 photo still has 24 million pixels after you compress it at the same dimensions.
                      The browser needs memory to unpack those pixels. PNG to SVG can prepare some oversized images on your device.
                      If you get a size or memory error, export a smaller copy. For that photo, try 3,000 × 2,000 to keep its aspect ratio and use one-quarter as many pixels.
                      Check that the details you need are still visible.
                    </p>
                    <p>
                      If the preview is sideways or a WebP upload shows an orientation error, set the orientation in your editor and export a fresh PNG or JPEG.
                      Reopen the saved copy to check that it is upright. Choose PNG and keep transparency enabled when you need a clear background.
                      JPEG has no transparency.
                    </p>
                    <p className="text-xs leading-5">
                      <a className="font-semibold text-sky-800 underline" href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/image-orientation#from-image">Orientation metadata</a>
                      {" · "}
                      <a className="font-semibold text-sky-800 underline" href="https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types#choosing_an_image_format">Image formats and transparency</a>
                    </p>
                  </div>
                }
              />
              <SimpleCard
                title="Recover from an interrupted conversion"
                body={
                  <div className="space-y-3">
                    <p>
                      While the page is open, eligible conversions can send the image to the server if the browser trace fails.
                      Some modes, such as centerline stroke tracing, report a browser failure directly. Try a smaller copy first if you need the same output style.
                    </p>
                    <p>
                      If the server is busy, wait before trying again and follow any retry time shown. If the connection drops, reconnect before starting a new attempt.
                      Use Cancel on the job card when it is available and you want to stop the job. For a failed job with Retry, keep the same source selected or reselect it if prompted.
                    </p>
                    <p>
                      If the browser closes or reloads the tab, reopen the converter and select your saved copy again.
                      Start with one image. When you see the result you want, tap Download SVG to save it before leaving the page.
                    </p>
                  </div>
                }
              />
            </CardGrid>
            <div className="mt-5 flex flex-wrap gap-3">
              <PillLink to="/png-to-svg-converter">PNG to SVG</PillLink>
              <PillLink to="/jpg-to-svg-converter">JPG to SVG</PillLink>
              <PillLink to="/webp-to-svg-converter">WebP to SVG</PillLink>
              <PillLink to="/how-it-works/conversion-workflow">Conversion workflow</PillLink>
            </div>
          </SectionBlock>
        </div>

        <SectionBlock title="Common problems and fixes">
          <CardGrid>
            {TROUBLESHOOTING_ITEMS.map((item) => (
              <SimpleCard key={item.problem} title={item.problem} body={item.fix} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Limits to keep in mind">
          <div className="grid gap-3 md:grid-cols-2">
            {copy.limits.map((limit) => (
              <div key={limit} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {limit}
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Frequently asked questions">
          <div className="space-y-3">
            {copy.faqs.map((faq) => (
              <details key={faq.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-bold text-slate-950">{faq.q}</summary>
                <p className="mt-2 text-sm leading-6 text-slate-700">{faq.a}</p>
              </details>
            ))}
          </div>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/troubleshooting" title={title} description={description} faqs={copy.faqs} />
    </DocsPageShell>
  );
}
