# Phase SEO-A Audit

Date: 2026-05-10

Branch: `final-refactor-and-polish-may-10-v2`

Scope: report-only SEO, metadata, search intent, internal linking, schema, and content quality audit. No route code, route URLs, metadata, copy, sitemap, navigation, conversion behavior, presets, upload validation, or deployment changes were made.

## 1. Executive Summary

The public route surface is technically organized well enough to start SEO improvement work, but it should be improved in careful batches. The audit found 139 manifest entries, 138 public routes, 125 indexable XML sitemap routes, and 125 XML sitemap paths. The rendered route inventory found no missing titles, no missing descriptions, no missing H1s, and no exact duplicate title or description strings among indexable routes.

The largest SEO opportunity is not basic technical coverage. It is intent fit and content quality:

- Core converter pages have strong utility intent and should be the first SEO implementation batch.
- Several high-value descriptions try to say too much in one snippet, especially core converter, Cricut, layered, and docs pages.
- Platform wrappers are useful but have the highest duplicate/thin-page risk if their lower-page content stays too templated.
- The homepage currently targets PNG/image-to-SVG language strongly enough that it may compete with `/png-to-svg-converter` unless the homepage intent is defined more clearly.
- Internal linking is broad, but repeated all-tools blocks create very large link surfaces on individual route pages. That helps discovery, but it may dilute route-specific next steps.
- FAQ/schema usage exists on 38 indexable routes. It should not be expanded until route-specific FAQ quality and duplicate wording are audited per family.

Recommended first implementation phase: core converter SEO batch covering `/`, `/png-to-svg-converter`, `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`, `/webp-to-svg-converter`, `/svg-to-png-converter`, `/svg-to-jpg-converter`, `/svg-to-pdf-converter`, `/svg-to-favicon-generator`, and the strongest favicon/ICO companion pages. This has the best combination of likely demand, clear user intent, and manageable risk if limited to metadata and lower-page content.

## 2. Methodology And Data Sources

Repo data inspected:

- `app/data/routeManifest.ts`
- `app/data/routeManifest.types.ts`
- `app/data/routeMeta/`
- `app/routes/`
- `app/routes/sitemap.tsx`
- `public/sitemap.xml`
- `app/client/components/navigation/toolNavSections.ts`
- `scripts/route-coverage-audit.mjs`
- `scripts/navigation-audit.mjs`
- `scripts/route-expansion-audit.mjs`
- Representative migrated wrapper routes and high-risk route modules for audit only

Rendered route inventory method:

- A local `http://localhost:3000` server was used to fetch public route pages.
- The inventory captured status, title, meta description, canonical, H1, H2 headings, FAQ structured data count, approximate visible text size, link count, source file, route family, nav visibility, sitemap classification, and redirect/index status.
- The generated working inventory was kept under `tmp/` and was not committed.

Keyword data:

- No local Search Console, Bing, query, keyword, click, or impression export files were found in the repo.
- No exact search volume data is used in this report.
- Demand priority is inferred from route intent, common search behavior for converter tools, visible content, route grouping, and sitemap/navigation coverage.

External guidance used for high-level validation only:

- [Google Search Central: Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Search Central: Title links](https://developers.google.com/search/docs/appearance/title-link)
- [Google Search Central: Snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- [Google Search Central: Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Search Central: FAQ structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage)

Those sources support the audit criteria: descriptive page titles, useful snippets, canonical consolidation where appropriate, visible structured-data content parity, and people-first route content. They do not provide iLoveSVG-specific keyword volume.

## 3. Route SEO Inventory Summary

Overall counts:

| Item | Count |
| --- | ---: |
| Manifest entries | 139 |
| Public routes | 138 |
| Indexable XML sitemap routes | 125 |
| XML sitemap paths | 125 |
| Navigation hrefs observed in nav data | 120 |
| Exact duplicate title strings among indexable routes | 0 |
| Exact duplicate description strings among indexable routes | 0 |
| Indexable routes with FAQ schema detected | 38 |

Indexable route family counts:

| Route family | Count | SEO posture |
| --- | ---: | --- |
| `cricut-craft` | 37 | Strong US commercial/craft intent, but high duplication and long-description risk. |
| `svg-export` | 23 | Strong quick-conversion intent, good first implementation surface. |
| `svg-editor` | 20 | Useful utility intent, but several pages are complex editor modules. |
| `raster-to-svg` | 19 | Highest demand surface, first priority for metadata and content quality. |
| `text-base64-code` | 10 | Developer/code intent, should stay practical and example-driven. |
| `layered-svg` | 8 | Useful craft intent, high conversion-risk modules. |
| `documentation` | 7 | Helpful support content, not primary SEO growth pages. |
| `sitemap-meta` | 1 | Utility route, not a growth target. |

Non-indexable public routes reviewed:

- Legal/static pages: `/cookies`, `/privacy-policy`, `/terms-of-service`.
- Redirect aliases: `/black-and-white-png-to-svg-converter`, `/image-to-svg-converter`, `/svg-code-cleaner`, `/svg-inline-code-generator`, `/svg-to-css-background`, `/svg-to-data-uri-converter`, `/svg-to-react-component`, `/svg-transparent-background-tool`, `/svg-viewbox-editor`, `/tif-to-svg-converter`.

Redirect aliases are correctly treated as consolidation surfaces rather than SEO growth pages. Legal pages are important for trust and policy compliance, but they should not be optimized as acquisition pages.

## 4. Demand-Based Route Priority Ranking

This is an inferred priority ranking, not a search-volume report.

| Tier | Routes | Primary query target | Search intent | Notes |
| --- | --- | --- | --- | --- |
| 1 | `/png-to-svg-converter` | `png to svg` | Quick conversion | Highest-value direct converter page. Preserve utility-first page experience. |
| 1 | `/` | `image to svg`, `free svg converter` | Quick conversion hub | Useful homepage, but current title also targets PNG. Needs intent separation from `/png-to-svg-converter`. |
| 1 | `/svg-to-png-converter` | `svg to png` | Quick export | High-demand export route. Keep transparency/export controls clear. |
| 1 | `/jpg-to-svg-converter` | `jpg to svg` | Quick conversion | Strong route, should differentiate from JPEG route naturally. |
| 1 | `/jpeg-to-svg-converter` | `jpeg to svg` | Quick conversion | Keep for query variant, but avoid near-duplicate copy. |
| 1 | `/svg-to-pdf-converter` | `svg to pdf` | Quick export | Clear utility intent and strong conversion need. |
| 1 | `/svg-to-favicon-generator` | `svg to favicon` | Favicon/export | Strong intent, should be the favicon hub. |
| 2 | `/svg-to-ico-converter`, `/png-to-ico-converter` | `svg to ico`, `png to ico` | Favicon/export | Useful if format-specific behavior is explained. |
| 2 | `/webp-to-svg-converter` | `webp to svg` | Quick conversion | Modern image format route, likely lower than PNG/JPG but valuable. |
| 2 | `/svg-to-jpg-converter` | `svg to jpg`, `svg to jpeg` | Quick export | Useful where users need flattened background. |
| 2 | `/cricut-svg-converter`, `/png-to-svg-for-cricut` | `cricut svg converter`, `png to svg for cricut` | Craft/cutting machine | Strong US craft intent, but routes are behavior-heavy. |
| 2 | `/text-to-svg-converter` | `text to svg` | Design/developer utility | Practical tool intent. Avoid bloated SEO copy. |
| 2 | `/base64-to-svg`, `/svg-to-base64` | `base64 to svg`, `svg to base64` | Developer/code use | Strong utility intent, but route modules are high risk. |
| 2 | `/svg-background-editor` | `svg background remover`, `svg background editor` | SVG editing | Useful editor route, avoid overpromising automatic background removal. |
| 2 | `/svg-resize-and-scale-editor` | `svg resizer`, `resize svg` | SVG editing | Good search intent, but page should emphasize dimensions/viewBox safely. |
| 2 | `/svg-cleaner`, `/svg-minifier` | `svg cleaner`, `svg minifier` | SVG editing/optimization | Useful if copy explains cleanup/minify differences. |
| 3 | Cricut variants | `photo/sketch/logo/sticker to svg for cricut` | Craft/cutting machine | Likely valuable long-tail, but needs route-specific content to avoid boilerplate. |
| 3 | Marketplace wrappers | `png to svg for etsy`, `svg to png for printify` | Marketplace/product listing | Keep if route-specific listing/export use is clear. |
| 3 | Design tool wrappers | `png to svg for canva`, `svg to png for figma` | Design workflow | Useful long-tail, but should not read as doorway pages. |
| 3 | SVG cleaner/resizer platform wrappers | `svg cleaner for glowforge`, `svg resizer for etsy` | Platform utility | Highest duplicate/thin risk among migrated wrapper families. |

## 5. Meta Title And Description Audit

Strengths:

- No exact duplicate title strings were found among indexable routes.
- No exact duplicate meta description strings were found among indexable routes.
- No indexable route in the rendered inventory was missing a title, description, canonical, or H1.
- Canonical paths matched the expected route path for indexable routes in the rendered inventory.

Main issues:

1. Some descriptions are too long and list too many features.

Examples:

| Route | Description length | Issue |
| --- | ---: | --- |
| `/sketch-to-svg-for-cricut` | 273 | Too much feature inventory for a snippet. |
| `/how-it-works/troubleshooting` | 255 | Useful, but too much enumerated issue coverage. |
| `/how-it-works/settings` | 233 | Reads like a feature index rather than a snippet. |
| `/logo-to-layered-svg-for-cricut` | 230 | Long and conversion-heavy. |
| `/gif-to-svg-converter` | 215 | Helpful caveat, but should be tightened. |
| `/code-to-svg-for-cricut` | 209 | Many input types in one snippet. |
| `/image-to-svg-for-cricut` | 202 | Broad format list plus use cases. |
| `/png-to-svg-converter` | 189 | Strong page, but snippet tries to include controls, layers, copy, download, and preview. |
| `/` | 185 | Homepage description lists many formats and features. |

2. Some titles are long enough that intent may be truncated.

Examples:

| Route | Title length | Issue |
| --- | ---: | --- |
| `/svg-resize-and-scale-editor` | 71 | Strong intent, but long. |
| `/image-to-svg-outline` | 71 | Strong route name, but may be truncated. |
| `/png-to-svg-for-cricut-print-then-cut` | 68 | Long craft phrase, acceptable if most important phrase leads. |
| `/png-to-svg-for-silhouette` | 68 | Long, but platform intent is clear. |
| `/svg-background-editor` | 67 | Useful but could be tighter. |
| `/image-to-svg-for-cricut` | 67 | Strong, but competing phrases add length. |

3. Short platform titles are unique but often under-explain the use case.

Examples:

- `/svg-cleaner-for-glowforge`
- `/svg-resizer-for-glowforge`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-silhouette`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-canva`
- `/svg-cleaner-for-figma`
- `/image-to-favicon-generator`
- `/png-to-ico-converter`

The issue is not exact duplication. The issue is that many titles follow a thin `Tool for Platform | iLoveSVG` pattern. These should be improved only where the visible content also has route-specific value.

4. The homepage and PNG route need clearer title intent separation.

Current homepage title: `iLoveSVG | PNG to SVG Converter - Free Online Image to SVG`.

Current PNG route title: `PNG to SVG Converter - Free Online Image to SVG | iLoveSVG`.

Both are valid individually, but together they may send mixed signals. The homepage should probably own `image to SVG converter` and brand/hub intent, while `/png-to-svg-converter` should own direct `PNG to SVG` intent.

## 6. Search Intent Audit

Search intent categories:

| Intent | Route families | Current fit | Main improvement |
| --- | --- | --- | --- |
| Quick conversion | Raster-to-SVG, SVG export, favicon/ICO | Strong | Tighten metadata around immediate input/output result. |
| Craft/cutting machine | Cricut, Silhouette, Glowforge, laser, sticker | Strong but complex | Make route-specific machine/output expectations clearer. |
| Marketplace/product listing | Etsy, Shopify, Printify, Printful | Mixed | Explain concrete listing/export use cases instead of generic wrapper copy. |
| Design tool workflow | Canva/Figma wrappers | Mixed | Explain import/export workflow and limitations without fluff. |
| SVG editing | Cleaner, minifier, resizer, recolor, background, viewer | Strong | Distinguish editor functions clearly. |
| Developer/code use | Base64, embed code, JSX, inline SVG | Strong | Keep examples practical and code-oriented. |
| Learning/help | How-it-works pages | Acceptable | Tighten snippets and keep as support pages, not keyword pages. |
| Legal/static | Cookies, privacy, terms | Correctly non-growth | Preserve trust/compliance, do not optimize as acquisition content. |

High-demand pages should answer practical conversion questions immediately:

- What input can I upload?
- What output will I get?
- Is transparency preserved?
- Does the tool trace pixels or export an existing SVG?
- Is the route client-side, server-assisted, or mixed if that matters to the user?
- What are the limitations for photos, scans, logos, and complex artwork?
- Which related tool is the next best step?

The current tool-first layout helps search quality because it satisfies the primary task before lower-page content. Future SEO work should keep that structure.

## 7. Content Quality And Thin-Page Audit

Content classification by family:

| Family | Content quality | Thin/duplicate risk | Notes |
| --- | --- | --- | --- |
| Core raster-to-SVG | Strong to acceptable | Medium | Useful sections exist, but metadata and lower sections should be more route-specific. |
| SVG export | Strong to acceptable | Low to medium | Main export routes are clear. Platform export wrappers need differentiation. |
| Favicon/ICO | Acceptable | Medium | Useful cluster, but pages overlap and should have hub/child structure. |
| Cricut/craft | Acceptable to thin depending on route | Medium to high | Valuable US intent, but many variants can look similar without concrete machine/workflow details. |
| Marketplace/design wrappers | Thin to acceptable | High | Needs route-specific marketplace/design workflow examples. |
| SVG cleaner/resizer platform wrappers | Thin to acceptable | High | Strongest doorway-page risk if pages only swap platform names. |
| SVG editor core pages | Strong to acceptable | Low to medium | Many have real tool value; avoid changing complex editor routes casually. |
| Developer/base64/code pages | Strong to acceptable | Medium | Good utility intent, but high-risk modules. |
| Docs/how-it-works | Acceptable | Low | Helpful support pages, but descriptions are too long. |
| Legal/static | Correct for trust | Low SEO value | Do not treat as acquisition pages. |

AdSense low-value-content risk is highest where a page appears to exist only for a platform keyword variation. That does not mean the route should be removed. It means each route needs visible, practical, route-specific content:

- why that output matters for the platform,
- which files work best,
- what the tool does and does not do,
- when to use a different route,
- clear related links to the next useful tool.

Avoid adding generic paragraphs just to raise word count. Google guidance does not require a preferred word count, and filler would raise spam risk.

## 8. Duplicate And Cannibalization Clusters

| Cluster | Routes | Decision | Recommended action |
| --- | --- | --- | --- |
| Homepage vs PNG/Image to SVG | `/`, `/png-to-svg-converter`, `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`, `/webp-to-svg-converter` | Keep separate | Clarify homepage as image/SVG converter hub. Let format pages own format-specific queries. |
| JPG vs JPEG to SVG | `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`, plus Cricut and platform variants | Keep separate for query language | Differentiate copy and internal links. Monitor Search Console before canonicalizing. |
| Image-to-SVG generic redirect | `/image-to-svg-converter` redirect alias to `/` | Keep redirect | Do not create a second indexable generic route without data. |
| Cricut/cut-file routes | 21 Cricut routes | Keep separate, improve content | US craft intent is distinct, but content must be route-specific. |
| Craft machine wrappers | Glowforge, Silhouette, laser, sticker routes | Keep but watch quality | Use machine-specific file/output expectations. |
| Marketplace/design wrappers | Etsy, Shopify, Canva, Figma wrappers | Keep but improve or de-emphasize later | Add useful route-specific workflow copy. Consider noindex only after search data. |
| SVG to PNG platform/export wrappers | Etsy, Shopify, Printify, Printful, Canva, Figma, printing | Keep if export requirements differ | Make platform/export constraints visible. |
| Favicon/ICO routes | SVG/image/PNG/JPG/logo to favicon/ICO | Keep hub/child structure | `/svg-to-favicon-generator` should be hub; child pages should explain input format distinctions. |
| SVG cleaner/resizer platform wrappers | Shopify, Etsy, Glowforge, Silhouette, Canva, Figma | Highest duplicate risk | Improve route-specific examples before expanding SEO. |
| Developer/code aliases | Data URI, React component, inline code aliases | Keep consolidation | Redirect aliases should stay non-indexable. |

Do not delete pages in the first SEO implementation phase. Use Search Console/Bing data first if canonical/noindex decisions are considered.

## 9. Internal Linking Audit

Strengths:

- High-demand tools are reachable from navigation and tool sections.
- Route coverage and navigation audits provide guardrails for missing links and sitemap/nav drift.
- Related tools exist broadly, which helps discovery.

Risks:

- Many pages include very large all-tools link surfaces. Several rendered pages had about 125 to 126 links.
- Repeated broad link blocks may dilute contextual relevance on high-value routes.
- Platform wrapper pages need more focused related links. For example, a Shopify favicon route should prioritize favicon, ICO, logo, and Shopify-related tools before unrelated converters.
- Some lower-page SEO sections may link broadly rather than guiding the user to the next most useful task.
- The existing `npm.cmd run test:route-expansion` audit reported searchable-nav gaps for 53 expanded or long-tail routes. This is not the same as broken navigation, because `npm.cmd run test:navigation` reported zero missing routes, zero redirect routes, and zero duplicate menu hrefs. It does indicate that many long-tail format/platform routes are not represented in the searchable nav surface.

Searchable-nav gap groups reported by `test:route-expansion`:

- Secondary image formats: GIF, AVIF, BMP, TIFF, transparent PNG.
- Layered SVG converters: image, JPG, and logo layered routes.
- Favicon/ICO routes: SVG/image/PNG/JPG/logo favicon and ICO pages.
- Marketplace/design wrappers: Shopify, Etsy, Printify, Printful, Canva, Figma.
- Craft/platform wrappers: Glowforge and Silhouette cleaner/resizer/converter routes.
- Developer route: `/svg-to-jsx-converter`.

Recommended implementation direction:

1. Do not remove global tool discovery without a dedicated UX/nav pass.
2. Add or improve short route-specific related-link blocks above broader all-tools surfaces.
3. Keep anchors natural: `SVG to PNG converter`, `PNG to SVG for Cricut`, `SVG favicon generator`.
4. Avoid repeated keyword-heavy anchor blocks.
5. Prioritize high-demand routes in navigation and contextual links.

## 10. Schema And FAQ Audit

FAQ schema was detected on 38 indexable routes. Current usage is not automatically a problem, but it should be treated carefully.

Schema strengths:

- FAQ schema is present on many utility/editor pages where practical questions can help.
- No missing title/description/H1 issue was found in the rendered inventory.

Schema risks:

- Repeated one-question FAQ blocks can become thin if they only restate the page title.
- Platform wrappers are at risk of near-duplicate FAQ wording with only the platform name changed.
- Any FAQ schema must match visible content and should not promise conversion capabilities the route does not support.
- Adding FAQ schema to every route would be a spam risk.

Recommended schema policy:

- Add FAQ only where the page has genuinely useful visible questions.
- Prefer route-specific questions about input limits, transparency, output format, cutting/design workflow, and when to use a different tool.
- Do not use FAQ to stuff keyword variants.
- Before adding more FAQ schema, run a duplicate FAQ wording audit.

## 11. US-English Audience Targeting Notes

The site already uses mostly natural English converter phrasing. For a US-focused audience and higher-RPM utility traffic, prioritize practical terms users recognize:

- `PNG to SVG converter`
- `JPG to SVG converter`
- `image to SVG converter`
- `SVG to PNG converter`
- `SVG to PDF converter`
- `SVG favicon generator`
- `Cricut SVG converter`
- `cut file`, `vinyl`, `sticker`, `print then cut`
- `transparent PNG`
- `resize SVG`, `SVG cleaner`, `SVG minifier`

Avoid:

- stuffing every title with multiple variants,
- vague words like "magic" or "AI" unless the route truly uses that behavior,
- overclaiming perfect vectorization from photos,
- generic platform pages that do not mention the actual platform workflow,
- long meta descriptions that read like a feature dump.

Good future copy should stay direct, tool-specific, and honest about limitations.

## 12. Prioritized Implementation Plan

### Must Fix Before More SEO Growth

| Route/family | Issue | Fix type | Risk | Validation |
| --- | --- | --- | --- | --- |
| `/` and `/png-to-svg-converter` | Potential homepage/PNG intent overlap | Metadata and lower-page intent separation | Medium | Route smoke, title/description parity review, Search Console follow-up. |
| Core and Cricut long descriptions | Snippets are too long and feature-heavy | Metadata rewrite | Low to medium | Route coverage, rendered metadata diff, route smoke. |
| Platform wrapper clusters | Thin/doorway risk | Route-specific lower-page content review | Medium | Route smoke, link audit, content diff review. |
| FAQ/schema expansion | Duplicate FAQ risk | Duplicate FAQ audit before additions | Low | Schema-visible-content check. |
| Broad link blocks | Contextual link dilution | Add route-specific related links before broad all-tools blocks | Medium | Navigation/link audit and rendered route spot checks. |

### High Impact, Safe Batch 1

Route family: core converter and export pages.

Recommended routes:

- `/`
- `/png-to-svg-converter`
- `/jpg-to-svg-converter`
- `/jpeg-to-svg-converter`
- `/webp-to-svg-converter`
- `/svg-to-png-converter`
- `/svg-to-jpg-converter`
- `/svg-to-pdf-converter`
- `/svg-to-favicon-generator`
- `/svg-to-ico-converter`
- `/png-to-ico-converter`

Recommended changes in a future implementation pass:

- Tighten title/description intent.
- Preserve canonical URLs.
- Keep H1s natural and route-specific.
- Improve route-specific lower-page explanations around input/output, transparency, limitations, and next tools.
- Do not touch conversion behavior.

Risk: low to medium if limited to metadata/copy/content modules. Higher if route components are refactored.

### High Impact, Safe Batch 2

Route family: Cricut/craft/sticker routes.

Recommended routes:

- `/cricut-svg-converter`
- `/png-to-svg-for-cricut`
- `/image-to-svg-for-cricut`
- `/jpg-to-svg-for-cricut`
- `/webp-to-svg-for-cricut`
- `/png-to-svg-for-cricut-print-then-cut`
- `/png-to-svg-for-cricut-vinyl`
- `/png-to-svg-for-cricut-stickers`
- `/sticker-to-svg-for-cricut`

Recommended changes:

- Tighten long meta descriptions.
- Add route-specific craft/cut-file expectations where thin.
- Explain when a route produces single-color, cut-friendly, layered, or sticker-oriented results.
- Avoid moving actions/loaders or presets.

Risk: medium to high because these modules are conversion-heavy. Prefer report-only route mapping before implementation.

### High Impact, Safe Batch 3

Route family: marketplace/platform wrappers.

Recommended routes:

- Etsy/Shopify/Printify/Printful export wrappers.
- Canva/Figma design workflow wrappers.
- Glowforge/Silhouette cleaner/resizer wrappers.

Recommended changes:

- Improve route-specific use cases and related links.
- Decide whether each wrapper deserves indexable content after Search Console/Bing data is available.
- Avoid adding generic content to every wrapper.

Risk: medium because duplicate/thin-page risk is high.

### Later

- Developer/base64/code pages.
- Complex SVG editor pages.
- Layered SVG pages.
- Full schema/FAQ expansion.
- Canonical/noindex decisions for low-value wrappers.
- Docs refinements.

## 13. Routes That Should Not Be Changed Yet

Do not change these in the first SEO implementation batch:

- `app/routes/home.tsx`, except for carefully scoped homepage SEO intent decisions.
- `app/routes/base64-to-svg.tsx`
- `app/routes/base64-to-svg-for-cricut.tsx`
- `app/routes/code-to-svg-for-cricut.tsx`
- Layered SVG routes with server-assisted or layered output behavior.
- Complex editor implementation routes such as `/svg-background-editor`, `/svg-recolor`, `/svg-cleaner`, and `/svg-resize-and-scale-editor`.
- Legal pages unless a policy/trust issue appears.
- Redirect aliases unless route coverage or crawl data shows index/canonical drift.

Reason: these routes are large, behavior-heavy, or explicitly not SEO growth pages. SEO work should not accidentally touch conversion, upload, output, preset, or editor behavior.

## 14. Regression Gates For SEO Implementation Batches

Every future SEO implementation batch should run:

- `git status --short --branch`
- `git diff --stat`
- `git diff --name-only`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

If route/bundle/content boundaries are touched, also run:

- `npm.cmd run test:manifest-bundle`
- `node --check scripts/manifest-bundle-audit.mjs`

If route expansion or sitemap/indexing behavior is touched, also run:

- `npm.cmd run test:route-expansion`
- `node --check scripts/route-coverage-audit.mjs`
- `node --check scripts/navigation-audit.mjs`

Manual review gates:

- Compare old and new titles, descriptions, canonicals, H1s, and visible SEO sections route by route.
- Confirm FAQ/schema still matches visible content.
- Confirm no route URL changes.
- Confirm no conversion/editor/output/upload behavior changed.
- Confirm no unrelated global content bundle was introduced.

## Appendix A: Indexable Route Inventory By Family

This appendix lists all indexable public route paths reviewed in the SEO inventory.

### Core Raster-To-SVG Routes

- `/`
- `/png-to-svg-converter`
- `/jpg-to-svg-converter`
- `/jpeg-to-svg-converter`
- `/webp-to-svg-converter`
- `/transparent-png-to-svg-converter`
- `/logo-to-svg-converter`
- `/icon-to-svg-converter`
- `/sticker-to-svg-converter`
- `/line-art-to-svg-converter`
- `/drawing-to-svg-converter`
- `/scan-to-svg-converter`
- `/sketch-to-svg-converter`
- `/image-to-svg-outline`
- `/photo-to-svg-outline`
- `/black-and-white-image-to-svg-converter`
- `/gif-to-svg-converter`
- `/avif-to-svg-converter`
- `/bmp-to-svg-converter`
- `/tiff-to-svg-converter`

### SVG Export And Favicon Routes

- `/svg-to-png-converter`
- `/svg-to-jpg-converter`
- `/svg-to-webp-converter`
- `/svg-to-pdf-converter`
- `/svg-to-favicon-generator`
- `/svg-to-ico-converter`
- `/image-to-favicon-generator`
- `/png-to-favicon-generator`
- `/jpg-to-favicon-generator`
- `/logo-to-favicon-generator`
- `/png-to-ico-converter`
- `/svg-to-png-for-shopify`
- `/svg-to-favicon-for-shopify`
- `/logo-to-favicon-for-shopify`
- `/svg-to-png-for-etsy`
- `/svg-to-jpg-for-etsy`
- `/svg-to-png-for-printify`
- `/svg-to-png-for-printful`
- `/sticker-to-png-for-printing`
- `/svg-to-transparent-png-for-printing`
- `/svg-to-png-for-canva`
- `/svg-to-png-for-figma`

### SVG Editor Routes

- `/svg-background-editor`
- `/svg-resize-and-scale-editor`
- `/svg-recolor`
- `/svg-minifier`
- `/svg-cleaner`
- `/svg-preview-viewer`
- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`
- `/svg-dimensions-inspector`
- `/svg-file-size-inspector`
- `/svg-accessibility-and-contrast-checker`
- `/svg-resizer-for-shopify`
- `/svg-resizer-for-etsy`
- `/svg-cleaner-for-glowforge`
- `/svg-resizer-for-glowforge`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-silhouette`
- `/svg-resizer-for-canva`
- `/svg-cleaner-for-figma`
- `/svg-resizer-for-figma`

### Cricut, Craft, Marketplace, And Platform Routes

- `/jpeg-to-svg-for-cricut`
- `/png-to-svg-for-cricut`
- `/png-to-layered-svg-for-cricut`
- `/png-to-svg-for-cricut-print-then-cut`
- `/png-to-svg-for-cricut-vinyl`
- `/png-to-svg-for-cricut-stickers`
- `/png-to-svg-for-laser-cutting`
- `/png-to-svg-for-etsy`
- `/png-to-svg-for-silhouette`
- `/logo-to-svg-for-cricut`
- `/cricut-svg-converter`
- `/image-to-svg-for-cricut`
- `/jpg-to-svg-for-cricut`
- `/webp-to-svg-for-cricut`
- `/photo-to-svg-for-cricut`
- `/black-and-white-image-to-svg-for-cricut`
- `/line-art-to-svg-for-cricut`
- `/drawing-to-svg-for-cricut`
- `/sketch-to-svg-for-cricut`
- `/sticker-to-svg-for-cricut`
- `/base64-to-svg-for-cricut`
- `/code-to-svg-for-cricut`
- `/layered-svg-for-cricut`
- `/image-to-layered-svg-for-cricut`
- `/jpg-to-layered-svg-for-cricut`
- `/logo-to-layered-svg-for-cricut`
- `/png-to-svg-for-shopify`
- `/logo-to-svg-for-shopify`
- `/logo-to-svg-for-etsy`
- `/sticker-to-svg-for-etsy`
- `/image-to-svg-for-etsy`
- `/jpg-to-svg-for-etsy`
- `/png-to-svg-for-glowforge`
- `/jpg-to-svg-for-glowforge`
- `/logo-to-svg-for-glowforge`
- `/image-to-svg-for-glowforge`
- `/image-to-svg-for-silhouette`
- `/jpg-to-svg-for-silhouette`
- `/logo-to-svg-for-silhouette`
- `/sticker-to-svg-for-silhouette`
- `/jpg-to-svg-for-canva`
- `/png-to-svg-for-canva`
- `/logo-to-svg-for-canva`
- `/png-to-svg-for-figma`

### Layered SVG Routes

- `/image-to-layered-svg-converter`
- `/jpg-to-layered-svg-converter`
- `/logo-to-layered-svg-converter`
- `/image-to-layered-svg-for-cricut`
- `/jpg-to-layered-svg-for-cricut`
- `/logo-to-layered-svg-for-cricut`
- `/png-to-layered-svg-for-cricut`
- `/layered-svg-for-cricut`

### Developer, Code, Text, And Base64 Routes

- `/svg-embed-code-generator`
- `/inline-svg-vs-img`
- `/svg-to-base64`
- `/base64-to-svg`
- `/svg-to-jsx-converter`
- `/text-to-svg-converter`
- `/emoji-to-svg-converter`
- `/free-color-picker`
- `/base64-to-svg-for-cricut`
- `/code-to-svg-for-cricut`

### Documentation And Meta Routes

- `/how-it-works`
- `/how-it-works/conversion-workflow`
- `/how-it-works/exporting-and-downloads`
- `/how-it-works/presets`
- `/how-it-works/settings`
- `/how-it-works/troubleshooting`
- `/pro-waitlist`
- `/sitemap`

## Appendix B: First SEO Implementation Batch Checklist

Use this checklist only in a future implementation pass:

1. Capture current title, description, canonical, H1, visible SEO headings, FAQ/schema, and top related links for each route.
2. Draft title/description/content changes for one route family only.
3. Keep route URLs, canonicals, conversion UI, actions/loaders, presets, upload validation, output controls, affiliate/ad behavior, and navigation grouping unchanged.
4. Verify rendered metadata and visible content route by route.
5. Run the required regression gates.
6. Commit only SEO/content files changed for that batch.
