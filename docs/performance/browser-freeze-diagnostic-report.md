# Browser Freeze Diagnostic Report

## 1. Executive summary

This pass reverted the dirty performance branch and ran a diagnostic-only browser reproduction on a clean branch from `main`. No production runtime code was changed.

The real browser "Page Unresponsive" dialog was not reproduced in the final diagnostic run. The page stayed alive on all tested routes with zero CDP interaction timeouts and zero page errors. The run did reproduce heavy, slow interaction conditions: previous output cards stayed expanded while new conversions were started, multiple full SVG previews were mounted, and Settings/Edit interactions took 68 ms to 351 ms depending on route, with copy/download clicks around 267 ms to 776 ms.

The strongest evidence points to output-history rendering and overlapping conversions as the safest next production target, not route metadata, SEO, navigation, presets, or conversion quality.

## 2. Baseline used

- Branch tested: `performance-regression-recovery-clean-may-15`
- Source branch: current `main`
- Current `HEAD` when branch was created: `490a275`
- Known deployed DigitalOcean reference: `753431c5cc4a350d5a8b3fcd56e8dded976ca350`
- Baseline reference was confirmed with `git cat-file -t`.
- The diagnostic did not revert to the deployed reference. It used that commit only as the known-good production comparison point.

## 3. Fixture used

- Real user fixture was available and used: `C:\Users\Suhas\Downloads\Screenshot 2026-05-06 194041.png`
- PNG fixture size: 411,632 bytes
- Generated JPG derivative for JPG route: `%TEMP%\ilovesvg-browser-freeze-diagnostic\9896\fixtures\screenshot-like.jpg`
- JPG derivative size: 366,862 bytes

## 4. Routes tested

- `/`
- `/jpg-to-layered-svg-for-cricut`
- `/png-to-layered-svg-for-cricut`

## 5. Reproduction steps

The diagnostic loaded each route on `http://localhost:3000`, uploaded the screenshot-like fixture, selected the closest normal or fast preset, converted, selected the closest layered/color preset when visible, converted again without refresh, kept previous outputs visible, opened Settings/Edit on the latest editable output, expanded layer/color settings when available, changed a color control when available, moved a slider when available, attempted an output More menu, scrolled, and attempted copy/download.

The output More menu was not present on these output cards, so the diagnostic intentionally did not open the global navigation More menu.

## 6. Metrics by route

| Route | Alive | Timeouts | After second cards | Expanded cards | Full SVG previews | Decoded SVG bytes | Long tasks | Settings/Edit | Color edit | Slider move | Scroll | Copy | Download |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | yes | 0 | 4 | 4 | 2 | 1,079,416 | 75 | 351 ms | 223 ms | 227 ms | 133 ms | 267 ms | 774 ms |
| `/jpg-to-layered-svg-for-cricut` | yes | 0 | 1 | 1 | 1 | 13,178 | 6 | 182 ms | 106 ms | 5 ms | 40 ms | 273 ms | 775 ms |
| `/png-to-layered-svg-for-cricut` | yes | 0 | 3 | 3 | 2 | 21,274 | 18 | 223 ms | 68 ms | 40 ms | 51 ms | 280 ms | 776 ms |

Additional final-state observations:

- `/` ended with one editing workspace, two full SVG previews, four visible layer rows, 1,288,633 decoded preview bytes, and 81 long tasks.
- `/jpg-to-layered-svg-for-cricut` ended with one editing workspace, two full SVG previews, seven visible layer rows, 671,260 decoded preview bytes, and 8 long tasks.
- `/png-to-layered-svg-for-cricut` ended with one editing workspace, two full SVG previews, seven visible layer rows, 760,800 decoded preview bytes, and 19 long tasks.

## 7. Freeze or unresponsiveness reproduction

The diagnostic did not reproduce the browser "Page Unresponsive" dialog. It also did not record CDP command timeouts, page crashes, or page errors.

This does not prove the freeze is fixed. The run did reproduce slow interaction surfaces and long-task accumulation under the same broad usage pattern: repeated conversions, old outputs visible, Settings/Edit open, layer/color changes, scroll, copy, and download.

## 8. Evidence of root cause

Strongly supported:

- Old output cards remain expanded during repeated conversions. Evidence: `/` had 4 output cards and 4 expanded cards after the second conversion. `/png-to-layered-svg-for-cricut` had 3 output cards and 3 expanded cards after the second conversion.
- Multiple full SVG previews remain mounted. Evidence: `/` had 2 full SVG previews and 1,079,416 decoded SVG bytes after the second conversion. `/png-to-layered-svg-for-cricut` had 2 full SVG previews after the second conversion.
- Settings/Edit interactions are measurably slow with heavy outputs present. Evidence: Settings/Edit took 351 ms on `/`, 182 ms on JPG layered, and 223 ms on PNG layered.
- Copy/download stayed callable but are not cheap in this state. Evidence: copy took 267 ms to 280 ms, and download took about 775 ms on all three routes.
- Repeated conversion can overlap with still-running jobs. Evidence: `/` had 2 active jobs after each conversion wait window. `/png-to-layered-svg-for-cricut` had 1 active job after both conversion wait windows.

Not proven:

- The browser dialog itself was prevented.
- Huge layered SVGs alone are the root cause. The real fixture produced relatively small layered SVGs on the layered routes, but the home route generated larger single-trace preview data.
- Output editors for old cards remain mounted. The diagnostic proves old previews remain mounted and old cards remain expanded, but it does not prove old Settings/Edit panels are mounted before opening the latest output.

## 9. What should not be trusted from the prior dirty branch

Do not trust claims from the dirty performance branch that the real freeze was fixed. That branch mixed production runtime changes, browser harness changes, temporary diagnostics, and failing settings-performance state.

Do not trust prior pass/fail browser smoke results as product evidence unless they were run against the canonical `http://localhost:3000` iLoveSVG server after stale listeners were cleared.

Do not trust any prior harness change that widened timeouts, changed selectors, added fallback clicks, or made assertions easier without separately proving the real manual scenario.

## 10. Recommended smallest production fix

Start with output-history rendering scope:

1. Auto-collapse older output cards when a newer output becomes ready or when Settings/Edit opens on the latest output.
2. Avoid rendering full heavy SVG previews for collapsed or non-latest output cards. Keep copy/download data intact and full quality.
3. Ensure only the active/latest editable output mounts the settings/editor workspace.
4. Avoid starting redundant overlapping conversions from upload plus manual convert when a current conversion is already running for the same file/settings.

Do not change conversion quality, presets, route URLs, SEO, navigation, sitemap, or monetization in the next implementation pass.

## 11. Exact files likely to change in the next implementation pass

Likely production files:

- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/BespokeTraceOutputPanel.tsx`
- `app/routes/home.tsx`
- `app/routes/png-to-layered-svg-for-cricut.tsx`
- `app/routes/jpg-to-layered-svg-for-cricut.tsx`

Likely test or diagnostic files:

- `scripts/browser-freeze-diagnostic.mjs`
- Existing route/output smoke tests only if assertions are strengthened without weakening current coverage.

Do not edit `scripts/hybrid-browser-smoke.mjs` for the next pass unless the user explicitly asks.

## 12. Tests that must protect the fix

- `npm.cmd run test:browser-freeze-diagnostic`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:tool-output`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

The diagnostic should continue to record output card counts, expanded output card counts, full SVG preview counts, settings panel counts, layer row counts, decoded SVG bytes, long task counts, and interaction timings.
