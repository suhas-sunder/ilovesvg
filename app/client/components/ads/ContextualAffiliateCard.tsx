import { useLocation } from "react-router";
import { AdSenseDelayed } from "./AdsenseDelayed";
import { DesktopMidPageAdWaterfall } from "./DesktopMidPageAdWaterfall";
import { getRouteMonetizationPolicy } from "~/client/lib/monetization/monetizationPolicy";
import { normalizeAffiliatePathname } from "~/client/lib/monetization/affiliateRouteIntents";

const CONTEXTUAL_AFFILIATE_SLOT_ID = "converter-below-tool";
const CONTEXTUAL_ADSENSE_FALLBACK_SLOT = "8102088582";
const CONTEXTUAL_ADSENSE_RESERVE_CLASS = "min-h-[11rem]";

export function ContextualAffiliateCard() {
  const location = useLocation();
  const pathname = normalizeAffiliatePathname(location.pathname);
  const monetizationPolicy = getRouteMonetizationPolicy(pathname);

  if (!monetizationPolicy.ads) {
    return null;
  }

  return <ContextualAdsenseFallback />;
}

function ContextualAdsenseFallback() {
  const fallback = (
    <section
      className={`hidden bg-white px-4 py-4 sm:py-5 lg:block ${CONTEXTUAL_ADSENSE_RESERVE_CLASS}`}
      aria-label="Sponsored advertisement"
      data-monetization-kind="adsense"
      data-monetization-slot={CONTEXTUAL_AFFILIATE_SLOT_ID}
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

  return <DesktopMidPageAdWaterfall fallback={fallback} />;
}
