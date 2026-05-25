# Layered Quality Tier Fidelity Revision-B Review

Date: 2026-05-25

## Executive summary

Revision-B keeps the additive preset inventory intact and fixes the unacceptable browser failure seen on `Layered - Flat Color (Insane Quality)`. Medium, High, and Insane layered quality presets now bypass the browser VTracer worker and use the server layered trace path directly, so expensive quality tiers do not fail after a browser-worker timeout before server fallback.

The tier implementation was also strengthened with source-constrained dark/detail overlays. Dark detail is now gated by local source luminance, local contrast, component size, and source-supported edge evidence so black/text/detail is added where the original image supports it instead of globally spraying black texture into water, borders, and background regions.

Automated checks are green, including the real-browser high-fidelity output smoke and full preset smoke. The branch is ready for user manual testing. It is not merge-ready until the user visually approves that the larger High/Insane outputs are worth the file-size increase.

## Branch and commit reviewed

- Branch: `layered-quality-tiers-may-20`
- Base commit for this pass: `1dfc4c1775400762eefb6a837e868c68484680d5`
- Local preview URL: `http://localhost:3000`
- App verified: `iLoveSVG | Free SVG Converter and Image to SVG Tools`

## Artifact paths

- High-fidelity browser smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\high-fidelity-browser-output-smoke\report.json`
- Rendered comparison PNGs: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\high-fidelity-browser-output-smoke\renders`
- Downloaded SVGs: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\high-fidelity-browser-output-smoke\downloads`
- Preset palette rules audit: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\preset-palette-rules-audit.json`
- Adaptive palette smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\adaptive-palette-quality-smoke.json`
- Fish/card fidelity smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\fish-card-region-fidelity-smoke.json`
- Full preset smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\stage1-layered-quality-tier-fidelity-full-preset-smoke.json`

## Final preset labels and IDs

| Family | Default | Medium Quality | High Quality | Insane Quality |
|---|---|---|---|---|
| Layered - Flat Color | `layered-flat-color` | `layered-flat-color-medium-quality` | `layered-flat-color-high-quality` | `layered-flat-color-insane-quality` |
| Photo Many Colors | `photo-many-colors` | `photo-many-colors-medium-quality` | `photo-many-colors-high-quality` | `photo-many-colors-insane-quality` |
| Layered - Detail | `layered-detail` | `layered-detail-medium-quality` | `layered-detail-high-quality` | `layered-detail-insane-quality` |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | `filled-layers-separate-colors-medium-quality` | `filled-layers-separate-colors-high-quality` | `filled-layers-separate-colors-insane-quality` |

Generic option retained:

- `layered-insane-quality` / Layered - Insane Quality

## Kept, restored, added, removed

Kept:

- All existing default presets.
- All existing Medium Quality presets.
- All existing High Quality presets.
- All existing Insane Quality presets from Correction-B.
- Generic `layered-insane-quality`.

Removed or renamed in this pass: none.

Behavior changed:

- Additive layered quality-tier presets now route directly to the server trace path instead of trying the browser VTracer worker first.
- Medium/High/Insane quality-tier trace settings remain separate and are checked for progressive behavior.
- Source-constrained dark/detail overlay logic now prevents broad black-noise overlays in unsupported regions.

## Why this is not clutter

The inventory follows the requested hierarchy per family: Default, Medium Quality, High Quality, and Insane Quality. No family was collapsed into a shared label. The audit and browser smoke now fail if a tier disappears, IDs are renamed, outputs exceed 32 editable groups, copy/download parity breaks, or family-specific outputs silently collapse to identical SVG signatures.

## IMG_8846 browser metrics

| Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source-detail score |
|---|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color | 1,445,871 | 1.258x | 32 | 590 | 67,620 | 77s | 0.1229 |
| Layered - Flat Color (Medium Quality) | 2,468,835 | 2.148x | 31 | 940 | 114,707 | 45s | 0.1251 |
| Layered - Flat Color (High Quality) | 2,842,732 | 2.474x | 31 | 1,121 | 132,767 | 45s | 0.1269 |
| Layered - Flat Color (Insane Quality) | 4,066,587 | 3.539x | 31 | 2,084 | 196,162 | 47s | 0.1275 |
| Photo Many Colors | 440,398 | 0.383x | 32 | 626 | 31,717 | 36s | 0.0669 |
| Photo Many Colors (Medium Quality) | 2,279,505 | 1.984x | 31 | 880 | 105,248 | 41s | 0.1290 |
| Photo Many Colors (High Quality) | 2,895,219 | 2.519x | 31 | 1,121 | 134,501 | 46s | 0.1310 |
| Photo Many Colors (Insane Quality) | 4,168,233 | 3.627x | 31 | 2,084 | 199,486 | 47s | 0.1305 |
| Layered - Detail | 2,399,582 | 2.088x | 10 | 10 | 194,774 | 64s | 0.1145 |
| Layered - Detail (Medium Quality) | 2,521,968 | 2.195x | 31 | 940 | 116,455 | 46s | 0.1278 |
| Layered - Detail (High Quality) | 2,915,663 | 2.537x | 31 | 1,121 | 135,161 | 46s | 0.1308 |
| Layered - Detail (Insane Quality) | 4,181,228 | 3.639x | 31 | 2,084 | 199,942 | 48s | 0.1299 |
| Filled Layers - Separate Colors | 1,969,351 | 1.714x | 10 | 10 | 159,764 | 59s | 0.1138 |
| Filled Layers - Separate Colors (Medium Quality) | 2,481,416 | 2.159x | 31 | 940 | 115,127 | 46s | 0.1251 |
| Filled Layers - Separate Colors (High Quality) | 2,842,329 | 2.473x | 31 | 1,121 | 132,764 | 47s | 0.1269 |
| Filled Layers - Separate Colors (Insane Quality) | 4,088,218 | 3.558x | 31 | 2,084 | 196,875 | 48s | 0.1296 |
| Layered - Insane Quality | 4,181,228 | 3.639x | 31 | 2,084 | 199,942 | 48s | 0.1299 |

## IMG_9404 browser metrics

| Preset | SVG bytes | Ratio | Groups | Paths | Segments | Time | Source-detail score |
|---|---:|---:|---:|---:|---:|---:|---:|
| Layered - Flat Color | 1,190,347 | 1.031x | 32 | 370 | 56,182 | 95s | 0.1649 |
| Layered - Flat Color (Medium Quality) | 1,957,805 | 1.696x | 31 | 702 | 95,374 | 45s | 0.1145 |
| Layered - Flat Color (High Quality) | 2,165,238 | 1.876x | 31 | 826 | 106,529 | 45s | 0.1230 |
| Layered - Flat Color (Insane Quality) | 2,927,273 | 2.536x | 31 | 1,686 | 149,106 | 47s | 0.1384 |
| Photo Many Colors | 609,354 | 0.528x | 32 | 1,016 | 42,650 | 43s | 0.1039 |
| Photo Many Colors (Medium Quality) | 1,744,019 | 1.511x | 31 | 621 | 84,770 | 41s | 0.1067 |
| Photo Many Colors (High Quality) | 2,167,257 | 1.877x | 31 | 826 | 106,591 | 46s | 0.1411 |
| Photo Many Colors (Insane Quality) | 2,937,250 | 2.545x | 31 | 1,686 | 149,410 | 47s | 0.1449 |
| Layered - Detail | 2,226,697 | 1.929x | 10 | 10 | 180,934 | 66s | 0.1340 |
| Layered - Detail (Medium Quality) | 1,958,841 | 1.697x | 31 | 702 | 95,415 | 46s | 0.1017 |
| Layered - Detail (High Quality) | 2,173,937 | 1.883x | 31 | 826 | 106,796 | 46s | 0.1409 |
| Layered - Detail (Insane Quality) | 2,955,579 | 2.560x | 31 | 1,686 | 149,983 | 48s | 0.1448 |
| Filled Layers - Separate Colors | 1,574,558 | 1.364x | 10 | 10 | 128,367 | 60s | 0.1396 |
| Filled Layers - Separate Colors (Medium Quality) | 1,957,777 | 1.696x | 31 | 702 | 95,373 | 46s | 0.1145 |
| Filled Layers - Separate Colors (High Quality) | 2,165,056 | 1.876x | 31 | 826 | 106,529 | 46s | 0.1231 |
| Filled Layers - Separate Colors (Insane Quality) | 2,929,337 | 2.538x | 31 | 1,686 | 149,176 | 48s | 0.1368 |
| Layered - Insane Quality | 2,955,579 | 2.560x | 31 | 1,686 | 149,983 | 48s | 0.1448 |

## IMG_9288 and IMG_9448 compactness checks

The fish/card region fidelity smoke verifies default compact VTracer behavior on the additional card fixtures:

| Fixture | Engine path | SVG bytes | Groups | Paths | Result |
|---|---|---:|---:|---:|---|
| IMG_9288.JPEG | compact VTracer layered path | 1,186,508 | 32 | 353 | pass |
| IMG_9448.JPEG | compact VTracer layered path | 851,929 | 32 | 310 | pass |

## Simple-image compactness results

Simple inputs remain compact and do not jump to the 32-color high-detail path unnecessarily:

| Fixture | Engine path | SVG bytes | Groups | Paths | Result |
|---|---|---:|---:|---:|---|
| charming-tomato-512x512.png | server Potrace layered path | 27,912 | 17 | 17 | pass |
| generated-simple-logo.png | server Potrace layered path | 2,180 | 5 | 6 | pass |
| generated-low-color.png | server Potrace layered path | 1,928 | 5 | 6 | pass |

## Visual comparison notes

Default vs Medium:

- Medium generally reduces broad dark-noise artifacts from noisy defaults and produces more controlled editable layers.
- On IMG_9404 Photo Many Colors, Medium removes a large amount of unsupported dark detail compared with Default while preserving cleaner subject and card regions.
- Some default presets still score highly on raw dark recall because they are noisy; the updated guardrails distinguish source-supported detail from wrong-region dark.

Medium vs High:

- High generally increases source-supported text/linework metrics, path count, and segments over Medium.
- On IMG_8846 Photo Many Colors, High increases source-supported recall, high-contrast recall, near-black linework, and edge detail over Medium while remaining within 32 editable groups.
- On IMG_9404, High is materially stronger than Medium for Photo Many Colors and Layered - Detail.

High vs Insane:

- Insane produces the largest and most detailed SVGs, with more paths and segments and stronger fine-edge preservation.
- Insane is not justified by file size alone. The real visual question remains whether its extra fine detail is useful enough for the user's actual card output.
- In some families, the composite score is close to High even though Insane adds more fine edges and path detail. This is acceptable for manual testing, but not enough to call the branch merge-ready without visual approval.

## Source-constrained detail result

Dark/detail overlays now require local source evidence. A pixel must be dark or locally high-contrast in the source, and overlay masks are filtered by component size and total share. This prevents a global black-noise layer while preserving title text, symbols, outlines, and card linework where the source supports it.

For IMG_8846, Insane/High improve title/body/detail preservation through more paths and fine edges while keeping unsupported dark detail low. For IMG_9404, Insane improves Mewtwo/title/linework detail over High in the Photo and Detail families without exceeding the wrong-region dark guardrails.

## Regression notes

- Default preset IDs and labels are preserved.
- Medium, High, and Insane presets remain additive.
- No preset IDs were renamed.
- No output exceeded 32 editable color groups.
- Settings/Edit, Layer colors, Copy SVG, and Download SVG passed in the browser smoke.
- Copy/download parity passed for browser-smoke outputs.
- Existing 8 Color and Poster guardrails remained intact through the preset palette audit.
- Simple images stayed compact.

## Recommendation

- Ready for user manual testing: yes.
- Ready for merge: no.
- Needs revision: no automated blocker remains, but merge should wait for user visual approval of the High and Insane artifacts.

## Remaining risks

- High and Insane are intentionally larger and slower.
- Some outputs improve by adding fine detail rather than a large composite-score jump; visual approval is still the deciding gate.
- The generic `Layered - Insane Quality` remains alongside family-specific Insane presets as requested.
