import type { Route } from "./+types/svg-to-jpg-for-etsy";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import Template from "./svg-to-jpg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceExportMeta("/svg-to-jpg-for-etsy");
}


export default Template;
