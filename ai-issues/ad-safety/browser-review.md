# Independent advertising browser acceptance

**Status: VALIDATED LOCALLY. Genuine ad-network acceptance: BLOCKED / not performed.** This review used production servers, actual Chromium and WebKit rendering, and local `srcdoc` mock creative iframes. Every off-origin request was intercepted; no advertisement was clicked and no genuine impression was generated. The implementation author did not write this browser harness.

The comparison foundation was exact PR11 `c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4` on port 5320. The narrow corrected production build was served on 5321. The separate staged application replay on port 5322 was `336c7a7` (see the authoritative integration report for its full SHA); it was used only to check later-route compatibility, including the sprite route. It is not the first release candidate.

## Observed original failure and corrected behavior

The original overlay visibly concealed the green mock iframe while the mutation callback was held at all six tested widths in both engines. At the measured creative point its placeholder occupied paint-stack index 0 and the iframe index 4. The original per-slot state also restored placeholders after unfilled transitions and route remounts.

The corrected build showed the iframe at the top sampled hit-stack position, retained its display and reserved container, and suppressed placeholders immediately even with the callback held. An unknown iframe shields its own slot without classifying the whole document as filled. Explicit filled status suppresses all placeholders; subsequent unfilled states, mounts, navigation and resizing do not restore them. A sidebar slot with `showPlaceholder={false}` was separately tested as the **first** filled slot and suppressed placeholders elsewhere.

The harness temporarily changes a placeholder's `pointer-events` solely while calling `elementsFromPoint`, then restores it without dispatching input. This exposes the real paint order that ordinary hit testing would omit for `pointer-events:none`. It also records rectangle intersections, computed visibility/display/opacity, stacking, wrapper overflow, and creative/container geometry. Opacity alone is not the oracle.

## Required scenario coverage

Both engines passed the corrected assertions in these groups:

| Requested situations | Actual checks |
|---|---|
| 1–4: no SDK, blocked script, pending, unfilled | Empty executable SDK response and blocked network cases retain placeholders; successful mock pushes and unfilled statuses do not establish fill. JS-disabled SSR is also inspected. |
| 5–8: first fill, delayed fills, mixed slots, later unfilled | Multiple simultaneous slots; two delayed mock creatives; all slots later unfilled with no restoration. |
| 9–12: new slots, SPA, back, unmount/remount | Converter → docs → utilities → legal exclusion → browser Back; newly mounted placeholders stay suppressed. |
| 13–14: mobile and desktop resize | 390 → 768 → 2560 → 1440, plus frame sampling at 320; sidebar mounts included. |
| 15–16: delayed iframe and observer | Unknown iframe without a filled status and explicit filled mock tested while mutation callbacks are held. |
| 17–19: transitions, polling, fast navigation | Filled/unfilled transitions, first-filled/unfilled within one JS task, 7.6-second late-poll observation, and same-task filled status plus SPA departure. |
| 20: SSR/hydration | App modules held while an SSR slot fills and becomes unfilled before hydration; suppression survives module release and later changes. No hydration warnings or page errors observed. |
| 21: relevant route families | Home, PNG converter, troubleshooting, minifier, background editor and excluded privacy page; staged sprite route included in a separate application replay. |
| 22–23: creative display and overlays | Computed visibility, visible-point topmost iframe assertion, intersection/stack inspection and actual screenshots. No creative clicks. |
| 24: request behavior | Initial mock pushes, whole SPA sequence pushes, and intercepted ad-script request counts match baseline. |

Animation-frame sampling found **0 / 1,087 Chromium** and **0 / 735 WebKit** frames with a painted placeholder after the latch in the corrected narrow build. The baseline positive control detected painted placeholders in **921 / 1,060** and **642 / 733** frames respectively. The staged sprite application had **0 / 1,197** and **0 / 815** painted-placeholder frames. These are sampled local observations, not a guarantee for every device or future browser.

## Geometry, requests and accessibility

All 14 paired initial snapshots retained exact slot IDs, publisher identity, reserved widths/heights/X positions and the creative container's offset within its wrapper. Initial mock pushes were 2 at mobile/tablet widths, 3 at ordinary desktop widths and 5 at 2560px, unchanged. Both engines' complete route sequences ended at 21 pushes before and after. The paired intercepted ad-script request counts also match. Wall-clock push times are recorded; this does not claim actual ad-network request timing from mocked SDK calls.

One initial 768px Chromium capture had a 22.75px downstream document-Y difference while ad reservations and the top slot were identical. A fresh targeted probe compared every measured main heading, paragraph, section and ad rectangle/style and matched exactly. The original offsets remain in the evidence; universal absolute-position equality is not claimed. No stable geometry regression was reproduced.

Whole-page axe violation families were unchanged: `aria-prohibited-attr`, `color-contrast`, and `label-content-name-mismatch`. This is not a zero-violation accessibility certification; later PR23 semantics are intentionally not imported into this narrow PR11-based fix.

## Screenshots and reproducibility

Both comparison sheets were visually inspected at 320, 390, 768, 1440, 1920 and 2560 CSS pixels, alongside full-size mobile, desktop and sidebar captures. The mock creative remains distinct from conversion controls; the sidebar remains outside the content column. The blank reserved spaces after suppression are intentional.

- [Chromium before/after sheet](screenshots/chromium-comparison.png)
- [WebKit before/after sheet](screenshots/webkit-comparison.png)
- [WebKit sidebar first fill](screenshots/webkit-sidebar-first.png)
- [Computed styles, rectangles, stacks, request counts and frame samples](browser-results.json)
- [Browser harness](browser-acceptance.mjs), [evidence collector](browser-evidence.mjs), [focused geometry probe](browser-geometry-probe.mjs)

The harness supports `BASE_URL`, `OUT`, `BASELINE`, `ENGINES`, `SECTIONS`, `INCLUDE_SPRITE`, `PLAYWRIGHT_MODULE` and `AXE_SCRIPT`. `SECTIONS=matrix,visual` runs the principal matrix; `flicker` and `sidebar` are separate focused cases. Baseline mode records the old failures without asserting the new invariant. The collector retains the observations and checks the paired geometry/request comparisons. Raw captures remain in `tmp/ad-safety/browser-*`; selected original captures are preserved under `screenshots/`.

Windows WebKit is not a physical iPhone test. Actual AdSense status ordering, genuine creative layouts, consent/network variation, account-policy compliance and production behavior remain unverified and require the owner's separately authorized live acceptance. No source change was requested from this review after the initial pre-hydration persistence issue was corrected by the implementation lane.
