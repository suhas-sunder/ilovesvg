import type { Route } from "./+types/png-to-favicon-generator";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { FaviconRouteImplementation } from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/png-to-favicon-generator");
}

export default function PngToFaviconGenerator() {
  return <FaviconRouteImplementation routeKey="favicon-png" />;
}
