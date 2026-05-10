import type { Route } from "./+types/logo-to-svg-for-canva";
import { createCanvaFigmaMeta } from "~/data/routeMeta/canvaFigma";
import Template, { action, loader } from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createCanvaFigmaMeta("/logo-to-svg-for-canva");
}

export { action, loader };

export default Template;
