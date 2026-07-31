process.env.ROUTE_FAMILY_AUDIT_LABEL ||= "cricut-output-browser";
process.env.ROUTE_FAMILY_CONTEXT ||=
  "app/client/lib/converter/cricutOutputRouteContexts.ts";
process.env.ROUTE_FAMILY_PATH_TUPLE ||= "CRICUT_OUTPUT_ROUTE_PATHS";
process.env.ROUTE_FAMILY_REPRESENTATIVES ||= [
  "/layered-svg-for-cricut",
  "/image-to-layered-svg-for-cricut",
  "/png-to-layered-svg-for-cricut",
  "/jpg-to-layered-svg-for-cricut",
  "/logo-to-layered-svg-for-cricut",
  "/png-to-svg-for-cricut-print-then-cut",
  "/png-to-svg-for-cricut-stickers",
  "/png-to-svg-for-cricut-vinyl",
].join(",");
process.env.ROUTE_FAMILY_REDIRECTS ||= "[]";

await import("./raster-to-svg-browser-audit.mjs");
