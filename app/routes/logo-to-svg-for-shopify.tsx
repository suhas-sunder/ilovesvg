import type { Route } from "./+types/logo-to-svg-for-shopify";
import { createMarketplaceCraftMeta } from "~/data/routeMeta/marketplaceCraft";
import {
  action,
  loader,
  LogoToSvgRouteImplementation,
} from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceCraftMeta("/logo-to-svg-for-shopify");
}

export { action, loader };

export default function LogoToSvgForShopify(_: Route.ComponentProps) {
  return <LogoToSvgRouteImplementation routeKey="logo-shopify" />;
}
