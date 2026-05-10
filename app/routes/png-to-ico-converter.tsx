import type { Route } from "./+types/png-to-ico-converter";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/png-to-ico-converter");
}


export default Template;
