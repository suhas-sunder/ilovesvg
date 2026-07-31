import type { Route } from "./+types/logo-to-favicon-for-shopify";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { FaviconRouteImplementation } from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/logo-to-favicon-for-shopify");
}

export default function LogoToFaviconForShopify() {
  return <FaviconRouteImplementation routeKey="favicon-shopify-logo" />;
}
