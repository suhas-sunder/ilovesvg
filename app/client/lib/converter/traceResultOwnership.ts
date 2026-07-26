export type TraceResultOwnership = {
  generation: number;
  sequence: number;
  stamp: number;
  resultId: string;
};

export function createTraceResultOwnership({
  routeId,
  generation,
  sequence,
  stamp,
}: {
  routeId: string;
  generation: number;
  sequence: number;
  stamp: number;
}): TraceResultOwnership {
  return {
    generation,
    sequence,
    stamp,
    resultId: `${routeId}-${generation}-${sequence}-${stamp}`,
  };
}

export function shouldActivateTraceResult({
  ownership,
  currentGeneration,
  latestSubmittedSequence,
}: {
  ownership: TraceResultOwnership;
  currentGeneration: number;
  latestSubmittedSequence: number;
}) {
  return (
    ownership.generation === currentGeneration &&
    ownership.sequence === latestSubmittedSequence
  );
}

export function commitTraceResult<
  TItem extends { stamp: number; jobId?: string },
>({
  history,
  item,
  replaceStamp = null,
  limit = 10,
}: {
  history: readonly TItem[];
  item: TItem;
  replaceStamp?: number | null;
  limit?: number;
}): TItem[] {
  if (replaceStamp != null) {
    return history.map((existing) =>
      existing.stamp === replaceStamp ? item : existing,
    );
  }

  const duplicateIndex = history.findIndex(
    (existing) =>
      existing.stamp === item.stamp ||
      Boolean(item.jobId && existing.jobId === item.jobId),
  );
  const next =
    duplicateIndex >= 0
      ? history.map((existing, index) =>
          index === duplicateIndex ? item : existing,
        )
      : [item, ...history];

  return next
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        right.entry.stamp - left.entry.stamp || left.index - right.index,
    )
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => entry);
}

export function resolveActiveTraceResult<TItem extends { stamp: number }>(
  history: readonly TItem[],
  activeStamp: number | null,
): TItem | null {
  if (activeStamp != null) {
    const selected = history.find((item) => item.stamp === activeStamp);
    if (selected) return selected;
  }
  return history[0] ?? null;
}
