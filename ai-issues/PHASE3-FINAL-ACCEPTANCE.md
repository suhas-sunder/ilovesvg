# iLoveSVG Phase 3 final independent acceptance

Reviewed November 13, 2026 ET (some GitHub timestamps are November 14 UTC). This is the authoritative acceptance and owner handoff. Supporting reports are evidence, not approval to publish. **No main merge, deployment, automation activation or production verification occurred.**

## 1. Executive conclusion

The staged product has been independently exercised, concrete defects corrected, and narrow review branches prepared. The corrected implementation is **ACCEPTED FOR OWNER REVIEW**, subject to the package-specific qualifications below. It is **not approved for production release**.

Two source-ownership defects could submit removed artwork or overwrite an old result using different artwork with the same filename. Malformed sprite path numbers could silently fill a hole in an actual download. Release tooling omitted approval/dependency checks, exposed a trusted-workflow weakness, and followed public-file symlinks. These defects now have focused corrections and regressions.

An additional, unresolved finding matters: **the source does not implement the documented global first-filled-ad placeholder latch.** It has per-slot opacity state. Local browser mocks reproduce the difference; they do not prove a genuine-network overlap. Earlier Phase 1/2 statements asserting that global suppression existed were unsupported. The lifecycle was preserved, and only the expressly permitted semantic attributes were changed. An owner-scoped correction and actual ad-network verification remain required under the protected directive.

The first release is also blocked on the established deployment mechanism: GitHub evidence cannot exclude a DigitalOcean-side poller or prove the running version and operational rollback. No host access was attempted. Physical iPhone, Design Space and machine-cut tests remain unperformed; those limitations do not by themselves reject unrelated editorial packages.

## 2. Verified current GitHub state

Original PRs [#10–#22](https://github.com/suhas-sunder/ilovesvg/pulls) remain open drafts and unmerged. The independent initial inspection found clean mergeability against their own bases, zero comments/reviews/review threads, and no unresolved change requests. Original application, content and handoff heads were preserved. Only verification-only [#13](https://github.com/suhas-sunder/ilovesvg/pull/13) was explicitly fast-forwarded to the integrated corrections; **never merge it**.

New focused drafts are [#23 UI ownership/semantics](https://github.com/suhas-sunder/ilovesvg/pull/23), [#24 sprite parser](https://github.com/suhas-sunder/ilovesvg/pull/24), [#25 release gates](https://github.com/suhas-sunder/ilovesvg/pull/25), and [#26 public asset validation](https://github.com/suhas-sunder/ilovesvg/pull/26). They are pushed review artifacts, not owner-approved releases. See [live GitHub evidence](phase3/release-github-evidence.json) and [release review](phase3/release-acceptance.md) for bases, changed files, ancestry, CI and limitations.

## 3. Exact source SHAs

| Source | SHA |
|---|---|
| Unchanged main | `f53292e1551a714c884103d1e0bc5e5c2172f1f1` |
| PR10 original draft infrastructure | `5c8dcd49f5b5d081d27054a670777c009d8b3802` |
| PR11 reliability | `c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4` |
| PR12 Phase 1 | `78dda78994ea90e7b3a839725021bc316463434e` |
| PR14 route-test prerequisite | `2f59bd2cc8f4a2ab89012ead5930205272b4c42d` |
| A / PR15 | `690dea0a67d092b6ab7c096096686a123dd61175` |
| B / PR16 | `1154088f8ce25918980dbcf92bd2f3794612f893` |
| PR17 docs-test prerequisite | `e34f3412584f39af820f09438e65e24989ae82e4` |
| C / PR18 | `2c8fb494d417be4aed183deae816ad8e67d8c6a5` |
| D / PR19 | `c2477b3950d62bb4ecd77ff427e25da2cb6586d8` |
| E / PR20 | `dd36207dbfc233475b22a949c3806f29fdb883e8` |
| F / PR21 | `40856446cf75a0a58070b72bf218002789bad48d` |
| PR22 original handoff | `71050b16805e9909171bcb0074d1209cf090df24` |
| PR23 narrow UI correction | `7c00cc58950a2bef21498ab781ef82fd717ab0cf` |
| PR24 narrow sprite correction | `7cc86a817cf15a0cd8e8960cc7af306d71a39709` |
| PR25 narrow gate correction | `c4356cf5308fe6ab7cc1944bbfe5ba13ceb2e5ce` |
| PR26 corrected docs audit | `2a3e9df4d83dd32014d14dd7a00337750e682568` |
| Integrated application, CI via PR13 | `abf58b7886338b6d1b07a0501cab7f3bc7eb1b8f` |

The immutable local tracked tree was `7bc288cb5b4076101de77d8c1c042be901020417`; application/public bytes match the integrated CI commit. Later changes to this handoff are records and test harnesses. The original E: workspace stayed on `d7d341e397c95d554e473fe584a07fd3f4d8e0a4`; existing worktrees and unrelated work were preserved. No force-push was used.

## 4. PR dependency graph

The historical stack is `main → 11 → 12 → 14 → A15 → B16 → 17 → C18 → D19 → E20 → F21 → admin22`. PR10 is separate from that application ancestry. Amend Phase 1 using PR23; carry PR26 with PR17 before C; carry PR24 only at F. Install PR10 only with PR25 through the narrow administrative extraction after the verified technical foundation. Actual future predecessor changes require new exact reviewed heads, allowlists and CI. Existing stacked heads cannot silently be treated as those future releases.

## 5. Phase 1 acceptance findings

**NEEDS CORRECTION at original PR12; ACCEPTED FOR OWNER REVIEW with PR23.** A held second PNG header read reproduced a real stale POST after Remove and two submissions after replacement. The fix guards generation and exact File before/after validation, including errors. Separate Home/PNG tests proved that an older output could be replaced by different same-name artwork, even without an extra POST because the response cache supplied it. Retrace/retry now verify source bytes and recheck ownership; selecting the original bytes again remains supported.

Fresh Chromium/WebKit tests cover paste confirmation/discard, native text-field paste exemption, same-name replacement, held measurement/header/fingerprint, worker failure and compatible fallback, shared cancellation, route departure during worker/fallback, fullscreen navigation, nested Escape, focus wrapping/return, preset keyboard controls and mobile input → output → original order. The exact narrow PR23 has 125 sitemap URLs, and author/sprite/example requests return 404. [Conversion report](phase3/conversion-acceptance.md) · [narrow exact-head results](phase3/conversion-narrow-validation.json).

## 6. Candidate A review

**ACCEPTED FOR OWNER REVIEW.** The maintainer page, footer attribution, canonical and ProfilePage/Person data agree. No credentials, traffic, endorsements or professional achievements were invented. Both browser engines passed cold-page ad exclusion and keyboard footer → profile → converter navigation. All eight responsive widths were inspected. Existing public identity references support the limited software-engineer/maintainer description: [iLoveTimers author](https://www.ilovetimers.com/author/suhas-sunder/) and [MorseWords about](https://www.morsewords.com/about). New indexable budget: one page. PR14 remains a test prerequisite.

## 7. Candidate B review

**ACCEPTED FOR OWNER REVIEW.** The guidance distinguishes HEIC/HEIF, ProRAW/DNG, a real export versus renaming, pixel count versus compressed size, orientation, transparency, cancellation and saved-copy recovery. Apple supports the described [Preview export controls](https://support.apple.com/en-ca/guide/iphone/iph61c20afe1/27/ios/27) and [edited ProRAW JPEG sharing](https://support.apple.com/en-ae/119916). Initial exact-locale requests returned 429; equivalent official localized pages were checked. This is not a physical iPhone test.

The existing browser harness passed 14 viewport comparisons and both invalid-input → recovery-link → genuine JPEG → downloaded SVG workflows against the **corrected technical predecessor**. An earlier run against uncorrected PR12 failed its strict axe-equality assertion because the corrected page removed two old findings; no assertion was weakened. Existing-page budget: troubleshooting, with its supporting converter error link.

## 8. Candidate C review

**ACCEPTED FOR OWNER REVIEW after PR17/26.** Six source/output/preview triples and manifest values were independently inspected. Actual UI regeneration matched all six published Chromium SVG hashes. WebKit's three line-art examples match those files; its three color examples use the existing compatible fallback and differ from Chromium. All 12 same-browser regenerated downloads exactly match their Phase 1 counterparts in bytes and rasterized pixels. Those cross-browser differences are pre-existing, not silently normalized by changing engines.

Original artwork and NASA photo provenance are present. [NASA's source](https://svs.gsfc.nasa.gov/30613/) confirms the image and credit, and its [media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) supports educational/informational use with attribution and no implied endorsement. Geometry, lost fine detail, color shifts and size growth are described visibly. One existing guide is improved; public example assets first enter at C.

## 9. Candidate D review

**ACCEPTED FOR OWNER REVIEW.** Real cut-mark downloads preserve the interior hole, bridge and detached island. Chromium/WebKit reproduced the dark-preview rectangle and the documented recovery by disabling inversion and enabling transparency. The clean/recovered files have one path and three subpaths; inspected pixels establish the holes rather than treating path count as proof. [Cricut upload guidance](https://help.cricut.com/hc/en-us/articles/360009556313-How-to-upload-images-into-Design-Space) and [Prepare guidance](https://help.cricut.com/hc/en-us/articles/26762475430167-Prepare-screen-Design-Space-Guide) support the workflow wording. No physical cut or actual Design Space import is claimed. C's example asset is a real dependency. One existing-page improvement.

## 10. Candidate E review

**ACCEPTED FOR OWNER REVIEW.** Fresh synthetic artwork passed automatic removal, checkerboard invariance, green SVG underlay replacement, re-upload/removal of the inserted underlay and manual removal of a partial rectangle. Actual downloads retain the blue-circle center `[0,51,255,255]`; empty corners become transparent, and replacement corners become `[0,170,68,255]`. Existing add-background coverage also confirms the inserted rectangle precedes the artwork. The FAQ matches visible claims and does not promise arbitrary image background removal. One existing-page improvement; editor algorithms remain unchanged.

## 11. Candidate F review

**NEEDS CORRECTION at original PR21; ACCEPTED FOR OWNER REVIEW with PR24.** The bounded, local utility's stated supported subset matches the reviewed parser. Actual downloads and inline snippets render independently in Chromium and WebKit. Four collision-prone inputs produced the same 1,291-byte sprite in both engines, SHA-256 `c0969b60f37598164412c0bd3726000246564607e9501161a9cf07f2a3e68e0a`. The release adds exactly one indexable page, with no earlier sprite exposure. [Independent sprite report](phase3/sprite-acceptance.md).

## 12. Sprite security findings

Malformed fractional numbers such as `V18.` were accepted but truncated by the native path renderer, filling an expected hole in the downloaded icon. The narrow fix requires fractional digits in path data and preserves valid compact, signed, leading-dot and exponent syntax. ViewBox/transform attribute behavior was not tightened incidentally.

Both engines passed 63 focused cases plus 23 independent route rejection cases, gradient-chain boundaries, deterministic ID/reference checks, XML/namespace/entity/URL/CSS attacks, stale read/copy ownership, clear/remove, clipboard denial and actual inline pixel oracles. Thirteen watchdog cases per engine exercised size/node/path/geometry limits without a timeout. Installed PostHog SDK/replay traffic was locally intercepted and decoded: outside click/snapshot controls were captured while synthetic private filename/title/source/error markers and blob URLs were absent. No traffic was sent to the service. This is measured local privacy coverage, not a claim about every future analytics configuration.

## 13. Actual output testing

Evidence includes UI-triggered SVG downloads, browser-rendered previews, independent rasterization, compound holes, palette/layer structure, transparent pixels, per-source identity, repeated exports and inline use of the actual sprite file. A response count or well-formed SVG alone was not an acceptance criterion. See [conversion results](phase3/conversion-results.json), [content/output results](phase3/content-ad-results.json), and the [reviewed corpus contact sheet](phase3/screenshots/conversion-corpus-contact.png).

## 14. Conversion quality preservation

Twelve inputs cover simple logo, silhouette, multicolor illustration, translucency, photograph, fine lettering, thin lines, pale text, patterned background, overlapping layers, 4,800 × 3,400 input and 8 × 8 input. All 24 final browser/case combinations preserve the same-browser download, preview pixels, structure and engine against both PR11 and PR12. Workers, tracked decoded bitmaps and object URLs are released after route exit.

The comparison preserves existing limitations: faint text can disappear, tiny lettering can merge, partial alpha may flatten and photographic texture simplifies. Default line tracing is not color preservation. These are visible in the contact sheet and are not relabeled perfect output. No rejected quality patch, new engine, preset/default change or tracing algorithm change entered this work.

## 15. Mobile and accessibility results

The initial A–F grid exercised 96 route/engine/viewport combinations at 320, 375, 390, 430, 768, 1024, 1440 and 1920 CSS pixels. Screenshots were inspected, including both engines' contact sheets; wide pages retain a bounded reading column and mobile controls/content wrap without horizontal overflow. A premature WebKit gallery capture was discarded and repeated after hydration and visible-image decoding. The exact corrected snapshot passed 36 additional checks at 390/1440/1920, alongside targeted modal/keyboard/output tests.

Semantic corrections remove prohibited ad-wrapper labels, distinguish ultra-wide sidebar landmark names, and expose social/tool navigation and docs speed groups correctly. Before/after ad state and geometry comparisons agree. Scoped sprite/editor checks pass. Whole-page axe still reports pre-existing label/content-name mismatches in shared branding/cards/presets, and some existing guide content outside landmarks. This is not a zero-violation sitewide accessibility certification. Windows WebKit emulation is not an iPhone/Safari hardware test.

## 16. Content and factual accuracy

Every package's changed visible claims, metadata and linked workflow were reviewed. No new SEO copy was needed in this phase. Primary Apple, Cricut, NASA, MDN and SVG references were checked; [SVG image](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image) and [viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox) references support the inspection guidance. Downloaded examples are real outputs, not decorative substitutes. No ranking, revenue, speed, cutting-quality or universal compatibility guarantee is introduced.

## 17. Technical SEO preservation

The finite package boundaries preserve all prior manifest entries, canonicals and redirects. Indexable XML URLs are 125 at reliability/UI, 126 after A through E, and 127 only after F. Examples are absent before C; sprite URLs/links are absent before F. Robots and established redirects remain unchanged. Registered/public route totals reach 159/158 only at the final staged application. Fresh SEO, schema, HTTP routes, route coverage, navigation, docs, manifest-bundle and public-content suites pass. Candidate E's FAQ is consistent with its visible content; the author schema matches its profile.

## 18. Advertising safety checks and correction to earlier reports

The complete [protected ad directive](AD-PLACEHOLDER-SAFETY.md) was read. Only `role="group"` and unique sidebar accessible names changed in ad components; class/style/slot/effect/delay/fill code did not change. Independent review confirmed that scope. The actual source has per-slot `isFilled`, with **no global first-fill latch**. Mocks in Chromium/WebKit at 390/1440/2600 show one filled slot becoming transparent while other placeholders stay visible, and the first placeholder returning after a later unfilled state. This directly corrects the unsupported assertions in the earlier Phase 1/2 reports.

Blocked/pending/unfilled/fill/resize/SPA cases were exercised; mock creative screenshots show no overlay on that filled mock. Stabilized before/after states and document-relative slot geometry are identical. Initial request counts match; aggregate SPA push counts vary with existing delayed lifecycle timing, so this report does not assert exact request-timing equivalence from a single run. Genuine network fill, production stacking, consent/network variability and actual account compliance remain unverified. **Do not implement a new latch or restore placeholders incidentally; obtain the separate owner-scoped decision and required genuine-network acceptance.**

## 19. Performance and resource results

Thirty-six cold-context Chromium samples compare PR11, PR12 and the corrected integrated build with third parties blocked. Whole-build JS/CSS gzip totals are 2,708,137 → 2,710,752 → 2,735,316 bytes; these are not per-page downloads. Median local home transfer is 547,175 → 549,560 → 551,191 bytes. The expanded output guide is 274,378 → 273,905 → 323,440 bytes. Observed initial CLS was zero; measured long tasks and variable local timings remain recorded, not hidden behind a score. These workstation measurements are not field CWV, phone memory or production latency. [Raw measurements](phase3/performance-results.json).

Node20 startup collision and native-memory suites pass. Final idle diagnostics show zero active/waiting jobs, a one-job gate, bounded Sharp cache and 222,138,368 process RSS bytes on this local Windows run. Sprite watchdog maxima were 51 ms validation/171 ms rasterization in the settled run; an earlier concurrent dense-preview probe took 1,164 ms. Neither establishes a universal device bound. No paid service, dependency upgrade or infrastructure expansion was introduced.

## 20. GitHub CI evidence and local checks

Integrated revision `abf58b7886338b6d1b07a0501cab7f3bc7eb1b8f` passed [run 43551434747](https://github.com/suhas-sunder/ilovesvg/actions/runs/43551434747), job `132314551603`, through verification-only PR13. Downloaded logs confirm exact checkout and `node:20-alpine` image digest `sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293`, source-context exclusions, production image build, runtime actions, startup/memory tests, SEO/schema/routes and source whitespace. [Extracted log evidence](phase3/ci-runtime-proof.txt). All steps completed successfully. This CI covers the integrated application; it does not substitute for future exact release-head CI or certify PR25/26 tooling through that job.

Local Node20.20.2 typecheck, build, npm test, server syntax and diff checks pass on the immutable integration and the exact narrow UI/sprite candidates. Twelve focused integration suites pass. PR26 passes its corrected docs regression and mandatory checks. PR25 passes focused gates and mandatory checks when cleanly installed on PR12; original PR10's pre-reliability tree retains the known TypeScript-loader npm-test failure.

Three historical source-snapshot audits remain failing: Cricut freezes an older routes file, non-tracing utilities freeze the older cleaner source label, and SVG-to-PNG freezes OtherToolsLinks. Those assertions were not weakened. A first SVG audit invocation also lacked BASE_URL and was discarded; the correctly configured run reached the actual frozen-source failure. The separate existing SVG-to-PNG responsive behavioral audit passed all 63 route/viewport combinations across nine routes, covering 477 measured states on the exact corrected snapshot. [Responsive evidence](phase3/svg-png-responsive-results.json). Required behavioral, route and quality checks are reported separately from these obsolete source-equality expectations.

## 21. Corrections implemented

| Correction | Changed implementation | Review artifact |
|---|---|---|
| Stale PNG admission and wrong-source history retrace/retry | `home.tsx`, `png-to-svg-converter.tsx`, `sourceSnapshots.ts`; focused browser regressions | PR23 |
| Shared accessible semantics | AdSenseDelayed, UltraWideSidebarAds, SocialLinks, OtherToolsLinks, HowItWorksDocs; no styling/lifecycle edits | PR23 |
| Malformed sprite path decimals | `svgSprite.ts` and the existing sprite regression harness | PR24 |
| Approval/dependency/trusted-source and moving-ref gates | Two workflows, planner/boundary tests and setup note | PR25 |
| Real public asset containment and portable fixtures | Docs audit and focused regression | PR26 |

The application changes were peer-reviewed independently of their implementation. The four passes were code/security, actual functional outputs, rendered visual/editorial review, and release/regression simulation. Supporting evidence is under [phase3](phase3/); original owner requests and historical reports are preserved.

## 22. Corrections rejected or deferred

**REJECTED:** engine substitution to force cross-browser equality; resurrecting rejected quality changes; weakening file/indexability/trusted-base gates; merging aggregate PR13 or PR22; asserting a main push is a deployment; fabricated approvals, cut tests or production identity.

**DEFERRED:** protected ad lifecycle redesign pending explicit scope and genuine-network verification; physical iPhone/share/export and Design Space/machine validation; broader pre-existing shared accessible-name/landmark work and reconciliation of historical source-freeze audits. These are specific limitations, not new SEO campaigns or arbitrary publication work.

## 23. PR10 integration strategy

Original PR10 **NEEDS CORRECTION**; PR25 is **ACCEPTED FOR OWNER REVIEW** as an installation amendment. The boundary executes base scripts with read-only permissions and treats candidate files as inert, with no candidate package installation. Both approvals, verified dependencies, precise allowlists, indexability budget and exact ancestry are required. Inherited approved source recognition does not invent deployment. Refs are checked immediately before and after branch-addressed draft creation; mismatched drafts close. Later branch movement still requires owner re-review.

Keep scheduling disabled and the opt-in variable absent. Install only after the actual technical predecessor is verified; initial installation requires separate review because trusted `pull_request_target` does not exist on current main. Existing drafts trigger duplicate suppression. The repository currently disallows Actions-created PRs; enabling that is a separate future owner decision, not a change made here. [Detailed installation strategy](phase3/release-acceptance.md).

## 24. Administrative-record strategy

**Do not merge PR22 into main.** The narrow local extraction `codex/phase3-seo-admin-extraction` at `42dd426ebcc7ddf7c6ab7cfb494dbdf94e7a2f9a` demonstrates PR10/25 tooling plus only the queue and empty history on the Phase 1 foundation. Its eight-path delta contains no application/public content and no inherited A–F application stack. Rebuild this proposal from actual main after the technical corrections; the current branch is not a release-ready main PR.

The existing [release queue](seo/release-queue.json) remains the operational authority. Phase3 proposal metadata records required amendments without replacing historical reviewed refs or setting approvals/dates. Its explicit blocked ad-safety status supersedes the preserved candidates' historical `local-passed-live-verification-pending` labels; section 18 is the current evidence. [Release history](seo/release-history.json) remains empty. Never write simulated revisions or production success into it. This handoff branch itself carries the staged stack and is also **not a main merge candidate**.

## 25. Release package boundary verification

Both the original and corrected eight-transition sequences passed fresh Node20.20.2 production builds and six existing suites per step: 16 builds and 96 suite executions overall. Disposable exact checkouts also passed HTTP/HTML/XML/robots checks, negative future-route/asset checks and precise diffs/budgets. The corrected sequence includes the UI amendment before A, corrected installation, PR14, PR17/26 before C and sprite amendment at F. Its final local replay head `853bab8adbb854830efdaac3ddb01c36dcc33b8f` has application/public/package/server bytes matching the integrated tested application without importing aggregate handoff ancestry. The amended intermediate heads have local build/runtime evidence, not separate GitHub Actions certification. See [sequence evidence](phase3/release-sequence-evidence.json) and the [release report](phase3/release-acceptance.md) for exact original and amended refs.

The operational queue still selects no candidate now or in a future week without approvals. Hypothetical approval fixtures were held in memory for tests; they were never committed to the authoritative or disposable queues. Rollback references are previous source steps; actual production rollback still needs the operator's retained artifact and real revert mechanism.

## 26. Exact weekly release sequence

These are ordered **proposal slots**, not dates or owner approvals. Eligibility for substantive SEO starts no earlier than November 16, 2026. Use at most one new indexable page and one justified existing-page improvement per week; this proposal chooses one content package per week. If a gate is open, release zero packages and carry the same next slot forward.

| Slot | Payload | Budget / prerequisite |
|---|---|---|
| R1 | PR11 reliability | Technical only; trigger/runtime/rollback and ad-policy handling first |
| R2 | PR12 plus PR23 UI/ownership/semantics | Technical only; no staged pages/examples |
| Before A | Narrow PR10+25 installation and administrative records | No indexable content; disabled scheduling; actual predecessor review |
| A | PR14 test prerequisite, then PR15 maintainer | One new page |
| B | PR16 mobile recovery | One existing guide plus supporting error link |
| C | PR17+26 test prerequisite, then PR18 examples guide | One existing guide; first example assets |
| D | PR19 Cricut guidance | One existing page; requires C assets |
| E | PR20 background guidance | One existing page |
| F | PR21 plus PR24 sprite correction | One new page; total 127 indexable URLs |

PR14 and PR17 with PR26 are reviewed technical steps in the corresponding publishing week, not arbitrary extra content weeks. They must be trusted-main ancestors before the eligible content diff if the gate is installed. After each separately authorized main update, the owner manually deploys, verifies the actual runtime and outputs, records the real result, then advances. This includes separate test-only prerequisite updates if the established operator policy treats every main update as deployable; do not silently combine or skip those gates. No final site-review session is scheduled until F is actually deployed and verified.

## 27. Production/deployment blocker

Authenticated GitHub inspection returned zero repository hooks and deployment records; current main has no release workflow, and no visible repository script establishes automatic DigitalOcean deployment. That evidence cannot rule out an external integration/poller. The running version, image/service artifact, resource limits, co-host state and retained rollback are unknown. A source SHA is not an observed production version.

**Exact next operational action:** the owner should confirm from the already established deployment mechanism whether a main update can trigger unattended rollout, and supply the current runtime/artifact identity plus retained rollback operation and health-check expectations. No arbitrary host command list or DigitalOcean access is requested. Separately decide the protected ad-policy discrepancy with the required real-network verification before treating the ad safety gate as passed.

## 28. Required owner approvals

Owner review of the four narrow corrections is next; that is separate from approving the first GitHub publication. Subsequent decisions are per-release exact source/base approval, manual deployment, production verification, and only later optional draft-workflow installation/activation settings. All queue owner/schedule approvals remain false; planned weeks, publication dates and deployed revisions remain null. No approval was inferred from a green build or a draft PR.

## 29. Remaining external verification

Required external evidence is the real deployment trigger/runtime/rollback record and genuine advertising behavior. Physical iPhone pickers/share flows and low-memory behavior, actual Design Space import and physical cuts remain unverified. Local WebKit, synthetic clipboard events and mock creatives are identified as such. Field performance, search indexing and revenue effects have not been measured or promised. These distinctions allow editorial review without inventing device or operational proof.

## 30. Final release readiness verdict

**Engineering acceptance: completed with the explicit corrected-source qualifications and remaining findings above. Owner release decision: pending. First production release: BLOCKED BY EXTERNAL VERIFICATION and protected ad-policy handling.** No package is merged, deployed or production verified by this phase.

The compact table uses shortened SHAs that resolve to the full immutable SHAs in section 3. “CI original” does not cover an amended future release head. “Pushed draft” means review publication only, never publication on main.

| Release | Package | SHA | PR | Acceptance | CI | Owner approval | GitHub publication | DigitalOcean deployment | Production verification | Blocker | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | Reliability | c5cfeb0 | 11 | BLOCKED BY EXTERNAL VERIFICATION | CI VALIDATED original | Pending | Pushed draft | Not deployed | Unverified | Trigger/runtime/rollback; ad-policy handling | Owner confirms established operations |
| R2 | UI + ownership | 7c00cc5 | 12,23 | ACCEPTED FOR OWNER REVIEW with correction | Integrated CI; narrow local | Pending | Pushed drafts | Not deployed | Unverified | Actual predecessor/head review | Review23; replay after verified11 |
| Install | Gate correction | c4356cf | 10,25 | ACCEPTED FOR OWNER REVIEW with correction | Local installation green | Pending | Pushed drafts | Not installed | Unverified | Actual technical predecessor; disabled setting | Review25; narrow extraction only |
| A | Maintainer | 690dea0 | 14,15 | ACCEPTED FOR OWNER REVIEW | Local; integrated original/corrected | False | Pushed draft | Not deployed | Unverified | Predecessor and exact release-head checks | Review A with route prerequisite |
| B | Recovery | 1154088 | 16 | ACCEPTED FOR OWNER REVIEW | Local; integrated original/corrected | False | Pushed draft | Not deployed | Unverified | Prior release verification | Review B; keep phone limits explicit |
| C prerequisite | Docs containment | 2a3e9df | 17,26 | ACCEPTED FOR OWNER REVIEW with correction | Local mandatory green | Pending | Pushed drafts | Not deployed | Unverified | Actual B predecessor | Review26 before C |
| C | Examples | 2c8fb49 | 18 | ACCEPTED FOR OWNER REVIEW | Local; integrated original/corrected | False | Pushed draft | Not deployed | Unverified | Corrected docs prerequisite | Review C actual outputs |
| D | Craft guidance | c2477b3 | 19 | ACCEPTED FOR OWNER REVIEW | Local; integrated original/corrected | False | Pushed draft | Not deployed | Unverified | C assets / predecessor | Review D; no cut certification |
| E | Background guidance | dd36207 | 20 | ACCEPTED FOR OWNER REVIEW | Local; integrated original/corrected | False | Pushed draft | Not deployed | Unverified | Prior release verification | Review E |
| F | Sprite + parser | 7cc86a8 | 21,24 | ACCEPTED FOR OWNER REVIEW with correction | Integrated CI; narrow local | False | Pushed drafts | Not deployed | Unverified | Replayed exact source; prior releases | Review24 with F |
| Evidence | Aggregate verification | abf58b7 | 13 | REJECTED as release vehicle | CI VALIDATED | Not applicable | Pushed draft | Prohibited | Not applicable | Contains whole staged stack | Never merge |
| Records | Original handoff | 71050b1 | 22 | REJECTED as main merge vehicle | Not release CI | Not applicable | Pushed draft | Prohibited | Not applicable | Contains whole staged ancestry | Extract only reviewed records |
