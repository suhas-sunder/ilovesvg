export type ConversionDiagnostics = {
  routeId?: string;
  mode?: string;
  presetId?: string;
  uploadBytes?: number;
  contentLength?: number;
  sourceMimeType?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  traceWidth?: number;
  traceHeight?: number;
  layerCount?: number;
  selectedColorRemovalCount?: number;
  finalSvgBytes?: number;
  pathCount?: number;
  warnings?: string[];
  timings: Record<string, number>;
};

type DiagnosticsContext = ConversionDiagnostics & {
  startedAt: number;
  activeTimers: Map<string, number>;
};

const DIAGNOSTICS_ENABLED =
  process.env.ILOVESVG_CONVERSION_DIAGNOSTICS === "1" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.ILOVESVG_CONVERSION_DIAGNOSTICS !== "0");

export function createConversionDiagnostics(
  initial: Partial<Omit<ConversionDiagnostics, "timings">> = {},
): DiagnosticsContext {
  return {
    ...initial,
    startedAt: nowMs(),
    activeTimers: new Map<string, number>(),
    timings: {},
    warnings: initial.warnings ? [...initial.warnings] : [],
  };
}

export function startTimer(
  diagnostics: DiagnosticsContext | undefined,
  label: string,
) {
  if (!diagnostics || !DIAGNOSTICS_ENABLED) return;
  diagnostics.activeTimers.set(label, nowMs());
}

export function endTimer(
  diagnostics: DiagnosticsContext | undefined,
  label: string,
) {
  if (!diagnostics || !DIAGNOSTICS_ENABLED) return;
  const startedAt = diagnostics.activeTimers.get(label);
  if (startedAt == null) return;
  diagnostics.activeTimers.delete(label);
  diagnostics.timings[label] = roundMs(nowMs() - startedAt);
}

export async function withTimer<T>(
  diagnostics: DiagnosticsContext | undefined,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  startTimer(diagnostics, label);
  try {
    return await fn();
  } finally {
    endTimer(diagnostics, label);
  }
}

export function addConversionWarning(
  diagnostics: DiagnosticsContext | undefined,
  warning: string,
) {
  if (!diagnostics) return;
  const message = String(warning || "").trim().slice(0, 160);
  if (!message) return;
  const warnings = diagnostics.warnings ?? [];
  if (!warnings.includes(message)) warnings.push(message);
  diagnostics.warnings = warnings.slice(0, 12);
}

export function finishConversionDiagnostics(
  diagnostics: DiagnosticsContext | undefined,
): ConversionDiagnostics | null {
  if (!diagnostics || !DIAGNOSTICS_ENABLED) return null;
  for (const label of Array.from(diagnostics.activeTimers.keys())) {
    endTimer(diagnostics, label);
  }
  diagnostics.timings.total = roundMs(nowMs() - diagnostics.startedAt);
  const { startedAt: _startedAt, activeTimers: _activeTimers, ...safe } = diagnostics;
  return safe;
}

export function maybeLogConversionDiagnostics(
  diagnostics: DiagnosticsContext | undefined,
) {
  const safe = finishConversionDiagnostics(diagnostics);
  if (!safe) return;
  const payload = sanitizeDiagnostics(safe);
  if (process.env.NODE_ENV !== "production") {
    console.info("[ilovesvg:conversion]", JSON.stringify(payload));
  }
}

function sanitizeDiagnostics(
  diagnostics: ConversionDiagnostics,
): ConversionDiagnostics {
  return {
    routeId: diagnostics.routeId?.slice(0, 80),
    mode: diagnostics.mode?.slice(0, 40),
    presetId: diagnostics.presetId?.slice(0, 80),
    uploadBytes: finiteNumber(diagnostics.uploadBytes),
    contentLength: finiteNumber(diagnostics.contentLength),
    sourceMimeType: diagnostics.sourceMimeType?.slice(0, 80),
    sourceWidth: finiteNumber(diagnostics.sourceWidth),
    sourceHeight: finiteNumber(diagnostics.sourceHeight),
    traceWidth: finiteNumber(diagnostics.traceWidth),
    traceHeight: finiteNumber(diagnostics.traceHeight),
    layerCount: finiteNumber(diagnostics.layerCount),
    selectedColorRemovalCount: finiteNumber(diagnostics.selectedColorRemovalCount),
    finalSvgBytes: finiteNumber(diagnostics.finalSvgBytes),
    pathCount: finiteNumber(diagnostics.pathCount),
    warnings: diagnostics.warnings?.slice(0, 12),
    timings: Object.fromEntries(
      Object.entries(diagnostics.timings || {})
        .slice(0, 40)
        .map(([key, value]) => [key.slice(0, 80), finiteNumber(value) ?? 0]),
    ),
  };
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function roundMs(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function finiteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
