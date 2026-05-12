import type { Route } from "./+types/sticker-to-svg-for-silhouette";
import { createMarketplaceCraftMeta } from "~/data/routeMeta/marketplaceCraft";
import Template, { action } from "./sticker-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceCraftMeta("/sticker-to-svg-for-silhouette");
}

export { action };

export default Template;
