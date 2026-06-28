import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "app", "client", "lib", "monetization");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-amazon-vinyl-affiliate-smoke");

const moduleFiles = [
  "affiliateProviders",
  "affiliateRouteIntents",
  "affiliateOffers",
  "affiliateWaterfallStorage",
  "affiliateWaterfallSelection",
  "monetizationPolicy",
];

await fs.rm(tmpDir, { recursive: true, force: true });
await fs.mkdir(tmpDir, { recursive: true });

for (const moduleName of moduleFiles) {
  const sourcePath = path.join(srcDir, `${moduleName}.ts`);
  const source = await fs.readFile(sourcePath, "utf8");
  const withNodeSpecifiers = source.replace(
    /from "(\.\/affiliate[^"]+)"/g,
    'from "$1.mjs"',
  );
  const transpiled = ts.transpileModule(withNodeSpecifiers, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  await fs.writeFile(path.join(tmpDir, `${moduleName}.mjs`), transpiled);
}

const importAuditModule = (moduleName) =>
  import(pathToFileURL(path.join(tmpDir, `${moduleName}.mjs`)).href);

const [providers, routeIntents, offers, storage, selection, policy] =
  await Promise.all([
    importAuditModule("affiliateProviders"),
    importAuditModule("affiliateRouteIntents"),
    importAuditModule("affiliateOffers"),
    importAuditModule("affiliateWaterfallStorage"),
    importAuditModule("affiliateWaterfallSelection"),
    importAuditModule("monetizationPolicy"),
  ]);

const affiliateRoutes = [
  "/",
  "/png-to-svg-converter",
  "/png-to-svg-for-cricut",
  "/png-to-svg-for-silhouette",
  "/sticker-to-svg-converter",
];

const compactAdRoutes = ["/svg-minifier", "/svg-cleaner"];
const noAdRoutes = ["/privacy-policy", "/cookies", "/sitemap"];
const slotId = "converter-below-tool";
const amazonOfferId = "amazon-printable-vinyl-sticker-paper";

function stateFor(entries) {
  return {
    version: 1,
    entries,
  };
}

function amazonEntry(routeContext, overrides = {}) {
  return {
    providerId: "amazon",
    offerId: amazonOfferId,
    slotId,
    routeContext,
    viewCount: 0,
    clicked: false,
    timedOut: false,
    ...overrides,
  };
}

function relevantOfferIdsForRoute(route) {
  return offers
    .getRelevantAffiliateOffers({
      offers: offers.AFFILIATE_OFFERS,
      routeCategories: routeIntents.getAffiliateRouteCategories(route),
    })
    .map((offer) => offer.id);
}

assert.deepEqual(
  providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
  ["amazon"],
  "Amazon vinyl stickers is the only active affiliate provider",
);
assert.equal(
  providers.isAffiliateProviderActive("stickerMule"),
  false,
  "Sticker Mule cannot be selected as an active provider",
);
assert.deepEqual(
  offers.getActiveAffiliateOfferIds(),
  [amazonOfferId],
  "Amazon vinyl stickers is the only active affiliate offer",
);
assert.equal(
  offers.AFFILIATE_OFFERS.some((offer) => offer.providerId !== "amazon"),
  false,
  "non-Amazon vinyl stickers affiliate offers are absent from the active offer list",
);

for (const route of affiliateRoutes) {
  assert.deepEqual(
    policy.getRouteMonetizationPolicy(route),
    {
      mode: "compact-ad",
      ads: true,
      affiliate: false,
      placement: "contextual-compact-ad",
    },
    `${route} defaults to AdSense-only monetization`,
  );
  assert.equal(
    policy.shouldRenderAffiliateForPath(route),
    false,
    `${route} does not render affiliate placements`,
  );
  assert.deepEqual(
    relevantOfferIdsForRoute(route),
    [amazonOfferId],
    `${route} keeps Amazon vinyl stickers mapped only in dormant affiliate config`,
  );

  const eligibleSelection = selection.selectAffiliateWaterfallOffer({
    offers: offers.getRelevantAffiliateOffers({
      offers: offers.AFFILIATE_OFFERS,
      routeCategories: routeIntents.getAffiliateRouteCategories(route),
    }),
    state: storage.createEmptyAffiliateWaterfallState(),
    slotId,
    routeContext: route,
  });
  assert.equal(
    eligibleSelection.selectedOffer?.id,
    amazonOfferId,
    `${route} can still resolve Amazon vinyl stickers when the dormant selector is called directly`,
  );

  for (const [label, routeState] of [
    [
      "clicked",
      stateFor([
        amazonEntry(route, {
          clicked: true,
          timedOut: true,
          lastClickedAt: Date.now(),
        }),
      ]),
    ],
    [
      "view-capped",
      stateFor([
        amazonEntry(route, {
          viewCount: storage.AFFILIATE_TIMEOUT_VIEW_COUNT,
          timedOut: true,
        }),
      ]),
    ],
  ]) {
    const fallbackSelection = selection.selectAffiliateWaterfallOffer({
      offers: offers.getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(route),
      }),
      state: routeState,
      slotId,
      routeContext: route,
    });
    assert.equal(
      fallbackSelection.selectedOffer,
      null,
      `${route} hides Amazon vinyl stickers after ${label} suppression`,
    );
    assert.equal(
      fallbackSelection.shouldShowAdsense,
      true,
      `${route} falls back to AdSense after ${label} suppression`,
    );
  }

  const unavailableSelection = selection.selectAffiliateWaterfallOffer({
    offers: [],
    state: storage.createEmptyAffiliateWaterfallState(),
    slotId,
    routeContext: route,
  });
  assert.equal(
    unavailableSelection.selectedOffer,
    null,
    `${route} has no affiliate when offers are unavailable`,
  );
  assert.equal(
    unavailableSelection.shouldShowAdsense,
    true,
    `${route} falls back to AdSense when offers are unavailable`,
  );
}

for (const route of compactAdRoutes) {
  assert.deepEqual(
    policy.getRouteMonetizationPolicy(route),
    {
      mode: "compact-ad",
      ads: true,
      affiliate: false,
      placement: "contextual-compact-ad",
    },
    `${route} keeps compact AdSense fallback without affiliate cards`,
  );
}

for (const route of noAdRoutes) {
  assert.equal(
    policy.shouldRenderAdsForPath(route),
    false,
    `${route} remains ad-free`,
  );
  assert.equal(
    policy.shouldRenderAffiliateForPath(route),
    false,
    `${route} remains affiliate-free`,
  );
}

const expiredClickState = storage.sanitizeAffiliateWaterfallState(
  stateFor([
    amazonEntry("/png-to-svg-converter", {
      clicked: true,
      timedOut: true,
      lastClickedAt: Date.now() - storage.AFFILIATE_CLICK_SUPPRESSION_MS - 1000,
    }),
  ]),
  {
    validOfferIds: offers.getActiveAffiliateOfferIds(),
    validOffers: [{ id: amazonOfferId, providerId: "amazon" }],
    validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
    validSlotIds: [slotId],
  },
);
assert.equal(
  expiredClickState.entries[0]?.clicked,
  false,
  "clicked-affiliate suppression expires after 30 days",
);
assert.equal(
  expiredClickState.entries[0]?.timedOut,
  false,
  "expired clicked-affiliate suppression no longer forces fallback",
);

const activeUiFiles = [
  "app/client/components/ads/ContextualAffiliateCard.tsx",
  "app/client/components/navigation/SiteFooter.tsx",
  "app/routes/png-to-svg-for-cricut-print-then-cut.tsx",
];
for (const relativePath of activeUiFiles) {
  const source = await fs.readFile(path.join(rootDir, relativePath), "utf8");
  const removedPodProviderPattern = new RegExp(
    "try" + "\\." + "print" + "ify" + "\\.com|PRINT" + "IFY_URL|Print" + "ify affiliate|Create Print" + "ify mockups",
  );
  assert.equal(
    removedPodProviderPattern.test(source),
    false,
    `${relativePath} does not render or link to the removed POD affiliate content`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      activeProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
      activeOfferIds: offers.getActiveAffiliateOfferIds(),
      affiliateRoutes,
      compactAdRoutes,
      noAdRoutes,
    },
    null,
    2,
  ),
);
