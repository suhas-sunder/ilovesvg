import type { Route } from "./+types/jpg-to-favicon-generator";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/jpg-to-favicon-generator");
}


export default Template;
