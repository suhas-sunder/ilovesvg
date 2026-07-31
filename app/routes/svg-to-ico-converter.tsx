import type { Route } from "./+types/svg-to-ico-converter";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { FaviconRouteImplementation } from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/svg-to-ico-converter");
}

export default function SvgToIcoConverter() {
  return <FaviconRouteImplementation routeKey="favicon-svg-ico" />;
}
