import { createRequire } from "node:module";

type SharpModule = typeof import("sharp");

export const SHARP_CACHE_POLICY = Object.freeze({
  files: 0,
  items: 32,
  memory: 16,
});
export const SHARP_CONCURRENCY = 1;

let sharpModule: SharpModule | null = null;
let sharpConfigured = false;

const requireFromHere = createRequire(import.meta.url);

(
  globalThis as typeof globalThis & {
    __ilovesvg_sharp_runtime_snapshot_reader?: () => Record<string, number>;
  }
).__ilovesvg_sharp_runtime_snapshot_reader = readSharpRuntimeSnapshot;

export async function getSharp(): Promise<SharpModule> {
  if (!sharpModule) {
    sharpModule = requireFromHere("sharp") as SharpModule;
  }

  if (!sharpConfigured) {
    try {
      sharpModule.concurrency(SHARP_CONCURRENCY);
      sharpModule.cache(SHARP_CACHE_POLICY);
    } catch {
      // Preserve conversion availability on an unsupported Sharp runtime.
    } finally {
      sharpConfigured = true;
    }
  }

  return sharpModule;
}

export function readSharpRuntimeSnapshot(): Record<string, number> {
  if (!sharpModule || !sharpConfigured) {
    return {
      sharpLoaded: 0,
      sharpConcurrency: 0,
      sharpQueueLength: 0,
      sharpProcessCount: 0,
      sharpCacheMemoryCurrentMb: 0,
      sharpCacheMemoryHighMb: 0,
      sharpCacheMemoryMaxMb: 0,
      sharpCacheItemsCurrent: 0,
      sharpCacheItemsMax: 0,
      sharpCacheFilesCurrent: 0,
      sharpCacheFilesMax: 0,
    };
  }

  try {
    const cache = sharpModule.cache();
    const counters = sharpModule.counters();
    return {
      sharpLoaded: 1,
      sharpConcurrency: sharpModule.concurrency(),
      sharpQueueLength: counters.queue,
      sharpProcessCount: counters.process,
      sharpCacheMemoryCurrentMb: cache.memory.current,
      sharpCacheMemoryHighMb: cache.memory.high,
      sharpCacheMemoryMaxMb: cache.memory.max,
      sharpCacheItemsCurrent: cache.items.current,
      sharpCacheItemsMax: cache.items.max,
      sharpCacheFilesCurrent: cache.files.current,
      sharpCacheFilesMax: cache.files.max,
    };
  } catch {
    return {
      sharpLoaded: 1,
      sharpConcurrency: SHARP_CONCURRENCY,
      sharpQueueLength: 0,
      sharpProcessCount: 0,
      sharpCacheMemoryCurrentMb: 0,
      sharpCacheMemoryHighMb: 0,
      sharpCacheMemoryMaxMb: SHARP_CACHE_POLICY.memory,
      sharpCacheItemsCurrent: 0,
      sharpCacheItemsMax: SHARP_CACHE_POLICY.items,
      sharpCacheFilesCurrent: 0,
      sharpCacheFilesMax: SHARP_CACHE_POLICY.files,
    };
  }
}
