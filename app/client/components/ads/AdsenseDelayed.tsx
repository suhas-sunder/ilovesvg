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
  const pushed = useRef(false);
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);

  const tryPush = () => {
    if (pushed.current) return true;
    if (typeof window === "undefined") return false;

    // script not present yet
    if (!window.adsbygoogle) return false;

    // slot not laid out (width 0) -> wait
    const w = insRef.current?.offsetWidth ?? 0;
    if (w <= 0) return false;

    try {
      window.adsbygoogle.push({});
      pushed.current = true;
      return true;
    } catch {
      return false;
    }
  };

  const start = () => {
    if (pushed.current) return;

    if (tryPush()) return;

    // retry for ~3.6s total
    let attempts = 0;
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

    timerRef.current = window.setTimeout(start, delayMs);

    if (!afterInteraction) {
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        if (retryRef.current) window.clearInterval(retryRef.current);
      };
    }

    const onFirstInteraction = () => {
      start();
      cleanup();
    };

    const cleanup = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (retryRef.current) window.clearInterval(retryRef.current);
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      window.removeEventListener("drop", onFirstInteraction);
    };

    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });
    window.addEventListener("drop", onFirstInteraction, { once: true });

    return cleanup;
  }, [delayMs, afterInteraction]);

  return (
    <div className={className} style={{ minHeight }} aria-label="Advertisement">
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-4810616735714570"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
