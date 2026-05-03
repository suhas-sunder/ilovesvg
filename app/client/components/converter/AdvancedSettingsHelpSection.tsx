import * as React from "react";

type HelpItem = {
  title: string;
  body: string;
};

const traceItems: HelpItem[] = [
  {
    title: "Trace mode",
    body: "Layered color tracing separates the image into editable SVG color groups. Single-color tracing creates one main path color and is better for line art, silhouettes, and simple cut files.",
  },
  {
    title: "Color layer count",
    body: "This controls how many color groups the layered trace tries to create. If your SVG has too few colors, increasing the count from 5 to 8 usually preserves more distinct output colors, but it can also make the SVG larger and more complex.",
  },
  {
    title: "Trace detail limit",
    body: "This caps the internal tracing size. Higher values can preserve more detail, while lower values are faster and often cleaner for Cricut-style projects.",
  },
  {
    title: "Remove small color regions",
    body: "This filters tiny color areas before they become layers. Raise it when shadows, anti-aliasing, or texture create small pieces you do not want to cut or edit.",
  },
  {
    title: "Curve smoothing and remove tiny specks",
    body: "Curve smoothing reduces rough nodes in traced paths. Remove tiny specks filters small fragments. If speckles appear in the trace, increasing speck removal can remove unwanted shapes, but very high values may remove fine details.",
  },
  {
    title: "Corner handling",
    body: "Corner handling controls how tracing resolves ambiguous turns. Majority is a good general choice for layered color artwork; other options can change small corner shapes in detailed line art.",
  },
];

const colorItems: HelpItem[] = [
  {
    title: "Simplify colors and color simplification",
    body: "Simplifying colors groups nearby shades before tracing. Use stronger simplification for stickers, logos, and vinyl. Lower it when the result looks too flat or loses important color changes.",
  },
  {
    title: "Merge similar colors",
    body: "Merge tolerance combines near-duplicate output colors. Lower it to preserve more detail. Raise it when gradients or compression noise create too many similar layers.",
  },
  {
    title: "Layer order",
    body: "Layer order controls how color groups are stacked in the SVG. Light-to-dark is predictable for previewing, largest-first can make editing broad shapes easier, and palette order follows the generated color palette.",
  },
  {
    title: "Ignore white areas",
    body: "Use this when white is just the background canvas. Leave it off when white is part of the artwork, such as eyes, lettering, highlights, or sticker details.",
  },
  {
    title: "Ignore transparent pixels",
    body: "This is useful for transparent PNGs because invisible canvas pixels are ignored before tracing. It helps the SVG focus on real artwork.",
  },
  {
    title: "Brightness and contrast",
    body: "These change the raster image before tracing. Brightness can bring out faint artwork, while contrast can make color and edge separation stronger.",
  },
];

const inputOutputItems: HelpItem[] = [
  {
    title: "Remove detected input colors",
    body: "Input colors are sampled from the uploaded image before tracing. Removing one changes the next trace. Use this when a background color, watermark, or source color should be ignored before the SVG is generated.",
  },
  {
    title: "Color tolerance",
    body: "Tolerance controls how close a pixel must be to a selected input color before it is removed. Low tolerance removes exact colors. Higher tolerance removes nearby anti-aliased shades too.",
  },
  {
    title: "Apply color removal to",
    body: "On routes with both single and layered tracing, this chooses whether selected input colors are removed from single traces, layered traces, or both.",
  },
  {
    title: "Remove detected output colors",
    body: "Output colors come from the actual generated SVG layers. If a cream background appears as an output layer, removing that output color should immediately hide it from the preview and export without retracing.",
  },
  {
    title: "Layer color editing",
    body: "Layer color controls edit the current SVG layer fill or stroke. These edits are local to that result and are included when you copy or download the SVG.",
  },
  {
    title: "Global layer opacity and per-layer opacity",
    body: "Global layer opacity applies to all layers in the next trace. Per-layer opacity edits only the selected output layer in the current SVG, which is useful for preview, stickers, and visual mockups.",
  },
];

const backgroundSizeItems: HelpItem[] = [
  {
    title: "Transparent background",
    body: "Transparent background removes the SVG background rectangle. Use it for Cricut, Silhouette, vinyl, and layered designs where the artwork should not include a canvas.",
  },
  {
    title: "Background color and opacity",
    body: "When transparency is off, the background color becomes part of the exported SVG preview. Background opacity only affects the background rectangle, not the traced layers.",
  },
  {
    title: "SVG width and SVG height",
    body: "These set the exported SVG dimensions from the current output size. The viewBox remains scalable, so changing dimensions changes how the SVG is presented without throwing away vector detail.",
  },
  {
    title: "Preserve aspect ratio",
    body: "When preserve aspect ratio is enabled and you change the width, the height updates automatically. This prevents distorted artwork.",
  },
  {
    title: "Standard resize options",
    body: "Use 0.5x, 1x, 1.5x, and 2x for quick export sizes. Reset to original returns the current SVG to the dimensions produced by the trace.",
  },
  {
    title: "Copy SVG and download SVG",
    body: "Copy and download use the same edited SVG as the preview, including hidden layers, recolored layers, opacity edits, background changes, and size changes.",
  },
];

export function AdvancedSettingsHelpSection() {
  return (
    <section
      id="advanced-settings-help"
      className="bg-slate-50 border-t border-slate-200"
    >
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="max-w-[86ch]">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Settings reference
              </p>
              <h2 className="font-display mt-2 text-xl font-[800] leading-tight tracking-[-0.025em] text-sky-950 md:text-2xl">
                Tune SVG tracing without guessing
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-slate-700">
                Use this reference after the basic upload and example sections
                when you want finer control. Live Preview settings edit the
                selected SVG result directly. Click to convert settings change
                how the uploaded image is processed, so they apply after Update
                preview or Convert.
              </p>
            </div>
          </header>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="font-display text-lg font-[800] tracking-[-0.02em] text-sky-950">
              Preset speed tags
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Preset tags estimate backend processing intensity. Lightning Fast
              and Insane Speed presets are expected to be the lightest; Low
              Speed and Slow Speed presets usually request more detail, edge
              cleanup, or layered color tracing. The tag is informational and
              does not change the SVG by itself.
            </p>
          </section>

          <HelpGrid title="Tracing detail" items={traceItems} />
          <HelpGrid title="Color and cleanup" items={colorItems} />
          <HelpGrid title="Input colors vs output colors" items={inputOutputItems} />
          <HelpGrid title="Background, size, and export" items={backgroundSizeItems} />

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="font-display text-lg font-[800] tracking-[-0.02em] text-sky-950">
              Practical examples
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                "If the traced SVG has too few colors, raise color layer count or lower merge tolerance. Expect a larger SVG with more editable groups.",
                "If the result looks too flat, lower color simplification or increase the layer count so more source colors survive the trace.",
                "If a cream or white background becomes its own output layer, hide that output layer directly from Remove detected output colors.",
                "If tiny fragments appear, increase Remove tiny specks or Remove small color regions. Use modest values for detailed illustrations.",
                "If preserve aspect ratio is enabled and you change the width, the height updates automatically so the artwork does not stretch.",
                "If you only recolor, hide, resize, or adjust opacity on output layers, copy and download should match the preview without another backend trace.",
              ].map((body) => (
                <p
                  key={body}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                >
                  {body}
                </p>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}

function HelpGrid({ title, items }: { title: string; items: HelpItem[] }) {
  return (
    <section className="mt-6">
      <h3 className="font-display text-lg font-[800] tracking-[-0.02em] text-sky-950">
        {title}
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="text-sm font-semibold text-slate-900">
              {item.title}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
