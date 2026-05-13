export type OutputComplexityInput = {
  svg?: string;
  svgBytes?: number;
  pathCount?: number;
  layerCount?: number;
  traceMode?: string | null;
  routeId?: string | null;
  routeGroup?: string | null;
  precisionOutput?: boolean;
};

export type OutputComplexitySummary = {
  svgBytes: number;
  pathCount: number;
  layerCount: number;
  warnings: string[];
};

const SINGLE_SVG_WARNING_BYTES = 1_500_000;
const LAYERED_SVG_WARNING_BYTES = 2_500_000;
const SINGLE_PATH_WARNING_COUNT = 1_200;
const LAYERED_PATH_WARNING_COUNT = 4_500;
const CUT_PATH_WARNING_COUNT = 900;
const LAYER_WARNING_COUNT = 8;

export function analyzeOutputComplexity(
  input: OutputComplexityInput,
): OutputComplexitySummary {
  const svg = String(input.svg || "");
  const layered = isLayeredOutput(input);
  const cutLike = isCutFriendlyOutput(input);
  const svgBytes = readPositiveInteger(input.svgBytes) ?? byteLength(svg);
  const pathCount =
    readPositiveInteger(input.pathCount) ?? countPathElements(svg);
  const layerCount = readPositiveInteger(input.layerCount) ?? 0;
  const warnings: string[] = [];

  const svgWarningBytes = layered
    ? LAYERED_SVG_WARNING_BYTES
    : SINGLE_SVG_WARNING_BYTES;
  if (svgBytes >= svgWarningBytes) {
    warnings.push(
      `SVG output is large (${formatBytes(svgBytes)}). Preview, copy, download, or design-app import may be slow on some devices.`,
    );
  }

  const pathWarningCount = layered
    ? LAYERED_PATH_WARNING_COUNT
    : cutLike
      ? CUT_PATH_WARNING_COUNT
      : SINGLE_PATH_WARNING_COUNT;
  if (pathCount >= pathWarningCount) {
    warnings.push(
      cutLike
        ? `SVG output has ${pathCount.toLocaleString("en-US")} paths. Cricut or cutting software may be slow, so review the result before cutting.`
        : `SVG output has ${pathCount.toLocaleString("en-US")} paths. Editing and preview may be slow on dense images.`,
    );
  }

  if (layered && layerCount >= LAYER_WARNING_COUNT) {
    warnings.push(
      `Layered output has ${layerCount.toLocaleString("en-US")} layers. Review the layer list before importing into design or cutting software.`,
    );
  }

  return {
    svgBytes,
    pathCount,
    layerCount,
    warnings,
  };
}

export function getOutputComplexityWarnings(
  input: OutputComplexityInput,
): string[] {
  return analyzeOutputComplexity(input).warnings;
}

export function mergeOutputWarnings(
  existing: ReadonlyArray<string> | null | undefined,
  additional: ReadonlyArray<string> | null | undefined,
): string[] {
  const merged: string[] = [];
  for (const value of [...(existing || []), ...(additional || [])]) {
    const warning = String(value || "").trim();
    if (!warning || merged.includes(warning)) continue;
    merged.push(warning);
    if (merged.length >= 6) break;
  }
  return merged;
}

function isLayeredOutput(input: OutputComplexityInput) {
  return (
    String(input.traceMode || "").toLowerCase() === "layered" ||
    String(input.routeGroup || "").toLowerCase() === "layered" ||
    String(input.routeId || "").toLowerCase().includes("layered") ||
    Number(input.layerCount || 0) > 1
  );
}

function isCutFriendlyOutput(input: OutputComplexityInput) {
  if (input.precisionOutput) return true;
  const routeId = String(input.routeId || "").toLowerCase();
  const routeGroup = String(input.routeGroup || "").toLowerCase();
  return (
    routeGroup === "cricut" ||
    routeId.includes("cricut") ||
    routeId.includes("silhouette") ||
    routeId.includes("laser") ||
    routeId.includes("vinyl") ||
    routeId.includes("cut")
  );
}

function readPositiveInteger(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function countPathElements(svg: string) {
  return (String(svg || "").match(/<path\b/gi) || []).length;
}

function byteLength(value: string) {
  if (!value) return 0;
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024).toLocaleString("en-US")} KB`;
  }
  return `${Math.max(0, Math.round(bytes)).toLocaleString("en-US")} B`;
}
