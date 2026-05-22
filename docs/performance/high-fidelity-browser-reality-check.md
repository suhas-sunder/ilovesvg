# High-Fidelity Browser Reality Check

Checked on branch `high-fidelity-browser-reality-check-may-19` at
`9c44950388f971fac8fdbd1b4d05670474844ae7`.

## Executive summary

The user-observed high-fidelity problems are real, and the current diagnostics do
not represent the browser experience.

The strongest reproduced blocker is not the previously reported `10 of 10`
layer-row text. In a fresh browser profile on current `main`, the homepage real
UI flow for the required card fixtures did not reach a usable completed
Layered - Flat Color output within the 4-minute gate. The preset click
auto-started conversion, `Convert` was unavailable while busy, and browser state
polls eventually timed out with `Runtime.evaluate`. Settings / Edit and
download never became reachable for those card runs.

At the same time, the existing diagnostics still pass. They report 28-30 grouped
colors and no failures for the same card fixtures because they use direct/server
conversion paths and do not prove that the homepage browser UI can complete,
open layer editing, render preview, and download the output.

The output-size problem is also real. The direct action/server path produces
23.6-29.1 MB SVGs for the card fixtures. Structure inspection of IMG_8846 and
IMG_9404 shows the size is dominated by enormous `d` path strings and excessive
numeric precision, not duplicate paths, clip paths, masks, filters, or metadata.

## Real browser UI results per fixture

Flow used for each fixture:

1. Open `/`.
2. Upload the fixture through the UI file input.
3. Select `Layered - Flat Color`.
4. Observe that selecting the preset auto-starts conversion before `Convert`
   can be clicked.
5. Wait up to 4 minutes for a completed output card.

| Fixture | Source bytes | Dimensions | Selected UI preset | Completion | Elapsed | UI layer count | Downloaded SVG | Engine path | Quality note |
| --- | ---: | --- | --- | --- | ---: | --- | --- | --- | --- |
| `C:\Users\Suhas\Downloads\IMG_8846.JPEG` | 1,149,142 | 1536 x 2048 | `Layered - Flat Color Insanely Slow` | Failed to become usable | 273,744 ms | Not reachable | Not reachable | Not reachable | Browser stalled before visual review/download. |
| `C:\Users\Suhas\Downloads\IMG_9404.JPEG` | 1,154,339 | 1536 x 2048 | `Layered - Flat Color Insanely Slow` | Failed to become usable | 272,706 ms | Not reachable | Not reachable | Not reachable | Browser stalled before visual review/download. |
| `C:\Users\Suhas\Downloads\IMG_9288.JPEG` | 1,195,385 | 1536 x 2048 | `Layered - Flat Color Insanely Slow` | Failed to become usable | 272,340 ms | Not reachable | Not reachable | Not reachable | Browser stalled before visual review/download. |
| `C:\Users\Suhas\Downloads\IMG_9448.JPEG` | 952,151 | 1536 x 2048 | `Layered - Flat Color Insanely Slow` | Failed to become usable | 273,477 ms | Not reachable | Not reachable | Not reachable | Browser stalled before visual review/download. |

The fresh-browser run did not reproduce the exact `Showing 10 of 10 layer colors`
text because the UI failed earlier: Settings / Edit and Layer colors never became
reachable. That means the current failure is more severe than a layer-count row
mismatch.

## Diagnostic vs browser mismatch analysis

Diagnostics and real UI do not agree on user-observable success.

- `test:adaptive-palette-quality` passed and reported current app group counts:
  IMG_8846 = 28, IMG_9288 = 30, IMG_9404 = 30, IMG_9448 = 30.
- `test:fish-card-region-fidelity` passed and reported the same fixtures as
  server Potrace layered outputs with 28-30 groups.
- `test:settings-color-coverage` passed, but its maximum visible SVG colors and
  maximum exposed layer rows were only 15. It does not cover the large card
  browser completion problem.
- `test:preset-palette-rules-audit` passed with 0 guardrail failures.

Answers to the comparison questions:

1. Diagnostics and real UI do not agree on group counts because real UI never
   reaches layer rows for the card fixtures. Diagnostics report grouped counts
   from direct/server paths.
2. Diagnostics and real UI do not agree on engine path evidence. Fish/card uses
   `server Potrace layered path`; the browser homepage flow did not complete far
   enough to expose an engine line.
3. The nominal preset ID is the same for Flat Color: `layered-flat-color`.
   The execution path is not equivalent.
4. The uploaded files are the same card fixture paths.
5. Diagnostics bypass the route/browser state users actually hit: visible
   homepage upload, preset auto-start, pending card replacement, preview render,
   Settings / Edit, Layer colors, and browser download.
6. Fresh browser profiles reproduced the stalled behavior, so localStorage or
   pinned presets are not required to trigger the current blocker.
7. Stale browser settings remain possible for the user-observed `10 of 10` case,
   but they are not the primary blocker reproduced here.
8. No route-local cached preset definition was proven. The proven mismatch is
   direct-action diagnostics passing while the homepage browser UI does not
   complete.

## Output-size structure analysis

Real browser downloads were not available because the UI did not reach a
downloadable completed state. To inspect the known size issue without pretending
it was a browser download, I saved direct homepage action outputs for IMG_8846
and IMG_9404 using the same Layered - Flat Color settings used by
`fish-card-region-fidelity`.

| Fixture | SVG bytes | Paths | Avg path `d` length | Largest `d` | Visible colors | Groups | Duplicate paths | Precision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| IMG_8846 | 27,829,177 | 28 | 993,733 | 2,202,898 | 28 | 28 | 0 | 1,495,315 decimal numbers, avg 11.79 places, max 19 |
| IMG_9404 | 24,363,281 | 30 | 811,943 | 1,380,194 | 30 | 30 | 0 | 1,305,501 decimal numbers, avg 11.88 places, max 19 |

Structure findings:

- No `defs`, `clipPath`, `mask`, `filter`, or `style` blocks were present.
- `data-layer-id`, `data-layer-label`, and `data-layer-color` counts matched the
  layer count and do not dominate size.
- There were no duplicate path strings.
- Bloat is dominated by very large `d` attributes and excessive numeric
  precision.
- This is over the acceptable product budget for normal 1500px card images.

Visual review of the direct-action renders:

- IMG_8846 preserves broad color blocks but the title, small black text, and
  high-contrast details are washed out or broken into noisy light regions.
- IMG_9404 preserves some title and character linework, but the image is still
  visibly flattened/noisy and small text remains poor.
- The output is not competitive with a high-fidelity card conversion target, and
  color count alone is not enough to preserve important black text/detail.

## Preset stuck-loading findings

Fixture: `C:\Users\Suhas\Downloads\IMG_8846.JPEG`

Each preset was tested in an isolated fresh browser process through the homepage
UI. None reached a usable completed output within the 4-minute gate.

| Preset | Selected UI label | Completion | Elapsed | Output size | Layer count | Notes |
| --- | --- | --- | ---: | --- | --- | --- |
| Layered - Flat Color | `Layered - Flat Color Insanely Slow` | Failed | 273,744 ms | Not reachable | Not reachable | Auto-started conversion; browser state poll timed out. |
| Photo Many Colors | `Photo Many Colors Very Slow` | Failed | 263,143 ms | Not reachable | Not reachable | No usable output card within gate. |
| Premium Cartoon Fill + Ink | `Premium Cartoon Fill + Ink Insanely Slow` | Failed | 273,285 ms | Not reachable | Not reachable | Browser state poll timed out. |
| Sticker Fill + Stroke Detail | `Sticker Fill + Stroke Detail Insanely Slow` | Failed | 273,468 ms | Not reachable | Not reachable | Browser state poll timed out. |
| Filled Layers - Separate Colors | `Filled Layers - Separate Colors Insanely Slow` | Failed | 276,041 ms | Not reachable | Not reachable | Browser state poll timed out. |
| Layered - Detail | `Layered - Detail Very Slow` | Failed | 273,499 ms | Not reachable | Not reachable | Browser state poll timed out. |
| Layered - Poster | `Layered - Poster Slow Speed` | Failed | 260,200 ms | Not reachable | Not reachable | No usable output card within gate. |
| Layered - 8 Color | `Layered - 8 Color Slow Speed` | Failed | 263,146 ms | Not reachable | Not reachable | No usable output card within gate. |

Ad/tracking-prevention console warnings were present but do not explain the
conversion failure. The repeated symptom is the UI failing to replace the pending
state with a usable output before the 4-minute limit.

## Root-cause classification

- **A. Real UI path mismatch:** Confirmed. Diagnostics use direct/server paths
  and do not prove homepage browser completion.
- **B. Algorithm still underuses palette:** Not the first blocker reproduced in
  fresh browser. Direct diagnostics do use 28-30 colors, but visual quality is
  still not good enough for text/linework.
- **C. Output-size structural bloat:** Confirmed. Direct outputs are 24-28 MB
  and dominated by huge path data and high decimal precision.
- **D. Preset-specific conversion hang:** Confirmed broadly. Every requested
  IMG_8846 preset failed the 4-minute real-browser gate.
- **E. Test coverage gap:** Confirmed. Existing audits pass while real UI fails.
- **F. Stale browser/localStorage issue:** Not required to reproduce the
  browser blocker. The `10 of 10` row mismatch remains unconfirmed in this fresh
  profile because output never reaches settings.
- **G. Actual expected limitation:** Not acceptable as a product limitation.
  A normal 1500px card image should not hang the UI or generate 20-28 MB SVGs.

## Recommended next implementation order

1. **Make diagnostics fail on real homepage browser non-completion.**
   Add a focused browser UI smoke for `/` with IMG_8846 and Layered - Flat Color
   that requires: output completion within a product budget, Settings / Edit
   opens, Layer colors opens, Download SVG works, and browser state does not hit
   CDP/browser timeouts.

2. **Add an explicit SVG byte-size and structure budget for high-fidelity card
   fixtures.**
   Fail when Layered - Flat Color creates 20+ MB outputs for these normal card
   images. Track path-data length and numeric precision so the failure points at
   structure, not just bytes.

3. **Fix output structure without reducing useful color/detail.**
   Prefer export-safe path precision control, path simplification that preserves
   text/linework, and avoiding excessive path data. Do not solve this by cutting
   the preset back to 10 colors.

4. **Add a high-contrast detail preservation check.**
   Use source-vs-output render analysis focused on large black title text and
   linework so 28-30 colors cannot pass while important text becomes washed out.

5. **After completion/size is fixed, re-check the `10 of 10` row mismatch.**
   If it still appears, classify it as stale state, route-local mapping, or
   layer-row extraction mismatch and fix the test to reproduce it first.

## Tests that must be strengthened

- A real browser UI completion smoke for homepage high-fidelity card fixtures.
- A browser Settings / Edit and Layer colors assertion for card outputs.
- A browser download assertion with a byte-size budget.
- A diagnostic that compares real browser engine/rows/download against direct
  action/server results for the same fixture and preset.
- A structure audit that fails on excessive path `d` size and precision.
- A visual/detail guard that checks high-contrast title/linework preservation,
  not only grouped color count.

## Non-goals

- No production conversion code was changed in this audit.
- No route URLs, SEO, navigation, sitemap, monetization, affiliate logic,
  compression, presets, or settings UI were changed.
- This pass did not attempt a compression feature.
- This pass did not work on Printify.
- This pass did not claim success from copy/download parity, color count, or
  prior passing diagnostics.
