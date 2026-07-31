import type { Route } from "./+types/png-to-ico-converter";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { FaviconRouteImplementation } from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/png-to-ico-converter");
}

export default function PngToIcoConverter() {
  return <FaviconRouteImplementation routeKey="favicon-png-ico" />;
}
