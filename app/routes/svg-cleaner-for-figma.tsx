import type { Route } from "./+types/svg-cleaner-for-figma";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-cleaner";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-cleaner-for-figma");
}


export default Template;
