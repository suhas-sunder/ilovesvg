export const CRICUT_OUTPUT_ROUTE_PATHS = [
  "/layered-svg-for-cricut",
  "/image-to-layered-svg-for-cricut",
  "/png-to-layered-svg-for-cricut",
  "/jpg-to-layered-svg-for-cricut",
  "/logo-to-layered-svg-for-cricut",
  "/image-to-layered-svg-converter",
  "/jpg-to-layered-svg-converter",
  "/logo-to-layered-svg-converter",
  "/png-to-svg-for-cricut-print-then-cut",
  "/png-to-svg-for-cricut-stickers",
  "/png-to-svg-for-cricut-vinyl",
] as const;

export type CricutOutputRoutePath =
  (typeof CRICUT_OUTPUT_ROUTE_PATHS)[number];

export type CricutOutputRouteKey =
  | "layered-cricut"
  | "layered-image-cricut"
  | "layered-png-cricut"
  | "layered-jpg-cricut"
  | "layered-logo-cricut"
  | "layered-image-general"
  | "layered-jpg-general"
  | "layered-logo-general"
  | "print-then-cut"
  | "cricut-stickers"
  | "cricut-vinyl";

export type CricutOutputSubfamily =
  | "layered-svg"
  | "print-then-cut"
  | "sticker-cut-outline"
  | "vinyl-cut-file";

export type CricutOutputImplementationOwner =
  | "app/routes/layered-svg-for-cricut.tsx"
  | "app/routes/image-to-layered-svg-for-cricut.tsx"
  | "app/routes/png-to-layered-svg-for-cricut.tsx"
  | "app/routes/jpg-to-layered-svg-for-cricut.tsx"
  | "app/routes/logo-to-layered-svg-for-cricut.tsx"
  | "app/routes/png-to-svg-for-cricut-print-then-cut.tsx"
  | "app/routes/png-to-svg-for-cricut-stickers.tsx"
  | "app/routes/png-to-svg-for-cricut-vinyl.tsx";

export type CricutOutputRouteSource =
  | CricutOutputImplementationOwner
  | "app/routes/image-to-layered-svg-converter.tsx"
  | "app/routes/jpg-to-layered-svg-converter.tsx"
  | "app/routes/logo-to-layered-svg-converter.tsx";

export type CricutOutputInputPolicy =
  | "png-jpeg-webp"
  | "png-jpeg";

export type CricutOutputContract =
  | "editable-layered-color-svg"
  | "printable-image-with-cut-outline"
  | "sticker-image-with-cut-outline"
  | "single-color-vinyl-svg";

export type CricutOutputGuidanceCategory =
  | "layered-general"
  | "layered-cricut"
  | "layered-png"
  | "layered-jpg"
  | "layered-logo"
  | "print-then-cut"
  | "cricut-stickers"
  | "cricut-vinyl";

export type CricutOutputRetentionReason =
  | "distinct-output-contract"
  | "distinct-preset-inventory"
  | "distinct-defaults"
  | "distinct-input-intent"
  | "distinct-filename-policy"
  | "distinct-public-guidance"
  | "distinct-platform-workflow"
  | "distinct-metadata-identity"
  | "distinct-schema-and-breadcrumb-identity"
  | "context-would-not-survive-direct-redirect";

export type CricutOutputContentContract = Readonly<{
  currentContentOwner: CricutOutputImplementationOwner;
  metadataOwner: CricutOutputRouteSource;
  schemaOwner: CricutOutputImplementationOwner;
  breadcrumbOwner: "app/client/components/navigation/OtherToolsLinks.tsx";
  presetOwner: CricutOutputImplementationOwner;
  acceptedInputOwner: CricutOutputImplementationOwner;
  filenameOwner: CricutOutputImplementationOwner;
  guidanceOwners: readonly [
    CricutOutputImplementationOwner,
    "app/client/components/navigation/OtherToolsLinks.tsx",
  ];
  guidanceCategory: CricutOutputGuidanceCategory;
  routeSpecificCopyRemainsAtSource: true;
  consolidation: Readonly<{
    decision: "retain-independently";
    reasons: readonly CricutOutputRetentionReason[];
    reconsiderationPolicy: "requires-new-evidence";
  }>;
}>;

export type CricutOutputRouteContext = Readonly<{
  key: CricutOutputRouteKey;
  path: CricutOutputRoutePath;
  canonicalPath: CricutOutputRoutePath;
  routeSource: CricutOutputRouteSource;
  implementationOwner: CricutOutputImplementationOwner;
  lifecycleRouteId: string;
  subfamily: CricutOutputSubfamily;
  inputPolicy: CricutOutputInputPolicy;
  outputContract: CricutOutputContract;
  defaultPresetId: string;
  outputFilename: `${string}.svg`;
  title: string;
  h1: string;
  contentContract: CricutOutputContentContract;
}>;

type ContextDefinition = Readonly<{
  key: CricutOutputRouteKey;
  path: CricutOutputRoutePath;
  routeSource: CricutOutputRouteSource;
  implementationOwner: CricutOutputImplementationOwner;
  lifecycleRouteId: string;
  subfamily: CricutOutputSubfamily;
  inputPolicy: CricutOutputInputPolicy;
  outputContract: CricutOutputContract;
  defaultPresetId: string;
  outputFilename: `${string}.svg`;
  title: string;
  h1: string;
  guidanceCategory: CricutOutputGuidanceCategory;
  reasons: readonly CricutOutputRetentionReason[];
}>;

const LAYERED_REASONS = [
  "distinct-input-intent",
  "distinct-preset-inventory",
  "distinct-public-guidance",
  "distinct-metadata-identity",
  "distinct-schema-and-breadcrumb-identity",
  "context-would-not-survive-direct-redirect",
] as const satisfies readonly CricutOutputRetentionReason[];

const PRODUCTION_REASONS = [
  "distinct-output-contract",
  "distinct-preset-inventory",
  "distinct-defaults",
  "distinct-filename-policy",
  "distinct-public-guidance",
  "distinct-platform-workflow",
  "distinct-metadata-identity",
  "distinct-schema-and-breadcrumb-identity",
  "context-would-not-survive-direct-redirect",
] as const satisfies readonly CricutOutputRetentionReason[];

function defineContext(
  definition: ContextDefinition,
): CricutOutputRouteContext {
  return Object.freeze({
    key: definition.key,
    path: definition.path,
    canonicalPath: definition.path,
    routeSource: definition.routeSource,
    implementationOwner: definition.implementationOwner,
    lifecycleRouteId: definition.lifecycleRouteId,
    subfamily: definition.subfamily,
    inputPolicy: definition.inputPolicy,
    outputContract: definition.outputContract,
    defaultPresetId: definition.defaultPresetId,
    outputFilename: definition.outputFilename,
    title: definition.title,
    h1: definition.h1,
    contentContract: Object.freeze({
      currentContentOwner: definition.implementationOwner,
      metadataOwner: definition.routeSource,
      schemaOwner: definition.implementationOwner,
      breadcrumbOwner:
        "app/client/components/navigation/OtherToolsLinks.tsx" as const,
      presetOwner: definition.implementationOwner,
      acceptedInputOwner: definition.implementationOwner,
      filenameOwner: definition.implementationOwner,
      guidanceOwners: Object.freeze([
        definition.implementationOwner,
        "app/client/components/navigation/OtherToolsLinks.tsx",
      ] as const),
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
    key: "layered-cricut",
    path: "/layered-svg-for-cricut",
    routeSource: "app/routes/layered-svg-for-cricut.tsx",
    implementationOwner: "app/routes/layered-svg-for-cricut.tsx",
    lifecycleRouteId: "layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "layered-svg-for-cricut.svg",
    title: "Layered SVG for Cricut - Editable Color Layers | iLoveSVG",
    h1: "Layered SVG for Cricut",
    guidanceCategory: "layered-cricut",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-image-cricut",
    path: "/image-to-layered-svg-for-cricut",
    routeSource: "app/routes/image-to-layered-svg-for-cricut.tsx",
    implementationOwner: "app/routes/image-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "image-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "image-to-layered-svg-for-cricut.svg",
    title:
      "Image to Layered SVG for Cricut - Free Online Layered SVG Converter",
    h1: "Image to Layered SVG for Cricut",
    guidanceCategory: "layered-cricut",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-png-cricut",
    path: "/png-to-layered-svg-for-cricut",
    routeSource: "app/routes/png-to-layered-svg-for-cricut.tsx",
    implementationOwner: "app/routes/png-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "png-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "png-to-layered-svg-for-cricut.svg",
    title:
      "PNG to Layered SVG for Cricut - Free Layered PNG SVG Converter",
    h1: "PNG to Layered SVG for Cricut",
    guidanceCategory: "layered-png",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-jpg-cricut",
    path: "/jpg-to-layered-svg-for-cricut",
    routeSource: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    implementationOwner: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "jpg-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "jpg-to-layered-svg-for-cricut.svg",
    title:
      "JPG to Layered SVG for Cricut - Free JPEG Layered SVG Converter",
    h1: "JPG to Layered SVG for Cricut",
    guidanceCategory: "layered-jpg",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-logo-cricut",
    path: "/logo-to-layered-svg-for-cricut",
    routeSource: "app/routes/logo-to-layered-svg-for-cricut.tsx",
    implementationOwner: "app/routes/logo-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "logo-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "logo-to-layered-svg-for-cricut.svg",
    title:
      "Logo to Layered SVG for Cricut - Free Logo Layered SVG Converter",
    h1: "Logo to Layered SVG for Cricut",
    guidanceCategory: "layered-logo",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-image-general",
    path: "/image-to-layered-svg-converter",
    routeSource: "app/routes/image-to-layered-svg-converter.tsx",
    implementationOwner: "app/routes/image-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "image-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "image-to-layered-svg-for-cricut.svg",
    title: "Image to Layered SVG Converter | iLoveSVG",
    h1: "Image to Layered SVG Converter",
    guidanceCategory: "layered-general",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-jpg-general",
    path: "/jpg-to-layered-svg-converter",
    routeSource: "app/routes/jpg-to-layered-svg-converter.tsx",
    implementationOwner: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "jpg-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "jpg-to-layered-svg-for-cricut.svg",
    title: "JPG to Layered SVG Converter | iLoveSVG",
    h1: "JPG to Layered SVG Converter",
    guidanceCategory: "layered-general",
    reasons: LAYERED_REASONS,
  },
  {
    key: "layered-logo-general",
    path: "/logo-to-layered-svg-converter",
    routeSource: "app/routes/logo-to-layered-svg-converter.tsx",
    implementationOwner: "app/routes/logo-to-layered-svg-for-cricut.tsx",
    lifecycleRouteId: "logo-to-layered-svg-for-cricut",
    subfamily: "layered-svg",
    inputPolicy: "png-jpeg-webp",
    outputContract: "editable-layered-color-svg",
    defaultPresetId: "layered-color",
    outputFilename: "logo-to-layered-svg-for-cricut.svg",
    title: "Logo to Layered SVG Converter | iLoveSVG",
    h1: "Logo to Layered SVG Converter",
    guidanceCategory: "layered-general",
    reasons: LAYERED_REASONS,
  },
  {
    key: "print-then-cut",
    path: "/png-to-svg-for-cricut-print-then-cut",
    routeSource: "app/routes/png-to-svg-for-cricut-print-then-cut.tsx",
    implementationOwner:
      "app/routes/png-to-svg-for-cricut-print-then-cut.tsx",
    lifecycleRouteId: "png-to-svg-for-cricut-print-then-cut",
    subfamily: "print-then-cut",
    inputPolicy: "png-jpeg",
    outputContract: "printable-image-with-cut-outline",
    defaultPresetId: "sticker-clean-offset",
    outputFilename: "print-then-cut.svg",
    title:
      "PNG to SVG for Cricut Print Then Cut | Free Print Then Cut SVG Maker",
    h1: "PNG to SVG for Cricut Print Then Cut",
    guidanceCategory: "print-then-cut",
    reasons: PRODUCTION_REASONS,
  },
  {
    key: "cricut-stickers",
    path: "/png-to-svg-for-cricut-stickers",
    routeSource: "app/routes/png-to-svg-for-cricut-stickers.tsx",
    implementationOwner: "app/routes/png-to-svg-for-cricut-stickers.tsx",
    lifecycleRouteId: "png-to-svg-for-cricut-stickers",
    subfamily: "sticker-cut-outline",
    inputPolicy: "png-jpeg",
    outputContract: "sticker-image-with-cut-outline",
    defaultPresetId: "white-border",
    outputFilename: "cricut-sticker.svg",
    title:
      "PNG to SVG for Cricut Stickers | Free Sticker Cut Outline Tool",
    h1: "PNG to SVG for Cricut Stickers",
    guidanceCategory: "cricut-stickers",
    reasons: PRODUCTION_REASONS,
  },
  {
    key: "cricut-vinyl",
    path: "/png-to-svg-for-cricut-vinyl",
    routeSource: "app/routes/png-to-svg-for-cricut-vinyl.tsx",
    implementationOwner: "app/routes/png-to-svg-for-cricut-vinyl.tsx",
    lifecycleRouteId: "png-to-svg-for-cricut-vinyl",
    subfamily: "vinyl-cut-file",
    inputPolicy: "png-jpeg",
    outputContract: "single-color-vinyl-svg",
    defaultPresetId: "vinyl-clean-weed",
    outputFilename: "png-to-svg-for-cricut-vinyl.svg",
    title: "PNG to SVG for Cricut Vinyl | Free Vinyl Cut File Converter",
    h1: "PNG to SVG for Cricut Vinyl",
    guidanceCategory: "cricut-vinyl",
    reasons: PRODUCTION_REASONS,
  },
] as const satisfies readonly ContextDefinition[];

export type CricutOutputRouteKeyForOwner<
  Owner extends CricutOutputImplementationOwner,
> = Extract<
  (typeof definitions)[number],
  { implementationOwner: Owner }
>["key"];

export const CRICUT_OUTPUT_ROUTE_CONTEXTS = Object.freeze(
  Object.fromEntries(
    definitions.map((definition) => [
      definition.path,
      defineContext(definition),
    ]),
  ),
) as Readonly<
  Record<CricutOutputRoutePath, CricutOutputRouteContext>
>;

export function getCricutOutputRouteContext(
  path: string,
): CricutOutputRouteContext {
  if (
    Object.prototype.hasOwnProperty.call(CRICUT_OUTPUT_ROUTE_CONTEXTS, path)
  ) {
    return CRICUT_OUTPUT_ROUTE_CONTEXTS[path as CricutOutputRoutePath];
  }
  throw new Error(`Unknown Cricut output route path: ${path}`);
}

export function getCricutOutputRouteContextByKey(
  key: string,
): CricutOutputRouteContext {
  const context = Object.values(CRICUT_OUTPUT_ROUTE_CONTEXTS).find(
    (candidate) => candidate.key === key,
  );
  if (context) return context;
  throw new Error(`Unknown Cricut output route key: ${key}`);
}
