import type { Route } from "./+types/svg-to-png-for-shopify";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToPngForShopify() {
  return <SvgToPngRouteImplementation routeKey="shopify" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-shopify",
  createMeta: createMarketplaceExportMeta,
  Component: SvgToPngForShopify,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
