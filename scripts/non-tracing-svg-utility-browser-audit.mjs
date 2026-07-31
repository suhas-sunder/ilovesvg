process.env.ROUTE_FAMILY_AUDIT_LABEL ||= "non-tracing-svg-utility-browser";
process.env.ROUTE_FAMILY_CONTEXT ||=
  "app/client/lib/converter/nonTracingSvgUtilityRouteContexts.ts";
process.env.ROUTE_FAMILY_PATH_TUPLE ||=
  "NON_TRACING_SVG_UTILITY_RETAINED_PATHS";
process.env.ROUTE_FAMILY_REPRESENTATIVES ||= [
  "/svg-to-favicon-generator",
  "/svg-to-ico-converter",
  "/svg-resize-and-scale-editor",
  "/svg-dimensions-inspector",
  "/svg-file-size-inspector",
  "/svg-to-base64",
  "/base64-to-svg",
  "/svg-embed-code-generator",
  "/svg-to-jsx-converter",
  "/svg-cleaner",
].join(",");
process.env.ROUTE_FAMILY_INPUT_OPTIONAL_ROUTES ||= "/base64-to-svg";
process.env.ROUTE_FAMILY_REDIRECTS ||= JSON.stringify([
  ["/svg-viewbox-editor", "/svg-resize-and-scale-editor"],
  ["/svg-resizer", "/svg-resize-and-scale-editor"],
  ["/resize-svg", "/svg-resize-and-scale-editor"],
  ["/scale-svg", "/svg-resize-and-scale-editor"],
  ["/svg-inspector", "/svg-preview-viewer"],
  ["/svg-to-react-component", "/svg-to-jsx-converter"],
  ["/svg-to-css-background", "/svg-embed-code-generator"],
  ["/svg-to-data-uri-converter", "/svg-to-base64"],
  ["/svg-inline-code-generator", "/svg-embed-code-generator"],
  ["/svg-code-cleaner", "/svg-cleaner"],
]);

await import("./raster-to-svg-browser-audit.mjs");
