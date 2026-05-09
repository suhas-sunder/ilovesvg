import type { TraceResult } from "~/shared/tracing/types";

export type BaseConversionCacheResult = TraceResult;

type ConversionCacheEntry = {
  key: string;
  result: BaseConversionCacheResult;
  bytes: number;
  lastUsedAt: number;
};

type ConversionCacheStats = {
  entries: number;
  bytes: number;
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
};

const DEFAULT_MAX_ENTRIES = 30;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_SINGLE_ENTRY_BYTES = 5 * 1024 * 1024;

const entries = new Map<string, ConversionCacheEntry>();
const stats: ConversionCacheStats = {
  entries: 0,
  bytes: 0,
  hits: 0,
  misses: 0,
  writes: 0,
  evictions: 0,
};

let maxEntries = DEFAULT_MAX_ENTRIES;
let maxBytes = DEFAULT_MAX_BYTES;
let maxSingleEntryBytes = DEFAULT_MAX_SINGLE_ENTRY_BYTES;
let totalBytes = 0;

export function lookupConversionCache(
  key: string | null | undefined,
): BaseConversionCacheResult | null {
  if (!key) return null;
  const entry = entries.get(key);
  if (!entry) {
    stats.misses += 1;
    return null;
  }

  entry.lastUsedAt = Date.now();
  entries.delete(key);
  entries.set(key, entry);
  stats.hits += 1;
  return cloneCacheResult(entry.result);
}

export function writeConversionCache(
  key: string | null | undefined,
  result: BaseConversionCacheResult | null | undefined,
): boolean {
  if (!key || !isCacheableTraceResult(result)) return false;
  const cloned = cloneCacheResult(result);
  const bytes = estimateResultBytes(cloned);
  if (bytes <= 0 || bytes > maxSingleEntryBytes || bytes > maxBytes) return false;

  const existing = entries.get(key);
  if (existing) {
    totalBytes = Math.max(0, totalBytes - existing.bytes);
    entries.delete(key);
  }

  entries.set(key, {
    key,
    result: cloned,
    bytes,
    lastUsedAt: Date.now(),
  });
  totalBytes += bytes;
  stats.writes += 1;
  evictIfNeeded();
  syncStats();
  return true;
}

export function invalidateConversionCache(key: string) {
  const existing = entries.get(key);
  if (!existing) return;
  totalBytes = Math.max(0, totalBytes - existing.bytes);
  entries.delete(key);
  syncStats();
}

export function clearConversionCache() {
  entries.clear();
  totalBytes = 0;
  stats.entries = 0;
  stats.bytes = 0;
  stats.hits = 0;
  stats.misses = 0;
  stats.writes = 0;
  stats.evictions = 0;
}

export function getConversionCacheStats(): ConversionCacheStats {
  syncStats();
  return { ...stats };
}

export function configureConversionCacheForTests(options: {
  maxEntries?: number;
  maxBytes?: number;
  maxSingleEntryBytes?: number;
}) {
  maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
  maxBytes = Math.max(1024, Math.floor(options.maxBytes ?? DEFAULT_MAX_BYTES));
  maxSingleEntryBytes = Math.max(
    1024,
    Math.floor(options.maxSingleEntryBytes ?? DEFAULT_MAX_SINGLE_ENTRY_BYTES),
  );
  evictIfNeeded();
  syncStats();
}

export function isCacheableTraceResult(
  result: BaseConversionCacheResult | null | undefined,
): result is BaseConversionCacheResult {
  if (!result || typeof result.svg !== "string" || !result.svg.trim()) {
    return false;
  }
  if (!/^<svg\b/i.test(result.svg.trim())) return false;
  if (!Number.isFinite(result.width) || result.width <= 0) return false;
  if (!Number.isFinite(result.height) || result.height <= 0) return false;
  return (
    result.engineUsed === "vtracer" ||
    result.engineUsed === "potrace" ||
    result.engineUsed === "centerline"
  );
}

function evictIfNeeded() {
  while (entries.size > maxEntries || totalBytes > maxBytes) {
    const first = entries.values().next().value as ConversionCacheEntry | undefined;
    if (!first) break;
    entries.delete(first.key);
    totalBytes = Math.max(0, totalBytes - first.bytes);
    stats.evictions += 1;
  }
  syncStats();
}

function syncStats() {
  stats.entries = entries.size;
  stats.bytes = totalBytes;
}

function estimateResultBytes(result: BaseConversionCacheResult): number {
  const svgBytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(result.svg).byteLength
      : result.svg.length * 2;
  const metadataBytes = JSON.stringify({
    layers: result.layers || [],
    warnings: result.warnings || [],
    timings: result.timings || {},
    diagnostics: result.diagnostics || {},
    width: result.width,
    height: result.height,
    engineUsed: result.engineUsed,
    sourceKind: result.sourceKind,
    layerBuildMode: result.layerBuildMode,
    requestedPaletteCount: result.requestedPaletteCount,
    actualPaletteCount: result.actualPaletteCount,
    outputDetectedColors: result.outputDetectedColors,
    pathCount: result.pathCount,
    svgBytes: result.svgBytes,
  }).length;
  return svgBytes + metadataBytes;
}

export function cloneCacheResult<T extends BaseConversionCacheResult>(result: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(result);
  }
  return JSON.parse(JSON.stringify(result)) as T;
}
