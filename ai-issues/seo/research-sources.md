> Historical planning record retained. Current implementation, decisions and measured evidence are in [Phase 2](../PHASE2-STATUS.md) and [the current decision record](phase2/content-decisions.md). These historical observations are not new defect claims.

# Source review for future drafts

Reviewed November 8, 2026. These sources support content quality and technical wording, not keyword demand or projected revenue.

- **Maintainer/profile and all drafts:** [Google's people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) recommends useful original information and clarity about who created content. This supports concise truthful attribution and worked examples; it does not mandate bulky author modules or guarantee ranking gains.
- **Cadence and new-page selection:** [Google's spam policies](https://developers.google.com/search/docs/essentials/spam-policies) address scaled low-value content and doorway abuse. We therefore favor existing user journeys and distinct functionality. One page per week is a release limit, not protection from those policies.
- **Mobile input recovery:** the [HTML standard's ImageBitmap section](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html) defines image creation, resizing and orientation behavior. Browser API availability alone does not prove bounded peak decoder memory on a phone. The help draft therefore recommends preserving originals and supported exported copies; it makes no blanket promise that every oversized source can be safely resized.
- **Vector inspection:** [SVG 2 embedded content](https://www.w3.org/TR/SVG2/embedded.html#ImageElement) defines embedding through the image element. This supports explaining that an SVG document may include raster content. Actual converter output must still be inspected in the proposed original example; the standard does not establish iLoveSVG output quality or machine compatibility.

No competitor traffic, volume, CPC or RPM estimates were used. The authoritative local evidence for current capabilities is the implementation and its observed tests, not a competitor's marketing text. See [first-party-evidence.md](first-party-evidence.md) for the available PostHog observations and GSC access limitation.
