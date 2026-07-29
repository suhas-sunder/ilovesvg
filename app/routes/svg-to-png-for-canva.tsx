import type { Route } from "./+types/svg-to-png-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import { createTemplateWrapperRoute } from "./_shared/createTemplateWrapperRoute";
import { SvgToPngRouteImplementation } from "./svg-to-png-converter";

function SvgToPngForCanva() {
  return <SvgToPngRouteImplementation routeKey="canva" />;
}

const route = createTemplateWrapperRoute({
  path: "/svg-to-png-for-canva",
  createMeta: createCanvaFigmaMeta,
  Component: SvgToPngForCanva,
});

export function meta({}: Route.MetaArgs) {
  return route.meta();
}


export default route.Component;
