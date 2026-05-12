import type { Route } from "./+types/svg-to-png-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import Template from "./svg-to-png-converter";

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-canva",
  createMeta: createCanvaFigmaMeta,
  Component: Template,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
