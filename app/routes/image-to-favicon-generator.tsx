import type { Route } from "./+types/image-to-favicon-generator";
import { createFaviconExportMeta } from "~/data/routeMeta/faviconExport";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import Template from "./svg-to-favicon-generator";

const route = createTemplateWrapperRoute({
  path: "/image-to-favicon-generator",
  createMeta: createFaviconExportMeta,
  Component: Template,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
