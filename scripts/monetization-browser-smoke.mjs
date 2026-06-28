import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9241);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = `${debugPort}-${process.pid}-${Date.now()}`;
const tmpDir = path.join(os.tmpdir(), "ilovesvg-monetization-browser-smoke", runId);
const profileDir = path.join(tmpDir, "profile");
const storageKey = "ilovesvg:amazon-vinyl-mid-page-banner:v1";
const suppressionStorageKey = "ilovesvg:affiliate-suppression:v1";
const stickerRoute = "/png-to-svg-for-cricut-stickers";
const routeAfterSuppression = "/png-to-svg-converter";
const legacyCompactFallbackSlot = "7336722354";
const amazonRouteCoverageRoutes = [
  "/",
  "/png-to-svg-converter",
  "/png-to-svg-for-cricut",
  "/png-to-svg-for-silhouette",
  "/sticker-to-svg-converter",
  "/logo-to-svg-converter",
];
const legalTrustRoutes = ["/privacy-policy", "/terms-of-service", "/cookies", "/sitemap"];
const docsHelpRoutes = ["/how-it-works", "/how-it-works/troubleshooting"];
const compactPolicyRoutes = [
  "/svg-minifier",
  "/svg-cleaner",
  "/svg-resize-and-scale-editor",
  "/svg-to-base64",
  "/text-to-svg-converter",
];

const mobileWidths = [320, 360, 390, 430, 768];
const desktopWidths = [1024, 1280, 1440, 1920];
const legalTrustWidths = [320, 390, 768, 1024, 1440];
const docsHelpWidths = [320, 390, 768, 1024, 1440];
const compactPolicyWidths = [320, 390, 768, 1024, 1440];

async function main() {
  await assertServerReachable();
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });

  const browser = spawn(browserPath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  const results = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    serverReserve: null,
    legalTrust: [],
    docsHelp: [],
    compactPolicy: [],
    mobile: [],
    desktop: [],
    amazonRouteCoverage: [],
    tracking: {},
    consoleMessages: [],
  };

  try {
    await waitForCdp();
    results.serverReserve = await checkServerReservedShell();

    for (const route of legalTrustRoutes) {
      for (const width of legalTrustWidths) {
        const client = await openPage(route, width, 900);
        try {
          const result = await checkLegalTrustRoute(client, route, width);
          results.legalTrust.push(result);
        } finally {
          await client.close().catch(() => {});
        }
      }
    }

    for (const route of docsHelpRoutes) {
      for (const width of docsHelpWidths) {
        const client = await openPage(route, width, 900);
        try {
          const result = await checkDocsHelpRoute(client, route, width);
          results.docsHelp.push(result);
        } finally {
          await client.close().catch(() => {});
        }
      }
    }

    for (const route of compactPolicyRoutes) {
      for (const width of compactPolicyWidths) {
        const client = await openPage(route, width, 900);
        try {
          const result = await checkContextualCompactAdRoute(client, route, width);
          results.compactPolicy.push(result);
        } finally {
          await client.close().catch(() => {});
        }
      }
    }

    for (const width of mobileWidths) {
      const client = await openPage(stickerRoute, width, 900);
      try {
        const result = await checkMobileAffiliate(client, width);
        results.mobile.push(result);
      } finally {
        await client.close().catch(() => {});
      }
    }

    for (const width of desktopWidths) {
      const client = await openPage(stickerRoute, width, 900);
      try {
        const result = await checkDesktopAffiliate(client, width);
        results.desktop.push(result);
      } finally {
        await client.close().catch(() => {});
      }
    }

    for (const route of amazonRouteCoverageRoutes) {
      const client = await openPage(route, 1280, 900);
      try {
        const result = await checkAmazonAffiliateRoute(client, route);
        results.amazonRouteCoverage.push(result);
      } finally {
        await client.close().catch(() => {});
      }
    }

    const trackingClient = await openPage(stickerRoute, 1280, 900);
    try {
      results.tracking = await checkTrackingAndFallback(trackingClient);
    } finally {
      await trackingClient.close().catch(() => {});
    }

    const suppressionClient = await openPage(stickerRoute, 1280, 900);
    try {
      results.crossRouteSuppression = await checkCrossRouteSuppressionAndFallbackLayout(
        suppressionClient,
      );
    } finally {
      await suppressionClient.close().catch(() => {});
    }

    const consoleClient = await openPage(stickerRoute, 390, 900);
    try {
      results.consoleMessages = await collectConsoleSignals(consoleClient);
    } finally {
      await consoleClient.close().catch(() => {});
    }
  } finally {
    browser.kill();
  }

  const failures = [
    ...(results.serverReserve?.ok === false ? [results.serverReserve] : []),
    ...results.legalTrust.filter((result) => !result.ok),
    ...results.docsHelp.filter((result) => !result.ok),
    ...results.compactPolicy.filter((result) => !result.ok),
    ...results.mobile.filter((result) => !result.ok),
    ...results.desktop.filter((result) => !result.ok),
    ...results.amazonRouteCoverage.filter((result) => !result.ok),
  ];
  if (results.tracking?.ok === false) failures.push(results.tracking);
  if (results.crossRouteSuppression?.ok === false) {
    failures.push(results.crossRouteSuppression);
  }
  const badConsoleMessages = results.consoleMessages.filter(
    (message) =>
      /hydration|did not match|error|exception/i.test(message) &&
      !/\[vite\] failed to connect to websocket/i.test(message) &&
      !/Failed to fetch manifest patches/i.test(message),
  );
  if (badConsoleMessages.length) {
    failures.push({
      ok: false,
      scenario: "console",
      messages: badConsoleMessages,
    });
  }

  console.log(JSON.stringify(results, null, 2));

  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exit(1);
  }
}

async function checkLegalTrustRoute(client, route, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  await delay(1600);

  const state = await evaluate(client, `(() => {
    const ads = Array.from(document.querySelectorAll('[aria-label="Advertisement"]'));
    const monetization = Array.from(document.querySelectorAll('[data-monetization-kind]'));
    const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
    const fallback = document.querySelector('[data-monetization-kind="adsense"]');
    const allToolsAd = document.querySelector('ins.adsbygoogle[data-ad-slot="8102088582"]');
    const adsenseScripts = Array.from(document.querySelectorAll('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'));
    const visibleAdSlots = ${visibleAdSlotsExpression()};
    const visibleAdElements = Array.from(document.querySelectorAll('ins.adsbygoogle[data-ad-slot]'))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0";
      });
    return {
      route: window.location.pathname,
      width: window.innerWidth,
      adCount: ads.length,
      monetizationCount: monetization.length,
      affiliateCount: affiliate ? 1 : 0,
      fallbackCount: fallback ? 1 : 0,
      allToolsAdCount: allToolsAd ? 1 : 0,
      adsenseScriptCount: adsenseScripts.length,
      visibleAdSlots,
      visibleAdCount: visibleAdElements.length,
      duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  return {
    scenario: "legal-trust-exclusion",
    route,
    width,
    ...state,
    ok:
      state.route === route &&
      state.adCount === 0 &&
      state.monetizationCount === 0 &&
      state.affiliateCount === 0 &&
      state.fallbackCount === 0 &&
      state.allToolsAdCount === 0 &&
      state.adsenseScriptCount === 0 &&
      state.visibleAdCount === 0 &&
      state.duplicateVisibleAdSlots.length === 0 &&
      !state.overflow,
  };
}

async function checkDocsHelpRoute(client, route, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  await delay(1700);
  await evaluate(
    client,
    `document.querySelector('[data-monetization-slot="docs-help-compact"]')?.scrollIntoView({ block: "center" })`,
  );
  await delay(300);

  const state = await evaluate(client, `(() => {
    const docsAd = document.querySelector('[data-monetization-slot="docs-help-compact"][data-monetization-kind="adsense"]');
    const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
    const pending = document.querySelector('[data-monetization-kind="pending"]');
    const contextualFallback = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
    const docsIns = docsAd?.querySelector('ins.adsbygoogle[data-ad-slot]');
    const rect = docsAd?.getBoundingClientRect?.();
    const visibleAdSlots = ${visibleAdSlotsExpression()};
    return {
      route: window.location.pathname,
      width: window.innerWidth,
      docsAdCount: docsAd ? 1 : 0,
      docsSlot: docsIns?.getAttribute('data-ad-slot') || null,
      docsReserve: docsAd?.getAttribute('data-monetization-reserve') || null,
      affiliateCount: affiliate ? 1 : 0,
      pendingCount: pending ? 1 : 0,
      contextualFallbackCount: contextualFallback ? 1 : 0,
      height: rect?.height || 0,
      visibleAdSlots,
      duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  return {
    scenario: "docs-help-compact-ad-policy",
    route,
    width,
    ...state,
    ok:
      state.route === route &&
      state.docsAdCount === 1 &&
      state.docsSlot === "8102088582" &&
      state.docsReserve === "compact" &&
      state.affiliateCount === 0 &&
      state.pendingCount === 0 &&
      state.contextualFallbackCount === 0 &&
      state.height <= 220 &&
      state.duplicateVisibleAdSlots.length === 0 &&
      !state.overflow,
  };
}

async function checkContextualCompactAdRoute(client, route, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  await delay(1700);
  await evaluate(
    client,
    `document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]')?.scrollIntoView({ block: "center" })`,
  );
  await delay(300);

  const state = await evaluate(client, `(() => {
    const fallback = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
    const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
    const pending = document.querySelector('[data-monetization-kind="pending"]');
    const rect = fallback?.getBoundingClientRect?.();
    const fallbackVisible = Boolean(rect && rect.width > 0 && rect.height > 0);
    const visibleAdSlots = ${visibleAdSlotsExpression()};
    return {
      route: window.location.pathname,
      width: window.innerWidth,
      fallbackCount: fallback ? 1 : 0,
      fallbackReserve: fallback?.getAttribute('data-monetization-reserve') || null,
      affiliateCount: affiliate ? 1 : 0,
      pendingCount: pending ? 1 : 0,
      fallbackVisible,
      fallbackHeight: rect?.height || 0,
      visibleAdSlots,
      duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);
  const expectsVisibleFallback = width >= 1024;
  const fallbackPolicyOk = expectsVisibleFallback
    ? (state.fallbackCount === 1 &&
        state.fallbackReserve === "compact" &&
        state.fallbackVisible &&
        state.fallbackHeight <= 220) ||
      state.affiliateCount === 1 ||
      state.visibleAdSlots.length >= 1
    : state.fallbackCount === 0 || state.fallbackReserve === "compact";

  return {
    scenario: "contextual-compact-ad-policy",
    route,
    width,
    ...state,
    ok:
      state.route === route &&
      state.pendingCount === 0 &&
      fallbackPolicyOk &&
      state.duplicateVisibleAdSlots.length === 0 &&
      !state.overflow,
  };
}

async function checkServerReservedShell() {
  const response = await fetch(`${baseUrl}${stickerRoute}`);
  const html = await response.text();
  const hasAdsense = html.includes('data-monetization-kind="adsense"');
  const hasPending = html.includes('data-monetization-kind="pending"');
  const hasSlot = html.includes('data-monetization-slot="converter-below-tool"');
  const reserveStart = html.indexOf('data-monetization-kind="adsense"');
  const reserveMarkup =
    reserveStart >= 0
      ? html.slice(Math.max(0, reserveStart - 500), reserveStart + 500)
      : "";
  const mobileHidden =
    /\bhidden\b/.test(reserveMarkup) && /\blg:block\b/.test(reserveMarkup);
  return {
    scenario: "server-reserved-shell",
    hasAdsense,
    hasPending,
    hasSlot,
    mobileHidden,
    ok: response.ok && !hasPending,
  };
}

async function checkMobileAffiliate(client, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  await delay(1300);

  const state = await evaluate(client, `(() => {
    const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
    const slotAdsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
    const slotAdsenseRect = slotAdsense?.getBoundingClientRect?.();
    const slotAdsenseStyle = slotAdsense ? window.getComputedStyle(slotAdsense) : null;
    const ads = Array.from(document.querySelectorAll('[aria-label="Advertisement"]'));
    const visibleAdSlots = ${visibleAdSlotsExpression()};
    const stored = window.localStorage.getItem(${JSON.stringify(storageKey)});
    const scrollWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    return {
      width: viewportWidth,
      affiliateCount: affiliate ? 1 : 0,
      slotAdsenseCount: slotAdsense ? 1 : 0,
      slotAdsenseVisible: Boolean(slotAdsenseRect && slotAdsenseRect.width > 0 && slotAdsenseRect.height > 0 && slotAdsenseStyle?.display !== "none" && slotAdsenseStyle?.visibility !== "hidden"),
      adCount: ads.length,
      visibleAdSlots,
      duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
      stored,
      scrollWidth,
      overflow: scrollWidth > viewportWidth + 2,
    };
  })()`);

  await markAmazonOfferTimedOut(client);
  await reload(client);
  await delay(1300);

  const fallbackState = await evaluate(client, `(() => {
    const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
    const slotAdsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
    const slotAdsenseRect = slotAdsense?.getBoundingClientRect?.();
    const slotAdsenseStyle = slotAdsense ? window.getComputedStyle(slotAdsense) : null;
    const ads = Array.from(document.querySelectorAll('[aria-label="Advertisement"]'));
    const visibleAdSlots = ${visibleAdSlotsExpression()};
    return {
      affiliateCount: affiliate ? 1 : 0,
      slotAdsenseCount: slotAdsense ? 1 : 0,
      slotAdsenseVisible: Boolean(slotAdsenseRect && slotAdsenseRect.width > 0 && slotAdsenseRect.height > 0 && slotAdsenseStyle?.display !== "none" && slotAdsenseStyle?.visibility !== "hidden"),
      adCount: ads.length,
      visibleAdSlots,
      duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
    };
  })()`);
  await clearAffiliateStorage(client);

  return {
    scenario: "mobile-affiliate-suppressed-by-nearby-ad",
    width,
    ...state,
    fallbackState,
    ok:
      state.affiliateCount === 0 &&
      state.slotAdsenseVisible === false &&
      state.adCount >= 1 &&
      state.duplicateVisibleAdSlots.length === 0 &&
      !state.stored &&
      fallbackState.affiliateCount === 0 &&
      fallbackState.slotAdsenseVisible === false &&
      fallbackState.adCount >= 1 &&
      fallbackState.duplicateVisibleAdSlots.length === 0 &&
      !state.overflow,
  };
}

async function checkDesktopAffiliate(client, width) {
  await clearAffiliateStorage(client);
  await reload(client);
  const state = await waitForValue(
    client,
    () => `(() => {
      const affiliate = document.querySelector('[data-monetization-slot="desktop-mid-page-waterfall"][data-monetization-kind="affiliate"]');
      const affiliateLink = document.querySelector('[data-affiliate-offer-id="amazon-printable-vinyl-sticker-paper"]');
      const adsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const rect = affiliate?.getBoundingClientRect?.();
      const visibleAdSlots = ${visibleAdSlotsExpression()};
      return {
        width: window.innerWidth,
        affiliateCount: affiliate ? 1 : 0,
        adsenseCount: adsense ? 1 : 0,
        offerId: affiliateLink?.getAttribute('data-affiliate-offer-id') || null,
        provider: affiliateLink?.getAttribute('data-affiliate-provider') || null,
        href: affiliateLink?.getAttribute('href') || null,
        height: rect?.height || 0,
        visible: Boolean(rect && rect.width > 0 && rect.height > 0),
        visibleAdSlots,
        duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    })()`,
    8000,
    (state) => state?.affiliateCount === 1,
  );

  return {
    scenario: "desktop-amazon-affiliate-default",
    width,
    ...state,
    ok:
      state.affiliateCount === 1 &&
      state.adsenseCount === 0 &&
      state.offerId === "amazon-printable-vinyl-sticker-paper" &&
      state.provider === "amazon" &&
      /amzn\.to/i.test(state.href || "") &&
      state.height >= 180 &&
      state.visible &&
      state.duplicateVisibleAdSlots.length === 0 &&
      !state.overflow,
  };
}

async function checkAmazonAffiliateRoute(client, route) {
  await clearAffiliateStorage(client);
  await reload(client);

  const eligible = await waitForValue(
    client,
    () => `(() => {
      const affiliate = document.querySelector('[data-monetization-slot="desktop-mid-page-waterfall"][data-monetization-kind="affiliate"]');
      const adsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const affiliateLinks = Array.from(document.querySelectorAll('[data-monetization-kind="affiliate"] a[href], [data-affiliate-provider="amazon"][href]'))
        .map((link) => link.getAttribute('href') || "");
      const rect = affiliate?.getBoundingClientRect?.();
      const affiliateLink = document.querySelector('[data-affiliate-offer-id="amazon-printable-vinyl-sticker-paper"]');
      return {
        route: window.location.pathname,
        affiliateCount: affiliate ? 1 : 0,
        adsenseCount: adsense ? 1 : 0,
        offerId: affiliateLink?.getAttribute('data-affiliate-offer-id') || null,
        provider: affiliateLink?.getAttribute('data-affiliate-provider') || null,
        height: rect?.height || 0,
        visible: Boolean(rect && rect.width > 0 && rect.height > 0),
        hasAmazonHref: affiliateLinks.some((href) => /amzn\\.to/i.test(href)),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    })()`,
    8000,
    (state) => state?.affiliateCount === 1,
  );

  await markAmazonOfferTimedOut(client, route);
  await reload(client);

  const fallback = await waitForValue(
    client,
    () => `(() => {
      const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
      const fallback = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const rect = fallback?.getBoundingClientRect?.();
      const fallbackSlot = fallback?.querySelector('ins.adsbygoogle[data-ad-slot]')?.getAttribute('data-ad-slot') || null;
      return {
        affiliateCount: affiliate ? 1 : 0,
        adsenseCount: fallback ? 1 : 0,
        reserve: fallback?.getAttribute('data-monetization-reserve') || null,
        fallbackSlot,
        height: rect?.height || 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    })()`,
    8000,
    (state) => state?.adsenseCount === 1,
  );

  await clearAffiliateStorage(client);

  return {
    scenario: "adsense-default-route-coverage",
    route,
    eligible,
    fallback,
    ok:
      eligible.route === route &&
      eligible.affiliateCount === 1 &&
      eligible.adsenseCount === 0 &&
      eligible.offerId === "amazon-printable-vinyl-sticker-paper" &&
      eligible.provider === "amazon" &&
      eligible.height >= 180 &&
      eligible.visible &&
      eligible.hasAmazonHref &&
      !eligible.overflow &&
      fallback.affiliateCount === 0 &&
      fallback.adsenseCount === 1 &&
      fallback.reserve === "compact" &&
      fallback.fallbackSlot !== legacyCompactFallbackSlot &&
      fallback.height <= 260 &&
      !fallback.overflow,
  };
}

async function checkTrackingAndFallback(client) {
  await clearAffiliateStorage(client);
  await reload(client);

  const initial = await waitForValue(
    client,
    () => `(() => {
      const adsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const affiliate = document.querySelector('[data-monetization-slot="desktop-mid-page-waterfall"][data-monetization-kind="affiliate"]');
      const affiliateLink = document.querySelector('[data-affiliate-offer-id="amazon-printable-vinyl-sticker-paper"]');
      const rect = affiliate?.getBoundingClientRect?.();
      return {
        adsense: Boolean(adsense),
        affiliate: Boolean(affiliate),
        offerId: affiliateLink?.getAttribute('data-affiliate-offer-id') || null,
        provider: affiliateLink?.getAttribute('data-affiliate-provider') || null,
        height: rect?.height || 0,
        storedWaterfall: window.localStorage.getItem(${JSON.stringify(storageKey)}),
        storedSuppression: window.sessionStorage.getItem(${JSON.stringify(suppressionStorageKey)}),
      };
    })()`,
    8000,
    (state) => state?.affiliate === true && Boolean(state?.storedWaterfall),
  );

  await markAmazonOfferTimedOut(client);
  await reload(client);

  const afterSeededViewCap = await waitForValue(
    client,
    () => `(() => {
      const adsense = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
      const rect = adsense?.getBoundingClientRect?.();
      const visibleAdSlots = ${visibleAdSlotsExpression()};
      const storedSuppression = window.sessionStorage.getItem(${JSON.stringify(suppressionStorageKey)});
      const fallbackSlot = adsense?.querySelector('ins.adsbygoogle[data-ad-slot]')?.getAttribute('data-ad-slot') || null;
      return {
        adsense: Boolean(adsense),
        affiliate: Boolean(affiliate),
        reserve: adsense?.getAttribute('data-monetization-reserve') || null,
        fallbackSlot,
        height: rect?.height || 0,
        visibleAdSlots,
        duplicateVisibleAdSlots: visibleAdSlots.filter((slot, index) => visibleAdSlots.indexOf(slot) !== index),
        storedSuppression,
      };
    })()`,
    8000,
    (state) => state?.adsense === true,
  );

  return {
    scenario: "amazon-waterfall-to-adsense-fallback",
    initial,
    afterSeededViewCap,
    ok:
      initial.adsense === false &&
      initial.affiliate === true &&
      initial.offerId === "amazon-printable-vinyl-sticker-paper" &&
      initial.provider === "amazon" &&
      initial.height >= 180 &&
      Boolean(initial.storedWaterfall) &&
      !initial.storedSuppression &&
      afterSeededViewCap.adsense === true &&
      afterSeededViewCap.affiliate === false &&
      afterSeededViewCap.reserve === "compact" &&
      afterSeededViewCap.fallbackSlot !== legacyCompactFallbackSlot &&
      afterSeededViewCap.height <= 260 &&
      !afterSeededViewCap.storedSuppression &&
      afterSeededViewCap.duplicateVisibleAdSlots.length === 0,
  };
}

async function checkCrossRouteSuppressionAndFallbackLayout(client) {
  await clearAffiliateStorage(client);
  await markAmazonOfferTimedOut(client);
  await reload(client);

  const fallback = await waitForValue(
    client,
    () => `(() => {
      const fallback = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
      const rect = fallback?.getBoundingClientRect?.();
      const storedSuppression = window.sessionStorage.getItem(${JSON.stringify(suppressionStorageKey)});
      const fallbackSlot = fallback?.querySelector('ins.adsbygoogle[data-ad-slot]')?.getAttribute('data-ad-slot') || null;
      return {
        adsense: Boolean(fallback),
        affiliate: Boolean(affiliate),
        reserve: fallback?.getAttribute('data-monetization-reserve') || null,
        fallbackSlot,
        height: rect?.height || 0,
        storedSuppression,
      };
    })()`,
    8000,
    (state) => state?.adsense === true,
  );

  await navigate(client, `${baseUrl}${routeAfterSuppression}`);
  const afterNavigation = await waitForValue(
    client,
    () => `(() => {
      const affiliate = document.querySelector('[data-monetization-kind="affiliate"]');
      const fallback = document.querySelector('[data-monetization-slot="converter-below-tool"][data-monetization-kind="adsense"]');
      const rect = fallback?.getBoundingClientRect?.();
      const storedSuppression = window.sessionStorage.getItem(${JSON.stringify(suppressionStorageKey)});
      const fallbackSlot = fallback?.querySelector('ins.adsbygoogle[data-ad-slot]')?.getAttribute('data-ad-slot') || null;
      return {
        route: window.location.pathname,
        affiliate: Boolean(affiliate),
        adsense: Boolean(fallback),
        reserve: fallback?.getAttribute('data-monetization-reserve') || null,
        fallbackSlot,
        height: rect?.height || 0,
        storedSuppression,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    })()`,
    8000,
    (state) => state?.adsense === true,
  );

  return {
    scenario: "cross-route-waterfall-bypass-and-compact-fallback",
    firstRoute: stickerRoute,
    nextRoute: routeAfterSuppression,
    fallback,
    afterNavigation,
    ok:
      fallback.adsense === true &&
      fallback.affiliate === false &&
      fallback.reserve === "compact" &&
      fallback.fallbackSlot !== legacyCompactFallbackSlot &&
      fallback.height <= 260 &&
      !fallback.storedSuppression &&
      afterNavigation.route === routeAfterSuppression &&
      afterNavigation.adsense === true &&
      afterNavigation.affiliate === false &&
      afterNavigation.reserve === "compact" &&
      afterNavigation.fallbackSlot !== legacyCompactFallbackSlot &&
      afterNavigation.height <= 260 &&
      !afterNavigation.storedSuppression &&
      !afterNavigation.overflow,
  };
}

async function markAmazonOfferTimedOut(client, routeContext = stickerRoute) {
  await evaluate(client, `(() => {
    const state = {
      impressions: 5,
      cooldownUntil: Date.now() + 15 * 24 * 60 * 60 * 1000,
      clicked: false,
      lastShownAt: Date.now()
    };
    window.localStorage.setItem(${JSON.stringify(storageKey)}, JSON.stringify(state));
    window.sessionStorage.removeItem(${JSON.stringify(suppressionStorageKey)});
    return true;
  })()`);
}

function visibleAdSlotsExpression() {
  return `Array.from(document.querySelectorAll('ins.adsbygoogle[data-ad-slot]'))
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
    })
    .map((node) => node.getAttribute('data-ad-slot'))`;
}

async function collectConsoleSignals(client) {
  const messages = [];
  client.onEvent((message) => {
    if (message.method === "Runtime.consoleAPICalled") {
      messages.push(
        (message.params.args || [])
          .map((arg) => arg.value || arg.description || "")
          .join(" ")
          .trim(),
      );
    }
    if (message.method === "Runtime.exceptionThrown") {
      messages.push(message.params.exceptionDetails?.text || "Runtime exception");
    }
  });
  await client.send("Runtime.enable");
  await reload(client);
  await delay(2500);
  return messages.filter(Boolean);
}

async function waitForWaterfallEntry(client, offerId, predicate) {
  return waitForValue(
    client,
    () => `(() => {
      const raw = window.localStorage.getItem(${JSON.stringify(storageKey)});
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state.entries.find((entry) =>
        entry.offerId === ${JSON.stringify(offerId)} &&
        entry.slotId === "converter-below-tool" &&
        entry.routeContext === ${JSON.stringify(stickerRoute)}
      ) || null;
    })()`,
    8000,
    predicate,
  );
}

async function openPage(pathname, width, height) {
  const url = `${baseUrl}${pathname}`;
  const target = await createCdpTarget("about:blank");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  client.targetId = target.id;
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await client.navigate(url);
  return client;
}

async function reload(client) {
  await client.send("Page.reload", { ignoreCache: true });
  await waitForValue(
    client,
    () => `(() => document.readyState)()`,
    20_000,
    (state) => state === "interactive" || state === "complete",
  );
  await delay(500);
}

async function navigate(client, url) {
  await client.navigate(url);
}

async function clearAffiliateStorage(client) {
  await evaluate(client, `(() => {
    window.localStorage.removeItem(${JSON.stringify(storageKey)});
    window.sessionStorage.removeItem(${JSON.stringify(suppressionStorageKey)});
    return true;
  })()`);
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30_000).unref?.();
    });
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await waitForValue(
      this,
      () => `(() => ({
        readyState: document.readyState,
        href: window.location.href,
        bodyChildCount: document.body?.children.length || 0
      }))()`,
      20_000,
      (state) =>
        state.readyState === "interactive" ||
        state.readyState === "complete" ||
        (state.href === url && state.bodyChildCount > 0),
    );
    await delay(500);
  }

  close() {
    return (async () => {
      if (this.targetId) {
        await closeCdpTarget(this.targetId).catch(() => {});
        this.targetId = null;
      }
      await new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
      });
    })();
  }
}

async function closeCdpTarget(targetId) {
  const browserInfo = await cdpJson("/json/version");
  if (!browserInfo.webSocketDebuggerUrl) return;

  const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browserWs.addEventListener("open", resolve, { once: true });
    browserWs.addEventListener("error", reject, { once: true });
  });

  const browserClient = new CdpClient(browserWs);
  await browserClient.send("Target.closeTarget", { targetId }).catch(() => {});
  await new Promise((resolve) => {
    browserWs.addEventListener("close", resolve, { once: true });
    browserWs.close();
    setTimeout(resolve, 500).unref?.();
  });
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory());
    if (isReady(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
  if (browserInfo.webSocketDebuggerUrl) {
    try {
      const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        browserWs.addEventListener("open", resolve, { once: true });
        browserWs.addEventListener("error", reject, { once: true });
      });
      const browserClient = new CdpClient(browserWs);
      const { targetId } = await browserClient.send("Target.createTarget", {
        url,
        newWindow: false,
        background: false,
      });
      await browserClient.close().catch(() => {});
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const targets = await cdpJson("/json/list");
        const target = targets.find((candidate) => candidate.id === targetId);
        if (target?.webSocketDebuggerUrl) return target;
        await delay(150);
      }
    } catch {
      // Fall through to /json/new.
    }
  }

  return cdpJson(`/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
}

async function waitForCdp() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await cdpJson("/json/version");
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("Timed out waiting for browser CDP endpoint.");
}

async function cdpJson(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function assertServerReachable() {
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Base URL ${baseUrl} returned ${response.status}`);
  }
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No Chromium-family browser executable found for monetization browser smoke.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
