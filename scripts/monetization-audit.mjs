import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "app", "client", "lib", "monetization");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-monetization-audit");

const moduleFiles = [
  "affiliateProviders",
  "affiliateRouteIntents",
  "affiliateOffers",
  "affiliateResponsive",
  "affiliateWaterfallStorage",
  "affiliateWaterfallSelection",
  "affiliateVisibility",
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

const [providers, storage, selection, routeIntents, offers, visibility, responsive, policy] =
  await Promise.all([
    importAuditModule("affiliateProviders"),
    importAuditModule("affiliateWaterfallStorage"),
    importAuditModule("affiliateWaterfallSelection"),
    importAuditModule("affiliateRouteIntents"),
    importAuditModule("affiliateOffers"),
    importAuditModule("affiliateVisibility"),
    importAuditModule("affiliateResponsive"),
    importAuditModule("monetizationPolicy"),
  ]);

const removedProviderId = "name" + "cheap";
const removedOfferId = `${removedProviderId}-domain-hosting`;

class MemoryStorage {
  constructor(initialValue = null) {
    this.value = initialValue;
    this.values = new Map(
      initialValue == null ? [] : [[storage.AFFILIATE_WATERFALL_STORAGE_KEY, initialValue]],
    );
    this.writes = [];
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.value = value;
    this.values.set(key, value);
    this.writes.push(value);
  }

  removeItem(key) {
    this.value = null;
    this.values.delete(key);
  }
}

class ThrowingStorage extends MemoryStorage {
  getItem() {
    throw new Error("blocked");
  }

  setItem() {
    throw new Error("blocked");
  }
}

function stateFor(entries) {
  return {
    version: 1,
    entries,
  };
}

function entry(overrides) {
  return {
    offerId: "printify-product-mockups",
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-etsy",
    viewCount: 0,
    clicked: false,
    timedOut: false,
    ...overrides,
  };
}

function writeState(storageLike, value) {
  storageLike.setItem(
    storage.AFFILIATE_WATERFALL_STORAGE_KEY,
    JSON.stringify(value),
  );
}

function activeOfferRefs() {
  return offers.filterActiveAffiliateOffers(offers.AFFILIATE_OFFERS).map((offer) => ({
    id: offer.id,
    providerId: offer.providerId,
  }));
}

function runStorageParserTests() {
  assert.deepEqual(
    storage.readAffiliateWaterfallState(new MemoryStorage()),
    storage.createEmptyAffiliateWaterfallState(),
    "empty storage returns an empty v1 state",
  );

  assert.deepEqual(
    storage.readAffiliateWaterfallState(new MemoryStorage("{bad json")),
    storage.createEmptyAffiliateWaterfallState(),
    "malformed JSON is ignored safely",
  );

  assert.deepEqual(
    storage.readAffiliateWaterfallState(
      new MemoryStorage(JSON.stringify({ version: 0, entries: [] })),
    ),
    storage.createEmptyAffiliateWaterfallState(),
    "old schema is ignored safely",
  );

  assert.deepEqual(
    storage.readAffiliateWaterfallState(new ThrowingStorage()),
    storage.createEmptyAffiliateWaterfallState(),
    "blocked localStorage does not throw",
  );

  assert.deepEqual(
    storage.readAffiliateSuppressionState(new MemoryStorage("{bad json")),
    storage.createEmptyAffiliateSuppressionState(),
    "malformed session suppression JSON is ignored safely",
  );

  assert.deepEqual(
    storage.readAffiliateSuppressionState(new ThrowingStorage()),
    storage.createEmptyAffiliateSuppressionState(),
    "blocked session suppression storage does not throw",
  );

  const suppressionStore = new MemoryStorage();
  const suppressed = storage.markAffiliateSlotSuppressed(suppressionStore, {
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-cricut-stickers",
    reason: "exhausted",
    now: 900,
    validSlotIds: ["converter-below-tool"],
  });
  const suppressionState = storage.readAffiliateSuppressionState(suppressionStore, {
    validSlotIds: ["converter-below-tool"],
  });
  assert.equal(suppressed?.reason, "exhausted", "suppression reason is stored");
  assert.equal(
    storage.isAffiliateSlotSuppressed(suppressionState, {
      slotId: "converter-below-tool",
    }),
    true,
    "session suppression applies across compatible route placements",
  );

  const invalidSuppression = storage.markAffiliateSlotSuppressed(new MemoryStorage(), {
    slotId: "other-slot",
    routeContext: "/png-to-svg-for-cricut-stickers",
    reason: "exhausted",
    now: 901,
    validSlotIds: ["converter-below-tool"],
  });
  assert.equal(invalidSuppression, null, "unknown suppression slot is refused");

  const staleStore = new MemoryStorage();
  writeState(
    staleStore,
    stateFor([
      entry({ offerId: "removed-offer" }),
      entry({ offerId: removedOfferId, providerId: removedProviderId }),
      entry({ offerId: "cricut-project-workflow", providerId: "cricut" }),
      entry({ offerId: "unknown-provider-offer", providerId: "unknown" }),
      entry({ offerId: "printify-product-mockups", viewCount: 2 }),
      entry({ offerId: "printify-product-mockups", viewCount: 4 }),
    ]),
  );
  assert.deepEqual(
    storage
      .readAffiliateWaterfallState(staleStore, {
        validOfferIds: offers.getActiveAffiliateOfferIds(),
        validOffers: activeOfferRefs(),
        validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
      })
      .entries.map((storedEntry) => ({
        providerId: storedEntry.providerId,
        offerId: storedEntry.offerId,
        viewCount: storedEntry.viewCount,
      })),
    [{ providerId: "printify", offerId: "printify-product-mockups", viewCount: 4 }],
    "inactive, removed, and unknown provider entries are ignored while active duplicates are deduped",
  );

  const store = new MemoryStorage();
  const firstView = storage.incrementAffiliateView(store, {
    providerId: "printify",
    offerId: "printify-product-mockups",
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-etsy",
    now: 100,
    validOfferIds: offers.getActiveAffiliateOfferIds(),
    validOffers: activeOfferRefs(),
    validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
  });
  assert.equal(firstView?.viewCount, 1, "view increment stores one view");
  assert.equal(firstView?.timedOut, false, "first view does not time out");

  for (let index = 0; index < 4; index += 1) {
    storage.incrementAffiliateView(store, {
      providerId: "printify",
      offerId: "printify-product-mockups",
      slotId: "converter-below-tool",
      routeContext: "/png-to-svg-for-etsy",
      now: 200 + index,
      validOfferIds: offers.getActiveAffiliateOfferIds(),
      validOffers: activeOfferRefs(),
      validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
    });
  }
  const afterFive = storage.getAffiliateWaterfallEntry(
    storage.readAffiliateWaterfallState(store),
    {
      offerId: "printify-product-mockups",
      slotId: "converter-below-tool",
      routeContext: "/png-to-svg-for-etsy",
    },
  );
  assert.equal(afterFive?.viewCount, 5, "five counted views are persisted");
  assert.equal(afterFive?.timedOut, true, "five counted views time out offer");

  const clickStore = new MemoryStorage();
  const clicked = storage.markAffiliateClicked(clickStore, {
    providerId: "stickerMule",
    offerId: "sticker-mule-custom-stickers",
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-cricut-stickers",
    now: 300,
    validOfferIds: offers.getActiveAffiliateOfferIds(),
    validOffers: activeOfferRefs(),
    validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
  });
  assert.equal(clicked?.clicked, true, "click stores clicked flag");
  assert.equal(clicked?.timedOut, true, "click immediately times out offer");

  const inactiveView = storage.incrementAffiliateView(new MemoryStorage(), {
    providerId: "cricut",
    offerId: "cricut-project-workflow",
    slotId: "converter-below-tool",
    routeContext: "/cricut-svg-converter",
    now: 500,
    validOfferIds: offers.getActiveAffiliateOfferIds(),
    validOffers: activeOfferRefs(),
    validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
  });
  assert.equal(inactiveView, null, "inactive Cricut view increments are refused");

  const removedClick = storage.markAffiliateClicked(new MemoryStorage(), {
    providerId: removedProviderId,
    offerId: removedOfferId,
    slotId: "converter-below-tool",
    routeContext: "/logo-to-svg-converter",
    now: 600,
    validOfferIds: offers.getActiveAffiliateOfferIds(),
    validOffers: activeOfferRefs(),
    validProviderIds: providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
  });
  assert.equal(removedClick, null, "removed provider click timeouts are refused");
}

function runWaterfallSelectionTests() {
  const relevant = offers.getRelevantAffiliateOffers({
    offers: offers.AFFILIATE_OFFERS,
    routeCategories: ["stickers", "print-then-cut"],
  });
  assert.deepEqual(
    relevant.map((offer) => offer.id),
    ["sticker-mule-custom-stickers", "printify-product-mockups"],
    "sticker and print routes prioritize Sticker Mule before Printify",
  );

  assert.equal(
    offers.getRelevantAffiliateOffers({
      offers: offers.AFFILIATE_OFFERS,
      routeCategories: ["technical-utility"],
    }).length,
    0,
    "technical utility routes get AdSense only",
  );

  assert.equal(
    offers.getRelevantAffiliateOffers({
      offers: [
        {
          id: "bad-cricut",
          providerId: "cricut",
          label: "Bad Cricut",
          href: "https://example.com",
          categories: ["stickers"],
          enabled: true,
          priority: 1,
        },
        ...offers.AFFILIATE_OFFERS,
      ],
      routeCategories: ["stickers"],
    }).some((offer) => offer.providerId === "cricut"),
    false,
    "inactive providers are filtered before route relevance and priority",
  );

  assert.deepEqual(
    offers
      .getRelevantAffiliateOffers({
        offers: [offers.AFFILIATE_OFFERS[0], offers.AFFILIATE_OFFERS[0]],
        routeCategories: ["stickers"],
      })
      .map((offer) => offer.id),
    ["printify-product-mockups"],
    "duplicate offer IDs are displayed only once",
  );

  const emptyState = storage.createEmptyAffiliateWaterfallState();
  assert.equal(
    selection.selectAffiliateWaterfallOffer({
      offers: [
        {
          id: "bad-removed-provider",
          providerId: removedProviderId,
          label: "Bad removed provider",
          href: "https://example.com",
          categories: ["logo-icon"],
          enabled: true,
          priority: 1,
        },
      ],
      state: emptyState,
      slotId: "converter-below-tool",
      routeContext: "/svg-minifier",
    }).shouldShowAdsense,
    true,
    "inactive or unknown provider offers fall back to AdSense",
  );

  const oneOffer = relevant.slice(0, 1);
  assert.equal(
    selection.selectAffiliateWaterfallOffer({
      offers: oneOffer,
      state: emptyState,
      slotId: "converter-below-tool",
      routeContext: "/png-to-svg-for-cricut-stickers",
    }).selectedOffer?.id,
    "sticker-mule-custom-stickers",
    "one relevant affiliate shows before AdSense",
  );

  const timedOutFirst = stateFor([
      entry({
      providerId: "stickerMule",
      offerId: "sticker-mule-custom-stickers",
      routeContext: "/png-to-svg-for-cricut-stickers",
      viewCount: 5,
      timedOut: true,
    }),
  ]);
  assert.equal(
    selection.selectAffiliateWaterfallOffer({
      offers: relevant,
      state: timedOutFirst,
      slotId: "converter-below-tool",
      routeContext: "/png-to-svg-for-cricut-stickers",
    }).selectedOffer?.id,
    "printify-product-mockups",
    "timed-out offer 1 advances to offer 2",
  );

  const timedOutBoth = stateFor([
      entry({
      providerId: "stickerMule",
      offerId: "sticker-mule-custom-stickers",
      routeContext: "/png-to-svg-for-cricut-stickers",
      viewCount: 5,
      timedOut: true,
    }),
      entry({
      providerId: "printify",
      offerId: "printify-product-mockups",
      routeContext: "/png-to-svg-for-cricut-stickers",
      clicked: true,
      timedOut: true,
    }),
  ]);
  assert.equal(
    selection.selectAffiliateWaterfallOffer({
      offers: relevant,
      state: timedOutBoth,
      slotId: "converter-below-tool",
      routeContext: "/png-to-svg-for-cricut-stickers",
    }).shouldShowAdsense,
    true,
    "timed-out first two offers fall back to AdSense",
  );
}

function runProviderCleanupTests() {
  assert.deepEqual(
    providers.ACTIVE_AFFILIATE_PROVIDER_IDS,
    ["printify", "stickerMule"],
    "active provider allowlist contains Printify and Sticker Mule only",
  );

  assert.equal(
    providers.isAffiliateProviderActive("printify"),
    true,
    "Printify is active",
  );

  assert.equal(
    providers.isAffiliateProviderActive("stickerMule"),
    true,
    "Sticker Mule is active",
  );

  assert.equal(
    providers.isAffiliateProviderActive("cricut"),
    false,
    "Cricut provider metadata is inactive",
  );

  assert.equal(
    providers.isAffiliateProviderActive(removedProviderId),
    false,
    "removed provider is not a known active provider",
  );

  assert.equal(
    providers.AFFILIATE_PROVIDERS.some((provider) => provider.id === removedProviderId),
    false,
    "removed provider is removed from provider metadata",
  );

  assert.deepEqual(
    offers.getActiveAffiliateOfferIds(),
    ["printify-product-mockups", "sticker-mule-custom-stickers"],
    "active offer IDs are Printify and Sticker Mule only",
  );

  assert.equal(
    offers.AFFILIATE_OFFERS.some((offer) => offer.providerId === removedProviderId),
    false,
    "removed provider is removed from affiliate offers",
  );

  assert.equal(
    offers.AFFILIATE_OFFERS.some((offer) => offer.providerId === "cricut"),
    false,
    "Cricut has no active affiliate offer",
  );
}

function runRouteRelevanceTests() {
  assert.deepEqual(
    routeIntents.getAffiliateRouteCategories("/unknown-tool"),
    ["general-svg-conversion"],
    "unknown routes use conservative fallback categories",
  );

  assert.deepEqual(
    routeIntents.getAffiliateRouteCategories("/png-to-svg-for-cricut-stickers"),
    ["stickers", "print-then-cut", "cricut-cut", "ecommerce-selling"],
    "sticker Cricut route receives sticker and print categories",
  );

  assert.deepEqual(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/sticker-to-png-for-printing",
        ),
      })
      .map((offer) => offer.id),
    ["sticker-mule-custom-stickers", "printify-product-mockups"],
    "sticker printing routes prioritize Sticker Mule before Printify",
  );

  assert.equal(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/png-to-svg-for-cricut-stickers",
        ),
      })
      .some((offer) => offer.providerId === removedProviderId),
    false,
    "removed provider is absent from Cricut sticker route candidates",
  );

  assert.deepEqual(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories:
          routeIntents.getAffiliateRouteCategories("/png-to-svg-converter"),
      })
      .map((offer) => offer.id),
    ["printify-product-mockups"],
    "general PNG conversion can show Printify first",
  );

  assert.deepEqual(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/svg-to-png-for-printify",
        ),
      })
      .map((offer) => offer.id),
    ["printify-product-mockups"],
    "Printify-specific routes can show the Printify offer",
  );

  assert.deepEqual(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/svg-background-editor",
        ),
      })
      .map((offer) => offer.id),
    ["printify-product-mockups"],
    "creator-focused SVG background editor route can show Printify",
  );

  assert.deepEqual(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/svg-recolor",
        ),
      })
      .map((offer) => offer.id),
    ["printify-product-mockups"],
    "creator-focused SVG recolor route can show Printify",
  );

  for (const route of [
    "/svg-to-png-for-printful",
    "/png-to-svg-for-glowforge",
    "/jpg-to-svg-for-silhouette",
    "/svg-cleaner-for-figma",
    "/svg-to-jsx-converter",
  ]) {
    assert.deepEqual(
      offers
        .getRelevantAffiliateOffers({
          offers: offers.AFFILIATE_OFFERS,
          routeCategories: routeIntents.getAffiliateRouteCategories(route),
        })
        .map((offer) => offer.id),
      [],
      `${route} does not show irrelevant affiliate offers`,
    );
  }
}

function runVisibilityTests() {
  assert.equal(
    visibility.shouldCountAffiliateView({
      isClient: true,
      isReady: true,
      isAffiliateRendered: true,
      isMobileSuppressed: false,
      isTimedOut: false,
      alreadyCountedThisSession: false,
      elementWidth: 320,
      elementHeight: 100,
      visibleHeight: 70,
      threshold: 0.7,
      cssDisplay: "block",
      cssVisibility: "visible",
    }),
    true,
    "70% visible affiliate counts",
  );

  assert.equal(
    visibility.shouldCountAffiliateView({
      isClient: true,
      isReady: true,
      isAffiliateRendered: true,
      isMobileSuppressed: false,
      isTimedOut: false,
      alreadyCountedThisSession: true,
      elementWidth: 320,
      elementHeight: 100,
      visibleHeight: 100,
      threshold: 0.7,
      cssDisplay: "block",
      cssVisibility: "visible",
    }),
    false,
    "same page-load render does not double-count",
  );

  assert.equal(
    visibility.shouldCountAffiliateView({
      isClient: true,
      isReady: true,
      isAffiliateRendered: true,
      isMobileSuppressed: true,
      isTimedOut: false,
      alreadyCountedThisSession: false,
      elementWidth: 320,
      elementHeight: 100,
      visibleHeight: 100,
      threshold: 0.7,
      cssDisplay: "block",
      cssVisibility: "visible",
    }),
    false,
    "mobile-suppressed affiliate does not count",
  );

  assert.equal(
    visibility.shouldCountAffiliateView({
      isClient: true,
      isReady: true,
      isAffiliateRendered: false,
      isMobileSuppressed: false,
      isTimedOut: false,
      alreadyCountedThisSession: false,
      elementWidth: 0,
      elementHeight: 0,
      visibleHeight: 0,
      threshold: 0.7,
      cssDisplay: "none",
      cssVisibility: "hidden",
    }),
    false,
    "hidden skeleton or zero-size state does not count",
  );
}

function runClickAndSuppressionTests() {
  assert.equal(
    responsive.shouldSuppressAdsenseFallbackForViewport({
      viewportWidth: 390,
      suppressAffiliateOnMobileWhenAdjacentAdExists: true,
    }),
    true,
    "mobile width with adjacent ad suppresses contextual AdSense fallback",
  );

  assert.equal(
    responsive.shouldSuppressAdsenseFallbackForViewport({
      viewportWidth: 768,
      suppressAffiliateOnMobileWhenAdjacentAdExists: true,
    }),
    true,
    "768px boundary still suppresses contextual AdSense fallback because the adjacent mobile ad is lg:hidden",
  );

  assert.equal(
    responsive.shouldSuppressAdsenseFallbackForViewport({
      viewportWidth: 1024,
      suppressAffiliateOnMobileWhenAdjacentAdExists: true,
    }),
    false,
    "1024px desktop boundary keeps contextual AdSense fallback available",
  );

  const clickStore = new MemoryStorage();
  const clicked = storage.markAffiliateClicked(clickStore, {
    offerId: "printify-product-mockups",
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-etsy",
    now: 400,
  });
  assert.equal(clicked?.timedOut, true, "actual affiliate link click times out");
}

function runActiveAffiliateTests() {
  const activeOfferIds = offers.AFFILIATE_OFFERS.filter((offer) =>
    offers.isValidAffiliateOffer(offer),
  ).map((offer) => offer.id);

  assert.deepEqual(
    activeOfferIds,
    ["printify-product-mockups", "sticker-mule-custom-stickers"],
    "only Printify and Sticker Mule are active affiliate offers",
  );

  assert.equal(
    activeOfferIds.includes(removedOfferId),
    false,
    "removed provider is not active",
  );

  assert.equal(
    activeOfferIds.includes("cricut-project-workflow"),
    false,
    "Cricut is not active",
  );
}

function runMonetizationPolicyTests() {
  for (const route of ["/privacy-policy", "/terms-of-service", "/cookies"]) {
    assert.equal(
      policy.isMonetizationExcludedRoute(route),
      true,
      `${route} is explicitly excluded from monetization`,
    );
    assert.deepEqual(
      policy.getRouteMonetizationPolicy(`${route}?utm_source=test#section`),
      {
        ads: false,
        affiliate: false,
        exclusionReason: "legal-trust",
      },
      `${route} disables ads and affiliate even with query or hash`,
    );
    assert.equal(
      policy.shouldRenderAdsForPath(route),
      false,
      `${route} does not render ad placements`,
    );
    assert.equal(
      policy.shouldRenderAffiliateForPath(route),
      false,
      `${route} does not render affiliate placements`,
    );
  }

  assert.equal(
    policy.isMonetizationExcludedRoute("/how-it-works"),
    false,
    "docs/help monetization policy is not decided by the legal exclusion list",
  );
  assert.deepEqual(
    policy.getRouteMonetizationPolicy("/png-to-svg-converter"),
    {
      ads: true,
      affiliate: true,
    },
    "converter routes remain monetization eligible",
  );
}

runStorageParserTests();
runWaterfallSelectionTests();
runProviderCleanupTests();
runRouteRelevanceTests();
runVisibilityTests();
runClickAndSuppressionTests();
runActiveAffiliateTests();
runMonetizationPolicyTests();

console.log("[monetization-audit] all checks passed");
