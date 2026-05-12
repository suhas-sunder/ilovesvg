# Phase Schema-A: FAQ Visibility and JSON-LD Correctness Audit

## Executive Summary

This audit reviewed FAQ visibility and FAQPage structured data across the current `main` merge baseline at `c9083d9`, then created the local audit branch `schema-faq-audit-may-10`.

Scope covered every public indexable route returned by the route manifest and rendered locally at `http://localhost:3000`.

Key findings:

- 125 public indexable routes were checked.
- 38 routes render FAQPage JSON-LD.
- 62 routes render visible FAQPage microdata.
- 3 routes render both FAQPage JSON-LD and FAQPage microdata for the same visible FAQ. These are the strongest current candidates for Google Search Console's duplicate FAQPage signal.
- 0 routes currently render more than one FAQPage JSON-LD object.
- 0 JSON-LD parse errors were found.
- 0 FAQPage JSON-LD objects were missing required `Question.name` or `acceptedAnswer.text` fields.
- 20 routes have visible FAQ content without FAQPage structured data. This is not invalid by itself and includes routes where schema was intentionally kept conservative.
- Several routes keep FAQPage JSON-LD and visible FAQ text in separate hardcoded sources, which creates exact-text mismatch risk.
- Three route groups reuse identical FAQPage JSON-LD across related pages, creating duplicate or generic FAQ quality risk rather than a same-page duplicate object.

No code, copy, metadata, JSON-LD, FAQ rendering, route behavior, sitemap behavior, or navigation behavior was changed in this phase.

## Schema Emitters Found

### Route-local FAQPage JSON-LD

Many route modules emit FAQPage JSON-LD directly with `type="application/ld+json"` and `dangerouslySetInnerHTML`. Most of these also render visible FAQ content lower on the page.

Representative route-local emitters:

| Source | Pattern | Notes |
| --- | --- | --- |
| `app/routes/svg-to-jpg-converter.tsx` | `JsonLdFaq()` plus visible `<details>` FAQ | Separate hardcoded schema and visible FAQ sources. |
| `app/routes/svg-to-webp-converter.tsx` | `JsonLdFaq()` plus visible `<details>` FAQ | Separate hardcoded schema and visible FAQ sources. |
| `app/routes/svg-to-pdf-converter.tsx` | `JsonLdFaq()` plus visible `<details>` FAQ | Schema contains questions not present in visible FAQ. |
| `app/routes/svg-preview-viewer.tsx` | `JsonLdFaq()` plus visible microdata FAQ | Same page has JSON-LD and microdata FAQPage. |
| `app/routes/svg-accessibility-and-contrast-checker.tsx` | `FaqJsonLd()` plus visible microdata FAQ | Same page has JSON-LD and microdata FAQPage. |
| `app/routes/emoji-to-svg-converter.tsx` | `EmojiFaqJsonLd()` plus visible microdata FAQ | Same page has JSON-LD and microdata FAQPage. |
| `app/routes/free-color-picker.tsx` | Top-level FAQPage JSON-LD plus visible FAQ | Schema questions and visible questions differ. |
| `app/routes/sticker-to-svg-converter.tsx` | `buildFaqJsonLd()` plus visible FAQ | Same FAQ reused by related wrapper pages. |
| `app/routes/line-art-to-svg-converter.tsx` | `makeFaqJsonLd(FAQ)` plus visible FAQ | Shared data source, currently aligned. |
| `app/routes/sketch-to-svg-converter.tsx` | `faqJsonLd` plus visible FAQ | Shared data source, currently aligned. |

### Shared docs schema helper

`app/client/components/docs/HowItWorksDocs.tsx` exposes `DocsJsonLd`, which emits `BreadcrumbList` and optionally `FAQPage` inside an `@graph` when a docs route passes `faqs`.

Current rendered use:

- `/how-it-works/troubleshooting` renders one FAQPage JSON-LD object from `DocsJsonLd` and matching visible FAQ details.
- The other docs routes audited do not currently render FAQPage structured data.

### Visible FAQ microdata

62 routes render visible FAQ sections with schema.org microdata such as:

- `itemType="https://schema.org/FAQPage"`
- `itemType="https://schema.org/Question"`
- `itemProp="acceptedAnswer"`

This is valid when used by itself, but it creates duplicate structured FAQPage items when combined with a separate FAQPage JSON-LD object for the same FAQ.

### Non-FAQ JSON-LD emitters

`app/client/components/navigation/OtherToolsLinks.tsx` emits JSON-LD for tool links, but it did not emit FAQPage in this audit and is not part of the FAQ duplicate issue.

`app/routes/_shared/createTemplateWrapperRoute.tsx` did not appear to emit FAQPage JSON-LD directly.

## Routes With FAQPage JSON-LD

38 routes currently render FAQPage JSON-LD:

| Route | Source file | JSON-LD FAQPage count | Visible FAQ status |
| --- | --- | ---: | --- |
| `/how-it-works/troubleshooting` | `app/routes/how-it-works.troubleshooting.tsx` | 1 | Visible FAQ details present. |
| `/svg-to-jpg-converter` | `app/routes/svg-to-jpg-converter.tsx` | 1 | Visible FAQ present, but exact schema text drifts. |
| `/svg-to-webp-converter` | `app/routes/svg-to-webp-converter.tsx` | 1 | Visible FAQ present, but exact schema answer text drifts. |
| `/svg-to-pdf-converter` | `app/routes/svg-to-pdf-converter.tsx` | 1 | Visible FAQ present, but several schema questions differ. |
| `/svg-background-editor` | `app/routes/svg-background-editor.tsx` | 1 | Visible FAQ present, with partial exact-text drift. |
| `/svg-recolor` | `app/routes/svg-recolor.tsx` | 1 | Visible FAQ present and aligned. |
| `/svg-minifier` | `app/routes/svg-minifier.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/svg-cleaner` | `app/routes/svg-cleaner.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/svg-preview-viewer` | `app/routes/svg-preview-viewer.tsx` | 1 | Visible FAQ present, but also marked as FAQPage microdata. |
| `/svg-embed-code-generator` | `app/routes/svg-embed-code-generator.tsx` | 1 | Visible FAQ present, but exact schema questions and answers drift. |
| `/inline-svg-vs-img` | `app/routes/inline-svg-vs-img.tsx` | 1 | Visible FAQ present, but exact schema questions and answers drift. |
| `/svg-to-favicon-generator` | `app/routes/svg-to-favicon-generator.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/svg-stroke-width-editor` | `app/routes/svg-stroke-width-editor.tsx` | 1 | Visible FAQ present, but exact schema questions and answers drift. |
| `/svg-flip-and-rotate-editor` | `app/routes/svg-flip-and-rotate-editor.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/svg-dimensions-inspector` | `app/routes/svg-dimensions-inspector.tsx` | 1 | Visible FAQ present and aligned. |
| `/svg-file-size-inspector` | `app/routes/svg-file-size-inspector.tsx` | 1 | Visible FAQ present and aligned. |
| `/svg-accessibility-and-contrast-checker` | `app/routes/svg-accessibility-and-contrast-checker.tsx` | 1 | Visible FAQ present, but also marked as FAQPage microdata. |
| `/svg-to-base64` | `app/routes/svg-to-base64.tsx` | 1 | Visible FAQ present, with exact answer drift. |
| `/free-color-picker` | `app/routes/free-color-picker.tsx` | 1 | Visible FAQ present, but schema questions and answers differ. |
| `/emoji-to-svg-converter` | `app/routes/emoji-to-svg-converter.tsx` | 1 | Visible FAQ present, but also marked as FAQPage microdata. |
| `/text-to-svg-converter` | `app/routes/text-to-svg-converter.tsx` | 1 | Visible FAQ present, but exact schema questions and answers drift. |
| `/sticker-to-svg-converter` | `app/routes/sticker-to-svg-converter.tsx` | 1 | Visible FAQ present and aligned. |
| `/line-art-to-svg-converter` | `app/routes/line-art-to-svg-converter.tsx` | 1 | Visible FAQ present and aligned. |
| `/sketch-to-svg-converter` | `app/routes/sketch-to-svg-converter.tsx` | 1 | Visible FAQ present and aligned. |
| `/svg-to-ico-converter` | `app/routes/svg-to-ico-converter.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/image-to-favicon-generator` | `app/routes/image-to-favicon-generator.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/png-to-favicon-generator` | `app/routes/png-to-favicon-generator.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/jpg-to-favicon-generator` | `app/routes/jpg-to-favicon-generator.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/logo-to-favicon-generator` | `app/routes/logo-to-favicon-generator.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/png-to-ico-converter` | `app/routes/png-to-ico-converter.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/svg-to-favicon-for-shopify` | `app/routes/svg-to-favicon-for-shopify.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/logo-to-favicon-for-shopify` | `app/routes/logo-to-favicon-for-shopify.tsx` | 1 | Visible FAQ present, with one exact answer drift. |
| `/svg-to-jpg-for-etsy` | `app/routes/svg-to-jpg-for-etsy.tsx` | 1 | Visible FAQ present, but it duplicates `/svg-to-jpg-converter`. |
| `/sticker-to-svg-for-etsy` | `app/routes/sticker-to-svg-for-etsy.tsx` | 1 | Visible FAQ present and aligned, but generic. |
| `/svg-cleaner-for-glowforge` | `app/routes/svg-cleaner-for-glowforge.tsx` | 1 | Visible FAQ present and aligned. |
| `/sticker-to-svg-for-silhouette` | `app/routes/sticker-to-svg-for-silhouette.tsx` | 1 | Visible FAQ present and aligned, but generic. |
| `/svg-cleaner-for-silhouette` | `app/routes/svg-cleaner-for-silhouette.tsx` | 1 | Visible FAQ present and aligned. |
| `/svg-cleaner-for-figma` | `app/routes/svg-cleaner-for-figma.tsx` | 1 | Visible FAQ present and aligned. |

## Routes With Visible FAQ

110 public indexable routes showed visible FAQ-like content in the rendered HTML.

Structured data shape:

- 38 routes have FAQPage JSON-LD.
- 62 routes have FAQPage microdata.
- 3 routes have both JSON-LD and microdata.
- 20 routes have visible FAQ content with no FAQPage structured data.

Visible FAQ without any FAQPage structured data:

- `/svg-to-png-converter`
- `/svg-resize-and-scale-editor`
- `/png-to-svg-for-cricut-vinyl`
- `/png-to-svg-for-laser-cutting`
- `/cricut-svg-converter`
- `/svg-to-png-for-shopify`
- `/svg-resizer-for-shopify`
- `/svg-to-png-for-etsy`
- `/svg-resizer-for-etsy`
- `/svg-to-png-for-printify`
- `/svg-to-png-for-printful`
- `/sticker-to-png-for-printing`
- `/svg-to-transparent-png-for-printing`
- `/png-to-svg-for-glowforge`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-silhouette`
- `/svg-to-png-for-canva`
- `/svg-resizer-for-canva`
- `/svg-resizer-for-figma`
- `/svg-to-png-for-figma`

This is not an error. It means these pages are conservative from a structured data standpoint. They can be left unchanged unless a later schema phase decides the visible FAQ is strong enough and route-specific enough to mark up.

## Duplicate FAQPage Findings

### Same-page duplicate structured FAQPage items

The highest priority findings are routes with both FAQPage JSON-LD and visible FAQPage microdata:

| Route | Source | Why it matters | Recommended action |
| --- | --- | --- | --- |
| `/svg-preview-viewer` | `app/routes/svg-preview-viewer.tsx` | `JsonLdFaq()` emits FAQPage JSON-LD and `SeoSections` wraps the same FAQ with `itemType="https://schema.org/FAQPage"`. | Keep one structured representation. Prefer keeping JSON-LD and removing FAQ microdata attributes, or remove JSON-LD if visible microdata is preferred. |
| `/svg-accessibility-and-contrast-checker` | `app/routes/svg-accessibility-and-contrast-checker.tsx` | `FaqJsonLd()` emits FAQPage JSON-LD and the visible FAQ also uses FAQPage microdata. | Keep one structured representation. Since JSON-LD is easier to audit, prefer dropping visible FAQ microdata attributes while keeping visible FAQ content. |
| `/emoji-to-svg-converter` | `app/routes/emoji-to-svg-converter.tsx` | `EmojiFaqJsonLd()` emits FAQPage JSON-LD and visible FAQ uses FAQPage microdata. | Keep one structured representation. Do not remove visible FAQ content. |

Rendered audit result:

- Duplicate FAQPage JSON-LD per same page: 0 routes.
- Duplicate FAQPage structured items when JSON-LD and microdata are both counted: 3 routes.

### Duplicate FAQPage JSON-LD across different routes

These are not same-page duplicate objects, but they are duplicate or generic FAQ quality risks:

| Duplicate FAQPage group | Risk | Recommended action |
| --- | --- | --- |
| `/svg-to-jpg-converter`, `/svg-to-jpg-for-etsy` | Etsy wrapper reuses the generic JPG FAQPage exactly. | Make Etsy FAQ route-specific or remove FAQPage schema from the wrapper if visible FAQ remains generic. |
| `/svg-to-favicon-generator`, `/svg-to-ico-converter`, `/image-to-favicon-generator`, `/png-to-favicon-generator`, `/jpg-to-favicon-generator`, `/logo-to-favicon-generator`, `/png-to-ico-converter`, `/svg-to-favicon-for-shopify`, `/logo-to-favicon-for-shopify` | Favicon and ICO routes reuse identical FAQPage JSON-LD across many distinct pages. | Audit favicon/ICO cluster separately before adding more schema. Consider one shared visible FAQ source with route-specific variants, or remove FAQPage from thin wrappers. |
| `/sticker-to-svg-converter`, `/sticker-to-svg-for-etsy`, `/sticker-to-svg-for-silhouette` | Platform wrappers reuse generic sticker FAQPage exactly. | Make Etsy and Silhouette FAQ content route-specific if schema remains. |

## Schema and Visible FAQ Mismatch Findings

The rendered audit compared FAQPage JSON-LD question and answer text to visible page text after removing scripts and styles.

High-confidence mismatches:

| Route | Problem | Suspected source |
| --- | --- | --- |
| `/free-color-picker` | FAQPage JSON-LD questions do not match visible FAQ questions. Example schema question: `Can I extract a color palette from an SVG or image?`; visible question: `Can I extract a palette from an SVG or image?`. Schema also says upload is allowed in a different way than visible copy. | Separate hardcoded JSON-LD near the top of `app/routes/free-color-picker.tsx` and separate visible FAQ near the lower page. |
| `/svg-to-pdf-converter` | Schema includes questions such as `How do I convert SVG to PDF?`, `Why does my PDF look blurry?`, and `Can SVG contain unsafe content?`; visible FAQ uses different questions such as `What DPI should I use?`. | Route-local `JsonLdFaq()` and lower-page visible FAQ are manually duplicated. |
| `/svg-embed-code-generator` | All schema questions and answers failed exact rendered-text matching. | Route-local `JsonLdFaq()` and visible FAQ are manually duplicated or out of sync. |
| `/svg-stroke-width-editor` | Several schema questions and all schema answers failed exact rendered-text matching. | Route-local schema and visible FAQ are separate sources. |
| `/text-to-svg-converter` | Schema includes one question that was not exact-match visible and all schema answers drift from visible wording. | Route-local schema and visible FAQ are separate sources. |
| `/svg-to-jpg-converter` | One schema question and most schema answers drift from visible FAQ wording. | Route-local schema and visible FAQ are separate sources. |
| `/svg-to-webp-converter` | Questions are visible, but every schema answer differs from visible answer wording. | Route-local schema and visible FAQ are separate sources. |
| `/svg-to-jpg-for-etsy` | Same drift pattern as `/svg-to-jpg-converter`; also duplicates its FAQPage JSON-LD. | Wrapper or duplicate route-local schema. |

Lower-risk exact-text drift:

- `/svg-background-editor`
- `/svg-minifier`
- `/svg-cleaner`
- `/inline-svg-vs-img`
- `/svg-to-favicon-generator`
- `/svg-flip-and-rotate-editor`
- `/svg-to-base64`
- `/svg-to-ico-converter`
- `/image-to-favicon-generator`
- `/png-to-favicon-generator`
- `/jpg-to-favicon-generator`
- `/logo-to-favicon-generator`
- `/png-to-ico-converter`
- `/svg-to-favicon-for-shopify`
- `/logo-to-favicon-for-shopify`

These pages have visible FAQ content, but exact rendered answer text does not fully match FAQPage JSON-LD. Some drift is small wording difference, but schema should ideally be generated from the same data that renders the visible FAQ.

Routes that the simple heading heuristic initially flagged as `schema without visible FAQ` but manual/source review showed visible matching FAQ:

- `/how-it-works/troubleshooting`
- `/sticker-to-svg-converter`
- `/line-art-to-svg-converter`
- `/sketch-to-svg-converter`
- `/sticker-to-svg-for-etsy`
- `/sticker-to-svg-for-silhouette`

These were false positives from the heading heuristic because the visible content did not always use the exact same FAQ heading pattern. They are still useful to include in a future automated audit as examples that need question and answer matching, not only heading matching.

## Duplicate and Generic FAQ Risk Findings

### Sticker wrapper cluster

Routes:

- `/sticker-to-svg-converter`
- `/sticker-to-svg-for-etsy`
- `/sticker-to-svg-for-silhouette`

Risk:

- The FAQPage JSON-LD is identical across a generic route and two platform wrappers.
- The visible FAQ is present and aligned, but generic.
- This is a duplicate quality risk, especially because Etsy and Silhouette have different user intents.

Recommended future fix:

- Keep visible FAQ content.
- If FAQPage schema remains, make the questions and answers platform-specific.
- If route-specific FAQ content is not worth adding, remove FAQPage JSON-LD from wrapper routes and leave visible FAQ only.

### Favicon and ICO cluster

Routes:

- `/svg-to-favicon-generator`
- `/svg-to-ico-converter`
- `/image-to-favicon-generator`
- `/png-to-favicon-generator`
- `/jpg-to-favicon-generator`
- `/logo-to-favicon-generator`
- `/png-to-ico-converter`
- `/svg-to-favicon-for-shopify`
- `/logo-to-favicon-for-shopify`

Risk:

- Identical FAQPage JSON-LD is reused across nine routes.
- Some routes are format-specific, some are platform-specific, and some are broader favicon tools.
- The FAQ may be useful, but schema duplication across many wrappers looks low-value.

Recommended future fix:

- Audit this route family separately.
- Keep FAQPage only on routes where the visible FAQ is route-specific and materially helpful.
- Consider visible FAQ without structured data for thin wrappers.

### SVG to JPG / Etsy cluster

Routes:

- `/svg-to-jpg-converter`
- `/svg-to-jpg-for-etsy`

Risk:

- The Etsy wrapper shares the same FAQPage JSON-LD as the generic route.
- The Etsy route should explain Etsy listing or shop asset use if schema remains.

Recommended future fix:

- Make the Etsy route FAQ route-specific or remove its FAQPage JSON-LD.

## Likely Root Causes

1. Mixed structured data formats on the same FAQ section.
   - `/svg-preview-viewer`, `/svg-accessibility-and-contrast-checker`, and `/emoji-to-svg-converter` emit FAQPage JSON-LD and also mark the visible FAQ section with FAQPage microdata.
   - This is the strongest current same-page duplicate FAQPage root cause.

2. Separate hardcoded schema and visible FAQ sources.
   - Routes such as `/svg-to-jpg-converter`, `/svg-to-webp-converter`, `/svg-to-pdf-converter`, `/free-color-picker`, `/svg-embed-code-generator`, `/svg-stroke-width-editor`, and `/text-to-svg-converter` maintain FAQPage JSON-LD separately from visible FAQ markup.
   - This creates text drift and stale schema risk.

3. Shared wrapper/template FAQ reuse across route-specific pages.
   - Sticker, favicon/ICO, and SVG-to-JPG Etsy routes reuse identical FAQPage JSON-LD across different search intents.
   - This is not a same-page duplicate field issue, but it is a duplicate and thin-schema quality risk.

4. Existing audits focus on selected SEO clusters, not route-wide FAQPage uniqueness and visibility.
   - `scripts/seo-audit.mjs` already compares duplicate FAQPage JSON-LD signatures for selected platform clusters.
   - There is not yet a route-wide schema audit that counts JSON-LD FAQPage plus microdata FAQPage on every public indexable route.

## Prioritized Fix Batches

### Batch 1: GSC blocker fixes

Fix same-page duplicate structured FAQPage items first.

| Route | Severity | Exact problem | Suspected source | Recommended fix | Test needed |
| --- | --- | --- | --- | --- | --- |
| `/svg-preview-viewer` | P0 | One FAQPage JSON-LD plus one visible FAQPage microdata section. | `JsonLdFaq()` and `SeoSections` in `app/routes/svg-preview-viewer.tsx`. | Keep visible FAQ. Use only one structured data format, preferably JSON-LD. | Route-wide schema audit should require max one FAQPage structured item per route. |
| `/svg-accessibility-and-contrast-checker` | P0 | One FAQPage JSON-LD plus one visible FAQPage microdata section. | `FaqJsonLd()` and visible FAQ microdata in `app/routes/svg-accessibility-and-contrast-checker.tsx`. | Keep visible FAQ. Use only one structured data format, preferably JSON-LD. | Same as above. |
| `/emoji-to-svg-converter` | P0 | One FAQPage JSON-LD plus one visible FAQPage microdata section. | `EmojiFaqJsonLd()` and visible FAQ microdata in `app/routes/emoji-to-svg-converter.tsx`. | Keep visible FAQ. Use only one structured data format, preferably JSON-LD. | Same as above. |

Also include `/free-color-picker` in Batch 1 because it has the clearest schema/visible FAQ content mismatch.

| Route | Severity | Exact problem | Suspected source | Recommended fix | Test needed |
| --- | --- | --- | --- | --- | --- |
| `/free-color-picker` | P0 | FAQPage JSON-LD questions and answers differ from visible FAQ questions and answers. | Separate top-level JSON-LD and lower-page visible FAQ in `app/routes/free-color-picker.tsx`. | Generate schema from the visible FAQ data or remove FAQPage schema. | Verify every FAQPage question is visible and answer text matches or is generated from same source. |

### Batch 2: JSON-LD and visible FAQ alignment

Fix routes where FAQPage schema and visible FAQ text are manually duplicated.

Recommended target routes:

- `/svg-to-jpg-converter`
- `/svg-to-webp-converter`
- `/svg-to-pdf-converter`
- `/svg-embed-code-generator`
- `/svg-stroke-width-editor`
- `/text-to-svg-converter`
- `/svg-to-jpg-for-etsy`
- `/svg-background-editor`
- `/svg-to-base64`
- `/inline-svg-vs-img`

Preferred implementation pattern:

- Define one typed FAQ data array per route.
- Render visible FAQ from that array.
- Generate FAQPage JSON-LD from the same array only when schema is intentionally kept.
- Avoid adding schema to routes where FAQ content is generic or low-value.

### Batch 3: Duplicate and generic FAQ quality fixes

Target route groups with identical FAQPage JSON-LD across multiple routes:

- Sticker route group:
  - `/sticker-to-svg-converter`
  - `/sticker-to-svg-for-etsy`
  - `/sticker-to-svg-for-silhouette`
- Favicon and ICO route group:
  - `/svg-to-favicon-generator`
  - `/svg-to-ico-converter`
  - `/image-to-favicon-generator`
  - `/png-to-favicon-generator`
  - `/jpg-to-favicon-generator`
  - `/logo-to-favicon-generator`
  - `/png-to-ico-converter`
  - `/svg-to-favicon-for-shopify`
  - `/logo-to-favicon-for-shopify`
- SVG to JPG Etsy wrapper:
  - `/svg-to-jpg-converter`
  - `/svg-to-jpg-for-etsy`

Recommended handling:

- Do not delete routes based only on FAQ duplication.
- Make schema-backed FAQ content route-specific where it materially helps users.
- Remove FAQPage JSON-LD from thin wrappers if visible FAQ remains generic.
- Keep visible FAQ content only if it is helpful and not misleading.

### Batch 4: Audit and guardrail tests

Add a dedicated schema audit script or extend the SEO audit.

The guardrail should:

- Enumerate public indexable routes from `ROUTE_MANIFEST`.
- Fetch rendered HTML from `BASE_URL`.
- Parse all `application/ld+json` scripts.
- Traverse arrays, `@graph`, and nested objects for `@type: "FAQPage"`.
- Count visible FAQPage microdata.
- Fail if a route has more than one total FAQPage structured item across JSON-LD and microdata.
- Fail if any FAQPage JSON-LD has duplicate questions.
- Fail if any FAQPage JSON-LD is missing `mainEntity`, `Question.name`, or `acceptedAnswer.text`.
- Warn or fail for route groups with identical FAQPage JSON-LD signatures.
- Compare FAQPage question text to rendered visible text.
- Prefer source-of-truth checks where visible FAQ and schema are generated from the same data array.

## Suggested Automated Schema Audit

Recommended script:

- `scripts/schema-audit.mjs`

Recommended npm script:

- `test:schema`: `node scripts/schema-audit.mjs`

Recommended checks:

1. Public indexable route discovery from `app/data/routeManifest.ts`.
2. Rendered route fetch using `BASE_URL`, defaulting to `http://localhost:3000`.
3. JSON-LD parsing with support for arrays and `@graph`.
4. FAQPage JSON-LD count.
5. FAQPage microdata count.
6. Combined structured FAQPage count.
7. Required field validation.
8. Duplicate question validation.
9. Exact question visibility validation.
10. Optional answer visibility validation with a tolerance for whitespace and entity decoding.
11. Duplicate FAQPage signature reporting across routes.

Recommended CI gate:

- Fail on parse errors, same-page duplicate FAQPage structured items, missing required fields, and FAQPage questions that are not visible.
- Warn on exact answer drift and duplicate FAQPage signatures across different routes until the first cleanup pass is complete.

## Routes to Leave Unchanged

Leave these unchanged during the first implementation batch unless a broader schema policy is approved:

- Routes with visible FAQ but no FAQPage structured data:
  - These are not invalid and do not cause duplicate FAQPage errors.
  - Examples include `/svg-to-png-converter`, `/svg-resize-and-scale-editor`, resizer wrapper routes, Printify/Printful PNG export routes, and several Cricut/vinyl/laser routes.
- Routes with one FAQPage JSON-LD object and visible FAQ generated from the same source:
  - Examples include `/line-art-to-svg-converter`, `/sketch-to-svg-converter`, `/svg-recolor`, `/svg-dimensions-inspector`, `/svg-file-size-inspector`, and the three SVG cleaner platform routes.
- Docs routes without FAQPage structured data:
  - `/how-it-works`
  - `/how-it-works/conversion-workflow`
  - `/how-it-works/presets`
  - `/how-it-works/settings`
  - `/how-it-works/exporting-and-downloads`
- Non-FAQ or low-monetization routes:
  - `/pro-waitlist`
  - `/sitemap`

## Recommended First Implementation Batch

Recommended next phase: **Schema-B: duplicate FAQPage blocker repair**.

Exact first routes/files:

- `/svg-preview-viewer`
  - `app/routes/svg-preview-viewer.tsx`
- `/svg-accessibility-and-contrast-checker`
  - `app/routes/svg-accessibility-and-contrast-checker.tsx`
- `/emoji-to-svg-converter`
  - `app/routes/emoji-to-svg-converter.tsx`
- `/free-color-picker`
  - `app/routes/free-color-picker.tsx`

Why first:

- The first three routes have the clearest same-page duplicate FAQPage structured data issue.
- `/free-color-picker` has the clearest FAQPage schema versus visible FAQ mismatch.
- The changes should be narrow: keep visible FAQ content, choose one structured FAQ representation, and align schema with visible content.
- This batch does not require route architecture changes or SEO copy expansion.

Risk level:

- Low to medium.
- Low if changes remove only duplicate microdata attributes or align schema generation from existing visible FAQ data.
- Medium if route-local FAQ content is rewritten instead of only deduped or sourced from existing arrays.

## Regression Gates for Implementation

Required gates for the next implementation phase:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:seo`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

Additional recommended gate:

- Add and run `npm.cmd run test:schema` after implementing `scripts/schema-audit.mjs`.

Schema-specific acceptance criteria:

- No public indexable route renders more than one FAQPage structured item across JSON-LD and microdata.
- No FAQPage JSON-LD parse errors.
- No FAQPage missing required fields.
- Every FAQPage JSON-LD question is visibly present on the rendered page.
- FAQPage JSON-LD answers are generated from the same source as visible FAQ answers where practical.
- Duplicate FAQPage JSON-LD signatures across unrelated or wrapper routes are either removed, made route-specific, or documented as intentionally equivalent.
