const PUBLIC_TRACE_METHOD_LABELS = new Map<string, string>([
  ["vtracer", "Detailed color trace"],
  ["centerline", "Centerline stroke trace"],
  ["potrace", "Clean shape trace"],
]);

const PUBLIC_TRACE_PATH_LABELS = new Map<string, string>([
  ["svg cleanup", "SVG cleanup"],
  ["centerline", "Centerline stroke trace"],
  ["centerline trace", "Centerline stroke trace"],
  ["centerline stroke trace", "Centerline stroke trace"],
  ["vtracer", "Detailed color trace"],
  ["detailed color trace", "Detailed color trace"],
  ["hybrid layered trace", "Detailed color trace"],
  ["potrace", "Clean shape trace"],
  ["server potrace", "Clean shape trace"],
  ["clean shape trace", "Clean shape trace"],
  ["hybrid trace", "Automatic trace"],
  ["automatic trace", "Automatic trace"],
]);

const PUBLIC_WARNING_TRANSLATIONS: ReadonlyArray<
  Readonly<{ pattern: RegExp; replacement: string }>
> = [
  {
    pattern: /\bserverVTracerFlatColor\b/gi,
    replacement: "detailed color tracing",
  },
  {
    pattern: /\bcompactVTracerCore\b/gi,
    replacement: "detailed color tracing",
  },
  {
    pattern: /\btrace-v2-kcaitech-potrace\b/gi,
    replacement: "clean shape tracing",
  },
  {
    pattern: /@kcaitech\/potrace-ts\b/gi,
    replacement: "clean shape tracing",
  },
  {
    pattern: /\bwasm_vtracer\b/gi,
    replacement: "detailed color tracing",
  },
  {
    pattern: /\braw-vtracer\b/gi,
    replacement: "detailed color tracing",
  },
  {
    pattern: /\bshared-potrace\b/gi,
    replacement: "clean shape tracing",
  },
  {
    pattern: /\bvtracer\b/gi,
    replacement: "detailed color tracing",
  },
  {
    pattern: /\bpotrace\b/gi,
    replacement: "clean shape tracing",
  },
  {
    pattern: /\bbackends\b/gi,
    replacement: "conversion services",
  },
  {
    pattern: /\bbackend\b/gi,
    replacement: "conversion service",
  },
  {
    pattern: /\bpipelines\b/gi,
    replacement: "conversion workflows",
  },
  {
    pattern: /\bpipeline\b/gi,
    replacement: "conversion workflow",
  },
  {
    pattern: /\bparity\b/gi,
    replacement: "output consistency",
  },
];

export const MAX_VISIBLE_PUBLIC_TRACE_WARNINGS = 3;

export function getPublicTraceMethodLabel(engineUsed: unknown): string {
  const normalized = normalizePublicTraceValue(engineUsed);
  return (
    PUBLIC_TRACE_METHOD_LABELS.get(normalized) ??
    "Trace method unavailable"
  );
}

export function getPublicTracePathLabel(pathLabel: unknown): string {
  const normalized = normalizePublicTraceValue(pathLabel);
  return (
    PUBLIC_TRACE_PATH_LABELS.get(normalized) ??
    "Trace method unavailable"
  );
}

export function getPublicTraceWarning(warning: unknown): string {
  const original = typeof warning === "string" ? warning.trim() : "";
  if (!original) return "";

  let translated = original;
  for (const translation of PUBLIC_WARNING_TRANSLATIONS) {
    translated = translated.replace(
      translation.pattern,
      translation.replacement,
    );
  }
  return translated;
}

export function getVisiblePublicTraceWarnings(
  warnings: ReadonlyArray<unknown>,
): string[] {
  return Array.from(
    new Set(warnings.map(getPublicTraceWarning).filter(Boolean)),
  ).slice(0, MAX_VISIBLE_PUBLIC_TRACE_WARNINGS);
}

function normalizePublicTraceValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
