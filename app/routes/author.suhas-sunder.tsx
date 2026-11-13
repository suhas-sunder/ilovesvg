import { Link } from "react-router";
import { DocsContent, DocsPageShell, PillLink, SectionBlock } from "~/client/components/docs/HowItWorksDocs";

const canonical = "https://www.ilovesvg.com/author/suhas-sunder";
const title = "Suhas Sunder - iLoveSVG Maintainer";
const description = "Meet Suhas Sunder, the software engineer who builds and maintains iLoveSVG's conversion tools, editing workflows, documentation and browser compatibility.";

export function meta() {
  return [
    { title }, { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "profile" }, { property: "og:url", content: canonical },
  ];
}

export default function MaintainerProfile() {
  return (
    <DocsPageShell currentPath="/author/suhas-sunder" showSocialLinks={false}>
      <header className="border-b border-sky-100 bg-sky-50/70">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">The person behind iLoveSVG</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-sky-950 sm:text-5xl">Suhas Sunder</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">Software engineer, creator and maintainer of iLoveSVG.</p>
          <p className="mt-4 max-w-2xl leading-7 text-slate-700">I build practical tools for converting, inspecting and editing SVG files. My work on iLoveSVG includes the interfaces, conversion workflows, documentation and ongoing corrections.</p>
          <div className="mt-6 flex flex-wrap gap-3"><PillLink to="/">Open the converter</PillLink><PillLink to="/how-it-works">How the tools work</PillLink></div>
        </div>
      </header>
      <DocsContent>
        <SectionBlock title="What I maintain">
          <div className="grid gap-5 text-sm leading-7 text-slate-700 md:grid-cols-2">
            <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-5"><h3 className="font-bold text-sky-950">Tools and conversion behavior</h3><p className="mt-2">Image-to-SVG tracing, presets, source and result previews, SVG editing, export controls and downloads. Different inputs need different settings; a traced photograph does not recover the original vector artwork.</p></div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-5"><h3 className="font-bold text-sky-950">Usability and clear explanations</h3><p className="mt-2">Keyboard access, mobile layouts, error recovery and instructions that describe the controls users actually see. I keep limitations visible rather than promising that every input will produce a suitable result.</p></div>
          </div>
        </SectionBlock>
        <SectionBlock title="How changes are checked">
          <div className="max-w-3xl space-y-3 text-sm leading-7 text-slate-700">
            <p>The project uses automated checks for conversion behavior, routes and output handling, alongside browser workflow tests and visual inspection. Downloaded files are checked as well as their previews. Changes to presets or tracing need separate output-quality review.</p>
            <p>Browser emulation cannot establish that a file works on every phone, design application or cutting machine. Inspect the downloaded result in the application you intend to use, and keep your original artwork.</p>
            <p>Some raster conversions can use server processing when the browser path is unavailable or unsuitable. The <Link className="font-semibold text-sky-800 underline underline-offset-4" to="/privacy-policy">privacy policy</Link> describes file handling; individual tool instructions explain their workflow.</p>
          </div>
        </SectionBlock>
        <SectionBlock title="Other projects">
          <p className="max-w-3xl text-sm leading-7 text-slate-700">I also maintain <a className="font-semibold text-sky-800 underline underline-offset-4" href="https://www.ilovetimers.com/author/suhas-sunder/">iLoveTimers</a>, a collection of time tools, and <a className="font-semibold text-sky-800 underline underline-offset-4" href="https://www.morsewords.com/about">MorseWords</a>, for translating and practising Morse code.</p>
        </SectionBlock>
      </DocsContent>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "ProfilePage", "@id": canonical,
        url: canonical, name: title, description,
        mainEntity: { "@type": "Person", "@id": `${canonical}#person`, name: "Suhas Sunder", url: canonical, jobTitle: "Software engineer", description: "Creator and maintainer of iLoveSVG." },
      }) }} />
    </DocsPageShell>
  );
}
