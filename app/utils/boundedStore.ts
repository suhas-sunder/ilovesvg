export const SHARED_RATE_LIMIT_STORE_MAX_ENTRIES = 20_000;
export const ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES = 5_000;
export const BATCH_SESSION_STORE_MAX_ENTRIES = 2_000;

// Entry-count bounds protect process memory without evicting active security state.
const DEFAULT_PRUNE_STRIDE = 256;
const MIN_CAPACITY_RETRY_MS = 1_000;

export type BoundedStoreAdmission<V> =
  | {
      admitted: true;
      value: V;
      existing: boolean;
      pruned: number;
    }
  | {
      admitted: false;
      retryAfterMs: number;
      pruned: number;
    };

export type BoundedStoreAdmissionOptions<K, V> = {
  store: Map<K, V>;
  key: K;
  now: number;
  maxEntries: number;
  create: () => V;
  isExpired: (value: V, now: number) => boolean;
  getExpiresAt: (value: V) => number;
  pruneStride?: number;
};

type ResetAtRateLimitWindowState = { count: number; resetAt: number };

type ResetAtRateLimitWindowDefinition<N extends string> = {
  name: N;
};

type CapacityHeaderDefinition = {
  limit: number;
  limitHeader: string;
  remainingHeader: string;
};

export function pruneExpiredEntries<K, V>(
  store: Map<K, V>,
  now: number,
  isExpired: (value: V, now: number) => boolean,
): number {
  let pruned = 0;
  for (const [key, value] of store) {
    if (!isExpired(value, now)) continue;
    store.delete(key);
    pruned += 1;
  }
  return pruned;
}

export function getOrCreateBoundedStoreEntry<K, V>(
  options: BoundedStoreAdmissionOptions<K, V>,
): BoundedStoreAdmission<V> {
  const {
    store,
    key,
    now,
    create,
    isExpired,
    getExpiresAt,
  } = options;
  const maxEntries = Math.floor(options.maxEntries);
  const pruneStride = Math.max(
    1,
    Math.floor(options.pruneStride ?? DEFAULT_PRUNE_STRIDE),
  );

  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError("Bounded store maxEntries must be a positive safe integer.");
  }

  if (store.has(key)) {
    return {
      admitted: true,
      value: store.get(key) as V,
      existing: true,
      pruned: 0,
    };
  }

  let pruned = 0;
  if (
    store.size >= maxEntries ||
    (store.size > 0 && store.size % pruneStride === 0)
  ) {
    pruned = pruneExpiredEntries(store, now, isExpired);
  }

  if (store.size >= maxEntries) {
    let earliestExpiry = Number.POSITIVE_INFINITY;
    for (const value of store.values()) {
      const expiresAt = getExpiresAt(value);
      if (Number.isFinite(expiresAt)) {
        earliestExpiry = Math.min(earliestExpiry, expiresAt);
      }
    }

    return {
      admitted: false,
      retryAfterMs: Number.isFinite(earliestExpiry)
        ? Math.max(MIN_CAPACITY_RETRY_MS, Math.ceil(earliestExpiry - now))
        : MIN_CAPACITY_RETRY_MS,
      pruned,
    };
  }

  const value = create();
  store.set(key, value);
  return { admitted: true, value, existing: false, pruned };
}

export function getOrCreateResetAtRateLimitEntry<N extends string>(
  store: Map<string, Record<N, ResetAtRateLimitWindowState>>,
  key: string,
  now: number,
  maxEntries: number,
  windows: ReadonlyArray<ResetAtRateLimitWindowDefinition<N>>,
  create: () => Record<N, ResetAtRateLimitWindowState>,
): BoundedStoreAdmission<Record<N, ResetAtRateLimitWindowState>> {
  return getOrCreateBoundedStoreEntry({
    store,
    key,
    now,
    maxEntries,
    create,
    isExpired: (record, at) =>
      windows.every((window) => at >= record[window.name].resetAt),
    getExpiresAt: (record) =>
      Math.max(...windows.map((window) => record[window.name].resetAt)),
  });
}

export function createRateLimitCapacityHeaders(
  windows: ReadonlyArray<CapacityHeaderDefinition>,
  retryAfterMs: number,
): Headers {
  const headers = new Headers({
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
  });
  for (const window of windows) {
    headers.set(window.limitHeader, String(window.limit));
    headers.set(window.remainingHeader, "0");
  }
  return headers;
}
