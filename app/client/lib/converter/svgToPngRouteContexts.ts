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

export type SvgToPngRouteContext = {
  key:
    | "base"
    | "shopify"
    | "etsy"
    | "printify"
    | "printful"
    | "sticker-printing"
    | "transparent-printing"
    | "canva"
    | "figma";
  path: SvgToPngRoutePath;
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
};

const SHARED_DEFAULTS: Readonly<SvgToPngSettings> = Object.freeze({
  width: 1024,
  height: 1024,
  lockAspect: true,
  dpiScale: 1,
  background: "transparent",
  bgColor: "#ffffff",
  antiAlias: true,
  fileName: "converted",
});

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
    | "canonicalPath"
    | "inputAccept"
    | "defaults"
    | "outputFilenameMode"
    | "breadcrumb"
    | "schema"
  >,
): SvgToPngRouteContext {
  return Object.freeze({
    ...value,
    canonicalPath: value.path,
    inputAccept: "image/svg+xml,.svg",
    defaults: SHARED_DEFAULTS,
    outputFilenameMode: "source-basename",
    breadcrumb: SHARED_BREADCRUMB,
    schema: SHARED_SCHEMA,
  });
}

export const SVG_TO_PNG_ROUTE_CONTEXTS = Object.freeze({
  "/svg-to-png-converter": defineContext({
    key: "base",
    path: "/svg-to-png-converter",
    h1: "SVG to PNG Converter",
    platformName: null,
    hasDedicatedInlineSeoCopy: false,
  }),
  "/svg-to-png-for-shopify": defineContext({
    key: "shopify",
    path: "/svg-to-png-for-shopify",
    h1: "SVG to PNG for Shopify",
    platformName: "Shopify",
    hasDedicatedInlineSeoCopy: false,
  }),
  "/svg-to-png-for-etsy": defineContext({
    key: "etsy",
    path: "/svg-to-png-for-etsy",
    h1: "SVG to PNG for Etsy",
    platformName: "Etsy",
    hasDedicatedInlineSeoCopy: false,
  }),
  "/svg-to-png-for-printify": defineContext({
    key: "printify",
    path: "/svg-to-png-for-printify",
    h1: "SVG to PNG for Printify",
    platformName: "Printify",
    hasDedicatedInlineSeoCopy: true,
  }),
  "/svg-to-png-for-printful": defineContext({
    key: "printful",
    path: "/svg-to-png-for-printful",
    h1: "SVG to PNG for Printful",
    platformName: "Printful",
    hasDedicatedInlineSeoCopy: true,
  }),
  "/sticker-to-png-for-printing": defineContext({
    key: "sticker-printing",
    path: "/sticker-to-png-for-printing",
    h1: "Sticker SVG to PNG for Printing",
    platformName: "Sticker printing",
    hasDedicatedInlineSeoCopy: false,
  }),
  "/svg-to-transparent-png-for-printing": defineContext({
    key: "transparent-printing",
    path: "/svg-to-transparent-png-for-printing",
    h1: "SVG to Transparent PNG for Printing",
    platformName: "Transparent printing",
    hasDedicatedInlineSeoCopy: false,
  }),
  "/svg-to-png-for-canva": defineContext({
    key: "canva",
    path: "/svg-to-png-for-canva",
    h1: "SVG to PNG for Canva",
    platformName: "Canva",
    hasDedicatedInlineSeoCopy: false,
  }),
  "/svg-to-png-for-figma": defineContext({
    key: "figma",
    path: "/svg-to-png-for-figma",
    h1: "SVG to PNG for Figma",
    platformName: "Figma",
    hasDedicatedInlineSeoCopy: false,
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
