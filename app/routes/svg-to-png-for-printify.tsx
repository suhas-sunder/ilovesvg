import type { Route } from "./+types/svg-to-png-for-printify";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToPngForPrintify() {
  return <SvgToPngRouteImplementation routeKey="printify" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-printify",
  createMeta: createMarketplaceExportMeta,
  Component: SvgToPngForPrintify,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
