# Layered Quality Tiers Manual Review

Date: 2026-05-23

## Executive summary

Layered Quality Tiers Gate-A is ready for user manual testing, but not ready for merge from this evidence alone. The new opt-in Medium and High presets are visible in the browser UI, convert through the real `/` upload flow, open Settings/Edit, open Layer colors, copy SVG, and download SVG successfully.

Medium and High generally improve card detail, border continuity, color richness, and small linework compared with Default on the photo-card fixtures. High is visibly sharper than Medium in several card regions, but its improvement is often incremental relative to the file-size increase. High also converges to the same output byte size across multiple preset families for each card fixture, which should be reviewed visually before merge.

No production code was changed during this review. Artifacts were generated under `tmp/` and are intentionally not committed.

## Branch and commit reviewed

- Branch: `layered-quality-tiers-may-20`
- Commit: `76254e07c354e62b531f0b2b4582a2e2838a9c33`
- Local preview URL: `http://localhost:3000`
- App verified: `iLoveSVG | Free SVG Converter and Image to SVG Tools`
- Canonical listener verified: port `3000`, process `82132`
- Baseline branch available locally/remotely: `high-fidelity-output-baseline-success-may-20`

## Artifact folder

Artifact folder:

`D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\layered-quality-tiers-manual-review`

Key generated files and folders:

- `manual-qa-report.json`
- `browser-output-screenshot-report.json`
- `manual-qa-harness.err.log`
- `screenshots/`
- `browser-output-screenshots/`
- `svgs/`
- `downloads/`
- `renders/`
- `contact-sheets/`
- `fixtures/generated-simple-logo.png`
- `fixtures/generated-low-color.png`

The browser UI harness produced 69 SVG downloads, 69 rendered SVG comparison images, 19 side-by-side tier contact sheets, and 28 converter-page screenshots. A supplemental browser-render pass then generated `browser-output-screenshots/` with 69 output screenshots from the downloaded SVGs, one per fixture/preset run.

Representative contact sheets:

- `contact-sheets/IMG_8846-flat-tiers.png`
- `contact-sheets/IMG_8846-photo-tiers.png`
- `contact-sheets/IMG_8846-detail-tiers.png`
- `contact-sheets/IMG_9404-flat-tiers.png`
- `contact-sheets/IMG_9288-detail-tiers.png`
- `contact-sheets/IMG_9448-flat-tiers.png`
- `contact-sheets/generated_simple_logo-flat-tiers.png`
- `contact-sheets/generated_low_color-flat-tiers.png`

## New presets verified

- `Layered - Flat Color (Medium Quality)`
- `Layered - Flat Color (High Quality)`
- `Photo Many Colors (Medium Quality)`
- `Photo Many Colors (High Quality)`
- `Layered - Detail (Medium Quality)`
- `Layered - Detail (High Quality)`
- `Filled Layers - Separate Colors (Medium Quality)`
- `Filled Layers - Separate Colors (High Quality)`

## Existing presets intentionally unchanged

- `Layered - Flat Color`
- `Photo Many Colors`
- `Layered - Detail`
- `Filled Layers - Separate Colors`
- `Layered - 8 Color`
- `Layered - Poster`
- Other existing layered presets

The default preset labels remained selectable separately from the new opt-in tiers. The branch diff against `high-fidelity-output-baseline-success-may-20` shows the new Medium/High preset entries; the existing preset labels above were not renamed during this review. Browser default outputs for the reported IMG_8846 and IMG_9404 flat-color cases also matched the reported preserved evidence exactly.

## Metrics notes

`Layers/groups` means browser Layer colors entries / SVG `<g>` count. `UI checks` means Settings/Edit opened, Layer colors opened, Copy worked, and Download worked. Copy and Download SVG hashes matched for every row.

## IMG_8846 metrics

| Preset | Input bytes | SVG bytes | Ratio | SVG dims | ViewBox | Layers/groups | Time | Engine | UI checks |
|---|---:|---:|---:|---|---|---:|---:|---|---|
| Layered - Flat Color | 1,149,142 | 1,445,871 | 1.26x | 2048x1536 | 1500x1125 | 32/32 | 79s | vtracer | pass |
| Layered - Flat Color (Medium Quality) | 1,149,142 | 2,420,837 | 2.11x | 2048x1536 | 1800x1350 | 32/32 | 97s | vtracer | pass |
| Layered - Flat Color (High Quality) | 1,149,142 | 3,790,686 | 3.30x | 2048x1536 | 2048x1536 | 32/32 | 135s | vtracer | pass |
| Photo Many Colors | 1,149,142 | 440,398 | 0.38x | 2048x1536 | 820x615 | 32/0 | 44s | vtracer | pass |
| Photo Many Colors (Medium Quality) | 1,149,142 | 1,671,869 | 1.45x | 2048x1536 | 1500x1125 | 32/32 | 81s | vtracer | pass |
| Photo Many Colors (High Quality) | 1,149,142 | 3,790,686 | 3.30x | 2048x1536 | 2048x1536 | 32/32 | 121s | vtracer | pass |
| Layered - Detail | 1,149,142 | 2,399,582 | 2.09x | 2048x1536 | 1700x1275 | 10/10 | 67s | potrace | pass |
| Layered - Detail (Medium Quality) | 1,149,142 | 2,502,461 | 2.18x | 2048x1536 | 1900x1425 | 32/32 | 103s | vtracer | pass |
| Layered - Detail (High Quality) | 1,149,142 | 3,790,686 | 3.30x | 2048x1536 | 2048x1536 | 32/32 | 113s | vtracer | pass |
| Filled Layers - Separate Colors | 1,149,142 | 1,969,351 | 1.71x | 2048x1536 | 1400x1050 | 10/10 | 66s | potrace | pass |
| Filled Layers - Separate Colors (Medium Quality) | 1,149,142 | 2,420,837 | 2.11x | 2048x1536 | 1800x1350 | 32/32 | 120s | vtracer | pass |
| Filled Layers - Separate Colors (High Quality) | 1,149,142 | 3,790,686 | 3.30x | 2048x1536 | 2048x1536 | 32/32 | 113s | vtracer | pass |

## IMG_9404 metrics

| Preset | Input bytes | SVG bytes | Ratio | SVG dims | ViewBox | Layers/groups | Time | Engine | UI checks |
|---|---:|---:|---:|---|---|---:|---:|---|---|
| Layered - Flat Color | 1,154,339 | 1,190,347 | 1.03x | 2048x1536 | 1500x1125 | 32/32 | 81s | vtracer | pass |
| Layered - Flat Color (Medium Quality) | 1,154,339 | 2,044,541 | 1.77x | 2048x1536 | 1800x1350 | 32/32 | 95s | vtracer | pass |
| Layered - Flat Color (High Quality) | 1,154,339 | 3,253,507 | 2.82x | 2048x1536 | 2048x1536 | 32/32 | 110s | vtracer | pass |
| Photo Many Colors | 1,154,339 | 609,354 | 0.53x | 2048x1536 | 820x615 | 32/0 | 52s | vtracer | pass |
| Photo Many Colors (Medium Quality) | 1,154,339 | 1,522,374 | 1.32x | 2048x1536 | 1500x1125 | 32/32 | 85s | vtracer | pass |
| Photo Many Colors (High Quality) | 1,154,339 | 3,253,507 | 2.82x | 2048x1536 | 2048x1536 | 32/32 | 108s | vtracer | pass |
| Layered - Detail | 1,154,339 | 2,226,697 | 1.93x | 2048x1536 | 1700x1275 | 10/10 | 67s | potrace | pass |
| Layered - Detail (Medium Quality) | 1,154,339 | 2,229,909 | 1.93x | 2048x1536 | 1900x1425 | 32/32 | 101s | vtracer | pass |
| Layered - Detail (High Quality) | 1,154,339 | 3,253,507 | 2.82x | 2048x1536 | 2048x1536 | 32/32 | 112s | vtracer | pass |
| Filled Layers - Separate Colors | 1,154,339 | 1,574,558 | 1.36x | 2048x1536 | 1400x1050 | 10/10 | 92s | potrace | pass |
| Filled Layers - Separate Colors (Medium Quality) | 1,154,339 | 2,044,541 | 1.77x | 2048x1536 | 1800x1350 | 32/32 | 101s | vtracer | pass |
| Filled Layers - Separate Colors (High Quality) | 1,154,339 | 3,253,507 | 2.82x | 2048x1536 | 2048x1536 | 32/32 | 166s | vtracer | pass |

## IMG_9288 metrics

| Preset | Input bytes | SVG bytes | Ratio | SVG dims | ViewBox | Layers/groups | Time | Engine | UI checks |
|---|---:|---:|---:|---|---|---:|---:|---|---|
| Layered - Flat Color | 1,195,385 | 1,186,508 | 0.99x | 2048x1536 | 1500x1125 | 32/32 | 84s | vtracer | pass |
| Layered - Flat Color (Medium Quality) | 1,195,385 | 1,987,035 | 1.66x | 2048x1536 | 1800x1350 | 32/32 | 139s | vtracer | pass |
| Layered - Flat Color (High Quality) | 1,195,385 | 3,076,524 | 2.57x | 2048x1536 | 2048x1536 | 32/32 | 115s | vtracer | pass |
| Photo Many Colors | 1,195,385 | 761,606 | 0.64x | 2048x1536 | 820x615 | 32/0 | 55s | vtracer | pass |
| Photo Many Colors (Medium Quality) | 1,195,385 | 1,226,886 | 1.03x | 2048x1536 | 1500x1125 | 32/32 | 85s | vtracer | pass |
| Photo Many Colors (High Quality) | 1,195,385 | 3,076,524 | 2.57x | 2048x1536 | 2048x1536 | 32/32 | 134s | vtracer | pass |
| Layered - Detail | 1,195,385 | 2,575,114 | 2.15x | 2048x1536 | 1700x1275 | 10/10 | 70s | potrace | pass |
| Layered - Detail (Medium Quality) | 1,195,385 | 2,076,556 | 1.74x | 2048x1536 | 1900x1425 | 32/32 | 103s | vtracer | pass |
| Layered - Detail (High Quality) | 1,195,385 | 3,076,524 | 2.57x | 2048x1536 | 2048x1536 | 32/32 | 113s | vtracer | pass |
| Filled Layers - Separate Colors | 1,195,385 | 1,852,300 | 1.55x | 2048x1536 | 1400x1050 | 10/10 | 68s | potrace | pass |
| Filled Layers - Separate Colors (Medium Quality) | 1,195,385 | 1,987,035 | 1.66x | 2048x1536 | 1800x1350 | 32/32 | 100s | vtracer | pass |
| Filled Layers - Separate Colors (High Quality) | 1,195,385 | 3,076,524 | 2.57x | 2048x1536 | 2048x1536 | 32/32 | 113s | vtracer | pass |

## IMG_9448 metrics

| Preset | Input bytes | SVG bytes | Ratio | SVG dims | ViewBox | Layers/groups | Time | Engine | UI checks |
|---|---:|---:|---:|---|---|---:|---:|---|---|
| Layered - Flat Color | 952,151 | 851,929 | 0.89x | 2048x1536 | 1500x1125 | 32/32 | 77s | vtracer | pass |
| Layered - Flat Color (Medium Quality) | 952,151 | 1,571,645 | 1.65x | 2048x1536 | 1800x1350 | 32/32 | 96s | vtracer | pass |
| Layered - Flat Color (High Quality) | 952,151 | 2,629,911 | 2.76x | 2048x1536 | 2048x1536 | 32/32 | 106s | vtracer | pass |
| Photo Many Colors | 952,151 | 453,886 | 0.48x | 2048x1536 | 820x615 | 32/0 | 42s | vtracer | pass |
| Photo Many Colors (Medium Quality) | 952,151 | 1,060,746 | 1.11x | 2048x1536 | 1500x1125 | 32/32 | 81s | vtracer | pass |
| Photo Many Colors (High Quality) | 952,151 | 2,629,911 | 2.76x | 2048x1536 | 2048x1536 | 32/32 | 107s | vtracer | pass |
| Layered - Detail | 952,151 | 1,661,125 | 1.74x | 2048x1536 | 1700x1275 | 10/10 | 66s | potrace | pass |
| Layered - Detail (Medium Quality) | 952,151 | 1,733,321 | 1.82x | 2048x1536 | 1900x1425 | 32/32 | 99s | vtracer | pass |
| Layered - Detail (High Quality) | 952,151 | 2,629,911 | 2.76x | 2048x1536 | 2048x1536 | 32/32 | 107s | vtracer | pass |
| Filled Layers - Separate Colors | 952,151 | 1,197,878 | 1.26x | 2048x1536 | 1400x1050 | 10/10 | 57s | potrace | pass |
| Filled Layers - Separate Colors (Medium Quality) | 952,151 | 1,571,645 | 1.65x | 2048x1536 | 1800x1350 | 32/32 | 91s | vtracer | pass |
| Filled Layers - Separate Colors (High Quality) | 952,151 | 2,629,911 | 2.76x | 2048x1536 | 2048x1536 | 32/32 | 108s | vtracer | pass |

## Simple-image compactness results

| Fixture | Scenario | Input bytes | SVG bytes | Ratio | SVG dims | ViewBox | Layers/groups | Time | Engine | UI checks |
|---|---|---:|---:|---:|---|---|---:|---:|---|---|
| charming-tomato-512x512.png | flat/default | 77,239 | 15,266 | 0.20x | 512x512 | 512x512 | 7/1 | 23s | vtracer | pass |
| charming-tomato-512x512.png | flat/medium | 77,239 | 16,097 | 0.21x | 512x512 | 512x512 | 7/1 | 23s | vtracer | pass |
| charming-tomato-512x512.png | flat/high | 77,239 | 18,120 | 0.23x | 512x512 | 512x512 | 7/1 | 23s | vtracer | pass |
| charming-tomato-512x512.png | photo/default | 77,239 | 16,277 | 0.21x | 512x512 | 512x512 | 8/1 | 23s | vtracer | pass |
| charming-tomato-512x512.png | 8-color/default | 77,239 | 16,081 | 0.21x | 512x512 | 512x512 | 6/1 | 22s | vtracer | pass |
| charming-tomato-512x512.png | poster/default | 77,239 | 15,978 | 0.21x | 512x512 | 512x512 | 5/1 | 22s | vtracer | pass |
| charming-tomato-512x512.png | filled/default | 77,239 | 15,876 | 0.21x | 512x512 | 512x512 | 7/1 | 22s | vtracer | pass |
| generated-simple-logo.png | flat/default | 14,172 | 5,661 | 0.40x | 512x512 | 512x512 | 4/1 | 22s | vtracer | pass |
| generated-simple-logo.png | flat/medium | 14,172 | 5,737 | 0.40x | 512x512 | 512x512 | 4/1 | 23s | vtracer | pass |
| generated-simple-logo.png | flat/high | 14,172 | 5,865 | 0.41x | 512x512 | 512x512 | 4/1 | 23s | vtracer | pass |
| generated-simple-logo.png | photo/default | 14,172 | 5,717 | 0.40x | 512x512 | 512x512 | 4/1 | 23s | vtracer | pass |
| generated-simple-logo.png | 8-color/default | 14,172 | 5,832 | 0.41x | 512x512 | 512x512 | 4/1 | 23s | vtracer | pass |
| generated-simple-logo.png | poster/default | 14,172 | 5,951 | 0.42x | 512x512 | 512x512 | 5/1 | 23s | vtracer | pass |
| generated-simple-logo.png | filled/default | 14,172 | 5,808 | 0.41x | 512x512 | 512x512 | 4/1 | 23s | vtracer | pass |
| generated-low-color.png | flat/default | 9,201 | 3,322 | 0.36x | 640x420 | 640x420 | 5/0 | 75s | vtracer | pass |
| generated-low-color.png | flat/medium | 9,201 | 3,378 | 0.37x | 640x420 | 640x420 | 5/0 | 23s | vtracer | pass |
| generated-low-color.png | flat/high | 9,201 | 3,530 | 0.38x | 640x420 | 640x420 | 5/0 | 23s | vtracer | pass |
| generated-low-color.png | photo/default | 9,201 | 3,378 | 0.37x | 640x420 | 640x420 | 5/0 | 23s | vtracer | pass |
| generated-low-color.png | 8-color/default | 9,201 | 3,350 | 0.36x | 640x420 | 640x420 | 5/0 | 23s | vtracer | pass |
| generated-low-color.png | poster/default | 9,201 | 3,264 | 0.35x | 640x420 | 640x420 | 5/0 | 23s | vtracer | pass |
| generated-low-color.png | filled/default | 9,201 | 3,262 | 0.35x | 640x420 | 640x420 | 5/0 | 23s | vtracer | pass |

Simple-image compactness passed. The tomato fixture stayed between 15,266 and 18,120 bytes for default/medium/high flat tiers. The generated logo stayed between 5,661 and 5,951 bytes across the checked presets. The generated low-color fixture stayed between 3,262 and 3,530 bytes across the checked presets. Existing 8 Color and Poster guardrails stayed compact on all simple fixtures.

## Visual comparison notes

### Default vs Medium

- Flat tiers: Medium improves card text/linework and border continuity on IMG_8846, IMG_9288, and IMG_9448. IMG_9404 improves too, but the change is more moderate because the source has heavy holographic texture.
- Photo tiers: Medium is a substantial improvement over Photo Many Colors Default on all four card fixtures. The default photo tier is smaller and visibly coarser; Medium restores more subject detail and cleaner card structure.
- Detail tiers: Medium generally gives a more natural full-color card result than the existing 10-layer Potrace detail default, especially on IMG_9288 where the default is washed/noisy. IMG_9288 detail medium is smaller than detail default while using more layers.
- Filled tiers: Medium improves color separation and card readability compared with the existing filled default, with the expected larger output size.

### Medium vs High

- High adds finer texture, small linework, and full-size viewBox output. The improvement is most visible in card text, holographic texture, and edge detail.
- High is not uniformly decisive. On some fixtures, Medium already captures the main subject and card border, while High adds incremental texture at a much larger file size.
- High outputs frequently collapse to the same exact byte size across Flat, Photo, Detail, and Filled families for the same fixture. Examples: IMG_8846 High variants all produced 3,790,686 bytes; IMG_9404 High variants all produced 3,253,507 bytes; IMG_9288 High variants all produced 3,076,524 bytes; IMG_9448 High variants all produced 2,629,911 bytes. This is not automatically a bug, but it is a merge-risk signal that user visual review should check.

### File-size justification

- Medium appears justified for manual testing: it usually improves visible fidelity without reaching the largest file sizes.
- High may be justified only for users who value maximum visible card detail over large SVGs. The visual delta over Medium is real in several screenshots, but not enough to call merge-ready without user acceptance.
- Card text remains imperfect even at High. High improves readability cues and line structure, but it does not make all small text reliably readable.

### Missing or transparent areas

- No broad missing/transparent areas were found in the reviewed contact sheets.
- Some dark patching and simplified/noisy regions remain in card backgrounds and holographic areas, especially where the source itself has glare or dense texture.

## Regressions found

No functional regressions were found during this Gate-A pass.

- Defaults remained separately selectable and did not silently jump to Medium/High.
- Simple logo and low-color fixtures did not jump to large output sizes.
- Existing 8 Color and Poster guardrails remained compact on simple fixtures.
- Settings/Edit opened for every run.
- Layer colors opened for every run.
- Copy worked for every run.
- Download worked for every run.
- Copy/download SVG parity matched for every run.

## Recommendation

- Ready for user manual testing: yes.
- Ready for merge: no, not from this evidence alone.
- Needs revision: no code revision is proven by Gate-A, but merge should wait for user visual review of the Medium and High contact sheets.

The next decision is qualitative: whether Medium and High improve the target card fixtures enough to justify larger files and slower conversion times.

## Remaining risks

- High-tier SVG sizes are large for photo-card content: 2,629,911 to 3,790,686 bytes in this fixture set.
- High-tier outputs often converge to identical byte sizes across several preset families for the same fixture, so route/preset intent should be visually confirmed.
- Browser conversion times for full card fixtures ranged from 42s to 166s in this local run.
- Visual inspection was limited to generated browser screenshots, rendered SVG screenshots, and contact sheets. Final acceptance still needs the user to inspect the full artifacts directly.
- The run used a clean local browser state against `http://localhost:3000`; no production deployment was tested or changed.
