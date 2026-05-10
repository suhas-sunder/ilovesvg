import type { Route } from "./+types/svg-to-favicon-for-shopify";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-favicon-generator";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-to-favicon-for-shopify");
}


export default Template;
