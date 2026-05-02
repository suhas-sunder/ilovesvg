import {
  getPresetIntensityBadge,
  type PresetBackendIntensity,
} from "~/client/lib/converter/presetIntensity";

export type SearchablePreset = {
  id: string;
  label: string;
  category?: string;
  description?: string;
  help?: string;
  searchKeywords?: readonly string[];
  backendIntensity?: PresetBackendIntensity;
  settings?: unknown;
};

export type PresetSearchRecord<TPreset extends SearchablePreset> = {
  preset: TPreset;
  searchableText: string;
  backendIntensity: PresetBackendIntensity;
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  lineart: ["line", "lines", "drawing", "sketch", "outline"],
  "photo-edge": ["photo", "edge", "outline", "contour", "portrait"],
  scan: ["scan", "whiteboard", "paper", "document", "notebook", "marker"],
  logo: ["logo", "icon", "mark", "brand", "transparent"],
  diagram: ["diagram", "technical", "stencil", "stamp", "map", "laser"],
  layered: ["layer", "layers", "layered", "color", "poster", "vinyl"],
};

const LABEL_ALIASES: Array<[RegExp, string[]]> = [
  [/\bcricut\b/i, ["cut", "cutting", "vinyl", "sticker", "craft"]],
  [/\bvinyl\b/i, ["cricut", "cut", "decal", "htv"]],
  [/\bsticker\b/i, ["cricut", "outline", "print then cut", "border"]],
  [/\blaser\b/i, ["cut", "cutting", "thin cut"]],
  [/\blogo\b/i, ["icon", "mark", "brand"]],
  [/\bicon\b/i, ["logo", "app mark", "ui"]],
  [/\bline/i, ["lineart", "drawing", "sketch", "outline"]],
  [/\bsketch\b/i, ["drawing", "pencil", "line"]],
  [/\bdrawing\b/i, ["sketch", "ink", "line"]],
  [/\bphoto\b/i, ["edge", "contour", "outline"]],
  [/\bedge\b/i, ["photo", "contour", "outline"]],
  [/\bscan\b/i, ["whiteboard", "paper", "document"]],
  [/\bwhiteboard\b/i, ["scan", "marker", "low glare"]],
  [/\blayer/i, ["layered", "color", "poster"]],
  [/\bcolor\b/i, ["layered", "blue", "red", "gray"]],
  [/\btransparent\b/i, ["background", "alpha", "white remove"]],
  [/\bwhite\b/i, ["transparent", "remove white", "white lines"]],
  [/\bfast\b/i, ["speed", "lightning", "insane", "extreme"]],
  [/\bslow\b/i, ["detail", "layered", "high detail"]],
  [/\bsmooth\b/i, ["cut friendly", "rounded", "cleanup"]],
  [/\bdetail\b/i, ["fine", "high detail", "tiny detail"]],
];

export function createPresetSearchRecords<TPreset extends SearchablePreset>(
  presets: readonly TPreset[],
): PresetSearchRecord<TPreset>[] {
  return presets.map((preset) => {
    const intensity = getPresetIntensityBadge(preset);
    const category = normalizeSearchText(preset.category || "");
    const aliases = [
      ...(preset.searchKeywords || []),
      ...(CATEGORY_ALIASES[category] || []),
      ...labelAliases(preset.label),
      intensity.label,
      intensity.id,
      speedAlias(intensity.id),
    ];

    return {
      preset,
      backendIntensity: intensity.id,
      searchableText: normalizeSearchText(
        [
          preset.id,
          preset.label,
          preset.category,
          preset.description,
          preset.help,
          ...aliases,
        ].join(" "),
      ),
    };
  });
}

export function filterPresetSearchRecords<TPreset extends SearchablePreset>({
  records,
  query,
  speed,
}: {
  records: readonly PresetSearchRecord<TPreset>[];
  query: string;
  speed: PresetBackendIntensity | "all";
}): TPreset[] {
  const normalizedQuery = normalizeSearchText(query);

  return records
    .filter((record) => {
      if (speed !== "all" && record.backendIntensity !== speed) return false;
      if (!normalizedQuery) return true;
      return record.searchableText.includes(normalizedQuery);
    })
    .map((record) => record.preset);
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function labelAliases(label: string): string[] {
  const aliases: string[] = [];
  for (const [pattern, values] of LABEL_ALIASES) {
    if (pattern.test(label)) aliases.push(...values);
  }
  return aliases;
}

function speedAlias(intensity: PresetBackendIntensity): string {
  switch (intensity) {
    case "lightning-fast":
      return "fast quick instant local";
    case "insane-speed":
      return "fast simple quick";
    case "extreme-speed":
      return "fast light quick";
    case "high-speed":
      return "balanced normal";
    case "low-speed":
      return "detail heavier slower";
    case "slow-speed":
      return "slow layered high detail complex";
  }
}
