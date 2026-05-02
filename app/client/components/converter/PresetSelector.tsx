import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import {
  getPresetIntensityBadge,
  getPresetIntensityLabel,
  isPresetBackendIntensity,
  type PresetBackendIntensity,
} from "~/client/lib/converter/presetIntensity";
import {
  createPresetSearchRecords,
  filterPresetSearchRecords,
  normalizeSearchText,
} from "~/client/lib/converter/presetSearch";

export type ConverterPresetProcessType = "client" | "server" | "hybrid";

export type ConverterPresetOption = {
  id: string;
  label: string;
  settings?: unknown;
  help?: string;
  description?: string;
  category?: string;
  processType?: ConverterPresetProcessType;
  processLabel?: string;
  backendIntensity?: PresetBackendIntensity;
  searchKeywords?: readonly string[];
};

const SPEED_FILTERS: Array<PresetBackendIntensity | "all"> = [
  "all",
  "lightning-fast",
  "insane-speed",
  "extreme-speed",
  "high-speed",
  "low-speed",
  "slow-speed",
];

export function PresetPicker<TPreset extends ConverterPresetOption>({
  presets,
  activePreset,
  applyPreset,
}: {
  presets: readonly TPreset[];
  activePreset: string | null;
  applyPreset: (preset: TPreset) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [speedFilter, setSpeedFilter] = React.useState<
    PresetBackendIntensity | "all"
  >("all");
  const searchInputId = React.useId();
  const visibleLimit = 2;
  const dedupedPresets = React.useMemo(
    () => sortPresetDisplayOrder(dedupePresets(presets)),
    [presets],
  );
  const presetSignature = React.useMemo(
    () => dedupedPresets.map((preset) => preset.id).join("|"),
    [dedupedPresets],
  );
  const searchRecords = React.useMemo(
    () => createPresetSearchRecords(dedupedPresets),
    [dedupedPresets],
  );
  const normalizedQuery = React.useMemo(() => normalizeSearchText(query), [query]);
  const filteredPresets = React.useMemo(
    () =>
      filterPresetSearchRecords({
        records: searchRecords,
        query: normalizedQuery,
        speed: speedFilter,
      }),
    [searchRecords, normalizedQuery, speedFilter],
  );
  const compactPresets = dedupedPresets.slice(0, visibleLimit);
  const showToggle = dedupedPresets.length > visibleLimit;
  const groupedPresets = React.useMemo(
    () => groupPresetsByCategory(filteredPresets),
    [filteredPresets],
  );
  const filtersActive = normalizedQuery.length > 0 || speedFilter !== "all";
  const speedFilterBadge =
    speedFilter === "all"
      ? null
      : getPresetIntensityBadge({ backendIntensity: speedFilter });
  const speedFilterLabel =
    speedFilter === "all" ? "All speeds" : getPresetIntensityLabel(speedFilter);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setSpeedFilter("all");
  }, []);

  const toggleExpanded = React.useCallback(() => {
    if (expanded) clearFilters();
    setExpanded((value) => !value);
  }, [clearFilters, expanded]);

  const handleSpeedFilterChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setSpeedFilter(isPresetBackendIntensity(value) ? value : "all");
    },
    [],
  );

  React.useEffect(() => {
    clearFilters();
  }, [clearFilters, presetSignature]);

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      <div
        className={[
          expanded
            ? "rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            : "",
        ].join(" ")}
      >
        {expanded ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <div className="space-y-2">
                <label className="sr-only" htmlFor={searchInputId}>
                  Search presets
                </label>
                <div className="relative min-w-0">
                  <input
                    id={searchInputId}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && query) {
                        event.preventDefault();
                        setQuery("");
                      }
                    }}
                    placeholder="Search presets..."
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-sky-200 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear preset search"
                      className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 cursor-pointer hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      <span aria-hidden="true">x</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`${searchInputId}-speed`}>
                    Filter presets by speed
                  </label>
                  <div
                    className={[
                      "relative inline-flex h-10 min-w-[10.75rem] max-w-full items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                      speedFilterBadge
                        ? speedFilterBadge.className
                        : "border-slate-200 bg-white text-slate-700",
                    ].join(" ")}
                    title="Speed tags estimate backend processing cost and do not change output."
                  >
                    <span className="mr-1.5 hidden text-[11px] font-bold uppercase tracking-wide opacity-70 sm:inline">
                      Speed
                    </span>
                    <select
                      id={`${searchInputId}-speed`}
                      value={speedFilter}
                      onChange={handleSpeedFilterChange}
                      aria-label="Filter presets by speed"
                      className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-xs font-bold outline-none"
                    >
                      {SPEED_FILTERS.map((speed) => (
                        <option key={speed} value={speed}>
                          {speed === "all"
                            ? "All speeds"
                            : getPresetIntensityLabel(speed)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                      <ChevronDownIcon open={false} />
                    </span>
                  </div>

                  <span
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-500"
                    aria-live="polite"
                  >
                    {filteredPresets.length} presets
                  </span>

                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 cursor-pointer transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      Clear filters
                    </button>
                  ) : (
                    <span className="sr-only">{speedFilterLabel}</span>
                  )}
                </div>
              </div>
            </div>

            <div
              className="max-h-[22rem] space-y-4 overflow-y-auto pr-1 sm:max-h-[24rem]"
              style={{ scrollbarWidth: "thin" }}
            >
              {groupedPresets.length > 0 ? (
                groupedPresets.map((group) => (
                  <div key={group.label}>
                    <div className="mb-1.5 flex items-center gap-2 px-0.5">
                      <div className="h-px flex-1 bg-slate-100" />
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {group.label}
                      </div>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.presets.map((preset, index) => (
                        <PresetButton
                          key={`${preset.id}-${index}`}
                          preset={preset}
                          active={activePreset === preset.id}
                          applyPreset={applyPreset}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
                  <div className="font-semibold text-slate-700">No presets found.</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Try clearing search or choosing All speeds.
                  </div>
                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {compactPresets.map((preset, index) => (
              <PresetButton
                key={`${preset.id}-${index}`}
                preset={preset}
                active={activePreset === preset.id}
                applyPreset={applyPreset}
              />
            ))}
          </div>
        )}
      </div>

      {showToggle && (
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="mt-2 w-full inline-flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
        >
          <span className="flex items-center justify-center text-sm font-medium">
            <Icons name="sliders" size={16} className="inline-block mr-1" />
            {expanded
              ? "Show fewer presets"
              : `Show ${dedupedPresets.length - visibleLimit} more presets`}
          </span>
          <ChevronDownIcon open={expanded} />
        </button>
      )}
    </div>
  );
}

function PresetButton<TPreset extends ConverterPresetOption>({
  preset,
  active,
  applyPreset,
}: {
  preset: TPreset;
  active: boolean;
  applyPreset: (preset: TPreset) => void;
}) {
  const intensityBadge = getPresetIntensityBadge(preset);
  const title = [
    preset.help || preset.description || preset.label,
    intensityBadge.title,
    "Speed tags estimate backend processing cost and do not change output.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={() => applyPreset(preset)}
      aria-pressed={active}
      aria-label={`${preset.label}. ${intensityBadge.label}.`}
      title={title}
      className={[
        "group flex min-h-[2.85rem] w-full items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer",
        "text-[13px] sm:text-sm leading-snug text-left font-semibold",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1",
        active
          ? "bg-sky-50 border-sky-300 text-sky-950 shadow-sm ring-1 ring-sky-100 hover:bg-sky-100"
          : "bg-white text-slate-700 border-slate-200 hover:border-sky-200 hover:bg-sky-50",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 shrink-0 rounded-full transition-colors",
          active ? "bg-sky-500" : "bg-slate-200 group-hover:bg-sky-300",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="min-w-0 flex-1 break-words">{preset.label}</span>
        <span
          className={[
            "shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            intensityBadge.className,
            active ? "shadow-sm" : "",
          ].join(" ")}
          aria-label={intensityBadge.title}
          title={intensityBadge.title}
        >
          {intensityBadge.label}
        </span>
      </span>
    </button>
  );
}

export function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={[
        "h-4 w-4 text-slate-500 transition-transform",
        open ? "rotate-180" : "rotate-0",
      ].join(" ")}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function dedupePresets<TPreset extends ConverterPresetOption>(
  presets: readonly TPreset[],
) {
  const seen = new Set<string>();
  const result: TPreset[] = [];

  for (const preset of presets) {
    const signature = [
      preset.id,
      preset.label,
      stablePresetSettingsSignature(preset.settings || {}),
    ].join("|");

    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(preset);
  }

  return result;
}

function sortPresetDisplayOrder<TPreset extends ConverterPresetOption>(
  presets: TPreset[],
) {
  return [...presets].sort(
    (left, right) => presetDisplayRank(left) - presetDisplayRank(right),
  );
}

function presetDisplayRank(preset: ConverterPresetOption) {
  if (preset.category === "layered") return 50;
  if (preset.category === "lineart") return 0;

  const settings = preset.settings as Record<string, unknown> | undefined;
  if (settings?.traceMode === "layered") return 50;
  if (preset.id.startsWith("line-")) return 0;
  if (preset.id.startsWith("photo-") || preset.id.includes("edge")) return 10;
  if (preset.id.startsWith("scan-")) return 20;
  if (preset.id.startsWith("logo-")) return 30;
  return 40;
}

function groupPresetsByCategory<TPreset extends ConverterPresetOption>(
  presets: readonly TPreset[],
) {
  const groups = new Map<string, TPreset[]>();
  for (const preset of presets) {
    const key = presetCategoryLabel(preset);
    const items = groups.get(key) || [];
    items.push(preset);
    groups.set(key, items);
  }
  return [...groups.entries()].map(([label, items]) => ({
    label,
    presets: items,
  }));
}

function presetCategoryLabel(preset: ConverterPresetOption) {
  switch (preset.category) {
    case "lineart":
      return "Lineart";
    case "photo-edge":
      return "Photo Edge";
    case "scan":
      return "Scan / Whiteboard";
    case "logo":
      return "Logo / Icon";
    case "diagram":
      return "Diagram / Cutting";
    case "layered":
      return "Layered Color";
    default:
      if (preset.id.startsWith("line-")) return "Lineart";
      if (preset.id.startsWith("photo-") || preset.id.includes("edge")) {
        return "Photo Edge";
      }
      if (preset.id.startsWith("scan-") || preset.id.startsWith("whiteboard-")) {
        return "Scan / Whiteboard";
      }
      if (preset.id.startsWith("logo-") || preset.id.startsWith("icon-")) {
        return "Logo / Icon";
      }
      if (preset.id.startsWith("layered-") || preset.id.includes("layered")) {
        return "Layered Color";
      }
      return "Other";
  }
}

function stablePresetSettingsSignature(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stablePresetSettingsSignature).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );

    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${key}:${stablePresetSettingsSignature(entryValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
