import type { Route } from "./+types/svg-to-jpg-for-etsy";
import { createMarketplaceExportMeta } from "~/data/routeMeta/marketplaceExport";
import { SvgToJpgConverterImplementation } from "./svg-to-jpg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceExportMeta("/svg-to-jpg-for-etsy");
}


export default function SvgToJpgForEtsy(_: Route.ComponentProps) {
  return <SvgToJpgConverterImplementation routeKey="svg-jpg-etsy" />;
}
