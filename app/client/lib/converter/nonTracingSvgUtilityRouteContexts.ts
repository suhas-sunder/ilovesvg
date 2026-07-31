export const NON_TRACING_SVG_UTILITY_RETAINED_PATHS = [
  "/svg-to-favicon-generator",
  "/svg-to-ico-converter",
  "/image-to-favicon-generator",
  "/png-to-favicon-generator",
  "/jpg-to-favicon-generator",
  "/logo-to-favicon-generator",
  "/png-to-ico-converter",
  "/svg-to-favicon-for-shopify",
  "/logo-to-favicon-for-shopify",
  "/svg-resize-and-scale-editor",
  "/svg-resizer-for-shopify",
  "/svg-resizer-for-etsy",
  "/svg-resizer-for-glowforge",
  "/svg-resizer-for-silhouette",
  "/svg-resizer-for-canva",
  "/svg-resizer-for-figma",
  "/svg-dimensions-inspector",
  "/svg-file-size-inspector",
  "/svg-preview-viewer",
  "/svg-to-base64",
  "/base64-to-svg",
  "/svg-embed-code-generator",
  "/inline-svg-vs-img",
  "/svg-to-jsx-converter",
  "/svg-minifier",
  "/svg-cleaner",
  "/svg-cleaner-for-glowforge",
  "/svg-cleaner-for-silhouette",
  "/svg-cleaner-for-figma",
] as const;

export const NON_TRACING_SVG_UTILITY_REDIRECT_PATHS = [
  "/svg-viewbox-editor",
  "/svg-resizer",
  "/resize-svg",
  "/scale-svg",
  "/svg-inspector",
  "/svg-to-react-component",
  "/svg-to-css-background",
  "/svg-to-data-uri-converter",
  "/svg-inline-code-generator",
  "/svg-code-cleaner",
] as const;

export const NON_TRACING_SVG_UTILITY_PATHS = [
  ...NON_TRACING_SVG_UTILITY_RETAINED_PATHS,
  ...NON_TRACING_SVG_UTILITY_REDIRECT_PATHS,
] as const;

export type NonTracingSvgUtilityRetainedPath =
  (typeof NON_TRACING_SVG_UTILITY_RETAINED_PATHS)[number];
export type NonTracingSvgUtilityRedirectPath =
  (typeof NON_TRACING_SVG_UTILITY_REDIRECT_PATHS)[number];
export type NonTracingSvgUtilityPath =
  (typeof NON_TRACING_SVG_UTILITY_PATHS)[number];

export type NonTracingSvgUtilitySubfamily =
  | "favicon-ico-generation"
  | "resize-scale"
  | "dimensions-file-inspection"
  | "code-base64-serialization"
  | "svg-cleanup-normalization";

export type NonTracingSvgUtilityOperation =
  | "generate-favicon-package"
  | "resize-svg"
  | "inspect-svg-dimensions"
  | "inspect-svg-file-size"
  | "preview-svg"
  | "encode-svg"
  | "decode-svg"
  | "generate-embed-code"
  | "compare-inline-and-image-embeds"
  | "convert-svg-to-jsx"
  | "minify-svg"
  | "clean-svg"
  | "permanent-redirect";

export type NonTracingSvgUtilityInputPolicy =
  | "svg-png-jpg-webp-file"
  | "svg-file"
  | "svg-file-or-text"
  | "base64-or-data-uri-text"
  | "svg-text-or-file";

export type NonTracingSvgUtilityOutputPolicy =
  | "favicon-ico-png-zip"
  | "resized-svg"
  | "dimension-report-and-optional-svg"
  | "file-size-report-and-source-svg"
  | "unchanged-svg-preview"
  | "base64-data-uri-or-utf8-text"
  | "decoded-or-traced-svg"
  | "html-css-react-embed-text"
  | "inline-and-image-embed-text"
  | "react-jsx-text"
  | "minified-svg"
  | "cleaned-svg"
  | "redirect-response";

export type NonTracingSvgUtilityFilenamePolicy =
  | "favicon-package-names"
  | "resized-svg-basename"
  | "dimensions-report-basename"
  | "inspected-svg-basename"
  | "source-svg-basename"
  | "svg-base64-text-basename"
  | "base64-converted-svg-basename"
  | "embed-code-text-basename"
  | "inline-img-text-basename"
  | "jsx-component-basename"
  | "minified-svg-basename"
  | "cleaned-svg-basename"
  | "none";

export type NonTracingSvgUtilityDecision =
  | "retain-independently"
  | "safe-to-redirect";

export type NonTracingSvgUtilityRouteKey =
  | "favicon-svg"
  | "favicon-svg-ico"
  | "favicon-image"
  | "favicon-png"
  | "favicon-jpg"
  | "favicon-logo"
  | "favicon-png-ico"
  | "favicon-shopify-svg"
  | "favicon-shopify-logo"
  | "resize-base"
  | "resize-shopify"
  | "resize-etsy"
  | "resize-glowforge"
  | "resize-silhouette"
  | "resize-canva"
  | "resize-figma"
  | "inspect-dimensions"
  | "inspect-file-size"
  | "inspect-preview"
  | "serialize-base64-encode"
  | "serialize-base64-decode"
  | "serialize-embed-code"
  | "serialize-inline-vs-img"
  | "serialize-jsx"
  | "cleanup-minifier"
  | "cleanup-base"
  | "cleanup-glowforge"
  | "cleanup-silhouette"
  | "cleanup-figma"
  | "redirect-viewbox-editor"
  | "redirect-svg-resizer"
  | "redirect-resize-svg"
  | "redirect-scale-svg"
  | "redirect-svg-inspector"
  | "redirect-react-component"
  | "redirect-css-background"
  | "redirect-data-uri"
  | "redirect-inline-code"
  | "redirect-code-cleaner";

export type NonTracingSvgUtilityRouteSource =
  `app/routes/${string}.tsx`;

export type NonTracingSvgUtilityContentContract = Readonly<{
  contentOwner: NonTracingSvgUtilityRouteSource;
  metadataOwner: NonTracingSvgUtilityRouteSource;
  schemaOwner: NonTracingSvgUtilityRouteSource;
  breadcrumbOwner:
    | NonTracingSvgUtilityRouteSource
    | "app/client/components/navigation/OtherToolsLinks.tsx";
  routeSpecificCopyRemainsAtSource: true;
  allToolsOwner: "app/client/components/navigation/OtherToolsLinks.tsx";
  consolidation: Readonly<{
    reconsiderationPolicy: "requires-new-evidence";
  }>;
}>;

export type NonTracingSvgUtilityRouteContext = Readonly<{
  key: NonTracingSvgUtilityRouteKey;
  path: NonTracingSvgUtilityPath;
  routeSource: NonTracingSvgUtilityRouteSource;
  implementationOwner: NonTracingSvgUtilityRouteSource;
  subfamily: NonTracingSvgUtilitySubfamily;
  operation: NonTracingSvgUtilityOperation;
  inputPolicy: NonTracingSvgUtilityInputPolicy;
  outputPolicy: NonTracingSvgUtilityOutputPolicy;
  filenamePolicy: NonTracingSvgUtilityFilenamePolicy;
  canonicalPath: NonTracingSvgUtilityPath;
  redirectTo: NonTracingSvgUtilityRetainedPath | null;
  decision: NonTracingSvgUtilityDecision;
  contentContract: NonTracingSvgUtilityContentContract | null;
}>;

type RetainedDefinition = Readonly<{
  key: NonTracingSvgUtilityRouteKey;
  path: NonTracingSvgUtilityRetainedPath;
  routeSource: NonTracingSvgUtilityRouteSource;
  implementationOwner: NonTracingSvgUtilityRouteSource;
  subfamily: NonTracingSvgUtilitySubfamily;
  operation: Exclude<NonTracingSvgUtilityOperation, "permanent-redirect">;
  inputPolicy: NonTracingSvgUtilityInputPolicy;
  outputPolicy: Exclude<
    NonTracingSvgUtilityOutputPolicy,
    "redirect-response"
  >;
  filenamePolicy: Exclude<NonTracingSvgUtilityFilenamePolicy, "none">;
  schemaOwner?: NonTracingSvgUtilityRouteSource;
  breadcrumbOwner?:
    | NonTracingSvgUtilityRouteSource
    | "app/client/components/navigation/OtherToolsLinks.tsx";
}>;

function retained(
  definition: RetainedDefinition,
): NonTracingSvgUtilityRouteContext {
  return Object.freeze({
    ...definition,
    canonicalPath: definition.path,
    redirectTo: null,
    decision: "retain-independently" as const,
    contentContract: Object.freeze({
      contentOwner: definition.implementationOwner,
      metadataOwner: definition.routeSource,
      schemaOwner: definition.schemaOwner ?? definition.implementationOwner,
      breadcrumbOwner:
        definition.breadcrumbOwner ??
        "app/client/components/navigation/OtherToolsLinks.tsx",
      routeSpecificCopyRemainsAtSource: true,
      allToolsOwner:
        "app/client/components/navigation/OtherToolsLinks.tsx",
      consolidation: Object.freeze({
        reconsiderationPolicy: "requires-new-evidence" as const,
      }),
    }),
  });
}

function redirected(
  key: NonTracingSvgUtilityRouteKey,
  path: NonTracingSvgUtilityRedirectPath,
  destination: NonTracingSvgUtilityRetainedPath,
  subfamily: NonTracingSvgUtilitySubfamily,
): NonTracingSvgUtilityRouteContext {
  const routeSource =
    `app/routes/${path.slice(1)}.tsx` as NonTracingSvgUtilityRouteSource;
  const destinationContext = RETAINED_CONTEXTS.find(
    (context) => context.path === destination,
  );
  if (!destinationContext) {
    throw new Error(
      `Missing non-tracing SVG utility redirect destination: ${destination}`,
    );
  }
  return Object.freeze({
    key,
    path,
    routeSource,
    implementationOwner: routeSource,
    subfamily,
    operation: "permanent-redirect",
    inputPolicy: destinationContext.inputPolicy,
    outputPolicy: "redirect-response",
    filenamePolicy: "none",
    canonicalPath: destination,
    redirectTo: destination,
    decision: "safe-to-redirect",
    contentContract: null,
  });
}

const favicon = (
  key: NonTracingSvgUtilityRouteKey,
  path: NonTracingSvgUtilityRetainedPath,
  routeSource: NonTracingSvgUtilityRouteSource,
) =>
  retained({
    key,
    path,
    routeSource,
    implementationOwner: "app/routes/svg-to-favicon-generator.tsx",
    subfamily: "favicon-ico-generation",
    operation: "generate-favicon-package",
    inputPolicy: "svg-png-jpg-webp-file",
    outputPolicy: "favicon-ico-png-zip",
    filenamePolicy: "favicon-package-names",
  });

const resize = (
  key: NonTracingSvgUtilityRouteKey,
  path: NonTracingSvgUtilityRetainedPath,
  routeSource: NonTracingSvgUtilityRouteSource,
) =>
  retained({
    key,
    path,
    routeSource,
    implementationOwner: "app/routes/svg-resize-and-scale-editor.tsx",
    subfamily: "resize-scale",
    operation: "resize-svg",
    inputPolicy: "svg-file",
    outputPolicy: "resized-svg",
    filenamePolicy: "resized-svg-basename",
  });

const cleaner = (
  key: NonTracingSvgUtilityRouteKey,
  path: NonTracingSvgUtilityRetainedPath,
  routeSource: NonTracingSvgUtilityRouteSource,
) =>
  retained({
    key,
    path,
    routeSource,
    implementationOwner: "app/routes/svg-cleaner.tsx",
    subfamily: "svg-cleanup-normalization",
    operation: "clean-svg",
    inputPolicy: "svg-file",
    outputPolicy: "cleaned-svg",
    filenamePolicy: "cleaned-svg-basename",
  });

const RETAINED_CONTEXTS = Object.freeze([
  favicon(
    "favicon-svg",
    "/svg-to-favicon-generator",
    "app/routes/svg-to-favicon-generator.tsx",
  ),
  favicon(
    "favicon-svg-ico",
    "/svg-to-ico-converter",
    "app/routes/svg-to-ico-converter.tsx",
  ),
  favicon(
    "favicon-image",
    "/image-to-favicon-generator",
    "app/routes/image-to-favicon-generator.tsx",
  ),
  favicon(
    "favicon-png",
    "/png-to-favicon-generator",
    "app/routes/png-to-favicon-generator.tsx",
  ),
  favicon(
    "favicon-jpg",
    "/jpg-to-favicon-generator",
    "app/routes/jpg-to-favicon-generator.tsx",
  ),
  favicon(
    "favicon-logo",
    "/logo-to-favicon-generator",
    "app/routes/logo-to-favicon-generator.tsx",
  ),
  favicon(
    "favicon-png-ico",
    "/png-to-ico-converter",
    "app/routes/png-to-ico-converter.tsx",
  ),
  favicon(
    "favicon-shopify-svg",
    "/svg-to-favicon-for-shopify",
    "app/routes/svg-to-favicon-for-shopify.tsx",
  ),
  favicon(
    "favicon-shopify-logo",
    "/logo-to-favicon-for-shopify",
    "app/routes/logo-to-favicon-for-shopify.tsx",
  ),
  resize(
    "resize-base",
    "/svg-resize-and-scale-editor",
    "app/routes/svg-resize-and-scale-editor.tsx",
  ),
  resize(
    "resize-shopify",
    "/svg-resizer-for-shopify",
    "app/routes/svg-resizer-for-shopify.tsx",
  ),
  resize(
    "resize-etsy",
    "/svg-resizer-for-etsy",
    "app/routes/svg-resizer-for-etsy.tsx",
  ),
  resize(
    "resize-glowforge",
    "/svg-resizer-for-glowforge",
    "app/routes/svg-resizer-for-glowforge.tsx",
  ),
  resize(
    "resize-silhouette",
    "/svg-resizer-for-silhouette",
    "app/routes/svg-resizer-for-silhouette.tsx",
  ),
  resize(
    "resize-canva",
    "/svg-resizer-for-canva",
    "app/routes/svg-resizer-for-canva.tsx",
  ),
  resize(
    "resize-figma",
    "/svg-resizer-for-figma",
    "app/routes/svg-resizer-for-figma.tsx",
  ),
  retained({
    key: "inspect-dimensions",
    path: "/svg-dimensions-inspector",
    routeSource: "app/routes/svg-dimensions-inspector.tsx",
    implementationOwner: "app/routes/svg-dimensions-inspector.tsx",
    subfamily: "dimensions-file-inspection",
    operation: "inspect-svg-dimensions",
    inputPolicy: "svg-file",
    outputPolicy: "dimension-report-and-optional-svg",
    filenamePolicy: "dimensions-report-basename",
  }),
  retained({
    key: "inspect-file-size",
    path: "/svg-file-size-inspector",
    routeSource: "app/routes/svg-file-size-inspector.tsx",
    implementationOwner: "app/routes/svg-file-size-inspector.tsx",
    subfamily: "dimensions-file-inspection",
    operation: "inspect-svg-file-size",
    inputPolicy: "svg-file",
    outputPolicy: "file-size-report-and-source-svg",
    filenamePolicy: "inspected-svg-basename",
  }),
  retained({
    key: "inspect-preview",
    path: "/svg-preview-viewer",
    routeSource: "app/routes/svg-preview-viewer.tsx",
    implementationOwner: "app/routes/svg-preview-viewer.tsx",
    subfamily: "dimensions-file-inspection",
    operation: "preview-svg",
    inputPolicy: "svg-file-or-text",
    outputPolicy: "unchanged-svg-preview",
    filenamePolicy: "source-svg-basename",
  }),
  retained({
    key: "serialize-base64-encode",
    path: "/svg-to-base64",
    routeSource: "app/routes/svg-to-base64.tsx",
    implementationOwner: "app/routes/svg-to-base64.tsx",
    subfamily: "code-base64-serialization",
    operation: "encode-svg",
    inputPolicy: "svg-file-or-text",
    outputPolicy: "base64-data-uri-or-utf8-text",
    filenamePolicy: "svg-base64-text-basename",
  }),
  retained({
    key: "serialize-base64-decode",
    path: "/base64-to-svg",
    routeSource: "app/routes/base64-to-svg.tsx",
    implementationOwner: "app/routes/base64-to-svg.tsx",
    subfamily: "code-base64-serialization",
    operation: "decode-svg",
    inputPolicy: "base64-or-data-uri-text",
    outputPolicy: "decoded-or-traced-svg",
    filenamePolicy: "base64-converted-svg-basename",
  }),
  retained({
    key: "serialize-embed-code",
    path: "/svg-embed-code-generator",
    routeSource: "app/routes/svg-embed-code-generator.tsx",
    implementationOwner: "app/routes/svg-embed-code-generator.tsx",
    subfamily: "code-base64-serialization",
    operation: "generate-embed-code",
    inputPolicy: "svg-file-or-text",
    outputPolicy: "html-css-react-embed-text",
    filenamePolicy: "embed-code-text-basename",
  }),
  retained({
    key: "serialize-inline-vs-img",
    path: "/inline-svg-vs-img",
    routeSource: "app/routes/inline-svg-vs-img.tsx",
    implementationOwner: "app/routes/inline-svg-vs-img.tsx",
    subfamily: "code-base64-serialization",
    operation: "compare-inline-and-image-embeds",
    inputPolicy: "svg-file-or-text",
    outputPolicy: "inline-and-image-embed-text",
    filenamePolicy: "inline-img-text-basename",
  }),
  retained({
    key: "serialize-jsx",
    path: "/svg-to-jsx-converter",
    routeSource: "app/routes/svg-to-jsx-converter.tsx",
    implementationOwner: "app/routes/svg-to-jsx-converter.tsx",
    subfamily: "code-base64-serialization",
    operation: "convert-svg-to-jsx",
    inputPolicy: "svg-text-or-file",
    outputPolicy: "react-jsx-text",
    filenamePolicy: "jsx-component-basename",
  }),
  retained({
    key: "cleanup-minifier",
    path: "/svg-minifier",
    routeSource: "app/routes/svg-minifier.tsx",
    implementationOwner: "app/routes/svg-minifier.tsx",
    subfamily: "svg-cleanup-normalization",
    operation: "minify-svg",
    inputPolicy: "svg-file",
    outputPolicy: "minified-svg",
    filenamePolicy: "minified-svg-basename",
  }),
  cleaner(
    "cleanup-base",
    "/svg-cleaner",
    "app/routes/svg-cleaner.tsx",
  ),
  cleaner(
    "cleanup-glowforge",
    "/svg-cleaner-for-glowforge",
    "app/routes/svg-cleaner-for-glowforge.tsx",
  ),
  cleaner(
    "cleanup-silhouette",
    "/svg-cleaner-for-silhouette",
    "app/routes/svg-cleaner-for-silhouette.tsx",
  ),
  cleaner(
    "cleanup-figma",
    "/svg-cleaner-for-figma",
    "app/routes/svg-cleaner-for-figma.tsx",
  ),
] as const satisfies readonly NonTracingSvgUtilityRouteContext[]);

const REDIRECT_CONTEXTS = Object.freeze([
  redirected(
    "redirect-viewbox-editor",
    "/svg-viewbox-editor",
    "/svg-resize-and-scale-editor",
    "resize-scale",
  ),
  redirected(
    "redirect-svg-resizer",
    "/svg-resizer",
    "/svg-resize-and-scale-editor",
    "resize-scale",
  ),
  redirected(
    "redirect-resize-svg",
    "/resize-svg",
    "/svg-resize-and-scale-editor",
    "resize-scale",
  ),
  redirected(
    "redirect-scale-svg",
    "/scale-svg",
    "/svg-resize-and-scale-editor",
    "resize-scale",
  ),
  redirected(
    "redirect-svg-inspector",
    "/svg-inspector",
    "/svg-preview-viewer",
    "dimensions-file-inspection",
  ),
  redirected(
    "redirect-react-component",
    "/svg-to-react-component",
    "/svg-to-jsx-converter",
    "code-base64-serialization",
  ),
  redirected(
    "redirect-css-background",
    "/svg-to-css-background",
    "/svg-embed-code-generator",
    "code-base64-serialization",
  ),
  redirected(
    "redirect-data-uri",
    "/svg-to-data-uri-converter",
    "/svg-to-base64",
    "code-base64-serialization",
  ),
  redirected(
    "redirect-inline-code",
    "/svg-inline-code-generator",
    "/svg-embed-code-generator",
    "code-base64-serialization",
  ),
  redirected(
    "redirect-code-cleaner",
    "/svg-code-cleaner",
    "/svg-cleaner",
    "svg-cleanup-normalization",
  ),
] as const satisfies readonly NonTracingSvgUtilityRouteContext[]);

export const NON_TRACING_SVG_UTILITY_ROUTE_CONTEXTS = Object.freeze([
  ...RETAINED_CONTEXTS,
  ...REDIRECT_CONTEXTS,
]) as readonly NonTracingSvgUtilityRouteContext[];

export type NonTracingSvgUtilityRouteKeyForOwner<
  Owner extends NonTracingSvgUtilityRouteSource,
> = Owner extends "app/routes/svg-to-favicon-generator.tsx"
  ?
      | "favicon-svg"
      | "favicon-svg-ico"
      | "favicon-image"
      | "favicon-png"
      | "favicon-jpg"
      | "favicon-logo"
      | "favicon-png-ico"
      | "favicon-shopify-svg"
      | "favicon-shopify-logo"
  : Owner extends "app/routes/svg-resize-and-scale-editor.tsx"
    ?
        | "resize-base"
        | "resize-shopify"
        | "resize-etsy"
        | "resize-glowforge"
        | "resize-silhouette"
        | "resize-canva"
        | "resize-figma"
    : Owner extends "app/routes/svg-cleaner.tsx"
      ?
          | "cleanup-base"
          | "cleanup-glowforge"
          | "cleanup-silhouette"
          | "cleanup-figma"
      : NonTracingSvgUtilityRouteKey;

export function getNonTracingSvgUtilityRouteContextByKey(
  key: string,
): NonTracingSvgUtilityRouteContext {
  const context = NON_TRACING_SVG_UTILITY_ROUTE_CONTEXTS.find(
    (candidate) => candidate.key === key,
  );
  if (!context) {
    throw new Error(`Unknown non-tracing SVG utility route key: ${key}`);
  }
  return context;
}

export function getNonTracingSvgUtilityRouteContextByPath(
  path: string,
): NonTracingSvgUtilityRouteContext {
  const context = NON_TRACING_SVG_UTILITY_ROUTE_CONTEXTS.find(
    (candidate) => candidate.path === path,
  );
  if (!context) {
    throw new Error(`Unknown non-tracing SVG utility route path: ${path}`);
  }
  return context;
}

export function assertNonTracingSvgUtilityOperation(
  operation: string,
): NonTracingSvgUtilityOperation {
  const context = NON_TRACING_SVG_UTILITY_ROUTE_CONTEXTS.find(
    (candidate) => candidate.operation === operation,
  );
  if (!context) {
    throw new Error(
      `Unknown non-tracing SVG utility operation: ${operation}`,
    );
  }
  return context.operation;
}
