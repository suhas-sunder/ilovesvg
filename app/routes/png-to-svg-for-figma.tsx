import type { Route } from "./+types/png-to-svg-for-figma";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import {
  action,
  loader,
  PngToSvgRouteImplementation,
} from "./png-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/png-to-svg-for-figma");
}

export { action, loader };

export default function PngToSvgForFigma(_: Route.ComponentProps) {
  return <PngToSvgRouteImplementation routeKey="png-figma" />;
}
