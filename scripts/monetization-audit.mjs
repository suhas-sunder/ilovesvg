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
  "affiliateRouteIntents",
  "affiliateOffers",
  "affiliateResponsive",
  "affiliateWaterfallStorage",
  "affiliateWaterfallSelection",
  "affiliateVisibility",
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

const [storage, selection, routeIntents, offers, visibility, responsive] =
  await Promise.all([
    importAuditModule("affiliateWaterfallStorage"),
    importAuditModule("affiliateWaterfallSelection"),
    importAuditModule("affiliateRouteIntents"),
    importAuditModule("affiliateOffers"),
    importAuditModule("affiliateVisibility"),
    importAuditModule("affiliateResponsive"),
  ]);

class MemoryStorage {
  constructor(initialValue = null) {
    this.value = initialValue;
    this.writes = [];
  }

  getItem(key) {
    if (key !== storage.AFFILIATE_WATERFALL_STORAGE_KEY) return null;
    return this.value;
  }

  setItem(key, value) {
    if (key !== storage.AFFILIATE_WATERFALL_STORAGE_KEY) return;
    this.value = value;
    this.writes.push(value);
  }

  removeItem() {
    this.value = null;
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

  const staleStore = new MemoryStorage();
  writeState(
    staleStore,
    stateFor([
      entry({ offerId: "removed-offer" }),
      entry({ offerId: "printify-product-mockups", viewCount: 2 }),
      entry({ offerId: "printify-product-mockups", viewCount: 4 }),
    ]),
  );
  assert.deepEqual(
    storage
      .readAffiliateWaterfallState(staleStore, {
        validOfferIds: ["printify-product-mockups"],
      })
      .entries.map((storedEntry) => ({
        offerId: storedEntry.offerId,
        viewCount: storedEntry.viewCount,
      })),
    [{ offerId: "printify-product-mockups", viewCount: 4 }],
    "unknown offer IDs are ignored and duplicate entries are deduped",
  );

  const store = new MemoryStorage();
  const firstView = storage.incrementAffiliateView(store, {
    offerId: "printify-product-mockups",
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-etsy",
    now: 100,
  });
  assert.equal(firstView?.viewCount, 1, "view increment stores one view");
  assert.equal(firstView?.timedOut, false, "first view does not time out");

  for (let index = 0; index < 4; index += 1) {
    storage.incrementAffiliateView(store, {
      offerId: "printify-product-mockups",
      slotId: "converter-below-tool",
      routeContext: "/png-to-svg-for-etsy",
      now: 200 + index,
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
    offerId: "sticker-mule-custom-stickers",
    slotId: "converter-below-tool",
    routeContext: "/png-to-svg-for-cricut-stickers",
    now: 300,
  });
  assert.equal(clicked?.clicked, true, "click stores clicked flag");
  assert.equal(clicked?.timedOut, true, "click immediately times out offer");
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
    }).some((offer) => offer.id === "namecheap-domain-hosting"),
    false,
    "domain offer is not relevant to technical utility routes",
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
      offers: [],
      state: emptyState,
      slotId: "converter-below-tool",
      routeContext: "/svg-minifier",
    }).shouldShowAdsense,
    true,
    "no relevant affiliates falls back to AdSense",
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
      offerId: "sticker-mule-custom-stickers",
      routeContext: "/png-to-svg-for-cricut-stickers",
      viewCount: 5,
      timedOut: true,
    }),
    entry({
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

function runRouteRelevanceTests() {
  assert.deepEqual(
    routeIntents.getAffiliateRouteCategories("/png-to-svg-for-cricut-stickers"),
    ["stickers", "print-then-cut", "cricut-cut", "ecommerce-selling"],
    "sticker Cricut route receives sticker and print categories",
  );

  assert.equal(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/png-to-svg-for-cricut-stickers",
        ),
      })
      .some((offer) => offer.id === "namecheap-domain-hosting"),
    false,
    "Namecheap is blocked from Cricut sticker routes",
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
    "general PNG conversion can show Printify first but not Namecheap",
  );

  assert.equal(
    offers
      .getRelevantAffiliateOffers({
        offers: offers.AFFILIATE_OFFERS,
        routeCategories: routeIntents.getAffiliateRouteCategories(
          "/svg-background-editor",
        ),
      })
      .some((offer) => offer.id === "namecheap-domain-hosting"),
    false,
    "Namecheap stays inactive even on web design SVG utilities",
  );

  assert.deepEqual(
    routeIntents.getAffiliateRouteCategories("/unknown-tool"),
    ["general-svg-conversion"],
    "unknown routes use conservative fallback categories",
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
    activeOfferIds.includes("namecheap-domain-hosting"),
    false,
    "Namecheap is not active",
  );

  assert.equal(
    activeOfferIds.includes("cricut-project-workflow"),
    false,
    "Cricut is not active",
  );
}

runStorageParserTests();
runWaterfallSelectionTests();
runRouteRelevanceTests();
runVisibilityTests();
runClickAndSuppressionTests();
runActiveAffiliateTests();

console.log("[monetization-audit] all checks passed");
