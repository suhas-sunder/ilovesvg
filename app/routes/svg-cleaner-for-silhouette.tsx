import type { Route } from "./+types/svg-cleaner-for-silhouette";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-cleaner-for-silhouette");
}


export default Template;
