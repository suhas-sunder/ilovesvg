import type { Route } from "./+types/svg-cleaner-for-silhouette";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import { CleanerRouteImplementation } from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-cleaner-for-silhouette");
}

export default function SvgCleanerForSilhouette() {
  return <CleanerRouteImplementation routeKey="cleanup-silhouette" />;
}
