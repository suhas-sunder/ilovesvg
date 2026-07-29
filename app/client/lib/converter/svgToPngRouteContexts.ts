export const SVG_TO_PNG_ROUTE_PATHS = [
  "/svg-to-png-converter",
  "/svg-to-png-for-shopify",
  "/svg-to-png-for-etsy",
  "/svg-to-png-for-printify",
  "/svg-to-png-for-printful",
  "/sticker-to-png-for-printing",
  "/svg-to-transparent-png-for-printing",
  "/svg-to-png-for-canva",
  "/svg-to-png-for-figma",
] as const;

export type SvgToPngRoutePath = (typeof SVG_TO_PNG_ROUTE_PATHS)[number];

export type SvgToPngRouteKey =
  | "base"
  | "shopify"
  | "etsy"
  | "printify"
  | "printful"
  | "sticker-printing"
  | "transparent-printing"
  | "canva"
  | "figma";

export type SvgToPngSettings = {
  width: number;
  height: number;
  lockAspect: boolean;
  dpiScale: number;
  background: "transparent" | "solid";
  bgColor: string;
  antiAlias: boolean;
  fileName: string;
};

export type SvgToPngRouteSourceFile =
  | "app/routes/svg-to-png-converter.tsx"
  | "app/routes/svg-to-png-for-shopify.tsx"
  | "app/routes/svg-to-png-for-etsy.tsx"
  | "app/routes/svg-to-png-for-printify.tsx"
  | "app/routes/svg-to-png-for-printful.tsx"
  | "app/routes/sticker-to-png-for-printing.tsx"
  | "app/routes/svg-to-transparent-png-for-printing.tsx"
  | "app/routes/svg-to-png-for-canva.tsx"
  | "app/routes/svg-to-png-for-figma.tsx";

export type SvgToPngGuidanceCategory =
  | "base-converter"
  | "seller-platform"
  | "print-on-demand"
  | "sticker-printing"
  | "transparent-printing"
  | "design-platform";

export type SvgToPngContentKind =
  | "base-converter-guidance"
  | "platform-workflow-guidance"
  | "printing-guidance"
  | "transparency-guidance"
  | "sticker-guidance";

export type SvgToPngContentSourceKey =
  | "base-converter:intro-controls"
  | "base-converter:dimensions-background"
  | "base-converter:output-download"
  | "base-converter:example-workflow"
  | "base-converter:faq-troubleshooting"
  | "base-converter:printify-inline-guidance"
  | "base-converter:printful-inline-guidance"
  | "other-tools:base-explicit-guide"
  | "other-tools:utility-derived-guide"
  | "other-tools:all-tools-entry";

export type SvgToPngFutureMigrationStatus =
  | "not-planned"
  | "preservation-required"
  | "blocked"
  | "ready-for-later-approval";

export type SvgToPngContentContract = Readonly<{
  retainedDestinationCandidate: "/svg-to-png-converter";
  currentContentOwner: SvgToPngRouteSourceFile;
  guidanceCategory: SvgToPngGuidanceCategory;
  titleH1Identity: Readonly<{
    title: string;
    h1: string;
  }>;
  defaultDimensions: Readonly<{
    width: 1024;
    height: 1024;
  }>;
  outputFilenamePolicy: Readonly<{
    mode: "source-basename";
    fallbackBasename: "converted";
  }>;
  exampleBehavior: "shared-static-example-workflow";
  breadcrumbSchemaOwner: "base-svg-to-png-converter";
  contentKinds: readonly SvgToPngContentKind[];
  contentSourceKeys: readonly SvgToPngContentSourceKey[];
  futureMigrationStatus: SvgToPngFutureMigrationStatus;
}>;

export type SvgToPngRouteContext = {
  key: SvgToPngRouteKey;
  path: SvgToPngRoutePath;
  sharedImplementationOwner: "app/routes/svg-to-png-converter.tsx";
  h1: string;
  platformName: string | null;
  canonicalPath: SvgToPngRoutePath;
  inputAccept: "image/svg+xml,.svg";
  defaults: Readonly<SvgToPngSettings>;
  outputFilenameMode: "source-basename";
  breadcrumb: Readonly<{
    name: "SVG to PNG";
    path: "/svg-to-png-converter";
  }>;
  schema: Readonly<{
    name: "SVG to PNG";
    path: "/svg-to-png-converter";
  }>;
  hasDedicatedInlineSeoCopy: boolean;
  contentContract: SvgToPngContentContract;
};

const SHARED_DEFAULTS = Object.freeze({
  width: 1024,
  height: 1024,
  lockAspect: true,
  dpiScale: 1,
  background: "transparent",
  bgColor: "#ffffff",
  antiAlias: true,
  fileName: "converted",
} as const satisfies Readonly<SvgToPngSettings>);

const SHARED_BREADCRUMB = Object.freeze({
  name: "SVG to PNG" as const,
  path: "/svg-to-png-converter" as const,
});

const SHARED_SCHEMA = Object.freeze({
  name: "SVG to PNG" as const,
  path: "/svg-to-png-converter" as const,
});

function defineContext(
  value: Omit<
    SvgToPngRouteContext,
    | "sharedImplementationOwner"
    | "canonicalPath"
    | "inputAccept"
    | "defaults"
    | "outputFilenameMode"
    | "breadcrumb"
    | "schema"
    | "contentContract"
  > & {
    title: string;
    currentContentOwner: SvgToPngRouteSourceFile;
    guidanceCategory: SvgToPngGuidanceCategory;
    contentKinds: readonly SvgToPngContentKind[];
    contentSourceKeys: readonly SvgToPngContentSourceKey[];
    futureMigrationStatus: SvgToPngFutureMigrationStatus;
  },
): SvgToPngRouteContext {
  const {
    title,
    currentContentOwner,
    guidanceCategory,
    contentKinds,
    contentSourceKeys,
    futureMigrationStatus,
    ...context
  } = value;
  return Object.freeze({
    ...context,
    sharedImplementationOwner: "app/routes/svg-to-png-converter.tsx",
    canonicalPath: context.path,
    inputAccept: "image/svg+xml,.svg",
    defaults: SHARED_DEFAULTS,
    outputFilenameMode: "source-basename",
    breadcrumb: SHARED_BREADCRUMB,
    schema: SHARED_SCHEMA,
    contentContract: Object.freeze({
      retainedDestinationCandidate: "/svg-to-png-converter",
      currentContentOwner,
      guidanceCategory,
      titleH1Identity: Object.freeze({
        title,
        h1: context.h1,
      }),
      defaultDimensions: Object.freeze({
        width: SHARED_DEFAULTS.width,
        height: SHARED_DEFAULTS.height,
      }),
      outputFilenamePolicy: Object.freeze({
        mode: "source-basename",
        fallbackBasename: SHARED_DEFAULTS.fileName,
      }),
      exampleBehavior: "shared-static-example-workflow",
      breadcrumbSchemaOwner: "base-svg-to-png-converter",
      contentKinds: Object.freeze([...contentKinds]),
      contentSourceKeys: Object.freeze([...contentSourceKeys]),
      futureMigrationStatus,
    }),
  });
}

const SHARED_CONTENT_SOURCE_KEYS = [
  "base-converter:intro-controls",
  "base-converter:dimensions-background",
  "base-converter:output-download",
  "base-converter:example-workflow",
  "base-converter:faq-troubleshooting",
] as const satisfies readonly SvgToPngContentSourceKey[];

export const SVG_TO_PNG_ROUTE_CONTEXTS = Object.freeze({
  "/svg-to-png-converter": defineContext({
    key: "base",
    path: "/svg-to-png-converter",
    title:
      "SVG to PNG Converter - Export Transparent PNG Files | iLoveSVG",
    h1: "SVG to PNG Converter",
    platformName: null,
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner: "app/routes/svg-to-png-converter.tsx",
    guidanceCategory: "base-converter",
    contentKinds: ["base-converter-guidance"],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:base-explicit-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "not-planned",
  }),
  "/svg-to-png-for-shopify": defineContext({
    key: "shopify",
    path: "/svg-to-png-for-shopify",
    title: "SVG to PNG for Shopify | iLoveSVG",
    h1: "SVG to PNG for Shopify",
    platformName: "Shopify",
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner: "app/routes/svg-to-png-for-shopify.tsx",
    guidanceCategory: "seller-platform",
    contentKinds: [
      "base-converter-guidance",
      "platform-workflow-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/svg-to-png-for-etsy": defineContext({
    key: "etsy",
    path: "/svg-to-png-for-etsy",
    title: "SVG to PNG for Etsy | iLoveSVG",
    h1: "SVG to PNG for Etsy",
    platformName: "Etsy",
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner: "app/routes/svg-to-png-for-etsy.tsx",
    guidanceCategory: "seller-platform",
    contentKinds: [
      "base-converter-guidance",
      "platform-workflow-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/svg-to-png-for-printify": defineContext({
    key: "printify",
    path: "/svg-to-png-for-printify",
    title: "SVG to PNG for Printify | iLoveSVG",
    h1: "SVG to PNG for Printify",
    platformName: "Printify",
    hasDedicatedInlineSeoCopy: true,
    currentContentOwner: "app/routes/svg-to-png-for-printify.tsx",
    guidanceCategory: "print-on-demand",
    contentKinds: [
      "base-converter-guidance",
      "platform-workflow-guidance",
      "printing-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "base-converter:printify-inline-guidance",
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/svg-to-png-for-printful": defineContext({
    key: "printful",
    path: "/svg-to-png-for-printful",
    title: "SVG to PNG for Printful | iLoveSVG",
    h1: "SVG to PNG for Printful",
    platformName: "Printful",
    hasDedicatedInlineSeoCopy: true,
    currentContentOwner: "app/routes/svg-to-png-for-printful.tsx",
    guidanceCategory: "print-on-demand",
    contentKinds: [
      "base-converter-guidance",
      "platform-workflow-guidance",
      "printing-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "base-converter:printful-inline-guidance",
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/sticker-to-png-for-printing": defineContext({
    key: "sticker-printing",
    path: "/sticker-to-png-for-printing",
    title: "Sticker SVG to PNG for Printing | iLoveSVG",
    h1: "Sticker SVG to PNG for Printing",
    platformName: "Sticker printing",
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner: "app/routes/sticker-to-png-for-printing.tsx",
    guidanceCategory: "sticker-printing",
    contentKinds: [
      "base-converter-guidance",
      "printing-guidance",
      "sticker-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/svg-to-transparent-png-for-printing": defineContext({
    key: "transparent-printing",
    path: "/svg-to-transparent-png-for-printing",
    title: "SVG to Transparent PNG for Printing | iLoveSVG",
    h1: "SVG to Transparent PNG for Printing",
    platformName: "Transparent printing",
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner:
      "app/routes/svg-to-transparent-png-for-printing.tsx",
    guidanceCategory: "transparent-printing",
    contentKinds: [
      "base-converter-guidance",
      "printing-guidance",
      "transparency-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/svg-to-png-for-canva": defineContext({
    key: "canva",
    path: "/svg-to-png-for-canva",
    title: "SVG to PNG for Canva | iLoveSVG",
    h1: "SVG to PNG for Canva",
    platformName: "Canva",
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner: "app/routes/svg-to-png-for-canva.tsx",
    guidanceCategory: "design-platform",
    contentKinds: [
      "base-converter-guidance",
      "platform-workflow-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
  "/svg-to-png-for-figma": defineContext({
    key: "figma",
    path: "/svg-to-png-for-figma",
    title: "SVG to PNG for Figma | iLoveSVG",
    h1: "SVG to PNG for Figma",
    platformName: "Figma",
    hasDedicatedInlineSeoCopy: false,
    currentContentOwner: "app/routes/svg-to-png-for-figma.tsx",
    guidanceCategory: "design-platform",
    contentKinds: [
      "base-converter-guidance",
      "platform-workflow-guidance",
    ],
    contentSourceKeys: [
      ...SHARED_CONTENT_SOURCE_KEYS,
      "other-tools:utility-derived-guide",
      "other-tools:all-tools-entry",
    ],
    futureMigrationStatus: "blocked",
  }),
} as const satisfies Readonly<
  Record<SvgToPngRoutePath, SvgToPngRouteContext>
>);

export function getSvgToPngRouteContext(pathname: string): SvgToPngRouteContext {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (
    Object.prototype.hasOwnProperty.call(
      SVG_TO_PNG_ROUTE_CONTEXTS,
      normalized,
    )
  ) {
    return SVG_TO_PNG_ROUTE_CONTEXTS[
      normalized as SvgToPngRoutePath
    ];
  }
  throw new Error(`Unknown SVG-to-PNG route context: ${normalized}`);
}

export function getSvgToPngRouteContextByKey(
  key: string,
): SvgToPngRouteContext {
  const context = Object.values(SVG_TO_PNG_ROUTE_CONTEXTS).find(
    (candidate) => candidate.key === key,
  );
  if (context) return context;
  throw new Error(`Unknown SVG-to-PNG route key: ${key}`);
}
