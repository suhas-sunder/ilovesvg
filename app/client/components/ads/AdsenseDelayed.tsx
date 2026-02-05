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
  // New Constraints
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  fullWidth?: boolean;
  maxHeight?: number;
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
}: Props) {
  const pushedSlotRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);

  const tryPush = () => {
    if (typeof window === "undefined" || !window.adsbygoogle) return false;
    if (pushedSlotRef.current === slot) return true;

    const w = insRef.current?.offsetWidth ?? 0;
    if (w <= 0) return false;

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

  return (
    <div
      className={className}
      style={{
        minHeight,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        overflow: "hidden",
        width: "100%",
      }}
      aria-label="Advertisement"
    >
      <ins
        key={slot}
        ref={insRef}
        className="adsbygoogle"
        style={{
          display: "block",
          margin: "0 auto",
          width: "100%",
          minWidth: "250px",
        }}
        data-ad-client="ca-pub-4810616735714570"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidth ? "true" : "false"}
      />
    </div>
  );
}
