import type { Route } from "./+types/svg-cleaner-for-silhouette";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import Template from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-cleaner-for-silhouette");
}


export default Template;
