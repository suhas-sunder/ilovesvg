# Color Region Fidelity Audit

Date: 2026-05-18

Branch: `color-region-fidelity-audit-may-15`

Diagnostic output: `tmp/color-region-fidelity-audit.json`

## 1. Executive Summary

Palette grouping fixed the raw row-count problem for Layered - Flat Color, but the current grouping is not spatially aware. It groups by global color similarity, CIEDE2000 thresholds, and path weight. It does not use connected components, bounding boxes, region adjacency, or foreground/background context while deciding which paths should share a representative color.

Result: the current Layered - Flat Color grouping is acceptable for compact simple sticker/logo-style output when the goal is editable color families, but it is risky for complex/card-like images. The diagnostic did not reproduce the exact user-reported fish, fin, silver, and water failure because that exact fixture was not available locally. It did reproduce the main failure risk: multiple representative colors controlled spatially distant regions, including foreground/background merge candidates, on the complex screenshot fixture.

The next implementation batch should stay scoped to Layered - Flat Color and add region-aware grouping guards before any broader preset work.

## 2. Fixtures Tested

| Fixture | Source | Role | Notes |
| --- | --- | --- | --- |
| `Screenshot 2026-05-06 194041.png` | `C:\Users\Suhas\Downloads` | Complex/card-like proxy | Used as the closest available complex fixture. |
| `screenshot-complex-png.jpg` | generated in `tmp/color-region-fidelity-fixtures` | JPG derivative | Used for the JPG layered route. |
| `charming-tomato-512x512.png` | `C:\Users\Suhas\Downloads` | Transparent object/sticker | Used for simple object behavior. |
| `IMG_8487.PNG` | `tests/fixtures` | Existing logo/sticker fixture | Used as a simple fixture with multiple color families. |
| `generated-simple-logo.png` | generated in `tmp/color-region-fidelity-fixtures` | Diagnostic fallback | Generated only under `tmp`, not committed. |

The exact trading-card/fish/Magikarp-style image was not found in Downloads or test fixtures by filename search for `fish`, `magikarp`, `card`, `trading`, `pokemon`, `tcg`, `silver`, or `water`. Exact fish-fin, small-fish, silver-region, and water-region claims cannot be verified from this run.

## 3. Routes And Presets Tested

Required Flat Color route checks completed for:

| Route | Preset | Fixture | Grouped colors | Exposed rows | Paths | SVG bytes | Risk |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `/` | Layered - Flat Color | screenshot PNG | 11 | 11 | 4,118 | 998,387 | High |
| `/png-to-layered-svg-for-cricut` | Layered - Flat Color | screenshot PNG | 7 | 7 | 479 | 190,138 | High |
| `/jpg-to-layered-svg-for-cricut` | Layered - Flat Color | screenshot JPG | 5 | 5 | 6 | 12,617 | Low |

Additional diagnostic scenarios:

| Route | Preset | Fixture | Colors | Rows | Paths | SVG bytes | Risk |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `/` | Photo Many Colors | screenshot PNG | 1,967 | 1,966 | 4,211 | 1,088,637 | Medium |
| `/` | Filled Layers - Separate Colors | screenshot PNG | 179 | 179 | 1,082 | 336,505 | Medium |
| `/png-to-layered-svg-for-cricut` | Layered - Detail | screenshot PNG | 5 | 5 | 5 | 2,198,819 | Low |
| `/jpg-to-layered-svg-for-cricut` | Layered - Detail | screenshot JPG | 5 | 5 | 6 | 12,617 | Low |
| `/` | Layered - Flat Color | tomato PNG | 7 | 7 | 16 | 24,770 | Medium |
| `/` | Layered - Flat Color | `IMG_8487.PNG` | 15 | 15 | 127 | 80,254 | High structural risk |

The `/` Layered - Detail scenario converted, but the diagnostic could not decode the very large preview SVG through CDP within the timeout. This is recorded as an optional harness failure in the JSON report, not a production failure.

## 4. Grouped Color Counts

The Layered - Flat Color implementation still meets the editable-palette goal:

- Homepage screenshot fixture: 11 visible SVG colors and 11 exposed layer rows.
- PNG layered screenshot fixture: 7 visible SVG colors and 7 exposed layer rows.
- JPG layered screenshot fixture: 5 visible SVG colors and 5 exposed layer rows.

Copy/download parity passed for the three required Flat Color route checks. The copied and downloaded SVG hashes matched the preview SVG in each required scenario.

## 5. Spatial Grouping Findings

Source inspection found:

- Grouping runs before `annotateSvgLayerIds`, so final grouped colors become the user-facing layer rows.
- The gate is scoped to layered trace, `layered-flat-color`, and `per-color-cutout`.
- The representative color is deterministic and selected from real source colors using weight, path count, first index, and color tie-breakers.
- Similarity uses CIEDE2000 and special near-black/near-white thresholds.
- Area/path weighting is approximated from path complexity.
- Path ownership remains editable after grouping through layer IDs.
- Grouping does not track connected components, bounding boxes, region adjacency, or foreground/background separation.

On the homepage complex screenshot fixture, six color groups spanned spatially distant regions and five looked like foreground/background merge candidates. The raster comparison still preserved the major color families, but this is exactly the kind of structure that can cause one representative color to control unrelated visual regions.

On the PNG layered route, six color groups spanned spatially distant regions, six looked like foreground/background merge candidates, four local grid cells had high raster color error, and five local cells changed dominant hue family.

On the JPG layered route, the output was much simpler: five colors, six paths, no spatially distant group flags, one local high-error cell, and major color families preserved.

## 6. Wrong-Region Risk Findings

The exact user-reported wrong-color case was not reproduced because the exact card/fish fixture was unavailable.

The risk is still real:

- A single group can contain paths from distant regions.
- A representative selected by global weight/path count can recolor smaller but meaningful regions.
- Near-black and near-white grouping is useful for anti-aliased noise, but without component guards it can merge unrelated outlines, shadows, and background details.
- Increasing or reducing color count alone will not fix wrong-region assignment if unrelated paths are already grouped under one representative color.

The diagnostic found high risk for the complex screenshot on `/` and `/png-to-layered-svg-for-cricut`, low risk for the JPG derivative, medium risk for the tomato, and high structural risk for the existing logo fixture. The simple fixtures preserved major color families, so the high structural flag should be read as a region-mixing warning, not proof of visible failure.

## 7. Complex/Card-Like Image Findings

Using the screenshot fixture as the closest available complex proxy:

- Main color families were preserved on the homepage Flat Color output.
- PNG layered Flat Color showed stronger local error than the homepage output.
- Blue/cyan, silver/gray, near-white, and near-black families remained present.
- Several colors controlled shapes across three or four canvas quadrants.
- The route can still produce compact editable output, but the compactness comes without spatial constraints.

Exact card-specific checkpoints:

- Main subject color preservation: not verifiable for the fish card without the fixture.
- Small object/detail color preservation: not verifiable for the fish card without the fixture.
- Background vs foreground separation: risk observed on the complex screenshot proxy.
- Dark outline preservation: near-black grouping remains compact, but not component-aware.
- Light/silver/gray preservation: family preserved in the proxy, but PNG route had local hue-family mismatches.
- Blue/water-like preservation: family preserved in the proxy, but global grouping can still mix blue regions spatially.
- Obvious wrong color family on the exact card: not verifiable without the exact image.

## 8. Simple Sticker/Logo Findings

The tomato fixture produced seven editable colors, preserved the red/near-white/near-black/yellow/orange families, had no local high-error cells, and had no missing major input families. One red group spanned distant paths, but that is expected for separated red object regions and did not show visible color-family loss.

The existing logo fixture produced 15 editable colors and preserved the major input families with low average color error. The diagnostic flagged structural spatial mixing, especially for near-white and near-black groups, but the visual color families stayed stable. This supports keeping Flat Color compact for simple stickers and logos while adding safeguards for complex/photo-like inputs.

## 9. Aggressiveness Assessment

Current Layered - Flat Color grouping is:

- Acceptable for simple sticker/logo-style images where compact editability matters.
- Good at preventing raw 160 to 225 row exposure.
- Too risky for complex/card-like images if users expect small foreground details and background regions to keep distinct local colors.
- Not fixable by only changing the final color ceiling. A 30-color ceiling does not guarantee region fidelity if grouping crosses spatial context.

## 10. Recommended Implementation Batch

Do not implement this in the audit pass.

Recommended next batch:

1. Keep the scope to Layered - Flat Color only.
2. Add connected-component or bounding-box awareness to grouping.
3. Prevent grouping across spatially separate regions when hue/context differs.
4. Keep near-black and near-white aggressive only inside compatible local regions or low-detail noise.
5. Preserve small high-contrast or high-saturation details even when their area is small.
6. Choose representative colors per component cluster, or choose the representative that minimizes local component error, not only global weight.
7. Allow complex images to use more groups up to the existing 30 ceiling when spatial complexity is high.
8. Keep simple sticker/logo images compact when the spatial-risk score is low.

Separate preset guidance:

- Layered - Flat Color should remain the compact editable preset.
- Complex images may need a Detail/Photo-oriented preset, but that is not enough if the Flat Color label promises usable layered color regions.
- Do not apply grouping changes to every preset without a route/preset contract.

## 11. Tests Required For Future Fixes

Future implementation should add or extend tests to verify:

- Group count remains below 30 for Flat Color when possible.
- Near-black variants collapse without merging unrelated foreground/background components.
- Near-white variants collapse without wiping tinted highlights.
- Small high-contrast details survive when they are visually meaningful.
- Components that are spatially far apart are not grouped solely because their colors are close.
- Representative colors are real source colors and deterministic.
- Hide/recolor/opacity/reset still work for every final group.
- Copy/download still match the edited preview.
- PNG/JPG layered routes keep color coverage and layer correctness.
- Transparent boundary and sticker border tests continue to pass.
- A complex/card-like fixture is added if the user can provide it, with manual-review checkpoints for subject, fin/detail, small objects, silver/gray areas, water/background areas, and dark outlines.

## 12. Non-Goals

- No production code changes in this audit.
- No conversion engine changes.
- No settings UI changes.
- No route URL, SEO, navigation, sitemap, monetization, preset, compression, or affiliate changes.
- No committed binary fixtures.
- No attempt to solve all presets in this pass.
