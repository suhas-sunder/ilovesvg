import type { Route } from "./+types/svg-to-png-for-etsy";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToPngForEtsy() {
  return <SvgToPngRouteImplementation routeKey="etsy" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-etsy",
  createMeta: createMarketplaceExportMeta,
  Component: SvgToPngForEtsy,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
