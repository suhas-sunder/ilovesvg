import * as React from "react";
import {
  compressSvg,
  getSvgByteSize,
  type SvgCompressionLevel,
  type SvgCompressionResult,
} from "~/utils/svgCompression";

export type SvgExportCompressionLevel = SvgCompressionLevel;

type CachedExportResult = SvgCompressionResult & {
  sourceSvg: string;
};

export const DEFAULT_EXPORT_COMPRESSION_LEVEL: SvgExportCompressionLevel = "none";

export const EXPORT_COMPRESSION_LEVEL_OPTIONS: Array<{
  id: SvgExportCompressionLevel;
  label: string;
  description: string;
}> = [
  {
    id: "none",
    label: "None",
    description: "Keep current copy and download output exactly as-is.",
  },
  {
    id: "tiny",
    label: "Tiny",
    description: "Compress safely while preserving layer and editor metadata.",
  },
  {
    id: "tiniest",
    label: "Tiniest",
    description: "Stronger export compression for finished files.",
  },
];

const MAX_EXPORT_COMPRESSION_CACHE_ENTRIES = 48;

export function useSvgExportCompression(
  activeKeys: ReadonlyArray<string | number>,
) {
  const [levels, setLevels] = React.useState<
    Map<string, SvgExportCompressionLevel>
  >(() => new Map());
  const cacheRef = React.useRef(new Map<string, CachedExportResult>());
  const sourceCacheRef = React.useRef(new Map<string, CachedExportResult>());
  const activeKeySignature = activeKeys
    .map((key) => normalizeExportCompressionKey(key))
    .join("\u0001");

  React.useEffect(() => {
    const active = new Set(
      activeKeySignature
        ? activeKeySignature.split("\u0001").filter(Boolean)
        : [],
    );
    setLevels((current) => {
      let changed = false;
      const next = new Map(current);
      for (const key of next.keys()) {
        if (!active.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
    for (const key of cacheRef.current.keys()) {
      const [itemKey] = key.split("\u0001", 1);
      if (!active.has(itemKey)) cacheRef.current.delete(key);
    }
  }, [activeKeySignature]);

  const getLevel = React.useCallback(
    (key: string | number): SvgExportCompressionLevel =>
      levels.get(normalizeExportCompressionKey(key)) ??
      DEFAULT_EXPORT_COMPRESSION_LEVEL,
    [levels],
  );

  const setLevel = React.useCallback(
    (key: string | number, level: SvgExportCompressionLevel) => {
      const normalizedKey = normalizeExportCompressionKey(key);
      setLevels((current) => {
        const currentLevel =
          current.get(normalizedKey) ?? DEFAULT_EXPORT_COMPRESSION_LEVEL;
        if (currentLevel === level) return current;
        const next = new Map(current);
        if (level === DEFAULT_EXPORT_COMPRESSION_LEVEL) {
          next.delete(normalizedKey);
        } else {
          next.set(normalizedKey, level);
        }
        return next;
      });
    },
    [],
  );

  const getExportResult = React.useCallback(
    (key: string | number, svg: string): SvgCompressionResult => {
      const sourceSvg = String(svg || "");
      const level = getLevel(key);
      const normalizedKey = normalizeExportCompressionKey(key);
      const itemCacheKey = `${normalizedKey}\u0001${level}`;
      const cached = cacheRef.current.get(itemCacheKey);
      if (cached && cached.sourceSvg === sourceSvg) {
        return cached;
      }

      if (level === "none") {
        const bytes = getSvgByteSize(sourceSvg);
        const result: CachedExportResult = {
          svg: sourceSvg,
          sourceSvg,
          level,
          originalBytes: bytes,
          outputBytes: bytes,
          savedBytes: 0,
          savedPercent: 0,
          appliedTransforms: [],
          warnings: [],
        };
        cacheRef.current.set(itemCacheKey, result);
        pruneOldestCacheEntries(cacheRef.current);
        return result;
      }

      const sourceCacheKey = `${getSvgSourceSignature(sourceSvg)}\u0001${level}`;
      const sourceCached = sourceCacheRef.current.get(sourceCacheKey);
      if (sourceCached && sourceCached.sourceSvg === sourceSvg) {
        cacheRef.current.set(itemCacheKey, sourceCached);
        pruneOldestCacheEntries(cacheRef.current);
        return sourceCached;
      }

      const result = compressSvg(sourceSvg, { level });
      const cachedResult: CachedExportResult = { ...result, sourceSvg };
      cacheRef.current.set(itemCacheKey, cachedResult);
      sourceCacheRef.current.set(sourceCacheKey, cachedResult);
      pruneOldestCacheEntries(cacheRef.current);
      pruneOldestCacheEntries(sourceCacheRef.current);
      return cachedResult;
    },
    [getLevel],
  );

  const getExportSvg = React.useCallback(
    (key: string | number, svg: string): string => getExportResult(key, svg).svg,
    [getExportResult],
  );

  return {
    getLevel,
    setLevel,
    getExportResult,
    getExportSvg,
  };
}

export function ExportCompressionControls({
  id,
  level,
  onLevelChange,
  disabled = false,
}: {
  id: string;
  level: SvgExportCompressionLevel;
  onLevelChange: (level: SvgExportCompressionLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div
      data-export-compression-control="true"
      data-export-compression-level={level}
      className="grid min-w-0 gap-2"
    >
      <div className="min-w-0">
        <p className="m-0 text-[12px] font-bold uppercase tracking-wide text-slate-700">
          Export compression
        </p>
        <p className="m-0 mt-1 text-[12px] leading-5 text-slate-600">
          Affects Copy SVG and Download SVG only. Live preview and layer editing
          keep the full editable SVG.
        </p>
      </div>
      <div
        id={id}
        role="radiogroup"
        aria-label="Export compression"
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-3"
      >
        {EXPORT_COMPRESSION_LEVEL_OPTIONS.map((option) => {
          const selected = level === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-pressed={selected}
              data-export-compression-level-option={option.id}
              onClick={() => onLevelChange(option.id)}
              disabled={disabled}
              className={[
                "min-w-0 cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-sky-500 bg-sky-50 text-sky-950"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <span className="block text-[13px] font-bold">
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-600">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
      {level === "tiniest" ? (
        <p
          data-export-compression-warning="tiniest"
          className="m-0 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] leading-5 text-amber-900"
        >
          Tiniest is export-oriented. Stronger compression may reduce future
          editability; use Tiny when you want to keep layer/editor metadata.
        </p>
      ) : null}
    </div>
  );
}

export function ExportCompressionSettingsSection({
  id,
  level,
  onLevelChange,
  disabled = false,
}: {
  id: string;
  level: SvgExportCompressionLevel;
  onLevelChange: (level: SvgExportCompressionLevel) => void;
  disabled?: boolean;
}) {
  return (
    <section
      data-settings-section-tone="export"
      data-export-compression-section="true"
      className="min-w-0 max-w-full rounded-lg border border-l-4 border-slate-200 border-l-emerald-400 bg-white/95 p-2 shadow-sm shadow-slate-900/[0.03] sm:p-3"
    >
      <ExportCompressionControls
        id={id}
        level={level}
        onLevelChange={onLevelChange}
        disabled={disabled}
      />
    </section>
  );
}

function normalizeExportCompressionKey(key: string | number): string {
  return String(key);
}

function pruneOldestCacheEntries(
  cache: Map<string, CachedExportResult>,
): void {
  while (cache.size > MAX_EXPORT_COMPRESSION_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) return;
    cache.delete(firstKey);
  }
}

function getSvgSourceSignature(sourceSvg: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceSvg.length; index += 1) {
    hash ^= sourceSvg.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${sourceSvg.length}:${hash >>> 0}`;
}
