import type { Route } from "./+types/logo-to-favicon-generator";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { FaviconRouteImplementation } from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/logo-to-favicon-generator");
}

export default function LogoToFaviconGenerator() {
  return <FaviconRouteImplementation routeKey="favicon-logo" />;
}
