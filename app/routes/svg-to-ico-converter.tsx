import type { Route } from "./+types/svg-to-ico-converter";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-to-ico-converter");
}


export default Template;
