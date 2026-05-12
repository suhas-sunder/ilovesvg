import type { Route } from "./+types/svg-resizer-for-figma";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-resizer-for-figma");
}


export default Template;
