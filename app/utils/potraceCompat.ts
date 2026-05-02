type PotraceModule = typeof import("potrace");

let potraceModule: PotraceModule | null = null;
const TRACE_CACHE_TTL_MS = 10 * 60 * 1000;
const TRACE_CACHE_MAX_ITEMS = 32;
const TRACE_CACHE_MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const TRACE_CACHE_MAX_ITEM_BYTES = 2 * 1024 * 1024;

type TraceCacheEntry = {
  svg: string;
  bytes: number;
  expiresAt: number;
  lastUsedAt: number;
};

function getTraceCache(): Map<string, TraceCacheEntry> {
  const globalState = globalThis as typeof globalThis & {
    __ilovesvg_trace_cache?: Map<string, TraceCacheEntry>;
  };
  if (!globalState.__ilovesvg_trace_cache) {
    globalState.__ilovesvg_trace_cache = new Map<string, TraceCacheEntry>();
  }
  return globalState.__ilovesvg_trace_cache;
}

export async function getPotrace(): Promise<PotraceModule> {
  if (!potraceModule) {
    potraceModule = await import("potrace");
  }
  return potraceModule;
}

export async function traceBitmapToSvg(
  input: Buffer,
  options: Record<string, unknown>,
): Promise<string> {
  const cacheKey = createTraceCacheKey(input, options);
  const cached = readTraceCache(cacheKey);
  if (cached) return cached;

  const potrace = await getPotrace();
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;

  const svg = await new Promise<string>((resolve, reject) => {
    if (typeof traceFn === "function") {
      traceFn(input, options, (err: unknown, out: string) =>
        err ? reject(err) : resolve(out),
      );
      return;
    }

    if (PotraceClass) {
      const tracer = new PotraceClass(options);
      tracer.loadImage(input, (err: unknown) => {
        if (err) {
          reject(err);
          return;
        }

        tracer.setParameters(options);
        tracer.getSVG((svgError: unknown, out: string) =>
          svgError ? reject(svgError) : resolve(out),
        );
      });
      return;
    }

    reject(new Error("potrace API not found"));
  });

  writeTraceCache(cacheKey, svg);
  return svg;
}

function createTraceCacheKey(input: Buffer, options: Record<string, unknown>) {
  let hash = 2166136261;
  hash = updateHash(hash, "trace-v1");
  hash = updateHash(hash, stableStringify(options));

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input[i] ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return `${input.length}:${hash >>> 0}`;
}

function updateHash(hash: number, value: string) {
  let next = hash;
  for (let i = 0; i < value.length; i += 1) {
    next ^= value.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next;
}

function readTraceCache(key: string): string | null {
  const cache = getTraceCache();
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  entry.lastUsedAt = now;
  return entry.svg;
}

function writeTraceCache(key: string, svg: string) {
  const bytes = svg.length * 2;
  if (bytes <= 0 || bytes > TRACE_CACHE_MAX_ITEM_BYTES) return;

  const cache = getTraceCache();
  const now = Date.now();
  cache.set(key, {
    svg,
    bytes,
    expiresAt: now + TRACE_CACHE_TTL_MS,
    lastUsedAt: now,
  });
  pruneTraceCache(cache, now);
}

function pruneTraceCache(cache: Map<string, TraceCacheEntry>, now = Date.now()) {
  let totalBytes = 0;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
      continue;
    }
    totalBytes += entry.bytes;
  }

  if (cache.size <= TRACE_CACHE_MAX_ITEMS && totalBytes <= TRACE_CACHE_MAX_TOTAL_BYTES) {
    return;
  }

  const entries = Array.from(cache.entries()).sort(
    (a, b) => a[1].lastUsedAt - b[1].lastUsedAt,
  );
  for (const [key, entry] of entries) {
    if (cache.size <= TRACE_CACHE_MAX_ITEMS && totalBytes <= TRACE_CACHE_MAX_TOTAL_BYTES) {
      break;
    }
    cache.delete(key);
    totalBytes -= entry.bytes;
  }
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
