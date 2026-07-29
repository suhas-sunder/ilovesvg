import type { Route } from "./+types/svg-to-transparent-png-for-printing";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToTransparentPngForPrinting() {
  return <SvgToPngRouteImplementation routeKey="transparent-printing" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-transparent-png-for-printing",
  createMeta: createMarketplaceExportMeta,
  Component: SvgToTransparentPngForPrinting,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
