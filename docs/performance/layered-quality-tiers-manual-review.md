# Layered Insane Quality Manual Review

Date: 2026-05-24

## Executive summary

Revision-A replaces the duplicated family-specific High Quality presets with one opt-in highest-fidelity preset: `Layered - Insane Quality`.

The browser evidence supports user manual testing, not merge approval. Insane Quality completes through the real `/` browser UI, preserves dimensions, stays at or below 32 editable color groups, opens Settings/Edit and Layer colors, and preserves copy/download SVG parity. It is visibly better than Medium on the card fixtures where small text, linework, card borders, and holographic regions matter. The file-size increase is large but within the stated 10x input-size ceiling.

One visual/metric warning remains: `Photo Many Colors (Medium Quality)` on `IMG_9288.JPEG` triggered an edge-detail metric drop. It still completed and copied/downloaded correctly, but it needs user visual approval.

## Branch and commit reviewed

- Branch: `layered-quality-tiers-may-20`
- Starting commit for Revision-A: `c4f25a06667186a3e68c813567a37aed193de696`
- Baseline branch present locally/remotely: `high-fidelity-output-baseline-success-may-20`
- Local preview URL: `http://localhost:3000`
- App verified: `iLoveSVG | Free SVG Converter and Image to SVG Tools`
- Browser validation: clean local browser profile against the canonical `localhost:3000` preview

## Artifact folder

Artifact folder:

`D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\layered-insane-quality-revision-a\manual-qa`

Key generated artifacts:

- `manual-qa-report.json`
- `manual-qa-harness.err.log`
- `svgs/` with 53 downloaded SVG outputs
- `downloads/` with browser downloads
- `renders/` with source/SVG render comparisons
- `screenshots/` with browser output screenshots
- `contact-sheets/` with 15 side-by-side tier sheets
- `fixtures/generated-simple-logo.png`
- `fixtures/generated-low-color.png`

Representative contact sheets:

- `contact-sheets/IMG_8846-flat-tiers.png`
- `contact-sheets/IMG_9404-flat-tiers.png`
- `contact-sheets/IMG_9288-photo-tiers.png`
- `contact-sheets/IMG_9448-flat-tiers.png`
- `contact-sheets/generated_simple_logo-flat-tiers.png`
- `contact-sheets/generated_low_color-flat-tiers.png`

## Final preset labels and IDs

Kept existing defaults unchanged:

| Label | ID |
|---|---|
| Layered - Flat Color | `layered-flat-color` |
| Photo Many Colors | `photo-many-colors` |
| Layered - Detail | `layered-detail` |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` |
| Layered - 8 Color | `layered-8-color` |
| Layered - Poster | `layered-poster` |

Kept Medium variants:

| Label | ID | Reason kept |
|---|---|---|
| Layered - Flat Color (Medium Quality) | `layered-flat-color-medium-quality` | Clearly improves detail over Flat default on card fixtures. |
| Photo Many Colors (Medium Quality) | `photo-many-colors-medium-quality` | Distinct output from Photo default and Flat Medium; useful on several card fixtures, but see warning below. |
| Layered - Detail (Medium Quality) | `layered-detail-medium-quality` | Distinct 32-layer output from the 10-layer Detail default; sometimes smaller than Detail default. |

Added top tier:

| Label | ID | Contract |
|---|---|---|
| Layered - Insane Quality | `layered-insane-quality` | Opt-in highest-fidelity layered mode, up to 32 editable colors, preserves source dimensions, allows large SVGs when visual fidelity justifies them. |

Removed or consolidated variants:

| Removed label | Removed ID | Reason |
|---|---|---|
| Layered - Flat Color (High Quality) | `layered-flat-color-high-quality` | Replaced by the single shared `Layered - Insane Quality` top tier. |
| Photo Many Colors (High Quality) | `photo-many-colors-high-quality` | Removed because High outputs converged with the same top-tier SVG as other families. |
| Layered - Detail (High Quality) | `layered-detail-high-quality` | Removed because High outputs converged with the same top-tier SVG as other families. |
| Filled Layers - Separate Colors (High Quality) | `filled-layers-separate-colors-high-quality` | Removed because High outputs converged with the same top-tier SVG as other families. |
| Filled Layers - Separate Colors (Medium Quality) | `filled-layers-separate-colors-medium-quality` | Removed because prior evidence showed it duplicated Flat Medium output on the card fixtures. |

This final set avoids clutter by keeping one shared top tier instead of four family-specific High labels that produced identical high-end output.

## Metrics notes

Every row below was run through the real browser UI on `/`. Each row opened Settings/Edit, opened Layer colors, copied SVG, downloaded SVG, and copy/download hashes matched.

## IMG_8846 metrics

| Preset | ID | SVG bytes | Ratio | Groups | Paths | Segments | Time | Dims | ViewBox |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Layered - Flat Color | `layered-flat-color` | 1,445,871 | 1.26x | 32 | 590 | 67,620 | 79s | 2048x1536 | 1500x1125 |
| Layered - Flat Color (Medium Quality) | `layered-flat-color-medium-quality` | 2,420,837 | 2.11x | 32 | 940 | 113,062 | 92s | 2048x1536 | 1800x1350 |
| Layered - Insane Quality | `layered-insane-quality` | 3,790,686 | 3.30x | 32 | 1,488 | 179,392 | 106s | 2048x1536 | 2048x1536 |
| Photo Many Colors | `photo-many-colors` | 440,398 | 0.38x | 32 | 626 | 31,717 | 45s | 2048x1536 | 820x615 |
| Photo Many Colors (Medium Quality) | `photo-many-colors-medium-quality` | 1,671,869 | 1.45x | 32 | 760 | 78,756 | 80s | 2048x1536 | 1500x1125 |
| Layered - Detail | `layered-detail` | 2,399,582 | 2.09x | 10 | 10 | 194,774 | 67s | 2048x1536 | 1700x1275 |
| Layered - Detail (Medium Quality) | `layered-detail-medium-quality` | 2,502,461 | 2.18x | 32 | 882 | 116,030 | 99s | 2048x1536 | 1900x1425 |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | 1,969,351 | 1.71x | 10 | 10 | 159,764 | 65s | 2048x1536 | 1400x1050 |

## IMG_9404 metrics

| Preset | ID | SVG bytes | Ratio | Groups | Paths | Segments | Time | Dims | ViewBox |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Layered - Flat Color | `layered-flat-color` | 1,190,347 | 1.03x | 32 | 370 | 56,182 | 77s | 2048x1536 | 1500x1125 |
| Layered - Flat Color (Medium Quality) | `layered-flat-color-medium-quality` | 2,044,541 | 1.77x | 32 | 702 | 98,244 | 92s | 2048x1536 | 1800x1350 |
| Layered - Insane Quality | `layered-insane-quality` | 3,253,507 | 2.82x | 32 | 1,373 | 157,801 | 106s | 2048x1536 | 2048x1536 |
| Photo Many Colors | `photo-many-colors` | 609,354 | 0.53x | 32 | 1,016 | 42,650 | 53s | 2048x1536 | 820x615 |
| Photo Many Colors (Medium Quality) | `photo-many-colors-medium-quality` | 1,522,374 | 1.32x | 32 | 519 | 72,530 | 80s | 2048x1536 | 1500x1125 |
| Layered - Detail | `layered-detail` | 2,226,697 | 1.93x | 10 | 10 | 180,934 | 67s | 2048x1536 | 1700x1275 |
| Layered - Detail (Medium Quality) | `layered-detail-medium-quality` | 2,229,909 | 1.93x | 32 | 718 | 106,846 | 98s | 2048x1536 | 1900x1425 |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | 1,574,558 | 1.36x | 10 | 10 | 128,367 | 66s | 2048x1536 | 1400x1050 |

## IMG_9288 metrics

| Preset | ID | SVG bytes | Ratio | Groups | Paths | Segments | Time | Dims | ViewBox |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Layered - Flat Color | `layered-flat-color` | 1,186,508 | 0.99x | 32 | 353 | 54,010 | 80s | 2048x1536 | 1500x1125 |
| Layered - Flat Color (Medium Quality) | `layered-flat-color-medium-quality` | 1,987,035 | 1.66x | 32 | 655 | 91,528 | 94s | 2048x1536 | 1800x1350 |
| Layered - Insane Quality | `layered-insane-quality` | 3,076,524 | 2.57x | 32 | 1,256 | 144,089 | 110s | 2048x1536 | 2048x1536 |
| Photo Many Colors | `photo-many-colors` | 761,606 | 0.64x | 32 | 1,308 | 53,088 | 53s | 2048x1536 | 820x615 |
| Photo Many Colors (Medium Quality) | `photo-many-colors-medium-quality` | 1,226,886 | 1.03x | 32 | 494 | 59,337 | 82s | 2048x1536 | 1500x1125 |
| Layered - Detail | `layered-detail` | 2,575,114 | 2.15x | 10 | 10 | 206,086 | 69s | 2048x1536 | 1700x1275 |
| Layered - Detail (Medium Quality) | `layered-detail-medium-quality` | 2,076,556 | 1.74x | 32 | 669 | 94,902 | 100s | 2048x1536 | 1900x1425 |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | 1,852,300 | 1.55x | 10 | 10 | 148,953 | 67s | 2048x1536 | 1400x1050 |

## IMG_9448 metrics

| Preset | ID | SVG bytes | Ratio | Groups | Paths | Segments | Time | Dims | ViewBox |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Layered - Flat Color | `layered-flat-color` | 851,929 | 0.89x | 32 | 310 | 37,716 | 76s | 2048x1536 | 1500x1125 |
| Layered - Flat Color (Medium Quality) | `layered-flat-color-medium-quality` | 1,571,645 | 1.65x | 32 | 536 | 71,945 | 91s | 2048x1536 | 1800x1350 |
| Layered - Insane Quality | `layered-insane-quality` | 2,629,911 | 2.76x | 32 | 1,056 | 123,574 | 104s | 2048x1536 | 2048x1536 |
| Photo Many Colors | `photo-many-colors` | 453,886 | 0.48x | 32 | 739 | 31,880 | 51s | 2048x1536 | 820x615 |
| Photo Many Colors (Medium Quality) | `photo-many-colors-medium-quality` | 1,060,746 | 1.11x | 32 | 428 | 48,261 | 80s | 2048x1536 | 1500x1125 |
| Layered - Detail | `layered-detail` | 1,661,125 | 1.74x | 10 | 10 | 132,083 | 67s | 2048x1536 | 1700x1275 |
| Layered - Detail (Medium Quality) | `layered-detail-medium-quality` | 1,733,321 | 1.82x | 32 | 583 | 79,194 | 96s | 2048x1536 | 1900x1425 |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | 1,197,878 | 1.26x | 10 | 10 | 95,952 | 66s | 2048x1536 | 1400x1050 |

## Simple-image compactness results

| Fixture / preset | SVG bytes | Ratio | Groups | Paths | Segments | Time |
|---|---:|---:|---:|---:|---:|---:|
| Tomato / Layered - Flat Color | 15,266 | 0.20x | 7 | 16 | 2,168 | 24s |
| Tomato / Layered - Flat Color (Medium Quality) | 16,097 | 0.21x | 7 | 16 | 2,230 | 24s |
| Tomato / Layered - Insane Quality | 18,120 | 0.23x | 7 | 19 | 2,366 | 25s |
| Tomato / Photo Many Colors | 16,277 | 0.21x | 8 | 17 | 2,238 | 25s |
| Tomato / Layered - 8 Color | 16,081 | 0.21x | 6 | 17 | 2,226 | 23s |
| Tomato / Layered - Poster | 15,978 | 0.21x | 5 | 17 | 2,215 | 23s |
| Tomato / Filled Layers - Separate Colors | 15,876 | 0.21x | 7 | 16 | 2,209 | 23s |
| Generated logo / Layered - Flat Color | 5,661 | 0.40x | 4 | 13 | 519 | 23s |
| Generated logo / Layered - Flat Color (Medium Quality) | 5,737 | 0.40x | 4 | 13 | 524 | 23s |
| Generated logo / Layered - Insane Quality | 5,865 | 0.41x | 4 | 13 | 533 | 23s |
| Generated logo / Layered - 8 Color | 5,832 | 0.41x | 4 | 13 | 534 | 23s |
| Generated logo / Layered - Poster | 5,951 | 0.42x | 5 | 14 | 535 | 23s |
| Low-color / Layered - Flat Color | 3,322 | 0.36x | 5 | 5 | 197 | 23s |
| Low-color / Layered - Flat Color (Medium Quality) | 3,378 | 0.37x | 5 | 5 | 202 | 23s |
| Low-color / Layered - Insane Quality | 3,530 | 0.38x | 5 | 5 | 215 | 24s |
| Low-color / Layered - 8 Color | 3,350 | 0.36x | 5 | 5 | 200 | 24s |
| Low-color / Layered - Poster | 3,264 | 0.35x | 5 | 5 | 193 | 23s |

Simple-image compactness passed. Insane Quality did not force simple images into large 32-color output. Existing 8 Color and Poster outputs stayed compact.

## Visual comparison notes

Default vs Medium:

- Flat Medium improves visible card text, linework, borders, and card-region continuity over Flat default on all four card fixtures.
- Photo Medium is distinct and useful on fixtures like `IMG_8846` and `IMG_9404`, where Photo default is coarse and loses structure.
- Photo Medium is not universally better: `IMG_9288` triggered an edge/detail metric warning and should be inspected by the user before accepting that variant.
- Detail Medium is distinct from Detail default. It uses 32 editable layers rather than 10, and on `IMG_9288` it is smaller than Detail default while preserving more structured regions.

Medium vs Insane:

- Insane adds full 2048x1536 viewBox output, more paths, more segments, and visibly sharper fine detail than Medium.
- Insane is especially stronger for title text, small black linework, card borders, subject edges, and dense holographic regions.
- Insane is meaningfully better than Medium on the flat tier contact sheets for `IMG_8846`, `IMG_9404`, `IMG_9288`, and `IMG_9448`.
- The output is still not perfect OCR-quality text. It is a higher-fidelity editable vector approximation, not a raster fallback.

File-size justification:

- Insane file sizes ranged from 2,629,911 to 3,790,686 bytes on the card fixtures, or 2.57x to 3.30x input size.
- Those increases are visually justified for an opt-in highest-quality mode, but they should not become the default.
- Merge should still wait for user visual acceptance because the value judgement is qualitative.

## Regressions found

No functional default regression was found in this pass.

- Existing defaults remained selectable and retained distinct behavior.
- Default flat outputs for `IMG_8846` and `IMG_9404` matched the previously reported preserved browser evidence exactly.
- Dimensions were preserved for all browser output rows.
- No output exceeded 32 editable groups.
- Settings/Edit opened for every row.
- Layer colors opened for every row.
- Copy worked for every row.
- Download worked for every row.
- Copy/download SVG parity matched for every row.
- Simple images stayed compact.
- 8 Color and Poster guardrails stayed compact on tomato, generated-logo, and low-color fixtures.

Known warning:

- `IMG_9288 / Photo Many Colors (Medium Quality)` failed the harness edge/detail metric: source `0.0237`, output `0.0105`. It completed successfully, but this medium preset needs visual approval and may still need removal if the user does not find the tradeoff useful.

## Recommendation

- Ready for user manual testing: yes.
- Ready for merge: no.
- Needs revision before merge: not proven by functional checks, but user visual approval is still required, especially for Photo Medium and for whether Insane's file-size increase is acceptable.

The branch should not be merged until the user inspects the contact sheets and decides that Insane Quality is worth the larger SVG output.

## Remaining risks

- Insane Quality is intentionally slower and larger than default.
- `Photo Many Colors (Medium Quality)` has one edge-detail warning and may be removed later if visual review does not justify it.
- Browser timings are local-machine timings and may differ on other machines.
- This pass did not deploy, merge, or push main.
