export type OutputSourceSnapshot = {
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: number;
  sourcePreviewUrl?: string;
};

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

