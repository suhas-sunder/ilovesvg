import type { Route } from "./+types/svg-to-jpg-for-etsy";
import { createManifestMeta } from "~/data/routeMeta";
import Template from "./svg-to-jpg-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/svg-to-jpg-for-etsy");
}


export default Template;
