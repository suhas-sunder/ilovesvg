import type { Route } from "./+types/svg-to-png-for-printify";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceExportMeta("/svg-to-png-for-printify");
}


export default Template;
