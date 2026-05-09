export const AFFILIATE_WATERFALL_STORAGE_KEY =
  "ilovesvg:affiliate-waterfall:v1";

export const AFFILIATE_WATERFALL_SCHEMA_VERSION = 1;
export const AFFILIATE_TIMEOUT_VIEW_COUNT = 5;

export type AffiliateStorageLike = Pick<Storage, "getItem" | "setItem">;

export type AffiliateWaterfallEntry = {
  providerId?: string;
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
  providerId?: string;
  offerId: string;
  slotId: string;
  routeContext: string;
};

type ActiveAffiliateOfferRef = {
  id: string;
  providerId: string;
};

type AffiliateWaterfallValidationOptions = {
  validOfferIds?: readonly string[];
  validProviderIds?: readonly string[];
  validOffers?: readonly ActiveAffiliateOfferRef[];
  validSlotIds?: readonly string[];
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

  const providerId = cleanString(value.providerId) || undefined;
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
    providerId,
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
  options: AffiliateWaterfallValidationOptions = {},
): AffiliateWaterfallState {
  if (!isPlainObject(value)) return createEmptyAffiliateWaterfallState();
  if (value.version !== AFFILIATE_WATERFALL_SCHEMA_VERSION) {
    return createEmptyAffiliateWaterfallState();
  }
  if (!Array.isArray(value.entries)) return createEmptyAffiliateWaterfallState();

  const providerByOfferId = options.validOffers
    ? new Map(options.validOffers.map((offer) => [offer.id, offer.providerId]))
    : null;
  const validOfferIds =
    (options.validOfferIds || options.validOffers)
      ? new Set([
          ...(options.validOfferIds ?? []),
          ...(options.validOffers?.map((offer) => offer.id) ?? []),
        ])
      : null;
  const validProviderIds = options.validProviderIds
    ? new Set(options.validProviderIds)
    : null;
  const validSlotIds = options.validSlotIds ? new Set(options.validSlotIds) : null;
  const entriesByKey = new Map<string, AffiliateWaterfallEntry>();

  for (const rawEntry of value.entries) {
    const normalizedEntry = normalizeEntry(rawEntry);
    if (!normalizedEntry) continue;
    if (validOfferIds && !validOfferIds.has(normalizedEntry.offerId)) continue;
    const expectedProviderId = providerByOfferId?.get(normalizedEntry.offerId);
    if (
      expectedProviderId &&
      normalizedEntry.providerId &&
      normalizedEntry.providerId !== expectedProviderId
    ) {
      continue;
    }
    if (expectedProviderId) {
      normalizedEntry.providerId = expectedProviderId;
    }
    if (
      validProviderIds &&
      normalizedEntry.providerId &&
      !validProviderIds.has(normalizedEntry.providerId)
    ) {
      continue;
    }
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
  options: AffiliateWaterfallValidationOptions = {},
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

function isValidMutationInput(
  input: EntryKeyParts & AffiliateWaterfallValidationOptions,
) {
  const providerByOfferId = input.validOffers
    ? new Map(input.validOffers.map((offer) => [offer.id, offer.providerId]))
    : null;
  const validOfferIds =
    (input.validOfferIds || input.validOffers)
      ? new Set([
          ...(input.validOfferIds ?? []),
          ...(input.validOffers?.map((offer) => offer.id) ?? []),
        ])
      : null;
  const validProviderIds = input.validProviderIds
    ? new Set(input.validProviderIds)
    : null;

  if (validOfferIds && !validOfferIds.has(input.offerId)) return false;

  const expectedProviderId = providerByOfferId?.get(input.offerId);
  if (expectedProviderId && input.providerId && input.providerId !== expectedProviderId) {
    return false;
  }
  if (providerByOfferId && !expectedProviderId) return false;

  const providerId = input.providerId ?? expectedProviderId;
  if (validProviderIds && providerId && !validProviderIds.has(providerId)) {
    return false;
  }

  return true;
}

function getMutationKeyParts(
  input: EntryKeyParts & AffiliateWaterfallValidationOptions,
): EntryKeyParts {
  const expectedProviderId = input.validOffers?.find(
    (offer) => offer.id === input.offerId,
  )?.providerId;

  return {
    providerId: input.providerId ?? expectedProviderId,
    offerId: input.offerId,
    slotId: input.slotId,
    routeContext: input.routeContext,
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
  input: EntryKeyParts & AffiliateWaterfallValidationOptions & { now?: number },
) {
  if (!storageLike) return null;
  if (!isValidMutationInput(input)) return null;

  const keyParts = getMutationKeyParts(input);
  const state = readAffiliateWaterfallState(storageLike, input);
  const current =
    getAffiliateWaterfallEntry(state, keyParts) ?? createBaseEntry(keyParts);
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
  input: EntryKeyParts & AffiliateWaterfallValidationOptions & { now?: number },
) {
  if (!storageLike) return null;
  if (!isValidMutationInput(input)) return null;

  const keyParts = getMutationKeyParts(input);
  const state = readAffiliateWaterfallState(storageLike, input);
  const current =
    getAffiliateWaterfallEntry(state, keyParts) ?? createBaseEntry(keyParts);
  const nextEntry: AffiliateWaterfallEntry = {
    ...current,
    clicked: true,
    timedOut: true,
    lastClickedAt: input.now ?? Date.now(),
  };

  writeAffiliateWaterfallState(storageLike, upsertEntry(state, nextEntry));
  return nextEntry;
}

export const cleanAffiliateWaterfallState = sanitizeAffiliateWaterfallState;

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
