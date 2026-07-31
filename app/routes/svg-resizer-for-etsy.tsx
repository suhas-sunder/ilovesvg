import type { Route } from "./+types/svg-resizer-for-etsy";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import { ResizeRouteImplementation } from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-resizer-for-etsy");
}

export default function SvgResizerForEtsy() {
  return <ResizeRouteImplementation routeKey="resize-etsy" />;
}
