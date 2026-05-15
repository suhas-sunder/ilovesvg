# Performance Root Cause Audit

Date: 2026-05-15

Branch: `performance-root-cause-audit-may-15`

Baseline under test: current `main` at `490a2759918945d9e184a0a4c18bea0db11af1e3`

Known deployed reference, not reverted to: `753431c5cc4a350d5a8b3fcd56e8dded976ca350`

Diagnostic JSON: `tmp/performance-root-cause-benchmark.json` (not committed)

## 1. Executive Summary

The strongest evidence does not support a simple "old output cards are the root cause" diagnosis.

The real user screenshot fixture was used: `C:\Users\Suhas\Downloads\Screenshot 2026-05-06 194041.png`, 411,632 bytes, 1751 by 1522 PNG.

The clearest root-cause candidate is overlapping conversion state, especially on layered PNG flows:

- `/png-to-layered-svg-for-cricut` auto-submitted a conversion on upload, then another conversion/preset action joined the same in-flight conversion.
- The benchmark captured `client-attempt-start`, `in-flight-join`, then `client-attempt-success` with `engineUsed: "vtracer"` in about 1.6 seconds, but the visible output card stayed in `Converting...` for 150 seconds.
- That implicates stale pending output state or latest-run handling, not raw VTracer runtime.

The second strongest finding is post-conversion preview/editor cost on large SVGs:

- Potrace screenshot/photo outputs around 527 KB to 625 KB made Settings/Edit and color edits noticeably slower than small SVG outputs.
- Settings-open states mounted two full SVG previews and decoded preview bytes rose to about 1.29 MB in the home history scenario.
- Existing code computes full preview SVG strings, complexity warnings, and data URI previews inside output-card rendering before the collapsed-card branch.

The exact manual browser "Page Unresponsive" dialog was not reproduced on `/`, `/png-to-layered-svg-for-cricut`, or `/jpg-to-layered-svg-for-cricut` in this run. The optional `/image-to-layered-svg-for-cricut` route produced repeated CDP timeouts, but that route needs separate validation before treating it as the same manual freeze.

## 2. Fixture Details

Primary screenshot fixture:

- Path: `C:\Users\Suhas\Downloads\Screenshot 2026-05-06 194041.png`
- Source: real user fixture
- Size: 411,632 bytes
- Dimensions: 1751 by 1522
- Format: PNG

Additional generated fixtures:

- `screenshot-like.jpg`: JPEG derived from the screenshot-like PNG, 366,862 bytes, 1751 by 1522
- `simple-logo.png`: 11,612 bytes, 520 by 360
- `simple-logo.jpg`: 13,410 bytes, 520 by 360
- `transparent-sticker.png`: 18,223 bytes, 520 by 360
- `photo-like-noisy.jpg`: 52,584 bytes, 800 by 560
- `small-cleaner-fixture.svg`: 401 bytes

## 3. Route/Preset Benchmark Matrix

The diagnostic was run against `BASE_URL=http://localhost:3000`. The server title matched `iLoveSVG | Free SVG Converter and Image to SVG Tools`.

| Scenario | Route | Engine observed | Conversion wait | Output cards | Full SVG previews | Decoded preview bytes | Long tasks | Settings open | Color edit | Slider | CDP unresponsive |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| home default screenshot | `/` | pending/unknown latest, prior Potrace output visible | 120.1s timeout | 2 | 1 | 539,708 | 6 / 422ms | n/a | n/a | n/a | no |
| home line-art screenshot | `/` | pending/unknown latest, Potrace output visible | 120.1s timeout | 3 | 2 | 1,079,416 | 13 / 901ms | n/a | n/a | n/a | no |
| png layered flat screenshot | `/png-to-layered-svg-for-cricut` | pending/unknown latest, VTracer success in debug | 150.2s timeout | 2 | 1 | 10,637 | 7 / 409ms | n/a | n/a | n/a | no |
| png layered filled screenshot | `/png-to-layered-svg-for-cricut` | pending/unknown latest, VTracer success in debug | 150.2s timeout | 2 | 1 | 10,637 | 6 / 505ms | n/a | n/a | n/a | no |
| jpg layered screenshot | `/jpg-to-layered-svg-for-cricut` | VTracer | ready after upload/cache path | 1 | 2 | 671,260 | 6 / 401ms | 1ms | 58ms | 8ms | no |
| png logo line-art | `/png-to-svg-converter` | Potrace | output succeeded, wait guard timed out | 1 | 2 | 23,482 | 8 / 550ms | 1ms | 81ms | 8ms | no |
| jpg photo-like | `/jpg-to-svg-converter` | Potrace | 257ms after auto-start | 1 | 2 | 734,891 | 9 / 1087ms | 355ms | 214ms | 7ms | no |
| svg cleaner | `/svg-cleaner` | not comparable | upload harness did not find file input | 0 | 0 | 0 | 3 / 240ms | n/a | n/a | n/a | no |

Harness caveats:

- Some routes auto-convert on upload or preset selection. The diagnostic records that as an existing output/conversion state rather than a click failure.
- Some wait guards timed out even when a previous output was visible, because a newer pending output card stayed active.
- `/svg-cleaner` did not expose the same file-input flow to this script, so it is listed as not comparable for conversion metrics.

## 4. VTracer vs Potrace vs Hybrid Comparison

Current engine routing from code inspection:

- VTracer is selected for client-eligible `traceMode: "layered"` conversions and preset ids containing `layer`, `layered`, `color`, or `poster` in `app/shared/tracing/enginePolicy.ts`.
- Potrace is selected for explicit `engine: "potrace"`, route ids or preset ids containing legacy line-art/cut terms, and inputs outside the safe VTracer client limits.
- Hybrid browser-first/server-fallback lives in `app/client/lib/tracing/useHybridTraceFetcher.ts`.
- VTracer runs in `app/client/workers/vtracer.worker.ts`, not on the main thread.
- Client tracing is capped at two active slots in `app/client/lib/tracing/vtracerWorkerClient.ts`.

Measured comparison:

- VTracer successful case: JPG layered route on screenshot-like JPG completed the client attempt in about 1.8 seconds based on debug timestamps, produced a 13.2 KB SVG, 7 decoded paths, and 12 decoded layer markers.
- VTracer problematic case: PNG layered route recorded VTracer success in about 1.6 seconds, but the visible output remained `Converting...` for 150 seconds. This points at UI/job state, not VTracer compute time.
- Potrace successful small case: PNG logo line-art produced a 2.6 KB SVG and was responsive.
- Potrace large case: JPG photo-like output produced about 625 KB SVG, with Settings/Edit at 355ms and color edit at 214ms.
- Potrace screenshot case: home route produced about 527 KB preview output and pending/stale output behavior persisted after 120 seconds.

Conclusion: VTracer/Potrace routing is implicated indirectly through output complexity and job-state paths, but the benchmark does not prove "VTracer is simply too slow." For the PNG layered freeze-like case, the measured VTracer worker completed; the UI did not settle.

## 5. Conversion-Time Findings

Proven or strongly supported:

- Multiple conversion submissions can overlap on layered routes. `handleFile` submits after upload, `applyPreset` submits again when `file && autoMode !== "off"`, and the live debounce effect can submit from `[file, autoMode]`.
- The PNG layered benchmark recorded `client-attempt-start`, `in-flight-join`, and `client-attempt-success`. The first success had `latest: false`, while the latest visible output card stayed pending.
- VTracer runs in a browser worker and is capped to two concurrent client traces, so direct main-thread VTracer execution is not the observed mechanism.

Suspected but not fully proven:

- Stale latest-run handling or pending-card replacement is leaving new output cards in a running state after a shared in-flight result resolves.
- Home route screenshot conversions may suffer a similar stale pending-card path, but the route uses more route-local logic, so the exact cause needs a narrower home-only follow-up.

Not proven:

- That Potrace should replace VTracer for all layered screenshot-like inputs.
- That conversion quality or layer count must be reduced.
- That old output cards alone cause the manual browser freeze.

## 6. Post-Conversion Settings Findings

Measured Settings/Edit cost:

- JPG layered VTracer output: color edit 58ms, slider 8ms, copy 275ms, download 766ms.
- PNG logo Potrace output: color edit 81ms, slider 8ms, copy 277ms, download 770ms.
- JPG photo-like Potrace output: Settings/Edit 355ms, color edit 214ms, slider 7ms, copy 283ms, download 770ms.
- Home screenshot Potrace history state: color edit 246ms, slider 276ms, copy 281ms, download 774ms.

Interpretation:

- Settings lag scales with full edited SVG size and preview duplication more than with engine label alone.
- Color/range controls are throttled, but the committed edit still updates the SVG/history/output state and can force expensive preview recomputation.

## 7. Preview/Rendering Findings

Static code findings:

- `TraceOutputPanel` computes `previewSvg = getTraceOutputSvg(item)` while iterating every history item, before the collapsed-card return.
- The same render path computes SVG byte size and output complexity warnings from the full preview SVG.
- `getTraceOutputBaseSvg` applies layer edits and size attributes before preview rendering.
- `EditedSvgPreviewImage` converts the edited SVG to a `data:image/svg+xml` URI with `encodeURIComponent`.
- Focused Settings/Edit states can mount two full SVG previews, which doubled decoded preview bytes in the home history scenario from about 539 KB to about 1.29 MB.

Interpretation:

- Preview/rendering is a real contributor to post-conversion lag for large SVGs.
- It is not yet proven to be the sole cause of the full browser unresponsive dialog.

## 8. Output History Findings

The intended one/two/four-output history matrix did not fully materialize in the rerun because repeated home conversions updated or stayed focused on one output while pending/stale conversions remained active.

Measured:

- One visible home screenshot output: one full SVG preview, 539,708 decoded preview bytes, 6 long tasks.
- Settings-open state: two full SVG previews, about 1.29 MB decoded preview bytes, 9 long tasks.

Conclusion:

- Old output mounting is not proven as the root cause.
- Full preview duplication is proven as a render-cost multiplier.
- The next pass should separately test four completed outputs after the pending-output bug is fixed or isolated.

## 9. Caching/Rerender Findings

What is cached:

- Conversion results are cached by `app/client/lib/converter/conversionCache.ts`, with size and entry limits.
- In-flight conversions are deduped by conversion cache key.
- Output appearance SVGs are cached by output key plus settings key in `TraceOutputPanel`.
- Layer edit SVG output has a `WeakMap` cache keyed by the layer array reference.
- Color and range inputs use `useThrottledCommit`.

What still recomputes or can invalidate cheaply:

- Base SVG layer edits and size attributes are recomputed when item/layer identity changes.
- Data URI encoding runs when the edited SVG string changes.
- Output complexity warning computation runs per expanded render path.
- Collapsed output cards still reach expensive preview computation in `TraceOutputPanel` before the collapsed branch.
- Focused editor creates an additional full SVG preview of the same edited output.

## 10. Whether Old Output Cards Are Truly a Root Cause

Not proven.

Evidence against making that the primary diagnosis:

- The strongest PNG layered failure showed VTracer success but stale pending output, with only two output cards and one full SVG preview.
- JPG layered VTracer output remained responsive with one output card and two previews.

Evidence that output cards can worsen lag:

- Settings-open/focused states duplicate full SVG previews.
- Large Potrace outputs show slower Settings/Edit and color edits.
- The render path computes full preview strings before checking collapsed output state.

Recommended wording: old output cards and full previews are likely amplifiers, not the proven root cause.

## 11. Whether VTracer Should Be Rerouted/Fallbacked for Heavy Inputs

Do not reroute layered VTracer broadly yet.

Supported recommendations:

- Keep Potrace-first behavior for line-art, scan, logo, cut-file, black/white, and similar presets.
- Keep VTracer for layered/color output where editable colored layers are the route intent.
- Add job-state safeguards first, because VTracer completed quickly in successful and problematic layered cases.
- Consider a fallback only when VTracer times out, fails output validation, exceeds path/byte thresholds, or the user explicitly chooses a non-layered/cut output.

Unsupported by this audit:

- Changing conversion quality.
- Lowering default layer counts.
- Routing all screenshot-like layered inputs to Potrace.

## 12. Recommended Smallest Safe Fixes, Ranked

1. Fix overlapping conversion state and pending output replacement.
   - Likely files: `app/routes/png-to-layered-svg-for-cricut.tsx`, `app/routes/home.tsx`, `app/routes/jpg-to-layered-svg-for-cricut.tsx`, possibly `app/client/lib/tracing/useHybridTraceFetcher.ts`.
   - Goal: when upload auto-submit, preset auto-submit, and in-flight dedupe overlap, only the latest intended output remains pending, and a shared VTracer success resolves the latest pending card.

2. Add a focused regression diagnostic for the stale pending case.
   - Protect the exact evidence: `client-attempt-success` plus no visible output resolution within a short timeout should fail the diagnostic.
   - Do not edit `scripts/hybrid-browser-smoke.mjs`.

3. Move expensive preview computation behind collapsed/focused checks.
   - Likely files: `app/client/components/converter/TraceOutputPanel.tsx`, `app/client/components/converter/BespokeTraceOutputPanel.tsx`.
   - Keep copy/download using the full latest SVG.

4. Add large-SVG preview/data-URI caching or object URL handling only after measuring.
   - Likely files: `app/client/components/svg/EditedSvgPreviewImage.tsx`, `app/client/components/converter/FullscreenOutputPreview.tsx`.
   - Preserve sanitizer boundaries and copy/download parity.

5. Reduce editor recomputation on color/slider commit.
   - Likely files: `app/client/components/svg/LayerPaletteEditor.tsx`, `app/client/components/converter/TraceOutputPanel.tsx`, `app/client/lib/converter/outputAppearance.ts`.
   - Do not throttle final commits beyond the existing immediate-flush behavior.

## 13. What Not To Change

Do not change:

- Conversion quality
- Presets
- Layer counts as a guessed performance fix
- Route URLs
- SEO, schema, sitemap, navigation, or monetization
- `scripts/hybrid-browser-smoke.mjs`
- Output/copy/download parity
- SVG sanitization behavior

## 14. Tests That Should Protect The Future Fix

Add focused tests or diagnostics for:

- Upload auto-conversion plus preset click does not create duplicate pending cards.
- In-flight joined conversion success resolves the latest visible pending output.
- VTracer success cannot leave a card stuck in `Converting...`.
- Settings/Edit opens on a completed large SVG and copy/download still use the edited SVG.
- Collapsed old outputs do not mount or encode full heavy previews.
- Four completed outputs remain responsive only after the pending-output bug is isolated or fixed.

