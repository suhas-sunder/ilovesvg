import type { Route } from "./+types/svg-cleaner-for-figma";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import { CleanerRouteImplementation } from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-cleaner-for-figma");
}

export default function SvgCleanerForFigma() {
  return <CleanerRouteImplementation routeKey="cleanup-figma" />;
}
