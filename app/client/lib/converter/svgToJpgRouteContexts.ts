export type SvgToJpgRouteKey = "svg-jpg-base" | "svg-jpg-etsy";

export type SvgToJpgPublicPath =
  | "/svg-to-jpg-converter"
  | "/svg-to-jpg-for-etsy";

export type SvgToJpgRouteContext = Readonly<{
  key: SvgToJpgRouteKey;
  publicPath: SvgToJpgPublicPath;
  operation: "svg-to-jpeg";
  contentOwner:
    | "routes/svg-to-jpg-converter"
    | "routes/svg-to-jpg-for-etsy";
  metadataOwner:
    | "routes/svg-to-jpg-converter"
    | "routes/svg-to-jpg-for-etsy";
  faqSchemaOwner: "routes/svg-to-jpg-converter" | null;
  outputFilenamePolicy: "source-basename-jpg";
}>;

const SVG_TO_JPG_ROUTE_CONTEXTS = {
  "svg-jpg-base": {
    key: "svg-jpg-base",
    publicPath: "/svg-to-jpg-converter",
    operation: "svg-to-jpeg",
    contentOwner: "routes/svg-to-jpg-converter",
    metadataOwner: "routes/svg-to-jpg-converter",
    faqSchemaOwner: "routes/svg-to-jpg-converter",
    outputFilenamePolicy: "source-basename-jpg",
  },
  "svg-jpg-etsy": {
    key: "svg-jpg-etsy",
    publicPath: "/svg-to-jpg-for-etsy",
    operation: "svg-to-jpeg",
    contentOwner: "routes/svg-to-jpg-for-etsy",
    metadataOwner: "routes/svg-to-jpg-for-etsy",
    faqSchemaOwner: null,
    outputFilenamePolicy: "source-basename-jpg",
  },
} as const satisfies Record<SvgToJpgRouteKey, SvgToJpgRouteContext>;

export function getSvgToJpgRouteContext(
  key: SvgToJpgRouteKey,
): SvgToJpgRouteContext {
  const context = SVG_TO_JPG_ROUTE_CONTEXTS[key];
  if (!context) {
    throw new Error(`Unknown SVG-to-JPG route key: ${String(key)}`);
  }
  return context;
}

export function getSvgToJpgRouteContextByPath(
  path: SvgToJpgPublicPath,
): SvgToJpgRouteContext {
  const context = Object.values(SVG_TO_JPG_ROUTE_CONTEXTS).find(
    (candidate) => candidate.publicPath === path,
  );
  if (!context) {
    throw new Error(`Unknown SVG-to-JPG public path: ${String(path)}`);
  }
  return context;
}
