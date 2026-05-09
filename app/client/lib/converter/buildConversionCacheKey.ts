import type { NormalizedTraceSettings } from "~/shared/tracing/types";

import { CONVERSION_CACHE_VERSION } from "./conversionCacheVersion";
import {
  normalizeConversionRequestForCache,
  type NormalizedConversionCacheSettings,
} from "./normalizeConversionRequestForCache";
import {
  getSourceFingerprint,
  type SourceFingerprint,
} from "./sourceFingerprint";
import { stableSerialize } from "./stableSerialize";

type CacheKeyInput = {
  routeId: string;
  source: SourceFingerprint;
  settings: NormalizedTraceSettings & Record<string, unknown>;
  cacheVersion?: string;
};

type FileCacheKeyInput = {
  routeId: string;
  settings: NormalizedTraceSettings & Record<string, unknown>;
  dimensions?: {
    width?: number | null;
    height?: number | null;
  };
};

export function buildConversionCacheKey(input: CacheKeyInput): string {
  const normalized = normalizeConversionRequestForCache(input.settings);
  return stableSerialize({
    version: input.cacheVersion || CONVERSION_CACHE_VERSION,
    routeId: input.routeId,
    source: normalizeSourceFingerprint(input.source),
    settings: normalized,
  });
}

export async function buildConversionCacheKeyForFile(
  file: File,
  input: FileCacheKeyInput,
): Promise<{
  key: string;
  source: SourceFingerprint;
  settings: NormalizedConversionCacheSettings;
} | null> {
  const source = await getSourceFingerprint(file, input.dimensions);
  if (!source) return null;

  const settings = normalizeConversionRequestForCache(input.settings);
  const key = stableSerialize({
    version: CONVERSION_CACHE_VERSION,
    routeId: input.routeId,
    source: normalizeSourceFingerprint(source),
    settings,
  });
  return { key, source, settings };
}

function normalizeSourceFingerprint(source: SourceFingerprint) {
  return {
    sha256: source.sha256,
    size: source.size,
    mime: source.mime,
    width: source.width ?? null,
    height: source.height ?? null,
  };
}
