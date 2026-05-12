import type { Route } from "./+types/svg-to-ico-converter";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import Template from "./svg-to-favicon-generator";

const route = createTemplateWrapperRoute({
  path: "/svg-to-ico-converter",
  createMeta: createFaviconExportMeta,
  Component: Template,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
