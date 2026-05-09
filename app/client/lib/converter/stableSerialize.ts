type Jsonish =
  | null
  | boolean
  | number
  | string
  | Jsonish[]
  | { [key: string]: Jsonish | undefined };

export function stableSerialize(value: Jsonish | undefined): string {
  return JSON.stringify(normalizeStableValue(value));
}

function normalizeStableValue(value: Jsonish | undefined): Jsonish | undefined {
  if (value == null) return value ?? null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeStableValue(item) ?? null) as Jsonish[];
  }
  if (typeof value !== "object") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    return value;
  }

  const out: { [key: string]: Jsonish } = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = normalizeStableValue(value[key]);
    if (normalized !== undefined) out[key] = normalized;
  }
  return out;
}
