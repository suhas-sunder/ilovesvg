# iLoveSVG converter-state preset-identity remediation

## 1. Milestone scope

This milestone corrects the six confirmed duplicate preset identities recorded in the site-inventory and capability audit. It makes each simultaneously reachable card uniquely identifiable without changing its visible presentation or effective conversion settings. It also carries the clicked identity into new result metadata on directly proven immediate-submit paths, so a result does not reconstruct its label from a later active-card lookup. The second batch fixes the confirmed timing-sensitive JPEG VTracer active-output/history race with explicit per-submission and per-upload ownership.

This milestone does not address public-content defects, route consolidation, metadata, canonicals, sitemap entries, or the All Tools section. The JPG control route is intentionally not given the JPEG-specific active-result change.

## 2. Audit sources

The source evidence and preservation boundaries are in:

- `docs/audits/ilovesvg-route-component-inventory.md`
- `docs/audits/ilovesvg-runtime-capability-verification.md` (defects `ILSVG-DEF-001` through `ILSVG-DEF-006`)
- `docs/audits/ilovesvg-output-quality-regression-plan.md`

The prior audit established that these were identity defects: both cards were reachable, ID-only active/pin comparisons could affect both cards, and first-match label lookup could be ambiguous. It did not establish that clicked conversions generally used the wrong values. Five collision pairs produced different SVGs on the tested fixtures; the logo pair matched only for one simple fixture.

## 3. Pre-change baseline and post-change comparison

Before production edits, deterministic route-preset output baselines were captured in operating-system temporary storage with the real stage-one route-preset and converter-parity scripts. The baseline recorded the selected ID and label, effective settings and payload values, exact and normalized SVG hashes, history label, active card, pinned card, default, and second-upload behavior for every collision pair plus one non-colliding preset on each affected route.

Post-change focused route-preset runs retained the exact and normalized SVG hashes for the affected default, local collision, shared collision, and non-colliding cases. The post-change parity collision section retained the prior output relationship: five tested pairs differ materially and the simple-logo comparison matches. The changed IDs are metadata only; no effective preset setting, conversion engine, filename, or output comparison changed.

The browser matrix additionally ran the two formerly colliding cards on each affected route (desktop for the route-local card and mobile for the shared card). All 12 scenarios produced the selected label in the output/history card, exactly one active card, a usable preview, settings/edit controls, copy and download initiation, and the established route default after a distinct second upload.

## 4. Preset-ID ownership decisions

The shared additions retain their established IDs because they are the reusable/canonical definitions. The conflicting route-local definitions receive descriptive route-owned IDs. This is the smallest compatible correction: it leaves labels, ordering, defaults, and settings unchanged while making every assembled list unique.

| Confirmed collision | Shared/canonical ID retained | Route-local ID before | Route-local ID after | Ownership rationale |
| --- | --- | --- | --- | --- |
| Icon bold | `icon-bold` | `icon-bold` | `icon-bold-fill` | The shared `Icon - Bold` card retains its reusable ID; the local `Icon - Bold fill` card is the route-specific variant. |
| Logo smooth | `logo-smooth` | `logo-smooth` | `logo-extra-smooth` | The shared `Logo - Smooth` card remains canonical; the local `Logo - Extra smooth (fewer nodes)` definition is the distinct route variant. |
| WebP for Cricut | `cricut-clean-cut` | `cricut-clean-cut` | `webp-cricut-clean-cut` | The shared Cricut definition retains its cross-route identity; the local default remains route-specific. |
| JPEG for Cricut | `cricut-clean-cut` | `cricut-clean-cut` | `jpeg-cricut-clean-cut` | Same shared ownership; the local JPEG route default is independently addressable. |
| JPG for Cricut | `cricut-clean-cut` | `cricut-clean-cut` | `jpg-cricut-clean-cut` | Same shared ownership; the local JPG route default is independently addressable. |
| PNG for Cricut | `cricut-clean-cut` | `cricut-clean-cut` | `png-cricut-clean-cut` | Same shared ownership; the local PNG route default is independently addressable. |

## 5. Legacy-state compatibility

The only persisted preset-ID use found is the pinned-preset storage key `ilovesvg:pinned-presets:v1`. Active selection and route history are not persisted across reloads; no preset-ID URL/query, session-storage, server-request persistence, saved-preference, or serialized-output migration surface was found.

Existing unambiguous IDs retain their meaning. An old stored duplicate pin cannot identify which of two former cards a user meant from the ID alone. The safe bounded fallback retains the shared/canonical interpretation of the old ID, rather than guessing a route-local card or introducing an alias registry. There is no result/history data loss because such entries are not persisted. This unavoidable old-pin ambiguity is documented, not hidden.

## 6. Active, pinned, and history state correction

Rendered cards continue to compare stable IDs, but the assembled lists now contain no duplicate reachable ID. Therefore selecting, pinning, or unpinning either former pair affects that exact card only. History items retain the resolved `presetId` and visible `presetLabel` when the conversion begins; reopening a history result restores its exact preset card where that ID remains available. A history label is no longer rebuilt through a first-match search against a duplicated ID.

The shared output item type now permits the bounded primitive `presetId` field. Large preset objects are not copied into history, and history capacity/order, output editing, copy, download, and export behavior are unchanged.

## 7. Immediate-submit timing investigation

The affected handlers were inspected for the proven sequence of setting React active-preset state and immediately starting conversion in the same call stack. Where present, conversion and result creation now receive the clicked ID directly and snapshot its label/settings before submission. This covers the collision routes and the inspected immediate-submit flows in JPG, JPEG, print-then-cut, and stickers.

The PNG-for-Cricut route already carried submitted identity through its request/result map; it needed the new unique local ID and exact history-navigation selection, not a timing refactor. No timeout was added. The JPEG VTracer race investigation below separately proved and corrected route-local active-result ownership without changing the clicked preset values.

## 8. Tests added or updated

- `scripts/preset-identity-remediation-audit.mjs` checks the real preset selector helper and production route definitions for every collision: unique IDs, active/pin isolation, exact submit identity, exact history metadata, navigation restoration, retained labels/defaults/order/settings, and legacy canonical fallback.
- `scripts/stage1-route-preset-smoke.mjs` rejects duplicate reachable preset IDs by default, reports them by route, and records exact and normalized SVG hashes for deterministic comparisons.
- `scripts/converter-parity-audit.mjs` records the distinct local/shared IDs for the six collisions while preserving the existing actual-output comparison assertions.
- `scripts/converter-route-parity-smoke.mjs` has a deterministic local-fixture browser identity mode. It checks both cards for all six routes, desktop/mobile coverage, selected history label, single active card, settings/edit, preview, copy/download initiation, and established second-upload defaults. It uses no external fixture path and removes its temporary profile, downloads, fixtures, and report on success or failure.
- `scripts/jpeg-active-result-remediation-audit.mjs` imports the production result-ownership helper and performs 26 focused checks covering exact active-result selection, action hashes, history navigation, stale upload/reset completions, second-upload generations, intentional concurrent history, duplicate-completion idempotence, metadata attachment, stable busy retries, and the unchanged JPG control route.
- `scripts/hybrid-browser-smoke.mjs` now admits deterministic JPEG/JPG fixture filtering and reports actual clipboard/download SHA-256 hashes and viewport dimensions. This keeps the production-browser assertions tied to decoded previews and downloaded/copied content rather than labels alone.

## 9. Browser and output-regression evidence

Affected browser routes were exercised directly:

- `/icon-to-svg-converter`
- `/logo-to-svg-converter`
- `/webp-to-svg-for-cricut`
- `/jpeg-to-svg-for-cricut`
- `/jpg-to-svg-for-cricut`
- `/png-to-svg-for-cricut`

The full browser matrix passed all 12 selected-card scenarios. Existing focused source/action checks also covered the representative unaffected root, PNG converter, JPG converter, JPEG converter, and black-and-white converter paths. Browser download completion is not claimed; the browser assertion is download initiation, while output-action tests cover the deterministic copy/download payload checks.

Deterministic output evidence is intentionally bounded to the fixtures and settings tested. Equality proves the preservation of these cases, not universal route parity or consolidation readiness.

## 10. JPEG VTracer active-output/history race

### Reproduction and state trace

The original runtime audit captured one real failure on `/jpeg-to-svg-converter`: a VTracer result of 15,241 bytes entered the result/history state, but the previous 11,052-byte Potrace result remained the selected action target. A clean retry passed, which is consistent with a completion-order race rather than a deterministic VTracer conversion failure.

One clean sequential pre-change trial and one rapid overlapping pre-change trial did not reproduce the visible failure. The production state path nevertheless proved the defect directly. The route assigned result timestamps at completion, prepended each completed result to history, and implicitly used the first history item for preview/copy/download/edit. At the same time, request metadata was held in singular mutable refs even though the shared fetcher permits multiple successful jobs to finish. An older submitted Potrace job that completed after a newer VTracer job could therefore be stamped and prepended last, reclaiming the implicit current-output position. This was not delayed UI rendering, a duplicate result ID, a stale fixture attachment, or a conversion-engine defect.

The scope remains JPEG-specific. The JPG route was used as the control and is not described as affected.

### Intended active-result semantics

- The newest submitted foreground job in the current source generation becomes active when it completes.
- Older intentional jobs may complete and remain in the bounded history, ordered by submission rather than network completion.
- Selecting an older history result is respected until a newer foreground submission intentionally produces a current result.
- A completion from a prior upload or reset generation cannot become active or repopulate cleared state.
- Preview, copy, download, editor, update-preview, history highlight, preset label, and engine metadata resolve through one stable active result ID.
- Retrying a server-busy response retains the original submission ownership instead of creating a newer logical job.

### Implementation

`app/client/lib/converter/traceResultOwnership.ts` provides the typed production operations used by the route: per-generation/per-sequence ownership, idempotent history commit by stable result ID, bounded submission-order history, current-generation activation checks, and exact active-result resolution.

`app/routes/jpeg-to-svg-converter.tsx` now creates ownership and snapshots preset/settings/source metadata at submission time. Its in-flight map is consumed on completion, successful history insertion and active selection use the same stable result ID, and upload/reset generation invalidation rejects obsolete completions. Intentional completed jobs are retained; conversion concurrency is not serialized or disabled. No timeout, forced render, global mutable latest-result variable, unbounded registry, or conversion change was introduced.

`TraceOutputPanel` accepts an optional explicit active output stamp and selection callback. The JPEG route uses those props so preview actions and editor entry resolve the same result. Existing routes keep the prior fallback behavior.

### Browser and hash evidence

Four independent desktop JPEG production-browser runs covered default/Potrace, alternate VTracer, preview, update-preview, clipboard, and actual download actions: 12 of 12 scenarios passed. Three JPG control runs passed 9 of 9 equivalent scenarios. A 390 by 844 JPEG mobile run passed all 3 scenarios. No run emitted a console error.

| Action target | Clipboard SHA-256 | Download SHA-256 | Filename |
| --- | --- | --- | --- |
| JPEG Potrace | `dba67ec62da9baa71199fcfc12648d25ab1cb0906560fd50f8d6ae047d7cd70e` | `f03214845805198d161e9353b0057e29c8fbd42cc5ee8fd350845e6ecc5e31c1` | `jpeg-to-svg-converter.svg` |
| JPEG VTracer | `ab03639bc595d903e14408ce01e5c78e63279685ecf5f49c4e3af114b038428d` | `ba3287d70f4c24c3d4b7ec0a94b6f28d57d9ecc4ec0774b3dc85e9cbb7bccd33` | `jpeg-to-svg-converter.svg` |

Clipboard and download serialization are compared within the same action type; they are not expected to hash identically to each other. Both action types were stable across trials and distinguished the VTracer target from the Potrace target. Direct history navigation also restored the matching Potrace or VTracer editor/action source.

The focused editor/source-replacement browser matrix included JPEG across nine viewport widths. Preview, copy, download, history replacement, source removal, distinct second upload, and editor workflows passed with no horizontal overflow or console errors. The suite's strict accordion responsiveness assertion remained timing-only: JPEG exceeded the two-pixel bound at three desktop widths by 0.028 to 0.550 pixels, alongside unchanged control routes.

### Output regression and remaining uncertainty

The converter parity audit passed all deterministic comparisons after the correction. JPEG and JPG equal-action scenarios retained byte- and normalized-SVG identity; all six preset-collision relationships and hashes remained unchanged. ViewBox, path structure, filenames, raster/package families, and conversion values were unaffected.

The original UI race was timing-sensitive and did not reproduce in every clean trial. Confidence in the correction comes from the captured audit failure, the directly proven state-ownership path, the production-helper concurrency/staleness tests, and repeated browser action-hash verification. This evidence does not claim that every possible browser scheduling order or fixture has been exercised.

## 11. Preservation confirmation

This milestone does not change routes, accepted/output formats, algorithms, quality, visible labels, descriptions, preset ordering, default selections, effective settings, controls, history capacity/order, intentional conversion concurrency, output filenames, metadata, canonicals, schema, sitemap, public content, or the All Tools section. No preset was removed, merged, or visibly renamed. The behavior change is limited to exact preset identity/label ownership and the intended JPEG result-selection, stale-generation, and action-target semantics described above.

## 12. Unresolved findings and recommended next batch

The legacy duplicate pin ID cannot reconstruct its historical route-local card without additional disambiguating data; the canonical shared fallback is the safe compatibility behavior. The original JPEG UI symptom remains inherently scheduling-sensitive, so the direct state-path proof and deterministic ownership tests are retained as the durable regression evidence.

Two existing broad browser checks retained nonblocking limitations outside the changed JPEG state path. The focused-editor suite exceeded its strict two-pixel accordion responsiveness bound at several widths, including unchanged control routes; its correctness, source-replacement, preview, copy, download, and editor assertions passed. The post-conversion-editability suite reported three response-time thresholds on `/jpg-to-layered-svg-for-cricut`, while its actions and edits completed. It also classified copy/download on `/code-to-svg-for-cricut` as mismatches after the harness failed to apply any editable color or slider change, making that bespoke-route comparison inconclusive rather than evidence of a JPEG regression. No hang, leak, console error, or output difference accompanied these results.

Recommended next batch: **final adversarial review and milestone closure**.

## 13. Final milestone file manifest and validation

The final milestone contains only the following production, audit, and documentation files:

- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/lib/converter/traceResultOwnership.ts`
- `app/routes/icon-to-svg-converter.tsx`
- `app/routes/jpeg-to-svg-converter.tsx`
- `app/routes/jpeg-to-svg-for-cricut.tsx`
- `app/routes/jpg-to-svg-converter.tsx`
- `app/routes/jpg-to-svg-for-cricut.tsx`
- `app/routes/logo-to-svg-converter.tsx`
- `app/routes/png-to-svg-for-cricut-print-then-cut.tsx`
- `app/routes/png-to-svg-for-cricut-stickers.tsx`
- `app/routes/png-to-svg-for-cricut.tsx`
- `app/routes/webp-to-svg-for-cricut.tsx`
- `docs/audits/ilovesvg-converter-state-remediation.md`
- `docs/audits/ilovesvg-runtime-capability-verification.md`
- `package.json`
- `scripts/converter-parity-audit.mjs`
- `scripts/converter-route-parity-smoke.mjs`
- `scripts/hybrid-browser-smoke.mjs`
- `scripts/jpeg-active-result-remediation-audit.mjs`
- `scripts/preset-identity-remediation-audit.mjs`
- `scripts/stage1-route-preset-smoke.mjs`

The final pre-commit deployment gate passed the focused preset audit, 26-check JPEG ownership audit, sampled 798-preset audit, exhaustive 8,980-preset audit, 12-scenario desktop/mobile preset browser matrix, route-filtered JPEG and JPG production-browser checks, converter parity audit, client lifecycle audit, queue audit, output UX audit, conversion-action audit, schema audit, route-coverage audit, typecheck, production build, and full `npm test`. Script parsing, UTF-8, trailing-whitespace, privacy/local-path, temporary-artifact, process/port, and Git whitespace checks also passed. No milestone comparison failure, hang, process leak, output difference, or private artifact remained. The build retained only the existing Vite chunk-size and mixed dynamic/static-import warnings.
