import type { Route } from "./+types/svg-to-png-for-figma";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToPngForFigma() {
  return <SvgToPngRouteImplementation routeKey="figma" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-figma",
  createMeta: createCanvaFigmaMeta,
  Component: SvgToPngForFigma,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
