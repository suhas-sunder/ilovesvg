import type { Route } from "./+types/svg-to-png-for-printful";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceExportMeta("/svg-to-png-for-printful");
}


export default Template;
