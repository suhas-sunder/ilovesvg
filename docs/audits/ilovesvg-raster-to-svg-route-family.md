# iLoveSVG standard raster-to-SVG route family

## Milestone boundary

- Starting main: `6103f5d195bb5ef9e8b6f6fa653ed129a4b83761`
- Milestone branch: `milestone/raster-to-svg-route-family`
- Production objective: make inherited standard-trace wrappers explicit and
  finite without changing tracing, validation, presets, content, metadata,
  output, lifecycle behavior, or public URLs.
- Redirect objective: decide JPG/JPEG and every other confirmed family route
  from repository evidence. No new redirect was approved; four established
  direct aliases remain.

This milestone does not include SVG-to-PNG, layered SVG, outline, line-art,
sketch, drawing, logo-tuned, black-and-white, favicon/ICO, image resize, or
image inspection workflows.

## Architecture found

The standard family does not contain 30 independent engines. Its production
pipeline already shares:

- `app/shared/tracing/serverFallback.server.ts` for raster normalization,
  Potrace, layered tracing, annotation, and transparency cleanup;
- `app/client/lib/tracing/useHybridTraceFetcher.ts` for browser/server policy,
  cancellation, supersession, retry, and exact response correlation;
- `app/client/components/converter/TraceOutputPanel.tsx` for active output,
  preview, copy, download, editing, reset-facing actions, and history;
- the bounded conversion gate, cache, output ownership, source snapshot, and
  advanced-setting helpers used by the route modules.

Fourteen route-configured implementations preserve the format/workflow
differences that are behaviorally significant. Sixteen small route wrappers
inherit one of those implementations. Before this milestone, those wrappers
exported a template component directly; three templates selected content or
labels from `useLocation().pathname`.

## Duplication removed and explicit context design

`app/client/lib/converter/rasterToSvgRouteContexts.ts` is the single finite
family contract. It defines:

- 30 unique public paths and 30 unique typed route keys;
- the exact route source, implementation owner, content owner, metadata owner,
  preset owner, accepted-input policy, default preset, current filename, and
  guidance category;
- a retain decision and evidence list for every route;
- a `requires-new-evidence` reconsideration policy;
- exact path/key resolvers that throw on unknown or query-bearing values.

The inherited PNG, marketplace, laser/Glowforge, JPG, and broad-image wrappers
now pass explicit typed keys to the shared implementation they already used.
Shopify preset labels, Shopify/Etsy content, Glowforge content, JPG
Silhouette/Glowforge content, and broad-image platform content are selected
from that key. The route modules no longer inspect `useLocation().pathname`.
No query state, cookie, local storage, environment selection, dynamic
fallback, alias, redirect, mutable registry, or second context map was added.

The larger route-configured implementations remain separate where preset
inventories, accepted inputs, validation messages, defaults, filenames, or
workflow-specific output controls differ. Their trace engines and lifecycle
primitives remain shared; merging those route configurations into one
unbounded generic component would be a behavior-risking architecture rewrite,
not removal of an exact wrapper duplicate.

## Confirmed family and final classification

All 30 confirmed routes are intentionally retained. "Same implementation"
below means the route inherits the implementation owner shown in the typed
contract; a distinct owner means that the current route configuration is
behaviorally significant.

| Public route | Key | Current implementation owner | Final decision | Evidence |
| --- | --- | --- | --- | --- |
| `/png-to-svg-converter` | `png-base` | PNG base | Retain independently | General PNG intent, self metadata/schema/breadcrumb identity, primary navigation role |
| `/png-to-svg-for-canva` | `png-canva` | PNG base | Retain independently | Canva handoff guidance and metadata; context would be lost by a direct redirect |
| `/png-to-svg-for-figma` | `png-figma` | PNG base | Retain independently | Figma handoff guidance and metadata; context would be lost by a direct redirect |
| `/transparent-png-to-svg-converter` | `png-transparent` | PNG base | Retain independently | Alpha/background-aware source guidance and distinct metadata |
| `/png-to-svg-for-cricut` | `png-cricut` | PNG Cricut | Retain independently | `png-cricut-clean-cut` default and Cricut cut-file guidance |
| `/png-to-svg-for-etsy` | `png-etsy` | PNG marketplace | Retain independently | Etsy seller workflow, labels, content, metadata, and navigation intent |
| `/png-to-svg-for-shopify` | `png-shopify` | PNG marketplace | Retain independently | Shopify-specific preset labels, storefront guidance, metadata, and navigation intent |
| `/png-to-svg-for-silhouette` | `png-silhouette` | PNG Silhouette | Retain independently | Silhouette Studio workflow and route-configured copy |
| `/png-to-svg-for-laser-cutting` | `png-laser` | PNG laser | Retain independently | `laser-cut-clean` default plus cut/score/engrave guidance |
| `/png-to-svg-for-glowforge` | `png-glowforge` | PNG laser | Retain independently | Glowforge-specific laser review guidance and metadata |
| `/png-to-svg-for-cricut-vinyl` | `png-vinyl` | PNG vinyl | Retain independently | `vinyl-clean-weed` default, weeding/material terminology, and filename |
| `/jpg-to-svg-converter` | `jpg-base` | JPG base | Retain independently | General JPG intent, narrow accepted set, JPG presets/content, primary navigation role |
| `/jpg-to-svg-for-etsy` | `jpg-etsy` | JPG base | Retain independently | Etsy JPG seller intent and metadata |
| `/jpg-to-svg-for-silhouette` | `jpg-silhouette` | JPG base | Retain independently | Silhouette-specific JPG compression and cut-path guidance |
| `/jpg-to-svg-for-glowforge` | `jpg-glowforge` | JPG base | Retain independently | Glowforge-specific JPG compression and engraving guidance |
| `/jpg-to-svg-for-canva` | `jpg-canva` | JPG base | Retain independently | Canva JPG handoff intent and metadata |
| `/jpeg-to-svg-converter` | `jpeg-base` | JPEG base | Retain independently | Broader GIF/AVIF/BMP/TIFF input policy and additional preset/content differences |
| `/jpg-to-svg-for-cricut` | `jpg-cricut` | JPG Cricut | Retain independently | Narrow input policy, `jpg-cricut-clean-cut` default, JPG/Cricut guidance |
| `/jpeg-to-svg-for-cricut` | `jpeg-cricut` | JPEG Cricut | Retain independently | Broader input policy, `jpeg-cricut-clean-cut` default, distinct preset inventory |
| `/webp-to-svg-converter` | `webp-base` | WebP base | Retain independently | WebP transparency/source intent, `webp-edge-balanced` default, filename |
| `/webp-to-svg-for-cricut` | `webp-cricut` | WebP Cricut | Retain independently | `webp-cricut-clean-cut` default, Cricut workflow, route filename |
| `/cricut-svg-converter` | `cricut-general` | General Cricut | Retain independently | Broad raster/SVG input policy, layered and single-trace preset inventory, primary Cricut navigation intent |
| `/image-to-svg-for-cricut` | `image-cricut` | Broad image | Retain independently | Broad HEIC/HEIF and raster input workflow plus Cricut guidance |
| `/image-to-svg-for-etsy` | `image-etsy` | Broad image | Retain independently | Etsy seller workflow and metadata |
| `/image-to-svg-for-silhouette` | `image-silhouette` | Broad image | Retain independently | Silhouette workflow and metadata |
| `/image-to-svg-for-glowforge` | `image-glowforge` | Broad image | Retain independently | Glowforge workflow and metadata |
| `/gif-to-svg-converter` | `gif-base` | Broad image | Retain independently | Static-frame limitation and GIF-specific public intent |
| `/avif-to-svg-converter` | `avif-base` | Broad image | Retain independently | AVIF decode/source intent and metadata |
| `/bmp-to-svg-converter` | `bmp-base` | Broad image | Retain independently | Legacy bitmap/scan intent and metadata |
| `/tiff-to-svg-converter` | `tiff-base` | Broad image | Retain independently | TIFF/TIF archival scan intent and metadata |

No source route is classified `Safe to redirect`, `Merge content first, then
redirect`, or `Unresolved blocker`.

## Existing direct aliases

Four established permanent aliases belong to this route surface but do not
render a converter and therefore do not receive retained-route context keys:

| Source | Direct destination | Milestone result |
| --- | --- | --- |
| `/image-to-svg-converter` | `/` | Existing 301 retained; incomplete manifest canonical/target record corrected |
| `/tif-to-svg-converter` | `/tiff-to-svg-converter` | Existing 301 retained unchanged |
| `/png-to-vector-converter` | `/png-to-svg-converter` | Existing 301 retained unchanged |
| `/jpg-to-vector-converter` | `/jpg-to-svg-converter` | Existing 301 retained unchanged |

All four are non-indexable and excluded from XML/HTML sitemap membership.
Each destination is directly reachable with a successful response; no chain,
loop, query state, cookie, storage, or pathname guessing is involved. No
ordinary internal link points to these aliases.

## Specialized workflows intentionally excluded

- `/png-to-svg-for-cricut-print-then-cut` retains printable color and a
  separate SVG cut-outline workflow.
- `/png-to-svg-for-cricut-stickers` retains sticker-border generation and
  cut-outline-specific preview/output behavior.
- Layered, outline, line-art, sketch, drawing, logo, black-and-white, and
  favicon/ICO routes remain in their existing future families.

These exclusions are source- and output-contract decisions, not visual
similarity decisions.

## JPG versus JPEG decision

Both spelling pairs are retained.

The general JPG route accepts JPG/JPEG/PNG/WebP/SVG and defaults to
`scan-clean`. The general JPEG route additionally advertises and validates
GIF, AVIF, BMP, and TIFF through its broader implementation and has a
different local preset inventory. The Cricut pair has the same accepted-input
split and different explicit default IDs
(`jpg-cricut-clean-cut` versus `jpeg-cricut-clean-cut`).

Equal bytes and equal submitted settings can produce equal deterministic SVG
output, but that does not make the complete route contracts equal. Repository
evidence supplies neither a lossless redirect nor an evidence-based canonical
winner. Reconsideration requires a material product/content/input change and
complete parity evidence; identical output for a subset of settings is not new
evidence.

## Content, metadata, schema, breadcrumbs, sitemap, and links

No public content was migrated, rewritten, deduplicated, or removed. Route
introductory copy, platform guidance, format guidance, FAQs,
troubleshooting, examples, and related-route explanations remain in their
current route sources or `OtherToolsLinks.tsx`.

No retained-page title, description, H1, canonical, Open Graph URL, schema identity,
breadcrumb identity, XML/HTML sitemap membership, route registration, or
ordinary internal link changed. The only metadata-inventory correction is the
manifest row for the already-redirecting `/image-to-svg-converter`: it now
records canonical `/` and `redirectTo: "/"`, matching its unchanged loader and
route metadata. No source metadata or retained-route context became dead.

The All Tools implementation, labels, links, ordering, search, placement, and
behavior remain byte-for-byte unchanged from starting main
(`SHA-256 b1cea2a32ff7ee56d89d3cb86e02e355e05f32dbe1926a82f3305712dbb1b84a`).

## Output and lifecycle preservation

The context contract is descriptive. It is read only to validate explicit
route keys and to select the same existing route-specific copy/preset-label
variant that pathname selected before. It does not enter the trace request,
settings, result ownership, history, preview, copy, download, or filename
data path.

Preserved behavior includes MIME/extension handling, upload limits,
validation messages, trace modes, default presets, trace settings, browser
VTracer and server Potrace/layer fallback, output SVG bytes, path/viewBox
structure, filenames, preview, copy, download, reset, second upload, history,
active/pinned result, cancellation, supersession, late-response rejection,
response correlation, bounded caches/stores, and cleanup.

The deterministic converter parity suite remains the output authority,
including opaque/transparent PNG, identical JPG/JPEG bytes, WebP, detail,
logo-like, line-art-like, invalid/oversized input, and second-upload scenarios
covered by its generated fixtures and related focused audits.

## Browser coverage

The dedicated production-browser audit loads all 30 retained routes at
`390 x 844` and `1280 x 720`. Ten representative routes additionally cover
`320 x 800`, `412 x 915`, `768 x 1024`, and `1440 x 900`: general PNG, PNG
Cricut, Etsy, Silhouette, laser cutting, vinyl, JPG, JPEG, and WebP.

It asserts each route's title, H1, self-canonical, upload control, document and
body widths, visible focusable containment, and console state. It uses an OS
temporary browser profile and deletes it in `finally`; it takes no screenshot
and initiates no retained download. Existing production action, output UX,
hybrid browser, lifecycle, correlation, and parity audits cover conversion,
settings, preview, copy/download payloads, reset, second upload, cancellation,
and newer-result ownership.

The final run completed 100 route/viewport measurements with zero failures.
Maximum measured page width was exactly the requested `1440` pixels; at every
mobile/tablet measurement document and body scroll width equaled client width.

## Validation results and limitations

The focused family audit passed with 30 retained routes, 14 route-configured
implementation owners, two intentionally excluded specialized routes, and
four established direct redirects. The full converter parity audit passed
with zero failures. It covered 17 deterministic fixtures, four JPG/JPEG
comparisons, the PNG wrapper comparisons, and the existing SVG-to-PNG,
resizer, and favicon matrices. Matching JPG/JPEG inputs and settings remained
byte-identical; established wrapper differences remained explained by their
unchanged route configurations.

The complete configured hybrid-browser suite passed, including preview,
copy/download payloads, route settings, replacement input, lifecycle, and
home-page batch ZIP scenarios. A separate opt-in `QUEUE_SMOKE=1` stress case
was attempted twice and remained performance-bounded by the existing harness:
while a 2200 x 1100 detailed layered conversion displayed `Converting...`,
the harness attempted to select a preset that was still disabled. It exposed
no stale-result or response-correlation mismatch, and no lifecycle or timeout
code was changed to conceal the limitation.

The pre-existing `test:input-compatibility` static audit remains inapplicable
to the current SVG-to-PNG route: it searches that source for a literal
`accept="..."`, while starting main already supplies the exact value through
the typed `routeContext.inputAccept`. Neither that route nor the audit changed
in this milestone. A chained SVG-to-PNG preservation run outlived the
orchestrating command timeout, so its wrapper result was inconclusive; the
full converter parity run independently completed its nine-route,
seven-fixture SVG-to-PNG byte/pixel matrix with zero differences.

The current history has no `test:ci` script, standalone sitemap script,
repository-validation workflow, standalone response-correlation script,
standalone public trace-presentation script, or standalone server-fallback
lifecycle script. Their absence is unchanged. Available route, redirect,
sitemap-via-route-coverage, schema, SEO, navigation, public-content,
responsive, lifecycle, cache, bounded-store, memory-diagnostics, production
logging, manifest, typecheck, build, and syntax checks passed.

## Preservation and repository integrity

`Dockerfile`, `server.js`, `package-lock.json`, deployment configuration,
memory-diagnostic defaults, the SVG-to-PNG family, and every excluded
specialized family remain unchanged. The family audit compares these files,
route registration, route manifest, both sitemaps, and All Tools directly with
starting main.

Generated screenshots, downloads, browser profiles, temporary fixture
directories, JSON reports, parity output, coverage, and debug logs are not
tracked. Browser and conversion audits use OS temporary storage or ignored
paths and clean their outputs. Privacy, absolute-path, credential-pattern,
UTF-8, whitespace, ignored-artifact, process, and port checks are part of the
final gate.

## Final status

`RASTER-TO-SVG FAMILY COMPLETE: approved redirects implemented and remaining routes intentionally retained.`
