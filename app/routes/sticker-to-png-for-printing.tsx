import type { Route } from "./+types/sticker-to-png-for-printing";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceExportMeta("/sticker-to-png-for-printing");
}


export default Template;
