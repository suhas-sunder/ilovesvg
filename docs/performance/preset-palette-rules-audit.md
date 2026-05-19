# Preset Palette Rules Audit A

Date: 2026-05-19
Branch: `preset-palette-rules-audit-may-19`
Baseline: `9c14810`
Diagnostic script: `scripts/preset-palette-rules-audit.mjs`
Diagnostic JSON: `tmp/preset-palette-rules-audit.json`

## Executive Summary

This pass is report-only. No production conversion code, route URLs, SEO metadata, navigation, sitemap, monetization, affiliate logic, presets, settings UI, or compression behavior was changed.

The current adaptive Flat Color work is narrowly gated in the browser worker to `layered-flat-color` plus `per-color-cutout`, with a 30 editable-group ceiling. That is the right ceiling policy for Flat Color, but it is not a complete preset policy for the rest of the layered preset set.

The audit found three implementation risks that should be handled before broader palette work:

1. `Photo Many Colors` requests 32 colors through the raw VTracer path. That violates the product rule that 30 editable grouped colors is the user-facing ceiling.
2. Shared layered additions use `colorLayerCount`, while the PNG/JPG layered route-local submit paths append `layerCount`. Those routes can keep the default route-local layer count for shared additions unless a route-specific mapper is added.
3. The server fallback flat-color adaptive heuristic can match non-Flat Color flat-like presets with 14 to 18 layers, `posterize: false`, and low `minRegionPercent`. That may be useful, but it is not an explicit preset contract.

The key product conclusion: each preset needs its own palette contract. Do not apply the Flat Color grouping rules globally.

## Current Preset Inventory

The diagnostic found 92 layered/color preset entries in the inspected files:

| Inventory bucket | Count | Notes |
|---|---:|---|
| Shared layered additions | 41 | Added by `extendTracePresets` or `extendLayeredPresets` |
| Route-local layered presets | 51 | Home, PNG layered, and JPG layered route arrays |
| Core contract families | 8 | The required audit set below |
| Fixture/preset matrix rows | 80 | 8 core presets across 10 fixtures |

Core presets and related route variants:

| Contract family | Exact/shared source | Route availability | Current requested count | Current engine path |
|---|---|---|---:|---|
| Layered - Flat Color | `layered-flat-color` | `/`, `/png-to-layered-svg-for-cricut`, `/jpg-to-layered-svg-for-cricut` | 16 | Home VTracer first, PNG/JPG server action path |
| Layered - 8 Color | `layered-8-color` | Shared addition on all three inspected routes | 8 | Home VTracer first, PNG/JPG server action path |
| Layered - Poster | `layered-poster`, `layered-soft-poster`, poster variants | Shared plus JPG poster route variants | 6 to 12 | Mixed by route |
| Layered - Detail | `layered-detail`, `layered-color-detail`, high-detail route variants | Shared plus route-local variants | 8 to 28 | Mixed by route |
| Layered - Low Noise | `layered-low-noise`, smooth variants | Shared plus route-local smoother variants | 4 to 8 | Mixed by route |
| Layered - Cut Friendly | `layered-cut-friendly`, vinyl/HTV/cut variants | Shared plus PNG/JPG cut variants | 2 to 7 typical | Mixed by route |
| Filled Layers - Separate Colors | `filled-layers-separate-colors`, filled/sticker/logo variants | Shared plus route-local sticker/logo variants | 5 to 28 | Mixed by route |
| Photo Many Colors | `photo-many-colors` | Shared addition on all three inspected routes | 32 | Raw VTracer on home, route mismatch risk on PNG/JPG |

Route-specific variants should not be treated as identical to the eight named presets. They should inherit a family contract only when their label and settings match that family intent.

## Fixture Matrix Summary

All required fixtures were available locally. The diagnostic also generated three temporary fixtures under `tmp/preset-palette-rules-fixtures`; those files must not be committed.

| Fixture | Role | Sampled unique colors | Major colors | Suggested UI groups | Notes |
|---|---|---:|---:|---:|---|
| `IMG_8846.JPEG` | real-user high detail | 32,979 | 0 | 30 | Many tiny colors, needs deterministic pruning |
| `IMG_9288.JPEG` | real-user high detail | 51,880 | 0 | 30 | High-color range, near-duplicate clusters |
| `IMG_9404.JPEG` | real-user high detail | 62,030 | 0 | 30 | High-color range, many tiny variants |
| `IMG_9448.JPEG` | real-user high detail | 43,710 | 0 | 30 | High-color range, dark variant risk |
| Screenshot 2026-05-06 | complex UI screenshot | 1,274 | 12 | 21 | Strong near-white/anti-aliasing collapse needed |
| charming tomato | transparent sticker | 1,776 | 8 | 17 | Sticker-like, preserve saturated regions |
| `IMG_8487.PNG` | blue/light-neutral regression | 1,843 | 27 | 30 | High region-fidelity sensitivity |
| generated simple logo | generated logo | 319 | 5 | 11 | Should stay compact |
| generated low color | generated low-color | 339 | 4 | 9 | Should not show high count presets |
| generated high-color noisy | generated noisy | 90,457 | 0 | 30 | High complexity but mostly tiny/noisy exact colors |

These fixture projections are not visual-output proof. They are used to decide which preset contracts need actual rendered-output validation.

## Current Layer and Color Behavior

Current local tmp smoke data, when available, showed:

| Scenario | Route | Preset | Exposed groups | Path count | SVG bytes | Risk |
|---|---|---|---:|---:|---:|---|
| screenshot | `/` | Layered - Flat Color | 15 | 4,118 | 998,422 | High region risk |
| screenshot | `/png-to-layered-svg-for-cricut` | Layered - Flat Color | 9 | 479 | 190,288 | High region risk |
| screenshot JPG derivative | `/jpg-to-layered-svg-for-cricut` | Layered - Flat Color | 5 | 6 | 12,617 | Low color risk, possible flattening |
| screenshot | `/` | Photo Many Colors | 1,966 | 4,211 | 1,088,637 | Raw-color explosion |
| screenshot | `/` | Filled Layers - Separate Colors | 179 | 1,082 | 336,505 | Raw near-duplicate exposure |
| screenshot | `/png-to-layered-svg-for-cricut` | Layered - Detail | 5 | 5 | 2,198,819 | Over-flattening risk |
| tomato | `/` | Layered - Flat Color | 7 | 16 | 24,770 | Medium region risk |
| `IMG_8487.PNG` | `/` | Layered - Flat Color | 15 | 127 | 80,255 | High structural risk |

Flat Color is now compact enough by count in these measured cases, but region fidelity still matters. Photo Many Colors and Filled Layers demonstrate why raw VTracer color exposure cannot be allowed to define editable layer rows.

## Over-Flattening Risks

Layered - 8 Color:
Should intentionally stay near 8 or fewer groups. It over-flattens only when the input has more than eight meaningful, nonmergeable color families. In that case the UI should steer users to Detail or Photo Many Colors, not silently expand 8 Color to 20 or 30.

Layered - Poster:
Flattening is intentional, but poster bands must be stable. It should preserve broad face/object/shadow/highlight bands without trying to retain photo-level detail.

Layered - Detail:
The PNG/JPG route-local server paths can over-flatten if shared `colorLayerCount` settings do not map into the route's `layerCount`. Detail should not collapse complex images to 5 to 10 groups just because of route plumbing.

Layered - Low Noise and Cut Friendly:
Flattening is intentional. These presets should reject or steer away from detailed fidelity expectations rather than increase counts.

Filled Layers - Separate Colors:
Over-flattening is a risk when distinct filled regions are merged by global color similarity. It needs region-aware checks before broad grouping changes.

Photo Many Colors:
Over-flattening is the main quality risk if its ceiling is enforced bluntly. Its cap must be 30 user-facing groups, but pruning has to preserve meaningful subject colors.

## Over-Fragmentation Risks

Flat Color:
Currently improved, but still needs region-aware guardrails for spatially separate similar colors.

8 Color:
Should not fragment above 8. If output needs 20 groups, the preset was a bad match.

Poster:
Should not exceed 12 groups without strong evidence. More than that weakens the posterized contract.

Detail:
Can approach 30 on complex sources, but must merge anti-aliasing and near-duplicates.

Low Noise:
Should stay below 8. More rows usually means it failed to remove noise.

Cut Friendly:
Should stay below 6. More rows usually means poor cut usability.

Filled Layers:
Current measured 179 exposed rows on the home screenshot is not acceptable. It needs moderate grouping and path ownership validation.

Photo Many Colors:
Current measured 1,966 exposed rows is not acceptable. It needs a hard user-facing cap of 30 plus quality-aware pruning.

## Preset-Specific Palette Contracts

| Preset | Intended outcome | Image types | Expected groups | Hard max | 30 max applies | Grouping |
|---|---|---|---:|---:|---|---|
| Layered - Flat Color | Compact editable flat color blocks | logos, stickers, flat art, screenshots | 6-30 adaptive | 30 | Yes | Adaptive strong |
| Layered - 8 Color | Deliberately compact 8-color output | simple clipart, icons, decal art | 2-8 | 8 | No | Strong |
| Layered - Poster | Posterized broad tonal bands | photos, portraits, cartoons | 4-12 | 12 | No | Strong tonal |
| Layered - Detail | More detail without raw-color exposure | detailed stickers, complex art | 12-30 | 30 | Yes | Moderate |
| Layered - Low Noise | Clean low-noise output | noisy JPGs, compressed images | 2-8 | 8 | No | Very strong |
| Layered - Cut Friendly | Few clean weedable regions | decals, vinyl, cardstock | 1-6 | 6 | No | Cut-first |
| Filled Layers - Separate Colors | Distinct filled regions remain editable | flat illustrations, cartoons, stickers | 8-24 | 24 | Yes as ceiling, not target | Moderate |
| Photo Many Colors | High-complexity photo-like approximation | photos, complex rendered art | 18-30 | 30 | Yes | Light selective |

Near-black rule: merge near-black variants aggressively for compact/cut/noise presets. For Detail, Filled Layers, and Photo Many Colors, preserve distinct dark outlines or subject details when they are spatially meaningful.

Near-white rule: merge anti-aliased near-white and light-neutral variants, but preserve meaningful light fills, highlights, and the IMG_8487 light-neutral boundary case.

Noise rule: anti-aliasing and compression noise should not become first-class editable colors. The more fidelity-oriented presets should still preserve meaningful small saturated or high-contrast details.

Region-fidelity rule: Flat Color, Detail, Filled Layers, and Photo Many Colors need region-aware validation. Count alone is not enough.

## Conditional Color-Count Preset Plan

Do not implement this yet.

| Count | Recommendation | Rationale | Show when |
|---:|---|---|---|
| 10 | Keep | Useful bridge above 8 | Meaningful colors roughly 7-14 |
| 12 | Keep | Good poster/detail bridge | Input has at least 10 meaningful colors |
| 15 | Skip initially | Redundant with 12 and 20 | Hold unless data proves a gap |
| 20 | Keep | Useful for complex illustrations | Meaningful clusters at least 16 |
| 25 | Skip initially | Redundant with 20 and 30 | Hold unless rendered tests prove value |
| 30 | Keep as ceiling preset | Needed for high-detail/photo-like inputs | Meaningful clusters at least 24 |

Guardrails:

- Do not show 30 colors for one-color or two-color images.
- Do not invent fake colors when the source has fewer meaningful clusters.
- Hide or disable counts above the detected meaningful color capacity.
- Keep count presets in an expanded or conditional area, not above upload by default.
- Keep route-specific preset labels and intent. Count presets should not replace semantic presets.

## Recommended Implementation Order

1. Implement contract guardrails for Layered - 8 Color and Layered - Poster only.
   Reason: smallest contract surface, clear hard maxima, low blast radius.
   Likely files: `app/client/workers/vtracer.worker.ts`, `app/utils/svgLayerTrace.server.ts`, `scripts/preset-palette-rules-audit.mjs`, `scripts/color-region-fidelity-audit.mjs`.

2. Implement Detail and Photo Many Colors.
   Reason: high-risk fidelity and performance work, including the Photo Many Colors 30-group cap.
   Likely files: `app/client/workers/vtracer.worker.ts`, `app/client/lib/tracing/vtracerWorkerClient.ts`, `app/client/components/svg/LayerPaletteEditor.tsx`, `scripts/cumulative-edit-performance-smoke.mjs`.

3. Implement Filled Layers, Low Noise, and Cut Friendly contracts.
   Reason: these need different grouping aggressiveness and should not inherit Detail or Photo behavior.
   Likely files: `app/client/workers/vtracer.worker.ts`, `app/utils/svgLayerTrace.server.ts`, `scripts/sticker-border-correctness-smoke.mjs`.

4. Implement conditional color-count presets.
   Reason: count presets should come only after meaningful-color detection is validated.
   Likely files: `app/client/lib/converter/presetAdditions.ts`, `app/client/components/converter/PresetSelector.tsx`, `app/client/workers/vtracer.worker.ts`.

5. Compression work.
   Reason: compression should not obscure whether palette grouping preserved editable region fidelity.

Do not change every preset in one commit.

## Tests Required Before Implementation

Required before any preset behavior change:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:tool-output`
- `npm.cmd run test:settings-color-coverage`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:layer-color-correctness`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:fish-card-region-fidelity`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:palette-grouping-audit`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:color-region-fidelity-audit`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:preset-palette-rules-audit`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

Additional gates by batch:

- 8 Color and Poster: add route/preset smoke coverage proving 8 Color never expands above 8 and Poster stays posterized.
- Detail and Photo Many Colors: add 30-row editor performance, raw-color cap, and rendered fidelity comparison.
- Filled Layers: add separate-color region ownership and copy/download parity coverage.
- Low Noise and Cut Friendly: add path-count, island-removal, sticker-border, and transparent-boundary coverage.
- Conditional color counts: add meaningful-color detection tests and UI visibility tests.

## Non-Goals

- No production grouping implementation.
- No preset changes.
- No settings UI changes.
- No route URL, SEO, navigation, sitemap, monetization, affiliate, or Printify changes.
- No compression work.
- No binary fixture commits.
- No claim that layer count alone proves output quality.
