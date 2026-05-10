import type { Route } from "./+types/png-to-svg-for-figma";
import { createManifestMeta } from "~/data/routeMeta";
import Template, { action, loader } from "./png-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/png-to-svg-for-figma");
}

export { action, loader };

export default Template;
