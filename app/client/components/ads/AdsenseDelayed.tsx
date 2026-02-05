import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

type Props = {
  slot: string;
  delayMs?: number;
  minHeight?: number;
  className?: string;
  // pass true to wait for first user interaction OR delay (whichever comes first)
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

  const pushAd = () => {
    if (pushed.current) return;
    pushed.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ignore double-push errors
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Delay trigger
    timerRef.current = window.setTimeout(pushAd, delayMs);

    if (!afterInteraction) {
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      };
    }

    // First interaction trigger (click, key, touch, drop)
    const onFirstInteraction = () => {
      pushAd();
      cleanup();
    };

    const cleanup = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
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
