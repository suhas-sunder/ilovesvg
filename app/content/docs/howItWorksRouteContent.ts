export type DocsActionLink = {
  label: string;
  to: string;
};

export type DocsHeroCopy = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  actions: DocsActionLink[];
};

export type DocsCardCopy = {
  title: string;
  body: string;
  footerLinks?: DocsActionLink[];
};

export type DocsFaqItem = {
  q: string;
  a: string;
};

export const HOW_IT_WORKS_HUB_COPY = {
  hero: {
    eyebrow: "How It Works",
    title: "Understand the converter before you tweak it",
    description:
      "This hub explains how iLoveSVG turns raster images into SVG files, how presets and speed labels work, why most outputs are filled paths, when opt-in centerline stroke presets help, and how output history, queueing, copy, download, fullscreen preview, batch conversion, and source previews behave.",
    highlights: [
      "Current converter behavior, not planned features.",
      "Preset and speed guidance tied to real app data.",
      "Troubleshooting paths for messy SVG output.",
    ],
    actions: [
      { label: "Start with the workflow", to: "/how-it-works/conversion-workflow" },
      { label: "Open PNG to SVG", to: "/png-to-svg-converter" },
    ],
  },
  startIntro:
    "The converter is upload-first: choose an image, pick a preset, convert, inspect the output, then edit or export the result that actually fits your goal.",
  whatConverterDoes: [
    {
      title: "Traces image regions into SVG",
      body: "Raster-to-SVG conversion usually traces visible regions into filled paths. Filled paths are normal for logos, silhouettes, scans, stickers, cut files, and many editable SVG workflows.",
    },
    {
      title: "Adds optional centerline strokes",
      body: "New stroke/centerline presets retrace simple line drawings, sketches, handwriting, and diagrams into real SVG strokes. They are opt-in and do not replace the existing filled-path presets.",
    },
    {
      title: "Lets slow work keep running",
      body: "Queued conversions can stay pending or running while you start another preset. A later fast output can finish first, and the slow card should update when its own job finishes.",
    },
    {
      title: "Keeps recent output context",
      body: "Output history can keep recent cards visible after the active upload changes. Cards may show source context and source previews so older outputs are still understandable.",
    },
  ] satisfies DocsCardCopy[],
  doesNotGuarantee: [
    "It cannot promise perfect background removal from every image. Transparency depends on the source and selected preset.",
    "It does not turn every black line into strokes by default. Existing presets remain filled-path based; use opt-in centerline stroke presets when real SVG strokes are the goal.",
    "It cannot guarantee Cricut, cutter, material, or design-app behavior after download.",
    "It cannot make very noisy photos lightweight without simplifying detail or reducing colors.",
  ],
  chooseByGoal: [
    {
      title: "Clean black-and-white cut file",
      body: "Start with lineart, black-and-white, scan, or Cricut cut presets. Favor fewer specks and simpler filled paths.",
      footerLinks: [{ label: "Cricut SVG routes", to: "/png-to-svg-for-cricut" }],
    },
    {
      title: "Layered color SVG",
      body: "Use layered color presets when color separation matters. Expect larger SVGs and slower speed labels as layers increase.",
      footerLinks: [{ label: "Layered SVG routes", to: "/png-to-layered-svg-for-cricut" }],
    },
    {
      title: "Logo or icon",
      body: "Use logo/icon presets for transparent artwork with clean edges. Preserve transparency when the source should not have a background.",
      footerLinks: [{ label: "Logo to SVG", to: "/logo-to-svg-converter" }],
    },
  ] satisfies DocsCardCopy[],
};

export const CONVERSION_WORKFLOW_COPY = {
  hero: {
    eyebrow: "Conversion Workflow",
    title: "From upload to saved SVG",
    description:
      "The converter is designed for comparing results: upload an image, choose a preset, Convert, inspect the output card, adjust settings only when needed, then Copy SVG, Download SVG, use Fullscreen Preview, or run Batch conversion where available.",
    highlights: [
      "What each major converter control does.",
      "How queued outputs keep the page usable.",
      "How history preserves source context while comparing.",
    ],
    actions: [
      { label: "Choose a preset", to: "/how-it-works/presets" },
      { label: "Understand settings", to: "/how-it-works/settings" },
    ],
  },
  basicWorkflowSteps: [
    "Upload an image. PNG, JPG, JPEG, WebP, and route-specific formats are supported on the relevant converter pages.",
    "Choose a preset. Speed tags estimate backend processing cost and do not change output by themselves.",
    "Click Convert. On queued routes, a pending output card appears immediately and may become running before it finishes.",
    "Review the output. Most raster-to-SVG results are filled paths, which is normal for logos, cut files, scans, and stickers.",
    "Open Settings/Edit if the completed card needs local output edits or click-to-convert setting changes.",
    "Click Update preview only when retrace settings should be applied to that selected output.",
    "Use Copy SVG or Download SVG when the visible result is ready.",
    "Keep comparing. Output history can preserve recent cards, including source context, while you try another preset or upload.",
  ],
  majorControlsIntro:
    "Controls are card-specific where possible. Editing one output should not overwrite another output.",
  practicalExamples: [
    {
      title: "I want a clean black-and-white cut file",
      body: "Upload the image, try a lineart or Cricut cut preset, check for specks, then raise cleanup or use a scan preset if the SVG is too noisy.",
    },
    {
      title: "I want a layered color SVG",
      body: "Use layered presets and expect slower speed labels. More colors and layers can improve color separation but also increase file size and processing time.",
    },
    {
      title: "I tried a slow preset and want to keep working",
      body: "Leave the slow queued card in place, start a faster preset, and compare outputs when each card finishes. Cancel only when you no longer want that job.",
    },
  ] satisfies DocsCardCopy[],
};

export const EXPORTING_DOWNLOADS_COPY = {
  hero: {
    eyebrow: "Exporting and Downloads",
    title: "Save the SVG you actually reviewed",
    description:
      "Output cards show dimensions and SVG file size when available. Copy SVG, Download SVG, fullscreen preview, and batch conversion should use the same finalized visible SVG, including supported local output edits.",
    highlights: [
      "Copy and download use the finalized visible SVG.",
      "File size and dimensions help compare outputs.",
      "Batch ZIP behavior is documented where available.",
    ],
    actions: [
      { label: "SVG to PNG", to: "/svg-to-png-converter" },
      { label: "SVG to JPG", to: "/svg-to-jpg-converter" },
      { label: "SVG to WebP", to: "/svg-to-webp-converter" },
      { label: "SVG to PDF", to: "/svg-to-pdf-converter" },
    ],
  },
  svgOutputActions: [
    {
      title: "Download SVG",
      body: "Downloads the current finalized SVG for that output card. Use this when the SVG is large or another app rejects pasted SVG text.",
    },
    {
      title: "Copy SVG",
      body: "Copies the current finalized SVG markup. Some design apps paste SVG differently, so download can be more reliable for large files.",
    },
    {
      title: "Fullscreen Preview",
      body: "Opens a larger view for inspecting transparency, path detail, dimensions, and local output edits before saving.",
    },
    {
      title: "Batch ZIP",
      body: "Batch conversion downloads multiple results as a ZIP file where the route supports batch output. Individual failed items should not break unrelated completed outputs.",
    },
  ] satisfies DocsCardCopy[],
  rasterDocumentExports: [
    {
      title: "PNG and WebP",
      body: "Use PNG or WebP export routes when you need a raster image. These routes render SVG to canvas with size, aspect, background, and quality controls where available.",
    },
    {
      title: "JPG",
      body: "JPG export always uses a solid background because JPEG does not support transparency. Choose the background color before downloading.",
    },
    {
      title: "PDF",
      body: "Use SVG to PDF for document and print handoff when a PDF is the required format instead of editable SVG markup.",
    },
  ] satisfies DocsCardCopy[],
  fileSizeNotes: [
    "Detailed SVGs can be large because every path, color layer, tiny region, and local output edit must be represented as markup. More colors, more layers, lower cleanup, higher trace size, Fill spread, and very detailed presets can all increase file size.",
    "If a design tool becomes slow, try a simpler preset, reduce layers, increase cleanup, resize the source before tracing, or use an SVG cleanup/minifier route after download.",
  ],
  fileSizeLinks: [
    { label: "SVG Minifier", to: "/svg-minifier" },
    { label: "SVG Cleaner", to: "/svg-cleaner" },
    { label: "SVG File Size Inspector", to: "/svg-file-size-inspector" },
  ],
};

export const PRESET_GUIDE_COPY = {
  hero: {
    eyebrow: "Preset Guide",
    title: "Choose a preset by goal, not by guesswork",
    description:
      "The guide below is based on the current preset inventory in the app. Presets are grouped by family and speed label so you can choose between lineart, sketch, scan, logo, optional stroke/centerline, photo-edge, diagram, Cricut/cut, sticker, UI mockup, poster, and layered color output without pretending every image converts the same way.",
    highlights: [
      "Speed colors match the converter preset picker.",
      "Families explain what the output tries to preserve.",
      "Heavy layered presets are called out honestly.",
    ],
    actions: [
      { label: "Try PNG to SVG", to: "/png-to-svg-converter" },
      { label: "Try layered SVG", to: "/png-to-layered-svg-for-cricut" },
    ],
  },
  speedLabelsIntro:
    "Speed depends on image size, detail, colors, transparency, browser/server workload, and whether the preset creates one trace or many layered/color regions.",
  filledPathsIntro:
    "Image-to-SVG conversion normally traces visible regions into filled paths. That is useful for logos, silhouettes, scans, stickers, Cricut/cut files, and layered color regions. The new stroke/centerline family is opt-in for simple drawings that should become real SVG strokes.",
  inventoryIntro:
    "Use the browser preset picker for live search and speed filtering. This table keeps the documentation grounded in the current app data without showing fake before/after images.",
};

export const SETTINGS_GUIDE_COPY = {
  hero: {
    eyebrow: "Settings Guide",
    title: "Know which settings edit now and which settings retrace",
    description:
      "The output editor separates Live preview edits from Click to convert settings. Live edits adjust the selected output card. Click-to-convert settings retrace the original source when you click Convert or Update preview.",
    highlights: [
      "Live preview edits stay card-specific.",
      "Click-to-convert settings retrace from the original source.",
      "Stroke output mode, line weight, and fill spread are documented with limits.",
    ],
    actions: [
      { label: "Workflow first", to: "/how-it-works/conversion-workflow" },
      { label: "Fix a bad result", to: "/how-it-works/troubleshooting" },
    ],
  },
  settingsInventoryIntro:
    "Visible settings are route-aware. Unsupported settings are hidden instead of pretending to work.",
  strokeAndFillCards: [
    {
      title: "Stroke output mode",
      body: "Compatible line-art outputs can retrace the original source as Filled shapes or Centerline strokes. Centerline strokes are best for simple sketches, handwriting, and diagrams; filled shapes remain best for logos, cut files, and most conversions.",
    },
    {
      title: "Line weight",
      body: "Line weight changes stroke width only when the SVG contains actual stroke attributes. Many image-to-SVG conversions produce filled paths instead, so the control can be hidden or disabled for those outputs.",
    },
    {
      title: "Fill spread",
      body: "Fill spread expands filled regions by adding a same-color under-stroke where safe. It is manual, off by default, disabled for precision cut outputs, and can increase file size or make tight details heavier.",
    },
    {
      title: "File size and parity",
      body: "Preview, Copy SVG, Download SVG, fullscreen review, and file size display should use the same finalized SVG for the selected output card.",
    },
  ] satisfies DocsCardCopy[],
  recommendedGoalCards: [
    {
      title: "Cricut/cut files",
      body: "Favor simpler filled paths, higher cleanup, fewer tiny islands, transparent output when appropriate, and fewer layers unless the project needs color separation.",
    },
    {
      title: "Layered color SVGs",
      body: "Tune color layer count, requested palette count, min region percent, layer max trace side, min island px, hole fill px, and remove transparent.",
    },
    {
      title: "Noisy images",
      body: "Try scan or cleanup presets, increase turd size or min island px, use noise reduction, and consider resizing the source before converting.",
    },
    {
      title: "Centerline stroke drawings",
      body: "Use Stroke Trace or Centerline presets on clean line art. Increase centerline stroke width for heavier lines, or simplify more when a plotter-style SVG should have fewer segments.",
    },
  ] satisfies DocsCardCopy[],
};

export const TROUBLESHOOTING_DOCS_COPY = {
  hero: {
    eyebrow: "Troubleshooting",
    title: "Fix messy SVG output without guessing",
    description:
      "These notes cover common converter limits and fixes: blank previews, image failures, output that looks too dark, too many specks, lost detail, unwanted backgrounds, rate limit messages, browser memory, slow queued presets, copy/download issues, and batch conversion failures.",
    highlights: [
      "Practical fixes before changing advanced settings.",
      "Transparency and fake-background guidance.",
      "Queue, rate-limit, and browser-limit explanations.",
    ],
    actions: [
      { label: "Settings Guide", to: "/how-it-works/settings" },
      { label: "Preset Guide", to: "/how-it-works/presets" },
    ],
  },
  limits: [
    "Large images, many colors, low cleanup, and high layer counts can produce large SVGs that are slower in browsers and design tools.",
    "Browser memory can limit huge previews, raster exports, and very large SVG copy/paste flows.",
    "Server fallback and protected conversion routes may show temporary usage or rate limit messages when load is high.",
    "Batch conversion can partially fail if one source image is unsupported, too large, or too complex for the selected preset.",
    "Use Download SVG instead of Copy SVG if the pasted SVG is too large for another app.",
    "Use lineart, scan, or cut presets for simpler cutting. Detailed layered color presets are not always good craft cut files.",
  ],
  faqs: [
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
  ] satisfies DocsFaqItem[],
};
