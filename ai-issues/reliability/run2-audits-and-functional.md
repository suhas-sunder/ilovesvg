# Run 2 — historical audit repair and actual utility workflows

Status: IMPLEMENTED and LOCAL VALIDATED for test tooling; no application changes, commit, merge or deployment by this subtask. Starting PR source was c2d7d90, current remote main f53292e1551a714c884103d1e0bc5e5c2172f1f1. Other agents' concurrent application changes were preserved. Browser runs used the parent's local production-build server at localhost:3000, not production or private incident originals.

## Historical failures: root cause and narrow correction

All four suites had frozen whole-file/hash checks for navigation and/or the route manifest. Comparing their historical starting refs with current main found exactly two later-approved file changes: commit df4dca0 added the AVIF guide (28 lines) to OtherToolsLinks and updated the AVIF description in routeManifest. Those changes predate PR #3; neither file changed in its reliability commit. They are not a product regression introduced by this run.

| Suite | Immutable historical baseline retained | Before | After |
| --- | --- | --- | --- |
| non-tracing-svg-utility-family | 59053aaffa3bb5e96d03bd0e77976eff3dfcec11 | stale All Tools whole-file comparison failed | PASS |
| cricut-output-route-family | 7d431cdd0948bf5686bf491347f8ff126dfbcfa0 | stale manifest comparison failed | PASS |
| specialized-trace-route-family | b89d4c005fea126866bd0121f1de26d289bf4d86 | stale manifest comparison failed | PASS |
| svg-to-png-preservation | existing immutable content/output hashes | stale All Tools hash failed | PASS, including existing browser/output gates |

The correction does not substitute a new hard-coded approved SHA. `current-main-preservation-contract.mjs` resolves an explicit release baseline (`AUDIT_BASE_REF`, default `origin/main`) and records the exact SHA. Only the two legitimately changed shared files use current-main-versus-candidate comparison. Every other historical protected-file, algorithm/default, public-string, route owner, redirect, and golden output assertion stays intact. Historical starting refs and the old All Tools hash remain in the scripts/reports as evidence.

The shared helper also parses the literal manifest and navigation AST into behavioral contracts: 157 unique routes, real canonical targets, self-canonical indexable entries, no indexable/sitemap-listed redirects, direct redirect destinations, and 229 public navigation links with real registered public destinations. Five adversarial cases reject duplicate paths, missing canonicals, invalid navigation, indexable redirects and redirect chains. A new candidate change to either protected file fails comparison against the explicit current main; approving a broader change still requires deliberate review.

This fixes obsolete audit scope, rather than masking an output failure. The SVG-to-PNG suite proceeded through all original contracts: seven fixtures across nine canonical family routes (63 fixture/route results), byte and rendered-pixel parity, immutable original PNG hashes, alpha/background behavior, malformed input rejection, clear/replacement lifecycle, and mobile/responsive checks. No frozen PNG expectation was changed or removed.

## Actual user workflow checks

New `non-tracing-functional-browser.mjs` complements the existing DOM-only family sweep. It uses deterministic synthetic SVG art, real file upload, visible controls, actual browser clipboard and actual downloaded file bytes. It runs Chromium at desktop 1280 and mobile-width/touch 390; this is not physical iPhone or full mobile Chromium emulation. Optional Playwright tooling is supplied externally through `PLAYWRIGHT_MODULE`, with `UTILITY_CHROMIUM_EXECUTABLE` when needed; no dependency was added.

All 14 route/viewport cases PASS:

| Tool | Executed workflow and substantive output check |
| --- | --- |
| SVG to PNG | upload → preview/output → download; 120×80 PNG, transparent outside pixel and exact red artwork pixel preserved; 919 bytes |
| SVG to PDF | upload → Settings → Convert → inline preview/download; 4675-byte real one-page PDF, 120×80 embedded lossless image decoded to verify source red artwork pixels (not merely a valid blank page) |
| SVG minifier | upload → Tiniest → download + copy; 208-byte SVG renders byte-identical raw pixels to source; actual copied code matches download |
| SVG resize | upload → Settings → change width to 240 → download; resulting SVG metadata is 240×160 with preserved aspect ratio |
| Favicon generator | upload → Generate → ICO download + ZIP download; valid ICO header/seven entries; ZIP contains 21 decodable square PNGs and an ICO |
| SVG to JSX | upload → edit Component name to FunctionalIcon → actual copy + TSX download; viewBox/strokeWidth and edited component name present; 350 bytes |
| SVG to Base64 | upload → edit output format to Base64 only → copy + download; decoded SVG retains source fill and stroke geometry; 280 bytes |

No page/hydration exceptions or horizontal overflow occurred in the 14 final cases. PNG, minified SVG, JSX and Base64 output signatures match between the two viewport runs. PDF uses document metadata and is checked by artwork/page content rather than a nondeterministic whole-file hash. Screenshots were captured for every case; representative mobile favicon and desktop PDF screenshots were visually inspected using the image tool.

## Failed test attempts and resolution

The first functional harness tried interactions before async upload/hydration settled and used `[type=text]` for a JSX input whose actual HTML omits the optional type attribute. Some clicks produced no download or disabled controls; this was not declared a product defect. Isolated original-versus-test-deferred object-URL revocation controls all passed four real minifier/resizer downloads, withdrawing the initial synchronous-revocation suspicion. The harness now waits for network/hydration and parsed-source readiness, then uses the accessible Component name label. Windows clipboard copy converts LF into CRLF; JSX comparison normalizes only that platform newline conversion, preserving every code character. Final full 14-case rerun passes. No application fix was justified from those initial harness failures.

## Evidence and reproducibility

Commands run and passing:

- `node scripts/current-main-preservation-contract-test.mjs`
- `npm run test:non-tracing-svg-utilities`
- `npm run test:cricut-output-family`
- `npm run test:specialized-trace-family`
- `npm run test:svg-to-png-preservation`
- `node scripts/non-tracing-functional-browser.mjs` with the optional external browser module/executable variables
- Node syntax checks for new helpers/browser script; scoped `git diff --check`

Logs are intentionally retained under ignored `tmp/run2-family-audit/` (before, after and final results, including failed attempts). Synthetic outputs, the final 14-row JSON report and screenshots are under the OS temporary `ilovesvg-utility-functional-browser` directory. No private source image, EXIF or location data was read, committed, logged or uploaded. The forbidden cleanup of `.tmp/reliability-baseline` was not attempted.

Changed files owned by this subtask: the four historical audit scripts; `scripts/current-main-preservation-contract.mjs`; `scripts/current-main-preservation-contract-test.mjs`; `scripts/non-tracing-functional-browser.mjs`; this report. No application, route, metadata, canonical, sitemap, tracing engine, settings default, advertising lifecycle or infrastructure changed. Parent owns repository-wide typecheck/build/release validation and commit decisions.

Remaining limits: fourteen representative workflows are not a complete functional test of every tool option or batch mode. The PDF test verifies embedded artwork and page count, not a calibrated print result. The favicon test verifies container/output content and PNG sizes, not every platform import. Physical-device behavior and production resource limits remain separate release gates.