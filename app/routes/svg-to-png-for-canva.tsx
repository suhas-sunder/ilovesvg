import type { Route } from "./+types/svg-to-png-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/svg-to-png-for-canva");
}


export default Template;
