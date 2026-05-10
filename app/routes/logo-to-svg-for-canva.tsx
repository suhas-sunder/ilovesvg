import type { Route } from "./+types/logo-to-svg-for-canva";
import { createManifestMeta } from "~/data/routeManifest";
import Template, { action, loader } from "./logo-to-svg-converter";

export function meta({}: Route.MetaArgs) {
  return createManifestMeta("/logo-to-svg-for-canva");
}

export { action, loader };

export default Template;
