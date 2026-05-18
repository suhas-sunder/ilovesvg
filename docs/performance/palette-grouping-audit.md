# Palette Grouping Audit

Date: 2026-05-18

Branch: `palette-grouping-audit-may-15`

Diagnostic report: `tmp/palette-grouping-audit.json`

## 1. Executive Summary

The current Layer colors coverage is technically complete, but not product-correct for the homepage layered output. The homepage `Layered - Flat Color` result exposes every raw annotated SVG fill color as a row, so the current user-facing state is 225 editable rows for the screenshot fixture. That proves control coverage, but it turns tiny anti-aliasing and trace-fragment colors into first-class layer controls.

The first grouping implementation should not change conversion engine quality or preset output settings. It should add deterministic, preset-aware grouping for user-facing editable layer targets after the SVG is annotated, starting with `Layered - Flat Color`. The normal UI ceiling should be 30 editable groups, not the target. For the measured homepage output, the diagnostic suggests a first-pass grouped count of 18.

## 2. Current Behavior And Why 225 Rows Happen

Current measured coverage:

| Route | Preset | Raw visible SVG colors | Exposed rows | Remaining after hiding exposed rows | Paths | Suggested grouped rows |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/` | Layered - Flat Color | 225 | 225 | 0 | 4118 | 18 |
| `/png-to-layered-svg-for-cricut` | Layered - Flat Color | 16 | 16 | 0 | 249 | 7 |
| `/jpg-to-layered-svg-for-cricut` | Layered route equivalent | 5 | 5 | 0 | 6 | 4 |

The homepage reaches 225 rows because:

- `app/client/workers/vtracer.worker.ts` creates layered raster palettes, but VTracer can emit more final path fill colors than the requested palette count.
- `annotateSvgLayerIds` tags each distinct final path fill color with `data-fill-layer-id`.
- The coverage fix intentionally completes Layer colors from the final annotated SVG so no tagged output color is left uncontrollable.
- That completion path exposes raw final SVG colors, including anti-aliasing, near-black variants, tiny edge fragments, and trace noise.
- `extractEditableLayers` still has palette-cap logic for metadata extraction, but the UI completion path now appends all final annotated SVG targets.

The PNG and JPG layered routes are lower because their route-local builders reconstruct grouped layer SVGs from palette/pathTag metadata. They mostly expose grouped layer metadata instead of every raw final SVG fill fragment.

## 3. Fixture And Preset Matrix

The diagnostic used these fixtures:

| Fixture | Source | Purpose | Sampled unique colors | Suggested grouping risk |
| --- | --- | --- | ---: | --- |
| `screenshot-ui` | `C:\Users\Suhas\Downloads\Screenshot 2026-05-06 194041.png` | Current user-reported high-row fixture | 970 | Many tiny and edge colors |
| `transparent-tomato` | `C:\Users\Suhas\Downloads\charming-tomato-512x512.png` | Transparent sticker-style object | 1287 | Saturated colors need stricter mid-tone grouping |
| `simple-logo` | Generated in `tmp` | Clean logo/icon shape | 232 | Mostly edge colors around few major colors |
| `noisy-photo-like` | Generated in `tmp` | Photo/noise stress case | 89288 | Needs preset-specific pruning |

Preset projections are based on fixture pixel analysis plus source-inspected preset contracts. They are not converted-output measurements for every preset, and should be treated as planning evidence before implementation.

| Preset | Projected grouped count range across fixtures | Contract maximum | Notes |
| --- | ---: | ---: | --- |
| Layered - Flat Color | 20-25 | 30 | Measured homepage output suggests 18 for the current screenshot result |
| Layered - 8 Color | 10-12 | 12 | Needs secondary pruning for complex fixtures |
| Layered - Poster | 14-18 | 18 | Strong tonal grouping, but preserve poster steps |
| Layered - Detail | 26-30 | 30 | Should keep more tones, still collapse anti-aliasing |
| Layered - Low Noise | 3-8 | 12 | Very aggressive cleanup by intent |
| Layered - Cut Friendly | 3-6 | 8 | Few clean, weedable groups |
| Filled Layers - Separate Colors | 18-24 | 24 | Moderate grouping, keep separate filled regions meaningful |
| Photo Many Colors | 26-30 | 30 | Highest quality risk if over-grouped |

## 4. Raw Color Counts

The homepage output is the only measured route currently over-fragmenting the Layer colors UI:

- Requested palette count in the measured homepage output: 16.
- Actual palette count reported by the output metadata: 11.
- Raw visible SVG colors after VTracer output: 225.
- Layer color rows: 225.
- Remaining visible controllable colors after hiding exposed rows: 0.

This means the issue is not missing controls. The issue is that raw final SVG color fragments are being exposed as the product-facing layer model.

## 5. Near-Duplicate Cluster Findings

For the measured homepage SVG:

- 225 input colors collapsed into 16 near-duplicate clusters by the diagnostic heuristics.
- 223 of the 225 colors participate in near-duplicate clusters.
- 214 colors are tiny or noise candidates by path-use share.
- Only 2 colors are major by the current path-use heuristic.
- Suggested first-pass user-facing group count: 18.

Fixture analysis also shows the same pattern. The screenshot fixture contains hundreds of sampled colors, but most are tiny edge or UI-rendering variants. The transparent tomato and noisy-photo fixtures prove the grouping algorithm cannot use one global threshold: saturated artwork and photo-like inputs need stricter mid-tone rules than low-chroma near-black or near-white regions.

## 6. Near-Black And Near-White Findings

For the measured homepage SVG:

- Near-black colors: 105.
- Near-black clusters: 1.
- Near-white colors: 0 in the final SVG sample.
- Near-white clusters: 0 in the final SVG sample.

For fixture pixels:

- The screenshot fixture has 2 near-black clusters and 1 near-white cluster.
- The transparent tomato fixture has 1 near-black cluster and 1 near-white cluster.
- The simple logo fixture has 1 near-black cluster and 1 near-white cluster.
- The noisy photo-like fixture has no dominant near-black or near-white cluster, but has very high tiny-color fragmentation.

Near-black and near-white grouping can be more aggressive than saturated mid-tones, but should still use area, contrast, and chroma guards. A small bright highlight, eye catchlight, or dark outline can be visually important even if the area is small.

## 7. Suggested Grouped Palette Counts

Suggested counts are ceilings for the next user-facing editable layer model, not conversion palette counts:

| Scenario | Suggested grouped rows | Why |
| --- | ---: | --- |
| Homepage screenshot, Layered - Flat Color | 18 | Collapses raw fragments while preserving major light, dark, and accent groups |
| PNG layered screenshot route | 7 | Already grouped to 16 rows, but several rows are near-duplicates |
| JPG layered route | 4 | Already compact, low risk |
| Transparent sticker fixture, flat-color contract | 20-25 | Preserve saturated object colors and highlights |
| Simple logo fixture, flat-color contract | 20 or fewer | Most colors are edges around a few real colors |
| Photo-like fixture, photo contract | 26-30 | Fidelity-oriented preset should stay close to the ceiling |

The implementation should use fewer than 30 groups whenever the image supports it. Thirty is a guardrail for normal UI, not a target.

## 8. Preset Palette Contracts

| Preset | Intended outcome | Typical groups | Hard max | Grouping behavior | Quality risk |
| --- | --- | ---: | ---: | --- | --- |
| Layered - Flat Color | Clean flat editable color blocks | 8-20 | 30 | Strong grouping, collapse anti-aliasing, tiny edge colors, near-black, and near-white | Medium |
| Layered - 8 Color | Deliberately compact layered palette | 6-10 | 12 | Strong grouping, secondary pruning when needed | Low |
| Layered - Poster | Posterized tonal steps | 5-14 | 18 | Strong grouping, preserve intentional poster bands | Medium |
| Layered - Detail | Detailed layered color output | 16-28 | 30 | Moderate grouping, keep meaningful tones | Medium-high |
| Layered - Low Noise | Simple low-noise layers | 3-8 | 12 | Very strong grouping, collapse islands/noise aggressively | Low-medium |
| Layered - Cut Friendly | Few clean, weedable shapes | 2-6 | 8 | Very strong grouping, prioritize clean paths over tonal fidelity | Low for cut use, medium for art fidelity |
| Filled Layers - Separate Colors | Separate filled color regions | 8-18 | 24 | Moderate-strong grouping, preserve meaningful filled regions | Medium |
| Photo Many Colors | High-color photo-like output | 24-30 | 30 | Light grouping, only collapse clear noise and near-duplicates | High if over-grouped |

## 9. Recommended First Implementation Batch

Scope:

- Implement deterministic color grouping for `Layered - Flat Color` only.
- Cover homepage VTracer final annotated SVG first.
- Keep PNG and JPG layered routes in the test matrix to avoid regressions.
- Do not change preset counts, VTracer settings, Potrace settings, trace dimensions, or output quality.
- Do not remove full color controllability. Every original path must belong to exactly one user-facing editable group.

Likely files for the implementation pass:

- `app/client/workers/vtracer.worker.ts`
- `app/client/lib/converter/svgEditingModel.ts`
- `app/client/components/svg/LayerPaletteEditor.tsx`
- `app/utils/svgLayerTrace.server.ts`
- `scripts/settings-color-coverage-audit.mjs`
- `scripts/layer-color-correctness-smoke.mjs`
- `scripts/palette-grouping-audit.mjs`

Recommended strategy:

- Use Lab or CIEDE2000-like perceptual distance, not raw RGB alone.
- Use stricter thresholds for saturated mid-tones.
- Merge near-black variants more aggressively when luma and chroma are low.
- Merge near-white variants more aggressively unless tint or area is meaningful.
- Ignore transparent pixels and preserve existing alpha clipping.
- Weight groups by visual area first, then path count, contrast, saturation, and stable source order.
- Pick a weighted representative color, not the first color encountered.
- Generate deterministic group IDs from preset id, representative color, and sorted member layer IDs.
- Keep exact path ownership by data layer ID. Do not fall back to broad color selectors after grouping.
- Verify 30 and 31 rows so the future max-30 rule has a safety margin.

## 10. Tests Required Before Implementation

Required regression coverage:

- Homepage `Layered - Flat Color` reduces user-facing editable groups below 30 for the screenshot fixture.
- All original tagged paths are still assigned to one editable group.
- Hiding every exposed group leaves 0 controllable visible colors.
- Hiding one group only hides that group's paths.
- Recolor, opacity, reset, copy, and download remain scoped and parity-correct.
- PNG and JPG layered routes do not regress from current coverage.
- Transparent boundary smoke still passes.
- Sticker border smoke still passes.
- Cumulative edit performance passes at 30 and 31 groups.
- Visual rendered-output delta stays within an agreed tolerance for each preset contract.

## 11. Risks And Non-Goals

Risks:

- A single global color tolerance can destroy meaningful saturated details.
- Area-only grouping can drop small but important marks such as outlines, eyes, text, or highlights.
- Color-only selectors can recreate the old target-mapping bug. Grouping must preserve path ownership.
- Group IDs must be stable across copy/download and preview edits.
- Photo-oriented presets need less aggressive grouping than cut-friendly or flat-color presets.

Non-goals for this audit:

- No production grouping implementation.
- No preset changes.
- No conversion engine changes.
- No settings UI changes.
- No route URL, SEO, navigation, sitemap, monetization, sticker border, or affiliate changes.
- No raw SVG color list as the product answer.
