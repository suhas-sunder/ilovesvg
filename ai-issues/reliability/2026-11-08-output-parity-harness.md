# JPG preset output-parity investigation

Status: VALIDATED — initial mismatch was a browser-audit result-selection race, not a demonstrated tracing regression.

The original broad baseline and candidate reports each cover 65 route/scenario outputs. Sixty-four downloaded SVGs match exactly. The JPG Potrace-preset scenario differs: baseline `f03214845805198d161e9353b0057e29c8fbd42cc5ee8fd350845e6ecc5e31c1` (11052 bytes), candidate `24e1ba305c8f66b3ddfe8a2be5f78d9888fa7dc6d0c6bb0c4893a7a39e446584` (10862 bytes). These original reports were preserved unchanged; the mismatch must not be silently waived.

## Root cause

The test uploads JPEG, which automatically starts the `scan-clean` preset, then selects `line-clean`. Both engines are Potrace. The original `waitForOutput` accepted any completed Potrace card, including the earlier `scan-clean` result. Copy/download actions then independently chose the first available button, allowing the sampled result to change between readiness and download. The original baseline's Potrace-preset hash equals its default `scan-clean` output hash. Two repeated focused candidate runs under the original harness also downloaded the stale 11052-byte result.

## Correction

The existing browser harness now checks the selected preset label and, where hybrid debug evidence exists, a conversion started after the preset selection with a successful completion. It correlates stable job IDs for newer cards, or completion time and creation stamp for legacy cards without job IDs. An in-flight consumer can correlate its shared producer's same-key completion. Copy/download actions are scoped to that exact output stamp. Reports record expected preset, preset ID, intended/completed client run IDs, completion time, actual card job ID/status/stamp, and heading. This changes test synchronization, not tracing parameters or application behavior.

## Same-input / same-settings comparison

The corrected harness ran twice against an isolated original `f53292e` production build on port 3001 and twice against the candidate production build on port 3000. All four runs identify `line-clean`, a successful matching client run, a succeeded card headed `Output 1 - Lineart - Clean`, and a card stamp at or after the matched completion. Legacy JPG cards have no job ID, which is explicitly recorded as null rather than invented.

All four intended `line-clean` downloads are **10862 bytes**, SHA-256:

`24e1ba305c8f66b3ddfe8a2be5f78d9888fa7dc6d0c6bb0c4893a7a39e446584`

Evidence reports (ignored local QA artifacts):

- `tmp/baseline-jpg-parity-corrected-1.json`
- `tmp/baseline-jpg-parity-corrected-2.json`
- `tmp/candidate-jpg-parity-corrected-1.json`
- `tmp/candidate-jpg-parity-corrected-2.json`

Additional harness compatibility checks pass for homepage Potrace selection and PNG VTracer selection. `node --check scripts/hybrid-browser-smoke.mjs` passes. This focused comparison resolves the one identified broad-run mismatch with actual same-preset output evidence. It does not retrospectively claim that all 65 original scenarios enforced preset ownership.
