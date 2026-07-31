# iLoveSVG non-tracing SVG utility families

## Milestone scope

- Starting main: `59053aaffa3bb5e96d03bd0e77976eff3dfcec11`
- Milestone branch: `milestone/non-tracing-svg-utility-families`
- Scope: favicon/ICO generation, resize/scale, dimensions and file inspection, code/Base64 serialization, and SVG cleanup/normalization
- Excluded: raster tracing, specialized tracing, layered/Cricut output, SVG-to-PNG, unrelated editors, deployment, and infrastructure

The audit resolved 29 directly rendered routes and 10 pre-existing direct permanent aliases. No new public route, redirect, canonical, sitemap entry, internal link, metadata owner, schema owner, breadcrumb, public copy, setting, default, filename, output algorithm, or deployment behavior was introduced or changed.

## Existing architecture and duplication removed

The repository already had three compatible implementation groups:

- All nine favicon and ICO pages render the production implementation in `app/routes/svg-to-favicon-generator.tsx`.
- All seven resize pages render the production implementation in `app/routes/svg-resize-and-scale-editor.tsx`.
- The four cleaner pages render the production implementation in `app/routes/svg-cleaner.tsx`.

The shared components previously inferred public identity from `useLocation()` and the browser pathname. This milestone removed that implicit selection. Every wrapper now supplies an exact typed key to the shared owner. The Base64 decoder action similarly uses its exact context path instead of `window.location.pathname`.

Singleton inspection, serialization, JSX, and minification pages retain their specialized implementations because their input, output, filename, error-handling, or interaction contracts differ. Each singleton now binds an explicit context key without changing its production behavior.

The finite contract is in `app/client/lib/converter/nonTracingSvgUtilityRouteContexts.ts`. It records the route key, exact path, source file, implementation owner, subfamily, operation, input policy, output policy, filename policy, canonical path, redirect destination, and final decision. Each of the 29 renderable routes has exactly one nested content contract recording its content, metadata, schema, breadcrumb, and All Tools owners plus the requires-new-evidence rule. Redirect aliases have `contentContract: null`, so no dead content contract claims ownership for a page that does not render. The collection and retained-route contracts are frozen. Unknown paths, keys, and operation identifiers throw. Query-bearing variants do not resolve. There is no pathname matching, fallback, environment selection, storage, query context, or mutable registry.

## Confirmed subfamilies and final classifications

All directly rendered routes are intentionally retained. A retained route may be reconsidered only after new material code, content, or product evidence.

### Favicon and ICO generation

| Route | Key | Final decision | Evidence |
| --- | --- | --- | --- |
| `/svg-to-favicon-generator` | `favicon-svg` | Retain independently | General SVG source intent and base favicon guidance |
| `/svg-to-ico-converter` | `favicon-svg-ico` | Retain independently | ICO-specific identity and guidance |
| `/image-to-favicon-generator` | `favicon-image` | Retain independently | Format-neutral image intent |
| `/png-to-favicon-generator` | `favicon-png` | Retain independently | PNG-specific source intent |
| `/jpg-to-favicon-generator` | `favicon-jpg` | Retain independently | JPG-specific source intent |
| `/logo-to-favicon-generator` | `favicon-logo` | Retain independently | Logo preparation intent |
| `/png-to-ico-converter` | `favicon-png-ico` | Retain independently | PNG-to-ICO intent |
| `/svg-to-favicon-for-shopify` | `favicon-shopify-svg` | Retain independently | Shopify SVG workflow and terminology |
| `/logo-to-favicon-for-shopify` | `favicon-shopify-logo` | Retain independently | Shopify logo workflow and terminology |

These routes share generation, rasterization, ICO packing, PNG sizes, manifest creation, archive contents, preview, reset, and second-upload behavior. Their titles, metadata, H1s, guidance, schema, breadcrumbs, and sitemap identities remain route-owned.

### Resize and scale

| Route | Key | Final decision | Evidence |
| --- | --- | --- | --- |
| `/svg-resize-and-scale-editor` | `resize-base` | Retain independently | General resize, scale, dimensions, and viewBox intent |
| `/svg-resizer-for-shopify` | `resize-shopify` | Retain independently | Shopify workflow guidance |
| `/svg-resizer-for-etsy` | `resize-etsy` | Retain independently | Etsy workflow guidance |
| `/svg-resizer-for-glowforge` | `resize-glowforge` | Retain independently | Glowforge preparation guidance |
| `/svg-resizer-for-silhouette` | `resize-silhouette` | Retain independently | Silhouette workflow guidance |
| `/svg-resizer-for-canva` | `resize-canva` | Retain independently | Canva workflow guidance |
| `/svg-resizer-for-figma` | `resize-figma` | Retain independently | Figma workflow guidance |

The routes share attribute-only resize logic, dimension parsing, aspect lock, scale percentage, unit handling, preserveAspectRatio, viewBox policy, preview, filename, reset, and second-upload behavior. Platform content and route identities remain distinct.

### Dimensions and file inspection

| Route | Key | Final decision | Evidence |
| --- | --- | --- | --- |
| `/svg-dimensions-inspector` | `inspect-dimensions` | Retain independently | Reports dimensions, viewBox, units, ratio, and optional size fixes |
| `/svg-file-size-inspector` | `inspect-file-size` | Retain independently | Reports source/minified byte measurements and structural size data |
| `/svg-preview-viewer` | `inspect-preview` | Retain independently | Zoom, pan, pick, source review, and safe preview workflow |

The three routes remain separate because read-only dimension reporting, file-size analysis, and interactive visual inspection are materially different workflows. Inspection never gains storage or path disclosure, and the viewer’s exported source remains the loaded source.

### Code and Base64 serialization

| Route | Key | Final decision | Evidence |
| --- | --- | --- | --- |
| `/svg-to-base64` | `serialize-base64-encode` | Retain independently | Base64/data-URI/UTF-8 encoding output |
| `/base64-to-svg` | `serialize-base64-decode` | Retain independently | Decode, sanitize, inspect, and supported raster fallback contract |
| `/svg-embed-code-generator` | `serialize-embed-code` | Retain independently | HTML, CSS, mask, data-URI, and React embed snippets |
| `/inline-svg-vs-img` | `serialize-inline-vs-img` | Retain independently | Side-by-side inline and image embed comparison |
| `/svg-to-jsx-converter` | `serialize-jsx` | Retain independently | React attribute conversion and optional component wrapper |

These pages share neither a single output format nor identical settings, filenames, or error recovery, so their specialized implementations remain. UTF-8, Unicode, comments, XML/source structure, data-URI prefixes, HTML/CSS output, and JSX conversion algorithms are unchanged.

### SVG cleanup and normalization

| Route | Key | Final decision | Evidence |
| --- | --- | --- | --- |
| `/svg-minifier` | `cleanup-minifier` | Retain independently | Compression-level workflow and size-focused output |
| `/svg-cleaner` | `cleanup-base` | Retain independently | General safe cleanup workflow |
| `/svg-cleaner-for-glowforge` | `cleanup-glowforge` | Retain independently | Glowforge preparation guidance |
| `/svg-cleaner-for-silhouette` | `cleanup-silhouette` | Retain independently | Silhouette preparation guidance |
| `/svg-cleaner-for-figma` | `cleanup-figma` | Retain independently | Figma cleanup guidance |

The minifier stays specialized because its None/Tiny/Tiniest contract differs from the cleaner. Cleaner wrappers share one exact implementation while preserving platform guidance, settings, markup handling, output filenames, previews, and route identities.

## Established redirect aliases

These redirects existed on the validated starting main. The milestone did not add, remove, or retarget them.

| Source | Direct permanent destination |
| --- | --- |
| `/svg-viewbox-editor` | `/svg-resize-and-scale-editor` |
| `/svg-resizer` | `/svg-resize-and-scale-editor` |
| `/resize-svg` | `/svg-resize-and-scale-editor` |
| `/scale-svg` | `/svg-resize-and-scale-editor` |
| `/svg-inspector` | `/svg-preview-viewer` |
| `/svg-to-react-component` | `/svg-to-jsx-converter` |
| `/svg-to-css-background` | `/svg-embed-code-generator` |
| `/svg-to-data-uri-converter` | `/svg-to-base64` |
| `/svg-inline-code-generator` | `/svg-embed-code-generator` |
| `/svg-code-cleaner` | `/svg-cleaner` |

Each remains one direct `301`, has a final `200` destination, is absent from XML and HTML sitemaps, and creates no chain or loop. No dead context or active canonical ownership was created for an alias.

## Routes excluded

- `/base64-to-svg-for-cricut` and `/code-to-svg-for-cricut`: completed raster-tracing/Cricut workflows with different output and lifecycle contracts.
- Icon-to-SVG tracing: raster tracing, not favicon generation.
- Background, recolor, stroke, rotate, and accessibility editors: distinct editing algorithms and output contracts.
- Standard and specialized raster-to-SVG, layered SVG, Cricut production output, and SVG-to-PNG: completed route families outside this milestone.

## Preservation and focused correction

No content migration was needed. Metadata, schema, breadcrumbs, sitemap membership, and ordinary internal links were unchanged. Public strings in every retained route are compared to the starting main by the focused audit.

One direct browser defect was found in the embed generator. Before input, the local-blob preview mode could request `/icons/icon.svg`, producing a broken placeholder request even though no source was loaded. The input preview now remains empty until an input or actual asset URL exists. Defaults, generated embed text, output filenames, public copy, and post-input preview behavior are unchanged.

The focused audit also compares the production algorithm/default nodes for favicon packing, resize geometry, dimensions and size inspection, preview sanitization, Base64 encode/decode, embed generation, inline/image snippets, JSX conversion, minification, and cleanup against the starting main. All comparisons pass.

## Output parity

- Favicon/ICO: nine routes produced the same 24-file package. ICO sizes remained `16, 24, 32, 48, 64, 128, 256`; entry order, entry bytes, PNG hashes, manifest, browser configuration, HTML snippet, filenames, and archive inventory matched.
- Resize/scale: all seven retained routes produced byte-identical default output. Locked, unlocked, percentage scale, unit, preserveAspectRatio, and viewBox cases retained their expected output.
- Inspection: parsing and reporting algorithms are unchanged. Browser checks preserved 120 by 80 dimensions, `0 0 120 80` viewBox, `1.5` aspect ratio, 313-byte source size, and source download/copy availability.
- Code/Base64: production encode/decode and serialization functions are unchanged. Browser checks decoded a UTF-8 data URI containing `café` and an emoji, reported `12 × 8`, recovered from invalid Base64, accepted a second valid input, generated HTML/inline/image snippets, copied exact embed output, and generated React JSX.
- Cleanup: cleanup and minification algorithms/defaults are unchanged. A 313-byte fixture produced a 299-byte Tiny result with its `120 × 80` viewBox and preview intact.

The relevant deterministic converter parity sections (`resizers,favicons`) passed. A separate broad route-parity smoke command still reports its pre-existing copy/download limitations on unrelated tracing routes; no touched non-tracing route was implicated.

## Browser coverage

The automated production-rendering audit covered:

- all 29 retained routes at `390 × 844` and `1280 × 720` (58 measurements);
- 10 representative routes at `320 × 800`, `412 × 915`, `768 × 1024`, and `1440 × 900` (40 measurements);
- all 10 established redirect sources and final destinations.

All 98 viewport measurements passed. Maximum measured document/body scroll width was `1425` at the `1440` viewport, equal to the browser client width after its 15-pixel scrollbar. No page-level overflow, clipped control, hidden focusable element, broken internal link, console error, or unhandled rejection remained.

Manual in-app browser checks covered:

- favicon example, settings, generation, ICO/ZIP/manifest availability, clear, and second generation;
- resize upload, detected dimensions/viewBox, settings, output preview, filename-capable download, clear, and second upload;
- dimensions and file-size example workflows;
- preview viewer zoom/inspection, copy/download controls, clear, and second upload;
- SVG-to-Base64 generation;
- Base64-to-SVG UTF-8 decode, invalid-input recovery, preview/copy/download, and second input;
- embed, inline-versus-image, and JSX outputs plus clipboard behavior;
- cleaner and minifier input, settings, preview, and output.

Runtime screenshots were not taken. Browser downloads, profiles, reports, and temporary fixtures were kept in temporary or ignored storage and removed during final cleanup.

## All Tools, deployment, artifacts, and privacy

`app/client/components/navigation/OtherToolsLinks.tsx` is byte-for-byte unchanged; its SHA-256 is `b1cea2a32ff7ee56d89d3cb86e02e355e05f32dbe1926a82f3305712dbb1b84a`. Its content, labels, links, ordering, placement, navigation, and search behavior were not modified.

`Dockerfile`, `server.js`, `package-lock.json`, route registration, route manifest, HTML sitemap, XML sitemap, deployment configuration, and memory-diagnostic defaults are unchanged. Generated verification output remains ignored and untracked. Privacy, credential-pattern, personal absolute-path, UTF-8, line-ending, and trailing-whitespace checks are final release gates.

## Remaining site-wide work

This milestone deliberately does not begin another route family or a site-wide cleanup. The retained routes require new evidence before any future consolidation decision. Existing aliases should remain direct and absent from canonical sitemaps. Deployment remains a separate operation.

NON-TRACING SVG UTILITIES COMPLETE: approved redirects implemented and remaining routes intentionally retained.
