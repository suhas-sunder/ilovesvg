# SVG Compression Research

Date: 2026-05-30

Branch: `svg-compression-research-may-28`

Status: research-only. No production compression behavior, converter output, presets, route URLs, SEO, navigation, monetization, affiliate logic, or legal content changed.

## 1. Executive summary

Current SVG size reduction is mostly a safe string minifier. It removes common boilerplate and whitespace, but it does not perform the stronger optimizations that usually create large SVG savings: numeric precision control, path command rewriting, group/path merging, ID cleanup, unused definition cleanup with a parsed reference graph, or export-only removal of editor metadata.

The diagnostic benchmark in `scripts/svg-compression-research.mjs` found these aggregate savings across 8 SVG samples:

| Strategy | Total savings | Dimension/viewBox failures | Layer metadata failures | Recommendation |
| --- | ---: | ---: | ---: | --- |
| Current SVG minifier defaults | 10.29% | 0 | 0 | Keep as the safe baseline |
| Tiny safe structural cleanup | 10.89% | 0 | 0 | Good first implementation target |
| Tiniest geometry precision 2 | 24.76% | 0 | 0 | Opt-in after visual diff tests |
| Tiniest cleanup IDs | 13.66% | 0 | 0 | Opt-in; ID collision/reference risk |
| Export-only strip editor data | 22.49% | 0 | 3 | Export-only; unsafe for live editing |

Recommended product direction:

- `None`: preserve current SVG exactly.
- `Tiny`: safe minification that preserves dimensions, viewBox, layer/editor metadata, IDs needed by rendering, copy/download parity, and editability.
- `Tiniest`: opt-in export-only compression. It can round geometry and remove editor metadata only after visual, structural, copy/download, and layer-editability tests pass for each affected route family.

## 2. Current compressor behavior

`app/routes/svg-minifier.tsx` is the current explicit compression route. Its `minifySvg` implementation is string-based and configurable. The defaults remove XML declarations, doctypes, comments, editor namespaces/attributes, empty attributes, extra tag whitespace, style spacing, path data spacing, points spacing, transform spacing, and redundant newlines. It also ensures an SVG namespace when missing.

The current minifier does not round geometry, rewrite path commands, merge paths, collapse non-empty groups, convert shapes, minify IDs, strip converter layer metadata, or run SVGO-style plugin passes.

`app/routes/svg-cleaner.tsx` is adjacent but not the same tool. It prioritizes cleanup, safety, readability, editor junk removal, and optional prettifying. It can remove scripts, event handlers, JavaScript hrefs, editor metadata, empty groups, data attributes, unused namespaces, and some unused defs. Its default output can stay pretty-printed, so it is not a pure compressor.

`app/routes/svg-preview-viewer.tsx` sanitizes previews with `buildSafeSvg`. This is a rendering safety boundary, not compression. It can adjust preview markup for safety and display.

Converter output copy/download paths in `app/client/components/converter/TraceOutputPanel.tsx` and `app/client/components/converter/BespokeTraceOutputPanel.tsx` export the current edited/display SVG. They preserve edit state and do not currently pass through a compressor.

Generated layered SVGs already receive some generation-side structure work in `app/shared/tracing/svgPathStructureOptimizer.ts` and precision settings in `app/utils/svgLayerTrace.server.ts`. That optimization is part of trace generation, not a user-selectable post-export compression layer.

## 3. Why current savings are weak

The existing route mostly removes bytes that surround the drawing rather than bytes that define the drawing. That works well for editor-exported SVGs with metadata, comments, and namespace junk, but it is weak on traced converter outputs where most bytes are path coordinates and layer metadata.

Large savings require one or more higher-risk moves:

- Round path and geometry coordinates.
- Rewrite path commands to shorter relative/absolute forms.
- Remove redundant drawing commands.
- Minify or remove IDs with reference rewriting.
- Remove unused defs through a real SVG reference graph.
- Merge compatible paths or collapse groups.
- Remove `data-layer-*` and `data-editor-*` metadata from exported copies.

Those operations can change rendering, editability, accessibility, ID collision behavior, or downstream app compatibility. That is why they should be tiered instead of silently applied.

## 4. Benchmark sample set

`scripts/svg-compression-research.mjs` benchmarks generated and checked-in samples, then writes `tmp/svg-compression-research.json`.

The current sample set:

| Sample | Source | Purpose |
| --- | --- | --- |
| `generated-simple-logo` | Generated | Small logo-like SVG with simple geometry |
| `generated-editor-export` | Generated | Designer export with metadata, comments, style attrs, editor namespaces, and unused defs |
| `generated-layered-trace` | Generated | Layered trace with many paths and editable layer metadata |
| `generated-detail-path` | Generated | Detail-heavy single path with many decimal coordinates |
| `generated-post-processed-output` | Generated | Edited converter output with filters, pattern fills, and editor metadata |
| `generated-sticker-cut-file` | Generated | Cricut-style border/artwork layers |
| `app-welcome-logo-light` | `app/welcome/logo-light.svg` | Checked-in project SVG |
| `app-welcome-logo-dark` | `app/welcome/logo-dark.svg` | Checked-in project SVG |

All benchmarked variants preserved root `width`, `height`, and `viewBox`. Export-only editor metadata stripping failed layer metadata survival on 3 samples, which is expected and is the reason it must not run on live editable SVG state.

## 5. Compression opportunity table

| Opportunity | Expected savings | Rendering risk | Editability risk | Good tier |
| --- | ---: | --- | --- | --- |
| XML/doctype/comment/metadata cleanup | Low to high, source-dependent | Low | Low | Tiny |
| Whitespace, style, path spacing cleanup | Low to medium | Low | Low | Tiny |
| Empty container cleanup | Low | Low to medium | Low | Tiny, with tests |
| Conservative unused defs cleanup | Low to high | Medium | Low | Tiny or Tiniest |
| Title/desc removal | Low | Low | Accessibility risk | Tiniest or explicit option |
| Numeric/path precision rounding | Medium to high | Medium | Low to medium | Tiniest |
| Path command rewriting | Medium to high | Medium | Low to medium | Tiniest |
| ID cleanup/minification | Low to medium | Medium | Medium | Tiniest |
| Group/path merging | Medium | Medium to high | Medium to high | Tiniest only |
| Strip converter `data-*` editor metadata | Medium to high | Medium | High | Export-only Tiniest |

## 6. Proposed None / Tiny / Tiniest definitions

`None`:

- Return the current live SVG unchanged.
- Preserve byte identity for copy/download unless the user chooses another compression level.
- This should stay the default for converter outputs until visual approval proves another default is safe.

`Tiny`:

- Remove XML declaration, doctype, comments, metadata, editor namespaces/attributes, empty attrs, and redundant whitespace.
- Minify style attributes, path spacing, points spacing, and transform spacing.
- Optionally remove empty containers and unused defs only with conservative guards.
- Preserve root dimensions, viewBox, title/desc unless the user explicitly opts out, all rendering IDs, all `data-layer-*` and `data-editor-*` metadata, layer groups, group count where practical, path count, visible color count, copy/download parity, and layer editability.

`Tiniest`:

- Opt-in, export-oriented compression.
- May round geometry to a controlled precision, minify IDs with reference rewriting, remove unused defs more aggressively, and strip converter editor metadata from final downloads.
- Must not run on the live editor source.
- Must be blocked or downgraded when the SVG contains scripts, styles, complex refs, masks, clips, filters, symbols, patterns, text, accessibility content, or route-specific layer metadata that cannot be proven safe.

## 7. Export vs live-editor recommendation

Keep live editor state uncompressed. The layer editor depends on metadata such as `data-layer-id`, `data-fill-layer-id`, `data-stroke-layer-id`, `data-layer-label`, `data-layer-color`, and `data-editor-opacity`. Removing or renaming that metadata can make Settings/Edit and Layer colors fail even if the rendered SVG still looks correct.

Compression should be applied only at an explicit export boundary:

- Copy SVG
- Download SVG
- SVG compressor/minifier route result

If converter output gets a compression control later, the preview should either keep the editable source unchanged or create a compressed export preview that is clearly separate from the editable live result.

## 8. Compressor route recommendation

The `/svg-minifier` route is the best first place to expose the tiers because it is already a compression-specific task. Add a compression level control there first, with:

- `None`: no minification beyond validation.
- `Tiny`: current defaults plus conservative safe structural cleanup.
- `Tiniest`: opt-in aggressive mode with warnings and visual/structural tests.

The compressor route can tolerate a broader set of SVG inputs than converter output, but it still needs strict sanitizer boundaries and a clear explanation when a risky optimization is skipped.

## 9. Converter copy/download recommendation

Do not compress converter copy/download by default in the first implementation batch.

Recommended next step is an explicit export option on converter result cards after the compressor route proves stable:

- Default copy/download: unchanged edited SVG.
- Tiny copy/download: safe structural cleanup that preserves layer metadata and editability.
- Tiniest download only: compressed export copy that may remove editor metadata, with no expectation that it can be re-opened into the layer editor.

Copy/download parity must remain strict: copied SVG and downloaded SVG for the same selected compression level should match.

## 10. Dependency recommendation

Do not add a dependency in this research branch.

For implementation:

- Start with the existing internal string compressor for `Tiny`, because it is small, predictable, and can preserve the project-specific layer metadata.
- Consider adding `svgo` only for the compressor route or a lazy export-only path, not for the live converter editor path.
- If `svgo` is added, use an explicit plugin allowlist/denylist instead of blindly using the full default preset.

Reasoning:

- SVGO documents that optimization is plugin-based and includes a default preset pipeline ([SVGO plugins](https://svgo.dev/docs/plugins/), [preset-default](https://svgo.dev/docs/preset-default/)).
- The default preset includes powerful passes such as `cleanupIds`, `cleanupNumericValues`, `convertPathData`, `collapseGroups`, `mergePaths`, and `removeUselessDefs`.
- `cleanupIds` can remove/minify IDs but the official docs warn about predictable ID collisions when multiple optimized SVGs are inlined together ([cleanupIds](https://svgo.dev/docs/plugins/cleanupIds/)).
- `convertPathData` can rewrite path commands, remove redundant commands, trim delimiters, and round numbers, which is useful but needs visual regression coverage ([convertPathData](https://svgo.dev/docs/plugins/convertPathData/)).
- SVGOMG is a web GUI for SVGO that exposes most SVGO configuration options, which supports using SVGO as the comparison target for a future compressor route ([SVGOMG GitHub](https://github.com/jakearchibald/svgomg)).

## 11. Risks to editability/rendering

Key risks:

- Removing `data-layer-*` or `data-editor-*` breaks layer editing even when the SVG renders correctly.
- ID minification can break `url(#id)`, `href="#id"`, masks, clips, filters, gradients, patterns, symbols, and inlined multi-SVG pages.
- Numeric rounding can visibly move thin strokes, small holes, text-like details, sticker borders, and cut-file boundaries.
- Path merging can destroy layer semantics, color grouping, or selectable objects.
- Removing title/desc can reduce accessibility for uploaded SVGs.
- Removing unused defs with regex can misread references in style blocks or nested content.
- Compression after post-processing can change copy/download parity if preview, copied SVG, and downloaded SVG do not share the exact same final string.

## 12. Recommended first implementation batch

First batch should be narrow:

1. Add a shared compression helper with typed levels: `none`, `tiny`, `tiniest`.
2. Wire it only into `/svg-minifier`.
3. Keep `tiny` close to current defaults plus conservative empty-container and unused-def cleanup.
4. Add an export-only test fixture with layer metadata and prove `tiny` preserves it.
5. Add a separate `tiniest` fixture path, but keep it opt-in and blocked from live editor state.
6. Add test coverage before exposing converter copy/download compression.

Do not change converter defaults, preset IDs, quality tiers, trace settings, dimensions, palette counts, or generated output behavior in that first batch.

## 13. Required tests before implementation

Required tests for implementation:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:tool-output`
- `npm.cmd run test:output-ux`
- `npm.cmd run test:post-conversion-editability`
- `npm.cmd run test:settings-color-coverage`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:converter-route-parity`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:layer-color-correctness`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:post-conversion-editability`
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

Compression-specific tests to add:

- Fixture matrix for `none`, `tiny`, `tiniest`.
- Dimension and viewBox preservation.
- Copy/download byte parity per selected level.
- Layer metadata preservation for `none` and `tiny`.
- Rendered screenshot or raster hash comparison for `tiniest`.
- ID reference preservation for gradients, filters, masks, clips, patterns, symbols, and href/use.
- Accessibility/title/desc behavior by option.
- SVG sanitizer regression tests for scripts, event handlers, JavaScript URLs, and foreignObject handling.

## 14. Non-goals

This research branch does not:

- Implement compression levels in production routes.
- Change converter output quality, presets, preset IDs, dimensions, palette counts, or trace settings.
- Change copy/download behavior.
- Change the `/svg-minifier` UI.
- Change SEO metadata, route URLs, navigation, sitemap, monetization, affiliate logic, compression settings, legal pages, or unrelated UI.
- Add SVGO or any other dependency.
- Touch Printify.
- Deploy or merge.
