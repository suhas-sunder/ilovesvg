import type { Route } from "./+types/png-to-ico-converter";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/png-to-ico-converter");
}


export default Template;
