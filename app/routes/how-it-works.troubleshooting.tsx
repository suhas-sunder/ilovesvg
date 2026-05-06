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

const title = "SVG Converter Troubleshooting | iLoveSVG";
const description =
  "Fix image-to-SVG conversion problems: preview does not appear, failed conversion, output too dark, too many specks, lost detail, unwanted transparent background layer, file too large, rate limit, queued slow preset, disabled line weight, and batch issues.";
const canonical = `${SITE_URL}/how-it-works/troubleshooting`;

const faqs = [
  {
    q: "Why does my SVG look filled instead of outlined?",
    a: "Raster tracing usually creates filled paths from visible regions. Filled paths are normal for logos, cut files, scans, stickers, and many SVG workflows.",
  },
  {
    q: "Why is a Very Slow or Insanely Slow preset still running?",
    a: "Heavy layered or high-palette presets can keep running in the queue. You can start another preset while that output card remains pending or running.",
  },
  {
    q: "Why did a transparent image get an unwanted background?",
    a: "Use transparent-friendly presets, keep transparent removal settings enabled where appropriate, and avoid flattening styles when the source should remain transparent.",
  },
];

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
  return (
    <DocsPageShell currentPath="/how-it-works/troubleshooting">
      <DocsHero
        eyebrow="Troubleshooting"
        title="Fix messy SVG output without guessing"
        description="These notes cover common converter limits and fixes: blank previews, image failures, output that looks too dark, too many specks, lost detail, unwanted backgrounds, rate limit messages, browser memory, slow queued presets, copy/download issues, and batch conversion failures."
        highlights={[
          "Practical fixes before changing advanced settings.",
          "Transparency and fake-background guidance.",
          "Queue, rate-limit, and browser-limit explanations.",
        ]}
        actions={
          <>
            <PillLink to="/how-it-works/settings">Settings Guide</PillLink>
            <PillLink to="/how-it-works/presets">Preset Guide</PillLink>
          </>
        }
      />

      <DocsContent>
        <SectionBlock title="Common problems and fixes">
          <CardGrid>
            {TROUBLESHOOTING_ITEMS.map((item) => (
              <SimpleCard key={item.problem} title={item.problem} body={item.fix} />
            ))}
          </CardGrid>
        </SectionBlock>

        <SectionBlock title="Limits to keep in mind">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "Large images, many colors, low cleanup, and high layer counts can produce large SVGs that are slower in browsers and design tools.",
              "Browser memory can limit huge previews, raster exports, and very large SVG copy/paste flows.",
              "Server fallback and protected conversion routes may show temporary usage or rate limit messages when load is high.",
              "Batch conversion can partially fail if one source image is unsupported, too large, or too complex for the selected preset.",
              "Use Download SVG instead of Copy SVG if the pasted SVG is too large for another app.",
              "Use lineart, scan, or cut presets for simpler cutting. Detailed layered color presets are not always good craft cut files.",
            ].map((limit) => (
              <div key={limit} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {limit}
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Frequently asked questions">
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-bold text-slate-950">{faq.q}</summary>
                <p className="mt-2 text-sm leading-6 text-slate-700">{faq.a}</p>
              </details>
            ))}
          </div>
        </SectionBlock>
      </DocsContent>
      <DocsJsonLd path="/how-it-works/troubleshooting" title={title} description={description} faqs={faqs} />
    </DocsPageShell>
  );
}
