import { useLocation } from "react-router";
import { AdSenseDelayed } from "./AdsenseDelayed";
import {
  getRouteMonetizationPolicy,
  normalizeMonetizationPathname,
} from "~/client/lib/monetization/monetizationPolicy";

const CONTEXTUAL_AD_SLOT_ID = "converter-below-tool";
const CONTEXTUAL_ADSENSE_FALLBACK_SLOT = "8102088582";
const CONTEXTUAL_ADSENSE_RESERVE_CLASS = "min-h-[11rem]";

export function ContextualAdCard() {
  const location = useLocation();
  const pathname = normalizeMonetizationPathname(location.pathname);
  const monetizationPolicy = getRouteMonetizationPolicy(pathname);

  if (!monetizationPolicy.ads) {
    return null;
  }

  return <ContextualAdsenseFallback />;
}

function ContextualAdsenseFallback() {
  return (
    <section
      className={`hidden bg-white px-4 py-4 sm:py-5 lg:block ${CONTEXTUAL_ADSENSE_RESERVE_CLASS}`}
      aria-label="Advertisements"
      data-monetization-kind="adsense"
      data-monetization-slot={CONTEXTUAL_AD_SLOT_ID}
      data-monetization-reserve="compact"
    >
      <div className="mx-auto w-full max-w-[970px]">
        <AdSenseDelayed
          slot={CONTEXTUAL_ADSENSE_FALLBACK_SLOT}
          delayMs={1500}
          minHeight={120}
          maxHeight={180}
          format="horizontal"
          fullWidth={true}
          className="mx-auto w-full"
        />
      </div>
    </section>
  );
}
