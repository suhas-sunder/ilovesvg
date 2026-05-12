# Phase SEO-C Checkpoint

Date: 2026-05-11

Branch: `final-refactor-and-polish-may-10-v2`

Scope: report-only checkpoint after SEO-B and SEO-C implementation batches. No code, metadata, page copy, route URL, sitemap, navigation, conversion, preset, upload validation, output, affiliate, ad, or deployment changes are part of this phase.

Baseline context:

- SEO-A report-only audit: `f1998b5 docs: add SEO audit report`
- SEO-B core converter/export implementation: `2141473 seo: improve core converter metadata and content`
- SEO-C-A craft duplicate/thin-page audit: `1e38144 docs: audit craft route SEO risks`
- SEO-C-B Cricut/sticker implementation: `13e157b seo: improve Cricut sticker route content`
- SEO-C-C marketplace implementation: `80d5bc8 seo: improve marketplace route content`
- SEO-C-D machine-specific craft implementation: `7724084 seo: improve machine-specific craft content`
- SEO-C-E adjacent machine/craft raster implementation: `656ba2d seo: improve adjacent machine craft routes`

## 1. Executive Summary

SEO-C has moved the highest-risk craft and marketplace pages from broad or mismatched wrapper copy toward more route-specific, practical search intent. The completed work now covers core converter/export routes, Cricut and sticker workflows, Etsy/Shopify/Printify/Printful platform routes, Silhouette/Glowforge/laser/vinyl craft routes, and adjacent Silhouette/Glowforge PNG/JPG routes.

The focused SEO audit currently checks 38 high-priority routes. It passed with zero failures during this checkpoint, and the route coverage audit reports no missing metadata, canonical tags, XML sitemap entries, route manifest entries, or broken nav/related targets.

The main remaining SEO risk is not the already-improved craft batch. It is the next layer of platform utility wrappers, especially SVG cleaner and SVG resizer pages for Figma, Glowforge, Silhouette, Canva, Etsy, and Shopify. These pages are useful, but most are shared-template wrappers where the platform-specific value is shallow. They should be audited before any implementation, because a rushed copy pass could make them look like doorway pages.

Recommended next phase: `SEO-D-A: SVG cleaner/resizer platform route audit, report-only`.

## 2. Completed SEO Implementation Summary

### Core Converter And Export Routes

Completed in SEO-B.

Covered route intent:

- Homepage as the broad image-to-SVG and SVG converter hub.
- Format-specific raster-to-SVG pages: PNG, JPG, JPEG, WebP.
- SVG export pages: SVG to PNG, SVG to JPG, SVG to PDF.
- Favicon/ICO companion pages where the query intent is direct and utility-first.

Result:

- Titles and descriptions are now more concise and input/output-specific.
- Homepage and `/png-to-svg-converter` intent separation is clearer.
- Focused SEO audit checks protect title, description, canonical, H1, and core body terms.

### Wrong-Platform Copy Repair

Completed in `20c326e seo: fix platform-specific route copy`.

Corrected the most serious platform mismatch risk identified by SEO-C-A:

- `/image-to-svg-for-silhouette`
- `/image-to-svg-for-glowforge`
- `/image-to-svg-for-etsy`
- `/png-to-svg-for-shopify`

Result:

- Silhouette pages now target Silhouette Studio and cut workflow intent.
- Glowforge pages now target laser cutting/engraving preparation.
- Etsy pages now target seller/listing/digital product workflows.
- Shopify PNG pages now target storefront, theme, logo, icon, and brand graphics.

### Cricut And Sticker Routes

Completed in SEO-C-B.

Improved routes:

- `/png-to-svg-for-cricut`
- `/png-to-svg-for-cricut-print-then-cut`
- `/png-to-svg-for-cricut-stickers`
- `/sticker-to-svg-converter`
- `/sticker-to-svg-for-cricut`

Result:

- General Cricut, Print Then Cut, Cricut sticker, generic sticker, and Cricut sticker workflows now differ more clearly.
- Copy emphasizes SVG starting points, transparent artwork, cut outlines, cut preview, and review before cutting.
- No broad FAQ schema expansion was added.

### Marketplace And Platform Routes

Completed in SEO-C-C.

Improved routes:

- `/image-to-svg-for-etsy`
- `/logo-to-svg-for-etsy`
- `/sticker-to-svg-for-etsy`
- `/png-to-svg-for-shopify`
- `/logo-to-svg-for-shopify`
- `/svg-to-png-for-printify`
- `/svg-to-png-for-printful`

Result:

- Etsy routes now separate broad seller assets, shop logos, and sticker/listing workflows.
- Shopify routes now focus on storefront branding, theme assets, logos, icons, and badges.
- Printify and Printful routes now focus on transparent PNG product artwork and print-on-demand prep without claiming platform approval.

### Machine-Specific Craft Routes

Completed in SEO-C-D.

Improved routes:

- `/image-to-svg-for-silhouette`
- `/logo-to-svg-for-silhouette`
- `/sticker-to-svg-for-silhouette`
- `/image-to-svg-for-glowforge`
- `/logo-to-svg-for-glowforge`
- `/png-to-svg-for-laser-cutting`
- `/png-to-svg-for-cricut-vinyl`

Result:

- Silhouette routes now target Silhouette Studio, cut path review, vinyl/decal/sticker workflows, and review before cutting.
- Glowforge routes now target laser cutting, engraving prep, path complexity, and honest review-before-use guidance.
- Laser and Cricut vinyl routes are differentiated from generic craft and sticker pages.
- This phase also restored the visible desktop `All Tools` nav link in the earlier nav correction work.

### Adjacent Silhouette And Glowforge PNG/JPG Routes

Completed in SEO-C-E.

Improved routes:

- `/png-to-svg-for-silhouette`
- `/jpg-to-svg-for-silhouette`
- `/png-to-svg-for-glowforge`
- `/jpg-to-svg-for-glowforge`

Result:

- Existing PNG/JPG routes now have route-aware lower-page guidance.
- JPG routes now mention JPG compression, noisy edges, and path review.
- Glowforge PNG/JPG routes now mention path complexity and avoid guaranteed laser-ready claims.
- No JPEG platform routes existed for Silhouette or Glowforge, so none were changed.

## 3. Current SEO Audit Coverage

The focused SEO audit script currently covers 38 routes:

- Home and core raster-to-SVG: `/`, `/png-to-svg-converter`, `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`, `/webp-to-svg-converter`
- Core SVG export: `/svg-to-png-converter`, `/svg-to-jpg-converter`, `/svg-to-pdf-converter`
- Favicon/ICO core routes: `/svg-to-favicon-generator`, `/svg-to-ico-converter`, `/png-to-favicon-generator`, `/png-to-ico-converter`, `/jpg-to-favicon-generator`, `/image-to-favicon-generator`, `/logo-to-favicon-generator`
- Cricut/sticker batch: `/png-to-svg-for-cricut`, `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-cricut-stickers`, `/sticker-to-svg-converter`, `/sticker-to-svg-for-cricut`
- Silhouette/Glowforge/laser/vinyl batch: `/image-to-svg-for-silhouette`, `/logo-to-svg-for-silhouette`, `/sticker-to-svg-for-silhouette`, `/png-to-svg-for-silhouette`, `/jpg-to-svg-for-silhouette`, `/image-to-svg-for-glowforge`, `/logo-to-svg-for-glowforge`, `/png-to-svg-for-glowforge`, `/jpg-to-svg-for-glowforge`, `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-cricut-vinyl`
- Marketplace/POD batch: `/image-to-svg-for-etsy`, `/logo-to-svg-for-etsy`, `/sticker-to-svg-for-etsy`, `/png-to-svg-for-shopify`, `/logo-to-svg-for-shopify`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful`

Focused SEO audit status during this checkpoint:

- Route count checked: 38
- Failures: 0
- Checks include status, title, description, description length, title length, canonical, H1 count, required body terms, required heading terms, forbidden wrong-platform heading terms, duplicate title checks, duplicate description checks, homepage intent separation, and specific duplicate-risk route comparisons.

Route coverage status during this checkpoint:

- Total app routes: 139
- Manifest routes: 139
- Public routes: 138
- XML sitemap paths: 125
- Routes missing XML sitemap: 0
- Routes missing metadata: 0
- Routes missing canonical: 0
- Broken nav or related targets: 0
- Manifest source mismatches: 0
- Manifest policy mismatches: 0
- Routes missing test classification: 0

Known non-required SEO-related diagnostic:

- `npm.cmd run test:route-expansion` was run as an optional diagnostic, not a required gate.
- It still fails with 53 searchable-nav gap rows for expanded long-tail routes.
- This is not currently the same as broken navigation. `test:navigation` and `test:nav` cover nav integrity and pass.
- The failure indicates that many long-tail format/platform routes are not represented in the searchable nav surface. It should be addressed only if route expansion/searchable nav coverage becomes a product goal.

## 4. Remaining Duplicate/Thin Risks

### Highest Risk: SVG Cleaner And SVG Resizer Platform Wrappers

Routes:

- `/svg-cleaner-for-figma`
- `/svg-cleaner-for-glowforge`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-canva`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-figma`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-silhouette`

Why this risk remains:

- These are mostly metadata wrappers around shared `svg-cleaner` or `svg-resize-and-scale-editor` templates.
- Titles are unique but follow a thin pattern: `SVG Cleaner for {platform} | iLoveSVG` and `SVG Resizer for {platform} | iLoveSVG`.
- Metadata is generally adequate but not strongly differentiated.
- The underlying tool value is real, but platform-specific examples are limited.
- Cleaner platform routes inherit the same visible FAQ and FAQ JSON-LD framework, which creates schema repetition risk.
- Resizer platform routes do not emit FAQ JSON-LD, but their visible FAQ and lower-page sections are still generic.

Likely content needs:

- Figma cleaner: imported SVG cleanup, editor metadata, symbols/ids, component handoff, and not breaking gradients/masks.
- Glowforge cleaner: laser software prep, path review, not removing ids/defs that affect visual output, and no guaranteed machine acceptance.
- Silhouette cleaner: Silhouette Studio import cleanup, cut path visibility, avoiding broken references.
- Canva/Figma resizers: predictable viewBox, design handoff, component/layout sizing.
- Etsy/Shopify resizers: listing previews, shop/store assets, logos, badges, theme or product-asset sizing.
- Glowforge/Silhouette resizers: physical size review, viewBox/width/height clarity, no overclaiming cut readiness.

### Medium Risk: Developer And Code Utility Routes

Routes:

- `/svg-to-base64`
- `/base64-to-svg`
- `/text-to-svg-converter`
- `/svg-to-jsx-converter`
- `/code-to-svg-for-cricut`
- `/base64-to-svg-for-cricut`

Why this risk remains:

- Search intent is real and practical, but the audience is technical.
- Some routes are implementation-heavy and should not be edited casually.
- `code-to-svg-for-cricut` and `base64-to-svg-for-cricut` mix developer extraction with craft workflow language, which should be audited before any metadata or FAQ changes.
- These routes likely need examples, input/output caveats, and safety language rather than broad SEO expansion.

### Medium Risk: Remaining Shopify Favicon Platform Wrappers

Routes:

- `/svg-to-favicon-for-shopify`
- `/logo-to-favicon-for-shopify`

Why this risk remains:

- Both routes share the same favicon generator template and FAQ JSON-LD.
- They are useful and probably acceptable, but the distinction should stay explicit:
  - SVG source to favicon for Shopify.
  - Logo image or SVG logo to favicon for Shopify.
- They should not be mixed into the cleaner/resizer audit unless the next phase expands to Shopify platform utilities broadly.

### Low To Medium Risk: Docs/Help Pages

Routes:

- `/how-it-works`
- `/how-it-works/conversion-workflow`
- `/how-it-works/presets`
- `/how-it-works/settings`
- `/how-it-works/exporting-and-downloads`
- `/how-it-works/troubleshooting`

Why this risk remains:

- They support internal linking and user education.
- SEO-A flagged several descriptions as long or feature-index-like.
- They should stay concise support pages, not become keyword-heavy acquisition pages.

## 5. FAQ/Schema Status

FAQ/schema expansion remains paused.

Current status by family:

- Core SEO audit still checks pages that already have FAQ/schema where relevant.
- Cricut/sticker/machine/marketplace implementations did not broadly add new FAQ schema.
- Cleaner platform routes inherit the shared `svg-cleaner` visible FAQ and FAQ JSON-LD.
- Resizer platform routes include visible FAQ content, but the template explicitly avoids duplicate FAQ JSON-LD.
- Shopify favicon routes inherit the shared favicon FAQ JSON-LD.

Open FAQ/schema risks:

- Shared FAQ blocks can become duplicate-schema risk when reused across platform wrappers.
- Cleaner platform FAQ answers are useful for the generic cleaner page, but not meaningfully platform-specific yet.
- Favicon Shopify FAQ may be acceptable if the next pass keeps the SVG-source route and logo-source route distinct.
- Future implementation should not add FAQ schema unless the visible FAQ is route-specific, honest, and useful.

Recommended later schema review:

- Compare rendered FAQ questions and answers across cleaner, resizer, favicon, Base64/code, and remaining platform wrappers.
- Keep FAQ schema only where the page has visible, route-specific answers.
- Remove or avoid schema where the FAQ is generic, repeated, or not materially helpful.

## 6. Candidate Next Route Families

### Candidate A: SVG Cleaner/Resizer Platform Routes

Assessment:

- Duplicate/thin risk: high.
- Platform-specific intent: plausible but shallow in current shared templates.
- Metadata: generally adequate, unique, and concise, but formulaic.
- Content quality: useful generic tool content, weak route-specific examples.
- Schema risk: cleaner wrappers inherit shared FAQ JSON-LD; resizer wrappers avoid duplicate FAQ JSON-LD.
- Best next action: audit first, report-only.

Why not implement immediately:

- These pages are the highest doorway-like risk if rewritten with platform-name substitutions.
- The right action may differ by route. Some may deserve richer examples, some may need noindex/canonical review later if search data does not support separate pages.
- Shared templates make it easy to accidentally add generic copy across many wrappers.

### Candidate B: Developer/Code Utility Routes

Assessment:

- Duplicate/thin risk: medium.
- Search intent: real and practical, especially Base64 and JSX routes.
- Technical audience: expects examples, safe decoding/encoding language, exact input/output behavior, and implementation caveats.
- Risk level: medium to high because these routes are implementation-heavy and some include security/sanitization behavior.
- Best next action: separate report-only audit after cleaner/resizer, or before implementation if developer search data becomes available.

Why not next:

- These routes are not the biggest duplicate/thin risk right now.
- Editing copy without a careful implementation audit could accidentally overstate safety, sanitization, React compatibility, or Cricut applicability.

### Candidate C: Remaining Favicon/Platform Wrapper Pages

Assessment:

- Duplicate/thin risk: low to medium.
- Search intent: useful for Shopify store owners setting favicons.
- Content quality: the shared favicon generator content is strong and functional.
- Remaining issue: `/svg-to-favicon-for-shopify` and `/logo-to-favicon-for-shopify` need clear source-input distinction if optimized later.
- Best next action: defer until after cleaner/resizer audit.

Why not next:

- They are more adequate than cleaner/resizer wrappers.
- They are part of a narrower Shopify/favicon workflow and do not represent the largest remaining SEO risk.

### Candidate D: Docs/Help Pages

Assessment:

- Duplicate/thin risk: low.
- Search intent: support and education, not primary acquisition.
- Content quality: useful, but some descriptions are long.
- Internal linking value: high for user education and conversion support.
- Best next action: defer. Keep concise and helpful.

Why not next:

- Help pages should not be expanded just for SEO.
- They support the converter experience, but they are not the highest-risk route family.

## 7. Recommended Next SEO Phase

Recommended phase: `SEO-D-A: SVG cleaner/resizer platform route audit, report-only`.

Scope:

- `/svg-cleaner-for-figma`
- `/svg-cleaner-for-glowforge`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-canva`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-figma`
- `/svg-resizer-for-glowforge`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-silhouette`

Why this phase:

- It addresses the highest remaining duplicate/thin-page risk from SEO-A and SEO-C-A.
- It keeps implementation paused until route-specific value is proven.
- It can decide whether each page needs richer examples, metadata tightening, FAQ/schema changes, noindex/canonical review, or no change.
- It avoids mixing cleaner/resizer work with developer utilities, favicon pages, docs pages, or conversion behavior.

Recommended SEO-D-A deliverable:

- A report at `docs/seo/phase-seo-d-svg-platform-tools-audit.md`.
- For each route, capture title, description, canonical, H1, rendered headings, visible lower-page content, FAQ/schema, related links, route-specific intent, duplicate/thin risk, user-value score, and recommended action.
- Compare cleaner routes as a cluster and resizer routes as a cluster.
- Explicitly flag any repeated FAQ/schema risk.
- Recommend a smaller implementation batch only after the report.

## 8. Regression Gates For Next Phase

For report-only SEO-D-A:

- `git status --short --branch`
- `git branch --show-current`
- `git diff --stat`
- `git diff --name-only`
- `git log --oneline --decorate -n 150`
- Inspect `app/data/routeManifest.ts`, `app/data/routeMeta/svgPlatformTools.ts`, `app/routes/svg-cleaner.tsx`, `app/routes/svg-resize-and-scale-editor.tsx`, and the platform wrapper files.
- Run `npm.cmd run test:seo` if the report references current focused audit state.
- Run required repo gates if the report is committed.

For any later implementation phase:

- Preserve route URLs, route behavior, conversion behavior, upload validation, presets, output/copy/download behavior, navigation grouping, and sitemap behavior.
- Do not add platform claims or compatibility promises.
- Do not add FAQ schema unless visible answers are route-specific.
- Keep `svg-cleaner` safety language accurate.
- Keep `svg-resize-and-scale-editor` viewBox and width/height behavior accurate.
- Add SEO audit checks only if they can avoid brittle exact-copy assertions.
- Required gates should include typecheck, tests, route coverage, navigation, nav, links, route smoke, SEO audit, build, audit, and `git diff --check`.

## 9. Routes Not To Touch Yet

Do not include these in the next phase unless the user explicitly expands scope:

- Developer/code utility routes: `/svg-to-base64`, `/base64-to-svg`, `/base64-to-svg-for-cricut`, `/text-to-svg-converter`, `/svg-to-jsx-converter`, `/code-to-svg-for-cricut`
- Shopify favicon wrappers: `/svg-to-favicon-for-shopify`, `/logo-to-favicon-for-shopify`
- Help/docs routes: `/how-it-works`, `/how-it-works/conversion-workflow`, `/how-it-works/presets`, `/how-it-works/settings`, `/how-it-works/exporting-and-downloads`, `/how-it-works/troubleshooting`
- Layered SVG routes, because they are conversion-heavy and need a separate route-family plan
- Remaining image format wrappers that were not in SEO-C, unless search data or a specific quality issue justifies a separate phase
- Navigation, sitemap, upload validation, conversion behavior, presets, affiliate/ad behavior, and output/download code

Bottom line: the next SEO step should be a report-only audit of SVG cleaner/resizer platform wrappers, not implementation.
