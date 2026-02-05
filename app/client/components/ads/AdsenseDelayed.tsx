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
};

export function AdSenseDelayed({
  slot,
  delayMs = 2500,
  minHeight = 90,
  className = "",
  afterInteraction = false,
}: Props) {
  // Track which slot was pushed so changing slot re-enables push
  const pushedSlotRef = useRef<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);

  const tryPush = () => {
    if (typeof window === "undefined") return false;

    // already pushed for this slot
    if (pushedSlotRef.current === slot) return true;

    // script not present yet
    if (!window.adsbygoogle) return false;

    // slot not laid out (width 0) -> wait
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

    // retry for ~3.6s total
    let attempts = 0;

    if (retryRef.current) window.clearInterval(retryRef.current);

    retryRef.current = window.setInterval(() => {
      attempts += 1;
      const ok = tryPush();
      if (ok || attempts >= 12) {
        if (retryRef.current) window.clearInterval(retryRef.current);
        retryRef.current = null;
      }
    }, 300);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // IMPORTANT: reset when slot changes
    pushedSlotRef.current = null;

    const onFirstInteraction = () => {
      start();
      cleanup();
    };

    const cleanup = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (retryRef.current) window.clearInterval(retryRef.current);
      timerRef.current = null;
      retryRef.current = null;

      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("scroll", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      window.removeEventListener("drop", onFirstInteraction);
    };

    if (afterInteraction) {
      window.addEventListener("pointerdown", onFirstInteraction, {
        once: true,
      });
      window.addEventListener("scroll", onFirstInteraction, { once: true });
      window.addEventListener("keydown", onFirstInteraction, { once: true });
      window.addEventListener("drop", onFirstInteraction, { once: true });
    } else {
      timerRef.current = window.setTimeout(start, delayMs);
    }

    return cleanup;
  }, [slot, delayMs, afterInteraction]);

  return (
    <div
      className={className}
      style={{ minHeight, overflow: "hidden" }}
      aria-label="Advertisement"
    >
      // Inside your return block
      <ins
        key={slot}
        ref={insRef as any}
        className="adsbygoogle"
        style={{
          display: "block",
          margin: "0 auto",
          width: "100%", // Explicitly tell it to fill the container
          minWidth: "250px", // Gives AdSense a hint of the smallest ad it can fit
        }}
        data-ad-client="ca-pub-4810616735714570"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
