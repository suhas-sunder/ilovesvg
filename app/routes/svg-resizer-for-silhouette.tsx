import type { Route } from "./+types/svg-resizer-for-silhouette";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-resizer-for-silhouette");
}


export default Template;
