import type { Route } from "./+types/svg-resizer-for-silhouette";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-resizer-for-silhouette");
}


export default Template;
