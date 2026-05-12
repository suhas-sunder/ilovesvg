# Phase Monetization-A: Ad and Affiliate Coverage Audit

Date: 2026-05-11
Branch: `final-refactor-and-polish-may-10-v2`
Baseline commit confirmed: `d3a5fb8 seo: improve SVG resizer platform content`

This is a report-only audit. No monetization code, route behavior, SEO metadata, sitemap behavior, navigation grouping, conversion behavior, upload validation, presets, or output behavior was changed.

## 1. Executive Summary

The current monetization system covers most converter, SVG editor, craft, marketplace, and utility pages through shared converter/editor route shells. The route manifest currently exposes 138 public route entries, including 10 redirect-style aliases. Server-rendered inspection found monetization markers on 119 non-redirect pages, no server-rendered monetization on 9 non-redirect pages, and redirects on 10 entries.

The biggest coverage issue is not broad missing converter monetization. The shared shells are doing most of that work. The highest-risk issues are:

- Legal/trust routes are inconsistent: `/privacy-policy` and `/cookies` inherit the All Tools compact ad, while `/terms-of-service` has no server-rendered monetization. If trust pages should be clean, privacy and cookies need exclusion handling.
- Documentation routes under `/how-it-works` have no server-rendered monetization. That may be acceptable if docs stay education-first, but it should be a deliberate policy.
- Several compact fallback pages show duplicate visible AdSense slot id `7336722354` at desktop widths when the contextual fallback and another page ad are both visible. This needs implementation review before changing placement volume.
- `/sitemap` has no server-rendered monetization. It should probably stay compact-ad-only or excluded, depending on whether the sitemap is treated as utility navigation or trust/meta content.
- `/pro-waitlist` has no server-rendered monetization. This is likely appropriate because it is an owned conversion page.

Representative browser verification across 26 routes and five viewport widths found no horizontal overflow and no missing hydrated monetization marker on the sampled converter/editor routes. Mobile contextual affiliate cards were suppressed below the desktop breakpoint as intended. The browser sweep did surface the duplicate visible fallback slot issue and an existing privacy policy HTML nesting warning unrelated to monetization.

Recommended first implementation phase: **Monetization-B: legal/trust exclusions and fallback-slot hygiene**.

## 2. Monetization Components and Current Policy

### Ad Components

- `app/client/components/ads/AdsenseDelayed.tsx`
  - Renders the delayed AdSense wrapper.
  - Uses `aria-label="Advertisement"`.
  - Supports delayed loading, optional placeholder, minimum height, slot id, format, and full-width behavior.
  - Global AdSense script is loaded in `app/root.tsx`.

- `app/client/components/navigation/OtherToolsLinks.tsx`
  - Renders the All Tools section.
  - Includes a compact All Tools ad slot `8102088582`.
  - Includes a long-content route guide ad slot `2346286299`.
  - This means routes that include `OtherToolsLinks` can inherit monetization even if they are legal or static pages.

### Affiliate Components

- `app/client/components/ads/ContextualAffiliateCard.tsx`
  - Primary contextual affiliate placement.
  - Slot id: `converter-below-tool`.
  - SSR pending marker: `data-monetization-kind="pending"`.
  - Affiliate marker: `data-monetization-kind="affiliate"`.
  - Compact fallback marker: `data-monetization-kind="adsense"`.
  - Desktop affiliate reserve uses `min-h-[39rem]`.
  - Compact fallback uses `min-h-[11rem]`.
  - Mobile suppression is enabled when adjacent ad inventory exists.

### Affiliate Provider Data

- `app/client/lib/monetization/affiliateProviders.ts`
  - Active providers: Printify and Sticker Mule.
  - Cricut is configured as disabled or pending.

- `app/client/lib/monetization/affiliateOffers.ts`
  - Active offers:
    - Printify, for stickers, print-on-demand, ecommerce, logos/icons, layered SVG, and related conversion intents.
    - Sticker Mule, for sticker, Print Then Cut, and vinyl-adjacent intents.

- `app/client/lib/monetization/affiliateRouteIntents.ts`
  - Maps routes to affiliate intent categories.
  - Unknown routes fall back to `general-svg-conversion`.
  - Technical routes map to `technical-utility`, which usually results in compact fallback rather than affiliate.

### Waterfall, Fallback, and Suppression Policy

- `app/client/lib/monetization/useAffiliateWaterfall.ts`
  - Chooses an eligible active affiliate offer by route intent and waterfall state.

- `app/client/lib/monetization/affiliateWaterfallStorage.ts`
  - Local storage key: `ilovesvg:affiliate-waterfall:v1`.

- `app/client/lib/monetization/affiliateVisibility.ts`
  - Session suppression key: `ilovesvg:affiliate-suppression:v1`.
  - View cap: 5.
  - Suppression happens after click or after the view cap.

- `app/client/lib/monetization/affiliateResponsive.ts`
  - Mobile suppression breakpoint: 1024 px.
  - Suppresses the contextual AdSense fallback on mobile when adjacent ad inventory exists.

## 3. Route Monetization Inventory Summary

### Route Manifest Summary

Inventory source: `app/data/routeManifest.ts`

| Route family | Count | Expected monetization direction |
|---|---:|---|
| raster-to-svg | 19 | Affiliate where relevant, otherwise compact fallback |
| svg-export | 23 | Affiliate where relevant, otherwise compact fallback |
| svg-editor | 20 | Mostly compact fallback, affiliate only where platform intent is strong |
| cricut-craft | 37 | Affiliate where relevant, compact fallback otherwise |
| layered-svg | 8 | Affiliate where relevant, compact fallback otherwise |
| text-base64-code | 10 | Compact ad or contextual fallback, no forced affiliate |
| documentation | 7 | Compact ad only or intentionally excluded by docs policy |
| legal | 3 | Intentionally excluded recommended |
| redirect | 10 | No monetization, redirect only |
| sitemap-meta | 1 | Compact ad only or intentionally excluded |

Total route entries: 138.

### Server-Rendered Coverage

Server route inventory was fetched from `http://localhost:3000` using the route manifest.

| Actual server-rendered marker | Count | Meaning |
|---|---:|---|
| Pending affiliate marker | 68 | Shared shell includes `ContextualAffiliateCard`, affiliate eligibility is resolved after hydration |
| AdSense-only marker | 51 | Compact fallback or page ad present without affiliate marker |
| No monetization marker | 9 | No SSR ad or affiliate marker found |
| Redirect | 10 | Redirect-style route entries |

The 9 non-redirect pages with no server-rendered monetization marker were:

- `/how-it-works`
- `/how-it-works/conversion-workflow`
- `/how-it-works/presets`
- `/how-it-works/settings`
- `/how-it-works/troubleshooting`
- `/how-it-works/exporting-and-downloads`
- `/pro-waitlist`
- `/terms-of-service`
- `/sitemap`

### Legal and Trust Route Snapshot

| Route | Server-rendered monetization found | Notes |
|---|---|---|
| `/privacy-policy` | Yes, All Tools ad slot `8102088582` | Inherits `OtherToolsLinks`; should be excluded if legal pages must be ad-free |
| `/cookies` | Yes, All Tools ad slot `8102088582` | Inherits `OtherToolsLinks`; should be excluded if legal pages must be ad-free |
| `/terms-of-service` | No SSR marker | Browser sweep saw an ad marker later, so this route needs isolated verification before implementation |

### Representative Route Snapshot

| Route | Server-rendered marker | Browser result |
|---|---|---|
| `/` | Pending affiliate plus ads | Desktop affiliate visible, mobile contextual affiliate suppressed |
| `/png-to-svg-converter` | Pending affiliate plus ads | Desktop affiliate visible |
| `/jpg-to-svg-converter` | Pending affiliate plus ads | Desktop affiliate visible |
| `/svg-to-png-converter` | Pending affiliate plus ads | Desktop affiliate visible |
| `/svg-to-pdf-converter` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/png-to-svg-for-cricut` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/png-to-svg-for-cricut-stickers` | Pending affiliate plus ads | Desktop affiliate visible |
| `/sticker-to-svg-for-cricut` | Pending affiliate plus ads | Desktop affiliate visible |
| `/image-to-svg-for-etsy` | Pending affiliate plus ads | Desktop affiliate visible |
| `/png-to-svg-for-shopify` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/svg-to-png-for-printify` | Pending affiliate plus ads | Desktop affiliate visible |
| `/svg-to-png-for-printful` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/svg-cleaner` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/svg-resize-and-scale-editor` | Pending affiliate plus ads | Desktop affiliate visible |
| `/svg-cleaner-for-figma` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/svg-resizer-for-canva` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/svg-background-editor` | Pending affiliate plus ads | Desktop affiliate visible |
| `/svg-preview-viewer` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/svg-to-base64` | Compact fallback plus ads | Desktop compact fallback visible, duplicate slot id risk |
| `/text-to-svg-converter` | Pending affiliate plus ads | Desktop affiliate visible |

## 4. Expected Monetization Policy by Route Type

Recommended policy for a future implementation pass:

| Route type | Expected policy | Rationale |
|---|---|---|
| Core converters | Affiliate with compact fallback | High-intent tool traffic and relevant offers |
| Craft, Cricut, sticker, marketplace, platform wrappers | Affiliate with compact fallback where route intent matches active offers | Strong commercial intent, but only when the offer is relevant |
| Print-on-demand routes | Affiliate where an active matching provider exists, compact fallback otherwise | Printify is active; Printful currently lacks a matching active offer |
| SVG editor utility routes | Compact ad or contextual fallback | Many are technical workflows where affiliate intent is weak |
| Developer/code utility routes | Compact ad only | Base64, JSX, text, and code users should not receive unrelated seller/craft affiliate copy |
| Docs/help pages | Compact ad only or no monetization by policy | Educational content should stay readable and support user success |
| Legal/trust pages | No monetization | Trust pages should avoid ad or affiliate clutter |
| Pro/waitlist | No monetization recommended | Owned conversion funnel should stay focused |
| Sitemap/meta/API/redirect routes | No monetization, except optional compact ad on human sitemap | Low utility for monetization and higher policy risk |

## 5. Coverage Gaps Found

### Documentation Pages

The `/how-it-works` family currently has no server-rendered ad or affiliate marker:

- `/how-it-works`
- `/how-it-works/conversion-workflow`
- `/how-it-works/presets`
- `/how-it-works/settings`
- `/how-it-works/troubleshooting`
- `/how-it-works/exporting-and-downloads`

This is not necessarily a bug. These pages may intentionally stay clean and education-first. If the site wants monetization on docs, use compact ad only. Do not add affiliate placements unless a route has clear commercial intent.

### Sitemap

`/sitemap` has no server-rendered monetization marker. This should be either:

- intentionally excluded as a meta/navigation page, or
- compact-ad-only if the sitemap is expected to monetize long-tail navigation traffic.

### Pro Waitlist

`/pro-waitlist` has no server-rendered monetization marker. This should probably stay excluded because monetization could distract from the owned waitlist action.

### Affiliate Intent Gaps

Some routes currently receive compact fallback because they do not map to an active affiliate offer:

- `/png-to-svg-for-shopify`
- `/svg-to-png-for-printful`
- technical SVG utility routes such as `/svg-cleaner`, `/svg-preview-viewer`, and `/svg-to-base64`

This is preferable to showing unrelated affiliate copy. A future pass can review whether Shopify or Printful should have active contextual offers, but that should not be solved by forcing generic affiliate content.

## 6. Incorrect Placements Found

### Legal or Trust Pages With Monetization

`/privacy-policy` and `/cookies` inherit the All Tools compact ad slot through `OtherToolsLinks`. If legal and trust pages should avoid monetization, those pages need an exclusion mechanism.

`/terms-of-service` had no server-rendered monetization marker, but the representative browser sweep saw an ad marker. This should be verified in an isolated browser session before changing code.

### Duplicate Visible AdSense Slot Id

The browser sweep found duplicate visible use of AdSense slot id `7336722354` at desktop widths on these sampled routes:

- `/svg-to-pdf-converter`
- `/png-to-svg-for-cricut`
- `/png-to-svg-for-shopify`
- `/svg-to-png-for-printful`
- `/svg-cleaner`
- `/svg-cleaner-for-figma`
- `/svg-resizer-for-canva`
- `/svg-preview-viewer`
- `/svg-to-base64`

This appears when the contextual compact fallback and another visible page ad both use the same slot id. A future implementation should either assign a distinct fallback slot or prevent two visible instances of the same slot id from rendering together.

### Placement Above Utility

No sampled route showed the contextual affiliate card above the primary tool. The desktop ad above the utility matches the current project layout guidance. Mobile contextual affiliate and fallback suppression kept the tool primary on narrow screens.

## 7. Legal and Trust Exclusions

Recommended exclusion list:

- `/privacy-policy`
- `/terms-of-service`
- `/cookies`
- redirect routes
- internal/API/meta routes if any are added later

Recommended separate treatment:

- `/pro-waitlist`, exclude from ads and affiliate because it is an owned conversion page.
- `/sitemap`, decide explicitly. The safest default is no monetization, or one compact ad if the sitemap is treated as a public navigation page.

Legal/trust pages should not show:

- `ContextualAffiliateCard`
- `data-monetization-kind`
- `aria-label="Advertisement"`
- All Tools compact ad slots
- affiliate disclosures tied to commercial offers

## 8. Affiliate Fallback Layout Status

Current behavior:

- Desktop affiliate cards reserve a tall placement area to avoid layout shift.
- Desktop compact fallback uses a smaller reserve.
- Mobile contextual affiliate and fallback are suppressed below 1024 px when adjacent ad inventory exists.
- Session suppression is stored in session storage and triggered by click or view cap.
- Existing `test:monetization-browser` checks affiliate click suppression and cross-route compact fallback behavior on the sticker route.

Observed risks:

- Compact fallback does not create giant blank mobile gaps in sampled routes.
- Duplicate visible slot id `7336722354` appears on compact fallback routes at desktop widths.
- Route-wide suppression behavior is not yet audited across every route family.
- The browser smoke script is strong for the sticker route but not broad enough to prove all public routes have the intended markers.

## 9. Browser Verification Summary

Canonical URL tested: `http://localhost:3000`

Server process check found the canonical app on port 3000. Another listener existed on port 4175, but the audit targeted only `http://localhost:3000`.

Representative routes tested:

- `/`
- `/png-to-svg-converter`
- `/jpg-to-svg-converter`
- `/svg-to-png-converter`
- `/svg-to-pdf-converter`
- `/png-to-svg-for-cricut`
- `/png-to-svg-for-cricut-stickers`
- `/sticker-to-svg-for-cricut`
- `/image-to-svg-for-etsy`
- `/png-to-svg-for-shopify`
- `/svg-to-png-for-printify`
- `/svg-to-png-for-printful`
- `/svg-cleaner`
- `/svg-resize-and-scale-editor`
- `/svg-cleaner-for-figma`
- `/svg-resizer-for-canva`
- `/svg-background-editor`
- `/svg-preview-viewer`
- `/svg-to-base64`
- `/text-to-svg-converter`
- `/how-it-works`
- `/how-it-works/troubleshooting`
- `/privacy-policy`
- `/terms-of-service`
- `/cookies`
- `/pro-waitlist`

Viewport widths tested:

- 320
- 390
- 768
- 1024
- 1440

Results:

- 130 representative route and viewport checks completed.
- No horizontal overflow was found.
- No sampled converter/editor route was missing a hydrated monetization marker.
- Mobile contextual affiliate cards were not visible below 1024 px.
- Desktop affiliate cards appeared on routes with active matching offers.
- Desktop compact fallback appeared on routes without a matching active offer.
- Duplicate visible AdSense slot id `7336722354` appeared on several compact fallback routes.
- Browser console contained Vite development websocket noise.
- `/privacy-policy` showed an existing HTML nesting hydration warning (`ul` inside `p`), unrelated to monetization but worth tracking in a future trust-page cleanup.

## 10. Recommended Implementation Batches

### Monetization-B: Legal/Trust Exclusions and Fallback Slot Hygiene

Scope:

- Exclude `/privacy-policy`, `/terms-of-service`, and `/cookies` from ads and affiliate markers.
- Prevent `OtherToolsLinks` from rendering its compact ad on legal/trust pages.
- Confirm `/terms-of-service` in an isolated browser run.
- Assign a distinct AdSense slot to contextual compact fallback or prevent duplicate visible slot id `7336722354`.
- Add focused tests for excluded trust pages and duplicate visible slot ids.

Why first:

- Legal/trust pages are the highest policy and trust risk.
- Duplicate visible ad slot ids are the clearest technical placement issue.
- This scope is smaller and safer than route-wide monetization expansion.

Risk level: Low to medium. It touches shared monetization rendering and All Tools rendering, but not converter behavior.

### Monetization-C: Docs and Sitemap Monetization Policy

Scope:

- Decide whether `/how-it-works` pages should get compact ad only or stay clean.
- Decide whether `/sitemap` should stay excluded or receive one compact ad.
- Add route-policy tests so this is intentional.

Risk level: Low. Main risk is hurting readability or user trust on support content.

### Monetization-D: Affiliate Intent Mapping Review

Scope:

- Review Shopify, Printful, developer utility, and editor utility route categories.
- Add affiliate only where there is a real active matching provider.
- Keep technical routes compact-ad-only when commercial intent is weak.

Risk level: Medium. The risk is showing irrelevant affiliate content and reducing trust.

## 11. Suggested Future Monetization Tests

Add or extend audits later to verify:

- Every public non-excluded route has one expected monetization marker.
- Legal/trust exclusions have no ad, affiliate, or `data-monetization-kind` marker.
- Redirect routes are excluded.
- No visible viewport has duplicate AdSense slot ids.
- Contextual fallback uses compact reserve and does not leave a full affiliate gap when suppressed.
- Mobile widths below 1024 px do not show contextual affiliate or fallback when adjacent ad suppression is active.
- Docs/help pages follow the explicit selected policy.
- Affiliate suppression persists across route navigation beyond the single sticker route.

Potential scripts to extend:

- `scripts/monetization-audit.mjs`
- `scripts/monetization-browser-smoke.mjs`

## 12. Routes to Defer or Exclude

### Exclude

- `/privacy-policy`
- `/terms-of-service`
- `/cookies`
- redirect routes
- internal/API/meta routes if added later

### Defer Until Policy Decision

- `/how-it-works`
- `/how-it-works/conversion-workflow`
- `/how-it-works/presets`
- `/how-it-works/settings`
- `/how-it-works/troubleshooting`
- `/how-it-works/exporting-and-downloads`
- `/sitemap`
- `/pro-waitlist`

### Defer Until Affiliate Provider Review

- `/png-to-svg-for-shopify`
- `/svg-to-png-for-printful`
- technical SVG utilities where affiliate intent is weak
- developer/code utility routes such as Base64 and JSX tools

## Regression Gates for Any Future Implementation

Before any implementation is called complete:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `npm.cmd run test:monetization`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:monetization-browser`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:accessibility`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

Additional future gate:

- A route-wide monetization audit that asserts expected markers on every public non-excluded route and no markers on legal/trust exclusions.
