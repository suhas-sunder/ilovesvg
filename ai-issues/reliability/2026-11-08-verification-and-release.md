# Reliability verification and release record — November 8, 2026

Status: VALIDATED for the targeted local reliability scope and PUSHED to draft PR https://github.com/suhas-sunder/ilovesvg/pull/3. Existing quality/snapshot failures remain reported. No production deployment is claimed.

## Verified behavior

- Terminal server errors no longer start duplicate conversion requests. Executable hook tests cover handled 400/403/413/415/429/500/502/503/504 payloads, cancellation during hashing, deduplicated consumers, late/canceled output and preserved Retry-After.
- Eight owner routes no longer create automatic retry storms. Real-browser negative controls on the original build reproduced two POSTs for one permanent 415, and 58 intercepted synthetic BUSY responses in 30 seconds. The candidate sends one POST and displays manual retry/wait guidance. Those controls did not perform 58 native conversions and did not target production.
- PNG-owner oversized preparation reads headers first, preserves valid inputs unchanged, normalizes bounded over-limit files locally, preserves alpha/orientation/aspect ratio and prevents parallel oversized decode. Twenty-five actual route cases pass across desktop Chromium/Firefox/WebKit and mobile Chromium/WebKit emulation, including replacement mid-normalization. Unsafe declared pixels and DNG are rejected with zero decode/POST. Module-level browser cases also exercise the HTML image fallback.
- Server gate queued cancellation is opt-in; home and PNG actions now pass request.signal. Active native work retains its slot. No server ceilings or concurrency were increased.

## Output preservation

The original production-build baseline and candidate each completed 65 existing hybrid-browser scenarios. Sixty-four broad downloaded SHA-256 signatures match exactly. The remaining JPG scenario exposed the audit selecting an earlier default result instead of the requested preset; corrected same-job/preset runs twice on each isolated build produce identical 10862-byte SVGs. See the dedicated output-parity-harness report; original reports remain unchanged.

The high-fidelity browser suite ran 18 scenarios on each build and reports the same 39 existing quality failures. All 17 unique downloaded SVG files are byte-identical by SHA-256, with matching path/color/geometry and rendering metrics. Rendered comparison sheets were visually inspected. This demonstrates preservation of this corpus, not high quality for every source. Known problems include text/detail loss, coverage expectations and high-tier preset-family collapse. No tracing-engine replacement, preset/default tuning or quality-threshold relaxation was attempted.

Reproducible parity check (local ignored reports):

```
node scripts/reliability-output-comparison.mjs tmp/baseline-hybrid-browser-smoke-report.json tmp/candidate-hybrid-browser-smoke-report.json tmp/baseline-high-fidelity-report.json tmp/high-fidelity-browser-output-smoke/report.json tmp/baseline-jpg-parity-corrected-1.json tmp/candidate-jpg-parity-corrected-1.json
```

## Validation ledger

PASS: npm run typecheck; npm run build; npm test (now includes test:reliability); node --check server.js; git diff --check; test:conversion-actions; test:conversion-cache; test:trace-engine; test:trace-quality; test:queue; test:queue-browser; test:input-compatibility after its rendered-input audit correction; test:seo; test:schema; test:routes; test:route-coverage; test:production-logging; test:monetization; test:monetization-browser; test:raster-to-svg-family; test:svg-compression; test:docs; test:links; test:non-tracing-svg-utilities-browser; test:weekly-seo.

Actual broad browser coverage: 65 hybrid scenarios including copy/download/preview and batch ZIP; 29 non-tracing routes with 98 viewport measurements plus ten redirects; monetization browser checks 15 no-ad, ten documentation and 35 contextual route/viewport cases with no console messages. The ad suite is a regression check, not a guarantee of genuine ad-network policy safety. Advertising source/lifecycle was untouched. Final negative/fallback checks pass 30 cross-browser cases plus four network/proxy classifications and ten accurately injected worker-failure/cancellation repeats; screenshots were inspected. The final per-consumer metadata correction also proves one outline history card per POST in Chromium, Firefox and WebKit. These metadata-only changes were followed by a production rebuild, typecheck and full npm test; tracing mathematics remain unchanged.

Existing non-green suites: high-fidelity browser has 39 baseline failures; non-tracing family, SVG-to-PNG preservation, Cricut family and specialized family encounter historical pinned nav/manifest references. Those protected files are unchanged against fetched main. The specialized test permits only the intentional exact BUSY-message correction and retains every other preservation assertion. No broad baseline reset was made. Vite retains its existing chunk-size and mixed-import warnings.

## Memory / resource evidence

Baseline native-memory audit PASS; initial candidate run during simultaneous heavy browser suites FAIL (failed-input RSS floors 265.5, 265.0, 285.1 million bytes breached the rising-floor assertion). An isolated candidate rerun PASS with unchanged tests and limits: 74 completed jobs, 22 failed jobs, one client cancellation, output parity true; zero active jobs and zero waiters at long idle. Baseline final RSS was 333307904 bytes; candidate isolated final RSS 319172608 bytes. These are local Node/Windows allocator observations, not a measured improvement or a production Droplet forecast. Sharp remained concurrency one, cache ceiling 16 MiB/32 items. Local-normalization admission budgets are conservative estimates, not measured physical iPhone peak-memory guarantees.

## SEO, ads and data boundaries

No existing route path, route registration, manifest, sitemap, canonical, robots, structured-data or ordinary SEO copy changed. Technical recovery messages changed to match implemented behavior. Existing owner README retained. No new SEO page or staged content is exposed through app/public imports, SSR, links or navigation. Ad components/policy/root lifecycle unchanged, no ad scripts or third-party services added. Public GitHub repository permits standard public Actions runners without a new paid scheduler. The weekly draft pipeline remains inactive until merged to main; all candidates are unapproved and undated, so it is a no-op even after installation until a reviewed candidate is eligible.

Read-only PostHog project 289839 provided diagnostic event counts. Event schema/taxonomy was checked first. Queries used `event = 'tool_engagement' AND timestamp >= now() - INTERVAL 28 DAY`, grouped by route_path/tool_action; the country/device slice additionally selected only US, CA, GB, AU, NZ. These rolling observations were obtained on November 8, 2026. They are event counts, not users, sessions, funnels, conversion rates, SEO attribution or revenue. No raw event rows, uploaded artwork, filenames, private labels or user IDs were retrieved. The schema lists no recent conversion_failed events and exception autocapture is off, so failures cannot be diagnosed from absent error events. GSC returned subscription_required; no paid access was purchased.

## Production / deployment boundary

One tiny public synthetic server conversion returned HTTP 200 and SVG. Production origin host/process identity, source SHA, proxy controls, rollback and deploy credentials remain unknown. The named DigitalOcean Droplet cannot be verified from this session. A push or PR is not a deployment. No production deployment or main merge is authorized by successful local tests alone when these gates are missing. Preserve production until the blocked identity/rollback gate and relevant quality acceptance are resolved.

## Artifacts and rollback

Synthetic screenshots, baseline/candidate downloads, reports and logs intentionally remain in ignored tmp/ or the OS temporary directory for review; temporary root log files were moved under tmp/reliability-logs. No owner-uploaded artwork was present. The detached baseline server was stopped after the comparison. Automatic approval review rejected cleanup of the temporary .tmp/reliability-baseline worktree with the stated reason blocked by policy; the worktree and its dependency junction are preserved, and no alternate deletion was attempted. Revert the focused technical commit(s) to roll back; no schema, storage or infrastructure migration exists. Guidance correction and weekly workflow are separate reversible commits. Production remains unchanged.


## Commit and remote record

- Starting source / production-rollback candidate reference: f53292e1551a714c884103d1e0bc5e5c2172f1f1. It is a source rollback reference, not a proven deployed SHA.
- 29c5c14: separate misplaced guidance correction/history preservation.
- 1b427d0: raster preparation, fallback/cancellation/request ownership, queued abort, focused tests and evidence.
- 712a6ae: draft-only weekly pipeline, unapproved off-route planning drafts, approval boundary and test wiring.
- Final checkpoint commit: contains this report and CURRENT-STATUS; use the branch/PR HEAD for its exact identity.
- Branch: codex/reliability-hardening-2026-11-08. Draft PR: https://github.com/suhas-sunder/ilovesvg/pull/3.
- Remote main was re-fetched at f53292e before push. No shared branch was force-pushed. No production deployment, restart, schema change, cost increase or SEO publication occurred.
- Scheduled GitHub workflow is not active until installed on main; no candidate is currently eligible even after installation. CI bootstrap validation status is checked separately from production verification.
