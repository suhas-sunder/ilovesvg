import type { Route } from "./+types/svg-to-favicon-for-shopify";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { FaviconRouteImplementation } from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/svg-to-favicon-for-shopify");
}

export default function SvgToFaviconForShopify() {
  return <FaviconRouteImplementation routeKey="favicon-shopify-svg" />;
}
