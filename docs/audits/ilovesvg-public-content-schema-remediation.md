# iLoveSVG public-content and schema remediation

## 1. Scope

This milestone corrects the confirmed public-facing defects `ILSVG-DEF-008` through `ILSVG-DEF-015`. The work is limited to route-appropriate preset wording, three breadcrumb and BreadcrumbList destinations, sketch guidance, public converter terminology, public editorial-planning phrases, and favicon input guidance.

It does not consolidate routes, add redirects, restructure canonicals, expand metadata, change sitemap membership, create guides, or alter the All Tools implementation.

## 2. Confirmed defects

- The Shopify PNG wrapper inherited an Etsy-named default preset.
- Three visible and schema breadcrumbs referenced unregistered route variants.
- The sketch converter contained unrelated rental-agreement and budgeting copy.
- Converter UI exposed internal tracing and processing rationale.
- Public navigation and sitemap copy exposed editorial-planning terminology.
- Favicon guidance contradicted the route's accepted raster inputs.

The historical evidence and severity assignments remain in `docs/audits/ilovesvg-runtime-capability-verification.md`.

## 3. Files changed

The implementation touches:

- `app/routes/png-to-svg-for-etsy.tsx` for route-specific Shopify display labels.
- `app/routes/svg-to-favicon-generator.tsx`, `app/routes/svg-stroke-width-editor.tsx`, and `app/routes/svg-flip-and-rotate-editor.tsx` for visible and schema breadcrumb targets.
- `app/routes/sketch-to-svg-converter.tsx` for sketch guidance.
- `app/client/components/converter/TraceOutputPanel.tsx`, `BespokeTraceOutputPanel.tsx`, `AdvancedSettingsHelpSection.tsx`, and `PresetSelector.tsx` for public trace-method and processing explanations.
- `app/client/lib/tracing/useHybridTraceFetcher.ts`, `app/client/workers/vtracer.worker.ts`, `app/client/lib/converter/presetIntensity.ts`, and the duplicated output views in `app/routes/home.tsx` and `app/routes/png-to-layered-svg-for-cricut.tsx` for consistent public messages.
- `app/client/components/navigation/OtherToolsLinks.tsx`, `app/content/docs/howItWorksRouteContent.ts`, `app/routes/sitemap.tsx`, and narrowly affected route guidance for confirmed internal or editorial terminology.
- `scripts/public-content-schema-remediation-audit.mjs`, `scripts/hybrid-browser-smoke.mjs`, `scripts/trace-engine-audit.mjs`, and `package.json` for focused regression coverage.
- This document and `docs/audits/ilovesvg-runtime-capability-verification.md` for implementation evidence and defect statuses.

Internal engine identifiers, action payloads, route manifests, converter algorithms, and diagnostic data attributes remain unchanged.

## 4. Shopify preset wording correction

`/png-to-svg-for-shopify` still uses the established shared converter implementation and the same five route-local preset IDs, order, default, descriptions, and effective values. At render and result-creation time, those IDs resolve to Shopify-specific visible labels. The actual Etsy route continues to render its existing Etsy labels.

The label correction is route-specific and does not create a new preset identity or alter the selected payload. History labels use the same route-resolved display list as the preset cards.

## 5. Breadcrumb and schema corrections

Visible breadcrumbs and BreadcrumbList JSON-LD now point to the registered tool routes:

- `/svg-to-favicon-generator`
- `/svg-stroke-width-editor`
- `/svg-flip-and-rotate-editor`

The prior unregistered variants are not added to the manifest and receive no redirects. Labels and canonical URLs remain unchanged.

## 6. Sketch content correction

The rental-agreement and budgeting paragraph on `/sketch-to-svg-converter` was replaced with concise guidance about clean scans or photographs, contrast, filled versus outline tracing, and reviewing small details before downstream use. The copy does not claim OCR, handwriting recognition, semantic cleanup, perfect vectorization, or unsupported compatibility.

## 7. Internal terminology replacements

Public trace-method labels, fallback warnings, progress messages, preset explanations, and route-specific conversion-limit notes now describe outcomes such as clean shape tracing, detailed color tracing, line-art conversion, processing time, and compatible tracing methods.

Internal enum values, worker identifiers, policy names, API fields, diagnostic data attributes, and developer comments remain intact. The correction changes user-facing explanations, not the engine selected or the work performed.

## 8. SEO and editorial terminology replacements

Confirmed phrases such as “PNG to SVG keyword cluster,” “JPG to SVG keyword cluster,” “search intent,” “SEO-safe,” and “Expanded SVG workflow routes” were replaced with route-specific headings and navigation explanations. Link destinations and the All Tools implementation are unchanged.

## 9. Favicon guidance correction

The implementation accepts SVG, PNG, JPEG/JPG, and WebP input. SVG retains scalable source quality before bitmap favicon generation. Raster inputs are resized directly into PNG and ICO assets and are not vectorized. The revised guidance states this distinction without changing accepted formats, package contents, background controls, ICO generation, PNG sizes, or the generated HTML snippet.

## 10. Tests

`npm run test:public-content` performs 84 checks against production source and rendered routes for Shopify/Etsy label separation, label-only preset mapping, valid visible/schema breadcrumb destinations, sketch-specific copy, removal of confirmed internal and editorial phrases, public trace-result labels, retained favicon input handling, and accurate favicon guidance.

The sampled route-preset audit passed 798 cases across 67 routes. Schema, route coverage, SEO, navigation, lifecycle, output UX, conversion actions, typecheck, production build, and the full test suite passed. The full test initially found that `scripts/trace-engine-audit.mjs` still required the removed “Browser VTracer was not used” sentence; that focused assertion now requires the replacement public warning and the rerun passed.

The focused audit does not duplicate converter logic.

The post-conversion editability audit completed all correctness workflows across seven routes. Its JPG layered scenario exceeded responsiveness-only thresholds while still applying the edit, keeping the page responsive, and producing matching edited copy and download output: Settings/Edit opened in 2,155 ms against a 1,500 ms threshold, color editing took 1,148 ms against 1,000 ms, and slider editing took 1,426 ms against 1,000 ms. This existing timing limitation is nonblocking because this milestone changes public labels and copy rather than editor state, conversion, or performance behavior.

The focused editor audit also completed its functional assertions for preview, history replacement, copy, download, focused editing, collapse/restore, and horizontal-overflow checks with no console errors. Its animation-sampling assertion measured 2.1 to 10 pixels of transient accordion movement at some tested widths against a 2-pixel limit. The milestone does not change layout, animation, or editor state behavior, so this is retained as a separate nonblocking responsiveness-only limitation rather than changing the existing threshold.

## 11. Browser QA

The focused production browser matrix covered ten routes at both 1280 by 900 and 390 by 844 pixels: the Shopify and Etsy PNG wrappers, favicon generator, stroke-width editor, flip/rotate editor, sketch converter, representative PNG/JPG navigation copy, sitemap copy, and the home route. Corrected copy and registered breadcrumb/schema destinations rendered without horizontal overflow or console errors.

The production browser harness passed the same ten interaction scenarios at each viewport, for 20 passing scenarios total: three Shopify, three Etsy, one sketch, and three JPG per viewport. The scenarios covered deterministic fixture upload, default and alternate trace methods where supported, preset-triggered conversion, decoded preview, settings and update-preview, copy content, download initiation, and output-action hashes. All 20 passed without console errors. Browser download completion is not claimed.

No browser screenshot is retained in the repository.

## 12. Output regression

The full deterministic converter-parity audit passed before and after the implementation with no comparison failures. The fixture hashes were stable, Shopify and Etsy produced the same copy/download hashes under the same default settings, the favicon package comparisons remained equivalent by package contents, and the sketch/PNG/JPG comparisons retained their established bytes and normalized structure. Output filenames, viewBox/path structure, package manifests, and history behavior did not change.

Equality is claimed only for the fixtures and settings exercised by the audit. It does not imply route consolidation readiness.

## 13. Deferred work

Route consolidation, redirects, canonical restructuring, metadata expansion, new guides, broader editorial work, and unrelated content defects remain deferred. The documented JPG layered editor responsiveness thresholds and focused-editor accordion animation sampling remain known responsiveness-only limitations. No newly discovered issue outside this milestone is addressed unless it is a direct regression introduced here.

Recommended next milestone: **canonical consolidation architecture and preservation planning**.

## 14. Preservation confirmation

This milestone changes no route, redirect, accepted input, output format, conversion algorithm, output quality, effective preset value, preset order, preset default, setting, upload/result/history action, filename, canonical, sitemap membership, robots directive, deployment configuration, memory-safety behavior, converter-result ownership, styling system, or All Tools behavior.

Generated screenshots, browser downloads, temporary reports, profiles, fixtures, and parity outputs remain ignored or use operating-system temporary storage. No such artifact is part of this milestone.

## 15. Final milestone verdict

The final adversarial review found no route, converter, preset-value, output, canonical, sitemap-membership, deployment, or All Tools change outside the approved public-copy and breadcrumb/schema corrections. Focused source and rendered-route audits, browser interaction coverage, deterministic output comparisons, typecheck, production build, and the full test suite passed. The only nonpassing assertions were the documented responsiveness-only JPG layered editor thresholds and transient focused-editor accordion stability threshold; all correctness assertions passed. The milestone is accurate, behavior-preserving, free of generated or private artifacts, and ready to merge.
