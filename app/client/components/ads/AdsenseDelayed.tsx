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
  placeholderLabel?: string;

  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  fullWidth?: boolean;
  maxHeight?: number;

  // Placeholder (recommended)
  showPlaceholder?: boolean; // default true
  sponsoredText?: string; // default "Sponsored"
};

export function AdSenseDelayed({
  slot,
  delayMs = 2500,
  minHeight = 90,
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
  const insRef = useRef<HTMLModElement | null>(null);

  // Reserve enough height so nothing can grow downward later.
  // If you pass maxHeight, we reserve that. Otherwise reserve minHeight.
  const reserveHeight = maxHeight ?? minHeight;

  const [isFilled, setIsFilled] = useState(false);

  const isActuallyFilled = () => {
    const ins = insRef.current;
    if (!ins) return false;

    const status = ins.getAttribute("data-ad-status");
    if (status === "unfilled") return false;
    if (status === "filled") return true;

    // Fallback: require a real, non-trivial iframe size
    const iframe = ins.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe) return false;

    const r = iframe.getBoundingClientRect();
    const w = r.width || iframe.offsetWidth || 0;
    const h = r.height || iframe.offsetHeight || 0;

    // Empty iframe shells are common. Treat as filled only if it has real area.
    return w >= 200 && h >= 50;
  };

  const updateFilled = () => setIsFilled(isActuallyFilled());

  const tryPush = () => {
    if (typeof window === "undefined" || !window.adsbygoogle) return false;
    if (pushedSlotRef.current === slot) return true;

    const w = insRef.current?.offsetWidth ?? 0;
    if (w <= 0) return false;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedSlotRef.current = slot;

      window.setTimeout(updateFilled, 250);
      window.setTimeout(updateFilled, 900);
      window.setTimeout(updateFilled, 2000);

      return true;
    } catch {
      return false;
    }
  };

  const start = () => {
    if (tryPush()) return;

    let attempts = 0;
    if (retryRef.current) window.clearInterval(retryRef.current);

    retryRef.current = window.setInterval(() => {
      attempts += 1;
      if (tryPush() || attempts >= 12) {
        if (retryRef.current) window.clearInterval(retryRef.current);
        retryRef.current = null;
      }
    }, 300);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    pushedSlotRef.current = null;
    setIsFilled(false);

    const onFirstInteraction = () => {
      start();
      cleanup();
    };

    const cleanup = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (retryRef.current) window.clearInterval(retryRef.current);
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("scroll", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };

    if (afterInteraction) {
      window.addEventListener("pointerdown", onFirstInteraction, {
        once: true,
      });
      window.addEventListener("scroll", onFirstInteraction, { once: true });
      window.addEventListener("keydown", onFirstInteraction, { once: true });
    } else {
      timerRef.current = window.setTimeout(start, delayMs);
    }

    return cleanup;
  }, [slot, delayMs, afterInteraction]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ins = insRef.current;
    if (!ins) return;

    updateFilled();

    const mo = new MutationObserver(() => updateFilled());
    mo.observe(ins, { attributes: true, childList: true, subtree: true });

    const t1 = window.setTimeout(updateFilled, 1500);
    const t2 = window.setTimeout(updateFilled, 4000);

    return () => {
      mo.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  return (
    <div
      className={["relative", className].join(" ")}
      style={{
        height: reserveHeight, // key: fixed reservation removes CLS
        overflow: "hidden",
        width: "100%",
      }}
      aria-label="Advertisement"
    >
      {/* Full-size placeholder so it never looks like a random floating pill */}
      {showPlaceholder && (
        <div
          className={[
            "absolute inset-0 grid place-items-center rounded-lg border border-slate-200 bg-slate-50",
            "transition-opacity duration-200",
            isFilled ? "opacity-0 pointer-events-none" : "opacity-100",
          ].join(" ")}
          aria-hidden={isFilled}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[12px] px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-500">
              {sponsoredText}
            </span>

            {/* subtle skeleton bars */}
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
          height: reserveHeight, // keep iframe/container from changing height
        }}
        data-ad-client="ca-pub-4810616735714570"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidth ? "true" : "false"}
      />
    </div>
  );
}
