# Layered Amazing Quality Fidelity Pass-E Review

Date: 2026-05-28

## Executive Summary

Pass-E keeps the additive quality-tier inventory intact and improves Amazing Quality only. Default, Medium, and High preset behavior are not intentionally changed in this pass.

Amazing Quality now keeps the stronger text, linework, glare-region, and fine-detail recovery from the prior pass, but reduces the black artifacts that were muddying the output. The server path now separates true source-backed dark overlays from broad neutral-dark base fills: real text/edges can still render dark, while low-saturation gray/table/background texture is lifted away from pure black.

This is ready for user manual testing. It is not ready for merge until the user visually confirms that the cleaner Amazing output is close enough to the source and that the remaining high-contrast detail is justified.

## Branch And Commit Reviewed

- Branch: `layered-quality-tiers-may-20`
- Starting commit for this pass: `b7af5848998097c3995b49b56646fb9fa6208f9c`
- Local preview URL: `http://localhost:3000`

## Artifact Paths

- Current primary fixture reports:
  - `tmp/amazing-pass-e-current-validation-img8846.json`
  - `tmp/amazing-pass-e-final-primary-img8846.json`
  - `tmp/amazing-pass-e-final-primary-img9404.json`
  - `tmp/amazing-pass-e-all-amazing-img8846-rerun.json`
  - `tmp/amazing-pass-e-all-amazing-img9404-rerun.json`
- Secondary fixture reports:
  - `tmp/amazing-pass-e-secondary-img9288-real.json`
  - `tmp/amazing-pass-e-secondary-img9448-real.json`
- Browser render/download artifacts:
  - `tmp/high-fidelity-browser-output-smoke/`

Generated reports, SVGs, and screenshots remain under `tmp/` and must not be committed.

## Final Preset Inventory

No presets were removed. No preset IDs were renamed. Legacy top-tier IDs still contain `insane-quality` for saved-selection compatibility, while user-facing labels say Amazing Quality.

| Family | Default | Medium | High | Amazing |
|---|---|---|---|---|
| Layered - Flat Color | `layered-flat-color` | `layered-flat-color-medium-quality` | `layered-flat-color-high-quality` | `layered-flat-color-insane-quality` / Layered - Flat Color (Amazing Quality) |
| Photo Many Colors | `photo-many-colors` | `photo-many-colors-medium-quality` | `photo-many-colors-high-quality` | `photo-many-colors-insane-quality` / Photo Many Colors (Amazing Quality) |
| Layered - Detail | `layered-detail` | `layered-detail-medium-quality` | `layered-detail-high-quality` | `layered-detail-insane-quality` / Layered - Detail (Amazing Quality) |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | `filled-layers-separate-colors-medium-quality` | `filled-layers-separate-colors-high-quality` | `filled-layers-separate-colors-insane-quality` / Filled Layers - Separate Colors (Amazing Quality) |
| Generic | - | - | - | `layered-insane-quality` / Layered - Amazing Quality |

## What Changed In Pass-E

- Amazing-only VTracer detail settings are more permissive for source-backed text, linework, and glare detail.
- Amazing-only source analysis now checks larger local neighborhoods and source evidence before adding dark/detail overlays.
- Broad neutral-dark base colors are lifted to dark gray for Amazing so gray/table/texture regions do not become pure black.
- Separate dark overlay colors are retained for source-backed linework, so title/body text can stay dark without globally darkening background texture.
- The high-fidelity browser smoke now uses source-paired near-black recall and source-paired unsupported black checks instead of rewarding global near-black pixel mass.
- Preset audit coverage now verifies Amazing source-constrained detail behavior, texture guards, chromatic dark guards, and high trace-side settings.

## Why This Is Not Preset Clutter

The inventory preserves the requested user-choice ladder: Default, Medium Quality, High Quality, and Amazing Quality. Family-specific presets remain visible and selectable, and the generic Amazing option remains available. The audit fails if required labels disappear, IDs are renamed, duplicate IDs appear, Amazing naming is missing, output exceeds 32 editable groups, or the source-constrained Amazing guards disappear.

## Continuation Validation

The current continuation reran `IMG_8846` against the latest server code for High, Flat Amazing, and generic Amazing. The browser smoke had zero failures, preserved copy/download parity, and stayed under the 32 editable-color ceiling.

| Preset | SVG bytes | Ratio | Groups | Segments | Time | High-contrast recall | Glare recall | Unsupported black |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color (High Quality) | 4,067,107 | 3.539x | 31 | 196,176 | 130s | 0.1443 | 0.3151 | 0.0108 |
| Layered - Flat Color (Amazing Quality) | 6,057,231 | 5.271x | 31 | 294,037 | 153s | 0.1577 | 0.3933 | 0.0114 |
| Layered - Amazing Quality | 5,934,778 | 5.165x | 31 | 290,030 | 156s | 0.1517 | 0.3970 | 0.0044 |

## IMG_8846 Amazing Family Metrics

| Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source dark recall | High-contrast recall | Near-black recall | Glare recall | Unsupported black |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color (Amazing Quality) | 5,437,255 | 4.732x | 31 | 4,224 | 274,123 | 56s | 0.0954 | 0.1543 | 0.0974 | 0.4028 | 0.0077 |
| Layered - Amazing Quality | 5,447,249 | 4.740x | 31 | 4,224 | 274,425 | 55s | 0.0932 | 0.1593 | 0.0937 | 0.4130 | 0.0077 |
| Photo Many Colors (Amazing Quality) | 5,457,087 | 4.749x | 31 | 4,224 | 274,787 | 54s | 0.0943 | 0.1618 | 0.0947 | 0.4102 | 0.0082 |
| Filled Layers - Separate Colors (Amazing Quality) | 5,448,390 | 4.741x | 31 | 4,224 | 274,469 | 54s | 0.0961 | 0.1568 | 0.0982 | 0.4071 | 0.0079 |
| Layered - Detail (Amazing Quality) | 5,447,249 | 4.740x | 31 | 4,224 | 274,425 | 54s | 0.0932 | 0.1593 | 0.0937 | 0.4130 | 0.0077 |

Flat High comparison for `IMG_8846`: 4,067,107 bytes, 3.539x, 31 groups, 2,084 paths, 196,176 segments, 49s.

Visual notes: Amazing preserves the stronger title/body text and fish linework, while the table/background and card border no longer receive the same pure-black base texture seen in the rejected output. The yellow border is cleaner. Remaining dark detail is concentrated in source-supported text, linework, and high-contrast card regions.

## IMG_9404 Amazing Family Metrics

| Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source dark recall | High-contrast recall | Near-black recall | Glare recall | Unsupported black |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color (Amazing Quality) | 5,392,499 | 4.672x | 32 | 4,143 | 261,916 | 55s | 0.1595 | 0.2242 | 0.0661 | 0.5872 | 0.0328 |
| Layered - Amazing Quality | 5,364,446 | 4.647x | 32 | 4,143 | 260,927 | 54s | 0.1551 | 0.2142 | 0.0591 | 0.5858 | 0.0318 |
| Photo Many Colors (Amazing Quality) | 5,358,104 | 4.642x | 32 | 4,143 | 260,755 | 53s | 0.1558 | 0.2145 | 0.0589 | 0.5827 | 0.0325 |
| Filled Layers - Separate Colors (Amazing Quality) | 5,371,024 | 4.653x | 32 | 4,143 | 261,140 | 53s | 0.1555 | 0.2156 | 0.0590 | 0.5827 | 0.0326 |
| Layered - Detail (Amazing Quality) | 5,364,446 | 4.647x | 32 | 4,143 | 260,927 | 53s | 0.1551 | 0.2142 | 0.0591 | 0.5858 | 0.0318 |

Flat High comparison for `IMG_9404`: 2,927,273 bytes, 2.536x, 31 groups, 1,686 paths, 149,106 segments, 48s.

Visual notes: Amazing keeps noticeably more Mewtwo subject and foil/card detail than High. Broad background texture is less black than the rejected output, but this fixture still has real high-contrast foil/detail regions that need user visual approval.

## IMG_9288 And IMG_9448 Secondary Checks

| Fixture | Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source dark recall | High-contrast recall | Unsupported black |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| IMG_9288.JPEG | Layered - Flat Color (High Quality) | 2,752,071 | 2.302x | 31 | 1,633 | 138,164 | 49s | 0.1503 | 0.2310 | 0.0153 |
| IMG_9288.JPEG | Layered - Flat Color (Amazing Quality) | 4,673,932 | 3.910x | 31 | 4,129 | 234,781 | 55s | 0.1461 | 0.2295 | 0.0106 |
| IMG_9288.JPEG | Layered - Amazing Quality | 4,679,170 | 3.914x | 31 | 4,129 | 234,940 | 54s | 0.1465 | 0.2304 | 0.0107 |
| IMG_9448.JPEG | Layered - Flat Color (High Quality) | 2,559,602 | 2.688x | 31 | 1,354 | 126,712 | 45s | 0.2682 | 0.2655 | 0.0251 |
| IMG_9448.JPEG | Layered - Flat Color (Amazing Quality) | 4,576,494 | 4.806x | 32 | 3,292 | 224,534 | 71s | 0.2897 | 0.3190 | 0.0262 |
| IMG_9448.JPEG | Layered - Amazing Quality | 4,609,944 | 4.842x | 32 | 3,292 | 225,589 | 51s | 0.2916 | 0.3240 | 0.0269 |

Secondary fixture result: no browser-smoke failures. Amazing remains under the 32 editable-color ceiling and under the 10x input-size allowance.

## Simple-Image Compactness

No new simple-image size regression was introduced in this pass. Existing adaptive/simple-image guardrails remain covered by `test:adaptive-palette-quality` and `test:preset-palette-rules-audit`; both passed in the continuation validation.

## Visual QA Notes

Default vs Medium:

- Default remains the compact/safe baseline and is not intentionally changed in this pass.
- Medium remains additive and is not retuned in Pass-E.

Medium vs High:

- High remains additive and is not retuned in Pass-E.

High vs Amazing:

- Amazing is much denser than High and remains the highest-fidelity option.
- Amazing is visually stronger on text, linework, subject detail, and glare/bright-region detail.
- The file-size increase is justified only if the user accepts the visual improvement. Metrics alone are not enough.

Black/artifact result:

- The rejected output added too much near-black texture to table, background, water/card art, and border-adjacent areas.
- Current Amazing output lifts base neutral-dark fills away from black and keeps dark overlays source-constrained.
- Remaining black should be from real source-supported text, outlines, card symbols, or high-contrast subject/detail regions.

## Regression Notes

- No presets were removed.
- No preset IDs were renamed.
- Existing Default presets are not intentionally changed.
- Route parity from `b7af5848998097c3995b49b56646fb9fa6208f9c` remains in place.
- Tested Amazing outputs preserve source dimensions.
- Tested Amazing outputs remain editable and do not exceed 32 editable groups.
- Browser smokes verified Settings/Edit, Layer colors, Copy SVG, and Download SVG on completed outputs.

## Recommendation

- Ready for user manual testing: yes.
- Ready for merge: no.
- Needs revision: only if user still sees unacceptable black artifacts or color mismatch in manual review.

## Remaining Risks

- Amazing is intentionally slow and large.
- `IMG_9404` contains real high-contrast foil texture, so visual approval is required to distinguish useful detail from remaining texture.
- Browser metrics cannot prove bottom-card text legibility by themselves; the user should inspect the rendered SVGs directly.
