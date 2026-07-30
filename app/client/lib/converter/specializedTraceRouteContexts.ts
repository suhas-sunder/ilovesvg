export const SPECIALIZED_TRACE_ROUTE_PATHS = [
  "/image-to-svg-outline",
  "/photo-to-svg-outline",
  "/line-art-to-svg-converter",
  "/line-art-to-svg-for-cricut",
  "/drawing-to-svg-converter",
  "/drawing-to-svg-for-cricut",
  "/sketch-to-svg-converter",
  "/sketch-to-svg-for-cricut",
  "/black-and-white-image-to-svg-converter",
  "/black-and-white-image-to-svg-for-cricut",
  "/logo-to-svg-converter",
  "/logo-to-svg-for-cricut",
  "/logo-to-svg-for-shopify",
  "/logo-to-svg-for-etsy",
  "/logo-to-svg-for-glowforge",
  "/logo-to-svg-for-silhouette",
  "/logo-to-svg-for-canva",
  "/sticker-to-svg-converter",
  "/sticker-to-svg-for-cricut",
  "/sticker-to-svg-for-etsy",
  "/sticker-to-svg-for-silhouette",
] as const;

export type SpecializedTraceRoutePath =
  (typeof SPECIALIZED_TRACE_ROUTE_PATHS)[number];

export type SpecializedTraceRouteKey =
  | "outline-image"
  | "outline-photo"
  | "line-art-base"
  | "line-art-cricut"
  | "drawing-base"
  | "drawing-cricut"
  | "sketch-base"
  | "sketch-cricut"
  | "black-white-base"
  | "black-white-cricut"
  | "logo-base"
  | "logo-cricut"
  | "logo-shopify"
  | "logo-etsy"
  | "logo-glowforge"
  | "logo-silhouette"
  | "logo-canva"
  | "sticker-base"
  | "sticker-cricut"
  | "sticker-etsy"
  | "sticker-silhouette";

export type SpecializedTraceSubfamily =
  | "outline-and-line-art"
  | "sketch-and-drawing"
  | "black-white-and-logo"
  | "sticker";

export type SpecializedTraceImplementationOwner =
  | "app/routes/image-to-svg-outline.tsx"
  | "app/routes/photo-to-svg-outline.tsx"
  | "app/routes/line-art-to-svg-converter.tsx"
  | "app/routes/line-art-to-svg-for-cricut.tsx"
  | "app/routes/drawing-to-svg-converter.tsx"
  | "app/routes/drawing-to-svg-for-cricut.tsx"
  | "app/routes/sketch-to-svg-converter.tsx"
  | "app/routes/sketch-to-svg-for-cricut.tsx"
  | "app/routes/black-and-white-image-to-svg-converter.tsx"
  | "app/routes/black-and-white-image-to-svg-for-cricut.tsx"
  | "app/routes/logo-to-svg-converter.tsx"
  | "app/routes/logo-to-svg-for-cricut.tsx"
  | "app/routes/sticker-to-svg-converter.tsx"
  | "app/routes/sticker-to-svg-for-cricut.tsx";

export type SpecializedTraceRouteSource =
  | SpecializedTraceImplementationOwner
  | "app/routes/logo-to-svg-for-shopify.tsx"
  | "app/routes/logo-to-svg-for-etsy.tsx"
  | "app/routes/logo-to-svg-for-glowforge.tsx"
  | "app/routes/logo-to-svg-for-silhouette.tsx"
  | "app/routes/logo-to-svg-for-canva.tsx"
  | "app/routes/sticker-to-svg-for-etsy.tsx"
  | "app/routes/sticker-to-svg-for-silhouette.tsx";

export type SpecializedTraceInputPolicy =
  | "png-and-jpeg"
  | "png-jpeg-and-svg"
  | "png-jpeg-and-webp"
  | "broad-raster-and-svg";

export type SpecializedTraceGuidanceCategory =
  | "image-outline"
  | "photo-outline"
  | "line-art"
  | "drawing"
  | "sketch"
  | "black-and-white"
  | "logo"
  | "sticker"
  | "cricut"
  | "marketplace"
  | "design-platform"
  | "laser"
  | "silhouette";

export type SpecializedTraceRetentionReason =
  | "distinct-trace-configuration"
  | "distinct-preset-inventory"
  | "distinct-accepted-input-policy"
  | "distinct-output-contract"
  | "distinct-filename-policy"
  | "distinct-public-guidance"
  | "distinct-platform-workflow"
  | "distinct-metadata-identity"
  | "distinct-schema-and-breadcrumb-identity"
  | "context-would-not-survive-direct-redirect";

export type SpecializedTraceContentContract = Readonly<{
  currentContentOwner: SpecializedTraceImplementationOwner;
  routeSpecificGuidanceOwners: readonly [
    SpecializedTraceImplementationOwner,
    "app/client/components/navigation/OtherToolsLinks.tsx",
  ];
  metadataOwner: SpecializedTraceRouteSource;
  schemaOwner: SpecializedTraceImplementationOwner;
  breadcrumbOwner: "app/client/components/navigation/OtherToolsLinks.tsx";
  presetOwner: SpecializedTraceImplementationOwner;
  acceptedInputOwner: SpecializedTraceImplementationOwner;
  filenameOwner: SpecializedTraceImplementationOwner;
  guidanceCategory: SpecializedTraceGuidanceCategory;
  routeSpecificCopyRemainsAtSource: true;
  consolidation: Readonly<{
    decision: "retain-independently";
    reasons: readonly SpecializedTraceRetentionReason[];
    reconsiderationPolicy: "requires-new-evidence";
  }>;
}>;

export type SpecializedTraceRouteContext = Readonly<{
  key: SpecializedTraceRouteKey;
  path: SpecializedTraceRoutePath;
  routeSource: SpecializedTraceRouteSource;
  implementationOwner: SpecializedTraceImplementationOwner;
  subfamily: SpecializedTraceSubfamily;
  canonicalPath: SpecializedTraceRoutePath;
  inputPolicy: SpecializedTraceInputPolicy;
  defaultPresetId: string;
  outputFilename: `${string}.svg`;
  title: string;
  h1: string;
  contentContract: SpecializedTraceContentContract;
}>;

type ContextDefinition = Readonly<{
  key: SpecializedTraceRouteKey;
  path: SpecializedTraceRoutePath;
  routeSource: SpecializedTraceRouteSource;
  implementationOwner: SpecializedTraceImplementationOwner;
  subfamily: SpecializedTraceSubfamily;
  inputPolicy: SpecializedTraceInputPolicy;
  defaultPresetId: string;
  outputFilename: `${string}.svg`;
  title: string;
  h1: string;
  guidanceCategory: SpecializedTraceGuidanceCategory;
  reasons: readonly SpecializedTraceRetentionReason[];
}>;

const DISTINCT_SPECIALIZED_ROUTE_REASONS = [
  "distinct-trace-configuration",
  "distinct-preset-inventory",
  "distinct-public-guidance",
  "distinct-metadata-identity",
  "distinct-schema-and-breadcrumb-identity",
  "context-would-not-survive-direct-redirect",
] as const satisfies readonly SpecializedTraceRetentionReason[];

const DISTINCT_PLATFORM_ROUTE_REASONS = [
  "distinct-public-guidance",
  "distinct-platform-workflow",
  "distinct-metadata-identity",
  "distinct-schema-and-breadcrumb-identity",
  "context-would-not-survive-direct-redirect",
] as const satisfies readonly SpecializedTraceRetentionReason[];

function defineContext(
  definition: ContextDefinition,
): SpecializedTraceRouteContext {
  return Object.freeze({
    key: definition.key,
    path: definition.path,
    routeSource: definition.routeSource,
    implementationOwner: definition.implementationOwner,
    subfamily: definition.subfamily,
    canonicalPath: definition.path,
    inputPolicy: definition.inputPolicy,
    defaultPresetId: definition.defaultPresetId,
    outputFilename: definition.outputFilename,
    title: definition.title,
    h1: definition.h1,
    contentContract: Object.freeze({
      currentContentOwner: definition.implementationOwner,
      routeSpecificGuidanceOwners: Object.freeze([
        definition.implementationOwner,
        "app/client/components/navigation/OtherToolsLinks.tsx",
      ] as const),
      metadataOwner: definition.routeSource,
      schemaOwner: definition.implementationOwner,
      breadcrumbOwner:
        "app/client/components/navigation/OtherToolsLinks.tsx" as const,
      presetOwner: definition.implementationOwner,
      acceptedInputOwner: definition.implementationOwner,
      filenameOwner: definition.implementationOwner,
      guidanceCategory: definition.guidanceCategory,
      routeSpecificCopyRemainsAtSource: true as const,
      consolidation: Object.freeze({
        decision: "retain-independently" as const,
        reasons: Object.freeze([...definition.reasons]),
        reconsiderationPolicy: "requires-new-evidence" as const,
      }),
    }),
  });
}

const definitions = [
  {
    key: "outline-image",
    path: "/image-to-svg-outline",
    routeSource: "app/routes/image-to-svg-outline.tsx",
    implementationOwner: "app/routes/image-to-svg-outline.tsx",
    subfamily: "outline-and-line-art",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "outline-clean",
    outputFilename: "image-to-svg-outline.svg",
    title:
      "Image to SVG Outline Converter - Photo and Line Art Outlines | iLoveSVG",
    h1: "Image to SVG Outline",
    guidanceCategory: "image-outline",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "outline-photo",
    path: "/photo-to-svg-outline",
    routeSource: "app/routes/photo-to-svg-outline.tsx",
    implementationOwner: "app/routes/photo-to-svg-outline.tsx",
    subfamily: "outline-and-line-art",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "photo-outline-clean",
    outputFilename: "photo-to-svg-outline.svg",
    title: "Photo to SVG Outline Converter - Create Contour SVGs | iLoveSVG",
    h1: "Photo to SVG Outline",
    guidanceCategory: "photo-outline",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "line-art-base",
    path: "/line-art-to-svg-converter",
    routeSource: "app/routes/line-art-to-svg-converter.tsx",
    implementationOwner: "app/routes/line-art-to-svg-converter.tsx",
    subfamily: "outline-and-line-art",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "line-accurate",
    outputFilename: "line-art-to-svg-converter.svg",
    title: "Line Art to SVG Converter - Ink Drawings and Scans | iLoveSVG",
    h1: "Line Art to SVG Converter",
    guidanceCategory: "line-art",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "line-art-cricut",
    path: "/line-art-to-svg-for-cricut",
    routeSource: "app/routes/line-art-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/line-art-to-svg-for-cricut.tsx",
    subfamily: "outline-and-line-art",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "line-art-clean-cut",
    outputFilename: "line-art-to-svg-for-cricut.svg",
    title:
      "Line Art to SVG for Cricut - Free Line Art SVG Converter | iLoveSVG",
    h1: "Line Art to SVG for Cricut",
    guidanceCategory: "cricut",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "drawing-base",
    path: "/drawing-to-svg-converter",
    routeSource: "app/routes/drawing-to-svg-converter.tsx",
    implementationOwner: "app/routes/drawing-to-svg-converter.tsx",
    subfamily: "sketch-and-drawing",
    inputPolicy: "broad-raster-and-svg",
    defaultPresetId: "drawing-accurate",
    outputFilename: "drawing-to-svg-converter.svg",
    title: "Drawing to SVG Converter - Hand Drawn Art to SVG | iLoveSVG",
    h1: "Drawing to SVG Converter",
    guidanceCategory: "drawing",
    reasons: [
      ...DISTINCT_SPECIALIZED_ROUTE_REASONS,
      "distinct-accepted-input-policy",
    ],
  },
  {
    key: "drawing-cricut",
    path: "/drawing-to-svg-for-cricut",
    routeSource: "app/routes/drawing-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/drawing-to-svg-for-cricut.tsx",
    subfamily: "sketch-and-drawing",
    inputPolicy: "png-jpeg-and-svg",
    defaultPresetId: "drawing-clean",
    outputFilename: "drawing-to-svg-for-cricut.svg",
    title:
      "Drawing to SVG for Cricut - Free Hand Drawing to SVG Converter",
    h1: "Drawing to SVG for Cricut",
    guidanceCategory: "cricut",
    reasons: [
      ...DISTINCT_SPECIALIZED_ROUTE_REASONS,
      "distinct-accepted-input-policy",
    ],
  },
  {
    key: "sketch-base",
    path: "/sketch-to-svg-converter",
    routeSource: "app/routes/sketch-to-svg-converter.tsx",
    implementationOwner: "app/routes/sketch-to-svg-converter.tsx",
    subfamily: "sketch-and-drawing",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "sketch-pencil-light",
    outputFilename: "sketch-to-svg-converter.svg",
    title: "Sketch to SVG Converter - Pencil and Ink Sketches | iLoveSVG",
    h1: "Sketch to SVG Converter",
    guidanceCategory: "sketch",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "sketch-cricut",
    path: "/sketch-to-svg-for-cricut",
    routeSource: "app/routes/sketch-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/sketch-to-svg-for-cricut.tsx",
    subfamily: "sketch-and-drawing",
    inputPolicy: "png-jpeg-and-webp",
    defaultPresetId: "sketch-balanced",
    outputFilename: "sketch-to-svg-for-cricut.svg",
    title: "Sketch to SVG for Cricut - Free Layered Sketch SVG Converter",
    h1: "Sketch to SVG for Cricut",
    guidanceCategory: "cricut",
    reasons: [
      ...DISTINCT_SPECIALIZED_ROUTE_REASONS,
      "distinct-accepted-input-policy",
      "distinct-output-contract",
    ],
  },
  {
    key: "black-white-base",
    path: "/black-and-white-image-to-svg-converter",
    routeSource: "app/routes/black-and-white-image-to-svg-converter.tsx",
    implementationOwner:
      "app/routes/black-and-white-image-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-jpeg-and-svg",
    defaultPresetId: "bw-clean",
    outputFilename: "converted.svg",
    title: "Black and White Image to SVG Converter | iLoveSVG",
    h1: "Black & White to SVG",
    guidanceCategory: "black-and-white",
    reasons: [
      ...DISTINCT_SPECIALIZED_ROUTE_REASONS,
      "distinct-filename-policy",
    ],
  },
  {
    key: "black-white-cricut",
    path: "/black-and-white-image-to-svg-for-cricut",
    routeSource: "app/routes/black-and-white-image-to-svg-for-cricut.tsx",
    implementationOwner:
      "app/routes/black-and-white-image-to-svg-for-cricut.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-jpeg-and-svg",
    defaultPresetId: "bw-clean-cut",
    outputFilename: "black-and-white-image-to-svg-for-cricut.svg",
    title:
      "Black and White Image to SVG for Cricut - Free Converter | iLoveSVG",
    h1: "Black and White Image to SVG for Cricut",
    guidanceCategory: "cricut",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "logo-base",
    path: "/logo-to-svg-converter",
    routeSource: "app/routes/logo-to-svg-converter.tsx",
    implementationOwner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
    title: "Logo to SVG Converter - Vectorize Logos Online | iLoveSVG",
    h1: "Logo to SVG Converter",
    guidanceCategory: "logo",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "logo-cricut",
    path: "/logo-to-svg-for-cricut",
    routeSource: "app/routes/logo-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/logo-to-svg-for-cricut.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean-cut",
    outputFilename: "logo-to-svg-for-cricut.svg",
    title:
      "Logo to SVG for Cricut - Free Cricut Logo Converter | iLoveSVG",
    h1: "Logo to SVG for Cricut",
    guidanceCategory: "cricut",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "logo-shopify",
    path: "/logo-to-svg-for-shopify",
    routeSource: "app/routes/logo-to-svg-for-shopify.tsx",
    implementationOwner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
    title: "Logo to SVG for Shopify | iLoveSVG",
    h1: "Logo to SVG for Shopify",
    guidanceCategory: "marketplace",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
  {
    key: "logo-etsy",
    path: "/logo-to-svg-for-etsy",
    routeSource: "app/routes/logo-to-svg-for-etsy.tsx",
    implementationOwner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
    title: "Logo to SVG for Etsy | iLoveSVG",
    h1: "Logo to SVG for Etsy",
    guidanceCategory: "marketplace",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
  {
    key: "logo-glowforge",
    path: "/logo-to-svg-for-glowforge",
    routeSource: "app/routes/logo-to-svg-for-glowforge.tsx",
    implementationOwner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
    title: "Logo to SVG for Glowforge | iLoveSVG",
    h1: "Logo to SVG for Glowforge",
    guidanceCategory: "laser",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
  {
    key: "logo-silhouette",
    path: "/logo-to-svg-for-silhouette",
    routeSource: "app/routes/logo-to-svg-for-silhouette.tsx",
    implementationOwner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
    title: "Logo to SVG for Silhouette | iLoveSVG",
    h1: "Logo to SVG for Silhouette",
    guidanceCategory: "silhouette",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
  {
    key: "logo-canva",
    path: "/logo-to-svg-for-canva",
    routeSource: "app/routes/logo-to-svg-for-canva.tsx",
    implementationOwner: "app/routes/logo-to-svg-converter.tsx",
    subfamily: "black-white-and-logo",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "logo-clean",
    outputFilename: "logo-to-svg-converter.svg",
    title: "Logo to SVG for Canva | iLoveSVG",
    h1: "Logo to SVG for Canva",
    guidanceCategory: "design-platform",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
  {
    key: "sticker-base",
    path: "/sticker-to-svg-converter",
    routeSource: "app/routes/sticker-to-svg-converter.tsx",
    implementationOwner: "app/routes/sticker-to-svg-converter.tsx",
    subfamily: "sticker",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "line-accurate",
    outputFilename: "sticker-to-svg-converter.svg",
    title: "Sticker to SVG Converter - Clean Sticker Vectors | iLoveSVG",
    h1: "Sticker to SVG Converter",
    guidanceCategory: "sticker",
    reasons: DISTINCT_SPECIALIZED_ROUTE_REASONS,
  },
  {
    key: "sticker-cricut",
    path: "/sticker-to-svg-for-cricut",
    routeSource: "app/routes/sticker-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/sticker-to-svg-for-cricut.tsx",
    subfamily: "sticker",
    inputPolicy: "png-jpeg-and-webp",
    defaultPresetId: "sticker-clean",
    outputFilename: "sticker-to-svg-for-cricut.svg",
    title:
      "Sticker to SVG for Cricut - Free Sticker Image to SVG Converter",
    h1: "Sticker to SVG for Cricut",
    guidanceCategory: "cricut",
    reasons: [
      ...DISTINCT_SPECIALIZED_ROUTE_REASONS,
      "distinct-accepted-input-policy",
    ],
  },
  {
    key: "sticker-etsy",
    path: "/sticker-to-svg-for-etsy",
    routeSource: "app/routes/sticker-to-svg-for-etsy.tsx",
    implementationOwner: "app/routes/sticker-to-svg-converter.tsx",
    subfamily: "sticker",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "line-accurate",
    outputFilename: "sticker-to-svg-converter.svg",
    title: "Sticker to SVG for Etsy | iLoveSVG",
    h1: "Sticker to SVG for Etsy",
    guidanceCategory: "marketplace",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
  {
    key: "sticker-silhouette",
    path: "/sticker-to-svg-for-silhouette",
    routeSource: "app/routes/sticker-to-svg-for-silhouette.tsx",
    implementationOwner: "app/routes/sticker-to-svg-converter.tsx",
    subfamily: "sticker",
    inputPolicy: "png-and-jpeg",
    defaultPresetId: "line-accurate",
    outputFilename: "sticker-to-svg-converter.svg",
    title: "Sticker to SVG for Silhouette | iLoveSVG",
    h1: "Sticker to SVG for Silhouette",
    guidanceCategory: "silhouette",
    reasons: DISTINCT_PLATFORM_ROUTE_REASONS,
  },
] as const satisfies readonly ContextDefinition[];

export type SpecializedTraceRouteKeyForOwner<
  Owner extends SpecializedTraceImplementationOwner,
> = Extract<
  (typeof definitions)[number],
  { implementationOwner: Owner }
>["key"];

export const SPECIALIZED_TRACE_ROUTE_CONTEXTS = Object.freeze(
  Object.fromEntries(
    definitions.map((definition) => [
      definition.path,
      defineContext(definition),
    ]),
  ),
) as Readonly<
  Record<SpecializedTraceRoutePath, SpecializedTraceRouteContext>
>;

export function getSpecializedTraceRouteContext(
  path: SpecializedTraceRoutePath,
): SpecializedTraceRouteContext {
  if (
    Object.prototype.hasOwnProperty.call(
      SPECIALIZED_TRACE_ROUTE_CONTEXTS,
      path,
    )
  ) {
    return SPECIALIZED_TRACE_ROUTE_CONTEXTS[path];
  }
  throw new Error(`Unknown specialized trace route path: ${path}`);
}

export function getSpecializedTraceRouteContextByKey(
  key: SpecializedTraceRouteKey,
): SpecializedTraceRouteContext {
  const context = Object.values(SPECIALIZED_TRACE_ROUTE_CONTEXTS).find(
    (candidate) => candidate.key === key,
  );
  if (context) return context;
  throw new Error(`Unknown specialized trace route key: ${key}`);
}
