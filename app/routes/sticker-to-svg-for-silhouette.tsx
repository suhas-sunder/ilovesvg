import type { Route } from "./+types/sticker-to-svg-for-silhouette";
import { createMarketplaceCraftMeta } from "~/data/routeMeta/marketplaceCraft";
import {
  action,
  StickerToSvgRouteImplementation,
} from "./sticker-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createMarketplaceCraftMeta("/sticker-to-svg-for-silhouette");
}

export { action };

export default function StickerToSvgForSilhouette(_: Route.ComponentProps) {
  return <StickerToSvgRouteImplementation routeKey="sticker-silhouette" />;
}
