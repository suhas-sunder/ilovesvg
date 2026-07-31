# iLoveSVG layered and Cricut production-output route families

## Milestone boundary

- Starting main: `7d431cdd0948bf5686bf491347f8ff126dfbcfa0`
- Milestone branch: `milestone/cricut-output-route-families`
- Scope: layered SVG, Cricut Print Then Cut, Cricut sticker cut-outline, and
  Cricut vinyl production output
- Public route decision: retain all eleven directly related renderable routes
- Redirects added: none
- Deployment: not part of this milestone

The inventory began with the eight named Cricut routes. Repository evidence
also identified three general layered converter routes that directly re-export
the image, JPG, and logo Cricut actions/loaders and render the same production
implementations. Those routes therefore belong in the finite ownership
contract even though their metadata and public search intent are general
rather than Cricut-specific.

## Architecture found

The routes already share the safety-critical production primitives:

- `app/shared/tracing/serverFallback.server.ts` owns normalization, Potrace,
  layered tracing, annotation, and transparency cleanup.
- `app/client/lib/tracing/useHybridTraceFetcher.ts` owns browser/server
  fallback, cancellation, supersession, and exact response correlation.
- `BespokeTraceOutputPanel` and `TraceOutputPanel` own the common active-result,
  history, preview, editing, copy, download, cancellation, and retry actions.
- source snapshots, bounded output history, advanced settings, output
  appearance, export compression, and conversion gates remain shared.

The route files are not interchangeable templates. They retain different
accepted-input rules, preset inventories, settings, filenames, output
structures, result editors, and guidance. The only exact route-level sharing
is intentional: the three general image/JPG/logo layered wrappers render their
corresponding Cricut owner implementation while retaining their own metadata
and route identity.

## Confirmed compatible subfamilies

| Subfamily | Routes | Production contract |
| --- | ---: | --- |
| Editable layered SVG | 8 | Multi-color grouped SVG with layer recolor/hide controls and layered export |
| Print Then Cut | 1 | Printable raster color embedded with a separately traced cut outline |
| Cricut stickers | 1 | Sticker-oriented printable image, border, and cut-outline result |
| Cricut vinyl | 1 | Single-color cut-file SVG with vinyl cleanup and weeding controls |

Print Then Cut and Cricut stickers use related tracing primitives, but their
defaults, presets, border/cut controls, labels, filenames, and public workflows
are not the same contract. Vinyl is a single-color cut workflow rather than a
standard PNG tracing wrapper. Keeping these implementations separate avoids a
generic component with conditional behavior that would weaken route ownership.

## Finite route ownership

`app/client/lib/converter/cricutOutputRouteContexts.ts` is the sole context
map for this family. Each entry owns one exact path and one exact typed key,
plus:

- route source and production implementation owner;
- lifecycle route ID and exact action path;
- compatible subfamily, accepted-input policy, and output contract;
- established default preset and output filename;
- title and H1 identity;
- metadata, schema, breadcrumb, preset, accepted-input, filename, content, and
  guidance ownership;
- an evidence-backed `retain-independently` decision and
  `requires-new-evidence` reconsideration rule.

Unknown paths and keys throw. Query-bearing paths do not resolve. The contract
contains no route fallback, alias, redirect, query context, cookie, storage,
environment lookup, mutable registry, or content switch.

The eight implementation owners now submit to `routeContext.path` and identify
hybrid lifecycle work with `routeContext.lifecycleRouteId`. They no longer
derive their action target from `window.location.pathname`. The image, JPG,
and logo general wrappers pass their own typed key to the exact implementation
they already rendered.

Vinyl ownership moved out of the standard raster-to-SVG context map and into
this production-output contract. This removes an overlapping context without
changing the route registration, component, settings, output, metadata,
content, or public URL. The standard-family audit now records vinyl as an
intentionally excluded production workflow.

## Final route classification

| Public route | Typed key | Owner | Decision | Evidence |
| --- | --- | --- | --- | --- |
| `/layered-svg-for-cricut` | `layered-cricut` | Layered Cricut | Retain independently | Broad Cricut layered workflow, dedicated preset inventory, filename, metadata, and guidance |
| `/image-to-layered-svg-for-cricut` | `layered-image-cricut` | Image layered | Retain independently | Image-oriented layer controls, Cricut workflow, metadata, schema/breadcrumb identity |
| `/png-to-layered-svg-for-cricut` | `layered-png-cricut` | PNG layered | Retain independently | PNG-specific presets and custom focused layer editor, filename, and guidance |
| `/jpg-to-layered-svg-for-cricut` | `layered-jpg-cricut` | JPG layered | Retain independently | JPG compression/photo presets, JPG terminology, filename, and workflow guidance |
| `/logo-to-layered-svg-for-cricut` | `layered-logo-cricut` | Logo layered | Retain independently | Logo/background presets, brand-mark guidance, filename, and Cricut intent |
| `/image-to-layered-svg-converter` | `layered-image-general` | Image layered | Retain independently | General creator intent and self metadata/H1 distinct from the Cricut route |
| `/jpg-to-layered-svg-converter` | `layered-jpg-general` | JPG layered | Retain independently | General JPG layered intent and self metadata/H1 distinct from the Cricut route |
| `/logo-to-layered-svg-converter` | `layered-logo-general` | Logo layered | Retain independently | General reusable-brand-graphic intent and self metadata/H1 |
| `/png-to-svg-for-cricut-print-then-cut` | `print-then-cut` | Print Then Cut | Retain independently | Printable image plus cut outline, `sticker-clean-offset` default, `print-then-cut.svg`, and Design Space guidance |
| `/png-to-svg-for-cricut-stickers` | `cricut-stickers` | Cricut stickers | Retain independently | Sticker border/cut-outline contract, `white-border` default, `cricut-sticker.svg`, and sticker workflow |
| `/png-to-svg-for-cricut-vinyl` | `cricut-vinyl` | Cricut vinyl | Retain independently | Single-color cut contract, `vinyl-clean-weed` default, weeding/material guidance, and route filename |

No route qualifies as `Safe to redirect`, `Merge content first, then
redirect`, or `Unresolved blocker`. Identical low-level tracing primitives do
not make these output workflows or public intents redundant. A direct redirect
would lose presets, terminology, settings, filename identity, workflow
guidance, metadata identity, or a combination of those properties. No content
was manufactured or duplicated to justify a redirect.

## Content, metadata, and navigation preservation

All introductions, upload instructions, layered color guidance, PNG/JPG/logo
preparation, Print Then Cut instructions, sticker border guidance, vinyl
weeding guidance, dimensions/background help, output guidance, FAQs,
troubleshooting, examples, and related-tool content remain in their original
route sources. No public copy moved or changed.

Route registrations, titles, descriptions, H1s, canonical URLs, Open Graph
URLs, schema ownership, breadcrumbs, XML/HTML sitemap membership, and ordinary
internal links remain unchanged. No metadata was consolidated and no redirect,
chain, loop, stale import, orphaned context, or dead content contract was
introduced.

All Tools remains byte-for-byte unchanged at SHA-256
`b1cea2a32ff7ee56d89d3cb86e02e355e05f32dbe1926a82f3305712dbb1b84a`.
Its links, labels, ordering, search, placement, and behavior were not touched.

## `/image-to-layered-svg-for-cricut` parity limitation

The historical Settings/Edit limitation was tested against the clean starting
commit before production edits and did not reproduce. The existing production
route produced the selected layered preset, opened Settings/Edit, exposed
Layer colors, displayed its SVG preview, and returned matching Copy SVG and
Download SVG payloads.

The milestone closes the limitation with permanent assertions rather than a
speculative UI change. The focused family audit requires the route's layered
settings implementation, and the converter route-parity browser smoke
continues to require both Settings/Edit and Layer colors for this exact route.
No assertion or timeout was loosened.

## Output and lifecycle preservation

The ownership change does not touch the trace engines, raster normalization,
layer construction, cut-outline generation, sticker border generation, vinyl
trace settings, presets, defaults, validation, output appearance, SVG
construction, filenames, preview, copy, download, reset, second upload,
history, cancellation, supersession, late-response rejection, response
correlation, caches, stores, or cleanup.

The exact action path formerly read from the browser location is now the same
literal public path held by the route's finite context. Generic layered
wrappers keep their prior lifecycle owner IDs and submit to their own action,
so server/client correlation and public route behavior remain unchanged.

Deterministic converter parity, route parity, trace engine/quality, output UX,
conversion action, lifecycle, cache, bounded-store, and response-correlation
checks remain the output and ownership authorities. The complete converter
parity report finished with `failures: []`, including byte, parsed-output,
preview, filename, and route-action comparisons. No baseline was rewritten.

The broad high-fidelity research smoke continues to report its pre-existing
quality-threshold findings for `IMG_8487.PNG` (including the already documented
15-group flat-color structure and quality-tier coverage/detail heuristics).
That research gate is not a milestone delta: this milestone does not touch an
engine, preset, SVG builder, output editor, or output baseline, while the
detached-baseline converter parity report is exact and green. The findings
remain visible for a separately approved output-quality milestone; assertions
and thresholds were not weakened.

## Browser and responsive coverage

The dedicated production-browser audit covers all eleven routes at
`390 x 844` and `1280 x 720`. Eight representative routes additionally cover
`320 x 800`, `412 x 915`, `768 x 1024`, and `1440 x 900`: the layered base,
image, PNG, JPG, and logo workflows plus Print Then Cut, stickers, and vinyl.

It verifies title, H1, self-canonical identity, upload availability, document
and body widths, focusable containment, and console state. Conversion-action,
hybrid-browser, output UX, and route-parity checks cover upload, validation,
settings, conversion, preview, copy, download, filename, reset, second upload,
cancellation, and newer-result ownership.

The first fresh-build run exposed a pre-existing two-pixel page overflow only
on Print Then Cut at `320 x 800`: document and body measured `320 / 322`.
Detailed diagnostics traced it to the nested `CurrentRouteGuide` grid. The
route's outer article padding plus the guide's mobile padding left a 234-pixel
grid area, while the preserved advertising slot retained a 250-pixel intrinsic
minimum (268 pixels with its own padding/border). CSS grid automatic minimum
sizing expanded the guide children to 268 pixels and their right edge to 322.

The correction is outside the shared guide and advertising implementations:
the Print Then Cut route gives that one nested guide its available article
width and reduces only its sub-640-pixel section padding. At `sm` and above the
original margins and padding are restored. It does not clip or hide the ad,
guidance, links, focus outlines, or controls, and it creates no internal
scrolling. All Tools and the shared guide remain byte-for-byte unchanged.

The corrected audit completed 54 measurements: all eleven routes at the two
required widths plus eight representative routes at four additional widths.
It reported zero failures, zero clipped focusable elements, and zero console
errors. Document/body scroll width equaled client width at every mobile and
tablet measurement. The maximum requested and measured width was `1440`;
Print Then Cut changed from `320 / 322` to `320 / 320`.

Browser profiles, downloads, fixtures, and reports use OS temporary storage or
ignored paths and are removed after validation. No screenshot is retained.

## Repository integrity and artifact policy

The route registry, route manifest, both sitemaps, All Tools, shared trace
engines, shared output panels, `Dockerfile`, `server.js`, `package-lock.json`,
deployment configuration, and memory-diagnostic defaults remain unchanged.

The validation gate includes script syntax, typecheck, production build,
configured test suites, route/schema/SEO/navigation/content audits, responsive
browser checks, UTF-8 and whitespace scans, privacy/absolute-path and
credential scans, generated-artifact and ignore verification, process cleanup,
and known-port verification. Generated screenshots, downloads, profiles,
temporary JSON, parity output, coverage, test reports, and logs are not
tracked.

The current main history has neither an `npm run test:ci` script nor a
repository workflow YAML file, so those optional gates are accurately recorded
as unavailable rather than synthesized in this route-family milestone.

## Final status

`CRICUT OUTPUT FAMILIES COMPLETE: all routes intentionally retained because they serve distinct public intent and output workflows.`
