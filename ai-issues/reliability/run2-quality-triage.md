# Run 2 quality triage and checkerboard false-positive correction

Status: diagnostic and test corrections locally validated. The isolated preprocessing correction passes its function corpus and paired production-build browser matrix. Independent review remains a merge gate. This is a separate quality lane from the narrow reliability release.

## What the 39 original failures mean

The immutable Run 1 report `tmp/baseline-high-fidelity-report.json` contains 39 failed assertions across 18 scenarios/17 unique SVG downloads of one 800x400 synthetic UI fixture. They are not 39 independent bugs or regressions. Run 1 baseline/candidate downloaded bytes remain unchanged. Original reports and baseline artifact folders are not overwritten by this pass.

| Original assertion category | Count | Classification and evidence |
| --- | ---: | --- |
| Painted alpha coverage | 13 | Genuine shared preprocessing defect: high-quality server paths discard ordinary light-neutral background regions, despite white-removal being false. One root cause repeats over thirteen tier presets. |
| Excess output darkness | 13 | Proven test measurement defect: `removeAlpha()` exposes invisible black RGB rather than compositing on the white comparison sheet. This inflates apparent output darkness, not the displayed SVG. |
| Medium-versus-default detail score | 4 | Correlated quality-ordering signal. The score includes the incorrect darkness input; recomputation is required. Better tier labels do not establish better fine lettering on this fixture. |
| Amazing-versus-high detail improvement | 4 | Correlated quality-ordering signal. Visible small text/details are missing across presets; no tracing retune is justified from one input. |
| Same-tier family output signatures | 3 | Same-fixture collapse confirmed by saved SVGs and fresh high-tier browser conversions. This does not prove every input or every family has the same implementation. More discriminating inputs are required before changing engine/preset mathematics. |
| Default preset layer minimum | 1 | Stale test contract: the current default `layered-flat-color` preset requests 16 colors and adaptive quantization can merge colors. A blanket minimum of 20 is not its implemented contract. |
| Average coordinate precision >3 | 1 | Output-size/optimization concern, not evidence of malformed geometry. The 39096-byte default SVG is well below its existing byte budget. No coordinate rounding change was made. |

The actual user-visible priorities are: (1) preserve opaque source/background content, (2) investigate missing small lettering/white details and tier usefulness across a broader corpus, then (3) optimize numeric serialization only if measured value justifies a separate change. Family equality and several score assertions overlap these concerns; adding them does not create independent defect counts.

## Measurement corrections, without threshold relaxation

`renderComparison` now flattens source/output RGB onto white before measuring darkness/detail, matching the existing white-backed screenshot. Alpha coverage remains independently measured from RGBA. No coverage, detail, progression, size, precision or family-collapse threshold was lowered to mask a failure.

For the unchanged high-quality SVG, output dark-pixel share changes from **0.2924 to 0.0904**. The source-supported share is 0.0842; the former apparent dark excess came primarily from invisible pixels. A two-pixel adversarial test reproduces the previous false failure using transparent black next to opaque white; the corrected pipeline sees white, while the alpha measurement still reports 50% coverage. Partial alpha is checked against an independent white-canvas composite, and opaque RGB is preserved.

The default-layer test now derives its ceiling from the actual result's requested processing palette budget when exposed, retains the shared 32-group ceiling for historical reports without that metadata, and requires nonempty editable output. This respects adaptive/server processing, which can legitimately exceed the default preset's configured 16 colors. The old impossible >=20-layer floor is removed only for the default preset; high-tier checks and visual metrics remain intact. The optional preset reporter also used an undefined `img8846`; it now reports its own fixture instead of throwing when an assertion fails. The quality script can be imported for isolated tests without launching a browser and supports a validated plain run-directory name, so archived evidence is preserved.

Remeasuring exact saved outputs with these corrections yields **29 assertions**, not a cosmetically green suite: 13 alpha coverage, eight progressive score, four amazing-detail, three family-collapse and one precision. Thirteen false darkness assertions and one stale layer assertion disappear, while four additional progressive comparisons fail when the score no longer benefits from hidden black RGB. This pass does not report '39 minus 14 =25 bugs remaining.'

Commands:

```
node scripts/high-fidelity-display-metrics-test.mjs
node scripts/high-fidelity-quality-triage.mjs
```

Outputs: `tmp/run2-high-fidelity-remeasurement/{triage-summary,remeasured-report}.json` and newly rendered comparison sheets. These remeasure preserved SVG bytes; they do not regenerate or improve geometry.

## Fresh real-browser reproduction before the preprocessing fix

The original PR #3 production build on localhost:3000 was exercised through upload, preset selection, completion, settings, copy and SVG download. Correctly selected default Flat Color produced 15 layers/39096 bytes/hash e9b491ca. High Flat Color and High Photo Many Colors each produced 31 layers/32986 bytes/hash 42d73ab2, with matching requested output titles and copy/download parity. Correct white-backed dark share is 0.0904; actual painted coverage is 0.3011 versus source 0.5. The two high presets still fail the unchanged coverage gate.

Evidence: `tmp/run2-quality-browser-reproduction-selected/report.json` and renders. An earlier optional preselect-before-upload attempt clicked before the preset drawer was available and sampled the default line-art output; that run's explicit selection/title failures are retained as invalid reproduction, not blamed on tracing. Valid reproduction selected presets after the initial upload settled.

## Confirmed alpha-loss root cause

`neutralizeTransparencyCheckerboard` used only a histogram of two common light-neutral colors and edge coverage. It never checked for an alternating checker pattern. A fully opaque synthetic UI screenshot therefore loses **42.9%** of its opacity directly in this production function. Two simple solid gray/white bands lose **70.8%**—the same removal as a genuine checkerboard with foreground. The server layered pipeline calls this before tracing; browser default tracing does not take the same preprocessing path. This explains the default-versus-server coverage discrepancy without changing tracing mathematics.

The corrected detector keeps all existing color/edge guards and additionally requires regular repeated alternating runs on multiple rows and columns, two-dimensional alternating-cell parity, and a half-cell diagonal phase check that rejects diagonal stripes. It uses the already resized <=720px metadata sample; it does not add another image decode or full-resolution allocation. Ambiguous backgrounds stay unchanged rather than being silently removed.

A first parity-only candidate was internally rejected because diagonal stripes can satisfy a four-corner parity test; explicit diagonal-stripe fixtures and midpoint evidence now cover that adversarial case. No production change was released from that intermediate candidate.

Function-level corpus (`scripts/checkerboard-detection-regression.mjs`), comparing current `origin/main` with the candidate (19 cases):

- Eleven ordinary inputs remain **byte-for-byte unchanged**: opaque UI mockup, two solid bands, four large neutral quadrants, horizontal stripes, three diagonal stripe sizes, a neutral gradient, an opaque logo with white details, transparent logo and deterministic photographic texture.
- Eight genuine checker cases preserve **exact decoded output** versus current main, with actual alpha removal: 4/8/10/20/40px checks, JPEG compression, a non-integral rescale and an offset crop.
- Total sequential before/after corpus time was about 0.7 seconds on this host; this is not a production CPU/RAM benchmark. Gate/native concurrency and resource ceilings are unchanged.
- Typecheck passes. No tracing configuration, default, preset, route, metadata, canonical, sitemap, ad lifecycle or third-party integration changed.

Commands:

```
node scripts/checkerboard-detection-triage.mjs
node scripts/checkerboard-detection-regression.mjs
npm run typecheck
```

Evidence: `tmp/run2-checkerboard-corpus/report.json`. The diagnostic script executes the actual source function with only its Sharp loader supplied; unrelated diagnostics collaborators are unused. This isolates causality; the following browser run covers the deployed-style conversion pipeline.

## Paired conversion results on local production builds

`node scripts/checkerboard-conversion-browser.mjs` exercised the preserved PR #3 build (`home-BEA8oIdB.js`, port 3007) and the separate quality build (`home-CTTem-RT.js`, port 3004) in desktop Chromium. All 18 uploads produced the selected preset's preview and a path-based SVG download, with one successful real server POST and no page errors per run. The browser blocked third-party requests. The inputs were the existing synthetic UI mockup and three generated fixtures; no private upload was used.

| Fixture and preset | Before → after | Evidence |
| --- | --- | --- |
| Opaque UI, High Flat / High Photo | 0.3011 → 0.5000 painted coverage (source 0.5000) | Original 520×520 alpha metric; 32,986 → 52,425 bytes. High Flat and High Photo still return identical SVGs to one another. |
| Opaque gray bands, High Flat | 0.1932 → 0.7106 opacity (source 0.7325) | Both background bands and the white cross remain visible after tracing. |
| Opaque gray bands, Accurate Lineart | 0.1852 → 0.4473 opacity | The retained #dedede lower band falls below the existing threshold of 224 and therefore traces black. White cross survives. |
| Opaque UI, Accurate Lineart | Exact SVG parity | Both produce the same 53,149-byte SVG. |
| Genuine checker and transparent logo, both presets | Exact SVG and rendered pixel parity, four pairs | The checker still disappears. The transparent logo still has a clear background. |

The bands figures use the paired script's padded 400×220 canvas and count alpha ≥245, so they are not directly comparable with the original 520×520 painted coverage metric. The latter is reproduced separately for the UI in `tmp/run2-quality-conversion/ui-full-render-metrics.json`. On that same white-backed canvas, UI mean absolute RGB error improves from 5.82 to 4.98 levels out of 255, while source-supported dark detail recall declines from 0.8968 to 0.8363 and high-contrast dark recall declines from 0.6548 to 0.6055. The background and several colors are closer to source, but a light swatch that was visible before blends into the background after, and small text/white detail is still missing. This is a targeted preservation improvement with a documented palette tradeoff; it does not establish that the existing quantizer improves all regions.

Inspected white-backed source/before/after sheets for UI High Flat, the two gray bands outputs, genuine checker and transparent logo, and the actual High Flat output card. SVGs, screenshots, image comparisons and measured parity are under `tmp/run2-quality-conversion/`. `npm run build`, `npm run typecheck`, `npm run test:trace-quality`, `node --check server.js` and `git diff --check` pass.

## Full high-fidelity rerun on the quality build

The historical matrix (one default Flat Color run plus 17 tier entries) completed on the quality build with unchanged thresholds. All 18 entries rendered and passed copy/download parity. The command exited 1 for the remaining quality assertions; it did not time out or fail to select a preset.

| Assertion | Original baseline | Same SVGs, corrected test | Quality build, corrected test |
| --- | ---: | ---: | ---: |
| Painted alpha coverage | 13 | 13 | 0 |
| Excess darkness | 13 | 0 | 0 |
| Tier progression score | 4 | 8 | 8 |
| Amazing versus High detail gain | 4 | 4 | 0 |
| Same-tier family collapse | 3 | 3 | 3 |
| Stale default layer minimum | 1 | 0 | 0 |
| Coordinate precision | 1 | 1 | 1 |
| **Total** | **39** | **29** | **12** |

All 17 tier entries measured 0.5000 painted coverage, matching the source. The 12 remaining assertions are all present in the corrected baseline, and the default Flat Color download still has hash `e9b491ca` and 39,096 bytes. The four relative Amazing-versus-High gates pass, but High lost some source-supported contrast (measured above), and direct inspection of the Amazing and High renders shows that both still omit the fixture's tiny lettering. Treat the comparative pass as a measured tier relationship, not proof of text fidelity. The medium, high and amazing family-collapse checks still reproduce on this source. No palette, threshold, coordinate or trace-engine change was made to chase those residuals.

Evidence: `tmp/run2-quality-full-post-fix/report.json` and its `renders/` and `downloads/` folders. The historical run directories remain intact. To reproduce, set `BASE_URL=http://127.0.0.1:3004` and a fresh `HF_BROWSER_OUTPUT_RUN_NAME`, then run `node scripts/high-fidelity-browser-output-smoke.mjs` with the default flat and tier matrices.

## Remaining acceptance and limits

Before merging the quality correction, independently review the detector and its runtime evidence, including the UI palette tradeoff. Keep this candidate out of the immediate reliability release. If the stricter detector cannot confidently distinguish a large, coarse, obscured or transformed checkerboard, it deliberately leaves that background intact. Transparent-background editing remains a separate user-controlled operation.

Small lettering loss and same-fixture family collapse remain open. No claim is made that the preprocessing correction repairs font geometry, improves every tier, or validates a physical iPhone. No private incident originals were consumed by this subtask.
