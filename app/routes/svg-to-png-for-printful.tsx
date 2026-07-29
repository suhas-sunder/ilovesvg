import type { Route } from "./+types/svg-to-png-for-printful";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToPngForPrintful() {
  return <SvgToPngRouteImplementation routeKey="printful" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-printful",
  createMeta: createMarketplaceExportMeta,
  Component: SvgToPngForPrintful,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
