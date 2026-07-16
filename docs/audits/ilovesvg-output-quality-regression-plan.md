# iLoveSVG Output Quality Regression Plan

Date: 2026-07-13

Status: audit baseline; no product change approved

Scope: iLoveSVG.com converter output, settings, presets, history, and export workflows

This plan defines the evidence required before converter consolidation, preset-ID repair, settings repair, canonical/redirect work, or any intentional output change. It deliberately avoids a large golden-output repository. The current minimal executable evidence is `scripts/converter-parity-audit.mjs`, which drives production routes/helpers with temporary deterministic fixtures and deletes its temporary data.

## 1. Representative fixture matrix

Each baseline run must record exact bytes, SHA-256, decoded dimensions, format, and alpha status. Fixtures must be non-private, deterministic, small, and locally generated or already in the repository.

| Category | Minimum characteristics | Primary families |
| --- | --- | --- |
| Transparent PNG | Known transparent, partial-alpha, and opaque pixels | Raster trace, SVG-to-PNG reference |
| Opaque PNG | Simple hard edges and known dimensions | PNG wrappers, Cricut/cut |
| JPG/JPEG pair | Same encoded bytes under `.jpg` and `.jpeg` | JPG/JPEG parity |
| Monochrome logo | Hard edges, holes, transparent canvas | Logo/icon presets |
| Multi-color raster | Multiple regions and small details | VTracer/layered/platform |
| Sketch/line drawing | Thin strokes, gaps, islands | Sketch/drawing/centerline |
| Filled SVG | Solid fills plus transparent canvas | SVG raster/export utilities |
| Stroke SVG | Strokes, caps/joins, no fill | Resize/stroke/export |
| Transparent SVG | Opaque and partially transparent artwork | Background pixel behavior |
| Non-square SVG | Non-zero-origin viewBox and known dimensions | Resizer/viewBox |
| Base64/data URI | Valid SVG payload | Base64/code parsers |
| Invalid input | Small wrong-format or malformed source | Error/reset/stale-state paths |

Current generated fixture hashes and dimensions are recorded in `ilovesvg-runtime-capability-verification.md`. Future permanent fixtures should be added only when repeated use justifies their repository cost.

## 2. Canonical routes and conversion families

Baseline at least one canonical implementation and every wrapper that may be consolidated:

- `/`, `/png-to-svg-converter`, `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`: single trace, VTracer/layered, presets, history/editing.
- `/png-to-svg-for-cricut`, `/png-to-svg-for-silhouette`, Cricut/code/Base64 routes: cut-file and alternate input workflows.
- PNG Shopify/Canva/Figma/Etsy/Glowforge/transparent wrappers: platform defaults and post-processing.
- `/svg-to-png-converter` plus every registered export wrapper: raster dimensions, alpha, background, naming.
- `/svg-resize-and-scale-editor` plus platform wrappers: sizing, viewBox, units, aspect behavior.
- `/svg-to-favicon-generator` plus image/format/platform/ICO wrappers: package, individual outputs, ICO, snippets, manifest.
- Dimensions and file-size inspectors: report/action differences, not just output bytes.
- Sketch/drawing, logo/icon, layered, PDF, ZIP, and SVG utility families before any related change.

## 3. Presets requiring baselines

For each route, capture the default, one route-local preset, one shared preset, the heaviest preset, and every colliding ID. The current mandatory collision set is:

- `icon-bold` on `/icon-to-svg-converter`.
- `logo-smooth` on `/logo-to-svg-converter`.
- `cricut-clean-cut` on WebP/JPEG/JPG/PNG Cricut routes.

Also baseline Potrace, VTracer/layered, centerline/outline, photo, line-art, cut-file, platform default, and any route-specific preset that changes post-processing. Store the displayed label, object source, effective normalized settings, submitted preset ID, history label, output hashes, and active/pin behavior.

## 4. Settings requiring baselines

At minimum:

- Trace engine, threshold, smoothing/optimization, turn policy, preprocessing, inversion, color/layer count, detail/trace size, centerline/outline, white/transparent removal.
- SVG-to-PNG width, height, scale, aspect behavior, anti-aliasing, background mode/color, transparency, quality where applicable.
- Resizer dimensions, units, aspect lock, proportional scale, preserve/match viewBox, `preserveAspectRatio`, stroke behavior.
- Favicon background, platform selection, ICO sizes, package/snippet controls, source mode.
- SVG utility minify/cleanup, stroke, flip/rotate, recolor/background, dimension repair.
- Output layer color/visibility/opacity and Update preview/copy/download parity.

For every control, record default and changed value, UI state, request payload, preview, conversion output, exported bytes, history snapshot, reset, and second-upload behavior.

## 5. Output measurements by format

| Format | Required measurements |
| --- | --- |
| SVG | Exact bytes/hash, normalized XML hash, viewBox/dimensions, element/path/group counts, fill/stroke structure, sanitizer invariants, editable layer metadata |
| PNG/JPEG/WebP | Exact bytes/hash when deterministic, decoded width/height/channels, alpha counts, pixel hash, differing-pixel count, maximum channel delta |
| ICO | Directory entry count, dimensions/bit depth where available, payload sizes/hashes, decode success |
| ZIP | Raw hash for reference only; sorted entry names, count, uncompressed sizes, per-entry hashes, manifest/snippet semantics |
| PDF | Page count, media box/page size/orientation, rendered-page pixel comparison, embedded resource summary where practical |
| Text/code/Base64 | Exact decoded semantic payload, MIME/data-URI handling, output hash, escaping/sanitization behavior |

## 6. SVG semantic comparison rules

Classify in this order:

1. Byte-identical: exact UTF-8 bytes match.
2. Normalized-XML-identical: only approved serialization noise differs, such as insignificant inter-tag whitespace or deterministic attribute ordering performed by the comparator.
3. Structurally equivalent: viewBox, geometry, transforms, paint, opacity, path order where meaningful, and layer/edit metadata match even if serialization differs.
4. Visually equivalent but structurally different: rendered pixels match within the declared tolerance, but SVG editability/structure differs.
5. Materially different: geometry, paint, dimensions, metadata required for editing, or rendered output differs.

Never normalize path data, transforms, fill/stroke values, layer order, IDs referenced by content, sanitizer changes, viewBox, dimensions, or editable metadata away. Visual equality alone is insufficient for editable SVG workflows.

## 7. Raster pixel comparison rules

Decode through the repository's existing image tooling. Compare width, height, channels, alpha presence, per-pixel RGBA, differing-pixel count, maximum channel difference, and pixel SHA-256. Exact equality is required when route/settings are claimed equivalent.

For deliberate background compositing, changes are allowed only in transparent/partial-alpha source regions according to normal alpha blending; fully opaque artwork must remain unchanged unless artwork recoloring is explicitly approved. A solid background should produce fully opaque output when that is current behavior. Anti-aliased pixels must not be excluded from evidence.

## 8. ICO/ZIP/package comparison rules

ZIP container hashes may vary because timestamps or compression metadata are nondeterministic. Compare sorted filenames, entry count, uncompressed sizes, per-entry hashes, decoded image dimensions, snippet text, web manifest semantics, and browserconfig semantics. Report raw ZIP hashes without treating their difference as a product failure when every meaningful entry matches.

For ICO, parse the directory and compare every included size/bit-depth/payload. A displayed file count is not package parity. Platform-specific additions or omissions must be named and preserved.

## 9. Allowed nondeterminism

Allowed only when explicitly observed and documented:

- ZIP timestamps/container metadata while all meaningful entries match.
- Generated non-user correlation IDs that do not enter output.
- Serialization whitespace/attribute order proven semantically irrelevant and normalized by a named comparator.
- Browser download timing and filename collision suffixes outside the generated payload.

Not allowed: changed geometry, pixels, color, alpha, dimensions, viewBox, path/layer structure, manifest/snippet content, preset/settings semantics, output naming policy, sanitizer behavior, or history association.

## 10. Forbidden output changes

Without explicit approval, reject any change to accepted inputs, output formats, conversion engine/algorithm, quality/detail, dimensions, colors/alpha, layer count/order/editability, preset defaults/effective values, setting behavior, filenames/package manifests, sanitizer/security properties, copy/download bytes, or route-specific workflows. A performance improvement does not authorize a quality or semantic change.

## 11. History and editing workflow tests

For each history-capable route:

1. Convert source A with default preset.
2. Convert A with alternate preset/settings.
3. Select the first result and confirm preview/source/preset label/settings snapshot.
4. Edit color/visibility/opacity or route-appropriate output state.
5. Confirm Update preview, copy, and download use the selected edited item.
6. Navigate between items and confirm isolation.
7. Pin/unpin presets where supported.
8. For duplicate IDs, assert the exact selected object/label/settings identity, not only the string ID.

No history reduction or replacement is permitted unless it is existing route behavior and explicitly recorded.

### Mandatory defect regressions

- Duplicate preset IDs: every rendered preset object must have a stable interaction identity even if a legacy submitted ID is preserved. Assert that selecting either formerly colliding card applies that card's exact normalized settings and that the two objects cannot become indistinguishable.
- History preset labels: each output must retain the label and object identity that actually produced it; an ID-only first-match lookup is insufficient.
- Pinned and active preset cards: exactly the clicked card may become active or pinned. Pinning, unpinning, reset, navigation, and rehydration must not affect a sibling card merely because it formerly shared an ID.
- JPEG VTracer selection: after a Potrace result and then a completed JPEG VTracer result, the new VTracer history item must be active; preview, Copy SVG, Download SVG, Settings/Edit, and Update preview must all target that same item. Run the equivalent JPG scenario separately and do not infer its behavior from JPEG.
- Default preset identity: record route, displayed default label, stable object identity, effective settings, and submitted/history identity. This explicitly covers the Shopify PNG route's current Etsy-named default and every future default migration.
- Route-specific filenames: assert the exact copy/download filename and package base-name policy for every compared source route. Equal payload bytes do not authorize a wrapper to inherit the wrong route or platform filename.
- Transparent and partial-alpha compositing: compare transparent, partial-alpha, and fully opaque source pixels separately. Solid backgrounds must blend every alpha-bearing pixel according to the selected color, remove output alpha where that is current behavior, and leave fully opaque artwork unchanged.
- Favicon package contracts: compare the sorted package manifest, per-entry hashes, ICO directory, `site.webmanifest`, `browserconfig.xml`, and production HTML snippet. Raw ZIP timestamp differences remain allowed; missing, renamed, or semantically changed entries/snippets do not.

## 12. Reset, second-upload, and stale-result tests

- Reset must release/reset only route-owned current state while preserving whatever history the route currently preserves.
- Upload B after A and prove source preview, payload, output, filename, and history item all correspond to B.
- Start a slower valid conversion, then a faster/newer one without changing production timing; prove the latest request wins according to current route policy.
- Navigate/unmount/reset during processing; prove late completion cannot restore cleared state.
- Repeat after an error; retry must use the intended source/settings.
- Confirm no console error, broken object URL, old worker result, or previous-file reuse.

## 13. Browser viewport coverage

Minimum viewports are desktop 1440 x 1000 and mobile 390 x 844. Test initial, presets expanded, advanced sections, uploaded/converting/success/error, history/editing, reset, second upload, relevant tabs/accordions, and conditional warnings. Capture screenshots only for behavior-bearing evidence; do not create duplicate galleries.

## 14. Performance thresholds that should not block correctness

Correct output and state preservation take precedence over arbitrary timing thresholds. Record upload, conversion, edit, copy, download-initiation, and UI-response timings, but do not change algorithms or output to pass a threshold. Treat a timeout as performance evidence only after confirming progress versus a hang and cleaning up processes. Current focused-editor/post-conversion tests have correctness passes accompanied by responsiveness/timing failures; these are known exceptions, not waived forever.

## 15. How to add a route to the baseline

1. Classify its family, shared component/action/helper, unique inputs/outputs/settings/presets/content.
2. Select the smallest compatible fixtures and record exact hashes.
3. Add production-route or production-helper coverage; do not clone the algorithm into the test.
4. Add default, alternate, advanced-setting, output-edit, error, reset, second-upload, and stale-state scenarios as applicable.
5. Define deterministic and semantic comparison rules before collecting output.
6. Document expected exceptions and preservation requirements in the audit.
7. Run route-filtered browser and relevant conversion/output tests.

## 16. How to approve an intentional future output change

An intentional change requires an explicit proposal describing affected routes, fixtures, presets/settings, before/after artifacts and metrics, user-visible effect, security implications, migration/content impact, and why preservation cannot be achieved without the change. Approval must name the accepted differences. Update the baseline only after review; never silently rewrite expectations to match new output.

## 17. Minimum validation required before any redirect

Every source/destination pair must have yes - not partial or inconclusive - for accepted inputs, output formats/quality, deterministic output under mapped settings, presets/defaults, visible/advanced controls, history/editing, copy/download/export/package behavior, reset/second upload/stale-result behavior, and useful content preservation. Metadata, schema, breadcrumb, canonical, sitemap, redirect, and internal-link transitions must be planned. Route-specific traffic/production evidence must be reviewed outside this repository audit. The All Tools section must remain unchanged.

## 18. Known current exceptions

- Six same-ID preset collisions make active/pin/history identity ambiguous; five produce different output on current fixtures.
- Immediate preset submission on several routes can attach a stale prior preset ID to otherwise correct clicked settings.
- JPEG VTracer can complete a new result while copy/download remain on the prior Potrace history item.
- Glowforge PNG output differs from equal-setting platform wrappers because of laser post-processing.
- Raw favicon ZIP hashes vary while sorted entry contents match.
- Favicon 16-only changes ICO contents but retains the 24-file package.
- `test:focused-editor` currently fails responsiveness assertions despite passing copy/download/history correctness.
- `test:post-conversion-editability` currently exits nonzero for timing thresholds although functional edit scenarios complete.
- Existing ad/tracking requests may be blocked by the browser and must be separated from local converter failures.
- No route is currently approved as redirect-safe.

This plan changes no application code or behavior. It does not authorize output, route, preset, setting, content, metadata, canonical, sitemap, redirect, or All Tools changes.
