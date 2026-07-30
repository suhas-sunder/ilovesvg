process.env.ROUTE_FAMILY_AUDIT_LABEL = "specialized-trace-browser";
process.env.ROUTE_FAMILY_CONTEXT =
  "app/client/lib/converter/specializedTraceRouteContexts.ts";
process.env.ROUTE_FAMILY_PATH_TUPLE = "SPECIALIZED_TRACE_ROUTE_PATHS";
process.env.ROUTE_FAMILY_REPRESENTATIVES = [
  "/image-to-svg-outline",
  "/line-art-to-svg-converter",
  "/sketch-to-svg-converter",
  "/drawing-to-svg-converter",
  "/black-and-white-image-to-svg-converter",
  "/logo-to-svg-converter",
  "/sticker-to-svg-converter",
  "/line-art-to-svg-for-cricut",
  "/sticker-to-svg-for-cricut",
].join(",");
process.env.ROUTE_FAMILY_REDIRECTS = JSON.stringify([
  ["/image-to-outline-converter", "/image-to-svg-outline"],
  [
    "/black-and-white-png-to-svg-converter",
    "/black-and-white-image-to-svg-converter",
  ],
]);

await import("./raster-to-svg-browser-audit.mjs");
