import type { Route } from "./+types/svg-cleaner-for-glowforge";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import Template from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-cleaner-for-glowforge");
}


export default Template;
