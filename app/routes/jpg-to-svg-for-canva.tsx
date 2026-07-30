import type { Route } from "./+types/jpg-to-svg-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import {
  action,
  JpgToSvgRouteImplementation,
  loader,
} from "./jpg-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/jpg-to-svg-for-canva");
}

export { action, loader };

export default function JpgToSvgForCanva(_: Route.ComponentProps) {
  return <JpgToSvgRouteImplementation routeKey="jpg-canva" />;
}
