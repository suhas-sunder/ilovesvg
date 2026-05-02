import * as React from "react";
import Icons from "~/client/assets/icons/Icons";

export type ConverterPresetOption = {
  id: string;
  label: string;
  settings?: unknown;
  help?: string;
  description?: string;
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
    () => dedupePresets(presets),
    [presets],
  );
  const visiblePresets = expanded
    ? dedupedPresets
    : dedupedPresets.slice(0, visibleLimit);
  const showToggle = dedupedPresets.length > visibleLimit;

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      <div className="grid gap-2 sm:grid-cols-2">
        {visiblePresets.map((preset, index) => {
          const isActive = activePreset === preset.id;
          const title = preset.help || preset.description || preset.label;

          return (
            <button
              key={`${preset.id}-${index}`}
              type="button"
              onClick={() => applyPreset(preset)}
              aria-pressed={isActive}
              aria-label={preset.label}
              title={title}
              className={[
                "px-3 py-2 rounded-md border transition-colors cursor-pointer",
                "text-[13px] sm:text-sm leading-snug text-center font-semibold",
                "break-words min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1",
                isActive
                  ? "bg-sky-200 border-sky-200 text-slate-900 hover:bg-sky-300"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50",
              ].join(" ")}
            >
              {preset.label}
            </button>
          );
        })}
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
