import type { Route } from "./+types/svg-to-png-for-figma";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/svg-to-png-for-figma");
}


export default Template;
