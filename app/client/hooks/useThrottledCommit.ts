import * as React from "react";

type UseThrottledCommitOptions<TValue> = {
  value: TValue;
  onCommit: (value: TValue) => void;
  delayMs?: number;
  normalize?: (value: TValue) => TValue | null;
  isEqual?: (left: TValue, right: TValue) => boolean;
};

export type ThrottledCommitController<TValue> = {
  draft: TValue;
  setDraft: React.Dispatch<React.SetStateAction<TValue>>;
  schedule: (value: TValue) => void;
  flush: (value?: TValue) => void;
  cancel: () => void;
};

export function useThrottledCommit<TValue>({
  value,
  onCommit,
  delayMs = 120,
  normalize = defaultNormalize,
  isEqual = Object.is,
}: UseThrottledCommitOptions<TValue>): ThrottledCommitController<TValue> {
  const [draft, setDraft] = React.useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = React.useRef(value);
  const committedRef = React.useRef(value);
  const lastCommitAtRef = React.useRef(0);
  const onCommitRef = React.useRef(onCommit);

  React.useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const cancel = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const commitNormalized = React.useCallback(
    (nextValue: TValue) => {
      if (isEqual(nextValue, committedRef.current)) return;
      committedRef.current = nextValue;
      lastCommitAtRef.current = now();
      onCommitRef.current(nextValue);
    },
    [isEqual],
  );

  const flush = React.useCallback(
    (rawValue?: TValue) => {
      const normalized = normalize(rawValue ?? latestDraftRef.current);
      if (normalized == null) return;

      cancel();
      latestDraftRef.current = normalized;
      setDraft((current) => (isEqual(current, normalized) ? current : normalized));
      commitNormalized(normalized);
    },
    [cancel, commitNormalized, isEqual, normalize],
  );

  const schedule = React.useCallback(
    (rawValue: TValue) => {
      const normalized = normalize(rawValue);
      if (normalized == null) return;

      latestDraftRef.current = normalized;
      setDraft((current) => (isEqual(current, normalized) ? current : normalized));

      if (isEqual(normalized, committedRef.current)) {
        cancel();
        return;
      }

      const remaining = delayMs - (now() - lastCommitAtRef.current);
      if (remaining <= 0) {
        cancel();
        commitNormalized(normalized);
        return;
      }

      if (timerRef.current) return;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const latest = latestDraftRef.current;
        commitNormalized(latest);
      }, remaining);
    },
    [cancel, commitNormalized, delayMs, isEqual, normalize],
  );

  React.useEffect(() => {
    cancel();
    committedRef.current = value;
    latestDraftRef.current = value;
    setDraft((current) => (isEqual(current, value) ? current : value));
  }, [cancel, isEqual, value]);

  React.useEffect(() => cancel, [cancel]);

  return React.useMemo(
    () => ({
      draft,
      setDraft,
      schedule,
      flush,
      cancel,
    }),
    [cancel, draft, flush, schedule],
  );
}

function defaultNormalize<TValue>(value: TValue): TValue {
  return value;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
