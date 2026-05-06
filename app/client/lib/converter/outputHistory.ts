import {
  cleanupUnusedSourceSnapshots,
  type OutputSourceSnapshot,
} from "~/client/lib/converter/sourceSnapshots";

export type SourceBackedOutput = OutputSourceSnapshot & {
  stamp: number;
};

export function trimOutputHistory<TItem extends SourceBackedOutput>(
  candidates: TItem[],
  previous: TItem[],
  limit: number,
): TItem[] {
  const next = candidates.slice(0, limit);
  cleanupUnusedSourceSnapshots([...previous, ...candidates], next);
  return next;
}

export function mergeOutputSourceSnapshot<TItem extends SourceBackedOutput>(
  item: TItem,
  existing?: TItem | null,
): TItem {
  if (!existing) return item;
  return {
    ...item,
    sourceFileName: item.sourceFileName ?? existing.sourceFileName,
    sourceMimeType: item.sourceMimeType ?? existing.sourceMimeType,
    sourceFileSize: item.sourceFileSize ?? existing.sourceFileSize,
    sourcePreviewUrl: existing.sourcePreviewUrl ?? item.sourcePreviewUrl,
  };
}
