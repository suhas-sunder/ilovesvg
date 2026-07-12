export function syncOwnedCacheKeys(
  ownedKeys: Set<string>,
  nextKeys: Iterable<string>,
  ownerCounts: Map<string, number>,
  onUnowned: (key: string) => void,
): void {
  const next = new Set(nextKeys);

  for (const key of ownedKeys) {
    if (next.has(key)) continue;
    releaseOwnedCacheKey(key, ownerCounts, onUnowned);
  }

  for (const key of next) {
    if (ownedKeys.has(key)) continue;
    ownerCounts.set(key, (ownerCounts.get(key) ?? 0) + 1);
  }

  ownedKeys.clear();
  for (const key of next) ownedKeys.add(key);
}

export function releaseOwnedCacheKeys(
  ownedKeys: Set<string>,
  ownerCounts: Map<string, number>,
  onUnowned: (key: string) => void,
): void {
  for (const key of ownedKeys) {
    releaseOwnedCacheKey(key, ownerCounts, onUnowned);
  }
  ownedKeys.clear();
}

function releaseOwnedCacheKey(
  key: string,
  ownerCounts: Map<string, number>,
  onUnowned: (key: string) => void,
): void {
  const count = ownerCounts.get(key) ?? 0;
  if (count > 1) {
    ownerCounts.set(key, count - 1);
    return;
  }
  ownerCounts.delete(key);
  onUnowned(key);
}

export function runWithBestEffortCleanup<T>(
  work: () => T,
  cleanup: () => void,
): T {
  try {
    return work();
  } finally {
    try {
      cleanup();
    } catch {
      // Cleanup must not replace a conversion result or mask its original error.
    }
  }
}
