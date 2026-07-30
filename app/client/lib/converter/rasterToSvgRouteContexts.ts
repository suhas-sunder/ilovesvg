export const RASTER_TO_SVG_ROUTE_PATHS = [
  "/png-to-svg-converter",
  "/png-to-svg-for-canva",
  "/png-to-svg-for-figma",
  "/transparent-png-to-svg-converter",
  "/png-to-svg-for-cricut",
  "/png-to-svg-for-etsy",
  "/png-to-svg-for-shopify",
  "/png-to-svg-for-silhouette",
  "/png-to-svg-for-laser-cutting",
  "/png-to-svg-for-glowforge",
  "/png-to-svg-for-cricut-vinyl",
  "/jpg-to-svg-converter",
  "/jpg-to-svg-for-etsy",
  "/jpg-to-svg-for-silhouette",
  "/jpg-to-svg-for-glowforge",
  "/jpg-to-svg-for-canva",
  "/jpeg-to-svg-converter",
  "/jpg-to-svg-for-cricut",
  "/jpeg-to-svg-for-cricut",
  "/webp-to-svg-converter",
  "/webp-to-svg-for-cricut",
  "/cricut-svg-converter",
  "/image-to-svg-for-cricut",
  "/image-to-svg-for-etsy",
  "/image-to-svg-for-silhouette",
  "/image-to-svg-for-glowforge",
  "/gif-to-svg-converter",
  "/avif-to-svg-converter",
  "/bmp-to-svg-converter",
  "/tiff-to-svg-converter",
] as const;

export type RasterToSvgRoutePath =
  (typeof RASTER_TO_SVG_ROUTE_PATHS)[number];

export type RasterToSvgRouteKey =
  | "png-base"
  | "png-canva"
  | "png-figma"
  | "png-transparent"
  | "png-cricut"
  | "png-etsy"
  | "png-shopify"
  | "png-silhouette"
  | "png-laser"
  | "png-glowforge"
  | "png-vinyl"
  | "jpg-base"
  | "jpg-etsy"
  | "jpg-silhouette"
  | "jpg-glowforge"
  | "jpg-canva"
  | "jpeg-base"
  | "jpg-cricut"
  | "jpeg-cricut"
  | "webp-base"
  | "webp-cricut"
  | "cricut-general"
  | "image-cricut"
  | "image-etsy"
  | "image-silhouette"
  | "image-glowforge"
  | "gif-base"
  | "avif-base"
  | "bmp-base"
  | "tiff-base";

export type RasterToSvgImplementationOwner =
  | "app/routes/png-to-svg-converter.tsx"
  | "app/routes/png-to-svg-for-cricut.tsx"
  | "app/routes/png-to-svg-for-etsy.tsx"
  | "app/routes/png-to-svg-for-silhouette.tsx"
  | "app/routes/png-to-svg-for-laser-cutting.tsx"
  | "app/routes/png-to-svg-for-cricut-vinyl.tsx"
  | "app/routes/jpg-to-svg-converter.tsx"
  | "app/routes/jpeg-to-svg-converter.tsx"
  | "app/routes/jpg-to-svg-for-cricut.tsx"
  | "app/routes/jpeg-to-svg-for-cricut.tsx"
  | "app/routes/webp-to-svg-converter.tsx"
  | "app/routes/webp-to-svg-for-cricut.tsx"
  | "app/routes/cricut-svg-converter.tsx"
  | "app/routes/image-to-svg-for-cricut.tsx";

export type RasterToSvgRouteSourceFile =
  | RasterToSvgImplementationOwner
  | "app/routes/png-to-svg-for-canva.tsx"
  | "app/routes/png-to-svg-for-figma.tsx"
  | "app/routes/transparent-png-to-svg-converter.tsx"
  | "app/routes/png-to-svg-for-shopify.tsx"
  | "app/routes/png-to-svg-for-glowforge.tsx"
  | "app/routes/jpg-to-svg-for-etsy.tsx"
  | "app/routes/jpg-to-svg-for-silhouette.tsx"
  | "app/routes/jpg-to-svg-for-glowforge.tsx"
  | "app/routes/jpg-to-svg-for-canva.tsx"
  | "app/routes/image-to-svg-for-etsy.tsx"
  | "app/routes/image-to-svg-for-silhouette.tsx"
  | "app/routes/image-to-svg-for-glowforge.tsx"
  | "app/routes/gif-to-svg-converter.tsx"
  | "app/routes/avif-to-svg-converter.tsx"
  | "app/routes/bmp-to-svg-converter.tsx"
  | "app/routes/tiff-to-svg-converter.tsx";

export type RasterToSvgInputPolicy =
  | "png-common-raster-svg"
  | "jpg-common-raster-svg"
  | "broad-raster-svg"
  | "webp-common-raster-svg";

export type RasterToSvgGuidanceCategory =
  | "general-format"
  | "design-platform"
  | "marketplace"
  | "cricut"
  | "silhouette"
  | "laser"
  | "vinyl"
  | "transparency"
  | "broad-image-format";

export type RasterToSvgRetentionReason =
  | "format-specific-input-intent"
  | "distinct-accepted-input-policy"
  | "distinct-preset-inventory"
  | "distinct-platform-workflow"
  | "distinct-public-guidance"
  | "distinct-metadata-identity"
  | "distinct-schema-and-breadcrumb-identity"
  | "context-would-not-survive-direct-redirect";

export type RasterToSvgContentContract = Readonly<{
  currentContentOwner: RasterToSvgImplementationOwner;
  routeSpecificGuidanceOwners: readonly [
    RasterToSvgImplementationOwner,
    "app/client/components/navigation/OtherToolsLinks.tsx",
  ];
  metadataOwner: RasterToSvgRouteSourceFile;
  schemaOwner: RasterToSvgImplementationOwner;
  breadcrumbOwner: "app/client/components/navigation/OtherToolsLinks.tsx";
  presetOwner: RasterToSvgImplementationOwner;
  guidanceCategory: RasterToSvgGuidanceCategory;
  routeSpecificCopyRemainsAtSource: true;
  consolidation: Readonly<{
    decision: "retain-independently";
    reasons: readonly RasterToSvgRetentionReason[];
    reconsiderationPolicy: "requires-new-evidence";
  }>;
}>;

export type RasterToSvgRouteContext = Readonly<{
  key: RasterToSvgRouteKey;
  path: RasterToSvgRoutePath;
  routeSource: RasterToSvgRouteSourceFile;
  implementationOwner: RasterToSvgImplementationOwner;
  canonicalPath: RasterToSvgRoutePath;
  inputPolicy: RasterToSvgInputPolicy;
  defaultPresetId: string;
  outputFilename: `${string}.svg`;
  contentContract: RasterToSvgContentContract;
}>;

type ContextDefinition = Readonly<{
  key: RasterToSvgRouteKey;
  path: RasterToSvgRoutePath;
  routeSource: RasterToSvgRouteSourceFile;
  implementationOwner: RasterToSvgImplementationOwner;
  inputPolicy: RasterToSvgInputPolicy;
  defaultPresetId: string;
  outputFilename: `${string}.svg`;
  guidanceCategory: RasterToSvgGuidanceCategory;
  reasons: readonly RasterToSvgRetentionReason[];
}>;

const FORMAT_REASONS = [
  "format-specific-input-intent",
  "distinct-public-guidance",
  "distinct-metadata-identity",
  "distinct-schema-and-breadcrumb-identity",
] as const satisfies readonly RasterToSvgRetentionReason[];

const WORKFLOW_REASONS = [
  "distinct-platform-workflow",
  "distinct-public-guidance",
  "distinct-metadata-identity",
  "distinct-schema-and-breadcrumb-identity",
  "context-would-not-survive-direct-redirect",
] as const satisfies readonly RasterToSvgRetentionReason[];

function defineContext(
  definition: ContextDefinition,
): RasterToSvgRouteContext {
  return Object.freeze({
    key: definition.key,
    path: definition.path,
    routeSource: definition.routeSource,
    implementationOwner: definition.implementationOwner,
    canonicalPath: definition.path,
    inputPolicy: definition.inputPolicy,
    defaultPresetId: definition.defaultPresetId,
    outputFilename: definition.outputFilename,
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
      guidanceCategory: definition.guidanceCategory,
      routeSpecificCopyRemainsAtSource: true,
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
    key: "png-base",
    path: "/png-to-svg-converter",
    routeSource: "app/routes/png-to-svg-converter.tsx",
    implementationOwner: "app/routes/png-to-svg-converter.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-converter.svg",
    guidanceCategory: "general-format",
    reasons: FORMAT_REASONS,
  },
  {
    key: "png-canva",
    path: "/png-to-svg-for-canva",
    routeSource: "app/routes/png-to-svg-for-canva.tsx",
    implementationOwner: "app/routes/png-to-svg-converter.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-converter.svg",
    guidanceCategory: "design-platform",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-figma",
    path: "/png-to-svg-for-figma",
    routeSource: "app/routes/png-to-svg-for-figma.tsx",
    implementationOwner: "app/routes/png-to-svg-converter.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-converter.svg",
    guidanceCategory: "design-platform",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-transparent",
    path: "/transparent-png-to-svg-converter",
    routeSource: "app/routes/transparent-png-to-svg-converter.tsx",
    implementationOwner: "app/routes/png-to-svg-converter.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-converter.svg",
    guidanceCategory: "transparency",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-cricut",
    path: "/png-to-svg-for-cricut",
    routeSource: "app/routes/png-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/png-to-svg-for-cricut.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "png-cricut-clean-cut",
    outputFilename: "png-to-svg-for-cricut.svg",
    guidanceCategory: "cricut",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-etsy",
    path: "/png-to-svg-for-etsy",
    routeSource: "app/routes/png-to-svg-for-etsy.tsx",
    implementationOwner: "app/routes/png-to-svg-for-etsy.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-for-etsy.svg",
    guidanceCategory: "marketplace",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-shopify",
    path: "/png-to-svg-for-shopify",
    routeSource: "app/routes/png-to-svg-for-shopify.tsx",
    implementationOwner: "app/routes/png-to-svg-for-etsy.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-for-etsy.svg",
    guidanceCategory: "marketplace",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-silhouette",
    path: "/png-to-svg-for-silhouette",
    routeSource: "app/routes/png-to-svg-for-silhouette.tsx",
    implementationOwner: "app/routes/png-to-svg-for-silhouette.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "png-to-svg-for-silhouette.svg",
    guidanceCategory: "silhouette",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-laser",
    path: "/png-to-svg-for-laser-cutting",
    routeSource: "app/routes/png-to-svg-for-laser-cutting.tsx",
    implementationOwner: "app/routes/png-to-svg-for-laser-cutting.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "laser-cut-clean",
    outputFilename: "png-to-svg-for-laser-cutting.svg",
    guidanceCategory: "laser",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-glowforge",
    path: "/png-to-svg-for-glowforge",
    routeSource: "app/routes/png-to-svg-for-glowforge.tsx",
    implementationOwner: "app/routes/png-to-svg-for-laser-cutting.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "laser-cut-clean",
    outputFilename: "png-to-svg-for-laser-cutting.svg",
    guidanceCategory: "laser",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "png-vinyl",
    path: "/png-to-svg-for-cricut-vinyl",
    routeSource: "app/routes/png-to-svg-for-cricut-vinyl.tsx",
    implementationOwner: "app/routes/png-to-svg-for-cricut-vinyl.tsx",
    inputPolicy: "png-common-raster-svg",
    defaultPresetId: "vinyl-clean-weed",
    outputFilename: "png-to-svg-for-cricut-vinyl.svg",
    guidanceCategory: "vinyl",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "jpg-base",
    path: "/jpg-to-svg-converter",
    routeSource: "app/routes/jpg-to-svg-converter.tsx",
    implementationOwner: "app/routes/jpg-to-svg-converter.tsx",
    inputPolicy: "jpg-common-raster-svg",
    defaultPresetId: "scan-clean",
    outputFilename: "jpg-to-svg-converter.svg",
    guidanceCategory: "general-format",
    reasons: FORMAT_REASONS,
  },
  {
    key: "jpg-etsy",
    path: "/jpg-to-svg-for-etsy",
    routeSource: "app/routes/jpg-to-svg-for-etsy.tsx",
    implementationOwner: "app/routes/jpg-to-svg-converter.tsx",
    inputPolicy: "jpg-common-raster-svg",
    defaultPresetId: "scan-clean",
    outputFilename: "jpg-to-svg-converter.svg",
    guidanceCategory: "marketplace",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "jpg-silhouette",
    path: "/jpg-to-svg-for-silhouette",
    routeSource: "app/routes/jpg-to-svg-for-silhouette.tsx",
    implementationOwner: "app/routes/jpg-to-svg-converter.tsx",
    inputPolicy: "jpg-common-raster-svg",
    defaultPresetId: "scan-clean",
    outputFilename: "jpg-to-svg-converter.svg",
    guidanceCategory: "silhouette",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "jpg-glowforge",
    path: "/jpg-to-svg-for-glowforge",
    routeSource: "app/routes/jpg-to-svg-for-glowforge.tsx",
    implementationOwner: "app/routes/jpg-to-svg-converter.tsx",
    inputPolicy: "jpg-common-raster-svg",
    defaultPresetId: "scan-clean",
    outputFilename: "jpg-to-svg-converter.svg",
    guidanceCategory: "laser",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "jpg-canva",
    path: "/jpg-to-svg-for-canva",
    routeSource: "app/routes/jpg-to-svg-for-canva.tsx",
    implementationOwner: "app/routes/jpg-to-svg-converter.tsx",
    inputPolicy: "jpg-common-raster-svg",
    defaultPresetId: "scan-clean",
    outputFilename: "jpg-to-svg-converter.svg",
    guidanceCategory: "design-platform",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "jpeg-base",
    path: "/jpeg-to-svg-converter",
    routeSource: "app/routes/jpeg-to-svg-converter.tsx",
    implementationOwner: "app/routes/jpeg-to-svg-converter.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "scan-clean",
    outputFilename: "jpeg-to-svg-converter.svg",
    guidanceCategory: "general-format",
    reasons: [
      ...FORMAT_REASONS,
      "distinct-accepted-input-policy",
      "distinct-preset-inventory",
    ],
  },
  {
    key: "jpg-cricut",
    path: "/jpg-to-svg-for-cricut",
    routeSource: "app/routes/jpg-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/jpg-to-svg-for-cricut.tsx",
    inputPolicy: "jpg-common-raster-svg",
    defaultPresetId: "jpg-cricut-clean-cut",
    outputFilename: "jpg-to-svg-for-cricut.svg",
    guidanceCategory: "cricut",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "jpeg-cricut",
    path: "/jpeg-to-svg-for-cricut",
    routeSource: "app/routes/jpeg-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/jpeg-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "jpeg-cricut-clean-cut",
    outputFilename: "jpeg-to-svg-for-cricut.svg",
    guidanceCategory: "cricut",
    reasons: [
      ...WORKFLOW_REASONS,
      "distinct-accepted-input-policy",
      "distinct-preset-inventory",
    ],
  },
  {
    key: "webp-base",
    path: "/webp-to-svg-converter",
    routeSource: "app/routes/webp-to-svg-converter.tsx",
    implementationOwner: "app/routes/webp-to-svg-converter.tsx",
    inputPolicy: "webp-common-raster-svg",
    defaultPresetId: "webp-edge-balanced",
    outputFilename: "webp-to-svg.svg",
    guidanceCategory: "general-format",
    reasons: FORMAT_REASONS,
  },
  {
    key: "webp-cricut",
    path: "/webp-to-svg-for-cricut",
    routeSource: "app/routes/webp-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/webp-to-svg-for-cricut.tsx",
    inputPolicy: "webp-common-raster-svg",
    defaultPresetId: "webp-cricut-clean-cut",
    outputFilename: "webp-cricut-cut-file.svg",
    guidanceCategory: "cricut",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "cricut-general",
    path: "/cricut-svg-converter",
    routeSource: "app/routes/cricut-svg-converter.tsx",
    implementationOwner: "app/routes/cricut-svg-converter.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "cricut-svg-converter.svg",
    guidanceCategory: "cricut",
    reasons: [
      ...WORKFLOW_REASONS,
      "distinct-accepted-input-policy",
      "distinct-preset-inventory",
    ],
  },
  {
    key: "image-cricut",
    path: "/image-to-svg-for-cricut",
    routeSource: "app/routes/image-to-svg-for-cricut.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "cricut",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "image-etsy",
    path: "/image-to-svg-for-etsy",
    routeSource: "app/routes/image-to-svg-for-etsy.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "marketplace",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "image-silhouette",
    path: "/image-to-svg-for-silhouette",
    routeSource: "app/routes/image-to-svg-for-silhouette.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "silhouette",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "image-glowforge",
    path: "/image-to-svg-for-glowforge",
    routeSource: "app/routes/image-to-svg-for-glowforge.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "laser",
    reasons: WORKFLOW_REASONS,
  },
  {
    key: "gif-base",
    path: "/gif-to-svg-converter",
    routeSource: "app/routes/gif-to-svg-converter.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "broad-image-format",
    reasons: FORMAT_REASONS,
  },
  {
    key: "avif-base",
    path: "/avif-to-svg-converter",
    routeSource: "app/routes/avif-to-svg-converter.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "broad-image-format",
    reasons: FORMAT_REASONS,
  },
  {
    key: "bmp-base",
    path: "/bmp-to-svg-converter",
    routeSource: "app/routes/bmp-to-svg-converter.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "broad-image-format",
    reasons: FORMAT_REASONS,
  },
  {
    key: "tiff-base",
    path: "/tiff-to-svg-converter",
    routeSource: "app/routes/tiff-to-svg-converter.tsx",
    implementationOwner: "app/routes/image-to-svg-for-cricut.tsx",
    inputPolicy: "broad-raster-svg",
    defaultPresetId: "line-accurate",
    outputFilename: "image-to-svg-for-cricut.svg",
    guidanceCategory: "broad-image-format",
    reasons: FORMAT_REASONS,
  },
] as const satisfies readonly ContextDefinition[];

export type RasterToSvgRouteKeyForOwner<
  Owner extends RasterToSvgImplementationOwner,
> = Extract<
  (typeof definitions)[number],
  { implementationOwner: Owner }
>["key"];

export const RASTER_TO_SVG_ROUTE_CONTEXTS = Object.freeze(
  Object.fromEntries(
    definitions.map((definition) => [
      definition.path,
      defineContext(definition),
    ]),
  ),
) as Readonly<Record<RasterToSvgRoutePath, RasterToSvgRouteContext>>;

export const RASTER_TO_SVG_EXCLUDED_SPECIALIZED_ROUTES = Object.freeze([
  {
    path: "/png-to-svg-for-cricut-print-then-cut",
    reason: "printable-color-and-cut-outline-workflow",
  },
  {
    path: "/png-to-svg-for-cricut-stickers",
    reason: "sticker-border-and-cut-outline-workflow",
  },
] as const);

export function getRasterToSvgRouteContext(
  path: string,
): RasterToSvgRouteContext {
  if (Object.prototype.hasOwnProperty.call(RASTER_TO_SVG_ROUTE_CONTEXTS, path)) {
    return RASTER_TO_SVG_ROUTE_CONTEXTS[path as RasterToSvgRoutePath];
  }
  throw new Error(`Unknown raster-to-SVG route path: ${path}`);
}

export function getRasterToSvgRouteContextByKey(
  key: string,
): RasterToSvgRouteContext {
  const context = Object.values(RASTER_TO_SVG_ROUTE_CONTEXTS).find(
    (candidate) => candidate.key === key,
  );
  if (context) return context;
  throw new Error(`Unknown raster-to-SVG route key: ${key}`);
}
