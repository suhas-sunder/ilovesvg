import type { Route } from "./+types/logo-to-favicon-for-shopify";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/logo-to-favicon-for-shopify");
}


export default Template;
