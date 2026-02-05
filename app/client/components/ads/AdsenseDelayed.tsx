import React, { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

type AdMode = "responsive" | "fixed";

type Props = {
  slot: string;

  delayMs?: number;
  className?: string;
  afterInteraction?: boolean;

  // Reserve space (keeps CLS low). In fixed mode, this will default to fixedHeight.
  minHeight?: number;
  maxHeight?: number;

  // Responsive behavior (default matches your current behavior)
  mode?: AdMode; // default "responsive"
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  fullWidth?: boolean;

  // Fixed behavior (only used when mode="fixed")
  fixedWidth?: number; // e.g., 320, 728
  fixedHeight?: number; // e.g., 100, 90

  // Placeholder
  showPlaceholder?: boolean; // default true
  sponsoredText?: string; // default "Sponsored"

  // Back-compat no-op (you had this prop but never used it)
  placeholderLabel?: string;
};

export function AdSenseDelayed({
  slot,
  delayMs = 2500,
  minHeight = 90,
  className = "",
  afterInteraction = false,

  // New: layout mode
  mode = "responsive",

  // Responsive defaults match your current behavior
  format = "auto",
  fullWidth = false,

  // Fixed
  fixedWidth,
  fixedHeight,

  maxHeight,

  showPlaceholder = true,
  sponsoredText = "Sponsored",
}: Props) {
  const pushedSlotRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);

  const [isFilled, setIsFilled] = useState(false);

  // Reserve enough height so nothing can grow downward later.
  // - fixed: default to fixedHeight if provided
  // - responsive: prefer maxHeight then minHeight
  const reserveHeight = useMemo(() => {
    if (mode === "fixed") {
      return fixedHeight ?? maxHeight ?? minHeight;
    }
    return maxHeight ?? minHeight;
  }, [mode, fixedHeight, maxHeight, minHeight]);

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

    // Ensure the ins has a real layout width (important for responsive AND fixed)
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

  // IMPORTANT: In fixed mode, do NOT output responsive AdSense attributes/styles.
  // This prevents a later responsive unit from "bleeding" creatives into a flexible container.
  const insStyle: React.CSSProperties =
    mode === "fixed"
      ? {
          display: "inline-block",
          width: fixedWidth ?? "auto",
          height: fixedHeight ?? reserveHeight,
          margin: "0 auto",
        }
      : {
          display: "block",
          margin: "0 auto",
          width: "100%",
          minWidth: "250px",
          height: reserveHeight,
        };

  const wrapperOverflow = mode === "fixed" ? "hidden" : "hidden";

  return (
    <div
      className={["relative", className].join(" ")}
      style={{
        height: reserveHeight,
        overflow: wrapperOverflow,
        width: "100%",
      }}
      aria-label="Advertisement"
    >
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

            <div className="w-[220px] max-w-[70vw]">
              <div className="h-2 rounded bg-slate-200/70" />
              <div className="mt-2 h-2 rounded bg-slate-200/60" />
              <div className="mt-2 h-2 rounded bg-slate-200/50" />
            </div>
          </div>
        </div>
      )}

      {/* Center fixed units cleanly; responsive units can just fill width */}
      <div className={mode === "fixed" ? "w-full flex justify-center" : ""}>
        <ins
          key={slot}
          ref={insRef}
          className="adsbygoogle"
          style={insStyle}
          data-ad-client="ca-pub-4810616735714570"
          data-ad-slot={slot}
          {...(mode === "responsive"
            ? {
                "data-ad-format": format,
                "data-full-width-responsive": fullWidth ? "true" : "false",
              }
            : {})}
        />
      </div>
    </div>
  );
}
