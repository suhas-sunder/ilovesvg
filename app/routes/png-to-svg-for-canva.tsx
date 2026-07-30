import type { Route } from "./+types/png-to-svg-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import {
  action,
  loader,
  PngToSvgRouteImplementation,
} from "./png-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/png-to-svg-for-canva");
}

export { action, loader };

export default function PngToSvgForCanva(_: Route.ComponentProps) {
  return <PngToSvgRouteImplementation routeKey="png-canva" />;
}
