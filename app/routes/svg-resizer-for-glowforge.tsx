import type { Route } from "./+types/svg-resizer-for-glowforge";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-resize-and-scale-editor";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-resizer-for-glowforge");
}


export default Template;
