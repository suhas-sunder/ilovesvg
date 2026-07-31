import type { Route } from "./+types/svg-resizer-for-canva";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import { ResizeRouteImplementation } from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-resizer-for-canva");
}

export default function SvgResizerForCanva() {
  return <ResizeRouteImplementation routeKey="resize-canva" />;
}
