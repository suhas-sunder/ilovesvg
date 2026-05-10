import type { Route } from "./+types/svg-resizer-for-shopify";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-resizer-for-shopify");
}


export default Template;
