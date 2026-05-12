import type { Route } from "./+types/png-to-svg-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import Template, { action, loader } from "./png-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/png-to-svg-for-canva");
}

export { action, loader };

export default Template;
