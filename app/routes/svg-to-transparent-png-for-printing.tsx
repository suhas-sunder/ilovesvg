import type { Route } from "./+types/svg-to-transparent-png-for-printing";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceExportMeta("/svg-to-transparent-png-for-printing");
}


export default Template;
