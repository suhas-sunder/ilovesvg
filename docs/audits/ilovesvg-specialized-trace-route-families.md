# iLoveSVG specialized trace route families

## Milestone

- Starting main: `b89d4c005fea126866bd0121f1de26d289bf4d86`
- Branch: `milestone/specialized-trace-route-families`
- Scope: specialized outline, line-art, drawing, sketch, black-and-white, logo, and sticker raster-to-SVG workflows
- Route decision: retain all 21 directly renderable routes
- New redirects: none
- Content migration: none
- Reconsideration rule: a retained route requires new product, code, content, or search-intent evidence before another consolidation review

The standard raster-to-SVG family, layered SVG routes, SVG-to-PNG routes, favicon/ICO routes, resize and inspection tools, Base64/code utilities, Print Then Cut, and the separate Cricut sticker-printing workflow remain outside this milestone.

## Architecture found

All candidate routes already use the shared lifecycle foundations:

- `useHybridTraceFetcher` for browser/server response ownership
- `runSharedPotraceSvgTrace` for server fallback
- `TraceOutputPanel` for preview, copy, download, output settings, and history actions
- the existing cancellation, supersession, late-response, cache, bounded-store, and memory-safety layers

The public pages were not one interchangeable converter:

- 14 files own materially different converter implementations.
- Six logo routes already share `app/routes/logo-to-svg-converter.tsx`.
- Three sticker routes already share `app/routes/sticker-to-svg-converter.tsx`.
- The Cricut logo and sticker routes use different preset inventories and output workflows from their generic counterparts.
- Outline, line-art, sketch, drawing, and black-and-white generic/Cricut pairs differ in presets, accepted inputs, filenames, output structure, editor behavior, or route-specific guidance.

The real architecture defect was bounded: the shared logo and sticker owners used `useLocation()` to select route copy, and sticker FAQ selection silently fell back to the base FAQ. That made route ownership implicit even though the route wrappers were explicit files.

## Confirmed subfamilies

| Subfamily | Routes | Compatible shared implementation |
| --- | ---: | --- |
| Outline and line-art | 4 | Shared lifecycle primitives; four specialized page implementations remain because presets and public intent differ |
| Sketch and drawing | 4 | Shared lifecycle primitives; four specialized page implementations remain because accepted inputs, presets, layered behavior, and guidance differ |
| Black-and-white and logo | 9 | Six logo routes share the generic logo owner; black-and-white generic/Cricut and Cricut logo remain specialized |
| Sticker | 4 | Generic, Etsy, and Silhouette share the generic sticker owner; Cricut sticker remains specialized |

The finite production source of truth is `app/client/lib/converter/specializedTraceRouteContexts.ts`. It provides one immutable entry per route with:

- explicit route key and public path
- implementation and route-source ownership
- subfamily and accepted-input policy
- default preset and filename policy
- title, H1, and canonical identity
- metadata, schema, breadcrumb, preset, input, filename, and content ownership
- an evidence-backed retain decision with a `requires-new-evidence` policy

Unknown paths and keys throw. Query-bearing paths do not resolve. The contract has no query, cookie, storage, environment, redirect, alias, or silent base-route behavior.

## Route inventory and final decisions

All decisions are `Retain independently`.

| Public route | Key | Implementation owner | Default preset | Input policy | Output filename | Retention evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/image-to-svg-outline` | `outline-image` | `image-to-svg-outline.tsx` | `outline-clean` | PNG/JPEG | `image-to-svg-outline.svg` | General image contour intent, image-outline preset inventory, and unique guidance |
| `/photo-to-svg-outline` | `outline-photo` | `photo-to-svg-outline.tsx` | `photo-outline-clean` | PNG/JPEG | `photo-to-svg-outline.svg` | Photo contour intent, photo presets, photo cleanup guidance, and distinct metadata |
| `/line-art-to-svg-converter` | `line-art-base` | `line-art-to-svg-converter.tsx` | `line-accurate` | PNG/JPEG | `line-art-to-svg-converter.svg` | Ink drawing and scan cleanup intent with a line-art preset set |
| `/line-art-to-svg-for-cricut` | `line-art-cricut` | `line-art-to-svg-for-cricut.tsx` | `line-art-clean-cut` | PNG/JPEG | `line-art-to-svg-for-cricut.svg` | Cricut cut-file presets, cutting guidance, metadata, schema, and breadcrumbs |
| `/drawing-to-svg-converter` | `drawing-base` | `drawing-to-svg-converter.tsx` | `drawing-accurate` | Broad raster plus SVG | `drawing-to-svg-converter.svg` | Broad input contract, drawing cleanup workflow, and general drawing intent |
| `/drawing-to-svg-for-cricut` | `drawing-cricut` | `drawing-to-svg-for-cricut.tsx` | `drawing-clean` | PNG/JPEG/SVG | `drawing-to-svg-for-cricut.svg` | Cricut drawing, lettering, kids-art, doodle, and cut-file workflow |
| `/sketch-to-svg-converter` | `sketch-base` | `sketch-to-svg-converter.tsx` | `sketch-pencil-light` | PNG/JPEG | `sketch-to-svg-converter.svg` | Pencil, pen, marker, and scan cleanup intent |
| `/sketch-to-svg-for-cricut` | `sketch-cricut` | `sketch-to-svg-for-cricut.tsx` | `sketch-balanced` | PNG/JPEG/WebP | `sketch-to-svg-for-cricut.svg` | Cricut layered sketch behavior, broader input policy, and signature/lettering guidance |
| `/black-and-white-image-to-svg-converter` | `black-white-base` | `black-and-white-image-to-svg-converter.tsx` | `bw-clean` | PNG/JPEG/SVG | `converted.svg` | Monochrome threshold workflow and a distinct historic filename policy |
| `/black-and-white-image-to-svg-for-cricut` | `black-white-cricut` | `black-and-white-image-to-svg-for-cricut.tsx` | `bw-clean-cut` | PNG/JPEG/SVG | `black-and-white-image-to-svg-for-cricut.svg` | Cricut vinyl, stencil, sticker-outline, and colored-cut presets |
| `/logo-to-svg-converter` | `logo-base` | `logo-to-svg-converter.tsx` | `logo-clean` | PNG/JPEG | `logo-to-svg-converter.svg` | General logo vectorization intent and generic logo guidance |
| `/logo-to-svg-for-cricut` | `logo-cricut` | `logo-to-svg-for-cricut.tsx` | `logo-clean-cut` | PNG/JPEG | `logo-to-svg-for-cricut.svg` | Separate clean-cut, vinyl, thin-line, and Cricut workflow |
| `/logo-to-svg-for-shopify` | `logo-shopify` | `logo-to-svg-converter.tsx` | `logo-clean` | PNG/JPEG | `logo-to-svg-converter.svg` | Storefront theme-asset workflow and Shopify-specific guidance |
| `/logo-to-svg-for-etsy` | `logo-etsy` | `logo-to-svg-converter.tsx` | `logo-clean` | PNG/JPEG | `logo-to-svg-converter.svg` | Seller branding, listing, watermark, and digital-product workflow |
| `/logo-to-svg-for-glowforge` | `logo-glowforge` | `logo-to-svg-converter.tsx` | `logo-clean` | PNG/JPEG | `logo-to-svg-converter.svg` | Laser engraving/cutting preparation and path-complexity review |
| `/logo-to-svg-for-silhouette` | `logo-silhouette` | `logo-to-svg-converter.tsx` | `logo-clean` | PNG/JPEG | `logo-to-svg-converter.svg` | Silhouette Studio, vinyl, label, and weeding workflow |
| `/logo-to-svg-for-canva` | `logo-canva` | `logo-to-svg-converter.tsx` | `logo-clean` | PNG/JPEG | `logo-to-svg-converter.svg` | Canva brand-asset intent and design-platform identity |
| `/sticker-to-svg-converter` | `sticker-base` | `sticker-to-svg-converter.tsx` | `line-accurate` | PNG/JPEG | `sticker-to-svg-converter.svg` | General sticker, decal, label, and cuttable-vector intent |
| `/sticker-to-svg-for-cricut` | `sticker-cricut` | `sticker-to-svg-for-cricut.tsx` | `sticker-clean` | PNG/JPEG/WebP | `sticker-to-svg-for-cricut.svg` | Cricut sticker sheets, vinyl decals, cut files, WebP input, and different presets |
| `/sticker-to-svg-for-etsy` | `sticker-etsy` | `sticker-to-svg-converter.tsx` | `line-accurate` | PNG/JPEG | `sticker-to-svg-converter.svg` | Etsy listing, seller review, and digital sticker product guidance |
| `/sticker-to-svg-for-silhouette` | `sticker-silhouette` | `sticker-to-svg-converter.tsx` | `line-accurate` | PNG/JPEG | `sticker-to-svg-converter.svg` | Silhouette Studio cut-line, decal, label, and project-size review |

Identical trace output was not treated as sufficient redirect evidence. Every route has public intent, terminology, guidance, metadata, schema/breadcrumb identity, input behavior, preset behavior, or filename behavior that would not survive a direct stateless redirect.

## Shared implementation cleanup

The milestone:

- added the single finite specialized route-context/content-contract map
- made every specialized route supply one explicit typed route key
- converted the six-route logo owner to `LogoToSvgRouteImplementation`
- converted the three-route sticker owner to `StickerToSvgRouteImplementation`
- replaced logo and sticker `useLocation()` selection with exhaustive typed key switches
- replaced the sticker FAQ base fallback with exhaustive typed ownership
- retained each incompatible specialized implementation

It did not change trace engines, presets, default values, settings, accepted inputs, validation limits, output structure, path data, viewBox, dimensions, filenames, result history, cancellation, supersession, response correlation, or memory cleanup.

## Content ownership and migration

No content moved between public URLs.

- Generic outline, photo, line-art, sketch, drawing, monochrome, logo, and sticker guidance remains in its current route implementation.
- Cricut preparation, cutting, vinyl, sticker, line-art, sketch, drawing, monochrome, and logo guidance remains in the current Cricut source.
- Shopify, Etsy, Glowforge, Silhouette, and Canva logo copy remains in the generic logo owner and current route guide.
- Etsy and Silhouette sticker FAQs and practical guidance remain in the generic sticker owner and current route guide.
- `OtherToolsLinks.tsx` continues to own the existing route title, breadcrumb, related-route, and All Tools data.

No public copy, FAQ, troubleshooting, example, or related-tool guidance was rewritten. No content was added to a destination to manufacture redirect readiness.

## Metadata, schema, breadcrumbs, sitemap, and links

There were no changes to:

- route registration
- route manifest entries
- titles or descriptions
- H1 values
- canonical or Open Graph URLs
- schema ownership
- breadcrumbs
- XML or HTML sitemap membership
- ordinary internal links
- redirect configuration

The pre-existing `/image-to-outline-converter` and `/black-and-white-png-to-svg-converter` aliases remain direct permanent redirects to their established canonical routes. They were not created or changed by this milestone.

## All Tools constraint

`app/client/components/navigation/OtherToolsLinks.tsx` is byte-for-byte unchanged from the validated starting main.

Validated SHA-256:

`b1cea2a32ff7ee56d89d3cb86e02e355e05f32dbe1926a82f3305712dbb1b84a`

Its source, labels, links, order, search, placement, and behavior were not modified.

## Preservation and validation

The focused specialized-family audit covers:

- exact 21-route membership and four subfamilies
- one unique path, typed key, context, and content contract per route
- explicit wrapper-to-owner mappings
- unknown path, query-bearing path, and unknown key failure
- no mutable registry, persisted context, environment selection, or fallback
- defaults, accepted-input ownership, filenames, shared lifecycle, and output-panel ownership
- unchanged public string inventory
- unchanged route registry, manifest, sitemap, redirects, standard-family context, All Tools, Dockerfile, `server.js`, and `package-lock.json`
- requires-new-evidence retention decisions
- generated-artifact policy

The responsive browser audit uses the same measured CDP harness as the standard family. It covers all 21 routes at 390x844 and 1280x720, plus nine representatives at 320x800, 412x915, 768x1024, and 1440x900. The representatives cover outline, line-art, sketch, drawing, black-and-white, logo, sticker, and two Cricut routes. It also verifies the two pre-existing direct aliases.

The implementation-branch validation established:

- 78 specialized-route viewport measurements passed with no page-level overflow, clipped focusable control, console error, or route-identity mismatch. The maximum measured document and body scroll width was 1440 pixels at the 1440-pixel viewport; every measured scroll width equaled its corresponding client width.
- The hybrid browser audit passed conversion, preset/settings interaction, preview, copy, download, and client/server result ownership for every specialized implementation owner.
- The deterministic converter-parity sections passed for preset collisions, JPG/JPEG equivalence, PNG wrappers, all nine SVG-to-PNG routes, all 63 SVG-to-PNG responsive measurements, resizers, and favicons. Specialized trace output remains owned by the unchanged trace engines and preset definitions.
- Trace-engine, trace-quality, output-UX, conversion-actions, queue, preset-identity, client-lifecycle, conversion-cache, memory-diagnostics, bounded-store, production-logging, route-coverage, redirects, sitemap, schema, SEO, navigation-source, navigation-browser, public-content, responsive-source, HTTP-smoke, link, example, typecheck, build, and unit-test gates passed.
- The repository-wide converter-route-parity browser smoke still cannot open the settings/layer-color controls on `/image-to-layered-svg-for-cricut`. That route is explicitly excluded from this milestone, its source and registration are unchanged from the starting main commit, and the focused specialized browser and output gates pass. This is recorded as a pre-existing layered-family validation limitation, not accepted as a changed specialized-route baseline.

## Artifacts and privacy

Browser profiles use OS temporary storage and are removed in `finally`. The browser audit does not capture screenshots or retain downloads or reports. The milestone adds no fixture binaries, logs, profiles, coverage, personal paths, credentials, environment values, or generated output.

## Future family

Layered SVG conversion remains a separate future milestone. No layered route was absorbed, redirected, or modified here.

SPECIALIZED TRACE FAMILIES COMPLETE: all routes intentionally retained because they serve distinct public intent.
