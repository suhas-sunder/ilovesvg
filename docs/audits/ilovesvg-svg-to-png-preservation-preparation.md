# iLoveSVG SVG-to-PNG preservation preparation

## 1. Scope

This milestone prepares the SVG-to-PNG route family for a possible later consolidation decision. It adds deterministic preservation gates and a bounded, typed route-context map. It does not add a redirect, remove or alias a route, change a canonical, alter sitemap membership, migrate public copy, or approve consolidation.

Evidence types are identified explicitly:

- Current production behavior was verified from route registration, route manifests, rendered local pages, and production-browser output.
- Pre-change output evidence is a detached production build of the pre-implementation main commit exercised with the same seven-fixture, nine-route harness.
- Seven-fixture equality under equal settings does not by itself prove complete workflow parity or redirect readiness.
- Future transition requirements remain planned work.

## 2. Family routes

Route registration, `app/data/routeManifest.ts`, and `app/client/lib/converter/routeCapabilities.ts` identify nine current family members:

| Context key | Route | Current source |
| --- | --- | --- |
| `base` | `/svg-to-png-converter` | `app/routes/svg-to-png-converter.tsx` |
| `shopify` | `/svg-to-png-for-shopify` | `app/routes/svg-to-png-for-shopify.tsx` |
| `etsy` | `/svg-to-png-for-etsy` | `app/routes/svg-to-png-for-etsy.tsx` |
| `printify` | `/svg-to-png-for-printify` | `app/routes/svg-to-png-for-printify.tsx` |
| `printful` | `/svg-to-png-for-printful` | `app/routes/svg-to-png-for-printful.tsx` |
| `sticker-printing` | `/sticker-to-png-for-printing` | `app/routes/sticker-to-png-for-printing.tsx` |
| `transparent-printing` | `/svg-to-transparent-png-for-printing` | `app/routes/svg-to-transparent-png-for-printing.tsx` |
| `canva` | `/svg-to-png-for-canva` | `app/routes/svg-to-png-for-canva.tsx` |
| `figma` | `/svg-to-png-for-figma` | `app/routes/svg-to-png-for-figma.tsx` |

Each wrapper renders the base production converter. Every route remains public, indexable, self-canonical, and present in both current sitemaps.

## 3. Current route differences

The nine routes intentionally retain distinct URLs, titles, descriptions, H1 values, canonical and Open Graph URLs, platform names, route guides, and public content. Printify and Printful also retain dedicated inline export content in their wrapper modules. The other wrappers obtain route-specific guidance through the current route-guide source.

All nine currently share the same converter defaults:

- width `1024`
- height `1024`
- aspect lock enabled
- quality scale `1`
- transparent canvas background
- solid-background color `#ffffff`
- antialiasing enabled
- fallback filename `converted`

Uploading an SVG replaces the width, height, and output basename with values derived from that SVG. The transparent-printing route currently shares the same transparent default rather than owning a different setting value.

The rendered visible breadcrumb and BreadcrumbList schema currently identify the base `/svg-to-png-converter` tool on every wrapper. This milestone records and preserves that existing behavior. It does not decide the future route-context schema design.

## 4. Shared behavior

`app/routes/svg-to-png-converter.tsx` remains the production owner for SVG parsing, size inference, aspect handling, canvas rasterization, antialiasing, background compositing, preview generation, fullscreen preview, conversion, and PNG download.

The family accepts `image/svg+xml,.svg`. A dropped PNG is rejected on every route with the existing `Please choose an SVG file.` message, without a result or enabled download.

The family exposes a live result and a final converted result. It does not expose a multi-entry history or a Copy PNG action. The existing remove action clears the input, live result, and final result but preserves current settings. A second upload derives its dimensions and filename from the new source while retaining other selected settings.

## 5. Route-context design

`app/client/lib/converter/svgToPngRouteContexts.ts` defines an explicit finite map keyed by the nine registered pathnames. It owns only values already shared or route-specific in the current implementation:

- stable context key and pathname
- current H1 and platform name
- current self-canonical path for auditing
- current input accept value
- exact current defaults
- source-basename filename policy
- existing visible breadcrumb and schema identity
- whether the wrapper owns dedicated inline export content

The converter consumes the current H1, defaults, input accept value, filename fallback, breadcrumb, and schema values from that context. No dynamic query or environment fallback exists. Unknown paths throw instead of silently receiving another route's context. Context objects and shared values are frozen and contain no mutable or unbounded state.

Metadata and canonical ownership remain in the existing route modules and route manifest.

## 6. Files changed

- `app/client/lib/converter/svgToPngRouteContexts.ts`
- `app/routes/svg-to-png-converter.tsx`
- `scripts/converter-parity-audit.mjs`
- `scripts/svg-to-png-preservation-audit.mjs`
- `package.json`
- `docs/audits/ilovesvg-svg-to-png-preservation-preparation.md`

No wrapper route, route registration, route manifest, metadata source, sitemap, public content module, converter algorithm, or All Tools source changed.

## 7. Preservation gates

`npm run test:svg-to-png-preservation` uses the production route-context module, route manifest, rendered pages, and production browser behavior. It verifies:

- all nine registered routes and nine unique context keys
- exact route source, public/indexable status, capability family, and absence of redirects
- distinct self canonicals and unchanged Open Graph URLs
- XML and HTML sitemap membership
- exact rendered title, description, H1, input accept value, and existing schema identity
- current defaults, basename filename policy, and invalid-input behavior
- seven deterministic SVG fixtures on every route
- raw PNG and decoded-pixel equality under equal settings
- PNG dimensions and download filenames
- transparent, partial-alpha, solid-background, and opaque-artwork behavior
- current clear and second-upload behavior
- required controls and route H1 at a 390 by 844 responsive viewport
- absence of a Copy PNG action and multi-entry history
- no new route redirect or canonical consolidation

`scripts/converter-parity-audit.mjs` still uses real route rendering and browser downloads. Fixtures, downloads, browser profiles, and parity reports are created only below an OS temporary directory and removed in `finally` cleanup.

Final validation passed the focused preservation audit, complete converter parity audit, output UX audit, conversion-action smoke test, schema audit, route-coverage audit, SEO audit, navigation audit, route-expansion audit, responsive audit, public-content/schema audit, client-lifecycle audit, typecheck, production build, full `npm test`, and script syntax checks. The production build retained the repository's existing mixed static/dynamic import warnings.

## 8. Fixture matrix

| Fixture | Capability | Current output dimensions |
| --- | --- | --- |
| Transparent and partial alpha | Transparent canvas, partial alpha, opaque artwork | 120 x 80 |
| Opaque fills | Fully opaque shapes and source canvas | 96 x 64 |
| Strokes | Stroke rasterization | 120 x 80 |
| Non-square viewBox | Non-square dimensions and non-zero viewBox origin | 120 x 80 |
| Width only | Height inference from viewBox | 150 x 60 |
| ViewBox only | Width and height inference | 90 x 140 |
| Canvas edges | Artwork touching every canvas edge | 128 x 72 |

Every fixture ran through all nine routes. The invalid-input matrix also dropped a deterministic PNG into every route.

## 9. Output comparisons

A detached production build of pre-implementation main was exercised with the current read-only harness. Each row below was identical across all nine routes:

| Fixture | Raw PNG SHA-256 | Decoded-pixel SHA-256 | Dimensions | Filename |
| --- | --- | --- | --- | --- |
| Transparent and partial alpha | `b1e32dc2d798c7154786093b5b61f30987a7b8a72432b115f50a61183bbf9cee` | `120832406404225fc4210c236eee5e441f84eb746de311f9fffc1f896af92f2c` | 120 x 80 | `transparentSvg.png` |
| Opaque fills | `b838e283fb83a7d9474d495cc6e6d08c5f20ef71cb34af49581bb3199891ff1f` | `5614893e12e33d953aa6ad4e1d89ab29a22beea37523eae7fdbafe45ed5c59f3` | 96 x 64 | `fillsSvg.png` |
| Strokes | `61203930b1c3ac4bedb3d65d2183956271ae35dbcfa9f240990180b68d0fa44a` | `bec90023046efb6d11e759f1c0365858dd4e4bc19337bde38b34a124d2647d95` | 120 x 80 | `strokesSvg.png` |
| Non-square viewBox | `f295cdbecf364ed98a1c1cfabe2180a91fdefe490b25f3ad27f9f4df86c3f0da` | `256247a0f9b7fec04a445d9e52b59b201fd6d9a3dc0e2962b1f5360ffcafa18d` | 120 x 80 | `nonSquareSvg.png` |
| Width only | `10ce99addfa7baaaaba84b296d8d7abdf695d9ce57ee8cfe96f2b6694ac97525` | `3b0c5716f1e264af3c28ef9d67268c7444e8e7bc6b12b358183cedf103e06d92` | 150 x 60 | `widthOnlySvg.png` |
| ViewBox only | `ebdc4051b2dbd9f68459b44a1435d4e8d04a54f569269bf2d592caf10b2d968a` | `3a9d96fdbf67a6737dcaf14b45b3099f3d2d42aadef4f99f4c0454e340fdabce` | 90 x 140 | `viewBoxOnlySvg.png` |
| Canvas edges | `1bffa07dc60e1c5131fef44c31acbb4d2f43bb76807ddc51465fedaaf4361437` | `81d0ef566feaf067ef6a91aa3ed8364eba89e16f5d50cc6044a1141c14003242` | 128 x 72 | `edgeSvg.png` |

The same values pass after the edit for every route. The matrix is byte-identical and pixel-identical across all nine routes under equal settings, with the source basename retained in every filename.

The clear/second-upload workflow retained a selected 2x quality setting. Its second 96 x 64 source produced a 192 x 128 preview and download named `fillsSvg.png`.

Equal output under these settings does not establish content, metadata, context, navigation, or complete workflow parity.

## 10. Browser QA

Rendered desktop review covered all nine routes at 1280 by 720. Each route showed its exact current H1 and self-canonical, upload control, settings access, Download PNG action, and route guidance. The base settings review confirmed the current 1024 by 1024, locked-aspect, 1x, antialiasing, and transparent-background defaults. No application console error was observed in the interactive route review.

Production CDP browser coverage performed 63 fixture exports, nine invalid-input checks, the base clear/second-upload workflow, two solid-background exports, and four responsive checks. The responsive set was the base, Shopify, transparent-printing, and Figma routes at a 390 by 844 CSS viewport. Every required converter control and exact route H1 remained available.

The 390px checks also measured an existing page-wide horizontal overflow: the 375px document client area reported a 973px scroll width on all four sampled routes. The production diff contains no styling or layout change, so this pass did not alter that behavior. It remains a blocker for redirect readiness and requires separately approved visual remediation.

Automated browser runs deliberately block external hosts. Their external-resource `ERR_ADDRESS_INVALID` events are harness isolation evidence, not local conversion failures.

The first full parity attempt after the detached baseline build encountered Vite's local `504 Outdated Optimize Dep` response on the unrelated favicon client bundle. Restarting the current development server refreshed that local cache. The focused favicon family and the subsequent complete parity run passed without a comparison failure.

## 11. Metadata and schema preservation

Every route retained:

- its exact current document title and meta description
- its self-referential canonical
- its matching Open Graph URL
- its current manifest identity and sitemap policy
- its current base SVG-to-PNG visible breadcrumb and BreadcrumbList identity

No metadata, schema, route manifest, sitemap, or breadcrumb transition was implemented. Future consolidation must decide and test context-specific schema and destination behavior before any redirect.

## 12. Remaining blockers

- A retained-page URL contract for the eight platform and printing contexts is not implemented or approved.
- Route-specific public guidance and dedicated Printify/Printful content have not been migrated.
- Context-specific metadata and schema behavior after a redirect is undecided.
- Internal-link, sitemap, canonical, query, fragment, and redirect sequencing remain unimplemented.
- The four sampled 390px layouts have pre-existing horizontal overflow.
- The All Tools section still links family routes and remains explicitly outside consolidation scope.

## 13. Redirect readiness

**No.** Output preservation and route-context preparation do not establish complete content, metadata, navigation, or responsive workflow parity. No family route is approved for redirect, canonical consolidation, route removal, or sitemap removal.

## 14. Generated-artifact compliance

The audit writes fixtures, browser profiles, downloads, and reports below the OS temporary directory and removes the run root on success and failure. Runtime screenshots remain ignored and untracked. No screenshot, browser download, temporary JSON report, parity output, profile, or fixture is part of this milestone.

## 15. Preservation confirmation

This batch did not change routes, redirects, canonicals, sitemap membership, metadata, public content, accepted inputs, upload limits, converter algorithms, canvas compositing, output quality, settings, defaults, filenames, preview behavior, fullscreen behavior, download behavior, clear behavior, second-upload behavior, mobile styling, validation text, or All Tools behavior.

The background control continues to composite the export canvas. It changes every transparent and partial-alpha pixel in the audited fixture while changing zero fully opaque artwork pixels for both white and custom green backgrounds.

## 16. Recommended next batch

The recommended next batch is **a second SVG-to-PNG capability-preservation batch**. It should obtain explicit approval for a narrowly scoped correction to the verified 390px horizontal overflow, define and test the retained-page route-context/content contract without adding redirects, and rerun the complete output and identity matrix.

Redirect, canonical, sitemap, content-migration, and route-removal work must remain deferred.

## 17. Second-batch scope and first-batch adversarial review

The second batch adversarially reviewed the existing first-batch implementation, corrected the responsive defect, and added a descriptive content-ownership contract. It still does not authorize or implement redirects, aliases, query context, content switching, route removal, canonical consolidation, sitemap changes, metadata changes, or internal-link changes.

The review found:

- The exact registered family remains the same nine routes listed in section 2. The sticker and transparent-printing names were resolved from `app/routes.ts`; no alias was inferred.
- `SVG_TO_PNG_ROUTE_CONTEXTS` has nine own properties, one for each registered family route and no unrelated path.
- All nine context keys are unique. Unknown paths throw. A query-bearing string does not resolve as a route path, and `useLocation().pathname` remains the only runtime route identifier.
- The trailing-slash normalization is limited to current route identification. It does not parse a URL, query, fragment, environment value, cookie, or stored state.
- Context objects, shared defaults, nested content contracts, content-kind arrays, and content-source arrays are frozen. There is no registry mutation, cache growth, persistence, or environment-dependent context.
- Route defaults remain `1024` by `1024`, locked aspect, `1x`, transparent background, `#ffffff` solid color, antialiasing enabled, and `converted` fallback basename.
- Metadata and canonical ownership remain in the current route modules and route manifest. Breadcrumb and BreadcrumbList identity remain the existing base SVG-to-PNG identity.
- Wrapper files, metadata helpers, route-guide/All Tools source, contextual advertising, Related Sites, and the example component's public copy remain byte-identical to the approved baseline after normalizing the single responsive class addition described below.
- The production canvas, parsing, compositing, preview, object-URL cleanup, download, clear, and second-upload paths remain unchanged.
- The focused command added in the first batch is legitimate. The second batch adds only `test:svg-to-png-responsive`, a focused wrapper around the existing production-browser parity harness.
- The parity process creates its run root below OS temporary storage, closes every page, stops the spawned browser in `finally`, and recursively removes the exact PID/port-scoped temporary root on success or failure.

One direct test defect was confirmed. The first-batch mobile gate asserted only that `horizontalOverflow` had a boolean type. A value of `true` therefore passed. The gate now requires both document and body scroll widths to stay within their client widths, records the widest rendered element and relevant computed rules, and rejects horizontally clipped focusable controls.

Environment note: at the start of the second-batch pass the checkout was clean on `main`, while the required branch existed at `origin/milestone/svg-to-png-preservation-preparation` with the complete first batch in commit `7ba1056`. The checkout was moved to that same named milestone branch. No differently named branch was created. This differed from the prompt's expected uncommitted first-batch state; the second batch was therefore prepared separately without rewriting the already-pushed first batch.

## 18. Responsive reproduction and root cause

The original width was reproduced through the repository's production CDP browser path:

| State | Requested viewport | Document client width | Document/body scroll width | Widest offending box |
| --- | ---: | ---: | ---: | --- |
| First-batch sampled settings state | 390 x 844 | 375 px | 973 px | Lazy example-image content |
| Deterministic upload plus open SVG source | 320 x 800 | 305 px | 973 px | Example image panel: left 37 px, right 973 px, width 936 px |

The exact offender was `ExampleImagePanel` in `app/client/components/layout/ExampleSvgConversion.tsx`. Its image declares intrinsic dimensions of 900 by 900 and already has `max-w-full`. The panel was nevertheless a grid item with the default automatic minimum size. Once scrolling or interaction caused the lazy example images to resolve, the grid track used the image's intrinsic min-content width. Padding and borders expanded the panel to 936 px and the page edge to 973 px.

Root-cause classification: **grid minimum sizing caused by an intrinsic-width replaced element**. The defect was interaction-dependent in the deterministic reproduction; the initial shell fit, while the lazy example image expanded the supporting-content grid after upload/source interaction. It was not caused by the converter output, textarea, filename, settings controls, navigation, route guidance, All Tools, a transform, absolute positioning, or an unbroken public string.

The fix is one scoped class:

- `ExampleImagePanel` now has `min-w-0`.

That allows the grid track to shrink and lets the existing `max-w-full` image constraint take effect. At 320 x 800 after upload and the source editor is open, the document and body are both 305 px wide with 305 px scroll width; the example grid track is 231.2 px, the panel is 231.2 px with computed `min-width: 0px`, and the loaded image is 196 px wide. The content remains fully visible and selectable. No overflow clipping, global `overflow-x: hidden`, nested ordinary-content scroller, font reduction, truncation of public content, or control removal was added.

The shared example component is used beyond this family, so its pre-fix-equivalent source is hashed after removing only the approved `min-w-0` token. The focused audit fails if any other public copy or component source changes.

## 19. Route-context content contract

`app/client/lib/converter/svgToPngRouteContexts.ts` remains the only SVG-to-PNG route-context map. Each of its nine entries now contains exactly one frozen `contentContract`. The contract is descriptive and is not read by the renderer, router, metadata functions, schema, sitemap, or converter.

Every contract contains:

- current wrapper source as the route identity/content owner
- current H1 and document-title identity
- retained-destination candidate, recorded as `/svg-to-png-converter` only for future review
- guidance category
- exact shared default dimensions
- source-basename filename policy and `converted` fallback
- current shared static example behavior
- current base breadcrumb/schema owner
- finite content-kind and content-source keys
- future migration status

The finite content kinds are base converter guidance, platform workflow guidance, printing guidance, transparency guidance, and sticker guidance. The finite migration statuses are not planned, preservation required, blocked, and ready for later approval. Only `not-planned` and `blocked` are used now: the base route is not planned for migration and all eight wrappers remain blocked.

| Route | Identity/content owner | Guidance category | Current content kinds | Future status |
| --- | --- | --- | --- | --- |
| `/svg-to-png-converter` | `app/routes/svg-to-png-converter.tsx` | base converter | base converter | not planned |
| `/svg-to-png-for-shopify` | `app/routes/svg-to-png-for-shopify.tsx` | seller platform | base + platform workflow | blocked |
| `/svg-to-png-for-etsy` | `app/routes/svg-to-png-for-etsy.tsx` | seller platform | base + platform workflow | blocked |
| `/svg-to-png-for-printify` | `app/routes/svg-to-png-for-printify.tsx` | print on demand | base + platform workflow + printing | blocked |
| `/svg-to-png-for-printful` | `app/routes/svg-to-png-for-printful.tsx` | print on demand | base + platform workflow + printing | blocked |
| `/sticker-to-png-for-printing` | `app/routes/sticker-to-png-for-printing.tsx` | sticker printing | base + printing + sticker | blocked |
| `/svg-to-transparent-png-for-printing` | `app/routes/svg-to-transparent-png-for-printing.tsx` | transparent printing | base + printing + transparency | blocked |
| `/svg-to-png-for-canva` | `app/routes/svg-to-png-for-canva.tsx` | design platform | base + platform workflow | blocked |
| `/svg-to-png-for-figma` | `app/routes/svg-to-png-for-figma.tsx` | design platform | base + platform workflow | blocked |

The retained-destination value is not a routing instruction. No route transition is active.

## 20. Content-preservation inventory

The content inventory distinguishes the wrapper that owns the public route identity from the shared modules that render its current content.

| Public section | Repository-relative source | Current classification | Routes | Preservation status |
| --- | --- | --- | --- | --- |
| H1, upload shell, selected filename, detected dimensions, SVG preview/source editor | `app/routes/svg-to-png-converter.tsx`; `app/client/components/ui/DragArea.tsx` | shared component with route-specific H1/value | all nine | required preservation blocker |
| Output dimensions, aspect lock, quality, antialiasing, background, custom color | `app/client/components/converter/AdvancedSettingsPanel.tsx` (`SvgRasterExportSettingsPanel`) | shared identical controls | all nine | required preservation blocker |
| Live/final preview, fullscreen, output dimensions, filename, download, clear/second upload | `app/routes/svg-to-png-converter.tsx`; `app/client/components/converter/FullscreenOutputPreview.tsx` | shared identical behavior | all nine | required preservation blocker |
| Intro/header, exact-size, transparency, sharpness, workflow, uses, quality tips | `app/routes/svg-to-png-converter.tsx` (`SeoSections`) | shared identical content | all nine | duplicate across wrappers but not approved for removal |
| Static before/after example | `app/client/components/layout/ExampleSvgConversion.tsx` | shared component with route-derived example category | all nine | required preservation blocker |
| Printify workflow block | `app/routes/svg-to-png-converter.tsx` (`svgToPngPlatformSeoCopyByPath`) | platform-specific content | Printify | required preservation blocker |
| Printful workflow block | `app/routes/svg-to-png-converter.tsx` (`svgToPngPlatformSeoCopyByPath`) | platform-specific content | Printful | required preservation blocker |
| Base workflow guidance and related instructions | `app/client/components/navigation/OtherToolsLinks.tsx` (`ROUTE_GUIDES["/svg-to-png-converter"]`) | route-local explicit content | base | required preservation blocker |
| Shopify/Etsy workflow guidance | `app/client/components/navigation/OtherToolsLinks.tsx` (`UTILITIES`, `getRouteGuide`, seller fallback) | shared component with route-specific values; platform-specific content | Shopify, Etsy | required preservation blocker |
| Printify/Printful/sticker/transparent workflow guidance | `app/client/components/navigation/OtherToolsLinks.tsx` (`UTILITIES`, `getRouteGuide`, print fallback) | shared component with route-specific values; printing/transparency/sticker content | four printing routes | required preservation blocker |
| Canva/Figma workflow guidance | `app/client/components/navigation/OtherToolsLinks.tsx` (`UTILITIES`, `getRouteGuide`, design fallback) | shared component with route-specific values; platform-specific content | Canva, Figma | required preservation blocker |
| FAQ and troubleshooting | `app/routes/svg-to-png-converter.tsx` (`SeoSections`) | shared identical content | all nine | duplicate across wrappers but not approved for removal |
| Breadcrumb UI and BreadcrumbList | `app/routes/svg-to-png-converter.tsx` | shared existing base identity | all nine | required preservation blocker |
| Title, description, canonical, Open Graph URL | each wrapper plus `app/data/routeMeta/marketplaceExport.ts`, `app/data/routeMeta/canvaFigma.ts`, and `app/data/routeManifest.ts` | route-local identity | all nine | required preservation blocker |
| All Tools entry, link, group, label, description, keywords | `app/client/components/navigation/OtherToolsLinks.tsx` (`UTILITIES`, `OtherToolsLinks`) | route-specific navigation inside shared All Tools | all nine | unchanged and excluded from migration |

Upload, dimension, background, output/download, FAQ, troubleshooting, and shared intro copy were not moved or rewritten. Printify and Printful retain their additional inline modules. Every wrapper retains its own current metadata source and route-specific guidance selection.

## 21. Future context transition contract, not active

A future retained destination may preserve a historical wrapper only after a separate approved preparation and rollout. The requirements are:

1. Allowed context identifiers must be the explicit finite keys already represented by the contract: `base`, `shopify`, `etsy`, `printify`, `printful`, `sticker-printing`, `transparent-printing`, `canva`, and `figma`. A future URL spelling is not approved here.
2. Historical source mapping must be a total one-to-one mapping from the exact nine current paths to those keys. Unknown paths or unsupported identifiers must fail explicitly; they must never inherit `base`.
3. Guidance selection must preserve the named content-source keys and exact current public modules. A destination may not show another wrapper's H1, platform label, inline printing block, fallback guide, or related instructions.
4. Width, height, aspect lock, scale, background, color, antialiasing, accepted input, validation, upload limit, example behavior, preview, and clear/second-upload defaults must remain exact.
5. Filename policy must remain source basename with the current sanitization and `converted` fallback unless a later separately approved change names an intentional difference.
6. Platform labels must be selected only from the explicit context. Competing platform names may remain in All Tools navigation but may not leak into the active converter identity or route guide.
7. Metadata/schema preparation must happen additively while every source still renders. No redirect may ship until the destination reproduces the approved visible guidance, title/H1 intent, schema decision, and rollback behavior.
8. Redirect and canonical sequencing must be a later isolated rollout: first approved destination context, then one-hop HTTP behavior, then canonical/OG/schema updates as one coherent reviewed set.
9. Sitemap and internal-link sequencing must follow the redirect rollout, not precede it. All Tools remains excluded unless separately approved.
10. Query parameters, fragments, cookies, localStorage, route state, or aliases must not be introduced implicitly. Unsupported future context handling requires an explicit product decision and focused negative tests.
11. Removal or expiration requires a production observation period and separate approval. Source implementations and content modules remain present through initial rollout.
12. Rollback must restore the source loader, metadata/schema, canonical, sitemap, and internal links as one family-scoped unit. The preparation contract itself can be reverted independently because it has no runtime effect.

This batch implements none of those transition mechanisms. In particular, it does not implement `?context=`.

## 22. Second-batch preservation gates

The focused audit now verifies:

- exactly nine route contexts and exactly nine nested content contracts
- no extra context path, duplicate route, or duplicate key
- frozen finite contract values and no fallback
- explicit failure for unknown and query-bearing context strings
- exact current title/H1 identity, defaults, filename policy, accepted input, breadcrumb/schema owner, and content-source inventory
- unchanged wrapper, route metadata helper, route-guide/All Tools, Related Sites, and contextual-ad source hashes
- only the approved `min-w-0` difference in the example component
- unchanged route registration, redirect absence, self canonicals, Open Graph URLs, schema identity, XML/HTML sitemap membership, and route-specific guide headings
- unchanged Printify and Printful inline guidance
- absence of query context, redirect, or URL-state code in the context/converter source
- seven fixtures across nine routes, deterministic bytes/pixels, backgrounds/alpha, filenames, validation, clear, and second upload
- the exact seven responsive viewports across every route and the required initial, settings, dimension, background, upload/source, generated, reset, and second-upload states
- document/body containment, maximum visible right-edge and widest rendered element diagnostics, focusable-control and generated-preview containment, intentional-only horizontal content scrolling, mobile stacking, tablet/desktop two-column layout, route guide, platform-label isolation, and All Tools presence
- unexpected browser console or network failures as hard failures while retaining only the audit harness's explicitly identified external-host isolation errors as expected diagnostics

The standalone `test:svg-to-png-responsive` command runs only the responsive production-browser section and emits a bounded JSON summary. Browser profiles, fixtures, screenshots, and downloads stay below the parity audit's OS-temporary run root and are removed in `finally`.

## 23. Redirect readiness and remaining blockers after batch two

Redirect readiness remains **no**.

The responsive blocker is corrected, but the following transition blockers remain:

- no approved public context URL contract
- no destination rendering of historical wrapper content
- no approved metadata or schema transition
- no approved redirect/canonical/sitemap/internal-link sequence
- no approval to change or remove All Tools entries
- no production observation or expiration policy
- no wrapper content migration

No content, metadata, schema, canonical, sitemap, route, or navigation blocker was bypassed by recording the typed contract.

## 24. Second-batch preservation confirmation

The responsive change affects layout sizing only. It does not change converter code, canvas size, raster bytes, decoded pixels, alpha, compositing, preview dimensions, filename, download target, validation, accepted input, settings, defaults, object-URL cleanup, memory limit, route identity, metadata, public copy, guidance, All Tools, or deployment configuration.

Recommended next milestone: **SVG-to-PNG consolidation implementation or another separately approved low-risk wrapper family, depending on the blockers below**. Do not begin either workstream without separate approval.

## 25. Second-batch validation record

Final production-browser responsive coverage contained all 63 route/viewport rows and 477 recorded states:

| Requested viewport | Browser client width | Maximum document/body scroll width | Route rows | Recorded states |
| --- | ---: | ---: | ---: | ---: |
| 320 x 800 | 305 px | 305 px | 9 | 63 |
| 360 x 800 | 345 px | 345 px | 9 | 63 |
| 375 x 812 | 360 px | 360 px | 9 | 63 |
| 390 x 844 | 375 px | 375 px | 9 | 81 |
| 412 x 915 | 397 px | 397 px | 9 | 63 |
| 768 x 1024 | 753 px | 753 px | 9 | 63 |
| 1280 x 720 | 1265 px | 1265 px | 9 | 81 |

The 390 and 1280 rows contain additional clear/second-upload states and download-filename checks. Every row covered initial, settings shell, dimensions, transparent background, custom background, upload plus open source, and generated-result states. No tested state had page-level horizontal overflow or a horizontally clipped focusable control.

Rendered in-app browser review covered all nine routes at 1280 x 720 and 390 x 844. It also exercised generated workflows for the base, Shopify, sticker-printing, transparent-printing, and Figma routes at 320 or 412 pixels, including the lazy example content that originally caused the overflow. Exact H1, self-canonical, route guidance, upload, settings, source editor, preview, conversion, enabled download, and All Tools presence were retained. A fresh post-edit browser tab reported zero console warnings or errors. Visual screenshots were inspected in memory and were not written to the repository.

The final focused preservation audit passed with:

- nine registered routes, nine exact route contexts, and nine content contracts
- seven deterministic SVG fixtures across all nine routes
- byte-identical and pixel-identical default output against the detached pre-change-main baselines
- exact dimensions and filenames
- nine invalid-input checks
- transparent, partial-alpha, white-background, and custom-background pixel assertions
- clear/second-upload behavior and preview/download agreement
- unchanged titles, descriptions, H1s, canonicals, Open Graph URLs, schema identity, breadcrumbs, sitemap membership, route guidance, metadata owners, and All Tools source

The complete converter parity audit also passed with no comparison failure. Its reported `ERR_ADDRESS_INVALID` resource messages are expected from the audit's deliberate external-host isolation; they are not local application errors. The clean in-app browser check above separates that harness signal from application console behavior.

The following commands and checks were completed; all passed except for the explicitly isolated external-host signal on the standalone navigation-browser command:

- `npm run test:svg-to-png-preservation`
- `npm run test:svg-to-png-responsive`
- `node scripts/converter-parity-audit.mjs`
- `npm run test:output-ux`
- `npm run test:conversion-actions`
- `npm run test:schema`
- `npm run test:route-coverage` (including HTML/XML sitemap gates)
- `npm run test:seo`
- `npm run test:navigation`
- `npm run test:navigation-browser` (all local navigation/layout/search assertions passed; see the environment limitation below)
- `npm run test:public-content`
- `node scripts/client-lifecycle-audit.mjs`
- `npm run test:responsive`
- `npm run typecheck`
- `npm run build`
- `npm test`
- syntax checks for `server.js` and the three changed audit scripts

The build retained the repository's existing Vite mixed-import and chunk-reporting warnings. The final standalone navigation-browser run returned a nonzero exit only because the browser reported Google's external `frame-ancestors 'self'` report-only CSP message while loading the unchanged advertising integration. Every local navigation predicate in that report passed, including link identity, menu placement, search/filter behavior, column count, and horizontal containment. The navigation audit script, navigation source, advertising source, root source, and server source are byte-identical to the current-main baseline, so this is an environment/external-host limitation rather than a milestone regression. A separate fresh in-app browser pass reported zero console warnings or errors. No milestone check failed. Two audit defects discovered during the pass were corrected before the final green runs: the boolean-only overflow assertion, and an end-of-line-sensitive source-hash reconstruction in the focused preservation audit.

Generated fixtures, downloads, browser profiles, and JSON/parity output stayed under OS temporary storage and the audit removed its PID/port-scoped roots in `finally`. Repository ignores continue to cover runtime verification, logs, coverage, test reports, browser reports, temporary directories, and build output without a blanket PNG rule. No route transition is ready: redirect readiness remains **no**.

## 26. Final milestone closure review

The final adversarial review verified that the milestone intentionally contains more than one commit. Commit `7ba1056` was already present on the local and remote milestone branch before closure and was not reachable from either local `main` or `origin/main`. Rewriting, squashing, amending, rebasing, or force-pushing it solely to recreate the originally intended uncommitted workflow would have obscured that established history. The responsive correction, finite content contract, strengthened preservation gates, and this closure record therefore belong in a separate coherent completion commit.

The independent review of `7ba1056` found only approved SVG-to-PNG preservation preparation: the exact finite nine-route context map, explicit unknown-route failure, route-component integration, focused preservation coverage, meaningful converter-parity extensions, a legitimate package command, and the initial documentation. It introduced no route, redirect, canonical, sitemap, metadata, schema, public-copy, guidance, default, input-policy, filename, output, reset, second-upload, All Tools, deployment, or state-lifetime change. The one direct defect was in its responsive assertion rather than production behavior: it recorded the overflow flag without requiring the flag to be false. The second batch corrects that test and the confirmed layout defect without rewriting the first commit.

The final test-quality review also strengthened the browser gates to:

- fail on an unexpected console or network error with route/state diagnostics
- measure the maximum visible rendered right edge in addition to document and body scroll widths
- require generated previews and focusable controls to remain visible and unclipped
- allow horizontal scrolling only for the explicitly identified SVG source textarea
- report route, viewport, state, widest element, computed sizing rules, clipping ancestor, and any horizontal scroll container when containment fails

These checks exercise the production application and converter implementation. They do not duplicate the converter, weaken byte or decoded-pixel comparisons, write repository screenshots, or retain browser profiles, downloads, fixtures, or reports.

Final milestone verdict: the preservation-preparation milestone is suitable for closure and integration, subject to the recorded validation gates remaining green. Redirect readiness remains **No**.

The remaining consolidation blockers are:

- source-route content migration
- destination context rendering
- metadata and schema transition approval
- redirect sequencing
- canonical sequencing
- sitemap sequencing
- internal-link sequencing
- observation and expiration policy
- any future All Tools change, which requires separate explicit user approval

No blocker is treated as implicitly approved by this milestone. The recommended next milestone is **SVG-to-PNG consolidation implementation or another separately approved low-risk wrapper family, depending on these blockers**. Do not begin redirects, canonical changes, sitemap changes, route deletion, content migration, or another route family as part of this closure.
