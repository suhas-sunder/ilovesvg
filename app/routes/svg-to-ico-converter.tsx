import type { Route } from "./+types/svg-to-ico-converter";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/svg-to-ico-converter");
}


export default Template;
