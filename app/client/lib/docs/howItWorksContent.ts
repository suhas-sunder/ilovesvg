import { ALL_PRESET_ADDITIONS } from "~/client/lib/converter/presetAdditions";
import {
  getPresetIntensityLabel,
  inferPresetBackendIntensity,
  type PresetBackendIntensity,
} from "~/client/lib/converter/presetIntensity";

export const SITE_URL = "https://www.ilovesvg.com";

export type DocsPage = {
  title: string;
  path: string;
  description: string;
};

export const DOCS_PAGES: DocsPage[] = [
  {
    title: "How It Works",
    path: "/how-it-works",
    description:
      "Start here for the image-to-SVG workflow, presets, settings, output history, queueing, and download behavior.",
  },
  {
    title: "Conversion Workflow",
    path: "/how-it-works/conversion-workflow",
    description:
      "Learn the upload, preset, convert, review, edit, queue, copy, download, and batch conversion flow.",
  },
  {
    title: "Preset Guide",
    path: "/how-it-works/presets",
    description:
      "Choose between lineart, sketch, scan, logo, photo-edge, layered color, sticker, and cut-style presets.",
  },
  {
    title: "Settings Guide",
    path: "/how-it-works/settings",
    description:
      "Understand trace detail, cleanup, color layers, output appearance, size, export, and update-preview settings.",
  },
  {
    title: "Troubleshooting",
    path: "/how-it-works/troubleshooting",
    description:
      "Fix blank previews, messy traces, transparent-background surprises, slow presets, failed jobs, and large SVGs.",
  },
  {
    title: "Exporting and Downloads",
    path: "/how-it-works/exporting-and-downloads",
    description:
      "Use Copy SVG, Download SVG, batch ZIP downloads, file size, fullscreen review, and SVG-to-raster export routes correctly.",
  },
];

export const SPEED_GUIDE: Array<{
  id: PresetBackendIntensity;
  label: string;
  summary: string;
  useWhen: string;
}> = [
  {
    id: "lightning-fast",
    label: getPresetIntensityLabel("lightning-fast"),
    summary: "Very light tracing work or local output styling.",
    useWhen: "Use for quick checks, simple files, and low-cost edits.",
  },
  {
    id: "extreme-speed",
    label: getPresetIntensityLabel("extreme-speed"),
    summary: "Simple single-trace presets with low processing cost.",
    useWhen: "Use first for clean line art, logos, scans, and fast comparisons.",
  },
  {
    id: "high-speed",
    label: getPresetIntensityLabel("high-speed"),
    summary: "Normal tracing cost with balanced detail.",
    useWhen: "Use when the faster preset loses too much detail.",
  },
  {
    id: "low-speed",
    label: getPresetIntensityLabel("low-speed"),
    summary: "Detailed tracing, photo-edge work, or heavier cleanup.",
    useWhen: "Use when detail matters and you can wait a little longer.",
  },
  {
    id: "slow-speed",
    label: getPresetIntensityLabel("slow-speed"),
    summary: "Layered, high-detail, or complex tracing.",
    useWhen: "Use for color separation or heavier cleanup on moderate images.",
  },
  {
    id: "very-slow",
    label: getPresetIntensityLabel("very-slow"),
    summary: "Heavy layered or color-preserving output.",
    useWhen:
      "Use when visual fidelity is more important than immediate results.",
  },
  {
    id: "insanely-slow",
    label: getPresetIntensityLabel("insanely-slow"),
    summary: "Very heavy per-color or high-palette tracing.",
    useWhen:
      "Use deliberately for demanding layered color work. It may queue and finish later.",
  },
];

export type PresetFamily =
  | "lineart"
  | "photo-edge"
  | "scan"
  | "logo"
  | "diagram"
  | "stroke"
  | "layered";

export type PresetGuideItem = {
  id: string;
  label: string;
  family: PresetFamily;
  speed: PresetBackendIntensity;
  outputStyle: string;
  bestUse: string;
  preserves: string;
  simplifies: string;
  recommendedImages: string;
  adjustments: string;
  routeLinks: Array<{ label: string; path: string }>;
};

const CORE_PRESETS: Array<{
  id: string;
  label: string;
  category?: PresetFamily;
  backendIntensity?: PresetBackendIntensity;
  settings: Record<string, unknown>;
}> = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    category: "layered",
    settings: {
      traceMode: "layered",
      colorLayerCount: 5,
      layerMaxTraceSide: 1600,
      minRegionPercent: 0.35,
      layerOptTolerance: 0.45,
      layerTurdSize: 4,
      posterize: true,
      removeTransparent: true,
      transparent: true,
    },
  },
  {
    id: "layered-color-smoother",
    label: "Layered color SVG - Smoother",
    category: "layered",
    settings: {
      traceMode: "layered",
      colorLayerCount: 4,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.55,
      layerOptTolerance: 0.65,
      layerTurdSize: 7,
      posterize: true,
      removeTransparent: true,
      transparent: true,
    },
  },
  {
    id: "layered-color-detail",
    label: "Layered color SVG - More detail",
    category: "layered",
    settings: {
      traceMode: "layered",
      colorLayerCount: 8,
      layerMaxTraceSide: 2000,
      minRegionPercent: 0.2,
      layerOptTolerance: 0.32,
      layerTurdSize: 2,
      posterize: true,
      removeTransparent: true,
      transparent: true,
    },
  },
  {
    id: "layered-color-fewer",
    label: "Layered color SVG - Fewer larger layers",
    category: "layered",
    settings: {
      traceMode: "layered",
      colorLayerCount: 3,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.8,
      layerOptTolerance: 0.75,
      layerTurdSize: 9,
      posterize: true,
      removeTransparent: true,
      transparent: true,
    },
  },
  {
    id: "line-accurate",
    label: "Lineart - Accurate (default)",
    category: "lineart",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
    },
  },
  {
    id: "line-bold",
    label: "Lineart - Bold",
    category: "lineart",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 212,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
    },
  },
  {
    id: "line-fine",
    label: "Lineart - Fine detail",
    category: "lineart",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 232,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
    },
  },
  {
    id: "line-gap",
    label: "Lineart - Seal gaps",
    category: "lineart",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 218,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "black",
    },
  },
  {
    id: "photo-soft",
    label: "Photo Edge - Soft",
    category: "photo-edge",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 1.2,
      edgeBoost: 0.9,
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.35,
    },
  },
  {
    id: "photo-normal",
    label: "Photo Edge - Normal",
    category: "photo-edge",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.1,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.35,
    },
  },
  {
    id: "photo-bold",
    label: "Photo Edge - Bold",
    category: "photo-edge",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 0.6,
      edgeBoost: 1.4,
      threshold: 230,
      turdSize: 3,
      optTolerance: 0.4,
    },
  },
  {
    id: "edge-clean",
    label: "Edge - Clean",
    category: "photo-edge",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 0.8,
      edgeBoost: 1.2,
      threshold: 236,
      turdSize: 2,
      optTolerance: 0.45,
    },
  },
  {
    id: "scan-clean",
    label: "Scan - Clean (remove speckles)",
    category: "scan",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 226,
      turdSize: 4,
      optTolerance: 0.3,
      turnPolicy: "majority",
    },
  },
  {
    id: "scan-aggressive",
    label: "Scan - Aggressive (close gaps)",
    category: "scan",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 218,
      turdSize: 5,
      optTolerance: 0.42,
      turnPolicy: "black",
    },
  },
  {
    id: "logo-clean",
    label: "Logo - Clean shapes",
    category: "logo",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.25,
      turnPolicy: "majority",
    },
  },
  {
    id: "logo-thin",
    label: "Logo - Thin details",
    category: "logo",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 238,
      turdSize: 1,
      optTolerance: 0.2,
      turnPolicy: "minority",
    },
  },
  {
    id: "noisy-denoise",
    label: "Noisy Photo - Denoise Edge",
    category: "photo-edge",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 1.6,
      edgeBoost: 1.25,
      threshold: 222,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
    },
  },
  {
    id: "low-contrast",
    label: "Low-contrast Photo - Boost edges",
    category: "photo-edge",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 1,
      edgeBoost: 1.6,
      threshold: 228,
      turdSize: 2,
      optTolerance: 0.36,
    },
  },
  {
    id: "invert-white-on-black",
    label: "Invert - White lines on black",
    category: "diagram",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 225,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      transparent: false,
    },
  },
  {
    id: "comics-inks",
    label: "Comics - Inks (chunky)",
    category: "diagram",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 0.7,
      edgeBoost: 1.5,
      threshold: 234,
      turdSize: 3,
      optTolerance: 0.48,
      turnPolicy: "black",
    },
  },
  {
    id: "blueprint",
    label: "Diagram - Blueprint (invert + blue)",
    category: "diagram",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 230,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      transparent: false,
    },
  },
  {
    id: "whiteboard",
    label: "Whiteboard - Anti-glare",
    category: "scan",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 1.3,
      edgeBoost: 1.15,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.34,
      turnPolicy: "majority",
    },
  },
];

export const PRESET_GUIDE_ITEMS: PresetGuideItem[] = [
  ...CORE_PRESETS,
  ...ALL_PRESET_ADDITIONS,
].map((preset) => {
  const settings = preset.settings as Record<string, unknown>;
  const family = (preset.category ?? inferFamily(preset.id, settings)) as PresetFamily;
  const speed =
    preset.backendIntensity ?? inferPresetBackendIntensity(preset.settings);
  const layered = settings.traceMode === "layered";
  return {
    id: preset.id,
    label: normalizePresetLabel(preset.label),
    family,
    speed,
    outputStyle: layered
      ? Number(settings.fillStrokeWidth || 0) > 0
        ? "layered/color fills with an editable stroke outline"
        : "layered/color filled regions"
      : settings.preprocess === "edge"
        ? "filled edge contours"
        : "simple filled paths",
    bestUse: familyBestUse(family, preset.label),
    preserves: familyPreserves(family, settings),
    simplifies: familySimplifies(family, settings),
    recommendedImages: familyImages(family),
    adjustments: settingsToTry(family, settings),
    routeLinks: familyRoutes(family),
  };
});

export const PRESET_FAMILIES: Array<{
  id: PresetFamily;
  label: string;
  summary: string;
  routeLinks: Array<{ label: string; path: string }>;
}> = [
  {
    id: "lineart",
    label: "Lineart, sketch, and drawing",
    summary:
      "Best for clean black-and-white artwork, ink drawings, outlines, sketches, and filled paths that should stay simple.",
    routeLinks: familyRoutes("lineart"),
  },
  {
    id: "photo-edge",
    label: "Photo edge and outline",
    summary:
      "Best for pulling contours from photos or low-contrast images when a stylized outline matters more than color.",
    routeLinks: familyRoutes("photo-edge"),
  },
  {
    id: "scan",
    label: "Scan and black-and-white cleanup",
    summary:
      "Best for scanned art, forms, stamps, handwriting, and images with speckles or small gaps.",
    routeLinks: familyRoutes("scan"),
  },
  {
    id: "logo",
    label: "Logo and icon",
    summary:
      "Best for high-contrast logos, icons, badges, and marks that need clean shapes and modest detail.",
    routeLinks: familyRoutes("logo"),
  },
  {
    id: "stroke",
    label: "Stroke / Centerline",
    summary:
      "Best for simple line drawings, handwriting, sketches, diagrams, and plotter-style output that should contain real SVG strokes.",
    routeLinks: familyRoutes("stroke"),
  },
  {
    id: "diagram",
    label: "Diagram, cutting, sticker, and style",
    summary:
      "Best for diagrams, comic-ink looks, stencil-like output, sticker edges, and practical craft styles.",
    routeLinks: familyRoutes("diagram"),
  },
  {
    id: "layered",
    label: "Layered color",
    summary:
      "Best when you want multiple filled color regions. Newer variants cover transparent logos, app icons, posters, screenshots, mockups, and separate editable stroke outline layers for cartoon or sticker-style artwork.",
    routeLinks: familyRoutes("layered"),
  },
];

export const SETTING_GROUPS = [
  {
    title: "Live preview edits",
    summary:
      "These edit the selected output card locally when SVG data is available. They should not retrace the original image.",
    settings: [
      {
        name: "Output appearance",
        details:
          "Line weight and fill spread update the visible SVG, copy, download, fullscreen preview, and file size. Stroke output mode is different: it retraces the original source as filled shapes or centerline strokes when compatible.",
      },
      {
        name: "Layer colors",
        details:
          "Layer visibility, swatches, color inputs, reset, and opacity are available when the SVG contains editable layer metadata.",
      },
      {
        name: "Size and export",
        details:
          "Adjust output dimensions and export sizing where the route exposes local output geometry controls.",
      },
    ],
  },
  {
    title: "Click to convert",
    summary:
      "These settings retrace or reprocess the source image after you click Convert or Update preview.",
    settings: [
      {
        name: "Line tracing",
        details:
          "Trace mode, threshold, turd size, curve tolerance, turn policy, line color, invert, transparency, and preprocessing controls.",
      },
      {
        name: "Color and layers",
        details:
          "Color layer count, layer trace size, region threshold, layer curve tolerance, posterize, layer mode, palette, sorting, and overlap controls.",
      },
      {
        name: "Edges and cleanup",
        details:
          "Blur, edge boost, edge threshold, edge thickness, noise reduction, gap close strength, small-island cleanup, and hole fill controls.",
      },
      {
        name: "Remove colors",
        details:
          "Selected input color removal and tolerance for raster tracing. Uploaded SVG colors are usually edited through output layer controls instead.",
      },
      {
        name: "Appearance",
        details:
          "Transparent background, background color, alpha controls, fill alpha, layer alpha, output width, output height, and aspect-ratio behavior where supported.",
      },
      {
        name: "Batch conversion",
        details:
          "Batch settings apply to multiple selected files. The output card Batch shortcut opens this section without starting a conversion.",
      },
    ],
  },
  {
    title: "SVG-to-raster export",
    summary:
      "SVG-to-PNG, JPG, WebP, and PDF routes render an existing SVG instead of tracing pixels into paths.",
    settings: [
      {
        name: "Width, height, and aspect lock",
        details:
          "Set the raster export size. Lock aspect ratio keeps the source proportions.",
      },
      {
        name: "Background",
        details:
          "PNG and WebP can preserve transparency. JPG always uses a solid background because JPEG has no alpha channel.",
      },
      {
        name: "Quality and file name",
        details:
          "Some raster routes expose pixel ratio or quality controls and a simple output file-name field.",
      },
    ],
  },
];

export const WORKFLOW_CONTROLS = [
  {
    name: "Upload",
    details:
      "Adds the active source image. Recent output cards can remain visible after the active upload changes.",
  },
  {
    name: "Presets",
    details:
      "Apply a clean baseline plus the selected preset settings. Speed badges estimate processing cost, not quality.",
  },
  {
    name: "Convert",
    details:
      "Starts a conversion job from the current source image and settings. A pending output card appears immediately on queued routes.",
  },
  {
    name: "Cancel and Retry",
    details:
      "Visible queue cards may allow canceling a running job or retrying a failed one without touching unrelated outputs.",
  },
  {
    name: "Settings/Edit",
    details:
      "Opens the focused editor for a completed output. The editor shows the output, original/source preview when available, and relevant settings.",
  },
  {
    name: "Update preview",
    details:
      "Retraces the original source for that selected output only when click-to-convert settings changed.",
  },
  {
    name: "Copy SVG",
    details:
      "Copies the current finalized SVG for that output card, including supported local output edits.",
  },
  {
    name: "Download SVG",
    details:
      "Downloads the current finalized SVG. Use download instead of copy for very large files or apps that reject pasted SVG text.",
  },
  {
    name: "Fullscreen Preview",
    details:
      "Opens a larger preview for inspecting paths, details, transparency, and the current visible SVG.",
  },
  {
    name: "Batch",
    details:
      "Opens batch conversion settings where supported. Batch downloads use a ZIP file.",
  },
  {
    name: "Minimize/Restore",
    details:
      "Collapses a card without deleting its SVG, source context, queue state, or local output settings.",
  },
];

export const TROUBLESHOOTING_ITEMS = [
  {
    problem: "Preview does not appear",
    fix: "Wait for the job state first. If the card failed, retry with a simpler preset or smaller source image. If copy/download still work, the issue may be browser preview decoding rather than SVG generation.",
  },
  {
    problem: "The SVG looks too dark or filled in",
    fix: "Most image-to-SVG output is made from filled paths. Try a lineart, scan, or photo-edge preset with a higher threshold, or reduce fill-heavy layered settings.",
  },
  {
    problem: "Too many specks or tiny islands",
    fix: "Raise turd size, increase min island cleanup, use a scan cleanup preset, or reduce source noise before converting.",
  },
  {
    problem: "Important detail disappeared",
    fix: "Try a finer preset, lower turd size, lower curve tolerance, or increase trace size. Expect slower speed labels when preserving more detail.",
  },
  {
    problem: "Transparent background became a layer",
    fix: "Use transparent-background friendly presets, keep remove transparent enabled when appropriate, and avoid flattening presets when the source should stay transparent.",
  },
  {
    problem: "Layered result is huge or slow",
    fix: "Lower color layer count, use a faster layered preset, reduce image dimensions, or switch to a single-color cut preset if color separation is not needed.",
  },
  {
    problem: "Line weight is disabled",
    fix: "The current SVG likely has filled paths instead of stroke attributes. That is normal for raster tracing. Use a Stroke Trace or Centerline preset when you need real strokes, or use fill spread cautiously when supported.",
  },
  {
    problem: "A slow preset is still running",
    fix: "Queued jobs can keep running while you start another preset. Leave the card in place, cancel it if available, or use a faster preset for a quick comparison.",
  },
];

function inferFamily(id: string, settings: Record<string, unknown>): PresetFamily {
  if (settings.traceMode === "layered" || id.includes("layered")) return "layered";
  if (id.startsWith("line-") || id.startsWith("sketch-") || id.startsWith("drawing-")) {
    return "lineart";
  }
  if (id.startsWith("photo-") || id.includes("edge")) return "photo-edge";
  if (id.startsWith("scan-") || id.startsWith("whiteboard-")) return "scan";
  if (id.startsWith("logo-") || id.startsWith("icon-")) return "logo";
  return "diagram";
}

function normalizePresetLabel(label: string) {
  return label.replace(/\s+-\s+/g, " - ").replace(/\s{2,}/g, " ").trim();
}

function familyBestUse(family: PresetFamily, label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("sticker")) return "sticker art, decals, and print-then-cut style output";
  if (normalized.includes("mascot") || normalized.includes("cute character")) {
    return "cartoon characters, mascot art, and illustrations that need color plus editable ink";
  }
  if (normalized.includes("app icon") || normalized.includes("web icon")) {
    return "small icons, app artwork, and transparent interface marks";
  }
  if (normalized.includes("dashboard") || normalized.includes("ui screenshot")) {
    return "dashboards, app screenshots, and flat interface artwork";
  }
  if (normalized.includes("product mockup")) return "product mockups and flat commercial artwork";
  if (normalized.includes("poster")) return "posterized color artwork and simplified photo-like graphics";
  if (normalized.includes("transparent logo")) {
    return "transparent logos and marks where background cleanup matters";
  }
  if (normalized.includes("ui mockup")) return "screenshots, app mockups, and colorful interface artwork";
  if (normalized.includes("photo many colors")) return "photo-like color preservation when a large SVG is acceptable";
  switch (family) {
    case "lineart":
      return "clean drawings, inks, sketches, outlines, and high-contrast art";
    case "photo-edge":
      return "photo contours, edge-style art, outlines, and low-contrast images";
    case "scan":
      return "scanned art, handwriting, stamps, documents, and speckle cleanup";
    case "logo":
      return "logos, icons, simple marks, badges, and transparent artwork";
    case "stroke":
      return "simple line drawings, sketches, handwriting, diagrams, and plotter-style stroked SVGs";
    case "diagram":
      return "diagrams, craft cuts, stencils, comic ink, and practical style output";
    case "layered":
      return "multicolor artwork that should become separate filled regions";
  }
}

function familyPreserves(family: PresetFamily, settings: Record<string, unknown>) {
  if (settings.traceMode === "layered") {
    return "visible color regions, transparency when enabled, and layer editing metadata where generated";
  }
  if (family === "photo-edge") return "major contrast edges and contour structure";
  if (family === "scan") return "clear dark marks while removing light noise";
  if (family === "logo") return "large clean shapes and usable logo silhouettes";
  if (family === "stroke") return "the center paths of visible lines as real SVG strokes";
  return "main shapes, outlines, and high-contrast filled paths";
}

function familySimplifies(family: PresetFamily, settings: Record<string, unknown>) {
  if (settings.traceMode === "layered") {
    return "tiny regions, merged colors, and some texture depending on layer count and cleanup";
  }
  if (family === "photo-edge") return "photo color, subtle texture, and low-contrast soft regions";
  if (family === "scan") return "dust, speckles, glare, and faint paper texture";
  if (family === "stroke") return "line thickness, filled regions, color, gradients, and texture";
  return "pixels, gradients, anti-aliasing, and detail below the cleanup threshold";
}

function familyImages(family: PresetFamily) {
  switch (family) {
    case "lineart":
      return "ink drawings, transparent PNG line art, black-and-white scans, and sketches";
    case "photo-edge":
      return "photos or shaded drawings where edges matter more than color";
    case "scan":
      return "scans, stamps, handwriting, documents, and high-contrast paper artwork";
    case "logo":
      return "logos, icons, badges, marks, and transparent artwork";
    case "stroke":
      return "simple black-and-white line art, sketches, handwriting, diagrams, and technical drawings";
    case "diagram":
      return "diagrams, stickers, decals, stencils, comics, and cut-file art";
    case "layered":
      return "colorful logos, app mockups, illustrations, sticker art, and simplified photos";
  }
}

function settingsToTry(family: PresetFamily, settings: Record<string, unknown>) {
  if (settings.traceMode === "layered") {
    return Number(settings.fillStrokeWidth || 0) > 0
      ? "color layer count, requested palette count, fill/stroke layer colors, line weight, min region percent, layer max trace side, and remove transparent"
      : "color layer count, requested palette count, min region percent, min island px, hole fill px, layer max trace side, and remove transparent";
  }
  if (family === "photo-edge") {
    return "blur, edge boost, edge threshold, edge thickness, threshold, turd size, and curve tolerance";
  }
  if (family === "scan") {
    return "threshold, turd size, gap close strength, min island px, hole fill px, and invert";
  }
  if (family === "stroke") {
    return "stroke output mode, centerline stroke width, centerline simplification, threshold, line weight, and transparent background";
  }
  return "threshold, turd size, curve tolerance, turn policy, transparent background, and output size";
}

function familyRoutes(family: PresetFamily) {
  switch (family) {
    case "lineart":
      return [
        { label: "Line Art to SVG", path: "/line-art-to-svg-converter" },
        { label: "Sketch to SVG", path: "/sketch-to-svg-converter" },
        { label: "Drawing to SVG", path: "/drawing-to-svg-converter" },
      ];
    case "photo-edge":
      return [
        { label: "Photo to SVG Outline", path: "/photo-to-svg-outline" },
        { label: "Image to SVG Outline", path: "/image-to-svg-outline" },
        { label: "JPG to SVG", path: "/jpg-to-svg-converter" },
      ];
    case "scan":
      return [
        { label: "Scan to SVG", path: "/scan-to-svg-converter" },
        { label: "Black and White to SVG", path: "/black-and-white-image-to-svg-converter" },
        { label: "PNG to SVG", path: "/png-to-svg-converter" },
      ];
    case "logo":
      return [
        { label: "Logo to SVG", path: "/logo-to-svg-converter" },
        { label: "Icon to SVG", path: "/icon-to-svg-converter" },
        { label: "Logo to SVG for Cricut", path: "/logo-to-svg-for-cricut" },
      ];
    case "stroke":
      return [
        { label: "Line Art to SVG", path: "/line-art-to-svg-converter" },
        { label: "Sketch to SVG", path: "/sketch-to-svg-converter" },
        { label: "PNG to SVG", path: "/png-to-svg-converter" },
      ];
    case "diagram":
      return [
        { label: "PNG to SVG for Cricut", path: "/png-to-svg-for-cricut" },
        { label: "PNG to SVG for Stickers", path: "/png-to-svg-for-cricut-stickers" },
        { label: "PNG to SVG for Laser Cutting", path: "/png-to-svg-for-laser-cutting" },
      ];
    case "layered":
      return [
        { label: "PNG to Layered SVG", path: "/png-to-layered-svg-for-cricut" },
        { label: "Image to Layered SVG", path: "/image-to-layered-svg-for-cricut" },
        { label: "Logo to Layered SVG", path: "/logo-to-layered-svg-for-cricut" },
      ];
  }
}
