import type { Route } from "./+types/jpg-to-svg-for-canva";
import { createManifestMeta } from "~/data/routeMeta";
import Template, { action, loader } from "./jpg-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/jpg-to-svg-for-canva");
}

export { action, loader };

export default Template;
