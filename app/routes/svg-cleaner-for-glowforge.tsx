import type { Route } from "./+types/svg-cleaner-for-glowforge";
import { createSvgPlatformToolsMeta } from "~/data/routeMeta/svgPlatformTools";
import { CleanerRouteImplementation } from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createSvgPlatformToolsMeta("/svg-cleaner-for-glowforge");
}

export default function SvgCleanerForGlowforge() {
  return <CleanerRouteImplementation routeKey="cleanup-glowforge" />;
}
