import type { Route } from "./+types/svg-resizer-for-etsy";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-resizer-for-etsy");
}


export default Template;
