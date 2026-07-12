import { randomUUID } from "node:crypto";

export const MEMORY_DIAGNOSTIC_EVENT = "ilovesvg-memory-diagnostic";

const DEFAULT_SAMPLE_RATE = 0.1;
const MAX_ROUTE_FILTERS = 32;
const MAX_SAFE_TOKEN_LENGTH = 80;

export type MemoryDiagnosticCheckpoint =
  | "request-received-after-parse"
  | "gate-wait-start"
  | "gate-acquired"
  | "conversion-start"
  | "preprocessing-complete"
  | "tracing-complete"
  | "optimization-complete"
  | "output-created"
  | "response-ready"
  | "conversion-error"
  | "conversion-aborted"
  | "conversion-finally"
  | "gate-released";

export type MemoryDiagnosticErrorClass =
  | "aborted"
  | "busy"
  | "timeout"
  | "validation"
  | "conversion"
  | "unknown";

export type MemoryDiagnosticNumericMetadata = {
  inputBytes?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  processingWidth?: number;
  processingHeight?: number;
  layerCount?: number;
  outputBytes?: number;
  pathCount?: number;
  warningCount?: number;
  gateActive?: number;
  gateQueued?: number;
  gateCapacity?: number;
  gateQueueCapacity?: number;
  gateWaitMs?: number;
};

export type MemoryDiagnosticCheckpointMetadata =
  MemoryDiagnosticNumericMetadata & {
    errorClass?: MemoryDiagnosticErrorClass;
  };

export type MemoryDiagnosticJobMetadata = MemoryDiagnosticNumericMetadata & {
  routeId: string;
  conversionFamily: string;
  conversionMode?: string;
  presetId?: string;
};

export type MemoryDiagnosticJob = {
  readonly correlationId: string;
  checkpoint: (
    checkpoint: MemoryDiagnosticCheckpoint,
    metadata?: MemoryDiagnosticCheckpointMetadata,
  ) => void;
  finish: (metadata?: MemoryDiagnosticCheckpointMetadata) => void;
};

export type MemoryDiagnosticsConfig = Readonly<{
  enabled: boolean;
  sampleRate: number;
  routeFilters: readonly string[];
}>;

type MemoryUsageSnapshot = {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers?: number;
};

type RuntimeOptions = {
  config: MemoryDiagnosticsConfig;
  logLine: (line: string) => void;
  memoryUsage: () => MemoryUsageSnapshot;
  now: () => number;
  random: () => number;
  createCorrelationId: () => string;
  storeSnapshot: () => Record<string, number>;
};

export type MemoryDiagnosticRuntime = {
  createJob: (metadata: MemoryDiagnosticJobMetadata) => MemoryDiagnosticJob | null;
};

export function resolveMemoryDiagnosticsConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MemoryDiagnosticsConfig {
  const enabled = env.ILOVESVG_MEMORY_DIAGNOSTICS === "1";
  const configuredSampleRate = Number(
    env.ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE,
  );
  const sampleRate =
    env.ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE == null ||
    !Number.isFinite(configuredSampleRate) ||
    configuredSampleRate < 0 ||
    configuredSampleRate > 1
      ? DEFAULT_SAMPLE_RATE
      : configuredSampleRate;
  const routeFilters = String(
    env.ILOVESVG_MEMORY_DIAGNOSTICS_ROUTES || "",
  )
    .split(",")
    .map(sanitizeToken)
    .filter(Boolean)
    .slice(0, MAX_ROUTE_FILTERS);

  return Object.freeze({
    enabled,
    sampleRate,
    routeFilters: Object.freeze(routeFilters),
  });
}

export function createMemoryDiagnosticRuntime(
  options: RuntimeOptions,
): MemoryDiagnosticRuntime {
  return Object.freeze({
    createJob(metadata) {
      if (!options.config.enabled) return null;

      const routeId = sanitizeToken(metadata.routeId) || "unknown-route";
      const conversionFamily =
        sanitizeToken(metadata.conversionFamily) || "unknown-family";
      if (
        options.config.routeFilters.length > 0 &&
        !options.config.routeFilters.includes(routeId) &&
        !options.config.routeFilters.includes(conversionFamily)
      ) {
        return null;
      }
      if (
        options.config.sampleRate <= 0 ||
        (options.config.sampleRate < 1 && options.random() >= options.config.sampleRate)
      ) {
        return null;
      }

      const startedAt = options.now();
      const correlationId = sanitizeToken(options.createCorrelationId()) || randomUUID();
      const baseMetadata = sanitizeNumericMetadata(metadata);
      const conversionMode = sanitizeOptionalToken(metadata.conversionMode);
      const presetId = sanitizeOptionalToken(metadata.presetId);
      let finished = false;

      const emit = (
        checkpoint: MemoryDiagnosticCheckpoint,
        checkpointMetadata: MemoryDiagnosticCheckpointMetadata = {},
      ) => {
        if (finished) return;
        try {
          const now = options.now();
          const memory = sanitizeMemoryUsage(options.memoryUsage());
          const event = {
            event: MEMORY_DIAGNOSTIC_EVENT,
            timestamp: new Date(now).toISOString(),
            checkpoint,
            correlationId,
            routeId,
            conversionFamily,
            ...(conversionMode ? { conversionMode } : {}),
            ...(presetId ? { presetId } : {}),
            elapsedMs: nonNegativeNumber(now - startedAt),
            ...baseMetadata,
            ...sanitizeNumericMetadata(checkpointMetadata),
            ...(checkpointMetadata.errorClass
              ? { errorClass: checkpointMetadata.errorClass }
              : {}),
            ...memory,
            ...sanitizeStoreSnapshot(options.storeSnapshot()),
          };
          options.logLine(JSON.stringify(event));
        } catch {
          // Diagnostics are best effort and must never affect conversion.
        }
      };

      return Object.freeze({
        correlationId,
        checkpoint(checkpoint, checkpointMetadata) {
          emit(checkpoint, checkpointMetadata);
        },
        finish(checkpointMetadata) {
          if (finished) return;
          emit("conversion-finally", checkpointMetadata);
          finished = true;
        },
      });
    },
  });
}

export function readMemoryDiagnosticStoreCounts(
  globalObject: Record<string, unknown> = globalThis as unknown as Record<
    string,
    unknown
  >,
): Record<string, number> {
  return {
    backendRateLimitStoreEntries: readStoreSize(
      globalObject.__ilovesvg_backend_rate_limits,
    ),
    actionRateLimitStoreEntries: readStoreSize(
      globalObject.__ilovesvg_action_rate_limits,
    ),
    pageRateLimitStoreEntries: readStoreSize(
      globalObject.__iheartsvg_page_rate_limits,
    ),
    drawingRateLimitStoreEntries: readStoreSize(
      globalObject.__drawing_to_svg_for_cricut_action_rate_limits,
    ),
    emojiRateLimitStoreEntries: readStoreSize(
      globalObject.__ilovesvg_emoji_converter_rate_limits,
    ),
    layeredRateLimitStoreEntries: readStoreSize(
      globalObject.__ilovesvg_jpg_layer_action_rate_limits,
    ),
    batchSessionStoreEntries: readStoreSize(
      globalObject.__ilovesvg_batch_sessions,
    ),
    potraceCacheEntries: readStoreSize(globalObject.__ilovesvg_trace_cache),
    twemojiCacheEntries: readStoreSize(globalObject.__twemoji_cache),
  };
}

export function classifyMemoryDiagnosticError(
  error: unknown,
): MemoryDiagnosticErrorClass {
  const candidate = error as { code?: unknown; name?: unknown } | null;
  const code = String(candidate?.code || "").toUpperCase();
  const name = String(candidate?.name || "").toLowerCase();
  if (code === "BUSY") return "busy";
  if (code.includes("TIMEOUT")) return "timeout";
  if (name === "aborterror" || code.includes("ABORT")) return "aborted";
  if (code.startsWith("INVALID_") || code.includes("VALIDATION")) {
    return "validation";
  }
  if (error instanceof Error) return "conversion";
  return "unknown";
}

const productionRuntime = createMemoryDiagnosticRuntime({
  config: resolveMemoryDiagnosticsConfig(),
  logLine: (line) => console.info(line),
  memoryUsage: () => process.memoryUsage(),
  now: () => Date.now(),
  random: () => Math.random(),
  createCorrelationId: () => randomUUID(),
  storeSnapshot: () => readMemoryDiagnosticStoreCounts(),
});

export function createMemoryDiagnosticJob(
  metadata: MemoryDiagnosticJobMetadata,
): MemoryDiagnosticJob | null {
  try {
    return productionRuntime.createJob(metadata);
  } catch {
    // Job creation is best effort just like checkpoint logging.
    return null;
  }
}

function sanitizeToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SAFE_TOKEN_LENGTH);
}

function sanitizeOptionalToken(value: unknown): string | undefined {
  const token = sanitizeToken(value);
  return token || undefined;
}

function sanitizeNumericMetadata(
  metadata: MemoryDiagnosticNumericMetadata,
): MemoryDiagnosticNumericMetadata {
  const safe: MemoryDiagnosticNumericMetadata = {};
  for (const key of NUMERIC_METADATA_KEYS) {
    const value = metadata[key];
    if (value == null) continue;
    safe[key] = nonNegativeNumber(value);
  }
  return safe;
}

const NUMERIC_METADATA_KEYS: ReadonlyArray<
  keyof MemoryDiagnosticNumericMetadata
> = [
  "inputBytes",
  "sourceWidth",
  "sourceHeight",
  "processingWidth",
  "processingHeight",
  "layerCount",
  "outputBytes",
  "pathCount",
  "warningCount",
  "gateActive",
  "gateQueued",
  "gateCapacity",
  "gateQueueCapacity",
  "gateWaitMs",
];

function sanitizeMemoryUsage(memory: MemoryUsageSnapshot) {
  const rss = nonNegativeNumber(memory.rss);
  const heapTotal = nonNegativeNumber(memory.heapTotal);
  const external = nonNegativeNumber(memory.external);
  return {
    rssBytes: rss,
    heapTotalBytes: heapTotal,
    heapUsedBytes: nonNegativeNumber(memory.heapUsed),
    externalBytes: external,
    arrayBufferBytes: nonNegativeNumber(memory.arrayBuffers ?? 0),
    unclassifiedProcessBytes: Math.max(0, rss - heapTotal - external),
  };
}

function sanitizeStoreSnapshot(snapshot: Record<string, number>) {
  const safe: Record<string, number> = {};
  for (const [key, value] of Object.entries(snapshot).slice(0, 16)) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
    if (!safeKey) continue;
    safe[safeKey] = nonNegativeNumber(value);
  }
  return safe;
}

function readStoreSize(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const size = (value as { size?: unknown }).size;
  return typeof size === "number" ? nonNegativeNumber(size) : 0;
}

function nonNegativeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value)));
}
