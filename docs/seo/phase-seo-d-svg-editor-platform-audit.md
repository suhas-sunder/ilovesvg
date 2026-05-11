# Phase SEO-D-A SVG Editor Platform Audit

Date: 2026-05-11

Branch: `final-refactor-and-polish-may-10-v2`

Scope: report-only audit for SVG cleaner, SVG resizer, and adjacent SVG editor utility routes. No code, route URL, metadata, page copy, sitemap, navigation, conversion/editor behavior, preset, upload validation, deployment, or SEO implementation changes are part of this phase.

Baseline context:

- SEO-C checkpoint: `b423496 docs: add craft SEO checkpoint`
- Recommended next phase from checkpoint: `SEO-D-A: SVG cleaner/resizer platform route audit, report-only`
- Current focused SEO audit coverage: 38 high-priority core/craft/marketplace routes, not yet the cleaner/resizer platform wrapper family

## 1. Executive Summary

The SVG cleaner and resizer platform routes are useful, indexable utility pages, but they are the clearest remaining duplicate/thin-page risk in the current route surface.

The generic routes have real utility value:

- `/svg-cleaner` explains metadata, comments, editor junk, unsafe script behavior, ids, defs, preview checks, and browser-local cleanup.
- `/svg-resize-and-scale-editor` explains width, height, scale percentage, viewBox behavior, preserveAspectRatio, responsive SVG, and browser-local resizing.

The platform wrappers are the problem surface:

- `/svg-cleaner-for-figma`
- `/svg-cleaner-for-glowforge`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-canva`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-figma`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-silhouette`

These pages have unique metadata, correct canonicals, valid H1s, and real tool behavior. They should not be deleted based on this audit. The risk is that the rendered lower-page content is mostly shared template content plus a fallback route guide that swaps the platform name and group-level guidance. That can look like doorway-style SEO if expanded carelessly.

Highest-risk issue: all three cleaner platform routes inherit the same visible FAQ and the same FAQPage JSON-LD as `/svg-cleaner`. The FAQ is visible and honest, but it is generic rather than platform-specific. Future implementation should either rewrite platform cleaner FAQ content to be genuinely route-specific or avoid FAQ schema on platform wrappers.

Recommended first implementation batch: `SEO-D-B: generic cleaner/resizer core routes`.

Reason: strengthen the source templates first, then use that improved foundation to write platform-specific cleaner and resizer content without copying generic sections across every wrapper.

## 2. Routes Audited

### Cleaner Routes

| Path | Source file | Route type | Indexable/sitemap | Canonical | Title | Meta description | H1 | Lower-page sections | FAQ/schema | Shared implementation | Intent | Risk | Score | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `/svg-cleaner` | `app/routes/svg-cleaner.tsx` | generic SVG editor/optimizer | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-cleaner` | `SVG Cleaner - Clean and Optimize SVG Files | iLoveSVG` | Clean SVG files in browser by removing metadata, comments, editor junk, unsafe scripts, unused markup, and whitespace. | `SVG Cleaner` | Cleaner Settings; SVG Cleaner (Remove Metadata and Comments); route guide; All SVG tools | Visible FAQ plus FAQPage JSON-LD, 5 questions | route-local template source | Generic SVG cleanup, remove metadata/comments/unsafe markup | acceptable | 5 | Keep indexed. Tighten only after generic cleaner/resizer core pass. |
| `/svg-cleaner-for-figma` | `app/routes/svg-cleaner-for-figma.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-cleaner-for-figma` | `SVG Cleaner for Figma | iLoveSVG` | Clean SVG markup for Figma handoff, removing editor clutter while preserving practical SVG structure. | `SVG Cleaner for Figma` | Same cleaner settings and generic cleaner section; fallback route guide: Figma practical workflow notes | Same visible FAQ plus same FAQPage JSON-LD as generic cleaner | wrapper imports `./svg-cleaner` and routeMeta factory | Figma import/editing cleanup and design handoff | duplicate-risk | 3 | Keep indexed but rewrite platform-specific lower-page guide and FAQ/schema later. |
| `/svg-cleaner-for-glowforge` | `app/routes/svg-cleaner-for-glowforge.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-cleaner-for-glowforge` | `SVG Cleaner for Glowforge | iLoveSVG` | Clean SVG markup before Glowforge-style laser workflows, import testing, sizing checks, and path review. | `SVG Cleaner for Glowforge` | Same cleaner settings and generic cleaner section; fallback route guide: Glowforge practical workflow notes | Same visible FAQ plus same FAQPage JSON-LD as generic cleaner | wrapper imports `./svg-cleaner` and routeMeta factory | Laser/cut workflow cleanup before review | duplicate-risk | 3 | Keep indexed but add laser-specific cleanup, path review, and no-guarantee language before schema expansion. |
| `/svg-cleaner-for-silhouette` | `app/routes/svg-cleaner-for-silhouette.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-cleaner-for-silhouette` | `SVG Cleaner for Silhouette | iLoveSVG` | Clean SVG markup before Silhouette-style import, cutting software prep, sizing checks, and path review. | `SVG Cleaner for Silhouette` | Same cleaner settings and generic cleaner section; fallback route guide: Silhouette practical workflow notes | Same visible FAQ plus same FAQPage JSON-LD as generic cleaner | wrapper imports `./svg-cleaner` and routeMeta factory | Silhouette Studio import and cut path cleanup | duplicate-risk | 3 | Keep indexed but add Silhouette Studio and cut-path examples before schema expansion. |

Primary keywords:

- `/svg-cleaner`: `svg cleaner`, `clean svg`, `remove svg metadata`, `optimize svg`
- `/svg-cleaner-for-figma`: `svg cleaner for figma`, `clean svg for figma`, `figma svg cleanup`
- `/svg-cleaner-for-glowforge`: `glowforge svg cleaner`, `clean laser svg`, `svg cleanup for glowforge`
- `/svg-cleaner-for-silhouette`: `silhouette svg cleaner`, `clean cut file`, `svg import cleanup`

Secondary keywords:

- metadata cleanup, remove comments, remove editor junk, sanitize SVG, Inkscape cleanup, Illustrator cleanup, viewBox checks, ids and defs, gradients, masks, clip paths, SVG import, path review.

### Resizer And Scaler Routes

| Path | Source file | Route type | Indexable/sitemap | Canonical | Title | Meta description | H1 | Lower-page sections | FAQ/schema | Shared implementation | Intent | Risk | Score | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `/svg-resize-and-scale-editor` | `app/routes/svg-resize-and-scale-editor.tsx` | generic SVG editor | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resize-and-scale-editor` | `SVG Resize and Scale Tool - Change Width, Height and ViewBox | iLoveSVG` | Resize and scale SVG files in browser, including width, height, aspect ratio, scale percentage, and viewBox behavior. | `SVG Resize and Scale Editor` | Resize Settings; SVG Resize / Scale Tool; route guide; FAQ; All SVG tools | Visible FAQ only, no FAQPage JSON-LD | route-local template source | Generic SVG resizing, scaling, viewBox control | acceptable | 5 | Keep indexed. Consider shorter title and stronger viewBox examples in core batch. |
| `/svg-resizer-for-canva` | `app/routes/svg-resizer-for-canva.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resizer-for-canva` | `SVG Resizer for Canva | iLoveSVG` | Resize SVG logos and design assets before Canva handoff while keeping dimensions and viewBox predictable. | `SVG Resizer for Canva` | Same resize settings and generic resizer section; fallback route guide: Canva practical workflow notes | Same visible FAQ as generic resizer, no FAQPage JSON-LD | wrapper imports `./svg-resize-and-scale-editor` and routeMeta factory | Canva upload/design handoff sizing | thin-risk | 3 | Keep indexed but add Canva-specific sizing examples before any FAQ schema. |
| `/svg-resizer-for-etsy` | `app/routes/svg-resizer-for-etsy.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resizer-for-etsy` | `SVG Resizer for Etsy | iLoveSVG` | Resize SVG assets for Etsy listing visuals, digital download previews, product graphics, and seller files. | `SVG Resizer for Etsy` | Same resize settings and generic resizer section; fallback route guide: Etsy practical workflow notes | Same visible FAQ as generic resizer, no FAQPage JSON-LD | wrapper imports `./svg-resize-and-scale-editor` and routeMeta factory | Etsy listing, digital product, shop asset sizing | thin-risk | 3 | Keep indexed but add listing preview and digital download examples. |
| `/svg-resizer-for-figma` | `app/routes/svg-resizer-for-figma.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resizer-for-figma` | `SVG Resizer for Figma | iLoveSVG` | Resize SVG assets for Figma handoff, viewBox checks, component sizing, and predictable exports. | `SVG Resizer for Figma` | Same resize settings and generic resizer section; fallback route guide: Figma practical workflow notes | Same visible FAQ as generic resizer, no FAQPage JSON-LD | wrapper imports `./svg-resize-and-scale-editor` and routeMeta factory | Figma handoff, component sizing, import/export review | thin-risk | 3 | Keep indexed but add component/viewBox handoff examples. |
| `/svg-resizer-for-glowforge` | `app/routes/svg-resizer-for-glowforge.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resizer-for-glowforge` | `SVG Resizer for Glowforge | iLoveSVG` | Resize SVG artwork for Glowforge-style laser prep while keeping viewBox and dimensions predictable. | `SVG Resizer for Glowforge` | Same resize settings and generic resizer section; fallback route guide: Glowforge practical workflow notes | Same visible FAQ as generic resizer, no FAQPage JSON-LD | wrapper imports `./svg-resize-and-scale-editor` and routeMeta factory | Laser workspace/material size review | thin-risk | 3 | Keep indexed but add material/workspace size review and no-guarantee language. |
| `/svg-resizer-for-shopify` | `app/routes/svg-resizer-for-shopify.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resizer-for-shopify` | `SVG Resizer for Shopify | iLoveSVG` | Resize Shopify SVG logos, theme graphics, badges, and brand assets while keeping the SVG editable. | `SVG Resizer for Shopify` | Same resize settings and generic resizer section; fallback route guide: Shopify practical workflow notes | Same visible FAQ as generic resizer, no FAQPage JSON-LD | wrapper imports `./svg-resize-and-scale-editor` and routeMeta factory | Storefront logo/icon/theme asset sizing | thin-risk | 3 | Keep indexed but add theme logo/icon/badge sizing examples. |
| `/svg-resizer-for-silhouette` | `app/routes/svg-resizer-for-silhouette.tsx` | platform wrapper | yes, `xml-and-html` | `https://www.ilovesvg.com/svg-resizer-for-silhouette` | `SVG Resizer for Silhouette | iLoveSVG` | Resize SVG artwork for Silhouette-style vinyl, sticker, decal, and cutting software projects. | `SVG Resizer for Silhouette` | Same resize settings and generic resizer section; fallback route guide: Silhouette practical workflow notes | Same visible FAQ as generic resizer, no FAQPage JSON-LD | wrapper imports `./svg-resize-and-scale-editor` and routeMeta factory | Cutting workspace, vinyl/decal/sticker size review | thin-risk | 3 | Keep indexed but add Silhouette Studio project-size examples. |

Primary keywords:

- `/svg-resize-and-scale-editor`: `svg resizer`, `resize svg`, `scale svg`, `svg viewBox editor`
- `/svg-resizer-for-canva`: `canva svg resizer`, `resize svg for canva`
- `/svg-resizer-for-etsy`: `etsy svg resizer`, `resize etsy svg`, `seller file sizing`
- `/svg-resizer-for-figma`: `figma svg resizer`, `resize svg figma`, `viewBox handoff`
- `/svg-resizer-for-glowforge`: `glowforge svg resizer`, `laser svg size`, `resize laser file`
- `/svg-resizer-for-shopify`: `shopify svg resizer`, `resize store logo`, `theme svg size`
- `/svg-resizer-for-silhouette`: `silhouette svg resizer`, `resize cut file`, `vinyl size`

Secondary keywords:

- width, height, viewBox, preserveAspectRatio, responsive SVG, exact dimensions, scale percentage, component sizing, listing previews, storefront logo, laser workspace, cut-file sizing.

### Adjacent SVG Editor Utility Routes

These routes are related to the SVG editor family, but they should not be mixed into the first cleaner/resizer platform implementation. Most are route-local, already have clearer task-specific behavior, and carry lower doorway risk than the platform wrappers.

| Path | Source file | Route type | Indexable/sitemap | Canonical | Title | Description length | H1 | FAQ/schema | Risk | Score | Classification |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | ---: | --- |
| `/svg-minifier` | `app/routes/svg-minifier.tsx` | optimizer | yes, `xml-and-html` | correct | `SVG Minifier - Compress SVG Markup in Your Browser | iLoveSVG` | 154 | `SVG Minify` | Visible FAQ plus FAQPage JSON-LD, 4 questions | acceptable | 5 | Belongs with generic cleaner/resizer core route batch because minify vs clean distinction matters. |
| `/svg-file-size-inspector` | `app/routes/svg-file-size-inspector.tsx` | inspector | yes, `xml-and-html` | correct | `SVG File Size Inspector - Check KB and Compression | iLoveSVG` | 158 | `SVG Size Inspector` | Visible FAQ plus FAQPage JSON-LD, 5 questions | acceptable | 4 | Adjacent to core optimization, useful in SEO-D-B. |
| `/svg-dimensions-inspector` | `app/routes/svg-dimensions-inspector.tsx` | inspector | yes, `xml-and-html` | correct | `SVG Dimensions Inspector - ViewBox, Width and Height | iLoveSVG` | 154 | `SVG Dimension Inspector` | Visible FAQ plus FAQPage JSON-LD, 6 questions | acceptable | 4 | Adjacent to generic resizer, useful in SEO-D-B. |
| `/svg-stroke-width-editor` | `app/routes/svg-stroke-width-editor.tsx` | editor | yes, `xml-and-html` | correct | `SVG Stroke Width Editor - Adjust SVG Line Thickness | iLoveSVG` | 144 | `SVG Stroke Width Editor` | Visible FAQ plus FAQPage JSON-LD, 5 questions | acceptable | 4 | Defer to adjacent editor utility phase. |
| `/svg-flip-and-rotate-editor` | `app/routes/svg-flip-and-rotate-editor.tsx` | editor | yes, `xml-and-html` | correct | `SVG Flip and Rotate Editor - Mirror or Rotate SVG | iLoveSVG` | 162 | `SVG Flip & Rotate Editor` | Visible FAQ plus FAQPage JSON-LD, 5 questions | acceptable | 4 | Defer to adjacent editor utility phase. |
| `/svg-recolor` | `app/routes/svg-recolor.tsx` | editor | yes, `xml-and-html` | correct | `SVG Recolor Tool - Replace Fill and Stroke Colors | iLoveSVG` | 163 | `SVG Recolor` | Visible FAQ plus FAQPage JSON-LD, 5 questions | acceptable | 4 | Defer to adjacent editor utility phase. |
| `/svg-background-editor` | `app/routes/svg-background-editor.tsx` | editor | yes, `xml-and-html` | correct | `SVG Background Editor - Change or Remove SVG Backgrounds | iLoveSVG` | 171 | `SVG Background Editor` | Visible FAQ plus FAQPage JSON-LD, 8 questions | acceptable, snippet long | 4 | Defer to adjacent editor utility phase; later tighten overlong description. |
| `/svg-accessibility-and-contrast-checker` | `app/routes/svg-accessibility-and-contrast-checker.tsx` | inspector/accessibility | yes, `xml-and-html` | correct | `SVG Contrast Checker - WCAG Color Accessibility | iLoveSVG` | 139 | `SVG Accessibility and Contrast Checker` | FAQPage JSON-LD, 4 questions | strong | 5 | Defer, separate accessibility-focused route. |
| `/svg-preview-viewer` | `app/routes/svg-preview-viewer.tsx` | viewer/inspector | yes, `xml-and-html` | correct | `SVG Viewer - Preview, Zoom, Pan and Inspect | iLoveSVG` | 160 | `SVG Viewer` | FAQPage JSON-LD, 5 questions | acceptable | 4 | Defer to adjacent editor utility phase. |

## 3. Cleaner Route Findings

Strengths:

- The generic cleaner page has real utility-first content and accurate limitations.
- It explains the difference between Safe, Normal, and Aggressive cleanup.
- It warns that ids, defs, gradients, masks, clip paths, symbols, and `url(#id)` references can break if removed.
- It accurately states that processing runs in the browser.
- It distinguishes cleanup from raster-to-SVG tracing.

Cleaner platform risks:

- The platform wrappers inherit the same main `SVG Cleaner (Remove Metadata and Comments)` lower-page section.
- The fallback guide adds a platform-specific H2 and intro, but most of the content comes from group defaults.
- The page titles are unique but thin: `SVG Cleaner for {Platform} | iLoveSVG`.
- The visible FAQ and FAQPage schema are identical across `/svg-cleaner`, `/svg-cleaner-for-figma`, `/svg-cleaner-for-glowforge`, and `/svg-cleaner-for-silhouette`.
- Figma, Glowforge, and Silhouette need different examples. Figma is design import/editing. Glowforge is laser/cut/engraving review. Silhouette is cutting software and cut path clarity.

Recommended cleaner direction:

- Keep all cleaner routes indexed for now.
- Do not add more cleaner platform pages until the existing three have stronger route-specific content.
- Rewrite platform cleaner route guide sections before changing metadata aggressively.
- Either make the platform cleaner FAQ route-specific or remove FAQ schema from platform wrappers later.
- Keep claims honest: cleaner can reduce markup clutter and remove unsafe content, but it cannot certify Figma import, Glowforge acceptance, or Silhouette cut readiness.

## 4. Resizer/Scaler Route Findings

Strengths:

- The generic resizer page explains width, height, viewBox, scale percentage, preserveAspectRatio, responsive SVG, and cropping.
- The route has no FAQPage JSON-LD, which lowers schema duplication risk.
- The tool behavior is clearly client-side and route-specific.
- The platform wrappers have unique metadata and correct canonicals.

Resizer platform risks:

- All platform resizer wrappers inherit the same main `SVG Resize / Scale Tool (Client-Side)` section.
- All platform resizer wrappers inherit the same visible FAQ, although no FAQPage schema is emitted.
- The fallback guide gives the right route-specific title, but content is mostly group-level default guidance.
- Platform titles are unique but thin: `SVG Resizer for {Platform} | iLoveSVG`.
- Platform-specific use cases are plausible, but not deep enough in the lower-page copy.

Recommended resizer direction:

- Keep all resizer routes indexed for now.
- Do not add FAQ schema to platform resizer routes unless the FAQ is actually platform-specific.
- Add concise examples that explain how resizing differs by destination:
  - Canva: design uploads, layout sizing, transparent graphics.
  - Etsy: listing previews, digital product previews, shop assets.
  - Figma: component sizing, import/export handoff, viewBox review.
  - Glowforge: workspace/material sizing and review before laser use.
  - Shopify: storefront logos, icons, badges, theme graphics.
  - Silhouette: cutting workspace, vinyl/sticker/decal project size.
- Avoid platform approval claims and avoid implying resizing makes files machine-ready.

## 5. Adjacent SVG Editor Utility Findings

Adjacent routes have lower duplicate risk than the platform wrappers because most are route-local implementations with distinct controls and route-specific FAQs.

Routes that belong near the first implementation batch:

- `/svg-minifier`
- `/svg-file-size-inspector`
- `/svg-dimensions-inspector`

Reason:

- They directly support cleaner/resizer workflows.
- They help explain differences among cleanup, minification, file size inspection, dimensions, width/height, and viewBox.
- They are useful internal links for both generic and platform cleaner/resizer pages.

Routes to defer:

- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`
- `/svg-recolor`
- `/svg-background-editor`
- `/svg-accessibility-and-contrast-checker`
- `/svg-preview-viewer`

Reason:

- They are useful but less central to cleaner/resizer duplicate risk.
- They involve separate user intents and should be audited as adjacent editor utilities later.
- Some are complex route modules, so implementation should stay narrow.

## 6. Duplicate/Thin-Page Risks

### High Risk

Cleaner platform routes:

- `/svg-cleaner-for-figma`
- `/svg-cleaner-for-glowforge`
- `/svg-cleaner-for-silhouette`

Why:

- Same shared cleaner body.
- Same visible FAQ.
- Same FAQPage JSON-LD.
- Same title pattern.
- Platform-specific guide is generated from a fallback model and does not yet include enough unique examples.

### Medium To High Risk

Resizer platform routes:

- `/svg-resizer-for-canva`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-figma`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-silhouette`

Why:

- Same shared resizer body.
- Same visible FAQ.
- No FAQ schema, which helps, but visible duplicate content remains.
- Metadata is unique but short.
- Platform-specific examples are thin.

### Medium Risk

Generic cleaner/resizer support routes:

- `/svg-minifier`
- `/svg-file-size-inspector`
- `/svg-dimensions-inspector`

Why:

- Good utility value and route-local content.
- Need clear internal differentiation so users understand cleaner vs minifier vs file-size inspector vs dimensions inspector vs resizer.

### Lower Risk

Other adjacent editor utilities:

- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`
- `/svg-recolor`
- `/svg-background-editor`
- `/svg-accessibility-and-contrast-checker`
- `/svg-preview-viewer`

Why:

- Each route has a distinct editor or inspector task.
- Most have route-specific FAQ/schema.
- Some descriptions are near or above the current SEO audit length threshold, but this is a metadata polish issue rather than a doorway-page issue.

## 7. Doorway-Page Risk Assessment

The cleaner/resizer platform pages are not pure doorway pages because:

- They resolve to working tools.
- The route names match plausible real search intent.
- The canonical URL matches each indexable route.
- Titles and descriptions are unique.
- The pages expose real SVG editor behavior.

The platform pages can still look doorway-like because:

- Platform wrappers mostly share the same route template.
- The main lower-page content is generic.
- The platform-specific section is a fallback guide rather than a fully route-authored workflow.
- Cleaner pages repeat identical FAQ schema.
- All Tools sections create many platform mentions, which should not be mistaken for platform-specific body value.

No deletion is recommended in this audit. Noindex/canonical review should be deferred until there is stronger evidence from search data, indexing behavior, or page-quality performance. The near-term fix should be route-specific content and schema discipline, not removal.

## 8. Search Intent Differentiation Plan

### Generic SVG Cleaner

Primary intent: clean, simplify, and make SVG markup safer/easier to reuse.

Should focus on:

- Removing metadata, comments, editor namespaces, XML/DOCTYPE wrappers, unsafe scripts, event handlers, JavaScript URLs, and whitespace bloat.
- Explaining Safe, Normal, and Aggressive modes.
- Explaining what should not be removed: ids, defs, gradients, masks, clip paths, symbols, filters, and `url(#id)` references.
- Preview-before-export guidance.

Do not overclaim:

- It does not redesign artwork.
- It does not guarantee every malformed SVG is fixed.
- It does not certify compatibility with design, cutting, or laser software.

### SVG Cleaner For Figma

Primary intent: prepare or clean SVGs for Figma import/editing and design handoff.

Should focus on:

- Cleaning editor clutter before handoff.
- Preserving shapes, groups, fills, strokes, gradients, masks, and reusable references where possible.
- Avoiding aggressive cleanup that breaks import visuals.
- Examples: icons, logos, product UI illustrations, design-system assets.

Avoid:

- Glowforge laser framing.
- Silhouette cut-file framing.
- Claims that every SVG will import as perfectly editable Figma layers.

### SVG Cleaner For Glowforge

Primary intent: clean SVG markup before Glowforge-style laser/cut/engraving review.

Should focus on:

- Removing nonvisual clutter before testing import.
- Reviewing path complexity and dimensions after cleanup.
- Preserving geometry and required references.
- Examples: logos, simple outlines, engraving marks, cutting artwork.

Avoid:

- Guaranteed laser-ready claims.
- Platform approval claims.
- Figma design-system language as the main intent.

### SVG Cleaner For Silhouette

Primary intent: clean SVG markup before Silhouette Studio or cutting-software review.

Should focus on:

- Cut path clarity.
- Removing import noise without breaking visible paths.
- Reviewing size, tiny islands, outlines, and path behavior before cutting.
- Examples: decals, vinyl, labels, sticker outlines, simple craft graphics.

Avoid:

- Cricut-specific wording as the main intent.
- Glowforge laser/engraving framing.
- Guaranteed cut-ready claims.

### Generic SVG Resizer/Scaler

Primary intent: resize or scale SVG dimensions/viewBox while preserving vector quality.

Should focus on:

- Width and height as viewport.
- viewBox as internal coordinate system.
- Scale percentage.
- preserveAspectRatio and responsive SVG behavior.
- Cropping risk when viewBox does not match artwork.

### Platform Resizers

Canva:

- Design uploads, layout sizing, transparent logos, scalable graphics, predictable canvas dimensions.
- Avoid implying official Canva validation.

Etsy:

- Listing visuals, digital product previews, shop graphics, seller asset handoff.
- Avoid overclaiming listing acceptance or sell-ready files.

Figma:

- Component sizing, icon systems, design-system assets, import/export handoff, viewBox review.
- Avoid claiming every SVG becomes perfectly editable.

Glowforge:

- Workspace/material sizing, laser software preview, dimensions review before laser use.
- Avoid guaranteed cut/engrave readiness.

Shopify:

- Storefront logos, badges, icons, theme graphics, favicon prep adjacency.
- Avoid marketplace/POD framing as the main intent.

Silhouette:

- Cutting workspace/project size, vinyl/sticker/decal layout, review in cutting software.
- Avoid Cricut-specific Print Then Cut wording as the main intent.

## 9. Metadata Audit

Metadata strengths:

- No exact duplicate titles were found among audited target routes.
- No exact duplicate descriptions were found among audited target routes.
- Canonicals resolve to the expected public route URLs.
- H1s match route intent.
- Platform descriptions are unique and generally honest.

Metadata risks:

- Platform wrapper titles are short and formulaic:
  - `SVG Cleaner for {Platform} | iLoveSVG`
  - `SVG Resizer for {Platform} | iLoveSVG`
- Short titles are not spammy, but they do not communicate enough route-specific value.
- `/svg-resize-and-scale-editor` title is 71 characters and may be worth tightening later.
- `/svg-background-editor` description is 171 characters, slightly over the current focused SEO audit max of 170 if this route is added to that audit.
- Platform descriptions are natural, but they lean on broad phrases like handoff, path review, and predictable dimensions without enough supporting body examples yet.

Metadata recommendations:

- Do not change metadata before improving visible platform content.
- For platform cleaners, improve body copy and FAQ/schema first, then consider sharper titles.
- For platform resizers, improve body copy first, then consider titles that include the practical output use case, not just the platform name.
- Keep descriptions concise and avoid long keyword chains.
- Do not add claims of official platform compatibility, approval, or machine readiness.

## 10. FAQ/Schema Audit

### Cleaner Routes

Status:

- `/svg-cleaner` and all three cleaner platform wrappers emit FAQPage JSON-LD.
- Visible FAQ matches schema.
- The FAQ is honest and useful for the generic cleaner route.
- The FAQ is duplicated across all cleaner platform wrappers.

Classification:

- `/svg-cleaner`: acceptable.
- `/svg-cleaner-for-figma`: duplicate-risk, should rewrite FAQ or remove platform wrapper FAQ schema later.
- `/svg-cleaner-for-glowforge`: duplicate-risk, should rewrite FAQ or remove platform wrapper FAQ schema later.
- `/svg-cleaner-for-silhouette`: duplicate-risk, should rewrite FAQ or remove platform wrapper FAQ schema later.

Recommended later action:

- Keep the generic cleaner FAQ/schema if content remains aligned.
- For platform cleaner routes, either:
  - add route-specific visible FAQ and matching schema, or
  - render visible help without FAQPage JSON-LD to avoid repeated schema blocks.

### Resizer Routes

Status:

- `/svg-resize-and-scale-editor` and platform resizer wrappers render the same visible FAQ.
- No FAQPage JSON-LD is emitted for the resizer template.

Classification:

- `/svg-resize-and-scale-editor`: acceptable.
- Platform resizers: visible FAQ duplicate-risk, schema risk low because there is no FAQPage JSON-LD.

Recommended later action:

- Do not add FAQ schema broadly.
- If FAQ is kept on platform resizers, make the visible FAQ platform-specific before adding any schema.

### Adjacent Editor Utilities

Status:

- Most adjacent utility routes emit route-specific FAQPage JSON-LD and visible FAQ content.
- These are less duplicate-prone than cleaner/resizer platform wrappers.

Classification:

- `/svg-minifier`: acceptable.
- `/svg-file-size-inspector`: acceptable.
- `/svg-dimensions-inspector`: acceptable.
- `/svg-stroke-width-editor`: acceptable.
- `/svg-flip-and-rotate-editor`: acceptable.
- `/svg-recolor`: acceptable.
- `/svg-background-editor`: acceptable but longer FAQ and description should be reviewed later.
- `/svg-accessibility-and-contrast-checker`: strong.
- `/svg-preview-viewer`: acceptable.

## 11. Prioritized Implementation Batches

### SEO-D-B: Generic Cleaner/Resizer Core Routes

Routes:

- `/svg-cleaner`
- `/svg-resize-and-scale-editor`
- `/svg-minifier`
- `/svg-file-size-inspector`
- `/svg-dimensions-inspector`

Risk level: low to medium.

Why first:

- These routes are the source of truth for the platform wrappers.
- They establish the right distinctions among cleanup, minification, dimensions, file size, and resizing.
- Improving generic sections first reduces duplication pressure in platform batches.

Metadata changes needed:

- Consider tightening `/svg-resize-and-scale-editor` title length.
- Keep `/svg-cleaner` metadata unless visible content changes create a better natural snippet.
- Keep descriptions under the current `scripts/seo-audit.mjs` max description length if routes are added to focused SEO checks.

Content changes needed:

- Clarify cleaner vs minifier.
- Clarify dimensions inspector vs resizer.
- Add concise examples for when to use each route.
- Keep safety/viewBox/id/defs limitations honest.

FAQ/schema action:

- Keep generic FAQ/schema where visible and useful.
- Do not add new FAQ schema broadly.

Tests to run:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run test:seo`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

### SEO-D-C: SVG Cleaner Platform Routes

Routes:

- `/svg-cleaner-for-figma`
- `/svg-cleaner-for-glowforge`
- `/svg-cleaner-for-silhouette`

Risk level: medium to high.

Metadata changes needed:

- Titles can stay short if body content becomes strong.
- Descriptions may need platform-specific sharpening after body copy is improved.

Content changes needed:

- Add platform-specific examples and limitations.
- Distinguish Figma import/editing from Glowforge laser prep and Silhouette cutting workflows.
- Avoid wrong-platform main copy.

FAQ/schema action:

- Highest priority in this batch.
- Rewrite visible FAQ and schema to be route-specific, or remove platform wrapper FAQ schema.
- Do not keep identical FAQPage JSON-LD across all cleaner platform pages.

Tests to run:

- Same required suite as SEO-D-B.
- Add or update `scripts/seo-audit.mjs` checks for cleaner platform route uniqueness, required platform terms, and no wrong-platform main headings.

### SEO-D-D: SVG Resizer Platform Routes

Routes:

- `/svg-resizer-for-canva`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-figma`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-silhouette`

Risk level: medium.

Metadata changes needed:

- Keep current descriptions if they remain aligned.
- Consider title improvement only after body content is route-specific.

Content changes needed:

- Add platform examples around sizing, viewBox, preview, and review-before-use.
- Avoid platform approval and machine-ready claims.
- Do not make all six pages the same with platform names swapped.

FAQ/schema action:

- Do not add FAQ schema in this batch unless FAQ becomes route-specific.
- Consider trimming or contextualizing shared visible FAQ for platform wrappers.

Tests to run:

- Same required suite as SEO-D-B.
- Add focused SEO checks for unique platform titles/descriptions, required platform/workflow body terms, description length, title length, and no wrong-platform main headings.

### SEO-D-E: Adjacent Editor Utilities

Routes:

- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`
- `/svg-recolor`
- `/svg-background-editor`
- `/svg-accessibility-and-contrast-checker`
- `/svg-preview-viewer`

Risk level: low to medium.

Metadata changes needed:

- Tighten `/svg-background-editor` description if added to focused SEO checks.
- Review near-threshold descriptions for `/svg-recolor`, `/svg-flip-and-rotate-editor`, and `/svg-preview-viewer`.

Content changes needed:

- Keep each route focused on its actual editor behavior.
- Do not convert adjacent utilities into platform wrappers.

FAQ/schema action:

- Keep route-specific FAQ only where visible and useful.
- Check visible/schema parity route by route.

Tests to run:

- Same required suite as SEO-D-B.
- Consider targeted browser/accessibility smoke if UI copy or layout is touched.

## 12. Routes To Defer

Defer from SEO-D-B/C/D:

- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`
- `/svg-recolor`
- `/svg-background-editor`
- `/svg-accessibility-and-contrast-checker`
- `/svg-preview-viewer`
- `/svg-to-base64`
- `/base64-to-svg`
- `/svg-to-jsx-converter`
- `/code-to-svg-for-cricut`
- `/base64-to-svg-for-cricut`
- `/svg-to-favicon-for-shopify`
- `/logo-to-favicon-for-shopify`
- `/how-it-works`
- `/how-it-works/*`

Reasons:

- Adjacent editor routes deserve a separate route-local utility audit.
- Developer/code routes are a different technical audience.
- Shopify favicon wrappers are a separate platform-export surface.
- Docs/help pages support user education and internal linking, but they are not the highest duplicate/thin risk.

Noindex/canonical review:

- Defer unless search data, indexing evidence, or repeated thin-page failures show that a page should be consolidated.
- Do not noindex useful platform tools based only on shared implementation.

## 13. Regression Gates For Implementation

For any implementation phase that follows this audit:

- Preserve route URLs.
- Preserve conversion/editor behavior.
- Preserve presets and upload validation.
- Preserve sitemap and navigation unless a direct bug is found.
- Keep platform claims honest and avoid compatibility/certification language.
- Do not expand FAQ schema broadly.
- Do not create repeated FAQPage schema across platform wrappers.
- Keep visible FAQ aligned with JSON-LD when schema is emitted.
- Keep titles and descriptions unique.
- Keep descriptions concise and natural.
- Add focused SEO audit checks before or during implementation:
  - target routes have unique titles and descriptions.
  - cleaner platform routes include the correct platform intent.
  - resizer platform routes include the correct platform/sizing intent.
  - platform pages do not contain wrong-platform main headings.
  - platform descriptions are not empty or excessively long.
  - platform title patterns are not keyword-stuffed.
  - cleaner platform FAQ/schema is not duplicated unchanged across all wrappers.
- Required validation commands:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
  - `npm.cmd run test:route-coverage`
  - `npm.cmd run test:navigation`
  - `npm.cmd run test:nav`
  - `npm.cmd run test:links`
  - `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
  - `npm.cmd run test:seo`
  - `npm.cmd run build`
  - `npm.cmd audit`
  - `git diff --check`
