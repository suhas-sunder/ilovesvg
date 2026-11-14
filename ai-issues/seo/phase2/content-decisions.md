# Phase 2 content and utility decisions — November 13, 2026

This review uses PR #12 `78dda78994ea90e7b3a839725021bc316463434e`, actual route implementations, the route manifest, existing documentation, owner requests, and current first-party aggregate events. Historical inventory and drafts are retained beside this report; their observations are not presented as newly verified defects.

## Inventory and intended audience

The foundation has 157 manifest entries: 156 public, 125 indexable and 28 redirect aliases. Families: 19 raster-to-SVG, 37 craft, 8 layered SVG, 23 SVG export, 20 SVG editors, 10 text/Base64/code, 7 documentation, 3 legal, 28 redirects, one API and one sitemap. These counts are source contracts, not a claim that every route has independent search demand. The existing site already covers substantial format and use-case intent.

Review prioritizes English-language users in the US, Canada, UK and Australia; no country duplicate pages are proposed. New Zealand needs no separate version of these workflows. No RPM, CPC, ranking or revenue uplift is predicted.

| Task or gap | Existing destination and decision | Distinct value / evidence |
|---|---|---|
| Identify the maintainer | New `/author/suhas-sunder`; restrained footer attribution | Explicit owner request; visible responsibility and grounded identity |
| Phone image failure and recovery | Improve `/how-it-works/troubleshooting`; link PNG error to its recovery anchor | Owner-reported failure; actual input preparation, format and pixel limits; browser recovery tests |
| Is my SVG vector geometry? | Improve `/how-it-works/exporting-and-downloads` | Real downloadable output; Counts/Source inspection; path versus subpath/bitmap distinction |
| What tracing loses | Six reproducible examples on the same exporting guide | Exact presets, settings, hashes and observed color/detail changes; no new example landing page |
| Cricut preparation | Improve `/png-to-svg-for-cricut` | Real ring/hole/bridge/island example; verified dark-preview background removal; destination import checklist |
| Vinyl, stencil, sticker and layered variants | Preserve existing routes; link relevant next steps | Existing overlapping workflow coverage; no new keyword copies or unsupported machine promises |
| Transparency and background editing | Improve `/svg-background-editor` | Strongest observed utility engagement; actual transparent/opaque downloads and checkerboard distinction |
| Resize, page size and clipping | Link established dimension and resize tools from export guide | Existing working destinations; no unsupported rewrite of resize behavior |
| PNG/JPEG/PDF export | Add concise destination-selection guidance in exporting guide | PNG alpha and JPEG opaque outputs verified; existing dedicated export routes retained |
| Inline/React/Base64/embed code | Preserve established tools and add contextual links | Existing embed generator and redirect aliases already own the intent |
| Inspect SVG dimensions, size and source | Use existing viewers/inspectors | A second generic inspector would duplicate existing functionality |
| Combine an icon set into reusable symbols | Implement a bounded `/svg-sprite-generator`, subject to independent safety acceptance | Existing embed generator handles a single graphic; symbol IDs and local definition rewriting add a distinct workflow. Product gap, not measured search demand |
| SVG-to-DXF/CAD export | Defer | Requires an explicit units/geometry contract, transform/arc handling, fill/stroke semantics and importer/machine testing. No simple extension or incompatible export substitution |
| AI tracing or additional tracing engine | Reject from this scope | Protected conversion quality and existing compatible engine contracts |
| New generic converter/format/country pages | Reject | Existing extensive coverage; no query evidence for additional URLs |
| Canonical consolidation | Defer without query/URL evidence | GSC unavailable; shared implementations alone do not establish cannibalization |
| Mass metadata refresh and link expansion | Reject | Preserve successful URLs, indexability and titles; relevant links travel with their useful content package |

## First-party evidence

Queried PostHog project **289839 (iLoveSVG)** after confirming the project in the active connector conversation. Full UTC windows: October 16–November 12 (28 days) and August 15–November 12 (90 days). These are `tool_engagement` event counts grouped by route and action, not users, sessions or funnels. A limited route/country/device breakdown of download events was also inspected; it is not geographic search-demand evidence.

| Route/action | 28 days | 90 days |
|---|---:|---:|
| Background editor uploads | 161 | 578 |
| Background editor downloads | 105 | 346 |
| Resize editor uploads | 79 | 226 |
| Resize editor downloads | 63 | 205 |
| PDF uploads | 57 | 166 |
| PDF starts / completions | 30 / 26 | 110 / 99 |
| Base64 starts / completions | 25 / 22 | 126 / 104 |
| Line-art starts / completions | 25 / 9 | 109 / 32 |

Different action counts must not be divided into a claimed conversion rate: events do not establish matching sessions or event completeness. Recorded validation errors reinforce recovery documentation, but they do not diagnose the original iPhone incident. The aggregate queries and top-50 series are preserved in `first-party-aggregates.json`; no artwork, raw SVG, filenames or personal session data were queried.

GSC Wizard returned `subscription_required` on the first account check. That blocker was recorded once; no subscription or upgrade was attempted. Its Bing facilities could not be used through the blocked connection. Search queries, URL cannibalization, first-party search demand, revenue and field Core Web Vitals remain unavailable. No claims are inferred from that absence.

## Delivery and release boundaries

Six coherent candidates: A maintainer, B mobile recovery, C output inspection plus examples, D craft, E background editing, F sprite utility. Static explanations stay server-rendered. Example PNG previews are local, dimensioned and lazy-loaded; no client Markdown renderer or third-party script is added. Contextual linking is part of these candidates rather than a separate thin release.

Each candidate adds at most one new indexable page or substantively improves one existing page. Small supporting error links, footer links and sitemap entries are integration changes, not separate content publications. The stacked branches record exact prerequisites; later packages must not be merged in a way that publishes earlier unapproved candidates together. All owner/schedule approvals remain false and publication dates remain null. No artificial release week is reserved.
