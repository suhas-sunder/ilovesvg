# Global ad-placeholder safety remediation and first-release handoff

Reviewed November 13–14, 2026. The owner's specific remediation assignment authorizes this correction; the [protected directive](AD-PLACEHOLDER-SAFETY.md) still controls genuine-network acceptance. This report supersedes the **unimplemented local-policy gap** in the Phase 3 handoff, not its remaining production and operational gates.

## Decision and exact source

The narrow correction is **IMPLEMENTED**, **VALIDATED LOCALLY**, **CI VALIDATED**, and **PUSHED** as draft [PR #27](https://github.com/suhas-sunder/ilovesvg/pull/27). No merge or deployment occurred. Actual AdSense rendering is **not PRODUCTION VERIFIED**. Production release remains **BLOCKED** on the external evidence described below.

| Reference | Exact SHA / state |
|---|---|
| Unchanged main | `f53292e1551a714c884103d1e0bc5e5c2172f1f1` |
| Initial technical foundation, PR11 | `c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4` |
| Final proposed release head, PR27 | `ea88da59e1d662bf41579821b6c496a64e905003` |
| Prior corrected Phase 3 application | `abf58b7886338b6d1b07a0501cab7f3bc7eb1b8f` |
| Disposable staged integration used for additional browser testing | `336c7a7a0043cb1bb6c1328ee225fb061e59d81a` |

PR27 is one commit with PR11 as its sole parent. It does **not** depend on PR12 or PR23 and contains no Phase 2 content, sprite utility or rejected checkerboard experiment. The full reports, harnesses and screenshots are saved separately on `codex/ad-placeholder-safety-evidence`; that branch is evidence, not the proposed release head. This separation keeps the six-file candidate and its exact CI immutable. The original E: workspace and prior review branches remain unchanged.

## Changed files

Only these six files differ from PR11 in the release candidate:

| File | Purpose |
|---|---|
| `app/client/lib/monetization/adPlaceholderSafety.ts` | Static first-party bootstrap; one document-scoped observer and monotonic suppression marker |
| `app/root.tsx` | Install that bootstrap before the existing async ad script and hydration; acknowledge the externally owned root attribute |
| `app/client/components/ads/AdsenseDelayed.tsx` | Remove per-slot fill state/polling and the opaque fading overlay; retain request scheduling and reserved dimensions |
| `app/app.css` | Immediate placeholder-only suppression and protection during delayed detection |
| `scripts/ad-placeholder-safety-test.mjs` | Explicit-fill, delayed-record, document-isolation and observer-cleanup regression |
| `.github/workflows/reliability-release.yml` | Include the exact PR11 target branch in the existing read-only CI trigger and execute the new regression |

No dependency, conversion algorithm, preset, publisher/slot identity, consent logic, density, route eligibility, canonical, sitemap, content or server change is included. [Independent boundary evidence](ad-safety/release-boundary-results.json) checks these limits against actual Git trees.

## Original lifecycle and verified defect

All rendered placeholder labels and skeletons originated in `AdSenseDelayed`. The contextual card, documentation ad, tool-grid/footer placements and ultra-wide sidebars reuse it; sidebar instances suppress their own placeholder through `showPlaceholder=false` but can still be the first filled ad. Wrapper backgrounds and reserved space are distinct from the placeholder overlay.

Originally, local `isFilled` reset on effect setup and changed back to false for an unfilled slot. A sufficiently large iframe was also considered filled even without a network fill status. The placeholder used `z-10` and a 200ms opacity transition above an unpositioned creative container. Both engines reproduced an opaque label/skeleton over an actual local mock iframe while observer delivery was held. No global latch existed. Earlier historical assertions that it already existed remain unsupported; this assignment implements it for the first time in this reviewed source.

## Corrected invariant and detection

**After the first explicit ad fill, every advertisement placeholder remains hidden for the lifetime of that document.** No component, route, resize or later unfilled state resets the marker. A fresh document starts a fresh page session; no cookie, browser storage or cross-restart preference is introduced. Back/forward restoration of the same document retains its state.

The static inline bootstrap runs in the document head before the existing asynchronous advertising script, independently of React hydration. One observer watches `data-ad-status` mutations and added/removed subtrees. It recognizes `filled` on an actual `ins.adsbygoogle`, including an old `filled` value when delivery is delayed. It also handles already-filled or detached subtrees. Duplicate bootstrap execution cannot install a second observer. At first fill it sets `data-ad-placeholders-suppressed="true"`, disconnects permanently, and releases the observer reference. There is no reset API or accumulated history.

[Google's status documentation](https://support.google.com/adsense/answer/10762946?hl=en) describes the explicit filled status as an ad returned and displayed. Script loading, a successful queue push, `data-adsbygoogle-status="done"`, pending/unfilled/optimized-empty states and iframe dimensions are not treated as global fill evidence. This documented signal is stronger than the former size guess; mocked status changes still do not verify Google behavior in production.

CSS protects the first paint before observer delivery: an explicit filled slot suppresses all placeholders immediately, and any iframe clears its own local placeholder conservatively while its status is uncertain. An uncertain iframe does not globally claim fill. The placeholder sits behind a positioned creative within an isolated stacking context, with no opacity fade. The persistent root marker governs newly mounted placeholders even when no filled slot remains. Rules target only placeholders, never the `ins`, iframe or reserved wrapper.

React does not own the marker. HTML-level `suppressHydrationWarning` accommodates the externally owned marker; it applies to diagnostics on the HTML element, not exclusively to that attribute, and does not suppress descendant hydration diagnostics. Production-browser tests held application modules, filled then emptied a slot before hydration, and observed continued suppression through hydration without hydration errors.

## Independent finding repaired

PASS A challenged the first post-hydration-only correction. Its CSS handled an early fill but restored placeholders if the slot became unfilled before any React effect had started. Chromium and WebKit reproduced visible → hidden → visible across rendered frames. That intermediate implementation was replaced before commit/push by the early bootstrap above.

Fourteen independent native-DOM cases passed after repair: false-positive controls, early fill/unfilled, same-task fill/unfilled/removal, prefilled subtree insertion/removal, initial scan, duplicate initialization, permanent disconnection, repeated transitions and fresh-document isolation. The [review](ad-safety/independent-lifecycle-review.md), [initial reproduction](ad-safety/prehydration-initial-reproduction.json) and [corrected results](ad-safety/independent-race-results.json) preserve the finding and source hashes. No remaining implementation defect was reproduced by that reviewer.

## Production-build browser acceptance

The main matrix uses exact PR11 at local port 5320 and the exact correction at 5321, in Chromium and WebKit. All off-origin requests are blocked or locally fulfilled. Creatives are harmless local `srcdoc` iframes; no genuine impressions or advertisement clicks were generated. [Browser harness and raw evidence](ad-safety/browser-results.json) record the individual assertions rather than relying on React state.

| Required situations | Observed corrected behavior |
|---|---|
| No script, blocked script, pending request, unfilled slot | Existing empty placeholder may remain; no false global latch |
| First mock fill, delayed second fill, filled plus empty slots | All placeholders suppressed; creative remains visible |
| Previously filled slot becomes unfilled; repeated transitions | Marker remains true; no placeholder returns |
| New slots, route unmount/remount, navigation and Back | Suppression survives across converters, documentation and utilities |
| Mobile/desktop resize and ultra-wide sidebars | Suppression remains; a sidebar with no placeholder can trigger it globally |
| Iframe before a status; observer callback held | Local uncertain iframe protected immediately; explicit fill hides all synchronously |
| Fast navigation, same-task fill/unfilled/removal | Historical fill evidence retained by the document observer |
| SSR, application modules held, pre-hydration fill/unfilled | No restoration before or after hydration |
| Late timer window and repeated initialization | No polling can reset the marker; no additional observer |
| Creative visibility, sampled stacking, click-target/overflow checks | Mock iframe remains displayed and is topmost at sampled visible points; no placeholder covers it |
| Request count, publisher, slots and reserved dimensions | Compared with the same baseline scenario; no additional requests or placements attributable to the correction |

The staged integration at port 5322 separately exercises SPA routes including `/svg-sprite-generator`; it is not part of PR27. Production builds and application tests also passed on that disposable integration.

## Screenshots, geometry and request comparison

Before/after screenshots were captured and actually inspected at **320, 390, 768, 1440, 1920 and 2560 CSS pixels** in both engines. Contact sheets show the old overlay hiding the local green creative and the corrected creative fully visible while callbacks are held: [Chromium](ad-safety/screenshots/chromium-comparison.png), [WebKit](ad-safety/screenshots/webkit-comparison.png). [Ultra-wide first fill](ad-safety/screenshots/webkit-sidebar-first.png) demonstrates cross-slot suppression from a sidebar. Original full-size images are retained beside them.

Assertions include computed visibility, opacity, geometry, placeholder/iframe intersection and DOM hit-stack samples. They do not equate opacity alone with acceptance. Sampling and mock dimensions cannot establish every possible network creative layout. Existing contextual geometry (120px outer height with a possible 180px reserve) was preserved, not silently certified as universal creative sizing.

Initial mock pushes match the baseline at each compared viewport (2 mobile, 3 desktop, 5 ultra-wide); per-scenario request/slot evidence is retained. A 768px Chromium capture showed a 22.75px downstream document-Y difference with unchanged reserved ad dimensions. A fresh settled probe exactly matched measured headings, text, sections and ad rectangles/styles. Both records are preserved; this is not a claim that every asynchronous absolute position or request timestamp is identical.

Frame monitoring after first fill found zero visible-placeholder frames on the corrected narrow build across route changes and resizing, versus repeated visible frames on the original implementation. Detailed denominators, staged-route results, accessibility observations and remaining baseline findings are recorded in the browser report.

## Application regression and resource checks

Local **Node20.20.2** typecheck, production build, npm test, server syntax, bootstrap regression and whitespace checks passed. Focused monetization, SEO, schema, HTTP routes, route coverage, navigation source, links, documentation, manifest bundle, conversion actions, input compatibility and queue suites passed. Startup-collision and native-memory suites passed. The staged integration also passed typecheck, build, npm test, SEO/schema/routes/monetization, syntax and diff checks.

The existing corpus harness was reused from Phase 3 evidence commit `4d9e72d1372af2bdd2dff0edc0c51fbf7a074648`. Twelve inputs in each browser yielded **24 baseline/corrected download pairs** (48 conversions): logo, silhouette, multicolor, transparent icon, photograph, fine lettering, thin lines, pale text, complex background, layered art, large input and tiny input. Same-browser SVG bytes, preview pixels, independently rasterized pixels, structure and engine were identical. Existing quality limitations remain unchanged. The photograph fixture was read from the prior evidence workspace; it was not added to the release candidate.

Existing monetization, accessibility and export-compression browser assertions passed with outbound traffic blocked at browser launch. The export harness initially failed under Node20 because its CDP client expects global `WebSocket`; rerunning that harness under Node25 against the unchanged **Node20 production server** passed. That is a test-runner correction, not an application-runtime upgrade.

The existing navigation-browser audit remains a recorded baseline failure under deliberate network blocking: both versions report blocked-resource console errors and the same failure labels at all ten widths. Every measured non-console navigation value matches between them. Assertions were not weakened. Separate actual SPA navigation and frame-monitoring tests passed. [Regression results](ad-safety/regression-results.json) preserve both failures and successful workflows; this report does not claim every legacy audit is green or zero whole-site accessibility findings.

An independent pending-ad stress probe used at most 20,000 SVG path nodes, 40,000 unrelated attribute edits and 40 bounded subtree replacements. One observer handled the workload; unrelated attributes produced no records. Aggregate callback time was 11.2ms Chromium / 17ms WebKit, with maxima 0.5ms / 1ms on this workstation. After first fill it disconnected and equivalent replacements produced no further callbacks. No history/node collection grows in the implementation. [Resource evidence](ad-safety/independent-resource-results.json). These are bounded measurements, not universal device or heap guarantees.

## Exact-head CI

The existing Node20 Alpine workflow was extended only to include PR11's exact branch as a permitted PR target, retaining read-only permissions and checkout of the PR's exact head SHA. **CI VALIDATED:** [run 43557404764](https://github.com/suhas-sunder/ilovesvg/actions/runs/43557404764), job `132333254737`, completed successfully on **`ea88da59e1d662bf41579821b6c496a64e905003`**, not the previous Phase 3 aggregate. Downloaded logs confirm the exact checkout, Node20 Alpine image, mandatory tests, new ad bootstrap regression, production builds, startup/memory and output parity, runtime conversion/input/SEO/schema/routes, revision label and whitespace. All six job steps succeeded. [CI metadata](ad-safety/ci-evidence.json) and [extracted logs](ad-safety/ci-runtime-proof.txt) were independently reviewed. The optional external Node25 reference parity test was not configured; GitHub's checkout action runtime is separate from the tested Docker Node20 application runtime.

## Four independent passes and release integration

| Pass | Evidence |
|---|---|
| A — lifecycle/races | Independent source review, native-DOM reproduction, repaired early-fill defect, cleanup/resource probes |
| B — rendered behavior | Independent Chromium/WebKit production matrix, iframe stacking, screenshots, per-frame navigation monitoring |
| C — application safety | Node20 suites, real downloaded-output parity, existing browser accessibility/exports, baseline failure comparison |
| D — release/operations | Authenticated GitHub inspection, exact six-file ancestry, eight-step structural replay, exact-head CI review |

The dependency map is **unchanged main → PR11 + PR27 correction → PR12 with PR23 → PR14/A15 → B16 → PR17 with PR26/C18 → D19 → E20 → F21 with PR24**. The corrected first release contains only PR11 plus this correction. No later UI or content is needed to make it work.

Independent replay of all eight previously validated Phase 3 steps found no conflicts, preserved PR23's accessible role, and left every non-ad application/public/package/server byte unchanged at each stage. Canonicals, robots and manifest stay intact; indexable counts remain 125 → 126 at A → 127 at F, with examples first at C. These intermediate replays are structural evidence, not fresh CI certifications for hypothetical future release heads. [Release review](ad-safety/release-review.md).

Do not merge PR13 or PR22. PR25/PR10 automation remains disabled. PR24 stays with F, PR26 with the docs prerequisite. All SEO packages remain unapproved and unscheduled. If an approved integration creates a different commit from the tested candidate, review and run exact-head CI on that resulting release revision before publication. Do not relabel an old green run as the new revision's validation.

## Genuine-network acceptance — still BLOCKED

Local tests prove the implemented state and stacking behavior under simulated conditions. They do not establish actual Google rendering, consent/network variability, account compliance, physical iPhone behavior or production acceptance. No authorized production-equivalent genuine-ad environment was available in this task.

The owner's subsequent acceptance should use ordinary, authorized browsing with existing consent controls, without automated ad clicks, repeated reloads to force impressions, or configuration changes:

1. Identify the exact candidate/runtime and an authorized environment serving genuine ads under the existing configuration.
2. Observe blocked/pending/unfilled states, then an organically filled creative; record the actual status marker, root latch, placeholder visibility, creative dimensions and stacking.
3. Observe a later fill, later empty slot, newly mounted slot, ordinary SPA navigation/Back and mobile/desktop resize. Verify no placeholder returns or covers any visible creative.
4. Check contextual, documentation and ultra-wide placements, sticky controls and real responsive sizing. Capture screenshots/DOM evidence without interacting with advertisements.
5. Record real-network, device, runtime and operational results separately. Only actual evidence can change the relevant status to **PRODUCTION VERIFIED**.

## Deployment visibility, rollback and concrete next action

Authorized GitHub inspection returned zero repository hooks, deployment records and Actions runs triggered by pushes to main. Main has a Dockerfile but no checked-in deployment workflow. Only a Copilot environment is visible; external GitHub App installation metadata was inaccessible (401). These facts **cannot exclude** an external platform integration or DigitalOcean-side poller. No host access, test merge, infrastructure change, new cost or production probe was used to discover the mechanism.

The current runtime revision, deployed artifact, retained rollback operation/artifact, expected host health checks and co-hosted service health remain unknown. Neither main's source SHA nor CI's disposable image identifies the running production service. The parent `c5cfeb0…` is a source comparison, not a verified runtime rollback. Reverting this safety correction would restore the known placeholder problem; no automatic rollback to that behavior is proposed.

**Exact next operational action:** confirm through the established deployment mechanism whether a main update can trigger unattended deployment, identify the current runtime/artifact and retained rollback, and confirm existing health checks/co-host health. Arrange the genuine-network acceptance above in an authorized environment. Then make the concrete owner decision on **PR11 plus PR27 at `ea88da59e1d662bf41579821b6c496a64e905003`**, subject to any newly generated integration revision's exact checks.

After those gates and explicit release approval: update main through the reviewed release process, ask the owner to deploy manually, verify the actual live revision/output/health, and only then approve the next release. The final site-wide owner review remains after the entire release train is deployed and verified. No arbitrary terminal commands are requested here.

## Final state

| Item | Status |
|---|---|
| Global page-session placeholder protection | **IMPLEMENTED; VALIDATED LOCALLY; CI VALIDATED; PUSHED** |
| Proposed release | Draft PR27, exact `ea88da59e1d662bf41579821b6c496a64e905003`, based only on PR11 |
| Exact-head CI | **CI VALIDATED**, run `43557404764`, job `132333254737` |
| Main publication | **Not MERGED** |
| DigitalOcean | **Not DEPLOYED** |
| Genuine ad-network acceptance | **BLOCKED; not PRODUCTION VERIFIED** |
| Runtime identity / rollback / host health | **BLOCKED by unavailable operational evidence** |
| SEO publication and automation | Remain unapproved, unscheduled and inactive |

The engineering correction is ready for owner review. Production readiness remains conditional on the explicit external gates, not on another general development backlog.
