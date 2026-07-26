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
