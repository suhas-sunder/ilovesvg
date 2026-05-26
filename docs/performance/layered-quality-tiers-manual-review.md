# Layered Quality Tier Strengthening-D Review

Date: 2026-05-25

## Executive Summary

Strengthening-D keeps the existing default presets unchanged, keeps all additive Medium and High presets, and replaces user-facing Insane wording with Amazing Quality. The legacy top-tier preset IDs still contain `insane-quality` so saved selections and existing routing are not broken, but the visible labels now say Amazing Quality.

The tier ladder is now shifted upward: Medium uses the previous High settings, High uses the previous Insane settings, and Amazing is the new strongest top tier. Amazing routes through the server layered trace path, allows denser vector output, keeps the 32 editable-color ceiling, preserves source dimensions, and uses source-constrained dark/detail masks so black is only added where the source supports dark or high-contrast detail.

Browser evidence is improved, but this is still not merge-ready without user visual approval. Amazing is materially larger and denser than High, and it improves source-supported dark/text recall on the tested cards, but visual review must confirm the added detail is worth the file-size increase.

## Branch And Commit Reviewed

- Branch: `layered-quality-tiers-may-20`
- Starting commit for this pass: `5b43596cab039ac398c812de28c7ce8785487ec1`
- Local preview URL: `http://localhost:3000`
- App verified: `iLoveSVG | Free SVG Converter and Image to SVG Tools`

## Artifact Paths

- Stable manual-review folder: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\layered-quality-tier-strengthening-d`
- `IMG_8846` full tier report: `tmp/layered-quality-tier-strengthening-d/img8846-full-tier-report.json`
- `IMG_9404` full tier report: `tmp/layered-quality-tier-strengthening-d/img9404-full-tier-report.json`
- `IMG_9288` Amazing sweep: `tmp/layered-quality-tier-strengthening-d/img9288-amazing-report.json`
- `IMG_9448` Amazing sweep: `tmp/layered-quality-tier-strengthening-d/img9448-amazing-report.json`
- Adaptive/simple-image report: `tmp/adaptive-palette-quality-smoke.json`
- Fish/card region report: `tmp/fish-card-region-fidelity-smoke.json`
- Generated reports and downloaded SVG artifacts remain under `tmp/` and must not be committed.

## Final Preset Labels And IDs

| Family | Default | Medium | High | Amazing |
|---|---|---|---|---|
| Layered - Flat Color | `layered-flat-color` | `layered-flat-color-medium-quality` | `layered-flat-color-high-quality` | `layered-flat-color-insane-quality` / Layered - Flat Color (Amazing Quality) |
| Photo Many Colors | `photo-many-colors` | `photo-many-colors-medium-quality` | `photo-many-colors-high-quality` | `photo-many-colors-insane-quality` / Photo Many Colors (Amazing Quality) |
| Layered - Detail | `layered-detail` | `layered-detail-medium-quality` | `layered-detail-high-quality` | `layered-detail-insane-quality` / Layered - Detail (Amazing Quality) |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | `filled-layers-separate-colors-medium-quality` | `filled-layers-separate-colors-high-quality` | `filled-layers-separate-colors-insane-quality` / Filled Layers - Separate Colors (Amazing Quality) |

Generic option retained:

- `layered-insane-quality` / Layered - Amazing Quality

No presets were removed. No existing preset IDs were renamed. The `insane` ID strings are legacy compatibility IDs; the user-facing tier name is Amazing Quality.

## Tier Changes

- Default: unchanged.
- Medium: shifted to the previous High behavior.
- High: shifted to the previous Insane behavior.
- Amazing: new strongest top-tier behavior with denser traces, less destructive cleanup, and source-constrained dark/detail overlays.

## Why This Is Not Clutter

The final inventory preserves the requested choice hierarchy: Default, Medium Quality, High Quality, Amazing Quality. Separate families are not collapsed into one shared preset, and the generic Amazing option remains available. Audit coverage fails if required labels disappear, IDs are renamed, duplicate IDs appear, 32 editable groups are exceeded, or family-specific tier outputs silently collapse.

## IMG_8846 Browser Metrics

| Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source dark recall | Unsupported dark |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color | 1,445,871 | 1.258x | 32 | 590 | 67,620 | 81s | 0.0849 | 0.0083 |
| Layered - Flat Color (Medium Quality) | 2,842,168 | 2.473x | 31 | 1,121 | 132,739 | 51s | 0.0949 | 0.0109 |
| Layered - Flat Color (High Quality) | 4,067,107 | 3.539x | 31 | 2,084 | 196,176 | 53s | 0.0983 | 0.0129 |
| Layered - Flat Color (Amazing Quality) | 5,373,352 | 4.676x | 31 | 2,635 | 253,037 | 60s | 0.1068 | 0.0180 |
| Photo Many Colors | 440,398 | 0.383x | 32 | 626 | 31,717 | 46s | 0.2286 | 0.0491 |
| Photo Many Colors (Medium Quality) | 2,895,066 | 2.519x | 31 | 1,121 | 134,491 | 51s | 0.1001 | 0.0119 |
| Photo Many Colors (High Quality) | 4,169,975 | 3.629x | 31 | 2,084 | 199,538 | 52s | 0.1029 | 0.0146 |
| Photo Many Colors (Amazing Quality) | 5,433,925 | 4.729x | 31 | 2,635 | 254,979 | 60s | 0.1082 | 0.0188 |
| Layered - Detail | 2,399,582 | 2.088x | 10 | 10 | 194,774 | 69s | 0.0843 | 0.0082 |
| Layered - Detail (Medium Quality) | 2,915,594 | 2.537x | 31 | 1,121 | 135,155 | 51s | 0.1003 | 0.0120 |
| Layered - Detail (High Quality) | 4,182,304 | 3.640x | 31 | 2,084 | 199,969 | 52s | 0.1026 | 0.0144 |
| Layered - Detail (Amazing Quality) | 5,515,088 | 4.799x | 31 | 2,635 | 257,446 | 60s | 0.1083 | 0.0189 |
| Filled Layers - Separate Colors | 1,969,351 | 1.714x | 10 | 10 | 159,764 | 68s | 0.0857 | 0.0092 |
| Filled Layers - Separate Colors (Medium Quality) | 2,841,765 | 2.473x | 31 | 1,121 | 132,736 | 51s | 0.0949 | 0.0109 |
| Filled Layers - Separate Colors (High Quality) | 4,088,571 | 3.558x | 31 | 2,084 | 196,884 | 53s | 0.1001 | 0.0134 |
| Filled Layers - Separate Colors (Amazing Quality) | 5,349,609 | 4.655x | 31 | 2,635 | 252,280 | 60s | 0.1060 | 0.0176 |
| Layered - Amazing Quality | 5,515,088 | 4.799x | 31 | 2,635 | 257,446 | 60s | 0.1083 | 0.0189 |

## IMG_9404 Browser Metrics

| Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source dark recall | Unsupported dark |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color | 1,190,347 | 1.031x | 32 | 370 | 56,182 | 81s | 0.1418 | 0.0356 |
| Layered - Flat Color (Medium Quality) | 2,165,238 | 1.876x | 31 | 826 | 106,529 | 49s | 0.1243 | 0.0309 |
| Layered - Flat Color (High Quality) | 2,927,273 | 2.536x | 31 | 1,686 | 149,106 | 50s | 0.1253 | 0.0329 |
| Layered - Flat Color (Amazing Quality) | 3,758,839 | 3.256x | 31 | 2,372 | 190,054 | 57s | 0.1287 | 0.0351 |
| Photo Many Colors | 609,354 | 0.528x | 32 | 1,016 | 42,650 | 52s | 0.2129 | 0.0588 |
| Photo Many Colors (Medium Quality) | 2,167,257 | 1.877x | 31 | 826 | 106,591 | 49s | 0.1414 | 0.0333 |
| Photo Many Colors (High Quality) | 2,937,250 | 2.545x | 31 | 1,686 | 149,410 | 51s | 0.1245 | 0.0311 |
| Photo Many Colors (Amazing Quality) | 3,797,707 | 3.290x | 31 | 2,372 | 191,403 | 57s | 0.1294 | 0.0353 |
| Layered - Detail | 2,226,697 | 1.929x | 10 | 10 | 180,934 | 69s | 0.1130 | 0.0293 |
| Layered - Detail (Medium Quality) | 2,173,937 | 1.883x | 31 | 826 | 106,796 | 50s | 0.1415 | 0.0334 |
| Layered - Detail (High Quality) | 2,955,579 | 2.560x | 31 | 1,686 | 149,983 | 51s | 0.1261 | 0.0321 |
| Layered - Detail (Amazing Quality) | 3,909,704 | 3.387x | 31 | 2,372 | 195,043 | 58s | 0.1303 | 0.0356 |
| Filled Layers - Separate Colors | 1,574,558 | 1.364x | 10 | 10 | 128,367 | 68s | 0.1188 | 0.0295 |
| Filled Layers - Separate Colors (Medium Quality) | 2,165,056 | 1.876x | 31 | 826 | 106,529 | 50s | 0.1244 | 0.0309 |
| Filled Layers - Separate Colors (High Quality) | 2,929,337 | 2.538x | 31 | 1,686 | 149,176 | 52s | 0.1240 | 0.0344 |
| Filled Layers - Separate Colors (Amazing Quality) | 3,758,839 | 3.256x | 31 | 2,372 | 190,054 | 58s | 0.1387 | 0.0375 |
| Layered - Amazing Quality | 3,909,704 | 3.387x | 31 | 2,372 | 195,043 | 59s | 0.1303 | 0.0356 |

## IMG_9288 And IMG_9448 Amazing Sweeps

| Fixture | Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source dark recall | Unsupported dark |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| IMG_9288.JPEG | Layered - Flat Color (Amazing Quality) | 3,653,333 | 3.056x | 31 | 2,353 | 182,339 | 59s | 0.1546 | 0.0235 |
| IMG_9288.JPEG | Layered - Amazing Quality | 3,792,596 | 3.173x | 31 | 2,353 | 186,836 | 58s | 0.1569 | 0.0239 |
| IMG_9288.JPEG | Photo Many Colors (Amazing Quality) | 3,690,088 | 3.087x | 31 | 2,353 | 183,558 | 58s | 0.1555 | 0.0237 |
| IMG_9288.JPEG | Filled Layers - Separate Colors (Amazing Quality) | 3,653,333 | 3.056x | 31 | 2,353 | 182,339 | 58s | 0.1507 | 0.0229 |
| IMG_9288.JPEG | Layered - Detail (Amazing Quality) | 3,792,596 | 3.173x | 31 | 2,353 | 186,836 | 59s | 0.1569 | 0.0239 |
| IMG_9448.JPEG | Layered - Flat Color (Amazing Quality) | 4,170,657 | 4.380x | 31 | 1,969 | 192,531 | 60s | 0.2957 | 0.0365 |
| IMG_9448.JPEG | Layered - Amazing Quality | 4,259,907 | 4.474x | 31 | 1,969 | 195,493 | 95s | 0.2981 | 0.0369 |
| IMG_9448.JPEG | Photo Many Colors (Amazing Quality) | 4,200,482 | 4.412x | 31 | 1,969 | 193,539 | 56s | 0.2975 | 0.0368 |
| IMG_9448.JPEG | Filled Layers - Separate Colors (Amazing Quality) | 4,165,434 | 4.375x | 31 | 1,969 | 192,346 | 78s | 0.2969 | 0.0358 |
| IMG_9448.JPEG | Layered - Detail (Amazing Quality) | 4,259,907 | 4.474x | 31 | 1,969 | 195,493 | 72s | 0.2981 | 0.0369 |

## Simple-Image Compactness Results

Simple fixtures remain compact and do not jump to huge 32-color outputs unnecessarily:

| Fixture | Engine path | SVG bytes | Groups | Paths | Result |
|---|---|---:|---:|---:|---|
| charming-tomato-512x512.png | server Potrace layered path | 27,912 | 17 | 17 | pass |
| generated-simple-logo.png | server Potrace layered path | 2,180 | 5 | 6 | pass |
| generated-low-color.png | server Potrace layered path | 1,928 | 5 | 6 | pass |

## Visual Comparison Notes

Default vs Medium:

- Default behavior is preserved and remains compact/safe.
- Medium now uses the prior High settings. On `IMG_8846`, all four family Medium variants increase path count and source-dark recall over their corresponding defaults.
- On `IMG_9404`, some defaults have higher raw dark recall because they include more unsupported dark regions. The updated guardrails treat a tier as better only when it preserves source-supported evidence or materially reduces wrong-region dark noise.

Medium vs High:

- High now uses the prior Insane settings and produces denser output than Medium.
- On `IMG_8846`, High roughly doubles path count over Medium in the family-specific quality tiers.
- On `IMG_9404`, High increases path density and file size over Medium, with the strongest visible review still required around subject linework versus texture noise.

High vs Amazing:

- Amazing is the new top tier and is consistently denser than High: `IMG_8846` Flat rises from 2,084 paths to 2,635 paths, and `IMG_9404` Flat rises from 1,686 paths to 2,372 paths.
- Amazing improves source-supported dark recall over High in the tested family-specific outputs while staying under 32 editable groups and under the 10x input-size allowance.
- Amazing is not declared merge-ready from metrics alone. The user should visually confirm whether the extra detail makes title text, HP text, card body text, fish/subject linework, and subject details sufficiently better.

## Source-Constrained Detail Result

Dark/detail overlays now require source evidence before black is added. The server path checks local luminance, local contrast, local edge response, component size/share, and saturated-region guards before tracing dark or edge masks. This prevents the dark/detail layer from becoming a global black-noise overlay.

For `IMG_8846`, Amazing increases supported dark recall while keeping unsupported dark well below the tested guardrail. The specific visual review target remains the title text, HP/top-right text, body text, fish outline, and yellow border cleanliness.

For `IMG_9404`, Amazing increases fine-detail density and supported recall over High in the tested families. The specific visual review target remains Mewtwo text/face/linework and avoiding dark texture spray in weak-detail background/foil regions.

## Regression Notes

- No presets were removed.
- Default preset IDs, labels, and tier mapping are preserved.
- Medium and High remain additive.
- Amazing labels replaced the old user-facing Insane wording.
- Existing top-tier IDs were retained for compatibility.
- Output dimensions were preserved in browser smoke.
- No browser-smoke output exceeded 32 editable groups.
- Settings/Edit, Layer colors, Copy SVG, and Download SVG passed in the completed browser reports.
- Existing 8 Color and Poster guardrails remain covered by the preset palette audit.
- Simple images stayed compact.

## Recommendation

- Ready for user manual testing: yes.
- Ready for merge: no.
- Needs revision: no automated blocker remains from the completed smokes, but merge should wait for user visual approval that Amazing is clearly worth its larger output.

## Remaining Risks

- Amazing is intentionally slower and larger.
- Full two-fixture high-fidelity smoke can exceed a 20-minute outer shell timeout, so standalone preserved fixture reports were generated for `IMG_8846` and `IMG_9404`.
- Metrics cannot prove text readability by themselves; the manual decision should be based on rendered SVG visual comparison.
