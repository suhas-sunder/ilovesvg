import type { Route } from "./+types/svg-to-png-for-printify";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-png-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-to-png-for-printify");
}


export default Template;
