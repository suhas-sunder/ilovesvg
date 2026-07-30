import type { Route } from "./+types/logo-to-svg-for-etsy";
import { createMarketplaceCraftMeta } from "~/data/routeMeta/marketplaceCraft";
import {
  action,
  loader,
  LogoToSvgRouteImplementation,
} from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceCraftMeta("/logo-to-svg-for-etsy");
}

export { action, loader };

export default function LogoToSvgForEtsy(_: Route.ComponentProps) {
  return <LogoToSvgRouteImplementation routeKey="logo-etsy" />;
}
