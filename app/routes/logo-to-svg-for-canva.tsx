import type { Route } from "./+types/logo-to-svg-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import {
  action,
  loader,
  LogoToSvgRouteImplementation,
} from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/logo-to-svg-for-canva");
}

export { action, loader };

export default function LogoToSvgForCanva(_: Route.ComponentProps) {
  return <LogoToSvgRouteImplementation routeKey="logo-canva" />;
}
