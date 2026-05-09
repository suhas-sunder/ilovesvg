import type { BaseConversionCacheResult } from "./conversionCache";

type InFlightPromise = Promise<BaseConversionCacheResult>;

type InFlightEntry = {
  key: string;
  promise: InFlightPromise;
  controller: AbortController;
  consumers: number;
  settled: boolean;
};

export type InFlightConversionHandle = {
  key: string;
  promise: InFlightPromise;
  signal: AbortSignal;
  shared: boolean;
  cancel: () => void;
  release: () => void;
};

const inFlightConversions = new Map<string, InFlightEntry>();

export function getInFlightConversion(
  key: string | null | undefined,
): InFlightPromise | null {
  return key ? inFlightConversions.get(key)?.promise ?? null : null;
}

export function acquireInFlightConversion(
  key: string,
  start: (signal: AbortSignal) => InFlightPromise,
): InFlightConversionHandle {
  const existing = inFlightConversions.get(key);
  if (existing) {
    existing.consumers += 1;
    return createHandle(existing, true);
  }

  const controller = new AbortController();
  const entry: InFlightEntry = {
    key,
    controller,
    consumers: 1,
    settled: false,
    promise: Promise.resolve().then(() => start(controller.signal)),
  };
  inFlightConversions.set(key, entry);
  entry.promise.then(
    () => cleanupInFlightEntry(key, entry),
    () => cleanupInFlightEntry(key, entry),
  );
  return createHandle(entry, false);
}

export function joinOrStartInFlightConversion(
  key: string,
  start: () => InFlightPromise,
): InFlightPromise {
  return acquireInFlightConversion(key, () => start()).promise;
}

export function trackInFlightConversion(
  key: string,
  promise: InFlightPromise,
): InFlightPromise {
  const controller = new AbortController();
  const entry: InFlightEntry = {
    key,
    promise,
    controller,
    consumers: 0,
    settled: false,
  };
  inFlightConversions.set(key, entry);
  promise.then(
    () => cleanupInFlightEntry(key, entry),
    () => cleanupInFlightEntry(key, entry),
  );
  return promise;
}

function cleanupInFlightEntry(key: string, entry: InFlightEntry) {
  entry.settled = true;
  if (inFlightConversions.get(key) === entry) {
    inFlightConversions.delete(key);
  }
}

export function createInFlightDeferredConversion(key: string): {
  promise: InFlightPromise;
  resolve: (result: BaseConversionCacheResult) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (result: BaseConversionCacheResult) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<BaseConversionCacheResult>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  trackInFlightConversion(key, promise);
  return { promise, resolve, reject };
}

export function clearInFlightConversionsForTests() {
  inFlightConversions.clear();
}

export function getInFlightConversionCountForTests(): number {
  return inFlightConversions.size;
}

export function getInFlightConsumerCountForTests(key: string): number {
  return inFlightConversions.get(key)?.consumers ?? 0;
}

function createHandle(
  entry: InFlightEntry,
  shared: boolean,
): InFlightConversionHandle {
  let released = false;

  function release(abortIfLast: boolean) {
    if (released) return;
    released = true;
    entry.consumers = Math.max(0, entry.consumers - 1);
    if (
      abortIfLast &&
      entry.consumers === 0 &&
      !entry.settled &&
      !entry.controller.signal.aborted
    ) {
      entry.controller.abort();
    }
  }

  return {
    key: entry.key,
    promise: entry.promise,
    signal: entry.controller.signal,
    shared,
    cancel: () => release(true),
    release: () => release(false),
  };
}
