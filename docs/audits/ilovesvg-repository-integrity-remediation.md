# iLoveSVG repository-integrity remediation

## Milestone scope

- Starting commit: `b14062890e9509d7afccfdce0b539340ddadcb19`
- Branch: `milestone/repository-integrity-remediation`
- Scope: public trace presentation, exact hybrid server-response correlation, server-fallback lifecycle ownership, and an authoritative repository validation gate
- Explicitly out of scope: routes, redirects, canonicals, sitemap membership, metadata migration, source-route content migration, converter algorithms, presets, output bytes, deployment, and All Tools

The branch was created directly from the validated starting commit after confirming that local `main` and `origin/main` matched it, the default remote branch was `main`, and the worktree was clean. The milestone is closed as one coherent completion commit after final local and detached clean-worktree validation; no earlier milestone commit or remote milestone branch existed.

## Confirmed defects and root causes

### Public trace presentation

The prior warning helper detected `vtracer`, `potrace`, `backend`, or `parity` and replaced the entire warning with one generic sentence. That discarded dimensions, limitations, fallback reasons, detail changes, and retry guidance. The prior trace-path helper also returned `Clean shape trace` for every unrecognized value, falsely assigning a known method to missing or future values.

The correction is a finite presentation-only translation module:

- Known engines map exactly to `Detailed color trace`, `Centerline stroke trace`, or `Clean shape trace`.
- Known current path categories map exactly to outcome-oriented labels, including `SVG cleanup` and `Automatic trace`.
- Missing, malformed, unknown, and future method/path values return `Trace method unavailable`.
- A finite ordered list replaces only known implementation terms within warnings. The rest of each warning remains intact.
- The rendered warning list deduplicates translated messages and retains the existing maximum of three visible warnings.
- Internal payloads, diagnostics, enum values, logs, and converter engine identifiers are not mutated.
- Public warning data attributes use the same translated list as visible warnings so raw implementation identifiers are not exposed in rendered output.

Focused coverage verifies all known engines and path categories, neutral unknown behavior, identifier-only and actionable warnings, dimensions, quality, detail and retry guidance, multiple internal terms, deduplication, the three-warning cap, immutable inputs, prohibited-term removal, and production consumer integration.

The final rendered-output review found one additional presentation defect in the hybrid hook: the hook still replaced its locally retained fallback reason with the old generic compatibility sentence before adding it to the result. The hook now passes that reason through the same finite public translator. A production-browser check on `/png-to-svg-converter` rendered the actionable clean-shape consistency reason in both the visible warning and public warning attributes, retained the internal engine value only in its existing diagnostic attribute, exposed none of the prohibited warning terms, and produced no console warning or error.

### Server-fallback lifecycle

The prior hybrid hook stored a server-fallback promise in a pending map, but cancellation and supersession only canceled the local client/in-flight handle. They did not deterministically reject and remove the pending server waiter. A missing response run ID could also resolve the sole pending waiter, which was unsafe ownership matching.

The final correlation review found a second direct defect: 32 of the 38 production route actions using `useHybridTraceFetcher` did not return `clientRunId`, while the other six omitted it from some validation, rate-limit, busy, or structured error responses. Exact matching in the corrected hook could therefore leave a valid fallback waiter pending on those routes.

All hybrid fallback submissions now carry a bounded, validated correlation ID in an internal POST action query. A shared action-response wrapper returns that exact ID and an internal correlation marker for every JSON success or structured failure while preserving status, status text, headers, error wording, and conversion data. Direct JSON responses embed correlation without reparsing large SVG output; only pre-existing helper-generated structured responses require the small response decoration path. Missing or malformed IDs remain uncorrelated and cannot resolve a waiter. This does not add a public GET parameter, route alias, navigation state, redirect, canonical behavior, or visible correlation copy.

The correction introduces an explicit per-run lifecycle:

- Cleanup is idempotent and has one of five finite reasons: completed, failed, canceled, superseded, or unmounted.
- Each run owns at most one abort controller, one in-flight consumer, and one current awaited operation.
- The active-client-job count increments once and the lifecycle cleanup callback decrements once.
- Pending server waiters settle exactly once, remove themselves from the component-owned map, and detach their abort listener.
- Server responses resolve or reject only the exact `clientRunId`; missing and unknown IDs never fall back to another waiter.
- All 38 relevant production actions return the exact ID on success, validation error, conversion error, busy, rate-limit, and other structured JSON failures.
- Cache-key mismatches fail the matching waiter rather than writing under the wrong key.
- Correlated raw fetcher responses carry a finite internal marker and are never exposed as active data; the run-owned promise supplies the accepted result. No obsolete-ID registry is retained.
- Cache writes occur only for the current run or an operation that still has a valid shared consumer.
- A newer submission joins matching in-flight work before superseding the older consumer, preserving intentional conversion deduplication.
- One shared consumer may cancel without aborting work still owned by another consumer; final-consumer cancellation aborts the shared local operation.

Cancellation means local ownership and waiter cleanup. React Router's fetcher API used here does not provide a supported way to cancel the already-submitted server request, so the implementation does not claim that request was canceled. A late response may still arrive, but exact-ID matching and obsolete-run suppression prevent it from becoming active, resolving another waiter, or writing stale cache data.

Deterministic controlled-promise coverage includes browser success, client failure with server success, server error, cancellation before and after fallback, cancellation while waiting, same-key supersession, late success, late error, unmount, two shared consumers, single- and final-consumer cancellation, repeated cleanup, exact-ID matching, zero active jobs, zero pending waiters, zero in-flight entries, and no stale cache or active data. A production-server smoke audit separately exercises structured validation failures across all 38 route actions.

## Authoritative validation contract

`npm test` remains the fast existing converter core:

- conversion-cache audit
- trace-engine audit
- trace-quality smoke

`npm run test:ci` is the authoritative deterministic repository gate. Unless the caller explicitly reports that the two steps already passed, it begins with typecheck and production build. It then runs:

- the existing `npm test`
- CI configuration audit
- public trace presentation audit
- server-fallback lifecycle audit
- client lifecycle audit
- output UX audit
- preset identity audit
- navigation source audit
- memory-diagnostics audit
- bounded-store audit
- route-expansion integrity audit
- production-logging audit
- production manifest-bundle audit
- production server-fallback response-correlation audit
- conversion-action audit
- public-content/schema remediation audit
- route-coverage audit
- schema audit
- SEO audit
- SVG-to-PNG preservation source and rendered-route audit

The aggregate reserves an available loopback port, starts the production server, verifies the iLoveSVG homepage, passes its base URL only to server-dependent audits, writes the route-coverage report under the operating-system temporary directory, and stops the server and removes the entire temporary directory on success or failure.

The SVG-to-PNG preservation script still runs its complete Chromium parity and responsive matrix by default. The aggregate sets an explicit CI-only flag to skip only that browser-dependent subsection because a clean GitHub Ubuntu runner is not guaranteed to contain the locally detected Edge/Chrome executable used by the repository's CDP harness. The script reports this exclusion rather than silently treating the partial mode as full parity.

Run the broader browser matrix manually from a built production application with an installed Chromium-family browser:

```text
npm run test:svg-to-png-preservation
npm run test:svg-to-png-responsive
node scripts/converter-parity-audit.mjs
npm run test:navigation-browser
npm run test:responsive
```

The GitHub Actions workflow runs on pull requests targeting `main` and pushes to `main`. It uses official checkout and Node setup actions, Node 20, the package lock through `npm ci`, npm dependency caching, read-only repository contents permission, concurrency cancellation, a 45-minute timeout, and required typecheck, build, and `test:ci` steps. Environment markers prevent the aggregate from repeating the workflow's already-completed typecheck and build. The workflow uses no secrets, deployment step, artifact upload, or third-party action.

## Files changed

### Production

- `app/client/lib/converter/publicTracePresentation.ts`
- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/BespokeTraceOutputPanel.tsx`
- `app/routes/home.tsx`
- `app/routes/png-to-layered-svg-for-cricut.tsx`
- `app/client/lib/tracing/hybridTraceFallbackLifecycle.ts`
- `app/client/lib/tracing/useHybridTraceFetcher.ts`
- `app/client/lib/converter/inFlightConversionDedupe.ts`
- `app/shared/tracing/traceResponseCorrelation.ts`
- All 38 existing route modules that call `useHybridTraceFetcher`, changed only to use the shared correlated action wrapper and correlated JSON responder

### Audits and validation

- `scripts/public-trace-presentation-audit.mjs`
- `scripts/server-fallback-lifecycle-audit.mjs`
- `scripts/server-fallback-response-correlation-smoke.mjs`
- `scripts/client-lifecycle-audit.mjs`
- `scripts/conversion-cache-audit.mjs`
- `scripts/public-content-schema-remediation-audit.mjs`
- `scripts/svg-to-png-preservation-audit.mjs`
- `scripts/hybrid-browser-smoke.mjs`
- `scripts/ci-audit.mjs`
- `scripts/ci-configuration-audit.mjs`
- `package.json`
- `.github/workflows/repository-validation.yml`
- `docs/audits/ilovesvg-repository-integrity-remediation.md`

The conversion-cache audit now guarantees operating-system temporary-directory cleanup through both explicit completion cleanup and an exit handler. Existing production behavior is unchanged.

The hybrid browser helper now matches either an element's accessible name or its visible text. This corrects a locator defect where nested visible labels were concatenated (for example, a preset name plus its badge) and a valid accessible name was ignored. It does not relax any output, ownership, or lifecycle assertion.

## Validation record

Completed focused checks:

- Public trace presentation audit: passed.
- Server-fallback lifecycle audit: passed.
- Client lifecycle audit: passed.
- Conversion-cache audit: passed.
- TypeScript typecheck: passed.
- Production build: passed with the existing Vite mixed-import and chunk-size warnings.
- Public-content/schema remediation audit: 87 of 87 checks passed after updating its stale assertions to the finite presentation module and hybrid fallback reason.
- `npm test`: passed after its trace-engine architecture assertion was updated to require the new public translator rather than the removed generic sentence.
- Authoritative `npm run test:ci`: passed all 20 repository checks end to end, including the production response-correlation smoke across all 38 hybrid route actions.
- Full converter parity audit: passed with zero failures across all sections. It covered 17 generated/deterministic fixture summaries, preset collisions, JPG/JPEG behavior, PNG wrapper behavior, all nine SVG-to-PNG routes and seven SVG fixtures, all 63 SVG-to-PNG responsive route/viewport rows, resizers, and favicon output.
- Full SVG-to-PNG output parity: nine routes and all seven deterministic SVG fixtures passed with byte-identical and pixel-identical route output, unchanged dimensions, alpha behavior, backgrounds, filenames, defaults, invalid-input behavior, preview/download behavior, reset, and second upload.
- SVG-to-PNG responsive audit: nine routes across seven viewports, 63 route/viewport rows and 477 rendered states passed. The maximum measured document scroll width was 1265 CSS pixels at the 1280-pixel viewport (the 15-pixel difference is the browser scrollbar); screenshots and downloads retained: false.
- Navigation browser audit: passed at 320, 360, 390, 430, 768, 1024, 1280, 1440, 1600, and 1920 CSS pixels.
- Generic responsive audit: passed.
- Focused production warning rendering: passed with actionable translated output and no browser console warning or error.
- Workflow YAML lint and the focused CI configuration contract: passed.
- `npm ci --dry-run --ignore-scripts`: passed, confirming the lockfile install contract without changing the lockfile.
- Script syntax: all ten changed or added `.mjs` scripts plus `server.js` passed `node --check`.
- UTF-8, trailing whitespace, `git diff --check`, personal-path, credential-pattern, generated-artifact, and ignore verification passed across the complete 60-file milestone.
- All Tools source, `Dockerfile`, `server.js`, `package-lock.json`, and the memory-diagnostics implementation are byte-for-byte identical to the starting commit. Memory diagnostics remain disabled by default, and the memory/bounded-store audits passed.
- Detached clean-worktree validation: a real `npm ci` installed 360 packages from the unchanged lockfile, then typecheck, production build, all 20 deterministic repository checks, and the focused presentation/lifecycle audits passed. The first clean run exposed a Windows line-ending portability defect in the SVG-to-PNG unchanged-content hash audit; that audit now canonicalizes only CRLF/CR to LF before hashing fixed baseline content, so semantic changes still fail while clean checkouts no longer produce false failures.

One long-running queue browser smoke scenario remains inconclusive in this local environment: the newer job completed and became active while the older job remained non-active with correct source ownership and no console errors, but the older 2200-by-1100 detailed trace did not finish within the audit's existing 100-second budget. The timeout and lifecycle assertions were not loosened. Deterministic controlled-promise coverage for cancellation, shared work, supersession, late success/error responses, and zero remaining lifecycle ownership passed.

An earlier combined output-plus-responsive parity rerun completed the full output section successfully, then its long-lived browser connection emitted an `ErrorEvent` as the responsive section began. A fresh dedicated responsive process immediately passed the complete 63-row/477-state matrix, and the subsequent fresh all-sections converter parity run also passed with zero failures. The transient harness event did not reproduce and was not an application regression.

The final handoff should use the latest working-tree status and command record rather than treating this section as a substitute for the final validation report.

## Preservation and privacy

No route registration, redirect, canonical, sitemap membership, metadata ownership, route content ownership, preset, setting, default, accepted input, validation limit, converter algorithm, tracing engine, filename, output byte, output quality, history ownership, deployment configuration, or memory-diagnostics default is intentionally changed.

All Tools is outside the implementation scope and its source is byte-for-byte identical to the starting commit. Browser screenshots, profiles, downloads, reports, parity output, coverage, logs, and temporary fixtures remain ignored and untracked. Validation uses only ignored build output and operating-system temporary storage. The exact current-run parity, hybrid-browser, and navigation-browser temporary roots were removed after validation; older unrelated operating-system temporary data was not touched. The milestone documentation contains no personal absolute path, secret, credential, or environment value.

## Limitations

- GitHub Actions itself cannot be executed locally. Workflow syntax and semantics are checked locally; the first hosted run remains the final runner-environment confirmation.
- The detached clean-worktree validation uses the committed milestone tree and is removed and pruned before push.
- The authoritative default CI job excludes desktop-browser matrices that depend on an installed local Chromium-family executable. Those matrices remain explicit manual milestone gates and are not weakened.
- The fetcher-submitted server request may continue after local cancellation; only component-owned state, waiters, in-flight consumers, cache writes, and result activation are canceled or suppressed.
