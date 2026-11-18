import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

type Props = {
  slot: string;
  delayMs?: number;
  minHeight?: number;
  className?: string;
  afterInteraction?: boolean;

  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  fullWidth?: boolean;
  maxHeight?: number;

  showPlaceholder?: boolean;
  placeholderLabel?: string;
};

export function AdSenseDelayed({
  slot,
  delayMs = 1000,
  minHeight = 120,
  className = "",
  afterInteraction = false,
  format = "auto",
  fullWidth = false,
  maxHeight,

  showPlaceholder = true,
  placeholderLabel = "Advertisements",
}: Props) {
  const pushedSlotRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);

  const reserveHeight = maxHeight ?? minHeight;

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearRetry = () => {
    if (retryRef.current) {
      window.clearInterval(retryRef.current);
      retryRef.current = null;
    }
  };

  const tryPush = () => {
    if (typeof window === "undefined" || !window.adsbygoogle) return false;
    if (pushedSlotRef.current === slot) return true;

    const width = insRef.current?.offsetWidth ?? 0;
    if (width <= 0) return false;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedSlotRef.current = slot;

      return true;
    } catch {
      return false;
    }
  };

  const start = () => {
    if (tryPush()) return;

    let attempts = 0;
    clearRetry();

    retryRef.current = window.setInterval(() => {
      attempts += 1;

      if (tryPush() || attempts >= 12) {
        clearRetry();
      }
    }, 300);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    pushedSlotRef.current = null;

    const removeInteractionListeners = () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("scroll", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };

    const onFirstInteraction = () => {
      removeInteractionListeners();
      start();
    };

    clearTimer();
    clearRetry();

    if (afterInteraction) {
      window.addEventListener("pointerdown", onFirstInteraction, {
        once: true,
      });
      window.addEventListener("scroll", onFirstInteraction, { once: true });
      window.addEventListener("keydown", onFirstInteraction, { once: true });
    } else {
      timerRef.current = window.setTimeout(start, delayMs);
    }

    return () => {
      removeInteractionListeners();
      clearTimer();
      clearRetry();
    };
  }, [slot, delayMs, afterInteraction]);

  return (
    <div
      className={["relative isolate", className].join(" ")}
      data-ad-container=""
      style={{
        height: minHeight,
        overflow: "hidden",
        width: "100%",
      }}
      aria-label="Advertisements"
    >
      {showPlaceholder && (
        <div
          className={[
            "pointer-events-none absolute inset-0 z-0 grid place-items-center rounded-lg border border-slate-200 bg-slate-50",
          ].join(" ")}
          aria-hidden="true"
          data-ad-placeholder=""
        >
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[12px] text-slate-500">
              {placeholderLabel}
            </span>

            <div className="w-[220px] max-w-[70vw]">
              <div className="h-2 rounded bg-slate-200/70" />
              <div className="mt-2 h-2 rounded bg-slate-200/60" />
              <div className="mt-2 h-2 rounded bg-slate-200/50" />
            </div>
          </div>
        </div>
      )}

      <ins
        key={slot}
        ref={insRef}
        className="adsbygoogle"
        style={{
          display: "block",
          position: "relative",
          zIndex: 1,
          margin: "0 auto",
          width: "100%",
          minWidth: "250px",
          height: reserveHeight,
        }}
        data-ad-client="ca-pub-4810616735714570"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidth ? "true" : "false"}
      />
    </div>
  );
}
