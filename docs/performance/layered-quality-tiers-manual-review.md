# Layered Quality Tiers Correction-B Review

Date: 2026-05-24

## Executive summary

Correction-B restores the additive quality-tier strategy. Existing defaults remain, existing Medium and High options remain, and family-specific Insane Quality options are now added instead of replacing or consolidating previous choices.

The branch is ready for user manual testing. It is not ready for merge from this pass alone because the highest tiers still need user visual approval against the card/photo fixtures.

## Branch and commit reviewed

- Branch: `layered-quality-tiers-may-20`
- Starting commit for this correction: `641f58c93f2f25261ab5ad1805b3e53b6693d0e4`
- Local preview URL: `http://localhost:3000`
- App verified: `iLoveSVG | Free SVG Converter and Image to SVG Tools`

## Artifact paths

- Previous manual QA artifacts: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\layered-insane-quality-revision-a\manual-qa`
- High-fidelity browser smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\high-fidelity-browser-output-smoke\report.json`
- Preset palette rules audit: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\preset-palette-rules-audit.json`
- Adaptive palette smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\adaptive-palette-quality-smoke.json`
- Fish/card fidelity smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\fish-card-region-fidelity-smoke.json`
- Full preset smoke: `D:\PROJECTS-and-WORK\work-projects\all_projects\ilovesvg\tmp\stage1-layered-quality-tiers-correction-full-preset-smoke.json`

## Final preset labels and IDs

| Family | Default | Medium Quality | High Quality | Insane Quality |
|---|---|---|---|---|
| Layered - Flat Color | `layered-flat-color` | `layered-flat-color-medium-quality` | `layered-flat-color-high-quality` | `layered-flat-color-insane-quality` |
| Photo Many Colors | `photo-many-colors` | `photo-many-colors-medium-quality` | `photo-many-colors-high-quality` | `photo-many-colors-insane-quality` |
| Layered - Detail | `layered-detail` | `layered-detail-medium-quality` | `layered-detail-high-quality` | `layered-detail-insane-quality` |
| Filled Layers - Separate Colors | `filled-layers-separate-colors` | `filled-layers-separate-colors-medium-quality` | `filled-layers-separate-colors-high-quality` | `filled-layers-separate-colors-insane-quality` |

The generic `Layered - Insane Quality` preset remains as `layered-insane-quality`. It does not replace the family-specific Insane presets.

## Kept, restored, added, removed

Kept:

- All existing default presets.
- Existing Medium variants.
- Existing High variants after restoring the ones removed in Revision-A.
- Generic `layered-insane-quality`.

Restored:

| ID | Label | Behavior |
|---|---|---|
| `layered-flat-color-high-quality` | Layered - Flat Color (High Quality) | Prior High flat-color settings, `layeredQualityTier: "high"`, 32 requested colors, 2048 trace side. |
| `photo-many-colors-high-quality` | Photo Many Colors (High Quality) | Prior High photo settings, `layeredQualityTier: "high"`, 32 requested colors, 2048 trace side. |
| `layered-detail-high-quality` | Layered - Detail (High Quality) | Prior High detail settings, `layeredQualityTier: "high"`, stacked overlap, 32 requested colors, 2048 trace side. |
| `filled-layers-separate-colors-medium-quality` | Filled Layers - Separate Colors (Medium Quality) | Prior Medium filled settings, `layeredQualityTier: "medium"`, 32 requested colors, 1800 trace side. |
| `filled-layers-separate-colors-high-quality` | Filled Layers - Separate Colors (High Quality) | Prior High filled settings, `layeredQualityTier: "high"`, 32 requested colors, 2048 trace side. |

Added:

| ID | Label | Behavior |
|---|---|---|
| `layered-flat-color-insane-quality` | Layered - Flat Color (Insane Quality) | Highest-fidelity flat-color family settings, `layeredQualityTier: "insane"`, max 32 editable colors. |
| `photo-many-colors-insane-quality` | Photo Many Colors (Insane Quality) | Highest-fidelity photo family settings, `layeredQualityTier: "insane"`, max 32 editable colors. |
| `layered-detail-insane-quality` | Layered - Detail (Insane Quality) | Highest-fidelity detail family settings, `layeredQualityTier: "insane"`, max 32 editable colors. |
| `filled-layers-separate-colors-insane-quality` | Filled Layers - Separate Colors (Insane Quality) | Highest-fidelity filled-layer family settings, `layeredQualityTier: "insane"`, max 32 editable colors. |

Removed or renamed in Correction-B: none.

## Why this is not clutter

The final set follows the user-requested four-level hierarchy per relevant family: Default, Medium Quality, High Quality, and Insane Quality. The labels make the tradeoff explicit, and the audit now fails if a default, Medium, High, or Insane preset disappears or has an unexpected ID/label/tier.

The generic `Layered - Insane Quality` option is documented separately. It remains because the prompt explicitly said not to remove it without reporting first, and it does not prevent the family-specific Insane presets from appearing.

## Browser verification

Using the real browser UI at `http://localhost:3000`, the expanded preset list showed all required labels and each was selectable:

- Layered - Flat Color, Medium Quality, High Quality, Insane Quality.
- Photo Many Colors, Medium Quality, High Quality, Insane Quality.
- Layered - Detail, Medium Quality, High Quality, Insane Quality.
- Filled Layers - Separate Colors, Medium Quality, High Quality, Insane Quality.

The default high-fidelity browser smoke also reconfirmed preserved default Flat behavior:

| Fixture | Preset | SVG bytes | Groups | Paths | Engine | Copy/download parity |
|---|---|---:|---:|---:|---|---|
| IMG_8846.JPEG | Layered - Flat Color | 1,445,871 | 32 | 590 | vtracer | pass |
| IMG_9404.JPEG | Layered - Flat Color | 1,190,347 | 32 | 370 | vtracer | pass |

## Default vs Medium vs Insane

Previous manual artifacts showed Medium generally improves card text, linework, border continuity, and color richness over Default on the card fixtures. The highest tier adds more paths, more segments, full 2048-sized tracing, and visibly sharper fine detail on the same fixtures.

Correction-B did not rerun the full visual contact-sheet matrix after restoring family-specific labels. The family-specific Insane presets are additive and use the same highest-fidelity contract: max 32 editable colors, preserved dimensions, larger output allowed, editable grouped layers, and copy/download parity.

## File-size judgement

Prior highest-tier card outputs ranged from about 2.57x to 3.30x input size in the manual review artifacts. That increase is acceptable for an opt-in highest-quality mode, but the user must visually decide whether the improvement is worth it for their fixtures.

## Regression notes

- Default preset IDs and labels are preserved.
- Medium preset IDs and labels are preserved.
- High preset IDs and labels are restored.
- Insane preset IDs and labels are additive.
- No preset IDs were renamed in Correction-B.
- No SVG outputs exceeded the 32 editable color ceiling in the browser smokes.
- Simple-image compactness and existing 8 Color/Poster guardrails passed the relevant smoke/audit checks.

## Recommendation

- Ready for user manual testing: yes.
- Ready for merge: no.
- Needs revision: not from automated checks, but user visual approval is still required before merge.

## Remaining risks

- Insane Quality can be slow and large by design.
- The generic `Layered - Insane Quality` and `Layered - Flat Color (Insane Quality)` currently share settings intentionally; the audit allows only that documented pair.
- Family-specific Insane visual value should still be judged from real contact sheets before merge.
