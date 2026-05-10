import type { Route } from "./+types/svg-to-png-for-canva";
import { createManifestMeta } from "~/data/routeManifest";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-to-png-for-canva");
}


export default Template;
