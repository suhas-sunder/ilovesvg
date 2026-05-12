# Phase SEO-E-A: Adjacent SVG Editor and Developer Utility SEO Audit

Date: 2026-05-12

Branch audited: `monetization-affiliate-intent-may-10`

Baseline commit present: `8709042 fix: improve affiliate intent matching`

Scope: report-only audit of adjacent SVG editor, inspection, preview, accessibility, Base64, embed, JSX, text, emoji, and code utility routes. No route URLs, metadata, page copy, schema, sitemap, navigation, conversion behavior, presets, upload validation, or monetization behavior were changed.

## 1. Executive Summary

The adjacent SVG editor and developer utility routes are generally stronger than the earlier platform-wrapper clusters because most pages have route-local tools, route-local settings, and visible workflow-specific help content. The largest SEO risks are not broad doorway-page duplication. They are narrower:

- Developer/code utilities have mixed intent boundaries, especially routes that handle SVG code, Base64, data URIs, CSS snippets, Markdown, and Cricut framing in one page.
- Several routes have FAQ/schema alignment issues or schema-format inconsistencies that should be fixed before expanding any FAQ markup.
- A few titles and descriptions are overlong or too broad for their exact utility.
- Inspection routes should stay differentiated from editing routes so they do not imply behavior they do not perform.
- Some already-improved generic SVG routes should be left unchanged in SEO-E implementation batches to avoid churn.

Recommended first implementation batch: `SEO-E-B: low-risk SVG editor utilities`, covering:

- `/svg-background-editor`
- `/svg-recolor`
- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`

This batch is the safest because the routes are concrete editor tools with clear route-local behavior and lower duplicate-page risk. It should also fix the `/svg-stroke-width-editor` FAQ JSON-LD and visible FAQ question mismatch.

## 2. Routes Audited

### Primary SVG Editor Utility Routes

| Path | Source file | Type | Indexable | Sitemap | Canonical | Current title | Current description | H1 / tool title | FAQ/schema |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/svg-background-editor` | `app/routes/svg-background-editor.tsx` | SVG editor | Yes | XML and HTML | `/svg-background-editor` | `SVG Background Editor - Change or Remove SVG Backgrounds | iLoveSVG` | `Edit SVG backgrounds in your browser. Remove common full-canvas backgrounds, add transparent or solid backgrounds, replace with SVG underlays, preview, copy, and download.` | `SVG Background Editor` | FAQPage JSON-LD and visible FAQ |
| `/svg-recolor` | `app/routes/svg-recolor.tsx` | SVG editor | Yes | XML and HTML | `/svg-recolor` | `SVG Recolor Tool - Replace Fill and Stroke Colors | iLoveSVG` | `Recolor SVG files in your browser. Extract the color palette, replace fill and stroke colors, convert icons to currentColor, preview, and download the updated SVG.` | `SVG Recolor` | FAQPage JSON-LD and visible FAQ |
| `/svg-stroke-width-editor` | `app/routes/svg-stroke-width-editor.tsx` | SVG editor | Yes | XML and HTML | `/svg-stroke-width-editor` | `SVG Stroke Width Editor - Adjust SVG Line Thickness | iLoveSVG` | `Adjust SVG stroke widths online. Make lines thicker or thinner, add missing strokes, preserve fills, preview changes instantly, and download the edited SVG.` | `SVG Stroke Width Editor` | FAQPage JSON-LD and visible FAQ, mismatch risk |
| `/svg-flip-and-rotate-editor` | `app/routes/svg-flip-and-rotate-editor.tsx` | SVG editor | Yes | XML and HTML | `/svg-flip-and-rotate-editor` | `SVG Flip and Rotate Editor - Mirror or Rotate SVG | iLoveSVG` | `Flip or rotate SVG files in your browser. Mirror horizontally or vertically, rotate by preset angles, preview instantly, then copy or download the updated SVG.` | `SVG Flip & Rotate Editor` | FAQPage JSON-LD and visible FAQ |
| `/svg-accessibility-and-contrast-checker` | `app/routes/svg-accessibility-and-contrast-checker.tsx` | SVG editor / checker | Yes | XML and HTML | `/svg-accessibility-and-contrast-checker` | `SVG Contrast Checker - WCAG Color Accessibility | iLoveSVG` | `Check SVG color contrast, inspect text readability, preview safer color pairs, and export an accessible SVG update from your browser.` | `SVG Accessibility and Contrast Checker` | FAQPage JSON-LD and visible FAQ |
| `/svg-preview-viewer` | `app/routes/svg-preview-viewer.tsx` | SVG preview utility | Yes | XML and HTML | `/svg-preview-viewer` | `SVG Viewer - Preview, Zoom, Pan and Inspect | iLoveSVG` | `Open SVG files in a safe browser viewer. Preview, zoom, pan, inspect metadata, copy markup, and download the SVG without sending it to a server.` | `SVG Viewer` | FAQPage JSON-LD and visible FAQ |

### SVG Inspection Routes

| Path | Source file | Type | Indexable | Sitemap | Canonical | Current title | Current description | H1 / tool title | FAQ/schema |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/svg-file-size-inspector` | `app/routes/svg-file-size-inspector.tsx` | SVG inspector | Yes | XML and HTML | `/svg-file-size-inspector` | `SVG File Size Inspector - Check SVG Weight | iLoveSVG` | `Inspect SVG file size, markup weight, image embeds, and optimization hints before cleaning, minifying, or publishing the file.` | `SVG Size Inspector` | FAQPage JSON-LD and visible FAQ |
| `/svg-dimensions-inspector` | `app/routes/svg-dimensions-inspector.tsx` | SVG inspector | Yes | XML and HTML | `/svg-dimensions-inspector` | `SVG Dimensions Inspector - ViewBox, Width and Height | iLoveSVG` | `Inspect SVG width, height, viewBox, rendered size, and scaling behavior before resizing, embedding, or exporting.` | `SVG Dimension Inspector` | FAQPage JSON-LD and visible FAQ |

### Developer and Code Utility Routes

| Path | Source file | Type | Indexable | Sitemap | Canonical | Current title | Current description | H1 / tool title | FAQ/schema |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/svg-to-base64` | `app/routes/svg-to-base64.tsx` | Developer utility | Yes | XML and HTML | `/svg-to-base64` | `SVG to Base64 Converter - Encode SVG Data URLs | iLoveSVG` | `Convert SVG to Base64 or URL-encoded data URIs for CSS, HTML, React, email previews, prototypes, and quick embeds. Works in your browser.` | `SVG to Base64` | FAQPage JSON-LD and visible FAQ |
| `/base64-to-svg` | `app/routes/base64-to-svg.tsx` | Developer utility | Yes | XML and HTML | `/base64-to-svg` | `Base64 to SVG Converter - Decode SVG Data URLs | iLoveSVG` | `Decode Base64 SVG strings and SVG data URIs into readable SVG markup. Preview, copy, and download the cleaned SVG file in your browser.` | `Base64 to SVG converter` | Visible FAQ microdata, no FAQPage JSON-LD |
| `/base64-to-svg-for-cricut` | `app/routes/base64-to-svg-for-cricut.tsx` | Developer / Cricut utility | Yes | XML and HTML | `/base64-to-svg-for-cricut` | `Base64 to SVG for Cricut - Decode Base64 SVG Online` | `Decode Base64 SVG strings, SVG data URIs, and simple Cricut-ready SVG code into readable markup you can preview, clean up, and download for Design Space.` | `Base64 to SVG for Cricut` | Visible FAQ microdata, no FAQPage JSON-LD |
| `/svg-to-jsx-converter` | `app/routes/svg-to-jsx-converter.tsx` | Developer utility | Yes | XML and HTML | `/svg-to-jsx-converter` | `SVG to JSX Converter | iLoveSVG` | `Convert SVG markup into React-friendly JSX with camelCased attributes and safer copy-ready formatting. Paste SVG code and export a JSX component.` | `SVG to JSX Converter` | No visible FAQ and no FAQPage JSON-LD |
| `/svg-embed-code-generator` | `app/routes/svg-embed-code-generator.tsx` | Developer utility | Yes | XML and HTML | `/svg-embed-code-generator` | `SVG Embed Code Generator - IMG, Inline, CSS and React | iLoveSVG` | `Generate SVG embed snippets for img tags, inline SVG, CSS backgrounds, masks, React JSX, Markdown, and data URIs with copy-ready code.` | `SVG Embed Code Generator` | FAQPage JSON-LD and visible FAQ, mismatch risk |
| `/inline-svg-vs-img` | `app/routes/inline-svg-vs-img.tsx` | Developer guide / utility | Yes | XML and HTML | `/inline-svg-vs-img` | `Inline SVG vs IMG Tag - Compare Embed Options | iLoveSVG` | `Compare inline SVG, img tags, object embeds, CSS backgrounds, data URIs, and React usage so you can choose the right SVG embed method.` | `Inline SVG vs <img>` | FAQPage JSON-LD and visible FAQ |
| `/text-to-svg-converter` | `app/routes/text-to-svg-converter.tsx` | Text to SVG utility | Yes | XML and HTML | `/text-to-svg-converter` | `Text to SVG Converter - Create SVG Text Online | iLoveSVG` | `Create SVG text with fonts, colors, outlines, shadows, and transparent backgrounds. Customize, preview, copy, or download text as SVG in your browser.` | `Text to SVG Converter` | FAQPage JSON-LD and visible FAQ, small mismatch risk |
| `/emoji-to-svg-converter` | `app/routes/emoji-to-svg-converter.tsx` | Emoji to SVG utility | Yes | XML and HTML | `/emoji-to-svg-converter` | `Emoji to SVG Converter - Convert Emoji to Vector SVG | iLoveSVG` | `Turn emoji characters into downloadable SVG artwork with transparent backgrounds. Choose size, font rendering, outline, shadow, and export settings.` | `Emoji to SVG Converter` | FAQPage JSON-LD and visible FAQ |
| `/code-to-svg-for-cricut` | `app/routes/code-to-svg-for-cricut.tsx` | Developer / Cricut utility | Yes | XML and HTML | `/code-to-svg-for-cricut` | `Code to SVG for Cricut - Convert Base64, Data URI, CSS, Markdown` | `Turn SVG code, Base64 data URIs, CSS background snippets, Markdown image links, raw SVG markup, and simple raster image data into downloadable SVG files you can inspect before using with Cricut Design Space.` | `Code to SVG for Cricut` | Visible FAQ microdata, no FAQPage JSON-LD |

### Adjacent Routes Included for Classification

| Path | Source file | Classification | Recommendation |
| --- | --- | --- | --- |
| `/free-color-picker` | `app/routes/free-color-picker.tsx` | Adjacent color utility | Defer unless color and palette utility SEO is batched later. Schema currently aligns after Schema-B. |
| `/svg-minifier` | `app/routes/svg-minifier.tsx` | Already covered by SEO-D-B | Leave unchanged in SEO-E unless a direct regression is found. |
| `/svg-cleaner` | `app/routes/svg-cleaner.tsx` | Already covered by SEO-D-B | Leave unchanged in SEO-E. |
| `/svg-resize-and-scale-editor` | `app/routes/svg-resize-and-scale-editor.tsx` | Already covered by SEO-D-B | Leave unchanged in SEO-E. |
| `/svg-to-css-background` | redirect to `/svg-embed-code-generator` | Redirect alias | Leave unchanged. |
| `/svg-to-data-uri-converter` | redirect to `/svg-to-base64` | Redirect alias | Leave unchanged. |
| `/svg-inline-code-generator` | redirect to `/svg-embed-code-generator` | Redirect alias | Leave unchanged. |
| `/svg-viewbox-editor` | redirect to `/svg-resize-and-scale-editor` | Redirect alias | Leave unchanged. |
| `/svg-code-cleaner` | redirect to `/svg-cleaner` | Redirect alias | Leave unchanged. |
| `/svg-transparent-background-tool` | redirect to `/svg-background-editor` | Redirect alias | Leave unchanged. |

## 3. SVG Editor Utility Findings

### `/svg-background-editor`

- Primary keyword: `svg background editor`
- Secondary keywords: `remove SVG background`, `transparent SVG background`, `add SVG background`, `SVG underlay`
- Search intent: edit or preview an SVG background without rasterizing the file.
- Lower-page sections: background settings, remove/add/replace background guidance, All SVG tools, social links.
- Related links: All SVG tools section plus editor-related internal links.
- Duplicate/thin risk: low to medium. The route has real editor behavior and specific background concepts. The description is long and mentions many actions at once.
- User-value score: 4/5.
- Recommended SEO action: tighten description, keep background-specific intent, clarify that it edits SVG background shapes or preview backgrounds rather than raster background removal.

### `/svg-recolor`

- Primary keyword: `svg recolor`
- Secondary keywords: `change SVG color`, `replace SVG fill`, `SVG stroke color editor`, `currentColor SVG`
- Search intent: recolor vector fills and strokes, inspect palette, export an updated SVG.
- Lower-page sections: recolor settings, recolor guide, practical workflow notes, All SVG tools.
- Duplicate/thin risk: low. The route has a clear utility and route-specific workflow notes.
- User-value score: 4/5.
- Recommended SEO action: light polish only. Preserve vector-fill framing and avoid implying raster recoloring.

### `/svg-stroke-width-editor`

- Primary keyword: `svg stroke width editor`
- Secondary keywords: `change SVG line thickness`, `SVG outline thickness`, `add missing strokes`
- Search intent: adjust stroke attributes and line thickness in SVG markup.
- Lower-page sections: stroke settings, client-side stroke adjuster guidance, practical workflow notes, All SVG tools.
- Duplicate/thin risk: low to medium. The tool is distinct, but FAQ/schema mismatch creates correctness risk.
- User-value score: 4/5.
- Recommended SEO action: implement in SEO-E-B. Align FAQ JSON-LD with visible FAQ, then improve title/description only if needed. Keep copy honest about fill-only artwork and stroke attribute limitations.

### `/svg-flip-and-rotate-editor`

- Primary keyword: `svg flip and rotate`
- Secondary keywords: `rotate SVG`, `mirror SVG`, `flip SVG horizontally`, `SVG transform`
- Search intent: transform orientation and export a modified SVG.
- Lower-page sections: transform settings, flip/rotate workflow notes, All SVG tools.
- Duplicate/thin risk: low. The intent is concrete and different from resize/recolor/background editing.
- User-value score: 4/5.
- Recommended SEO action: light copy and metadata sharpening only if useful. Keep transform/export framing.

### `/svg-accessibility-and-contrast-checker`

- Primary keyword: `svg contrast checker`
- Secondary keywords: `SVG accessibility checker`, `SVG color contrast`, `WCAG SVG colors`
- Search intent: check color contrast and readability issues in an SVG.
- Lower-page sections: preview, better contrast options, accessibility and contrast guidance, practical notes, All SVG tools.
- Duplicate/thin risk: medium. The tool is distinct, but accessibility wording must not imply certification or full compliance.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-C. Keep contrast and readability as the main promise. Avoid overclaiming WCAG approval.

### `/svg-preview-viewer`

- Primary keyword: `svg viewer`
- Secondary keywords: `preview SVG`, `inspect SVG`, `zoom SVG`, `safe SVG viewer`
- Search intent: view and inspect an SVG safely before copying, downloading, or using it elsewhere.
- Lower-page sections: viewer guidance, zoom/pan/inspect workflow notes, All SVG tools.
- Duplicate/thin risk: low to medium. The route is useful, but should stay preview-focused and avoid drifting into editor claims.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-C. Keep schema unchanged unless a direct audit issue returns.

## 4. SVG Inspection Utility Findings

### `/svg-file-size-inspector`

- Primary keyword: `svg file size inspector`
- Secondary keywords: `check SVG file size`, `SVG markup weight`, `large SVG file`, `optimize SVG size`
- Search intent: inspect why an SVG is heavy and decide whether to clean, minify, or simplify it.
- Lower-page sections: size details, size/metadata guidance, practical workflow notes, All SVG tools.
- Duplicate/thin risk: medium. The H1 says `SVG Size Inspector`, and one section references width, height, viewBox, and rendered pixels, which overlaps with `/svg-dimensions-inspector`.
- User-value score: 4/5.
- Recommended SEO action: leave core improvements from SEO-D-B intact, but in SEO-E-C clarify byte-size and markup-weight intent so it does not cannibalize the dimensions inspector.

### `/svg-dimensions-inspector`

- Primary keyword: `svg dimensions inspector`
- Secondary keywords: `SVG viewBox`, `SVG width height`, `inspect SVG size`, `rendered SVG size`
- Search intent: inspect dimensions, width, height, viewBox, and rendering scale.
- Lower-page sections: dimensions details, viewBox and scaling notes, practical workflow notes, All SVG tools.
- Duplicate/thin risk: low to medium. The route is well differentiated if `/svg-file-size-inspector` stays focused on bytes and markup weight.
- User-value score: 4/5.
- Recommended SEO action: likely leave mostly unchanged. Include in SEO-E-C only for cross-route differentiation checks.

## 5. Developer/Code Utility Findings

### `/svg-to-base64`

- Primary keyword: `svg to base64`
- Secondary keywords: `SVG data URI`, `encode SVG`, `base64 SVG converter`, `SVG to CSS data URL`
- Search intent: encode SVG markup into Base64 or URL-encoded data URI output for embeds.
- Lower-page sections: output settings, data URI workflow, practical usage notes, All SVG tools.
- Duplicate/thin risk: low to medium. It is clearly distinct from `/base64-to-svg`.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-D. Preserve data URI and embed intent, and avoid conflating Base64 with URL encoding in headings.

### `/base64-to-svg`

- Primary keyword: `base64 to svg`
- Secondary keywords: `decode SVG data URI`, `Base64 SVG decoder`, `data URI to SVG`
- Search intent: decode Base64 SVG strings or data URIs into readable SVG markup and downloadable files.
- Lower-page sections: decode workflow, preview/copy/download guidance, visible FAQ.
- Duplicate/thin risk: medium. Visible FAQ uses FAQPage microdata without JSON-LD, while related developer pages use JSON-LD. This is not necessarily invalid, but the schema format should be made intentional.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-D. Keep FAQ visible, decide whether to keep microdata or move to JSON-LD from the same data source, and clarify that raster Base64 is not magically converted to layered vectors unless actual tracing is used.

### `/base64-to-svg-for-cricut`

- Primary keyword: `base64 to svg for Cricut`
- Secondary keywords: `decode Base64 SVG for Cricut`, `data URI to SVG for Design Space`
- Search intent: decode SVG code/data URIs before inspecting or using the SVG in Cricut workflows.
- Lower-page sections: Cricut-oriented decode workflow, visible FAQ.
- Duplicate/thin risk: medium to high. It is close to `/base64-to-svg`, but adds Cricut-specific expectations and should not claim automatic cut-ready output.
- User-value score: 3/5.
- Recommended SEO action: include in SEO-E-D if developer/Cricut wrapper utilities are in scope. Make the FAQ and copy clearly Cricut workflow-specific or reduce schema emphasis.

### `/svg-to-jsx-converter`

- Primary keyword: `svg to jsx`
- Secondary keywords: `SVG to React component`, `convert SVG to JSX`, `camelCase SVG attributes`
- Search intent: convert SVG markup into React-compatible JSX.
- Lower-page sections: convert SVG markup, practical workflow notes, All SVG tools.
- Duplicate/thin risk: medium. It has no FAQ and a concise but generic title. The route can benefit from developer-specific examples and limitations.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-D. Improve title/description and lower-page guidance around React attributes, `viewBox`, props, and security without adding broad FAQ schema.

### `/svg-embed-code-generator`

- Primary keyword: `svg embed code generator`
- Secondary keywords: `inline SVG code`, `SVG img tag`, `SVG CSS background`, `SVG data URI`, `React SVG embed`
- Search intent: generate practical embed snippets for different web contexts.
- Lower-page sections: embed settings, embed code guidance, practical workflow notes, visible FAQ, All SVG tools.
- Duplicate/thin risk: high within this audit. The route covers many closely related intents and has a visible FAQ / JSON-LD question mismatch.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-D as a priority. Align schema with visible FAQ or remove FAQPage JSON-LD if the visible FAQ remains broader than the schema. Avoid stuffing every embed format into title and description.

### `/inline-svg-vs-img`

- Primary keyword: `inline SVG vs img`
- Secondary keywords: `SVG embed methods`, `inline SVG or img tag`, `SVG object tag`, `SVG data URI`
- Search intent: compare embed methods and help users choose an implementation approach.
- Lower-page sections: comparison content, visible FAQ, related embed utility links.
- Duplicate/thin risk: low to medium. The page is more guide-like than tool-like and should not compete too heavily with `/svg-embed-code-generator`.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-D, but keep it as a decision guide. Link toward the embed generator as the action page where already appropriate.

### `/text-to-svg-converter`

- Primary keyword: `text to SVG converter`
- Secondary keywords: `SVG text generator`, `text as SVG`, `outlined SVG text`, `transparent text SVG`
- Search intent: create SVG text artwork with font, color, outline, and export controls.
- Lower-page sections: text settings, design/export workflow, visible FAQ.
- Duplicate/thin risk: medium. It is distinct from code utilities, but one FAQ JSON-LD question differs slightly from the visible FAQ.
- User-value score: 4/5.
- Recommended SEO action: include in SEO-E-D. Align visible FAQ and schema question source, then improve route-specific text only where thin.

### `/emoji-to-svg-converter`

- Primary keyword: `emoji to SVG`
- Secondary keywords: `emoji SVG converter`, `emoji vector SVG`, `transparent emoji SVG`
- Search intent: render emoji characters into downloadable SVG artwork.
- Lower-page sections: emoji settings, export guidance, visible FAQ.
- Duplicate/thin risk: medium. Metadata should avoid implying every emoji becomes clean hand-authored vector paths if the output is font/rendering-dependent.
- User-value score: 3/5.
- Recommended SEO action: include in SEO-E-D after the developer routes with clearer blocker risk. Preserve Schema-B duplicate FAQPage fix.

### `/code-to-svg-for-cricut`

- Primary keyword: `code to SVG for Cricut`
- Secondary keywords: `data URI to SVG for Cricut`, `CSS background to SVG`, `SVG code for Cricut`, `Markdown image to SVG`
- Search intent: extract or decode SVG-like code snippets into inspectable SVG files for Cricut workflows.
- Lower-page sections: code extraction workflow, Cricut-oriented visible FAQ.
- Duplicate/thin risk: high. The route title and description include a long chain of input forms, and the description is overlong. It risks looking keyword-stuffed even if the tool genuinely supports multiple inputs.
- User-value score: 3/5.
- Recommended SEO action: include in SEO-E-D. Tighten metadata, clarify supported input types, and preserve honest limitations around raster data and cut readiness.

## 6. Duplicate/Thin-Page Risks

### Highest Risks

1. `/svg-embed-code-generator`
   - Reason: broad embed-method scope plus visible FAQ / FAQPage JSON-LD mismatch.
   - Risk: search engines may see schema quality issues, and the page may compete with `/svg-to-base64` and `/inline-svg-vs-img`.

2. `/code-to-svg-for-cricut`
   - Reason: long metadata, many input-type terms, and overlap with Base64/data URI routes.
   - Risk: route can appear keyword-chain heavy unless tightened around extracting inspectable SVG code for Cricut review.

3. `/base64-to-svg-for-cricut`
   - Reason: close wrapper around `/base64-to-svg` with Cricut framing.
   - Risk: needs explicit Cricut workflow value and transparent limitations.

4. `/svg-stroke-width-editor`
   - Reason: visible FAQ and JSON-LD FAQ questions do not fully match.
   - Risk: schema quality issue, not a doorway-page issue.

### Medium Risks

- `/svg-file-size-inspector` and `/svg-dimensions-inspector` can overlap if "size" copy is not consistently split between byte weight and rendered dimensions.
- `/svg-accessibility-and-contrast-checker` can overclaim if it implies full accessibility certification instead of contrast/readability checking.
- `/emoji-to-svg-converter` can overclaim if it implies clean vector tracing for every emoji source.
- `/free-color-picker` is adjacent but not central to SVG editor/developer utility SEO and should not be folded into this batch unless a color utility phase is planned.

### Lower Risks

- `/svg-recolor`
- `/svg-flip-and-rotate-editor`
- `/svg-preview-viewer`
- `/svg-to-base64`
- `/inline-svg-vs-img`

These routes have clearer intent boundaries and route-specific utility.

## 7. Search Intent Differentiation Plan

### SVG Background Editor

Intent: edit or preview SVG background behavior.

Should focus on:

- transparent versus solid SVG backgrounds
- background rectangles or underlays
- canvas/page preview background where applicable
- export after background adjustment

Should avoid:

- implying AI or raster background removal
- implying every visible background can be safely removed from complex SVG art
- duplicate raster image editor framing

### SVG Recolor

Intent: replace vector colors in SVG markup.

Should focus on:

- fill and stroke replacement
- palette inspection
- `currentColor` and icon workflows where supported
- preview and export

Should avoid:

- raster recoloring language
- photo color grading claims

### SVG Stroke Width Editor

Intent: adjust stroke width and outline thickness in SVG attributes.

Should focus on:

- existing stroke attributes
- set, multiply, or add-missing behavior where supported
- fill-only limitations
- preview before export

Should avoid:

- claiming it can thicken every filled shape like a vector offset tool
- schema questions that do not match visible questions

### SVG Flip and Rotate Editor

Intent: flip, mirror, or rotate SVG orientation.

Should focus on:

- horizontal and vertical flips
- rotation angles
- transform or rewritten geometry behavior as implemented
- export after orientation changes

Should avoid:

- generic "edit SVG" copy with no transform examples

### Accessibility and Contrast Checker

Intent: check SVG color contrast and readability.

Should focus on:

- contrast pairs
- text and foreground/background readability
- safer color alternatives where supported
- review before publishing

Should avoid:

- claiming full accessibility compliance or certification

### SVG Preview Viewer

Intent: preview and inspect SVG rendering.

Should focus on:

- safe local preview
- zoom, pan, metadata, and markup inspection
- checking rendering before use

Should avoid:

- implying editing if the route only previews and inspects

### Inspection Routes

`/svg-file-size-inspector` should own file weight, byte size, embedded images, markup volume, and optimization decisions.

`/svg-dimensions-inspector` should own width, height, `viewBox`, rendered size, and scaling behavior.

### Developer/Code Routes

`/svg-to-base64` should own encoding SVG into data URIs.

`/base64-to-svg` should own decoding SVG data URIs into markup and files.

`/svg-to-jsx-converter` should own React JSX conversion and attribute cleanup.

`/svg-embed-code-generator` should own snippet generation for HTML, CSS, React, Markdown, and data URI embeds.

`/inline-svg-vs-img` should be a decision guide, not the main generator.

`/text-to-svg-converter` should own text artwork generation.

`/emoji-to-svg-converter` should own emoji character rendering/export, with honest limitations.

`/code-to-svg-for-cricut` should own extracting inspectable SVG from code snippets for Cricut review, not guaranteed cut-ready conversion.

## 8. Metadata Audit

### Strong or Mostly Adequate

- `/svg-recolor`
- `/svg-flip-and-rotate-editor`
- `/svg-preview-viewer`
- `/svg-to-base64`
- `/base64-to-svg`
- `/svg-dimensions-inspector`

These titles and descriptions are route-specific and natural enough for now, though small tightening may still be useful in implementation batches.

### Needs Clarification or Tightening

- `/svg-background-editor`
  - Description is useful but long at 171 characters and bundles many actions.
  - Future change: shorten while preserving background-specific intent.

- `/svg-file-size-inspector`
  - H1 `SVG Size Inspector` can overlap with dimensions intent.
  - Future change: sharpen around file weight and markup weight.

- `/svg-accessibility-and-contrast-checker`
  - Title emphasizes contrast; H1 includes broader accessibility.
  - Future change: keep contrast/readability framing and avoid certification claims.

- `/svg-to-jsx-converter`
  - Title is short and could better signal React/JSX.
  - Future change: add React-specific clarity without keyword stuffing.

- `/emoji-to-svg-converter`
  - Title says `Vector SVG`; description says `downloadable SVG artwork`.
  - Future change: avoid overclaiming exact vector-quality output if rendering is font/image dependent.

### Highest Metadata Risk

- `/code-to-svg-for-cricut`
  - Description is 209 characters and includes a long list of input types.
  - Future change: shorten and focus on extracting inspectable SVG/code output for Cricut review.

- `/svg-embed-code-generator`
  - Title lists several embed methods and description adds more.
  - Future change: keep concise embed-method scope and move details into body copy.

## 9. FAQ/Schema Audit

### Valid or Currently Acceptable FAQPage JSON-LD

- `/svg-background-editor`
- `/svg-recolor`
- `/svg-flip-and-rotate-editor`
- `/svg-accessibility-and-contrast-checker`
- `/svg-preview-viewer`
- `/svg-file-size-inspector`
- `/svg-dimensions-inspector`
- `/svg-to-base64`
- `/inline-svg-vs-img`
- `/emoji-to-svg-converter`
- `/free-color-picker`

Notes:

- `/svg-preview-viewer`, `/svg-accessibility-and-contrast-checker`, and `/emoji-to-svg-converter` were blocker routes in Schema-B and currently appear aligned in the rendered audit.
- `/inline-svg-vs-img` includes literal tag wording in visible content, so crude text extraction may escape `<img>`. This should be handled carefully in automated checks.

### FAQPage JSON-LD and Visible FAQ Mismatch Risk

- `/svg-stroke-width-editor`
  - JSON-LD questions differ from visible FAQ questions.
  - Recommended action: generate JSON-LD from the same FAQ data used for visible FAQs or align the route-local arrays.

- `/svg-embed-code-generator`
  - JSON-LD has 5 FAQ questions while visible FAQ has a broader set with different wording.
  - Recommended action: align from one data source or remove FAQPage JSON-LD if schema would remain less representative than visible content.

- `/text-to-svg-converter`
  - One JSON-LD question differs slightly from the visible FAQ wording.
  - Recommended action: align from one data source when SEO-E-D is implemented.

### Visible FAQ Microdata Without JSON-LD

- `/base64-to-svg`
- `/base64-to-svg-for-cricut`
- `/code-to-svg-for-cricut`

This is not automatically invalid, but it is inconsistent with most newer FAQ handling. A later implementation should decide whether these routes keep microdata, switch to JSON-LD generated from the same visible FAQ data, or keep visible FAQ without structured FAQ markup.

### No FAQ Schema Needed Unless Clearly Useful

- `/svg-to-jsx-converter`

This route can be improved without adding FAQ schema. A concise developer workflow section may be better than broad new FAQ markup.

## 10. Prioritized Implementation Batches

### SEO-E-B: Low-Risk SVG Editor Utilities

Routes:

- `/svg-background-editor`
- `/svg-recolor`
- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`

Risk level: low to medium.

Metadata changes needed:

- Tighten `/svg-background-editor` description.
- Leave `/svg-recolor` mostly intact unless a better route-specific description is clearly useful.
- Review `/svg-stroke-width-editor` title/description for stroke-only limitations.
- Keep `/svg-flip-and-rotate-editor` transform-focused.

Content changes needed:

- Add or refine practical examples only where existing lower-page sections are thin.
- Do not make all four editor pages sound identical.
- Clarify limitations around SVG backgrounds and fill-only stroke editing.

FAQ/schema action:

- Fix `/svg-stroke-width-editor` FAQ JSON-LD and visible FAQ mismatch.
- Keep other FAQ schema only if it remains aligned with visible FAQ.

Tests to run:

- `npm.cmd run test:seo`
- `npm.cmd run test:schema`
- `npm.cmd run test:route-coverage`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

### SEO-E-C: Preview, Accessibility, and Inspection Utilities

Routes:

- `/svg-preview-viewer`
- `/svg-accessibility-and-contrast-checker`
- `/svg-file-size-inspector`
- `/svg-dimensions-inspector`

Risk level: medium.

Metadata changes needed:

- Keep preview route focused on viewing and inspection.
- Keep accessibility route focused on contrast and readability.
- Separate file-weight language from dimensions/viewBox language.

Content changes needed:

- Clarify what each route inspects or checks.
- Avoid implying editing on inspector-only pages.
- Avoid accessibility certification claims.

FAQ/schema action:

- Preserve Schema-B fixes on `/svg-preview-viewer` and `/svg-accessibility-and-contrast-checker`.
- Keep FAQ schema aligned where it remains.

Tests to run:

- `npm.cmd run test:seo`
- `npm.cmd run test:schema`
- `npm.cmd run test:route-coverage`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

### SEO-E-D: Developer and Code Utilities

Routes:

- `/svg-to-base64`
- `/base64-to-svg`
- `/base64-to-svg-for-cricut`
- `/svg-to-jsx-converter`
- `/svg-embed-code-generator`
- `/inline-svg-vs-img`
- `/text-to-svg-converter`
- `/emoji-to-svg-converter`
- `/code-to-svg-for-cricut`

Risk level: medium to high.

Metadata changes needed:

- Tighten `/code-to-svg-for-cricut` title and description.
- Tighten `/svg-embed-code-generator` title/description around embed generation instead of long keyword chains.
- Strengthen `/svg-to-jsx-converter` title/description for React JSX.
- Keep `/svg-to-base64` and `/base64-to-svg` paired but not cannibalizing each other.

Content changes needed:

- Differentiate encoding, decoding, embedding, JSX conversion, and Cricut code extraction.
- Add practical developer examples only where the route is thin.
- Avoid implying raster Base64 becomes clean vector output unless the route truly traces it.

FAQ/schema action:

- Fix `/svg-embed-code-generator` schema and visible FAQ mismatch.
- Fix `/text-to-svg-converter` schema and visible FAQ question mismatch.
- Decide whether microdata-only FAQ on `/base64-to-svg`, `/base64-to-svg-for-cricut`, and `/code-to-svg-for-cricut` should remain.
- Do not expand FAQ schema broadly.

Tests to run:

- `npm.cmd run test:seo`
- `npm.cmd run test:schema`
- `npm.cmd run test:route-coverage`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

## 11. Routes to Defer

Leave these unchanged during SEO-E implementation unless a direct regression appears:

- `/svg-cleaner`
- `/svg-minifier`
- `/svg-resize-and-scale-editor`
- `/svg-cleaner-for-figma`
- `/svg-cleaner-for-glowforge`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-canva`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-figma`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-silhouette`

These were covered by SEO-D implementation passes.

Defer color utility work unless a separate route family is opened:

- `/free-color-picker`

Leave redirect aliases unchanged:

- `/svg-to-css-background`
- `/svg-to-data-uri-converter`
- `/svg-inline-code-generator`
- `/svg-viewbox-editor`
- `/svg-code-cleaner`
- `/svg-transparent-background-tool`

Do not include in SEO-E:

- core image-to-SVG routes
- craft/marketplace/machine-specific routes
- legal/trust pages
- docs/help pages
- home page
- sitemap, robots, API, or redirect/meta routes

## 12. Regression Gates for Implementation

Any SEO-E implementation batch should pass:

- No route URL changes.
- No conversion/editor behavior changes.
- No preset, upload validation, output/copy/download, navigation, sitemap, monetization, or legal/trust policy changes.
- Titles remain unique and natural.
- Descriptions remain unique, route-specific, and not overlong.
- No keyword chains are added.
- Canonicals remain correct.
- H1s remain route-appropriate.
- Lower-page content is useful, route-specific, and not filler.
- FAQPage JSON-LD, where present, matches visible FAQ content.
- No same-page duplicate FAQPage structured data appears.
- No broad FAQ schema expansion is added.
- Redirect aliases stay redirects.
- `scripts/seo-audit.mjs` and `scripts/schema-audit.mjs` should be updated only where practical and deterministic.

Required verification for implementation batches:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:route-coverage
npm.cmd run test:seo
npm.cmd run test:schema
npm.cmd run test:monetization
$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes
npm.cmd run build
npm.cmd audit
git diff --check
```

If changed routes are covered by accessibility or browser-layout checks, run the relevant smoke tests as well.
