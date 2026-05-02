import { createRequire } from "node:module";
import {
  getPotrace,
  traceBitmapToSvg,
} from "./potraceCompat";

type SharpModule = typeof import("sharp");

let sharpModule: SharpModule | null = null;
let sharpConfigured = false;

const requireFromHere = createRequire(import.meta.url);

export async function getSharp(): Promise<SharpModule> {
  if (!sharpModule) {
    sharpModule = requireFromHere("sharp") as SharpModule;
  }

  if (!sharpConfigured) {
    try {
      (sharpModule as any).concurrency?.(1);
      (sharpModule as any).cache?.({ files: 0, memory: 48 });
    } catch {
      // Sharp global tuning is best-effort; conversion still works if unavailable.
    }
    sharpConfigured = true;
  }

  return sharpModule;
}

export { getPotrace, traceBitmapToSvg };
