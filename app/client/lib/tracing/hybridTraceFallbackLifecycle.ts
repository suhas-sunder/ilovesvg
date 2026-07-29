export type HybridTraceRunCleanupReason =
  | "completed"
  | "failed"
  | "canceled"
  | "superseded"
  | "unmounted";

export class ServerFallbackResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerFallbackResponseError";
  }
}

type InFlightConsumer = Readonly<{
  cancel: () => void;
  release: () => void;
}>;

export type HybridTraceRunLifecycle = Readonly<{
  clientRunId: string;
  attachAbortController: (controller: AbortController) => void;
  attachInFlightConsumer: (consumer: InFlightConsumer) => void;
  cleanup: (reason: HybridTraceRunCleanupReason) => boolean;
  isActive: () => boolean;
  waitFor: <T>(promise: Promise<T>) => Promise<T>;
}>;

export function createHybridTraceRunLifecycle(options: {
  clientRunId: string;
  onCleanup?: (reason: HybridTraceRunCleanupReason) => void;
}): HybridTraceRunLifecycle {
  let cleanupReason: HybridTraceRunCleanupReason | null = null;
  let abortController: AbortController | null = null;
  let inFlightConsumer: InFlightConsumer | null = null;
  let consumerReleased = false;
  let waitingReject: ((error: unknown) => void) | null = null;

  const inactiveError = () =>
    new Error(
      cleanupReason === "unmounted"
        ? "Conversion was released during component cleanup."
        : "Conversion was canceled.",
    );

  const cleanup = (reason: HybridTraceRunCleanupReason): boolean => {
    if (cleanupReason) return false;
    cleanupReason = reason;
    const shouldCancel =
      reason === "canceled" ||
      reason === "superseded" ||
      reason === "unmounted";

    if (shouldCancel && abortController && !abortController.signal.aborted) {
      try {
        abortController.abort();
      } catch {
        // Cleanup is best effort and must not mask the conversion result.
      }
    }

    if (inFlightConsumer && !consumerReleased) {
      consumerReleased = true;
      try {
        if (shouldCancel) inFlightConsumer.cancel();
        else inFlightConsumer.release();
      } catch {
        // Cleanup is best effort and must not mask the conversion result.
      }
    }

    const reject = waitingReject;
    waitingReject = null;
    reject?.(inactiveError());

    try {
      options.onCleanup?.(reason);
    } catch {
      // Accounting callbacks must not replace the original result or error.
    }
    return true;
  };

  const lifecycle: HybridTraceRunLifecycle = {
    clientRunId: options.clientRunId,
    attachAbortController(controller) {
      abortController = controller;
      if (cleanupReason && !controller.signal.aborted) {
        try {
          controller.abort();
        } catch {
          // A late attachment to an inactive run is still best-effort cleanup.
        }
      }
    },
    attachInFlightConsumer(consumer) {
      inFlightConsumer = consumer;
      if (cleanupReason && !consumerReleased) {
        consumerReleased = true;
        try {
          consumer.cancel();
        } catch {
          // A late attachment to an inactive run is still best-effort cleanup.
        }
      }
    },
    cleanup,
    isActive: () => cleanupReason === null,
    waitFor<T>(promise: Promise<T>): Promise<T> {
      if (cleanupReason) return Promise.reject(inactiveError());
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const rejectWait = (error: unknown) => {
          if (settled) return;
          settled = true;
          if (waitingReject === rejectWait) waitingReject = null;
          reject(error);
        };
        waitingReject = rejectWait;
        promise.then(
          (value) => {
            if (settled) return;
            if (cleanupReason) {
              rejectWait(inactiveError());
              return;
            }
            settled = true;
            if (waitingReject === rejectWait) waitingReject = null;
            resolve(value);
          },
          rejectWait,
        );
      });
    },
  };

  return lifecycle;
}

export type PendingServerFallback<TResult, TContext = undefined> = Readonly<{
  clientRunId: string;
  cacheKey: string | null;
  context: TContext;
  promise: Promise<TResult>;
  isPending: () => boolean;
  reject: (error: unknown) => boolean;
  resolve: (result: TResult) => boolean;
}>;

export function createPendingServerFallback<TResult, TContext = undefined>(
  options: {
    clientRunId: string;
    cacheKey: string | null;
    context: TContext;
    signal: AbortSignal;
    onSettled?: (
      pending: PendingServerFallback<TResult, TContext>,
    ) => void;
  },
): PendingServerFallback<TResult, TContext> {
  let settled = false;
  let resolvePromise!: (result: TResult) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<TResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const finish = (
    settlePromise: () => void,
  ): boolean => {
    if (settled) return false;
    settled = true;
    options.signal.removeEventListener("abort", handleAbort);
    try {
      options.onSettled?.(pending);
    } catch {
      // Map cleanup must not replace the conversion result or error.
    }
    settlePromise();
    return true;
  };
  const handleAbort = () => {
    finish(() => rejectPromise(new Error("Conversion was canceled.")));
  };

  const pending: PendingServerFallback<TResult, TContext> = {
    clientRunId: options.clientRunId,
    cacheKey: options.cacheKey,
    context: options.context,
    promise,
    isPending: () => !settled,
    reject: (error) => finish(() => rejectPromise(error)),
    resolve: (result) => finish(() => resolvePromise(result)),
  };

  if (options.signal.aborted) {
    handleAbort();
  } else {
    options.signal.addEventListener("abort", handleAbort, { once: true });
  }
  return pending;
}

export function resolvePendingServerFallback<TResult, TContext>(
  pendingByRunId: ReadonlyMap<
    string,
    PendingServerFallback<TResult, TContext>
  >,
  clientRunId: string,
  result: TResult,
  beforeResolve?: (
    pending: PendingServerFallback<TResult, TContext>,
  ) => void,
): boolean {
  if (!clientRunId) return false;
  const pending = pendingByRunId.get(clientRunId);
  if (!pending?.isPending()) return false;
  try {
    beforeResolve?.(pending);
  } catch (error) {
    pending.reject(error);
    return false;
  }
  return pending.resolve(result);
}

export function rejectPendingServerFallback<TResult, TContext>(
  pendingByRunId: ReadonlyMap<
    string,
    PendingServerFallback<TResult, TContext>
  >,
  clientRunId: string,
  error: unknown,
): boolean {
  if (!clientRunId) return false;
  const pending = pendingByRunId.get(clientRunId);
  if (!pending?.isPending()) return false;
  return pending.reject(error);
}
