import type { Route } from "./+types/png-to-svg-for-canva";
import { createManifestMeta } from "~/data/routeManifest";
import Template, { action, loader } from "./png-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/png-to-svg-for-canva");
}

export { action, loader };

export default Template;
