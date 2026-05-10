import type { Route } from "./+types/jpg-to-favicon-generator";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createFaviconExportMeta("/jpg-to-favicon-generator");
}


export default Template;
