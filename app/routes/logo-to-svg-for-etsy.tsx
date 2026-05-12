import type { Route } from "./+types/logo-to-svg-for-etsy";
import { createMarketplaceCraftMeta } from "~/data/routeMeta/marketplaceCraft";
import Template, { action, loader } from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceCraftMeta("/logo-to-svg-for-etsy");
}

export { action, loader };

export default Template;
