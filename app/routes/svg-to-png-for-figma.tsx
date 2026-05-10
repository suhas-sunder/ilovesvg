import type { Route } from "./+types/svg-to-png-for-figma";
import { createManifestMeta } from "~/data/routeManifest";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-to-png-for-figma");
}


export default Template;
