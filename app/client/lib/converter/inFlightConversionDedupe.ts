import type { BaseConversionCacheResult } from "./conversionCache";

type InFlightPromise = Promise<BaseConversionCacheResult>;

const inFlightConversions = new Map<string, InFlightPromise>();

export function getInFlightConversion(
  key: string | null | undefined,
): InFlightPromise | null {
  return key ? inFlightConversions.get(key) ?? null : null;
}

export function joinOrStartInFlightConversion(
  key: string,
  start: () => InFlightPromise,
): InFlightPromise {
  const existing = inFlightConversions.get(key);
  if (existing) return existing;
  const promise = start();
  trackInFlightConversion(key, promise);
  return promise;
}

export function trackInFlightConversion(
  key: string,
  promise: InFlightPromise,
): InFlightPromise {
  inFlightConversions.set(key, promise);
  promise.then(
    () => {
      if (inFlightConversions.get(key) === promise) {
        inFlightConversions.delete(key);
      }
    },
    () => {
      if (inFlightConversions.get(key) === promise) {
        inFlightConversions.delete(key);
      }
    },
  );
  return promise;
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
