import * as React from "react";
import type { Route } from "./+types/svg-to-jsx-converter";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import { ContextualAdCard } from "~/client/components/ads/ContextualAdCard";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to JSX Converter - React SVG Component Markup | iLoveSVG";
  const description =
    "Convert SVG markup into JSX for React components. Translate common SVG attributes, preserve viewBox, copy JSX, and review component output before pasting.";
  const canonical = "https://www.ilovesvg.com/svg-to-jsx-converter";

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

const EXAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="24" fill="#e0f2fe"/>
  <path d="M34 74 54 38l32 44H42" fill="none" stroke="#0369a1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ATTRIBUTE_MAP: Record<string, string> = {
  "accent-height": "accentHeight",
  "alignment-baseline": "alignmentBaseline",
  "baseline-shift": "baselineShift",
  "clip-path": "clipPath",
  "clip-rule": "clipRule",
  "color-interpolation": "colorInterpolation",
  "color-interpolation-filters": "colorInterpolationFilters",
  "color-profile": "colorProfile",
  "color-rendering": "colorRendering",
  "dominant-baseline": "dominantBaseline",
  "enable-background": "enableBackground",
  "fill-opacity": "fillOpacity",
  "fill-rule": "fillRule",
  "flood-color": "floodColor",
  "flood-opacity": "floodOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-size-adjust": "fontSizeAdjust",
  "font-stretch": "fontStretch",
  "font-style": "fontStyle",
  "font-variant": "fontVariant",
  "font-weight": "fontWeight",
  "glyph-name": "glyphName",
  "glyph-orientation-horizontal": "glyphOrientationHorizontal",
  "glyph-orientation-vertical": "glyphOrientationVertical",
  "horiz-adv-x": "horizAdvX",
  "horiz-origin-x": "horizOriginX",
  "image-rendering": "imageRendering",
  "letter-spacing": "letterSpacing",
  "lighting-color": "lightingColor",
  "marker-end": "markerEnd",
  "marker-mid": "markerMid",
  "marker-start": "markerStart",
  "overline-position": "overlinePosition",
  "overline-thickness": "overlineThickness",
  "paint-order": "paintOrder",
  "pointer-events": "pointerEvents",
  "shape-rendering": "shapeRendering",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "strikethrough-position": "strikethroughPosition",
  "strikethrough-thickness": "strikethroughThickness",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-opacity": "strokeOpacity",
  "stroke-width": "strokeWidth",
  "text-anchor": "textAnchor",
  "text-decoration": "textDecoration",
  "text-rendering": "textRendering",
  "transform-origin": "transformOrigin",
  "underline-position": "underlinePosition",
  "underline-thickness": "underlineThickness",
  "unicode-bidi": "unicodeBidi",
  "vert-adv-y": "vertAdvY",
  "vert-origin-x": "vertOriginX",
  "vert-origin-y": "vertOriginY",
  "word-spacing": "wordSpacing",
  "writing-mode": "writingMode",
  "xlink:actuate": "xlinkActuate",
  "xlink:arcrole": "xlinkArcrole",
  "xlink:href": "xlinkHref",
  "xlink:role": "xlinkRole",
  "xlink:show": "xlinkShow",
  "xlink:title": "xlinkTitle",
  "xlink:type": "xlinkType",
  class: "className",
  for: "htmlFor",
};

export default function SvgToJsxConverter(_: Route.ComponentProps) {
  const [input, setInput] = React.useState(EXAMPLE_SVG);
  const [componentName, setComponentName] = React.useState("SvgIcon");
  const [wrapComponent, setWrapComponent] = React.useState(true);
  const [toast, setToast] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const conversion = React.useMemo(() => {
    try {
      return {
        output: convertSvgToJsx(input, {
          componentName,
          wrapComponent,
        }),
        error: null,
      };
    } catch (err) {
      return {
        output: "",
        error: err instanceof Error ? err.message : "Could not convert SVG.",
      };
    }
  }, [componentName, input, wrapComponent]);
  const output = conversion.output;

  React.useEffect(() => {
    setError(conversion.error);
  }, [conversion.error]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (file.type && file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
      setError("Upload an SVG file.");
      return;
    }

    const text = await file.text();
    setInput(text);
  }

  async function copyOutput() {
    if (!output.trim()) return;
    try {
      await navigator.clipboard.writeText(output);
      setToast("Copied JSX");
      window.setTimeout(() => setToast(null), 1400);
    } catch {
      setError("Clipboard copy failed. Select and copy the output manually.");
    }
  }

  function downloadOutput() {
    if (!output.trim()) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeComponentName(componentName)}.tsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="hidden py-6 lg:block">
            <AdSenseDelayed
              slot="2090332782"
              delayMs={1500}
              minHeight={90}
              maxHeight={120}
              format="horizontal"
              fullWidth={true}
              className="mx-auto w-full max-w-[970px]"
            />
          </div>

          <section className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-sky-700">
                Developer SVG utility
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-sky-950 sm:text-4xl">
                SVG to JSX Converter
              </h1>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                Paste or upload SVG markup and convert it into React-friendly
                JSX. The transformer removes XML wrappers, keeps the SVG
                structure, and converts common SVG attribute names such as
                class, stroke-width, fill-rule, and clip-path.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Preserves viewBox and SVG children",
                  "Converts common React attribute names",
                  "Optional component wrapper",
                  "Runs locally in your browser",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-sm font-semibold text-slate-800"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">
                    Convert SVG markup
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Paste SVG, upload a file, then copy or download JSX.
                  </p>
                </div>
                <label className="cursor-pointer rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800 transition hover:bg-sky-100 focus-within:ring-2 focus-within:ring-sky-300">
                  Upload SVG
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="sr-only"
                    onChange={onPick}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block text-sm font-bold text-slate-800">
                  Component name
                  <input
                    value={componentName}
                    onChange={(event) => setComponentName(event.target.value)}
                    maxLength={64}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={wrapComponent}
                    onChange={(event) => setWrapComponent(event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-700 focus:ring-sky-300"
                  />
                  Wrap component
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  SVG input
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    spellCheck={false}
                    className="mt-2 min-h-[360px] w-full rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-slate-50 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-800">
                  JSX output
                  <textarea
                    value={output}
                    readOnly
                    spellCheck={false}
                    className="mt-2 min-h-[360px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs leading-5 text-slate-900 shadow-sm outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyOutput}
                  className="cursor-pointer rounded-xl bg-sky-700 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!output.trim()}
                >
                  Copy JSX
                </button>
                <button
                  type="button"
                  onClick={downloadOutput}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!output.trim()}
                >
                  Download TSX
                </button>
              </div>

              <div className="mt-3 min-h-[24px] text-sm font-semibold" aria-live="polite">
                {error ? <p className="text-rose-700">{error}</p> : null}
                {toast ? <p className="text-emerald-700">{toast}</p> : null}
              </div>
            </section>
          </section>
        </div>

        <SeoSections />

        <div className="mx-auto max-w-[1180px] px-4 pb-10">
          <CurrentRouteGuide />
        </div>
        <OtherToolsLinks />
      </main>
      <ContextualAdCard />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

function SeoSections() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-10 text-slate-800">
        <article className="grid gap-8">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              React SVG workflow
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-sky-950 md:text-3xl">
              Convert SVG markup into JSX you can review
            </h2>
            <p className="mt-3 max-w-[80ch] text-[15px] leading-7 text-slate-700">
              This route is for developers who already have SVG markup and need
              React-compatible JSX. It changes markup syntax, not the artwork:
              paths, groups, fills, strokes, and the viewBox stay readable while
              common attributes are translated for React.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="m-0 text-lg font-bold text-sky-950">
                What the converter changes
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                XML wrappers and comments are removed, common SVG attributes are
                camelCase converted, inline style strings become JSX style
                objects, and reserved words such as class are changed to
                className.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="m-0 text-lg font-bold text-sky-950">
                What the converter does not do
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                It does not optimize paths, redesign the SVG, or guarantee that
                every custom attribute is framework-perfect. Review the JSX
                before committing it to a component library.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="m-0 text-lg font-bold text-sky-950">
              When to use this instead of related tools
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Use SVG to JSX
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  When the target is a React or Remix component and you want
                  copyable JSX markup.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Use embed code generator
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  When you need HTML img, inline SVG, CSS background, mask, or
                  object/embed snippets.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Use SVG to Base64
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  When you need an encoded data URI or Base64 payload for CSS,
                  config files, or single-file demos.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="m-0 text-lg font-bold text-sky-950">FAQ</h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Does this create a full React component?",
                  a: "Yes, when Wrap component is enabled. You can also output plain JSX if you only need the SVG element markup.",
                },
                {
                  q: "Does this optimize SVG paths?",
                  a: "No. This is a JSX conversion tool. Use an SVG cleaner or minifier when you want markup cleanup or file-size reduction.",
                },
                {
                  q: "Are attributes converted to React names?",
                  a: "Common attributes such as stroke-width, fill-rule, clip-path, and class are converted to React-friendly names.",
                },
                {
                  q: "Should I review the output before pasting it into an app?",
                  a: "Yes. Complex SVGs can contain unusual attributes, IDs, filters, or external references that should be reviewed in your codebase.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}

function convertSvgToJsx(
  raw: string,
  options: { componentName: string; wrapComponent: boolean },
) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error("Paste SVG markup that contains an <svg> element.");
  }

  let svg = trimmed
    .replace(/<\?xml[\s\S]*?\?>\s*/gi, "")
    .replace(/<!doctype[\s\S]*?>\s*/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+xmlns:xlink=(["']).*?\1/g, "");

  svg = svg.replace(/\s([a-zA-Z_:][\w:.-]*)=/g, (match, attr) => {
    const next = ATTRIBUTE_MAP[attr] ?? attr.replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
    return ` ${next}=`;
  });

  svg = svg.replace(/style=(["'])(.*?)\1/g, (_match, _quote, value) => {
    const styleObject = value
      .split(";")
      .map((entry: string) => entry.trim())
      .filter(Boolean)
      .map((entry: string) => {
        const [key, ...rest] = entry.split(":");
        const val = rest.join(":").trim();
        if (!key || !val) return null;
        const jsxKey = key.trim().replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
        return `${jsxKey}: ${JSON.stringify(val)}`;
      })
      .filter(Boolean)
      .join(", ");
    return `style={{ ${styleObject} }}`;
  });

  if (!options.wrapComponent) return formatJsx(svg);

  const name = safeComponentName(options.componentName);
  return `import * as React from "react";\n\nexport function ${name}(props: React.SVGProps<SVGSVGElement>) {\n  return (\n${indent(formatJsx(svg).replace(/<svg\\b/, "<svg {...props}"), 4)}\n  );\n}\n`;
}

function safeComponentName(input: string) {
  const cleaned = input
    .replace(/[^a-zA-Z0-9_$]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const name = cleaned || "SvgIcon";
  return /^[A-Za-z_$]/.test(name) ? name : `Svg${name}`;
}

function formatJsx(input: string) {
  return input
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function indent(input: string, spaces: number) {
  const pad = " ".repeat(spaces);
  return input
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
}
