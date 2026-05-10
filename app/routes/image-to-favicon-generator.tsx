import type { Route } from "./+types/image-to-favicon-generator";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/image-to-favicon-generator");
}


export default Template;
