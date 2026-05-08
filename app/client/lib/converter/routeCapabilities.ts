export type ConverterRouteGroup =
  | "raster-to-svg"
  | "cricut"
  | "layered"
  | "svg-export"
  | "svg-utility"
  | "text-svg"
  | "base64"
  | "static";

export type AdvancedSettingGroup =
  | "trace-detail"
  | "color-layers"
  | "edges-cleanup"
  | "appearance"
  | "output-geometry"
  | "svg-raster-export"
  | "svg-utility";

export type ConverterRouteCapabilities = {
  routeId: string;
  routePath: string;
  group: ConverterRouteGroup;
  supportsBackendTrace: boolean;
  supportsClientOnlyEdit: boolean;
  supportsSingleTrace: boolean;
  supportsLayeredTrace: boolean;
  supportsStrokeTrace: boolean;
  supportsEdgePreprocess: boolean;
  supportsMaskCleanup: boolean;
  supportsSelectedColorRemoval: boolean;
  supportsAlpha: boolean;
  supportsBackground: boolean;
  supportsOutputGeometry: boolean;
  supportsSvgUtilitySettings: boolean;
  supportsRasterExportSettings: boolean;
  supportsPdfExportSettings: boolean;
  supportsLayerEditing: boolean;
  supportsCutFriendlyOutput: boolean;
  supportsVisualEffects: boolean;
  supportedSettingGroups: AdvancedSettingGroup[];
};

const RASTER_TRACE_GROUPS: AdvancedSettingGroup[] = [
  "trace-detail",
  "color-layers",
  "edges-cleanup",
  "appearance",
  "output-geometry",
];

const CUT_TRACE_GROUPS: AdvancedSettingGroup[] = [
  "trace-detail",
  "color-layers",
  "edges-cleanup",
  "appearance",
  "output-geometry",
];

const LAYERED_GROUPS: AdvancedSettingGroup[] = [
  "color-layers",
  "edges-cleanup",
  "appearance",
  "output-geometry",
];

const SVG_EXPORT_GROUPS: AdvancedSettingGroup[] = [
  "svg-raster-export",
  "appearance",
  "output-geometry",
];

const SVG_UTILITY_GROUPS: AdvancedSettingGroup[] = ["svg-utility"];

const ROUTE_GROUPS: Record<string, ConverterRouteGroup> = {
  home: "raster-to-svg",
  "png-to-svg-converter": "raster-to-svg",
  "jpg-to-svg-converter": "raster-to-svg",
  "jpeg-to-svg-converter": "raster-to-svg",
  "webp-to-svg-converter": "raster-to-svg",
  "logo-to-svg-converter": "raster-to-svg",
  "icon-to-svg-converter": "raster-to-svg",
  "sticker-to-svg-converter": "raster-to-svg",
  "line-art-to-svg-converter": "raster-to-svg",
  "drawing-to-svg-converter": "raster-to-svg",
  "scan-to-svg-converter": "raster-to-svg",
  "sketch-to-svg-converter": "raster-to-svg",
  "image-to-svg-outline": "raster-to-svg",
  "photo-to-svg-outline": "raster-to-svg",
  "black-and-white-image-to-svg-converter": "raster-to-svg",

  "png-to-svg-for-cricut": "cricut",
  "jpeg-to-svg-for-cricut": "cricut",
  "jpg-to-svg-for-cricut": "cricut",
  "webp-to-svg-for-cricut": "cricut",
  "image-to-svg-for-cricut": "cricut",
  "photo-to-svg-for-cricut": "cricut",
  "logo-to-svg-for-cricut": "cricut",
  "line-art-to-svg-for-cricut": "cricut",
  "drawing-to-svg-for-cricut": "cricut",
  "sketch-to-svg-for-cricut": "cricut",
  "sticker-to-svg-for-cricut": "cricut",
  "black-and-white-image-to-svg-for-cricut": "cricut",
  "cricut-svg-converter": "cricut",
  "png-to-svg-for-cricut-vinyl": "cricut",
  "png-to-svg-for-cricut-stickers": "cricut",
  "png-to-svg-for-cricut-print-then-cut": "cricut",
  "png-to-svg-for-laser-cutting": "cricut",
  "png-to-svg-for-etsy": "cricut",
  "png-to-svg-for-silhouette": "cricut",

  "png-to-layered-svg-for-cricut": "layered",
  "layered-svg-for-cricut": "layered",
  "image-to-layered-svg-for-cricut": "layered",
  "jpg-to-layered-svg-for-cricut": "layered",
  "logo-to-layered-svg-for-cricut": "layered",

  "svg-to-png-converter": "svg-export",
  "svg-to-jpg-converter": "svg-export",
  "svg-to-webp-converter": "svg-export",
  "svg-to-pdf-converter": "svg-export",

  "svg-background-editor": "svg-utility",
  "svg-resize-and-scale-editor": "svg-utility",
  "svg-recolor": "svg-utility",
  "svg-minifier": "svg-utility",
  "svg-cleaner": "svg-utility",
  "svg-preview-viewer": "svg-utility",
  "svg-to-favicon-generator": "svg-utility",
  "svg-stroke-width-editor": "svg-utility",
  "svg-flip-and-rotate-editor": "svg-utility",
  "svg-dimensions-inspector": "svg-utility",
  "svg-file-size-inspector": "svg-utility",
  "svg-embed-code-generator": "svg-utility",
  "svg-accessibility-and-contrast-checker": "svg-utility",

  "text-to-svg-converter": "text-svg",
  "emoji-to-svg-converter": "text-svg",
  "code-to-svg-for-cricut": "text-svg",
  "svg-to-base64": "base64",
  "base64-to-svg": "base64",
  "base64-to-svg-for-cricut": "base64",
  "inline-svg-vs-img": "static",
  "free-color-picker": "static",
  "how-it-works": "static",
  "how-it-works.conversion-workflow": "static",
  "how-it-works.exporting-and-downloads": "static",
  "how-it-works.presets": "static",
  "how-it-works.settings": "static",
  "how-it-works.troubleshooting": "static",
  "how-it-works/conversion-workflow": "static",
  "how-it-works/presets": "static",
  "how-it-works/settings": "static",
  "how-it-works/troubleshooting": "static",
  "how-it-works/exporting-and-downloads": "static",
  "pro-waitlist": "static",
  cookies: "static",
  "privacy-policy": "static",
  "terms-of-service": "static",
  sitemap: "static",
};

const STROKE_TRACE_ROUTE_IDS = new Set([
  "home",
  "png-to-svg-converter",
  "jpg-to-svg-converter",
  "jpeg-to-svg-converter",
  "webp-to-svg-converter",
  "logo-to-svg-converter",
  "icon-to-svg-converter",
  "line-art-to-svg-converter",
  "drawing-to-svg-converter",
  "scan-to-svg-converter",
  "sketch-to-svg-converter",
  "black-and-white-image-to-svg-converter",
]);

export function getRouteCapabilities(routeId: string): ConverterRouteCapabilities {
  const group = ROUTE_GROUPS[routeId] ?? "static";
  const routePath = routeId === "home" ? "/" : `/${routeId}`;
  const isRasterTrace = group === "raster-to-svg";
  const isCut = group === "cricut";
  const isLayered = group === "layered";
  const isSvgExport = group === "svg-export";
  const isSvgUtility = group === "svg-utility";
  const supportsStrokeTrace = STROKE_TRACE_ROUTE_IDS.has(routeId);

  return {
    routeId,
    routePath,
    group,
    supportsBackendTrace: isRasterTrace || isCut || isLayered,
    supportsClientOnlyEdit: isSvgExport || isSvgUtility || group === "text-svg" || group === "base64",
    supportsSingleTrace: isRasterTrace || isCut,
    supportsLayeredTrace: isRasterTrace || isCut || isLayered,
    supportsStrokeTrace,
    supportsEdgePreprocess: isRasterTrace || isCut,
    supportsMaskCleanup: isRasterTrace || isCut,
    supportsSelectedColorRemoval: isRasterTrace || isCut || isLayered,
    supportsAlpha: isRasterTrace || isSvgExport || isSvgUtility,
    supportsBackground: isRasterTrace || isCut || isLayered || isSvgExport || isSvgUtility,
    supportsOutputGeometry: isRasterTrace || isCut || isLayered || isSvgExport || isSvgUtility,
    supportsSvgUtilitySettings: isSvgUtility,
    supportsRasterExportSettings: isSvgExport,
    supportsPdfExportSettings: routeId === "svg-to-pdf-converter",
    supportsLayerEditing: isRasterTrace || isCut || isLayered || isSvgUtility,
    supportsCutFriendlyOutput: isCut || isLayered,
    supportsVisualEffects: isRasterTrace || isLayered || isSvgExport || isSvgUtility,
    supportedSettingGroups: isLayered
      ? LAYERED_GROUPS
      : isCut
        ? CUT_TRACE_GROUPS
        : isRasterTrace
          ? RASTER_TRACE_GROUPS
          : isSvgExport
            ? SVG_EXPORT_GROUPS
            : isSvgUtility
              ? SVG_UTILITY_GROUPS
              : [],
  };
}
