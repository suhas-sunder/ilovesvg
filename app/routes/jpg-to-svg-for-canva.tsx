import type { Route } from "./+types/jpg-to-svg-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import Template, { action, loader } from "./jpg-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/jpg-to-svg-for-canva");
}

export { action, loader };

export default Template;
