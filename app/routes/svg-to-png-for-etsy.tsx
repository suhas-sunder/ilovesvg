import type { Route } from "./+types/svg-to-png-for-etsy";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import Template from "./svg-to-png-converter";

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-etsy",
  createMeta: createMarketplaceExportMeta,
  Component: Template,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
