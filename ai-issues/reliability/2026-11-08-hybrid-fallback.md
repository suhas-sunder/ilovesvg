# Hybrid fallback and overload recovery — November 8, 2026

Status: VALIDATED locally against the final production build, including actual Chromium/Firefox/WebKit workflows. Production deployment remains BLOCKED pending the managing engineer’s operational release gates; do not infer deployment from this report.

Starting repository source: f53292e (origin/main). The worktree was initially clean. Changes use the existing hybrid hook and route controls. No tracing mathematics, engine defaults, output geometry, route paths, metadata, canonical, sitemap, advertising, or paid infrastructure changed in this milestone.

## Confirmed defects and corrections

1. A browser failure submitted a server fallback through the cache waiter. When the action returned an error, the waiter rejected with an ordinary Error; the outer browser-error catch submitted the same server request again. The executable baseline test observed **two submissions for one permanent server rejection**. A typed terminal server failure now preserves the response payload (including error code, Retry-After, and consumer identity) without submitting it again. Invalid server output is terminal too.
2. Cancellation during asynchronous file fingerprinting had no registered cancel handler. Cancellation now takes effect before hashing finishes and prevents tracing or fallback from starting.
3. Cancellation after a server fallback started did not settle its cache waiter. Aborting the last consumer now releases that waiter and active count. Late canceled server output is suppressed, including legacy responses without a clientRunId. The single fetcher's current server identity is retained; canceling an unrelated browser job cannot unhide an old canceled response. Native server computation is not claimed to stop when the browser cancels.
4. Eight routes repeatedly resubmitted BUSY responses without a retry cap, including closures holding earlier file/settings. They now display the server rejection and rounded-up wait guidance, then allow the existing Convert/Retry controls to recover explicitly. **Automatic retries: zero.** This conservative policy avoids retries of stale/canceled uploads and additional load while overloaded. Server-side limits and Retry-After headers remain unchanged. A request the user deliberately starts too early can still be rejected by the server.

Affected retry effects: /png-to-svg-converter, /jpg-to-svg-converter, /jpeg-to-svg-converter, /webp-to-svg-converter, /logo-to-svg-converter, /scan-to-svg-converter, /image-to-svg-outline, /photo-to-svg-outline. Wrappers reusing these components inherit the behavior. Other routes have the shared-hook correction where they use that hook. The homepage has its own conversion path and is not represented as fixed by this hook change.

## Tests and evidence

Before edits: test:conversion-cache, test:queue, and scripts/client-lifecycle-audit.mjs passed. The new hook regression failed against the baseline with `2 !== 1` for permanent server rejection.

After edits:
- `node scripts/hybrid-fallback-regression.mjs`: actual TypeScript hook transpiled and executed against controlled React/fetcher lifecycle; permanent server errors, early cancellation, pending waiter cancellation, late legacy/id-bearing responses, canceled unrelated jobs, no-cache fallback, successful cache ownership, shared-consumer cancellation, shared error ownership, Retry-After preservation, and deduplication pass.
- `node scripts/server-retry-regression.mjs`: executes the actual recovery callbacks from all eight routes for BUSY and RATE_LIMITED responses; no timers, visible errors, and a 12.5-second delay rounded up to 13 seconds. It also executes image-to-svg-outline success processing and checks retained SVG/history/request identity/dimensions.
- `npm run test:conversion-cache`, `npm run test:queue`, `npm run test:jpeg-active-result`, `node scripts/client-lifecycle-audit.mjs`, `npm run typecheck`: pass.
- Existing PNG browser smoke on the **original baseline build** passed default/server Potrace, VTracer preset, explicit Potrace preset, and centerline preset, including preview/copy/download/update preview. This baseline result is not candidate validation.

A pre-release review caught an overly broad replacement of the image-to-svg-outline combined effect. Its success/history/error processing was restored from baseline; only its retry branch now differs. The new executable outline-history assertion prevents that mistake recurring. Other seven recovery effects were reviewed against baseline and had no co-located output handling removed.

## Capability constraints retained

The shared hybrid hook deliberately does not route an explicitly requested browser VTracer mode or centerline mode to an arbitrary Potrace server action. That preserves output intent. There is server VTracer code in `svgLayerTrace.server.ts`, but it is a specialized compact layered path with different normalization/palette settings; its existence does not establish parity for every explicit browser VTracer preset. PNG's single action returns Potrace output; its layered action uses shared layered tracing. Centerline has a dedicated browser worker and no equivalent action demonstrated here. Unsupported-browser failure for those explicit modes remains an actionable error rather than silently substituting an incompatible engine.

Current browser VTracer admission policy (enginePolicy.ts): 8 MiB, 8 million decoded pixels, 2600px maximum side, supported raster MIME, and required worker/WASM/createImageBitmap/OffscreenCanvas capabilities. These are separate from route server upload/decode limits. Layered high-quality tiers are intentionally server-first. Legacy line-art/logo/scan/cut presets continue using Potrace for output parity.

Representative family capability map (source inspection; only baseline PNG browser modes executed here):

| Entrypoint / family | Browser path | Supported server path / preserved restriction |
| --- | --- | --- |
| /png-to-svg-converter; transparent PNG wrapper | eligible VTracer; centerline preset worker | single Potrace; shared layered adapter; explicit VTracer/centerline errors remain terminal |
| /jpg-to-svg-converter; /jpeg-to-svg-converter; /webp-to-svg-converter | eligible VTracer | route Potrace/shared layered adapter; no new engine substitution |
| /logo-to-svg-converter; /scan-to-svg-converter; /sketch-to-svg-converter; /drawing-to-svg-converter | policy generally preserves legacy Potrace | existing server trace; retry recovery changed only for logo/scan |
| /image-to-svg-outline; /photo-to-svg-outline; /line-art-to-svg-converter | legacy outline/Potrace policy; centerline only where exposed | existing Potrace; explicit centerline never silently replaced |
| /image-to-layered-svg-for-cricut; /png-to-layered-svg-for-cricut; /jpg-to-layered-svg-for-cricut; /logo-to-layered-svg-for-cricut; /layered-svg-for-cricut | default eligible layered VTracer | existing layered pipeline/server-first tiers; explicit VTracer restriction retained |
| /png-to-svg-for-cricut; /jpg-to-svg-for-cricut; /jpeg-to-svg-for-cricut; /webp-to-svg-for-cricut; drawing/sketch/line-art/black-and-white variants | compatibility policy preserves Potrace | existing route server action, shared hook terminal-error/cancel correction |
| / | independent homepage orchestration | independent server/batch path; not changed in this milestone |
| SVG raster/PDF exports, SVG editor/resizer/optimizer | separate workflows | outside this hook; no claims of new coverage |

## Remaining limits and release gates

No physical iPhone, production process metrics, DigitalOcean memory measurements, proxy timeout behavior, or production deploy verification was performed by this subtask. JavaScript cannot recover after the OS kills the tab. Network/proxy failures thrown to a React Router error boundary are not the same as a handled action error payload; they need independent browser coverage. Concurrent successful client jobs intentionally remain eligible for their own history entries; route-level ownership determines active selection. A newer server submission on the same React Router fetcher may replace a prior request; this existing architectural constraint is not claimed solved by this focused change.

Rollback: revert the focused release commit once assigned, restoring the shared hook and eight retry effects together. No data migration or infrastructure change is needed. Keep normalization changes as their own review scope when staging commits. No commit, push, or deployment was made by this subtask.

## Historical candidate checkpoint (corrected before final validation)

The first actual production-build browser pass exercised desktop1280 and390px Chromium/mobile emulation. Real supported fallback/preview/download, permanent415 terminal response (one POST after three seconds), cancellation during fallback with a late server response (no resulting output), and image-to-svg-outline history/output/download all passed on both widths. Synthetic429 overload also performed exactly one POST with no background retry, but its wait guidance was hidden because PNG displays `info` only when no error exists. This was a real rendered UX failure, missed by the initial effect-state-only assertion.

The recovery effects now append the delay to the visible error message itself; layout and focus behavior are unchanged. The callback regression now asserts delay guidance in the error field. The rebuilt final candidate repeat below subsequently validated that correction. The durable browser script additionally exercises a forced VTracer worker initialization failure followed by the real compatible server layered action and download. Synthetic error/cancel transport fixtures use the actual React Router single-fetch response protocol (`X-Remix-Response`); they do not simulate production server resource measurements or physical iPhone behavior.


## Final browser and ownership validation

The final production build at localhost:3000 passed all 30 primary cases: Chromium12 (desktop1280 and mobile390), Firefox6 (desktop1280), WebKit12 (desktop1280 and mobile390). Each includes real supported server fallback with decoded preview and SVG download; handled415; handled429 with visible delay guidance and no automatic retry; cancellation with a delayed server reply; and outline conversion/history/download. Every case made exactly one POST, had zero application runtime/hydration errors and zero measured horizontal overflow. Physical iPhone Safari remains unverified.

Actual baseline controls against the isolated original build at localhost:3001 demonstrated two POSTs after one handled415, and **58 POSTs in30seconds** under repeated synthetic BUSY429 replies. Those responses were intercepted by the browser harness and did not run58 native conversions. The final candidate made one POST under the same error conditions. Baseline outline success made one POST but produced two history outputs; final candidate makes one POST and exactly one outline output across all five browser configurations.

Root cause of duplicate outline history: the raw server payload carried the route requestId, but the subsequent mapped hybrid/cache result dropped it. The route therefore treated its second notification as a new result. The hook now captures requestId/presetId from the **current consumer’s original FormData** and attaches them to browser, server, cache-hit and shared-in-flight mapped completions. Identifiers are not copied from a cached prior job. The executable identity assertion first failed with undefined versus request-1, then passed for server success, browser success, cache hit and shared consumers. No SVG mathematics/settings/output bytes changed.

Final screenshot review caught an imprecise test preset selector: the first worker-failure test had selected a Medium Quality server-first preset. The harness now selects the exact default Filled Layers - Separate Colors aria-label and asserts one injected VTracer worker initialization failure whenever browser capabilities permit that worker. A separate final10-case repeat (Chromium4, Firefox2, WebKit4) passed real compatible server conversion/download and cancellation after that verified worker failure, exactly one POST each. The earlier server-first tests are valid fallback checks but are not used as proof of worker failure.

Additional Chromium desktop/mobile transport checks (4/4) aborted a network request or returned an unstructured HTML502 proxy response. Each made one POST and reached the existing React Router error boundary with a Back to the converter link. **These are observed error recovery pages, not successful conversions, automatic fallback, preserved form state, or a new network-handling fix.** Handled JSON/action errors400/403/413/415/429/500/502/503/504 are separately executable-tested as terminal with one submission and retained Retry-After metadata.

The browser harness blocks external ad/analytics requests to isolate application behavior. Earlier local-HTTP WebKit runs produced third-party HTTPS ad-frame cross-origin exceptions; these are recorded as an environment-specific external-script condition, not silently classified as application hydration failures. The test does not change production advertising code or establish genuine ad-network policy compliance. The separate protected advertising validation belongs to the managing engineer. WebKit file injection is synchronized through a real preset control and, only if the original unconsumed file remains attached, an explicit change event; this avoids treating an automation upload-event omission as a converter failure.

Reviewed screenshots: visible390px BUSY wait guidance, desktop error/retry state, canceled mobile output with no late successful SVG, and final WebKit outline preview with exactly one history output. No layout redesign was performed.

Evidence directories intentionally retained outside the repository: %TEMP%/ilovesvg-hybrid-regression-browser/{chromium,firefox,webkit,forced-chromium,forced-firefox,forced-webkit,transport,baseline,baseline-outline}/. Each completed run contains report.json and browser screenshots. Durable test commands: node scripts/hybrid-fallback-regression.mjs; node scripts/server-retry-regression.mjs; node scripts/hybrid-fallback-browser.mjs with PLAYWRIGHT_MODULE and matching RASTER_<ENGINE>_EXECUTABLE. Optional HYBRID_REGRESSION_BROWSER, WIDTHS, SCENARIOS, ROUTE, INCLUDE_OUTLINE and BROWSER_DIR select bounded repeats; the default engine is Chromium. No production dependency is added.
