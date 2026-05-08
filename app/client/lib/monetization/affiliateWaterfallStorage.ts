export const AFFILIATE_WATERFALL_STORAGE_KEY =
  "ilovesvg:affiliate-waterfall:v1";

export const AFFILIATE_WATERFALL_SCHEMA_VERSION = 1;
export const AFFILIATE_TIMEOUT_VIEW_COUNT = 5;

export type AffiliateStorageLike = Pick<Storage, "getItem" | "setItem">;

export type AffiliateWaterfallEntry = {
  offerId: string;
  slotId: string;
  routeContext: string;
  viewCount: number;
  clicked: boolean;
  timedOut: boolean;
  lastViewedAt?: number;
  lastClickedAt?: number;
};

export type AffiliateWaterfallState = {
  version: 1;
  entries: AffiliateWaterfallEntry[];
};

type EntryKeyParts = {
  offerId: string;
  slotId: string;
  routeContext: string;
};

export function createEmptyAffiliateWaterfallState(): AffiliateWaterfallState {
  return {
    version: AFFILIATE_WATERFALL_SCHEMA_VERSION,
    entries: [],
  };
}

export function makeAffiliateWaterfallEntryKey({
  offerId,
  slotId,
  routeContext,
}: EntryKeyParts) {
  return `${slotId}::${routeContext}::${offerId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.round(value);
}

function normalizeEntry(value: unknown): AffiliateWaterfallEntry | null {
  if (!isPlainObject(value)) return null;

  const offerId = cleanString(value.offerId);
  const slotId = cleanString(value.slotId);
  const routeContext = cleanString(value.routeContext);
  if (!offerId || !slotId || !routeContext) return null;

  const rawViewCount =
    typeof value.viewCount === "number" && Number.isFinite(value.viewCount)
      ? value.viewCount
      : 0;
  const viewCount = Math.max(0, Math.floor(rawViewCount));
  const clicked = value.clicked === true;
  const timedOut =
    value.timedOut === true || clicked || viewCount >= AFFILIATE_TIMEOUT_VIEW_COUNT;

  return {
    offerId,
    slotId,
    routeContext,
    viewCount,
    clicked,
    timedOut,
    lastViewedAt: cleanTimestamp(value.lastViewedAt),
    lastClickedAt: cleanTimestamp(value.lastClickedAt),
  };
}

export function sanitizeAffiliateWaterfallState(
  value: unknown,
  options: {
    validOfferIds?: readonly string[];
    validSlotIds?: readonly string[];
  } = {},
): AffiliateWaterfallState {
  if (!isPlainObject(value)) return createEmptyAffiliateWaterfallState();
  if (value.version !== AFFILIATE_WATERFALL_SCHEMA_VERSION) {
    return createEmptyAffiliateWaterfallState();
  }
  if (!Array.isArray(value.entries)) return createEmptyAffiliateWaterfallState();

  const validOfferIds = options.validOfferIds
    ? new Set(options.validOfferIds)
    : null;
  const validSlotIds = options.validSlotIds ? new Set(options.validSlotIds) : null;
  const entriesByKey = new Map<string, AffiliateWaterfallEntry>();

  for (const rawEntry of value.entries) {
    const normalizedEntry = normalizeEntry(rawEntry);
    if (!normalizedEntry) continue;
    if (validOfferIds && !validOfferIds.has(normalizedEntry.offerId)) continue;
    if (validSlotIds && !validSlotIds.has(normalizedEntry.slotId)) continue;
    entriesByKey.set(
      makeAffiliateWaterfallEntryKey(normalizedEntry),
      normalizedEntry,
    );
  }

  return {
    version: AFFILIATE_WATERFALL_SCHEMA_VERSION,
    entries: [...entriesByKey.values()],
  };
}

export function readAffiliateWaterfallState(
  storageLike: AffiliateStorageLike | null | undefined,
  options: {
    validOfferIds?: readonly string[];
    validSlotIds?: readonly string[];
  } = {},
): AffiliateWaterfallState {
  if (!storageLike) return createEmptyAffiliateWaterfallState();

  try {
    const raw = storageLike.getItem(AFFILIATE_WATERFALL_STORAGE_KEY);
    if (!raw) return createEmptyAffiliateWaterfallState();
    return sanitizeAffiliateWaterfallState(JSON.parse(raw), options);
  } catch {
    return createEmptyAffiliateWaterfallState();
  }
}

function writeAffiliateWaterfallState(
  storageLike: AffiliateStorageLike | null | undefined,
  state: AffiliateWaterfallState,
) {
  if (!storageLike) return false;

  try {
    storageLike.setItem(AFFILIATE_WATERFALL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getAffiliateWaterfallEntry(
  state: AffiliateWaterfallState,
  keyParts: EntryKeyParts,
) {
  const key = makeAffiliateWaterfallEntryKey(keyParts);
  return state.entries.find(
    (entry) => makeAffiliateWaterfallEntryKey(entry) === key,
  );
}

function upsertEntry(
  state: AffiliateWaterfallState,
  nextEntry: AffiliateWaterfallEntry,
) {
  const nextKey = makeAffiliateWaterfallEntryKey(nextEntry);
  let didUpdate = false;
  const entries = state.entries.map((entry) => {
    if (makeAffiliateWaterfallEntryKey(entry) !== nextKey) return entry;
    didUpdate = true;
    return nextEntry;
  });

  if (!didUpdate) entries.push(nextEntry);

  return {
    version: AFFILIATE_WATERFALL_SCHEMA_VERSION,
    entries,
  } satisfies AffiliateWaterfallState;
}

function createBaseEntry(keyParts: EntryKeyParts): AffiliateWaterfallEntry {
  return {
    ...keyParts,
    viewCount: 0,
    clicked: false,
    timedOut: false,
  };
}

export function isAffiliateWaterfallEntryTimedOut(
  entry: AffiliateWaterfallEntry | null | undefined,
) {
  if (!entry) return false;
  return (
    entry.timedOut === true ||
    entry.clicked === true ||
    entry.viewCount >= AFFILIATE_TIMEOUT_VIEW_COUNT
  );
}

export function incrementAffiliateView(
  storageLike: AffiliateStorageLike | null | undefined,
  input: EntryKeyParts & { now?: number },
) {
  if (!storageLike) return null;

  const state = readAffiliateWaterfallState(storageLike);
  const current = getAffiliateWaterfallEntry(state, input) ?? createBaseEntry(input);
  if (isAffiliateWaterfallEntryTimedOut(current)) return current;

  const viewCount = current.viewCount + 1;
  const nextEntry: AffiliateWaterfallEntry = {
    ...current,
    viewCount,
    timedOut: viewCount >= AFFILIATE_TIMEOUT_VIEW_COUNT,
    lastViewedAt: input.now ?? Date.now(),
  };

  writeAffiliateWaterfallState(storageLike, upsertEntry(state, nextEntry));
  return nextEntry;
}

export function markAffiliateClicked(
  storageLike: AffiliateStorageLike | null | undefined,
  input: EntryKeyParts & { now?: number },
) {
  if (!storageLike) return null;

  const state = readAffiliateWaterfallState(storageLike);
  const current = getAffiliateWaterfallEntry(state, input) ?? createBaseEntry(input);
  const nextEntry: AffiliateWaterfallEntry = {
    ...current,
    clicked: true,
    timedOut: true,
    lastClickedAt: input.now ?? Date.now(),
  };

  writeAffiliateWaterfallState(storageLike, upsertEntry(state, nextEntry));
  return nextEntry;
}

export function getBrowserAffiliateStorage(): AffiliateStorageLike | null {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    const probeKey = `${AFFILIATE_WATERFALL_STORAGE_KEY}:probe`;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}
