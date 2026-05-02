import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import {
  getPresetIntensityBadge,
  type PresetBackendIntensity,
} from "~/client/lib/converter/presetIntensity";

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
};

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
  const visibleLimit = 2;
  const dedupedPresets = React.useMemo(
    () => sortPresetDisplayOrder(dedupePresets(presets)),
    [presets],
  );
  const visiblePresets = expanded
    ? dedupedPresets
    : dedupedPresets.slice(0, visibleLimit);
  const showToggle = dedupedPresets.length > visibleLimit;
  const groupedPresets = React.useMemo(
    () => groupPresetsByCategory(visiblePresets),
    [visiblePresets],
  );

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      <div
        className={[
          expanded
            ? "max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
            : "",
        ].join(" ")}
      >
        {expanded ? (
          <div className="space-y-3">
            {groupedPresets.map((group) => (
              <div key={group.label}>
                <div className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {group.label}
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
            ))}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {visiblePresets.map((preset, index) => (
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
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-2 w-full inline-flex items-center justify-between px-3 py-2 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
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
        "px-3 py-2 rounded-md border transition-colors cursor-pointer",
        "text-[13px] sm:text-sm leading-snug text-center font-semibold",
        "break-words min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1",
        active
          ? "bg-sky-200 border-sky-200 text-slate-900 hover:bg-sky-300"
          : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50",
      ].join(" ")}
    >
      <span className="inline-flex w-full flex-wrap items-center justify-center gap-1.5">
        <span>{preset.label}</span>
        <span
          className={[
            "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
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
