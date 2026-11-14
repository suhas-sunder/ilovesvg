import { getSourceFingerprint } from "./sourceFingerprint";

export type OutputSourceSnapshot = {
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: number;
  sourcePreviewUrl?: string;
};

/** Keep the exact source in route-local history. Re-selecting the same bytes
 * is allowed, while a name collision never authorizes retracing old artwork. */
export async function matchesOutputSourceFile(
  original: File | undefined,
  active: File,
  isCurrent: () => boolean,
): Promise<boolean> {
  if (original === active) return true;
  if (!original || original.name !== active.name || original.size !== active.size) return false;
  try {
    const [before, after] = await Promise.all([
      getSourceFingerprint(original),
      getSourceFingerprint(active),
    ]);
    if (!isCurrent()) return false;
    if (before && after) return before.sha256 === after.sha256;
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < original.size; offset += chunkSize) {
      const [a, b] = await Promise.all([
        original.slice(offset, offset + chunkSize).arrayBuffer(),
        active.slice(offset, offset + chunkSize).arrayBuffer(),
      ]);
      if (!isCurrent()) return false;
      const current = new Uint8Array(b);
      if (!new Uint8Array(a).every((byte, index) => byte === current[index])) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function createOutputSourceSnapshot(
  file: File | null | undefined,
): OutputSourceSnapshot {
  if (!file || typeof URL === "undefined") return {};
  return {
    sourceFileName: file.name,
    sourceMimeType: file.type,
    sourceFileSize: file.size,
    sourcePreviewUrl: URL.createObjectURL(file),
  };
}

export function cleanupUnusedSourceSnapshots<T extends OutputSourceSnapshot>(
  before: ReadonlyArray<T>,
  after: ReadonlyArray<T>,
) {
  if (typeof URL === "undefined") return;
  const kept = new Set(
    after.map((item) => item.sourcePreviewUrl).filter(Boolean),
  );
  for (const item of before) {
    const url = item.sourcePreviewUrl;
    if (url?.startsWith("blob:") && !kept.has(url)) URL.revokeObjectURL(url);
  }
}

