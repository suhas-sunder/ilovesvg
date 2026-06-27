import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AmazonVinylAffiliateBanner } from "./AmazonVinylAffiliateBanner";

type DesktopMidPageAdWaterfallProps = {
  fallback: ReactNode;
};

type AmazonVinylMidPageBannerState = {
  impressions: number;
  cooldownUntil: number | null;
  clicked: boolean;
  lastShownAt?: number;
  lastClickedAt?: number;
};

type RenderMode = "pending" | "affiliate" | "fallback";

const STORAGE_KEY = "ilovesvg:amazon-vinyl-mid-page-banner:v1";
const MAX_IMPRESSIONS = 5;
const COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
const LARGE_SCREEN_QUERY = "(min-width: 1024px)";

function createEmptyState(): AmazonVinylMidPageBannerState {
  return {
    impressions: 0,
    cooldownUntil: null,
    clicked: false,
  };
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseStoredState(
  value: unknown,
): AmazonVinylMidPageBannerState | null {
  if (!value || typeof value !== "object") return null;

  const state = value as Partial<AmazonVinylMidPageBannerState>;
  const impressions = state.impressions;
  const cooldownUntil = state.cooldownUntil;
  const clicked = state.clicked;
  const lastShownAt = state.lastShownAt;
  const lastClickedAt = state.lastClickedAt;

  if (
    typeof impressions !== "number" ||
    !Number.isInteger(impressions) ||
    impressions < 0
  ) {
    return null;
  }

  let normalizedCooldownUntil: number | null;
  if (cooldownUntil === null) {
    normalizedCooldownUntil = null;
  } else if (isFiniteTimestamp(cooldownUntil)) {
    normalizedCooldownUntil = cooldownUntil;
  } else {
    return null;
  }

  if (typeof clicked !== "boolean") return null;

  if (lastShownAt !== undefined && !isFiniteTimestamp(lastShownAt)) {
    return null;
  }

  if (
    lastClickedAt !== undefined &&
    !isFiniteTimestamp(lastClickedAt)
  ) {
    return null;
  }

  return {
    impressions,
    cooldownUntil: normalizedCooldownUntil,
    clicked,
    lastShownAt,
    lastClickedAt,
  };
}

function readStoredState(): AmazonVinylMidPageBannerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();

    return parseStoredState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredState(state: AmazonVinylMidPageBannerState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function resetExpiredCooldown(
  state: AmazonVinylMidPageBannerState,
  now: number,
) {
  if (state.cooldownUntil === null || state.cooldownUntil > now) {
    return state;
  }

  return createEmptyState();
}

export function DesktopMidPageAdWaterfall({
  fallback,
}: DesktopMidPageAdWaterfallProps) {
  const [mode, setMode] = useState<RenderMode>("pending");
  const impressionRecordedRef = useRef(false);
  const affiliateSelectedForPageRef = useRef(false);
  const clickedFallbackRef = useRef(false);

  const chooseMode = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const isLargeScreen = window.matchMedia(LARGE_SCREEN_QUERY).matches;
    if (!isLargeScreen) {
      setMode("fallback");
      return;
    }

    if (
      affiliateSelectedForPageRef.current &&
      !clickedFallbackRef.current
    ) {
      setMode("affiliate");
      return;
    }

    const now = Date.now();
    const storedState = readStoredState();
    if (!storedState) {
      setMode("fallback");
      return;
    }

    const effectiveState = resetExpiredCooldown(storedState, now);
    if (effectiveState !== storedState && !writeStoredState(effectiveState)) {
      setMode("fallback");
      return;
    }

    if (
      effectiveState.cooldownUntil !== null &&
      effectiveState.cooldownUntil > now
    ) {
      setMode("fallback");
      return;
    }

    if (effectiveState.impressions < MAX_IMPRESSIONS) {
      affiliateSelectedForPageRef.current = true;
      setMode("affiliate");
      return;
    }

    setMode("fallback");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQueryList = window.matchMedia(LARGE_SCREEN_QUERY);
    chooseMode();

    mediaQueryList.addEventListener("change", chooseMode);
    return () => {
      mediaQueryList.removeEventListener("change", chooseMode);
    };
  }, [chooseMode]);

  useEffect(() => {
    if (mode !== "affiliate" || impressionRecordedRef.current) return;

    impressionRecordedRef.current = true;
    const now = Date.now();
    const storedState = readStoredState();
    if (!storedState) {
      setMode("fallback");
      return;
    }

    const effectiveState = resetExpiredCooldown(storedState, now);
    const nextImpressions = Math.min(
      effectiveState.impressions + 1,
      MAX_IMPRESSIONS,
    );
    const nextState: AmazonVinylMidPageBannerState = {
      ...effectiveState,
      impressions: nextImpressions,
      cooldownUntil:
        nextImpressions >= MAX_IMPRESSIONS
          ? now + COOLDOWN_MS
          : effectiveState.cooldownUntil,
      lastShownAt: now,
    };

    if (!writeStoredState(nextState)) {
      setMode("fallback");
    }
  }, [mode]);

  const handleAffiliateClick = useCallback(() => {
    const now = Date.now();
    const storedState = readStoredState();
    const nextState: AmazonVinylMidPageBannerState = {
      ...(storedState ?? createEmptyState()),
      clicked: true,
      impressions: MAX_IMPRESSIONS,
      cooldownUntil: now + COOLDOWN_MS,
      lastClickedAt: now,
    };

    writeStoredState(nextState);
    clickedFallbackRef.current = true;
    affiliateSelectedForPageRef.current = false;
    impressionRecordedRef.current = true;
    setMode("fallback");
  }, []);

  if (mode === "pending") {
    return null;
  }

  if (mode === "affiliate") {
    return (
      <section
        className="hidden min-h-[12rem] bg-white px-4 py-4 sm:py-5 lg:block"
        aria-label="Sponsored recommendation"
        data-monetization-kind="affiliate"
        data-monetization-slot="desktop-mid-page-waterfall"
      >
        <AmazonVinylAffiliateBanner onClick={handleAffiliateClick} />
      </section>
    );
  }

  return <>{fallback}</>;
}
