import { useEffect, useRef, useState } from "react";

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
  sponsoredText?: string;
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
  sponsoredText = "Sponsored",
}: Props) {
  const pushedSlotRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const fillCheckTimersRef = useRef<number[]>([]);
  const insRef = useRef<HTMLModElement | null>(null);

  const reserveHeight = maxHeight ?? minHeight;

  const [isFilled, setIsFilled] = useState(false);

  const isActuallyFilled = () => {
    const ins = insRef.current;
    if (!ins) return false;

    const status = ins.getAttribute("data-ad-status");
    if (status === "unfilled") return false;
    if (status === "filled") return true;

    const iframe = ins.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe) return false;

    const r = iframe.getBoundingClientRect();
    const w = r.width || iframe.offsetWidth || 0;
    const h = r.height || iframe.offsetHeight || 0;

    return w >= 200 && h >= 50;
  };

  const updateFilled = () => {
    const nextFilled = isActuallyFilled();
    setIsFilled((current) => (current === nextFilled ? current : nextFilled));
  };

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

  const clearFillCheckTimers = () => {
    for (const timer of fillCheckTimersRef.current) {
      window.clearTimeout(timer);
    }
    fillCheckTimersRef.current = [];
  };

  const tryPush = () => {
    if (typeof window === "undefined" || !window.adsbygoogle) return false;
    if (pushedSlotRef.current === slot) return true;

    const width = insRef.current?.offsetWidth ?? 0;
    if (width <= 0) return false;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedSlotRef.current = slot;

      clearFillCheckTimers();
      fillCheckTimersRef.current = [250, 900, 2000, 4000].map((ms) =>
        window.setTimeout(updateFilled, ms),
      );

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
    setIsFilled((current) => (current === false ? current : false));

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
    clearFillCheckTimers();

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
      clearFillCheckTimers();
    };
  }, [slot, delayMs, afterInteraction]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ins = insRef.current;
    if (!ins) return;

    updateFilled();

    const observer = new MutationObserver(() => {
      updateFilled();
    });

    observer.observe(ins, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    const t1 = window.setTimeout(updateFilled, 1500);
    const t2 = window.setTimeout(updateFilled, 4000);
    const t3 = window.setTimeout(updateFilled, 7000);

    return () => {
      observer.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  return (
    <div
      className={["relative", className].join(" ")}
      style={{
        height: minHeight,
        overflow: "hidden",
        width: "100%",
      }}
      aria-label="Advertisement"
    >
      {showPlaceholder && (
        <div
          className={[
            "pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-lg border border-slate-200 bg-slate-50",
            "transition-opacity duration-200",
            isFilled ? "opacity-0" : "opacity-100",
          ].join(" ")}
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[12px] text-slate-500">
              {sponsoredText}
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
