# iLoveSVG — Independent SEO, Conversion UX, Reliability and Weekly Release Backlog

**Audit:** 2026-10-14  
**Repository:** https://github.com/suhas-sunder/ilovesvg  
**Source baseline (pre-audit commit):** main at 0a6e874ac6b93374e1ffe63a258d1055b3520657  
**Live site:** https://www.ilovesvg.com  
**Status:** PLANNING ONLY — separate from implementations or SEO deployments.  
**Owner's first-hand issues:** [ai-issues/README.md](./README.md) (untouched).  

## 0. Scope, reliability and non-duplication

The owner's issue log already requests a credible author/about profile, byline and footer attribution, with relevant experience. **Do not re-file that item here**. Implement from the owner README, not from this audit.

The repo has substantial prior audits and closure work, especially docs/audits/ilovesvg-final-repository-closure.md, docs/audits/ilovesvg-canonical-consolidation-plan.md, docs/audits/ilovesvg-memory-safety-audit.md, docs/audits/ilovesvg-output-quality-regression-plan.md and docs/performance/high-fidelity-browser-reality-check.md. Those documents are historical evidence, NOT proof that a previously reported defect is still present. Do not reopen one of their findings without a fresh reproduction. In particular:

- 157 registered routes in the route manifest; 156 public routes; 28 already approved/established direct redirects; about 125 XML sitemap / indexable URLs. The repository's public/sitemap.xml has **125 distinct loc entries** at this baseline. These counts are NOT an endorsement that all pages perform well in search.
- Prior final closure classified remaining self-canonical routes as intentionally distinct pending feature-preservation evidence. Do NOT propose merging/deleting them solely because their components share code or meta keywords.
- Historical 2026-05 browser audits found severe layered-conversion non-completion with large raster fixtures; later performance/quality work may have improved it. Fresh browser reality checks are necessary before calling it an open bug.
- Architecture: React Router v7 SSR with server actions, hybrid client/browser worker and server fallback, raster vectorization, utility SVG editors/exporters, one global All Tools site navigation, PostHog, and route-wide advertising policy. Do NOT confuse this with a purely client-only SVG converter.
- Live pages inspected: homepage, /png-to-svg-converter, /png-to-svg-for-cricut, /cricut-svg-converter, /photo-to-svg-for-cricut, /image-to-layered-svg-for-cricut, /svg-to-png-converter, /svg-minifier and /how-it-works. This audit did not operate the tool in an authenticated interactive browser, run local automated tests, submit uploads, or benchmark Core Web Vitals.
- Confidence labels: **Confirmed source fact** means exact code/static content inspected; **Investigate** means plausible risk, not a verified defect; **Opportunity** means a possible business/SEO experiment, NOT measured demand.
- SEO geography priority: US, Canada, UK, Australia (possibly NZ) **only as working markets**. Western traffic and high advertiser value are not interchangeable. No first-party impressions, page RPM, actual ranks, CPC, volume, competitor traffic or organic uplift were obtained. A connected Semrush account lacks API units; this report does not use or invent Semrush metrics (account notice: https://www.semrush.com/mcp-access). Historical GSC Wizard access was subscription-blocked. Do not infer the site's ranking problem from public results alone.

**Operating rule:** Value from existing indexed entrypoints before adding dozens more pages. Prefer quality, conversion and trust changes with reversible, page-scoped rollouts; no blanket meta-title/body rewrites, migrations, mass redirects, ad-density increases or unreviewed AI-generated SEO content.

## 1. Highest-leverage audit actions (before claiming to know *why* growth lags)

### SVG-M01 — Build a first-party organic traffic / conversion decision table
**P0 diagnosis | Confidence: existing measurement hook confirmed; missing insight, not proved missing telemetry | Implementation: analytics/report first.**

Evidence: app/client/lib/analytics/toolEngagement.ts exports trackToolEngagement and trackToolEngagementOnce via PostHog; app/provider.tsx configures PostHog; route manifest identifies many route families. Existing tracking alone does NOT establish coverage, consent correctness or data completeness.

Per indexed landing page and country/device, inspect: organic clicks/impressions/CTR and query position; landing sessions; drag/drop/file selected; preset chosen; conversion started; conversion completed vs canceled/error/timeout; result visible; SVG/PNG/PDF downloaded; another tool clicked; waitlist CTA. Reconcile actual code emission, PostHog counts and server fallbacks, sampling/privacy/consent, and ad revenue by **session** if accessible. Do not transmit filenames, artwork pixels, image hashes, user-entered SVG, raw errors containing file contents, or other personal data. Add bounded, documented event names only for genuinely absent steps; do not double-count retries or cached results.

Acceptance: a simple 28/90-day ranking of (a) entrypoints that get traffic but lose users, (b) pages that are unseen despite likely target intent, and (c) successful workflow+geography cohorts. Separate underperforming impressions from weak SERP CTR, weak conversions, and monetization issues. Without these observations, “more SEO pages” is speculation.

### SVG-M02 — Query/URL cannibalization investigation before any route consolidation
**P0 diagnosis | Confidence: 125 indexable URLs + potential intent proximity source-confirmed; cannibalization NOT established.**

Evidence: app/routes.ts and app/data/routeManifest.ts contain variants around PNG/JPG/JPEG, transparent PNG, Cricut format/workflow variants, favicon variants, SVG-to-PNG for marketplaces, resizer variants, etc. Existing direct alias routes and noindex/redirect handling are deliberate. Historical canonical plan says future redirects require strict workflow and feature preservation.

For the top 25–50 real query clusters (e.g. png to svg, image to svg, svg to png, layered svg for cricut, favicon from png, svg resizer, cricut svg converter), compare overlapping page URLs, indexed/Google-chosen canonicals and true query destinations. Identify one primary URL per *shared intent* only if the pages genuinely compete; leave different intent and behavior separate. Compare server-rendered body utility, title/H1, input support, FAQ, filename and preset contract before contemplating changes.

Acceptance: produce “KEEP / CROSSLINK / CONTENT-FIX / CONSOLIDATION CANDIDATE” per cluster with Search Console URL inspection and baseline clicks; any redirect requires the 2026 canonical-plan preservation gate plus documented owner approval. Do not 301 an established page merely because both produce an SVG.

### SVG-M03 — Verify revenue and ad engagement do not obscure main task completion
**P1 experiment | Confidence: ad policy and delayed units confirmed; no measured ad harm.**

Evidence: app/root.tsx injects an AdSense script on monetizable routes; app/client/components/ads/AdsenseDelayed.tsx delays unit creation/requests; app/client/components/navigation/OtherToolsLinks.tsx renders an ad before the extensive All Tools grid; some routes use additional contextual and ultra-wide sidebar units. Repo contains prior monetization/browser audits.

Measure first input visible, CLS, interaction to conversion start, full-result visibility, scroll depth, ad request/fill/viewability and revenue **without** incentivizing accidental ad clicks. Audit mobile and low-bandwidth conditions, blank/unfilled slots, and clear separation between ads and tool CTAs. Prefer preserving a fast successful conversion over maximizing ads per page. Only propose layout changes if real adverse behavior is evidenced.

## 2. Distinct reliability, UX and technical SEO findings

### SVG-R01 — Simplify initial preset choice *without removing advanced presets*
**P1 low-risk A/B candidate | Confirmed UX surface; effectiveness untested.**

Live /png-to-svg-converter exposes two immediate presets and a “Show 168 more presets” control (count can vary by route and release); app/client/components/converter/PresetSelector.tsx uses visibleLimit = 2, searchable expanded presets and speed filter. Competing tools often foreground an instant upload/convert and limited obvious choices. Current broad functionality is an asset but can also induce decision overload.

Test a genuine first-run funnel: default preset + “Improve result” secondary choice; novice vs experienced sessions; retain search/pinned favorites/full preset inventory in advanced mode. Run 6–10 manual cross-device usability sessions; track first conversion completion and quality acceptance. **Do not delete presets or unilaterally change defaults**—those affect output, quality, and historical user workflows.

### SVG-R02 — Reproduce high-fidelity layered output in the real browser
**P1 conditional correctness check, elevate P0 if still failing | Historical issue, current status unknown.**

Evidence: docs/performance/high-fidelity-browser-reality-check.md previously reported that large-card/photo fixtures never reached a usable layered output within the observed browser time window, despite server diagnostics passing, and oversized SVG path outputs. The code now has workers, cache/deduplication, ownership logic and extensive subsequent audits; do not assume the same bug persists.

Fresh reproducible matrix: monochrome logo, multicolor flat sticker, photographed object, antialiased line art, high-contrast text, transparent icon, large source, small source. On /, /png-to-svg-converter, /image-to-layered-svg-for-cricut and other major high-intent routes record user-visible progress, success, cancellation, reload/route switch, result preview, path count/file size, copy/download and browser memory. Include desktop Chrome/Firefox and mobile Safari/Chrome, server-busy simulation, and different presets. If an old issue is gone, record PASS and **do not reimplement**.

### SVG-R03 — Cross-route browser/server fallback and cancellation trust
**P1 verification | Confirmed hybrid architecture, failure not demonstrated.**

Evidence: app/client/lib/tracing/useHybridTraceFetcher.ts first tries browser raster tracing and can submit to server fallback after failure or when a server-first mode applies; route actions accept multipart forms and enforce resource limits. Inspect stale-result ownership and state transitions on rapid submit, cancel, switch preset, upload replacement, network drop, 429/Retry-After, browser memory pressure and cache hit. Retain original selected image and correct settings/filename. Detect “successful download from previous upload” as a hard failure. Build representative end-to-end tests that use the actual user interface, not direct server-only calls. Existing state-ownership and cache tests should be reused.

### SVG-R04 — Publish precise processing/privacy wording for each workflow
**P1 factual/trust correction if mismatch observed | Source-confirmed processing divergence, privacy claim accuracy unverified.**

Live raster pages say images are processed and not stored; /svg-to-png-converter explicitly says browser-local/no server processing. Source confirms hybrid raster browser/server fallback (useHybridTraceFetcher.ts, server actions), while SVG-to-PNG browser raster export is local. Verify privacy policy and user-facing copy distinguish **upload/processing location**, temporary server handling, retention/logging and processing limits. Do not universally claim “never uploaded” across raster-to-SVG tools. Avoid exaggerating offline support, guarantees of Cricut compatibility, “AI” generation, no watermark, unlimited usage or output editability. Correct only demonstrably inaccurate statements. Never log uploaded content into telemetry.

### SVG-R05 — Audit mismatches between advertised upload limits and actual per-route enforcement
**P1 finite matrix | Investigate; not a confirmed mismatch.**

Live /png-to-svg-converter displays 30 MB / 30 MP / 8000 px longest-side claims. app/routes/png-to-svg-converter.tsx declares MAX_UPLOAD_BYTES = 30 MB; app/utils/backendSecurity.server.ts has a separate shared MAX_UPLOAD_BYTES = 12 MB; route-specific validation may intentionally override shared limits. Avoid claiming 12 vs 30 is a bug without tracing the precise call path.

Build a matrix for PNG/JPEG/WebP/BMP/AVIF/TIFF/GIF/HEIC and important routes: file picker accept, browser decoding, local compression, backend MIME/signature, size/dimension guards, preset capability and final error. Include limits at +/-1 byte/pixel, empty/wrong-signature files, animated vs first frame and mobile photos. Acceptance: published formats/limits are true for the *actual route*, actionable errors replace vague resets, legitimate uploads work, and no resource exhaustion. Preserve intentional specialist input restrictions.

### SVG-R06 — Check whether default conversion and result actions are obvious to first-time users
**P1 UX diagnosis | Unproven performance issue.**

Live pages present Input, preset panel, initially empty output and Convert control; some workflows auto-submit after upload. app/routes/home.tsx defines an upload auto-submit grace interval; other route families have different flows. Run user tasks: “convert a logo”, “make Cricut cut file”, “convert an SVG to transparent PNG”; measure upload → result visible → download success. Verify whether “Convert PNG to SVG” text displays on a Cricut/other route where that label is unexpectedly generic. Avoid making every route auto-convert if it can trigger costly high-fidelity jobs or disturb user-selected settings. A/B simple contextual CTAs and brief first-use coaching, not a full redesign.

### SVG-R07 — Error recovery and transparent expected waiting time
**P1 usability safeguard | Investigate.**

Many presets expose speed tags, with “Extreme Speed” and slower layered modes. Verify user-facing progress honestly tracks stages, avoids fake precision, distinguishes queued/server busy from stalled, supports cancel/retry without discarding input, and explains expensive settings in ordinary terms. Correct misleading copy such as claims a retry is automatic if a particular path does not retry. Explicitly test that a failed job does not masquerade as a ready/previous result. Instrument fail reasons in coarse categories, without file data. Do not promise exact conversion time.

### SVG-R08 — Prove route-specific titles, H1 and capabilities against the actual tool
**P1 quality/SEO verification | Investigate; existing SEO audits already pass structural checks.**

Metadata is centrally represented in app/data/routeManifest.ts but route implementations also implement meta() and route-specific content. Older reports passed structural route coverage and many focused SEO fields; that does not prove all promises of input formats, layers, SVG editing, background removal, no watermark and download features are substantively correct. Sample 25+ routes from all families, including Shopify/Glowforge/Silhouette/Etsy/Canva/Figma. If a page is a thin wrapper around a generic tool, confirm the destination UX initializes the promised route context and retains truthful technical detail. Audit titles for inflated promises/near-identical variants **without altering successful-page metadata just for SEO freshness**.

### SVG-R09 — Intent-weighted internal linking versus repeated massive All Tools lists
**P1 bounded experiment | Confirmed design, SEO/user impact unknown.**

app/client/components/navigation/OtherToolsLinks.tsx explicitly displays *every* non-legal utility in a sectioned card grid, on broad portions of the site; screenshot/HTML inspection confirms extensive repeated groups below content. This aids crawl discovery, but may dilute contextual relevance and make related workflows harder to find. Preserve a crawlable complete HTML sitemap at /sitemap and an exhaustive discoverability path, while experimenting with **3–8 truly relevant next actions** above a collapsed/secondary all-tools directory. Track tool-to-tool progression, crawled paths, user findability, pages/session and traffic. Avoid hiding links exclusively behind JavaScript or deleting old links without audit.

### SVG-R10 — Third-party SEO crawler blocks affect external diagnostics, not necessarily Google
**P2 diagnostic policy | Confirmed source fact.**

public/robots.txt disallows AhrefsBot, SemrushBot, MJ12bot, DataForSeoBot and others by user agent, while broadly allowing other crawlers and Google Ads crawlers. This can make third-party visibility/backlink/crawl inventories incomplete or absent; **it is not evidence of Google deindexing or the cause of weak organic rankings**. Decide whether selective reputable-toolbot access is worthwhile relative to server expense and abuse protection, ideally with rate limits and monitoring. Don't remove all blocks indiscriminately. The stale WordPress-looking disallows (/wp-admin/, /*.php$) may be harmless clutter, not an SEO bug.

### SVG-R11 — Mobile performance and large-page render budget
**P1 measurement + scoped optimization | Confirmed code complexity and previous build warnings; field regression unverified.**

Complex route components (app/routes/home.tsx, code-to-svg-for-cricut.tsx, large preset/settings/output modules) and Vite production chunk warnings in docs/checkpoints/final-refactor-seo-monetization-checkpoint.md justify field-level checks; source file length alone does not measure transferred JS or Core Web Vitals. Gather actual LCP, INP, CLS, transfer size, hydration and JS execution from representative 4G mobile and desktop visits using CrUX/GSC field data where possible plus lab traces. Audit first interactive uploader, lazy-load of advanced editors/preset search/results, font usage, ad shifts and long tasks. No speculative React rewrite or blanket lazy imports that break SSR and SEO.

### SVG-R12 — Check SVG sanitation/import safety on every code-input/export path
**P1 security/reliability test matrix | Existing sanitization code present; no exploit verified.**

SVG utilities accept user-supplied markup and support preview, PDF/raster, embeddable code, Base64, JSX and sometimes remote references. Existing app/utils/svgSanitize.server.ts and specialized editor/parser guards must be retained. Use harmless fixtures to verify that scripts/event handlers, external resource references, oversized XML, data URIs, malicious attributes, unexpected fonts/masks, and nonstandard SVGs cannot execute or exfiltrate content through preview or generated downloads. Verify failures are bounded and preserve safe SVG features; review relevant existing test cases before filing a defect. Do not publish exploit instructions in user-facing SEO pages.

### SVG-R13 — Audit “Most Popular” and other popularity/performance claims
**P2 trust/copy accuracy | Confirmed ungrounded static label, rankings unknown.**

app/client/components/navigation/toolNavSections.ts labels a group “Most Popular” and describes it as “highest-demand conversion and export tools.” That categorization appears hard-coded, not built from observed analytics in the inspected source. Verify against actual sessions and successful conversions. If unsubstantiated, change the label to neutral “Common tools” or “Core converters”, or reorder based on reviewed real demand; don't manufacture “most used” assertions. This is specific factual copy, not a broad content-rewrite request.

### SVG-R14 — Sitemap/manifest/SSR canonical regression gates
**P1 release safety | Current inventory consistent at source; live runtime not fully verified.**

Confirmed public/sitemap.xml has 125 distinct loc URLs, matching current count of indexable route records found in app/data/routeManifest.ts. Existing scripts already cover SEO, routes, route expansion, route coverage, and schema; do NOT replace them with a new framework. Add a check, if missing, that the committed XML sitemap cannot drift from indexable manifest + live 200 status + meta robots + canonical, that established 28 direct redirects never accidentally appear in sitemap, and that explicit original-page canonical choices survive SSR/browser navigation. Validate 301/308/no loops and www versus non-www. Inspect real Google-selected canonicals separately before claiming indexing success. Preserve user-facing /sitemap HTML page distinctly from /sitemap.xml.

### SVG-R15 — Search snippets and social previews for top landing pages
**P2 only after query performance review | Missing actual preview data.**

Key route meta() implementations include titles, descriptions, canonical and OG URLs. Before adding more copy, compare top US/CA/UK/AU impressions pages: SERP title rewrite, snippet shown, competitor SERP intent, actual page first screen, and sharing unfurl graphics/CTA. Use a limited fixed-URL trial with true intent alignment, then observe change over comparable weeks; avoid bulk template title edits or promises of guaranteed ranking improvements. Check presence/quality of image previews where appropriate, no need to invent ad-friendly imagery.

## 3. Competitor research and potential differentiation (not “competitors are winning” claims)

### Confirmed competitor/public product positioning

- **PngToSVG.com — https://pngtosvg.com/**: single obvious PNG/JPG/WebP upload, examples showing output, privacy/no signup messaging and path editing; includes paste-from-clipboard option. Competes on speed to first result and proof of output quality.
- **Vectorizer.AI — https://vectorizer.ai/**: AI-themed/high-quality raster vectorization positioning and advanced export; verify actual pricing before any comparison. iLoveSVG should not label deterministic tracing as generative AI if it is not.
- **Adobe Express — https://www.adobe.com/express/feature/image/convert/svg**: broad brand trust, quick action and designer funnel; do not attempt to match the entire editor product.
- **Vector Magic — https://vectormagic.com/**: quality-centric auto-trace/workflow with optimization choices; competing on measurable path quality may beat generic keyword breadth.
- **Inkscape — https://inkscape.org/**: free full editor with Trace Bitmap and rich manual repair, but requires desktop install; highlights difference between quick web conversion and deep editing.
- **SVGOMG / SVGO — https://jakearchibald.github.io/svgomg/** and https://github.com/svg/svgo: focused SVG optimization and preview; iLoveSVG already has svg-cleaner and svg-minifier—do not propose as absent.
- **Cricut Design Space** and **Silhouette Studio**: target import/handoff tools, not necessarily direct competitors to a browser SVG tracer; compatibility must be verified with supported test files.

These are capability and positioning comparisons, **not verified Semrush traffic/keyword rankings**. Competitor testimonials/visitor counters and sponsored best-of listicles are not independent evidence of performance.

### Candidate tests and additions, ordered by value-to-risk

| ID | Candidate | What's already present? | Why consider it? | Test before build |
| --- | --- | --- | --- | --- |
| SVG-S01 | **Real before/after examples with a small quality benchmark set**: logo, silhouette, multicolor sticker, bad compressed JPG, photo | ExampleSvgConversion component and many route examples exist; verify their current above-fold visibility | Gives a skeptical new user proof of actual quality; can distinguish true vector paths from raster-wrapped SVG | Instrument view/click-to-upload; save real asset pairs and deterministic test fixtures; no fake images |
| SVG-S02 | **Basic/Advanced conversion landing interaction** | Full searchable presets and Advanced Settings already present | Make first result easier without losing power-user controls | Compare first-success and download completion on mobile; respect existing presets |
| SVG-S03 | **Cricut import troubleshooting focused on REAL common cut failures** | Extensive Cricut/Print Then Cut/vinyl/layered routes and docs; don't add another synonym page | Provide practical guidance for floating islands, filled holes, unwanted backgrounds, excessive nodes and bad material cuts | User tickets and actual import tests; link from relevant tool/FAQ |
| SVG-S04 | **SVG file quality/complexity report adjacent to downloads** | Cleaner/minifier, dimensions/file-size inspector, layer controls already exist | Show path count, nested grouping, colors, output KB and cut-file caveats in-context instead of another landing page | Real cut/design app imports, safe implementation, no intrusive UI |
| SVG-S05 | **Clipboard image paste for raster upload** | SVG-to-PNG route supports paste; home and png-to-svg route source inspected has drop handlers but no clear raster paste handler | Reduces time from screenshot/logo copy to input; PngToSVG foregrounds paste | First verify any global handler/support; privacy and MIME protections; mobile clipboard support limitations |
| SVG-S06 | **Developer SVG use cases (sprites/symbols, CSS inline optimization)** | Already SVG-to-JSX, embed code, Base64, inline-vs-img, minifier and editor | Adjacent useful jobs where developers may need distinct operations, but may overlap brand and market | Search demand + real workflows; only add tool if genuinely new functionality |
| SVG-S07 | **Laser/cutter handoff DXF export** | SVG laser/Glowforge/Silhouette route family present, but no verified DXF export route | Some machine workflows require DXF, which competitors advertise | Check genuine DXF needs, libraries/licenses, units/path fidelity and download behavior; heavy effort, defer |
| SVG-S08 | **Platform-tested output recipes rather than more platform-branded URLs** | Already Shopify, Etsy, Figma, Canva, Cricut, Printify, Printful, Silhouette, Glowforge content | Practical size/transparency/import QA can differentiate pages from generic “for X” labels | Use documented platform requirements, no unsupported “official compatibility” claims |
| SVG-S09 | **Examples of failures and their remedy** | How-it-works troubleshooting exists | Visitors with photos/text may not understand tracing limitations; realistic expectations reduce bounce | Collect coarsened failure categories; small illustrated additions to existing guide |
| SVG-S10 | **Focused SEO educational comparison: SVG true paths vs embedded bitmap, tracing vs AI** | Existing inline SVG guide and converter explanations | Align conversion quality/search intent and build trust; not a route farm | Distinct intent and human-edited factual content, avoid sensational AI claims |
| SVG-S11 | **Favicon preview in context / common brand asset handoff** | Favicon generator includes package and variants already | Could make tool value tangible when already inside favicon flow | Confirm existing preview before proposing; no duplicate generator |
| SVG-S12 | **Performance/status education embedded in preset selector** | Speed tier labels present | Helpful to choose a fast preview before layered, long-running conversion | Validate real relative cost per preset and avoid fabricated exact times |

**Not missing:** PNG/JPG/JPEG/WebP→SVG, image→SVG, color/layered Cricut, vinyl/sticker/Print Then Cut, SVG→PNG/JPG/WebP/PDF, favicon/ICO, SVG cleaner/minifier, resizer, recolor, background editor, code→SVG/JSX, dimension/size inspectors, accessibility/contrast, Base64, many platform workflows, ads, HTML sitemap, basic docs, waitlist. Do not add a second copy under a different keyword.

## 4. Organic SEO strategy for high-value English-language markets

**What makes underperformance plausible (hypotheses, not measured root causes):**
1. Big incumbent competitors in generic “png to svg converter” queries; user trust and perceived quality can trump route count.
2. 125 separate indexable intents, many near-synonyms and platform context wrappers; pages might split search demand or be clustered by search engines, but need GSC evidence.
3. Visitors may care more about first usable vector and export than a giant settings library. Bad first conversion, if found, impacts usage regardless of rank.
4. Crawler restrictions can make third-party SEO intelligence incomplete (not necessarily Google visibility).
5. Conversion costs, slow layered modes, and large client/server complexity may impair actual mobile conversion if the historical failure modes recur.

**Do not act on these as proof.** First obtain 90 days + 28 days of real first-party query/landing-page performance split by US, CA, UK, AU and device. Group at least: generic image/svg conversion, SVG→raster, Cricut/craft, marketplace, developer tooling, SVG cleaning/optimization, favicon/brand. Use Search Console page+query pairs, selected canonical, CTR and position; compare month-to-month and year-over-year if available. Exclude traffic from irrelevant countries when prioritizing high-RPM goals, but do not block visitors geographically.

**Decision framework:** high impressions + position 4–15 + weak CTR → intent/snippet study; rankings good + tool abandonment → conversion/quality problem; low impressions + high demonstrated utility → internal discovery/coverage gap; growing traffic + weak RPM → ad/country/device analysis; zero impressions on variants → distinguish new URLs, duplicate clustering, crawl demand and quality before adding more pages. A paid/high-CPC commercial keyword does not necessarily yield high AdSense RPM per session. Keep high-intent utility workflows ad-light and working.

SEO constraints: Google's doorway/scaled-content-abuse guidance cautions against mass near-duplicate landing pages; canonical consistency and distinct user purpose matter (https://developers.google.com/search/docs/essentials/spam-policies and https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting). Page experience matters, but “perfect Lighthouse” isn't a ranking guarantee (https://developers.google.com/search/docs/appearance/page-experience). Snippets are not wholly controlled by meta descriptions (https://developers.google.com/search/docs/appearance/snippet).

## 5. Weekly release candidates (not an implementation authorization)

| Lane | Scope | Pass/stop condition |
| --- | --- | --- |
| **W1 – performance diagnosis** | SVG-M01 traffic / funnel inventory and SVG-M02 top queries/pages overlap report. SVG-R10 crawler policy discussion. | Read-only report; categorize lost demand vs lost conversions vs monetization; no production change. |
| **W2 – conversion quality acceptance** | SVG-R02 real-browser fixture checks + R03 fallback/cancel/retry + R05 format/size limit matrix. | Real user-visible correct results and downloads; reproducible failures triaged with owner. |
| **W3 – fastest-path UX experiment** | SVG-R01/S02 narrow first-run preset and convert presentation experiment; optionally S05 clipboard paste after feasibility. | Measure successful first conversion; preserve preset access, output, advanced settings and current URLs. |
| **W4 – SEO hygiene, not mass rewrite** | SVG-R08 sample truthful capability/metadata review, R13 unsupported “Most Popular” label if needed, R14 sitemap/SSR/redirect gates. | Limited factual corrections; canonical/metadata diffs and baseline traffic protected. |
| **W5 – mobile/user perception** | SVG-R11 mobile field/lab performance; SVG-R09 contextual related tools pilot. | Measured real improvements to INP/LCP/download completion; all-tool sitemap still crawlable. |
| **W6 – creator proof and reliability** | SVG-S01 demonstrable before/after real outputs + SVG-R07 honest progress/recovery messaging if failures found. | No fabricated quality images; true output fixtures; performance stays acceptable. |
| **W7 – targeted craft/developer content** | Pilot one S03/S08/S09 use-case enrichment on an existing page, based on demand. | Real workflow tests + unique, concise guidance; do not launch 20 thin variations. |
| **W8+ – evaluate expansion or monetization** | SVG-S06 or S07 only when search/workflow demand justifies engineering cost; revenue/layout tests M03. | Comparable country-specific engagement and net ad results, tested output fidelity; otherwise defer. |

W1 and W2 are the safest immediate work because they answer why the site is underperforming before changing a ranking asset. Do not force all items into one sprint. If one release has a high-risk tracing engine change, exclude major content/sitewide UX changes from that release.

## 6. Release checklist and acceptance ownership

For every chosen issue:
1. Declare one small problem, owner-approved scope, affected route family, current baseline and rollback plan.
2. Confirm an issue is *currently* reproducible; older PASS/FAIL reports, code review and SERP observations are not current runtime proof.
3. Review AGENTS.md, affected audit plans and current files before implementation. Do not expand from a route-specific task into a massive architectural refactor.
4. Test basic and power users with representative real images and formats. Verify upload -> convert -> preview -> edit (where supported) -> download, user-visible errors, browser/server fallback, history/result ownership and cancellation.
5. Verify SEO meta/H1, canonical/robots, sitemap, SSR body, structured data, redirects, 404 and link integrity, especially on actual production-equivalent URLs.
6. Run relevant existing scripts from package.json: npm run typecheck, npm run build, npm run test:routes, npm run test:seo, npm run test:route-coverage, npm run test:schema, npm run test:navigation-browser and targeted conversion/quality/responsive/monetization/browser smokes as appropriate. Not all scripts ran in this audit.
7. If a behavior/default changes, compare image output visually and structurally (geometry, transparency, fill/stroke, layer count, file size) for normal and adversarial fixture families.
8. Measure 28/90-day by-country Google/Bing search and usage/revenue guardrails where available. Document pre/post and seasonality; preserve successful pages.
9. Do **not** commit/push application changes based on this planning file alone. For an approved release, report status: proposed / confirmed / approved / implemented / runtime-validated / deployed / monitored / deferred.
10. Keep author profile/attribution work in the original ai-issues/README.md; any supplemental findings should cross-reference its entry rather than duplicate it.

## 7. Evidence, URLs and limitations

**Code inspected:** app/routes.ts; app/data/routeManifest.ts; app/root.tsx; app/client/components/navigation/{NavBar.tsx,OtherToolsLinks.tsx,toolNavSections.ts}; app/client/components/converter/PresetSelector.tsx; app/client/lib/analytics/toolEngagement.ts; app/client/lib/tracing/useHybridTraceFetcher.ts; app/utils/backendSecurity.server.ts; app/client/components/ads/AdsenseDelayed.tsx; app/client/lib/monetization/monetizationPolicy.ts; core SVG route modules; public/{robots.txt,sitemap.xml}; multiple prior docs/audits and docs/performance reports.

**Live:** https://www.ilovesvg.com/, https://www.ilovesvg.com/png-to-svg-converter, https://www.ilovesvg.com/cricut-svg-converter, https://www.ilovesvg.com/png-to-svg-for-cricut, https://www.ilovesvg.com/image-to-layered-svg-for-cricut, https://www.ilovesvg.com/svg-to-png-converter, https://www.ilovesvg.com/svg-minifier .

**Competitors:** https://pngtosvg.com/ ; https://vectorizer.ai/ ; https://vectormagic.com/ ; https://www.adobe.com/express/ ; https://inkscape.org/ ; https://jakearchibald.github.io/svgomg/ .

**Confidence limitations:** No fresh authenticated browser manipulation, uploads, local repo execution, real PageSpeed/CrUX session readings, conversion benchmarking, real indexed URL Inspection, current GSC/GA4/PostHog/AdSense metrics or competitor ranking metrics. The source/live inventory establishes test targets, not final diagnosis. Any future agent should validate deployment divergence before marking a code finding fixed. This document is an additive issue list, not a mass implementation instruction.

**Critical choices reserved for owner:** route consolidations or canonicals; default presets/tracing modes; any new DXF/paid products; analytics/telemetry changes; platform feature/compatibility claims; privacy retention language; paid promotion or mass content scaling; major ad layout changes.
