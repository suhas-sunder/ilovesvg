# Independent ad lifecycle review (pass A)

The independent reviewer read the full owner remediation assignment and protected advertising directive. Initial source was PR11, `c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4`. The user-supplied corrected iLoveSVG guidance controls; that historical checkout still contains the misplaced timer guidance.

## Source reconnaissance

`AdSenseDelayed` is the only actual advertising-placeholder renderer. `ContextualAdCard`, documentation's `DocsCompactAd`, both `OtherToolsLinks` ad locations, and `UltraWideSidebarAds` use it. Ultra-wide rails deliberately pass `showPlaceholder={false}` but remain possible first-fill sources. Reserved wrapper backgrounds and borders are not independent loading labels. No other `data-ad-slot`, `adsbygoogle` creative container or ad placeholder was found under `app/`.

The original local `isFilled` starts false, resets in the slot/delay/interaction effect, and becomes false again when `data-ad-status` is `unfilled`. Explicit `filled` is accepted; absent status falls back to any iframe measuring at least 200 by 50 pixels, which cannot establish actual creative fill. The placeholder sits above the creative as an opaque absolute `z-10` element, with a 200 ms opacity transition. Its `pointer-events:none` does not prevent visual occlusion.

Requests are independent of fill observation: one delayed or first-interaction `start`, at most twelve 300 ms retries if pushing fails or width is zero, and post-push checks at 250/900/2000/4000 ms. A per-slot subtree mutation observer plus 1500/4000/7000 ms checks observe fills. Cleanup clears timers/listeners and disconnects the observer. Route policy controls contextual/docs slots and the root asynchronous AdSense script. Ultra-wide rails appear only from 2400 CSS pixels with sufficient side clearance and 300 by 600 reserved dimensions.

## Independent design challenges sent before implementation

1. Do not classify an arbitrary blank or pending iframe as global first-fill evidence. Protect its own slot conservatively without claiming the entire session has a confirmed fill.
2. Remove the fade and protect creatives synchronously in CSS; a React state update or observer alone permits an overlay while detection is delayed.
3. A filled node can be detached by SPA navigation before observer delivery. Consume pending records and current detached-slot evidence before cleanup.
4. A filled-to-unfilled transition can erase current status before delayed delivery. Observe `attributeOldValue` and recognize previous `filled` only for the intended slot's `data-ad-status`, never arbitrary nested attributes.
5. Keep the latch monotonic, document scoped and independent of component mount state. No storage or competing React store is needed. Keep request timing, IDs, eligibility, geometry and consent code unchanged.

## Initial implementation challenge

The first implementation correctly kept the document latch monotonic and used explicit fill evidence. Eighteen independent native-DOM/helper/source-CSS probes passed across Chromium and WebKit: pending full-size frames, explicit unfilled, nested and unrelated mutation records, synchronous CSS suppression, detached filled-to-unfilled cleanup, later empty observations, newly inserted placeholders, document isolation, and 1,000 repeated idempotent observations. These are separate from production-app browser coverage.

One material defect remained in that first correction: before any React effect installed an observer, a filled marker hid every placeholder through CSS, but a later unfilled marker restored them because no historical evidence had been latched. Chromium and WebKit both reproduced `visible → hidden → visible` across actual animation frames with the latch absent. [Initial reproduction](prehydration-initial-reproduction.json) records the source CSS hash and exact results. This is relevant because the existing async advertising script can execute before hydration. Root was notified and replaced effect-time observation with early first-party observation.

## Corrected implementation review

The static head bootstrap now installs one document observer before the existing async AdSense script can execute. It shares the single monotonic document attribute with CSS, accepts only the explicit slot status or its recorded old value, preserves detached/pre-populated slot evidence, and disconnects permanently on first fill. Its private observer guard prevents duplicate bootstrap subscriptions. There is no external input interpolation, browser storage, network request, React subscription or process-wide SSR state. New documents naturally start fresh. The intentionally externally owned HTML attribute is covered by root-level hydration-warning suppression; production hydration behavior is tested by the separate browser lane.

The revised independent suite passed seven scenarios in each engine (14 total), using the actual bootstrap export and source CSS, native MutationRecords, computed visibility and real animation frames:

- Large pending iframe, unfilled status, nested status and unrelated-attribute controls do not create a global false-positive latch.
- Filled then unfilled before any React effects leaves every placeholder suppressed.
- Filled → unfilled → detach within one task retains the old-value evidence.
- A pre-populated filled subtree added and removed before delivery still latches.
- Bootstrap finds an already-filled slot.
- A second bootstrap creates no second safety observer; first fill disconnects the observer; 1,000 later transitions do not invoke it; a newly mounted placeholder is hidden immediately.
- A fresh document does not inherit suppression.

[Executable independent probes](independent-race-review.mjs) · [Results with bootstrap source hash](independent-race-results.json). An initial metrics probe counted Playwright's unrelated observers; instrumentation was corrected to identify the root observer filtered to `data-ad-status`. That probe issue was not a product failure.

The source diff preserves the request delay, first-interaction listeners, width gate, one-push-per-slot guard, 300 ms retry interval, twelve-attempt cap, request effect dependencies, slot IDs, publisher identity, root AdSense loading and monetization policy. Removed timers were fill-observation timers, not request timers. Creative dimensions and reserved wrappers remain unchanged. The placeholder no longer fades, sits behind the positioned creative, and CSS removes its visibility immediately for a possible iframe or known fill. No other placeholder renderer was missed.

**Pass A verdict: IMPLEMENTED and VALIDATED LOCALLY for the inspected bootstrap and lifecycle. No remaining reproduced implementation defect in this review.** Production-app stacking, screenshot, request-count and regression evidence are provided by the separate acceptance lanes. Existing contextual geometry reserves a 180 px `ins` inside a 120 px wrapper; it was not altered under this correction. Do not infer that every genuine creative size is unclipped from short mock creatives. Genuine network sizing, fill timing and account-policy acceptance remain required.

No genuine AdSense network, production deployment or physical-device acceptance is implied by this source review.

## Bounded pending-ad resource probe

A separate independent probe exercised the actual bootstrap while ads were pending, then after first fill. It inserted one 20,000-path SVG subtree, changed 40,000 unrelated SVG attributes, and replaced an attached 500-path SVG subtree 40 times. At most 20,000 artwork paths were present at once. Both engines retained exactly one safety observer before fill. The attribute filter produced zero additional records for the 40,000 unrelated attribute edits.

Before fill, Chromium processed 20,042 records in 42 callbacks, with 11.2 ms total instrumented callback time and 0.5 ms maximum; WebKit recorded 17 ms total and 1 ms maximum. These are local workstation samples with finite fixtures, not universal device budgets. After fill, the observer disconnected once, its document property was deleted, and 40 equivalent subtree replacements plus final removal produced no additional safety callbacks or records. The fixture contained zero descendants at completion. Source inspection finds no retained node/record collection: only the live observer is held until fill, and record iteration arrays are temporary. This is not a browser heap-snapshot proof.

[Resource probe](independent-resource-review.mjs) · [Measured results](independent-resource-results.json). No additional production correction was indicated by this probe.
