# iLoveSVG canonical consolidation and feature-preservation plan

Planning date: 2026-07-26

Branch: `milestone/canonical-consolidation-planning`

Mode: architecture and migration planning only. This document does not authorize or implement a route, redirect, canonical, sitemap, metadata, schema, breadcrumb, converter, preset, setting, output, content, or All Tools change.

## 1. Executive summary

The repository still has substantial implementation overlap, but it does not yet have a source route that is safe to redirect as part of a new consolidation. Output equality is strongest in three families:

- Nine favicon and ICO routes produced equivalent package contents for the common example and default settings.
- Nine SVG-to-PNG routes produced byte- and pixel-identical PNGs for one fixture under equal settings.
- Seven SVG resizer routes produced byte-identical SVGs for one non-square fixture under the tested modes.

Those results are necessary but not sufficient. Each family still has at least one non-output preservation gap: route-specific guidance, current URL identity, accepted-input wording or enforcement, initial context, schema, filenames, mobile workflow, untested settings, or redirect sequencing. The PNG trace wrappers also have proven default and post-processing differences. The dimensions and file-size inspectors, Cricut/code/Base64 routes, layered routes, and sketch/drawing routes have distinct workflows and must remain separate unless a later additive implementation proves otherwise.

The safest first implementation batch is **SVG-to-PNG preservation infrastructure without redirects**. The production component is already shared, the tested routes are output-identical under equal settings, and the remaining work is bounded: make route context explicit, preserve each current content module and display identity, add full fixture and workflow gates, and prove metadata/schema behavior. Redirects, canonicals, route deletion, sitemap removal, and internal-link changes should be a later commit only after every preservation cell is green.

No new route is safe to redirect now.

Sources: `app/routes.ts`; `app/data/routeManifest.ts`; `app/client/lib/converter/routeCapabilities.ts`; `app/routes/_shared/createTemplateWrapperRoute.ts`; `docs/audits/ilovesvg-route-component-inventory.md`; `docs/audits/ilovesvg-runtime-capability-verification.md`; `docs/audits/ilovesvg-output-quality-regression-plan.md`.

## 2. Evidence model and current route-family status

This plan uses the following evidence labels:

- **Verified current behavior:** directly present in the current post-remediation production source or a current route registration.
- **Tested parity:** measured by the deterministic parity audit for the named fixture, settings, and output dimension only.
- **Inferred parity:** shared imports or common helpers suggest equivalence, but no complete production-path comparison proves it.
- **Planned preservation:** behavior that a future destination must add or expose before a source route can redirect.
- **Unresolved:** evidence is absent, mixed, or insufficient for a redirect decision.
- **Proposed architecture:** a future design choice, not current behavior.

Current registration contains 157 routes, including 156 public routes, 125 XML-sitemap URLs, and 28 existing redirect aliases. The families in this plan are all registered in `app/routes.ts` and represented in `app/data/routeManifest.ts`. Existing redirect aliases are not evidence that a new indexable route is safe to redirect.

| Family | Verified current status | Tested parity | Current decision |
| --- | --- | --- | --- |
| Favicon and ICO | Nine indexable routes render the same generator; each is self-canonical and carries route-specific title/guide intent. The component accepts SVG, PNG, JPEG, and WebP. | Equivalent 24-entry package contents, seven ICO entries, and HTML snippet for the common example/defaults; raw ZIP bytes differ through archive metadata. | Candidate destination `/image-to-favicon-generator`; no redirect yet. |
| PNG platform wrappers | Base, Canva, Figma, and transparent routes use the base implementation; Shopify uses the Etsy implementation; Glowforge uses the laser implementation; Silhouette is separate source. | Base, Canva, Figma, Shopify, Etsy, and transparent output matched under equal settings. Glowforge differed through real laser post-processing. | Base/Canva/Figma/transparent are eventual candidates. Etsy/Shopify need context and validator preservation. Glowforge, laser, Silhouette, and Cricut variants remain separate. |
| Logo family | Shopify, Etsy, Canva, Glowforge, and Silhouette import the general logo component. Cricut, layered, and favicon logo routes use different output families. | General wrapper parity is inferred from shared component/action, not exhaustively measured. The preset collision is fixed, but one simple fixture is not broad logo parity. | General platform wrappers are candidates after full baselines. Cricut, layered, and favicon routes stay separate. |
| SVG-to-PNG | Eight wrappers render the base client exporter with route-aware content; all accept SVG and expose the same export controls. | Nine routes were byte- and pixel-identical for one 120 x 80 fixture/equal settings. | Best first preservation batch; no redirect until route context, content, metadata, filenames, and broader fixtures pass. |
| SVG resize | Six wrappers render the base client editor. | Seven routes serialized byte-identical SVG for one non-square fixture and the tested sizing modes. | Strong candidate after route-context/content and full workflow gates. |
| Dimensions and file size | Separate components, reports, settings, and actions. | Runtime proved distinct tasks. | Keep both self-canonical and separate. A combined tab is not recommended now. |
| Cricut, code, and Base64 | Uploaded image, pasted code, encoded data, single trace, layered trace, Print Then Cut, sticker, vinyl, and format-specific routes are separate production workflows. | Only representative paths were tested; complete cross-route parity does not exist. | Keep separate. Prototype only bounded shared helpers, not a combined destination UI. |
| Sketch and drawing | Direct sketch and drawing routes differ in accepted inputs and preset/default inventories. Cricut sketch is layered; Cricut drawing is a separate cut workflow. | Representative conversions passed; cross-route output parity is inconclusive. | Keep separate. |
| JPG and JPEG | Separate direct actions/components; JPG accepts a narrower set than JPEG. State ownership defects are fixed. | Four equal-input/equal-setting production-action scenarios were byte-identical. | Keep both until accepted inputs, presets, full UI workflow, traffic/product preference, and transition behavior are approved. |

Sources: `app/routes/svg-to-favicon-generator.tsx`; `app/routes/png-to-svg-converter.tsx`; `app/routes/png-to-svg-for-etsy.tsx`; `app/routes/png-to-svg-for-laser-cutting.tsx`; `app/routes/logo-to-svg-converter.tsx`; `app/routes/svg-to-png-converter.tsx`; `app/routes/svg-resize-and-scale-editor.tsx`; `app/routes/svg-dimensions-inspector.tsx`; `app/routes/svg-file-size-inspector.tsx`; `app/routes/code-to-svg-for-cricut.tsx`; `app/routes/base64-to-svg-for-cricut.tsx`; `app/routes/jpg-to-svg-converter.tsx`; `app/routes/jpeg-to-svg-converter.tsx`; `scripts/converter-parity-audit.mjs`.

## 3. Recommended retained destinations

| Family | Recommended retained destination | Basis | Qualification |
| --- | --- | --- | --- |
| Favicon and ICO | `/image-to-favicon-generator` | Its name accurately describes the component's verified SVG, PNG, JPEG, and WebP acceptance, while the current `/svg-to-favicon-generator` name understates the broad input capability. | Proposed canonical winner only. Before transition, make it the explicit component owner, preserve all source-format and Shopify contexts, and obtain product approval for changing the current strongest base identity. |
| General PNG trace wrappers | `/png-to-svg-converter` | It owns the broad general converter source and the common base/Canva/Figma/transparent implementation. | Do not absorb Glowforge/laser, Silhouette, or Cricut routes. Etsy/Shopify require explicit context-specific defaults, labels, and accepted-input policies. |
| General logo wrappers | `/logo-to-svg-converter` | Shopify, Etsy, Canva, Glowforge, and Silhouette currently import its component and action. | Do not absorb logo-to-Cricut, layered-logo, or favicon-logo routes. Prove platform wrapper outputs and filenames first. |
| SVG-to-PNG wrappers | `/svg-to-png-converter` | It is the source component for all eight wrappers and the tested outputs match under equal settings. | Preserve every platform/printing context and do not add artwork recoloring. |
| SVG resizer wrappers | `/svg-resize-and-scale-editor` | It is the source component for all six wrappers and tested serialization matches. | Preserve every sizing mode, non-square behavior, platform context, and filename. |
| Dimensions | `/svg-dimensions-inspector` | It owns dimension/viewBox inspection and repair. | Retain self; not a destination for file-size inspection. |
| File size | `/svg-file-size-inspector` | It owns byte/minification reporting and Copy stats. | Retain self; not a source for redirect. |
| General Cricut upload | `/cricut-svg-converter` | It is the broad upload-oriented cut-file route. | It is not a safe destination for code, Base64, layered, Print Then Cut, sticker, vinyl, sketch, or drawing routes without major additive work. This plan recommends retaining those routes. |
| Sketch | `/sketch-to-svg-converter` | It owns sketch-specific direct conversion and guidance. | Retain self. |
| Drawing | `/drawing-to-svg-converter` | It owns the broader drawing direct workflow and accepted-input set. | Retain self. |
| JPG/JPEG | No winner approved | Output parity is fixture-bounded and accepted inputs differ. | Keep both. A future approval could select `/jpg-to-svg-converter` for navigation continuity or `/jpeg-to-svg-converter` for broader capability, but repository evidence alone does not choose between them. |

Sources: `app/routes.ts`; wrapper imports under `app/routes/`; `app/data/routeMeta/faviconExport.ts`; `app/data/routeMeta/marketplaceCraft.ts`; `app/data/routeMeta/marketplaceExport.ts`; `app/data/routeMeta/svgPlatformTools.ts`.

## 4. Families that must remain separate

The following boundaries are preservation requirements, not naming preferences:

1. **Glowforge and laser trace routes remain separate from general PNG tracing.** `/png-to-svg-for-glowforge` imports `/png-to-svg-for-laser-cutting`, and deterministic evidence shows its laser post-processing changes SVG output.
2. **Silhouette trace routes remain separate until independently proven.** `/png-to-svg-for-silhouette` is a full route implementation with its own validation, presets, filename, and history wiring.
3. **Cricut single-output and layered-output routes remain separate.** Layered routes expose color-layer separation and layer-aware editing that a generic single trace cannot replace.
4. **Print Then Cut, sticker, and vinyl routes remain separate.** Their printable-color/cut-outline, offset/border, and cut-purpose workflows are not generic preset labels.
5. **Code and Base64 routes remain separate.** Code mode detects raw SVG, Base64, data URI, CSS, Markdown, HTML, and JSON representations; Base64 mode owns decode/report behavior; uploaded-image routes do neither.
6. **Dimensions and file-size inspectors remain separate.** One repairs width/height/viewBox attributes; the other reports bytes, estimated minification, and Copy stats.
7. **Favicon/package output remains separate from logo-to-SVG tracing.** ICO packing, PNG size sets, manifest/browserconfig files, snippets, and ZIP are different outputs.
8. **Sketch and drawing remain separate.** The direct drawing route accepts a broader GIF/AVIF/BMP/TIFF/SVG set; the sketch route currently accepts PNG/JPEG and has sketch-specific presets.
9. **Cricut sketch and drawing remain separate.** The sketch route is layered and accepts PNG/JPEG/WebP; the drawing route accepts PNG/JPEG/SVG and uses its own cut presets.
10. **JPG and JPEG remain separate for now.** JPEG accepts GIF, AVIF, BMP, and TIFF in addition to the common set; full preset and workflow parity is not proved.
11. **The All Tools section remains outside consolidation scope.** Any candidate still linked there remains separate and cannot enter redirect rollout under this plan. This plan does not recommend changing, reducing, replacing, or removing that section.

Sources: `app/routes/png-to-svg-for-glowforge.tsx`; `app/routes/png-to-svg-for-laser-cutting.tsx`; `app/routes/png-to-svg-for-silhouette.tsx`; `app/routes/png-to-svg-for-cricut-print-then-cut.tsx`; `app/routes/png-to-svg-for-cricut-stickers.tsx`; `app/routes/code-to-svg-for-cricut.tsx`; `app/routes/base64-to-svg-for-cricut.tsx`; `app/routes/svg-dimensions-inspector.tsx`; `app/routes/svg-file-size-inspector.tsx`; `app/routes/sketch-to-svg-for-cricut.tsx`; `app/routes/drawing-to-svg-for-cricut.tsx`; `app/client/components/navigation/OtherToolsLinks.tsx`.

## 5. Complete feature-preservation matrix

### Matrix conventions

The matrix assigns each route to its primary preservation family. A route mentioned in another family is cross-referenced rather than treated as two redirect candidates.

- **Trace** means the current mixed production trace action plus client result lifecycle.
- **Layered** means color-region/layer generation and layer-aware editing.
- **Client raster** means browser SVG rendering to PNG.
- **Client SVG** means browser parse/serialize without server tracing.
- **R10** means bounded output history with the current ten-item limit.
- **Live settings** means the current source remains available while settings regenerate or serialize a single current output; it is not trace history.
- **Exact list** means the future gate must snapshot the ordered ID, label, description/help, effective values, and default from the cited source rather than duplicating the list in planning prose.
- **RB-family** means rollback by reverting the family commit while the source route implementation remains available.
- All `Redirect safe now` values are `no` when any material field is partial or inconclusive.

### A. Favicon and ICO

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Favicon | `/svg-to-favicon-generator` | `/image-to-favicon-generator` | Indexable source component, self-canonical | SVG, PNG, JPEG, WebP | ICO, PNG sizes, XML/manifest, HTML snippet, ZIP | None | All platforms; 512 master; seven ICO sizes; transparent; manifest/msconfig on | Aspect, square padding, background, gallery flag, app/theme/tile fields, sizes, platforms, sharpen, metadata, basename, manifests | Client canvas | Resize/composite, PNG encoding, ICO packing, ZIP | Master and generated sizes | None | Pre-generation settings only | HTML snippet | Individual, all, ICO, ZIP | Basename-derived | 24 entries in tested default | SVG-source and general favicon help | Current base meta and BreadcrumbList identify SVG route | Tested package parity only | Move explicit component ownership; source-format context; preserve base guidance; context-aware schema during pre-redirect stage | Multi-format fixtures, all settings, package manifest/ICO/snippet, clear/second input/mobile | no | Candidate destination does not yet own base identity/content; broad fixtures incomplete | RB-favicon |
| Favicon | `/image-to-favicon-generator` | self | Indexable wrapper, self-canonical | Same broad component | Same | None | Same | Same | Same component | Same | Same | None | Same | Snippet | Same | Same | Same | General image guidance | Self meta; rendered BreadcrumbList currently identifies base SVG route | Tested package parity only | Become explicit retained owner without changing behavior | Same plus route-identity and direct-load baselines | no | Retained-route ownership migration not implemented | RB-favicon |
| Favicon | `/png-to-favicon-generator` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component, despite PNG naming | Same | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | PNG-specific guidance | Self meta; shared rendered schema | Tested package parity only | PNG context module and accepted-input disclosure | PNG alpha/opaque, naming, content/schema, mobile | no | Content/input intent and schema transition incomplete | RB-favicon |
| Favicon | `/jpg-to-favicon-generator` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component, despite JPG naming | Same | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | JPG/background guidance | Self meta; shared rendered schema | Tested package parity only | JPG context module; background default/expectation proof | JPG/JPEG, solid/custom background, content/schema | no | Format workflow not completely baselined | RB-favicon |
| Favicon | `/logo-to-favicon-generator` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component | Same | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | Logo legibility/padding guidance | Self meta; shared rendered schema | Tested package parity only | Logo context module | Transparent logo, tiny-detail, padding, content/schema | no | Logo workflow/content preservation incomplete | RB-favicon |
| Favicon | `/svg-to-ico-converter` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component | Same package plus ICO emphasis | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | SVG-to-ICO guidance | Self meta; shared rendered schema | Tested package parity only | ICO-focused context and action prominence without changing output | SVG fixtures, custom ICO sizes, only-16 behavior, content/schema | no | ICO workflow identity incomplete | RB-favicon |
| Favicon | `/png-to-ico-converter` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component | Same package plus ICO emphasis | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | PNG-to-ICO guidance | Self meta; shared rendered schema | Tested package parity only | PNG/ICO context | PNG alpha, ICO directory, filename, content/schema | no | Format and action intent incomplete | RB-favicon |
| Favicon | `/svg-to-favicon-for-shopify` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component | Same | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | Shopify theme/favicon guidance | Self meta; shared rendered schema | Tested package parity only | Shopify context module and stable deep link | Shopify route content, package, clear/second input, mobile | no | Platform guidance/state transition incomplete | RB-favicon |
| Favicon | `/logo-to-favicon-for-shopify` | `/image-to-favicon-generator` | Indexable wrapper | Same broad component | Same | None | Same | Same | Same | Same | Same | None | Same | Snippet | Same | Same | Same | Shopify logo/favicon guidance | Self meta; shared rendered schema | Tested package parity only | Shopify-logo context module | Logo fixtures, Shopify content, package/schema | no | Platform and source-intent preservation incomplete | RB-favicon |

Sources: `app/routes/svg-to-favicon-generator.tsx`; favicon wrappers under `app/routes/`; `app/data/routeMeta/faviconExport.ts`; `app/client/components/navigation/OtherToolsLinks.tsx`; `scripts/converter-parity-audit.mjs`.

### B. PNG platform wrappers

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PNG trace | `/png-to-svg-converter` | self | Indexable source component | PNG, JPG/JPEG, WebP | Editable SVG | Exact local + shared trace/stroke list | `line-accurate` | Full trace, layer, cleanup, appearance, geometry | Trace | Sanitization, sizing, background/layer annotation | Yes/fullscreen | R10 | Layer/style/size/update preview | SVG | SVG | `png-to-svg-converter.svg` | n/a | General PNG/transparent guidance | Self canonical/meta/schema | Baseline | Preserve unchanged default mode | Full fixture/preset/settings/history gates | no | Destination is retained, not a source redirect | RB-PNG |
| PNG trace | `/png-to-svg-for-canva` | `/png-to-svg-converter` | Indexable direct wrapper of base action/component | Same as base | Same | Same exact list | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Current base filename behavior must be captured | n/a | Canva handoff guidance | Self meta; inherited runtime schema identity requires baseline | Tested equal-output fixture | Allowlisted Canva context and migrated guide | Inputs, all presets/default, history, filename, content/schema, mobile | no | Context/content/internal-link transition absent | RB-PNG-simple |
| PNG trace | `/png-to-svg-for-figma` | `/png-to-svg-converter` | Indexable direct wrapper of base action/component | Same as base | Same | Same | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Capture current behavior | n/a | Figma handoff guidance | Self meta; inherited runtime schema identity | Tested equal-output fixture | Figma context and guide | Same gates as Canva | no | Context/content transition absent | RB-PNG-simple |
| PNG trace | `/transparent-png-to-svg-converter` | `/png-to-svg-converter` | Indexable direct wrapper of base action/component | Same broad base acceptance | Same | Same | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Capture current behavior | n/a | Transparency/background guidance | Self meta; inherited runtime schema identity | Tested equal-output fixture | Transparent-input context without narrowing actual behavior accidentally | Alpha fixtures, background/settings, content/schema, filename | no | Route intent and alpha coverage incomplete | RB-PNG-simple |
| PNG marketplace | `/png-to-svg-for-etsy` | `/png-to-svg-converter` | Indexable separate source component | PNG, JPG/JPEG | Editable SVG | Etsy-local exact list + shared additions | `line-accurate` with Etsy visible identity | Full trace settings | Trace | Similar trace post-processing | Yes/fullscreen | R10 | Layer/style/size/update preview | SVG | SVG | `png-to-svg-for-etsy.svg` | n/a | Etsy seller/download guidance | Self canonical/meta; route-specific schema/content | Tested equal output only after equalization | Destination context must preserve narrower validator, ordered presets, labels, default, history label, filename, and guide | MIME/extension errors, presets, default hash, history, filename, content/schema | no | Validator/default/content differences | RB-PNG-marketplace |
| PNG marketplace | `/png-to-svg-for-shopify` | `/png-to-svg-converter` | Indexable wrapper of Etsy action/component with Shopify display mapping | PNG, JPG/JPEG | Editable SVG | Etsy values with Shopify route-specific visible mapping | Same effective default as before; Shopify label | Same as Etsy | Etsy trace action | Same | Same | R10 | Same | Same | Same | Current Etsy-template filename must be recorded before change | n/a | Shopify storefront guidance | Self meta; runtime component keyed by pathname | Tested equal output after equalization | Explicit Shopify context, current effective values, exact display labels, validator, history identity, filename decision preserving current bytes/behavior | Shopify/Etsy paired presets, default hashes, history labels, input errors, context deep link | no | Route-context semantics not implemented | RB-PNG-marketplace |
| PNG laser | `/png-to-svg-for-glowforge` | None; keep self | Indexable wrapper of laser route | PNG, JPG/JPEG | Laser-oriented SVG | Laser exact list | Laser clean default | Cut/laser trace controls | Laser trace | Proven laser post-processing | Yes | R10 | Trace output editing | SVG | SVG | Laser route filename behavior | n/a | Glowforge engraving/cut guidance | Self meta | **No** versus base; output differs | Preserve as separate route | Laser fixture/path/postprocess/history tests | no | Material output difference | RB-self |
| PNG laser | `/png-to-svg-for-laser-cutting` | None; keep self | Indexable source component | PNG, JPG/JPEG | Laser-oriented SVG | Laser exact list | Laser clean default | Cut/laser controls | Laser trace | Laser post-processing | Yes | R10 | Trace editing | SVG | SVG | `png-to-svg-for-laser-cutting.svg` | n/a | Generic laser guidance | Self identity | Distinct | Preserve as separate route | Laser cutting regression suite | no | Distinct workflow/output | RB-self |
| PNG craft | `/png-to-svg-for-silhouette` | None; keep self | Indexable full route source | PNG, JPG/JPEG | Cut-oriented SVG | Silhouette exact list | Route-local default | Full cut trace settings | Trace | Route-local cut processing | Yes/fullscreen | R10 | Layer/style/size/update | SVG | SVG | `png-to-svg-for-silhouette.svg` | n/a | Silhouette guidance | Self identity | Inconclusive versus base | Preserve separately pending independent evidence | Full route fixture/preset/workflow suite | no | Separate source, presets, filename, unproved output | RB-self |

The Cricut, Print Then Cut, vinyl, sticker, and layered PNG routes are inventoried in the Cricut matrix and are not candidates for the general PNG destination.

Sources: `app/routes/png-to-svg-converter.tsx`; `app/routes/png-to-svg-for-etsy.tsx`; `app/routes/png-to-svg-for-shopify.tsx`; `app/routes/png-to-svg-for-canva.tsx`; `app/routes/png-to-svg-for-figma.tsx`; `app/routes/transparent-png-to-svg-converter.tsx`; `app/routes/png-to-svg-for-glowforge.tsx`; `app/routes/png-to-svg-for-laser-cutting.tsx`; `app/routes/png-to-svg-for-silhouette.tsx`.

### C. Logo family

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Logo trace | `/logo-to-svg-converter` | self | Indexable source component | PNG, JPG/JPEG | Editable SVG | Exact logo-local + shared list | `logo-clean` | Full trace/edit settings | Trace | Logo-tuned settings, standard trace post-processing | Yes/fullscreen | R10 | Layer/style/size/update | SVG | SVG | `logo-to-svg-converter.svg` | n/a | General logo guidance | Self identity | Baseline only | Retain unchanged | Broad transparent/opaque/detail fixtures | no | Retained route | RB-logo |
| Logo trace | `/logo-to-svg-for-shopify` | `/logo-to-svg-converter` | Indexable wrapper of base action/component | Same | Same | Same | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Capture current base-derived behavior | n/a | Shopify branding guidance | Self meta; shared component content by pathname | Inferred, not exhaustively measured | Shopify context module | Output, history, filename, guide/schema, mobile | no | Fixture and content transition incomplete | RB-logo-platform |
| Logo trace | `/logo-to-svg-for-etsy` | `/logo-to-svg-converter` | Indexable wrapper | Same | Same | Same | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Capture | n/a | Etsy brand/listing guidance | Self meta | Inferred | Etsy context | Same family gates | no | Unproved workflow/content parity | RB-logo-platform |
| Logo trace | `/logo-to-svg-for-canva` | `/logo-to-svg-converter` | Indexable wrapper | Same | Same | Same | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Capture | n/a | Canva handoff guidance | Self meta | Inferred | Canva context | Same family gates | no | Unproved workflow/content parity | RB-logo-platform |
| Logo trace | `/logo-to-svg-for-glowforge` | `/logo-to-svg-converter` candidate only | Indexable wrapper of the **general logo** action/component | Same | Same current general SVG | Same | Same | Same | Same general trace | No proven laser post-process in this route | Same | R10 | Same | Same | Same | Capture | n/a | Glowforge complexity guidance | Self meta | Inferred shared implementation, but intent mismatch needs review | Preserve exact current general output and migrate guidance; do not silently add laser processing | Logo fixture, current hash, guidance, no-laser-postprocess assertion | no | Platform intent could be mistaken for laser-output parity | RB-logo-platform |
| Logo trace | `/logo-to-svg-for-silhouette` | `/logo-to-svg-converter` candidate only | Indexable wrapper of general logo action/component | Same | Same current general SVG | Same | Same | Same | Same | Same | Same | R10 | Same | Same | Same | Capture | n/a | Silhouette guidance | Self meta | Inferred | Silhouette context | Logo/cut-import fixtures, exact output, content/schema | no | No complete workflow proof | RB-logo-platform |
| Logo Cricut | `/logo-to-svg-for-cricut` | None; keep self | Indexable full cut-route source | Route-local raster set | Cut-oriented SVG | Cut/logo exact list | Logo cut default | Cut controls | Trace | Cut-specific | Yes | R10 | Layer/style/size/update | SVG | Cricut SVG | Route-specific | n/a | Cricut logo guidance | Self identity | Distinct | Keep separate | Full cut regressions | no | Presets/output intent differ | RB-self |
| Logo layered | `/logo-to-layered-svg-converter` | None; keep self | Indexable wrapper of layered Cricut source | PNG/JPG/JPEG/WebP according to source validator | Layered SVG | Exact layered logo list | Layered default | Layer count/palette/cleanup/geometry | Layered | Color-region separation | Layer preview | R10 | Per-layer | SVG | Layered SVG | Route-specific | n/a | General layered-logo guidance | Self meta | Distinct output family | Keep separate | Layer/color/path/history tests | no | Layered output cannot be reduced to general trace | RB-self |
| Logo layered Cricut | `/logo-to-layered-svg-for-cricut` | None; keep self | Indexable layered source | Same layered source set | Layered Cricut SVG | Exact layered list | Layered default | Layered controls | Layered | Cricut layer annotation | Yes | R10 | Per-layer | SVG | Layered Cricut SVG | Route-specific | n/a | Cricut layered-logo guidance | Self identity | Distinct | Keep separate | Same plus Cricut context | no | Distinct output/workflow | RB-self |
| Logo favicon | `/logo-to-favicon-generator`, `/logo-to-favicon-for-shopify` | `/image-to-favicon-generator` | Cross-family favicon wrappers | SVG, PNG, JPEG, WebP | ICO/PNG/package/snippet | None | Favicon defaults | Favicon settings | Client canvas/package | ICO/ZIP | Gallery | None | Pre-generation | Snippet | Package actions | Basename-derived | 24 tested entries | Logo/Shopify favicon guidance | Self meta; shared schema | Tested favicon package parity | Follow favicon plan, not logo trace plan | Favicon gates | no | Different output family | RB-favicon |

Sources: `app/routes/logo-to-svg-converter.tsx`; logo wrappers under `app/routes/`; `app/routes/logo-to-svg-for-cricut.tsx`; `app/routes/logo-to-layered-svg-for-cricut.tsx`; `app/routes/logo-to-layered-svg-converter.tsx`; `app/data/routeMeta/marketplaceCraft.ts`.

### D. SVG-to-PNG family

All nine routes accept SVG only, use the same client canvas pipeline, expose width, height, aspect lock, scale/pixel ratio, antialiasing, transparent/solid canvas background, preview/fullscreen, and a user-derived `.png` filename. They do not recolor fully opaque SVG artwork. They have one current output rather than trace history, no preset system, and no ZIP/package.

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SVG-PNG | `/svg-to-png-converter` | self | Indexable source component | SVG | PNG | None | 1024 x 1024, lock, transparent, 1x, AA, input basename | Raster export settings | Client raster | Canvas composite and PNG encode | Yes/fullscreen | Single current | Settings + reconvert | No SVG/PNG copy action | PNG | Input/user basename | n/a | General export guidance | Self identity | Baseline | Add bounded context resolver without changing default | Fixture/settings/browser gates | no | Retained route | RB-SVGPNG |
| SVG-PNG | `/svg-to-png-for-shopify` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same current behavior | n/a | Shopify export guidance | Self meta; rendered BreadcrumbList currently base | Tested one fixture/equal settings | Shopify context/deep link and content migration | Transparent/solid/alpha/dimensions/filename/content/schema | no | Context and transition incomplete | RB-SVGPNG |
| SVG-PNG | `/svg-to-png-for-etsy` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Etsy listing guidance | Self meta; base rendered schema | Tested | Etsy context | Same family gates | no | Context/content incomplete | RB-SVGPNG |
| SVG-PNG | `/svg-to-png-for-printify` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Printify/POD guidance | Self meta; base rendered schema | Tested | Printify context | Same plus POD guidance/mobile | no | Context/content incomplete | RB-SVGPNG |
| SVG-PNG | `/svg-to-png-for-printful` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Printful/POD guidance | Self meta; base rendered schema | Tested | Printful context | Same | no | Context/content incomplete | RB-SVGPNG |
| SVG-PNG | `/sticker-to-png-for-printing` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Sticker/print guidance | Self meta; base rendered schema | Tested | Sticker-print context | Transparent edges, partial alpha, dimensions, guide/schema | no | Route intent not represented at destination | RB-SVGPNG |
| SVG-PNG | `/svg-to-transparent-png-for-printing` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same current transparent default | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Transparent print guidance | Self meta; base rendered schema | Tested | Transparent-print context; retain transparent default explicitly | Alpha and background gates | no | Context/default contract not explicit | RB-SVGPNG |
| SVG-PNG | `/svg-to-png-for-canva` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Canva guidance | Self meta; base rendered schema | Tested | Canva context | Same family gates | no | Content/schema transition incomplete | RB-SVGPNG |
| SVG-PNG | `/svg-to-png-for-figma` | `/svg-to-png-converter` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | No | Same | Same | n/a | Figma guidance | Self meta; base rendered schema | Tested | Figma context | Same family gates | no | Content/schema transition incomplete | RB-SVGPNG |

Sources: `app/routes/svg-to-png-converter.tsx`; its eight wrapper files; `app/data/routeMeta/marketplaceExport.ts`; `app/data/routeMeta/canvaFigma.ts`; `scripts/converter-parity-audit.mjs`.

### E. SVG resize family

All seven routes accept SVG only and expose width, height, unit, aspect lock, scale percent, viewBox mode, responsive sizing, `preserveAspectRatio`, style-size stripping, preview, copy, and SVG download. They use a single live output, no presets, and no trace history.

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Resize | `/svg-resize-and-scale-editor` | self | Indexable source | SVG | Resized SVG | None | Source-derived size/unit; lock; 100%; keep viewBox | Full resize set | Client SVG parse/serialize | Attribute/viewBox/style rewrite | Yes | Single current | Live settings | SVG | SVG | Input/user basename | n/a | General resize guidance | Self identity | Baseline | Add context resolver without changing default | Non-square/unit/viewBox/stroke/serialization gates | no | Retained route | RB-resize |
| Resize | `/svg-resizer-for-shopify` | `/svg-resize-and-scale-editor` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | Same | Same | Same | n/a | Shopify sizing guidance | Self meta; rendered schema base | Tested one fixture/modes | Shopify context/content | Full modes, filename, content/schema/mobile | no | Context and broader fixtures incomplete | RB-resize |
| Resize | `/svg-resizer-for-etsy` | `/svg-resize-and-scale-editor` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | Same | Same | Same | n/a | Etsy listing sizing | Self meta; base schema | Tested | Etsy context | Same gates | no | Context/content incomplete | RB-resize |
| Resize | `/svg-resizer-for-glowforge` | `/svg-resize-and-scale-editor` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | Same | Same | Same | n/a | Material/workspace guidance | Self meta; base schema | Tested | Glowforge context; do not add geometry/cut processing | Non-square/stroke/workspace guidance checks | no | Context/content incomplete | RB-resize |
| Resize | `/svg-resizer-for-silhouette` | `/svg-resize-and-scale-editor` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | Same | Same | Same | n/a | Silhouette guidance | Self meta; base schema | Tested | Silhouette context | Same gates | no | Context/content incomplete | RB-resize |
| Resize | `/svg-resizer-for-canva` | `/svg-resize-and-scale-editor` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | Same | Same | Same | n/a | Canva handoff guidance | Self meta; base schema | Tested | Canva context | Same gates | no | Context/content incomplete | RB-resize |
| Resize | `/svg-resizer-for-figma` | `/svg-resize-and-scale-editor` | Indexable wrapper | Same | Same | None | Same | Same | Same | Same | Same | Single | Same | Same | Same | Same | n/a | Figma component guidance | Self meta; base schema | Tested | Figma context | Same gates | no | Context/content incomplete | RB-resize |

Sources: `app/routes/svg-resize-and-scale-editor.tsx`; six resizer wrapper files; `app/data/routeMeta/svgPlatformTools.ts`; `scripts/converter-parity-audit.mjs`.

### F. Dimensions and file-size

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inspector | `/svg-dimensions-inspector` | self | Indexable standalone utility | SVG file/paste/example | Dimension report and optionally repaired SVG | None | 96 DPI, fallback 1024, no fix | DPI, fallback, fix strategy, width/height/viewBox output, normalize px | Client SVG inspect | Optional sizing-attribute repair | Yes | None | Dimension fields and fix | SVG | SVG | Input-derived | n/a | Sizing/viewBox repair | Self identity | Distinct | Keep separate | Missing dimensions, units, non-square, each repair strategy, byte/path preservation | no | Different task/output from file size | RB-self |
| Inspector | `/svg-file-size-inspector` | self | Indexable standalone utility | SVG file/paste/example | Byte/minified-size report and original/cleaned SVG download | None | CSS 96 DPI, custom DPI value 300, fallback 1024, safe preview | Unit mode, DPI, fallback, preview sanitization | Client SVG inspect | Estimate-only minification and preview sanitization | Yes | None | No dimension repair; settings affect report/preview | Stats | SVG | Input-derived | n/a | Weight/compression guidance | Self identity | Distinct | Keep separate; no tab integration planned | Byte counts, minification estimate, sanitization, copy stats, download | no | Different report/actions and user goal | RB-self |

A future combined tab would add navigation and state complexity without removing either route safely. It should not be prototyped until an approved product requirement shows value and all direct-load, back/forward, paste/upload, copy/download, and accessibility semantics are specified.

Sources: `app/routes/svg-dimensions-inspector.tsx`; `app/routes/svg-file-size-inspector.tsx`; runtime audit Sections 5, 8, 18, and 22.

### G. Cricut, code, and Base64

The matrix intentionally marks title-implied input sets as unresolved unless the current validator was inspected. A future batch must export or test the route-local validator contract before moving any route.

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cricut upload | `/cricut-svg-converter` | self | Indexable full source | PNG, JPG/JPEG, WebP, GIF, AVIF, BMP, TIFF, SVG | Cut-oriented SVG | Exact local + shared trace list | Route-local Cricut default | Full cut trace settings | Trace or uploaded-SVG sanitize | Cut-friendly annotation/settings | Yes/fullscreen | R10 | Layer/style/size/update | SVG | SVG | Route-specific | n/a | General Cricut workflow | Self identity | Baseline only | Retain as broad uploaded-source route | Every format, presets, errors, history, editing, stale/reset/second upload | no | Retained route and incomplete parity | RB-Cricut-upload |
| Cricut upload | `/image-to-svg-for-cricut` | `/cricut-svg-converter` candidate only | Indexable full source and template owner for general format expansion | PNG, JPG/JPEG, WebP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, SVG | Cut-oriented SVG | Exact route-local + shared list | Route-local image default | Full cut settings | Trace/uploaded SVG | Route-local | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Broad image/HEIC guidance | Self identity | Partial/inconclusive | Destination would need HEIC/HEIF, exact defaults/presets, and source handling before any merge | Format/signature/preview/output matrix including HEIC/HEIF | no | Broader accepted-input contract and separate implementation | RB-Cricut-upload |
| Cricut format | `/png-to-svg-for-cricut` | `/cricut-svg-converter` candidate only | Indexable full route | Route-local PNG/JPEG set; exact validator owns truth | Single/cut SVG | Exact local + shared list; fixed unique route-local ID | Route-local PNG Cricut default | Full cut settings | Trace | Cut-oriented | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | PNG cut guidance | Self identity | Inconclusive | Explicit PNG mode, exact default and filename if ever combined | Validator, all presets, default hashes, history identity, filenames | no | Preset/default/content differences | RB-Cricut-format |
| Cricut format | `/jpg-to-svg-for-cricut` | `/cricut-svg-converter` candidate only | Indexable full route | Route-local validator; baseline exact MIME/extensions | Cut SVG | Exact list; fixed unique local ID | JPG cut default | Full cut settings | Trace | Cut-oriented | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | JPG cut guidance | Self identity | Inconclusive | JPG mode and exact identity | Same plus JPG/JPEG errors | no | Unproved input/preset/output parity | RB-Cricut-format |
| Cricut format | `/jpeg-to-svg-for-cricut` | `/cricut-svg-converter` candidate only | Indexable full route | Route-local validator | Cut SVG | Exact list; fixed unique local ID | JPEG cut default | Full cut settings | Trace | Cut-oriented | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | JPEG cut guidance | Self identity | Inconclusive | JPEG mode and exact identity | Same | no | Unproved parity | RB-Cricut-format |
| Cricut format | `/webp-to-svg-for-cricut` | `/cricut-svg-converter` candidate only | Indexable full route | Route-local validator | Cut SVG | Exact list; fixed unique local ID | WebP cut default | Full cut settings | Trace | Cut-oriented | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | WebP cut guidance | Self identity | Collision-pair outputs differ; no family parity | WebP mode would need both preserved preset definitions | WebP alpha/opaque, both former collision presets, history, filename | no | Proven preset/output distinctions | RB-Cricut-format |
| Cricut purpose | `/photo-to-svg-for-cricut` | None; keep self | Indexable full route | Route-local raster set | Photo outline/silhouette/cut SVG | Photo-specific exact list | Photo route default | Photo/cut settings | Trace | Photo simplification | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Photo and cut limitations | Self identity | Inconclusive | Keep separate | Photo fixtures/presets/cut output | no | Purpose-specific presets/output | RB-self |
| Cricut purpose | `/black-and-white-image-to-svg-for-cricut` | None; keep self | Indexable full route | Route-local raster set | Single/color cut SVG | B/W-specific list | `bw-clean-cut` | Threshold/cleanup/cut settings | Trace | B/W processing | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | B/W cut guidance | Self identity | Distinct | Keep separate | Threshold polarity, alpha, preset, history gates | no | Purpose-specific behavior | RB-self |
| Cricut purpose | `/line-art-to-svg-for-cricut` | None; keep self | Indexable full route | Route-local raster set | Line/cut SVG | Line-art list | `line-art-clean-cut` | Line/stroke/cut settings | Trace | Line-art cleanup | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Line-art cut guidance | Self identity | Distinct | Keep separate | Thin/thick line fixtures, centerline/fill modes | no | Purpose-specific controls | RB-self |
| Cricut purpose | `/drawing-to-svg-for-cricut` | None; keep self | Indexable full route | PNG, JPG/JPEG, SVG | Cut SVG | Drawing-specific exact list | `drawing-clean` | Trace/layer/cut settings | Trace or uploaded SVG | Drawing cleanup | Yes | R10 | Yes | SVG | SVG plus settings CSV where currently exposed | `*-cricut.svg`; report filename where applicable | n/a | Drawing/Cricut guidance | Self identity | Distinct | Keep separate | Raster/SVG, presets, CSV, history/editing | no | Input/preset/export distinctions | RB-self |
| Cricut purpose | `/sketch-to-svg-for-cricut` | None; keep self | Indexable layered route | PNG, JPG/JPEG, WebP | Layered/cut SVG | Sketch layered exact list | `sketch-balanced` | Layer count/palette/cleanup/geometry | Layered | Color-region separation | Yes | R10 | Per-layer | SVG | SVG | `sketch-to-svg-for-cricut.svg` | n/a | Sketch/Cricut guidance | Self identity | Distinct | Keep separate | Pencil/photo fixtures, layer colors/order, history | no | Layered output and unique inputs | RB-self |
| Cricut purpose | `/sticker-to-svg-for-cricut` | None; keep self | Indexable full route | Route-local raster set | Sticker/cut SVG | Sticker-specific list | Route-local sticker default | Border/cleanup/cut settings | Trace | Sticker edge processing | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Sticker/Cricut guidance | Self identity | Distinct | Keep separate | Alpha/border/offset fixtures and actions | no | Sticker-specific output | RB-self |
| Cricut purpose | `/png-to-svg-for-cricut-vinyl` | None; keep self | Indexable full route | Route-local PNG/JPEG set | Vinyl/cut SVG | Vinyl-specific exact list | Route-local vinyl default | Vinyl/cut settings | Trace | Weeding/cut-oriented cleanup | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Vinyl/HTV guidance | Self identity | Distinct | Keep separate | Thin islands/weeding/path fixtures | no | Purpose-specific presets/guidance | RB-self |
| Cricut purpose | `/png-to-svg-for-cricut-stickers` | None; keep self | Indexable full route | Route-local PNG/JPEG set | Printable/sticker SVG and cut treatment | Sticker exact list plus display additions | White-border route default | Sticker border/cut settings | Trace | Sticker border/offset | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Sticker workflow | Self identity | Distinct; clicked values proven | Keep separate | Display-preset metadata, border output, history/editing | no | Distinct output semantics | RB-self |
| Cricut purpose | `/png-to-svg-for-cricut-print-then-cut` | None; keep self | Indexable full route | Route-local PNG/JPEG set | Printable color plus separate cut-outline workflow | Print Then Cut exact list plus display additions | Sticker clean-offset default | Print/cut outline settings | Trace | Printable/cut separation | Yes | R10 | Route-specific | SVG/content actions | Route-specific downloads | Route-specific | n/a | Print Then Cut guidance | Self identity | Distinct; clicked values proven | Keep separate | Printable/cut pairing, alpha, downloads, history | no | Distinct multi-artifact workflow | RB-self |
| Cricut layered | `/layered-svg-for-cricut` | None; keep self | Indexable layered source | PNG, JPG/JPEG, WebP | Layered Cricut SVG | Exact layered list | Layered default | Layer count/palette/cleanup/geometry | Layered | Color separation/annotation | Yes | R10 | Per-layer | SVG | SVG | Route-specific | n/a | General layered Cricut guidance | Self identity | Distinct | Keep separate | Palette/region/layer/history tests | no | Layered workflow | RB-layered |
| Cricut layered | `/image-to-layered-svg-for-cricut` | None; keep self | Indexable layered source and general layered wrapper owner | PNG/JPG-family per route validator | Layered Cricut SVG | Exact layered list | `layered-color` | Layered settings | Layered | Same family with route-local handling | Yes | R10 | Per-layer | SVG | SVG | Route-specific | n/a | Image-layer guidance | Self identity | Partial only | Keep separate pending dedicated layered architecture work | Broad format/palette/history tests | no | Separate source and unresolved formats | RB-layered |
| Cricut layered | `/png-to-layered-svg-for-cricut` | None; keep self | Indexable full layered route | PNG-focused validator | Layered Cricut SVG | PNG-layered exact list | Layered default | Layered settings | Layered | Color separation | Yes | R10 | Per-layer | SVG | SVG | Route-specific | n/a | PNG layer guidance | Self identity | Distinct | Keep separate | Alpha/colors/regions/history | no | Distinct layered intent | RB-layered |
| Cricut layered | `/jpg-to-layered-svg-for-cricut` | None; keep self | Indexable layered source | JPG/JPEG-focused validator | Layered Cricut SVG | Exact list | Layered default | Layered settings | Layered | Color separation | Yes | R10 | Per-layer | SVG | SVG | Route-specific | n/a | JPG layer guidance | Self identity | Distinct | Keep separate | Photo/poster palette and history tests | no | Distinct input/content | RB-layered |
| Cricut layered | `/logo-to-layered-svg-for-cricut` | None; keep self | Indexable layered source | PNG/JPG/JPEG/WebP per audited source family | Layered Cricut SVG | Logo-layered exact list | Layered default | Layered settings | Layered | Logo color separation | Yes | R10 | Per-layer | SVG | SVG | Route-specific | n/a | Logo layer guidance | Self identity | Distinct | Keep separate | Logo colors/transparency/layers | no | Distinct output family | RB-layered |
| Code | `/code-to-svg-for-cricut` | None; keep self | Indexable public utility | Pasted raw SVG, Base64, data URI, CSS, Markdown, HTML, JSON; embedded PNG/JPG/WebP/GIF/SVG data | Sanitized SVG or traced SVG plus report | Exact 13-route-local set plus additions | `layered-color` | Source mode, extraction, trace/layer settings | Parse/sanitize or trace | Candidate extraction and source detection | Yes | R10 | SVG/layer output | SVG/report | SVG and CSV | Source-derived SVG; report CSV | n/a | Code/data representation guidance | Self identity | Unique workflow proven | Keep separate; parser helpers may be shared, but UI stays route-specific | Every source mode, multiple candidates, invalid data, direct SVG, raster data, history/CSV | no | Unique parser and output report | RB-code |
| Base64 Cricut | `/base64-to-svg-for-cricut` | None; keep self | Indexable public utility | Base64 SVG, SVG data URL, encoded SVG, Base64 raster image | Decoded/sanitized or traced SVG plus report | Exact 15-route-local set | `layered-color` | Decode, cleanup, raster trace/layer settings | Decode/sanitize or trace | Base64 type detection | Yes | Bounded history | Layer/result editing | SVG/report | SVG and CSV | `cricut-design.svg`; report CSV | n/a | Encoded-source/Cricut guidance | Self identity | Unique workflow proven | Keep separate; reuse only bounded decode/validation helpers | Plain/data-URI SVG, raster encodings, errors, history, report | no | Unique decode and report workflow | RB-base64 |
| General Base64 | `/base64-to-svg` | None; keep self | Indexable non-Cricut utility | Base64 SVG/data URI | Decoded/cleaned SVG | Route-local clean presets | `clean-svg` | Decode/clean settings | Client decode/sanitize | SVG cleanup | Yes | Route-specific current output/history behavior | Markup/settings | SVG | SVG | Route-specific | n/a | General decode guidance | Self identity | Unique and out of Cricut scope | Keep separate; regression only | Decode/sanitize/copy/download | no | Different purpose and controls | RB-self |
| SVG encoder | `/svg-to-base64` | None; keep self | Indexable code/data utility | SVG markup or SVG file, subject to the current route validator | Base64 and data-URI representations | Route-local encoding choices | Current route default | Encoding and serialization controls | Encode existing SVG; no image tracing | Serialization only | Route-specific | Route-specific | Source/output editing where currently exposed | Encoded output | Encoded output/export | Route-specific | n/a | Embedding and transport guidance | Self identity | Functionally distinct from decoding and tracing | Keep separate; share pure encoding helpers only if already proven | Encoding modes, Unicode, malformed SVG, copy/export, filenames | no | Opposite data flow and different outputs | RB-self |
| Embed snippets | `/svg-embed-code-generator` | None; keep self | Indexable code-generation utility | SVG source accepted by its current validator | HTML/CSS embedding snippets and data representations | Route-local output choices | Current route default | Embed-method and serialization controls | Parse and serialize SVG for selected embed method | Snippet generation | Route-specific | Route-specific | Source/snippet editing where currently exposed | Generated snippets | Generated snippet/export | Route-specific | n/a | Browser embedding guidance | Self identity | Unique multi-snippet workflow | Keep separate; do not fold into Cricut input parsing | Every embed mode, escaping, copy/export, invalid source | no | Different audience, outputs, and validation | RB-self |
| Inline comparison | `/inline-svg-vs-img` | None; keep self | Indexable comparison utility | SVG source accepted by its current validator | Inline and image-reference comparison output | Route-local choices | Current route default | Comparison/display controls | Render or serialize both approaches | Comparison-specific generation | Route-specific | Route-specific | Current source/output editing | Comparison snippets | Current export behavior | Route-specific | n/a | Inline-versus-image behavior guidance | Self identity | Unique comparison workflow | Keep separate; regression only | Both representations, escaping, preview, copy/export | no | Educational comparison is not a Cricut conversion mode | RB-self |
| JSX conversion | `/svg-to-jsx-converter` | None; keep self | Indexable code-generation utility | SVG source accepted by its current validator | JSX/component source | Route-local conversion choices | Current route default | JSX serialization controls | SVG-to-JSX transformation | Attribute and syntax conversion | Route-specific | Route-specific | Source/result editing where currently exposed | JSX | JSX copy/export | Route-specific | n/a | Framework integration guidance | Self identity | Unique code transformation | Keep separate; regression only | Attribute mapping, style conversion, escaping, copy/export | no | Output is code, not an SVG cut-file workflow | RB-self |

The general layered wrappers `/image-to-layered-svg-converter`, `/jpg-to-layered-svg-converter`, and `/logo-to-layered-svg-converter` inherit Cricut-layered implementations but have non-Cricut route identity. They require a separate layered-family planning milestone; they are not redirect candidates in this plan.

Existing redirect aliases for these code/data utilities are not new consolidation candidates: `/svg-to-data-uri-converter` already targets `/svg-to-base64`; `/svg-to-css-background` and `/svg-inline-code-generator` already target `/svg-embed-code-generator`; and `/svg-to-react-component` already targets `/svg-to-jsx-converter`. This plan leaves those established redirects unchanged.

Sources: the named route files under `app/routes/`; `app/client/lib/converter/routeCapabilities.ts`; `app/client/lib/converter/presetAdditions.ts`; `app/client/components/converter/TraceOutputPanel.tsx`; `app/client/components/converter/BespokeTraceOutputPanel.tsx`; `app/client/lib/converter/outputHistory.ts`.

### H. Sketch and drawing

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sketch | `/sketch-to-svg-converter` | self | Indexable full source | PNG, JPG/JPEG | Editable SVG | Sketch exact list + shared additions | Sketch pencil/light route default | Trace/detail/cleanup/layer/geometry | Trace | Sketch-tuned cleanup | Yes/fullscreen | R10 | Layer/style/size/update | SVG | SVG | `sketch-to-svg-converter.svg` | n/a | Photographed/scanned sketch guidance | Self identity | Baseline only | Keep separate | Pencil/ink/photo/alpha, all presets/settings/history | no | Retained route and narrower inputs | RB-sketch |
| Drawing | `/drawing-to-svg-converter` | self | Indexable full source | PNG, JPG/JPEG, WebP, GIF, AVIF, BMP, TIFF, SVG | Editable SVG | Drawing exact list + shared additions | Drawing accurate route default | Full trace/layer settings | Trace or uploaded SVG | Drawing-tuned cleanup | Yes/fullscreen | R10 | Layer/style/size/update | SVG | SVG | `drawing-to-svg-converter.svg` | n/a | Drawing/doodle/lettering guidance | Self identity | Baseline only | Keep separate | Every format, presets, output/history | no | Broader inputs and different preset inventory | RB-drawing |
| Sketch Cricut | `/sketch-to-svg-for-cricut` | None; keep self | Indexable layered route | PNG, JPG/JPEG, WebP | Layered/cut SVG | Sketch-layered exact list | `sketch-balanced` | Layered/cut settings | Layered | Color-region separation | Yes | R10 | Per-layer | SVG | SVG | Route-specific | n/a | Sketch-to-Cricut guidance | Self identity | Distinct | Keep separate | See Cricut gates | no | Layered/cut output | RB-self |
| Drawing Cricut | `/drawing-to-svg-for-cricut` | None; keep self | Indexable cut route | PNG, JPG/JPEG, SVG | Cut SVG | Drawing-cut exact list | `drawing-clean` | Trace/cut settings | Trace/uploaded SVG | Cut cleanup | Yes | R10 | Yes | SVG | SVG/CSV where exposed | Route-specific | n/a | Drawing-to-Cricut guidance | Self identity | Distinct | Keep separate | See Cricut gates | no | Inputs/presets/output differ | RB-self |
| Line art | `/line-art-to-svg-converter` | None; keep self | Indexable purpose route | Route-local validator | Line/stroke SVG | Line-art/stroke list | Route-local default | Line/stroke settings | Trace | Line cleanup | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Ink/line-art guidance | Self identity | Related, not duplicate | Keep separate | Thin/thick/centerline fixtures | no | Outcome-specific modes | RB-self |
| B/W | `/black-and-white-image-to-svg-converter` | None; keep self | Indexable purpose route | Route-local validator | B/W SVG | B/W list | `bw-clean` | Threshold/polarity/cleanup | Trace | B/W processing | Yes | R10 | Yes | SVG | SVG | Route-specific | n/a | Black/white guidance | Self identity | Related, not duplicate | Keep separate | Threshold/invert/alpha fixtures | no | Outcome-specific workflow | RB-self |

No sketch or drawing source should move into an accordion on the other route. A later shared implementation refactor may deduplicate private helpers while keeping both public routes and exact behavior.

Sources: `app/routes/sketch-to-svg-converter.tsx`; `app/routes/drawing-to-svg-converter.tsx`; `app/routes/sketch-to-svg-for-cricut.tsx`; `app/routes/drawing-to-svg-for-cricut.tsx`; `app/routes/line-art-to-svg-converter.tsx`; `app/routes/black-and-white-image-to-svg-converter.tsx`.

### I. JPG and JPEG

| Family | Source route | Candidate destination | Current route status | Accepted inputs | Outputs | Presets | Default | Settings | Conversion pipeline | Post-processing | Preview | History | Editing | Copy | Download/export | Filenames | Package contents | Route-specific guidance | Metadata/schema distinctions | Current parity | Additive preservation work | Tests required | Redirect safe now | Blocking reason | Rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| JPG/JPEG | `/jpg-to-svg-converter` | Undecided | Indexable full source and primary-nav route | PNG, JPG/JPEG, WebP, SVG | Editable SVG | Exact JPG-local + shared list | `scan-clean` | Full trace/layer/edit settings | Trace/uploaded SVG | Standard trace post-processing | Yes/fullscreen | R10 | Layer/style/size/update | SVG | SVG | `jpg-to-svg-converter.svg` | n/a | JPG scan/photo guidance | Self identity | Four action scenarios byte-identical to JPEG under equal settings | If retained, add JPEG-only formats/presets without changing JPG default or rejection behavior until approved | All formats, every differing preset, concurrent history, state ownership, filenames, content/schema | no | Winner unapproved; accepted inputs/presets/content differ | RB-JPGJPEG |
| JPG/JPEG | `/jpeg-to-svg-converter` | Undecided | Indexable full source | PNG, JPG/JPEG, WebP, GIF, AVIF, BMP, TIFF, SVG | Editable SVG | Exact JPEG-local + shared list, including extra ink preset noted by audit | `scan-clean` | Full trace/layer/edit settings | Trace/uploaded SVG | Standard trace post-processing | Yes/fullscreen | R10 with explicit active-result ownership | Layer/style/size/update | SVG | SVG | `jpeg-to-svg-converter.svg` | n/a | JPEG/whiteboard/scan guidance | Self identity | Four action scenarios byte-identical; prior race fixed with deterministic ownership tests | If source redirects, destination must preserve broader formats, extra preset, active-result semantics, content, and filename decision | Full UI and action parity, slow/fast completion, reset/second upload, every format/preset, history action hashes | no | Broader accepted inputs, extra preset/content, no canonical approval | RB-JPGJPEG |

The old state defect does not justify choosing JPG or JPEG. The converter-state remediation proves result ownership, not route equivalence. Keep both routes as self-canonical pages until a product/traffic decision is supplied and all preservation gates pass.

Sources: `app/routes/jpg-to-svg-converter.tsx`; `app/routes/jpeg-to-svg-converter.tsx`; `app/client/lib/converter/traceResultOwnership.ts`; `scripts/jpeg-active-result-remediation-audit.mjs`; `scripts/converter-parity-audit.mjs`.

## 6. Destination capability designs

### 6.1 Bounded route context, not a generic converter framework

**Proposed architecture:** retained routes that absorb true wrappers should use a typed, family-local context descriptor. Each descriptor should contain only bounded primitives needed to preserve current behavior:

- stable context ID;
- visible title/short description;
- accepted-input policy reference when it genuinely differs;
- ordered preset IDs and route-specific display-label mapping;
- default preset ID;
- settings visibility overrides, if currently different;
- output filename policy;
- content module IDs;
- metadata/schema test identity during the pre-redirect stage.

The descriptor must not contain converter algorithms, large preset objects, mutable result state, or an unbounded alias registry. Conversion actions must continue to use existing production settings and helpers. Context IDs should be allowlisted by family and reject unknown values to the base context.

**URL/state proposal:** during pre-redirect work, direct source routes continue to derive context from pathname. Before a redirect, the retained route must also accept an allowlisted query such as `?workflow=shopify`. A source redirect can then translate the source pathname to a stable destination context. The destination canonical remains the query-free retained URL after consolidation. Existing unrelated query parameters must be preserved only if they are currently supported and safe; do not copy arbitrary state into URLs. HTTP fragments are client-controlled and must be tested because servers do not receive them.

History metadata should store the resolved bounded context ID and exact submitted preset ID/label when that identity affects result labels or filenames. It must not duplicate content modules or preset objects. The current JPEG ownership and preset-identity guarantees remain authoritative.

Sources: `app/routes/_shared/createTemplateWrapperRoute.ts`; `app/client/lib/converter/routeCapabilities.ts`; `app/client/components/navigation/OtherToolsLinks.tsx`; `app/client/components/converter/TraceOutputPanel.tsx`; `app/client/lib/converter/traceResultOwnership.ts`.

### 6.2 Favicon destination: `/image-to-favicon-generator`

- **Already present:** broad SVG/PNG/JPEG/WebP acceptance; aspect/padding/background controls; web/Android/iOS/Microsoft assets; seven default ICO sizes; manifest/browserconfig; snippet; individual, ICO, all-files, and ZIP actions; previews; clear and second input.
- **Expose safely:** source-format and Shopify context headings/guidance without changing the input validator or output settings.
- **Requires focused refactor:** make the image route the explicit component owner rather than a wrapper; replace pathname-only display/schema identity with a bounded favicon context; preserve current basename and action ordering.
- **Must remain route-specific until redirect:** SVG quality guidance, raster direct-resize explanation, JPG background guidance, logo legibility, ICO action emphasis, Shopify placement guidance.
- **Must not combine:** logo tracing or vectorization. Raster favicon inputs remain raster and are resized directly.

### 6.3 PNG destination: `/png-to-svg-converter`

- **Already present:** PNG/JPEG/WebP validation; exact base presets/default; full trace settings; mixed trace modes; R10 history; editing, copy, download, reset, second upload, stale-result guards.
- **Expose safely:** Canva, Figma, and transparent-PNG context modules because those routes already use the same component/action.
- **Requires focused refactor:** an Etsy/Shopify context policy capable of preserving their narrower validator, exact ordered preset set, route-specific visible labels, default, history label, and filename. Do not broaden or narrow behavior silently.
- **Must remain route-specific:** Glowforge/laser post-processing, Silhouette route, Cricut single/layered/Print Then Cut/sticker/vinyl workflows.
- **Must not combine:** canvas background concepts from SVG-to-PNG or favicon rasterization.

### 6.4 Logo destination: `/logo-to-svg-converter`

- **Already present:** PNG/JPEG validation; logo presets/default; R10 history; editing/copy/download.
- **Expose safely:** Shopify, Etsy, Canva, Glowforge, and Silhouette guidance contexts only after current output and filename baselines prove the wrappers exact.
- **Requires focused refactor:** route-context content mapping and exact history/display identity. The Glowforge context must preserve its current general logo conversion and must not silently adopt laser post-processing.
- **Must remain route-specific:** Cricut logo cut presets, layered-logo output, favicon/package generation.

### 6.5 SVG-to-PNG destination: `/svg-to-png-converter`

- **Already present:** the entire production converter for all nine routes.
- **Expose safely:** eight allowlisted contexts with their exact existing titles, intros, platform workflow, limitations, and related links.
- **Requires focused refactor:** context resolution independent of source pathname so a future redirect retains the correct guidance. Make BreadcrumbList and visible breadcrumb behavior explicit during the pre-redirect stage.
- **Must remain unchanged:** SVG-only validation; dimensions; scale/pixel ratio; aspect lock; antialiasing; transparent/solid canvas compositing; preview/fullscreen; filename.
- **Must not add:** artwork fill/stroke recoloring.

### 6.6 Resize destination: `/svg-resize-and-scale-editor`

- **Already present:** the entire production editor for all seven routes.
- **Expose safely:** six platform contexts.
- **Requires focused refactor:** context resolution and route-aware schema tests.
- **Must remain unchanged:** width/height, units, lock, scale, viewBox modes, responsive mode, `preserveAspectRatio`, style stripping, non-square handling, preview, copy, download, basename.
- **Must not add:** path geometry scaling beyond current serialization semantics or platform-specific cut processing.

### 6.7 Destinations that should not absorb related routes

- `/svg-dimensions-inspector` and `/svg-file-size-inspector` retain independent state and output models.
- `/cricut-svg-converter` remains upload-oriented; code, Base64, layered, Print Then Cut, sticker, vinyl, sketch, drawing, line-art, B/W, and format routes remain independent.
- `/sketch-to-svg-converter` and `/drawing-to-svg-converter` retain separate accepted-input and preset contracts.
- JPG/JPEG has no approved retained destination.

## 7. Content-preservation matrix

The content classification is an inventory decision, not a rewrite. Exact strings remain in the current route sources, `app/client/components/navigation/OtherToolsLinks.tsx`, route meta helpers, and `app/data/routeManifest.ts`.

| Source route or group | Useful content inventory | Classification | Future location | Do not migrate |
| --- | --- | --- | --- | --- |
| `/svg-to-favicon-generator` | SVG source quality, favicon sizes, browser/app placement, package/snippet instructions, troubleshooting, FAQ | Migrate to retained page core plus SVG input context | `/image-to-favicon-generator` core and SVG context | Any statement that implies raster input is vectorized |
| `/image-to-favicon-generator` | Broad input overview and general package workflow | Retain as core | Retained page default | Duplicate generic paragraphs after manual comparison |
| PNG/JPG/logo favicon wrappers | Format-specific alpha, background, padding, logo legibility, ICO intent | Retain as route-context content | Input-format tabs/accordions or contextual help | Title-only duplication with no useful detail |
| Shopify favicon wrappers | Store theme/logo placement and platform caveats | Retain as Shopify context | Shopify context module | Unsupported Shopify validation claims |
| `/png-to-svg-converter` | Transparent logos/icons/stickers, preset guidance, cleanup, editing, export, limitations | Retain as destination core | Base route | Nothing useful should be removed in the first family batch |
| Canva/Figma PNG wrappers | Design-handoff use cases and import review | Retain as route-context content | Canva/Figma context modules | Repeated generic converter instructions |
| Transparent PNG wrapper | Alpha/background-aware tracing guidance | Retain as route-context content | Transparent input context | Claims that all accepted files are transparent PNG |
| Etsy/Shopify PNG routes | Seller/storefront workflow, route-specific preset explanation, export review | Retain as route-context content | Etsy/Shopify contexts after validator/default work | Marketplace guarantees or duplicated generic copy |
| Glowforge/laser/Silhouette/Cricut PNG routes | Machine/cut workflow, material/path review, purpose-specific presets | Retain on separate routes | Existing pages | Do not migrate into general PNG destination |
| `/logo-to-svg-converter` | Logo cleanup, transparent marks, smoothness/detail, editing and export | Retain as core | Base logo route | None without manual review |
| Logo platform wrappers | Shopify/Etsy/Canva/Figma-style brand handoff, Glowforge/Silhouette review | Retain as route-context content | Platform modules | Claims of laser/cut processing where current wrapper does not perform it |
| Logo Cricut/layered/favicon routes | Cut-file, layer separation, package/icon guidance | Retain on separate routes | Existing pages | Do not flatten into general logo content |
| `/svg-to-png-converter` | Size, transparency, canvas background, browser raster limits | Retain as core | Base exporter | Artwork-recolor language |
| SVG-to-PNG wrappers | Shopify/Etsy/Printify/Printful/printing/sticker/Canva/Figma workflows and caveats | Retain as context modules | Destination accordions/tabs keyed by allowlisted context | Repeated generic export instructions after manual diff |
| `/svg-resize-and-scale-editor` | Units, aspect, scale, viewBox, responsive sizing, serialization caveats | Retain as core | Base editor | None without manual review |
| Resizer wrappers | Platform workspace/listing/component/cut sizing guidance | Retain as context modules | Destination contexts | Platform guarantees |
| Dimensions inspector | Width/height/viewBox/unit repair guidance and FAQ | Retain on route | Existing page | Do not move to file-size route |
| File-size inspector | Byte weight, minification estimate, preview safety, embedding/performance guidance | Retain on route | Existing page | Do not move to dimensions route |
| Code/Base64 Cricut | Source representation detection, decode/extraction, warnings, report/CSV, cut review | Retain on each route | Existing pages | Do not collapse into upload guidance |
| Single/layered Cricut routes | Preset purpose, cut/layer workflows, material/software limitations | Retain on each route | Existing pages | Do not centralize into one generic Cricut block |
| Sketch/drawing routes | Source capture, contrast, line quality, preset choice, detail review | Retain on each route | Existing pages | Duplicate generic trace explanations may be reviewed later, not removed now |
| JPG/JPEG | Extension/source wording, scans/photos/whiteboards, format limits, presets, FAQ | Manual merge only after winner approval | Undecided | No route copy is disposable solely because output hashes match |

No content item is classified to change the All Tools section. No guide creation is part of this plan; “move to a guide” is therefore not selected for any current item.

Sources: route-local `SeoSections` and help content under `app/routes/`; `app/client/components/navigation/OtherToolsLinks.tsx`; `app/data/routeMeta/canvaFigma.ts`; `app/data/routeMeta/faviconExport.ts`; `app/data/routeMeta/marketplaceCraft.ts`; `app/data/routeMeta/marketplaceExport.ts`; `app/data/routeMeta/svgPlatformTools.ts`; `app/data/routeManifest.ts`.

## 8. Shared architecture requirements

| Proposed change | Classification | Why | Scope and constraint | Evidence/source |
| --- | --- | --- | --- | --- |
| Family-local typed context descriptors | Required before consolidation | Redirected wrappers need stable display labels, defaults, validation, content, and filenames after pathname identity is gone. | One descriptor per family; allowlisted bounded primitives; no global registry; no converter algorithms in descriptors. | Current components use `useLocation().pathname` and wrapper imports in `app/routes/`. |
| Context resolver that supports current pathname and a future allowlisted query value | Required before consolidation | Enables a no-redirect preparation stage and later source-to-context redirects. | Unknown context falls back to base; no private/user data; no arbitrary query serialization. | `app/routes/svg-to-png-converter.tsx`; `app/routes/svg-resize-and-scale-editor.tsx`; `app/routes/png-to-svg-for-etsy.tsx`. |
| Build/test-time reachable preset uniqueness and exact ordered-list assertions | Already partly implemented; required gate | Preset identity was a proven defect class. | Reuse `scripts/preset-identity-remediation-audit.mjs`; avoid production runtime failures. | `app/client/lib/converter/presetAdditions.ts`; preset remediation audit. |
| Exact submitted preset/context metadata in result history | Already implemented for affected trace routes; required preservation | Prevents first-match label reconstruction and stale context after consolidation. | Store bounded IDs/labels only; preserve R10; no large object copies. | `TraceOutputPanel.tsx`; converter-state remediation document. |
| Shared route-aware breadcrumb/schema value provider inside each candidate component | Required before redirect | Current wrapper components can emit the base BreadcrumbList while metadata stays self-canonical. | Family-local helper first; do not rewrite every site schema helper. | `JsonLdBreadcrumbs` in SVG-to-PNG, resizer, and favicon sources. |
| Route manifest/route registration/sitemap transition audit | Required before redirect | A redirect must become non-indexable, leave XML, and avoid chains while the retained URL stays self-canonical. | Extend current static audits; no production runtime dependency. | `app/routes.ts`; `app/data/routeManifest.ts`; `public/sitemap.xml`; `scripts/route-coverage-audit.mjs`. |
| Context-aware content module selection | Required before redirect | Route-specific guidance is a preservation dimension. | Reuse current route guide structures or family-local maps; preserve useful copy exactly first. | `OtherToolsLinks.tsx`; route-local pathname content maps. |
| Explicit validator policy for contexts with different accepted inputs | Required for Etsy/Shopify PNG and any JPG/JPEG proposal | Shared UI does not prove action validation parity. | Reuse production validator functions/constants; no duplicated fake list. | Route-local `ALLOWED_MIME`, `ALLOWED_EXTENSIONS`, and signature validation. |
| Output filename policy in context descriptors | Required where source filename differs | A redirect must not silently rename downloads. | Capture current behavior before deciding whether a context needs a different name. | `downloadFileName` and `safeFileName` calls in route sources. |
| Wrapper factory that also owns conversion behavior | Risky and avoid | It would turn a small routing helper into a generic converter framework. | Keep `createTemplateWrapperRoute` narrow. | `app/routes/_shared/createTemplateWrapperRoute.ts`. |
| Site-wide preset, route capability, or converter architecture rewrite | Risky and avoid | State ownership, memory, input parsing, and output quality are high-risk and already stable. | Use isolated family changes. | `routeCapabilities.ts`; trace components; memory audits. |
| Common parser library for code/Base64 | Needs isolated prototype | Some validation can be shared, but source semantics and reports differ. | Prototype pure parser helpers only; keep route UX and outputs separate. | `code-to-svg-for-cricut.tsx`; `base64-to-svg-for-cricut.tsx`. |
| Combined dimensions/file-size tab | Useful only if separately approved; currently avoid | It adds state/routing complexity without enabling a proven safe redirect. | No work in the recommended batches. | Distinct inspector sources and runtime evidence. |

### High-risk ownership areas

- **Converter state and result ownership:** never derive an active result from a reordered history array. Preserve generation, sequence, result ID, submission stamp, duplicate-completion idempotence, and stale upload/reset guards.
- **Preset identity:** context mapping must not reintroduce duplicate reachable IDs or reconstruct labels by an ambiguous ID.
- **Input parsing:** code, Base64, SVG upload, raster upload, HEIC/HEIF, and format-signature validation are not interchangeable.
- **Layered conversion:** palette order, region filtering, layer annotations, per-layer editing, and output serialization are material output.
- **Package generation:** compare entry manifests and ICO directories, not raw ZIP hashes. Preserve cleanup on success and failure.
- **Output naming:** route-specific hard-coded names and input-derived basenames are user-visible behavior.
- **Memory:** no unbounded context, alias, result, Blob URL, worker, or package registry. Existing bounded history and lifecycle cleanup remain mandatory.

## 9. Redirect and canonical transition plan

### 9.1 Required sequence for every source

Each possible source transition follows the same gated order:

1. Add missing capability to the destination without changing source routing.
2. Add missing presets, defaults, settings visibility, validators, filename policy, and bounded context metadata.
3. Move or expose the source's useful content as an exact route-context module.
4. Add deterministic output, workflow, content, metadata, and accessibility tests.
5. Verify all preservation matrix cells are `yes` for the source and destination.
6. Update internal links outside the excluded All Tools section to the retained route and explicit context.
7. Update visible breadcrumb and schema references to the retained destination/context behavior.
8. In one family-scoped rollout commit, change the source loader to an HTTP `301`, mark the source non-indexable in the manifest, remove it from XML/HTML sitemap membership where applicable, and ensure the destination is self-canonical.
9. Verify the source's direct URL, query behavior, history/back navigation, crawler response, and absence of a redirect chain.
10. Retain the old source implementation until the redirect has passed production verification. Delete obsolete code only in a later cleanup commit.

The repository's existing aliases use 301 responses, so future permanent consolidations should also use **301**, not a mixture of 301/308. If form POST behavior ever needs redirection, stop: a GET-page consolidation plan must not rely on a permanent redirect to replay request bodies.

### 9.2 Exact proposed source mappings

These are proposed transition targets, not current redirect approvals.

| Exact source | Exact destination | Future context | Query-string handling | Fragment handling | Current decision |
| --- | --- | --- | --- | --- | --- |
| `/svg-to-favicon-generator` | `/image-to-favicon-generator` | `favicon=svg` | Add allowlisted context; preserve only existing supported parameters after collision checks | Browser behavior must be tested; never encode fragment server-side | blocked |
| `/png-to-favicon-generator` | `/image-to-favicon-generator` | `favicon=png` | Same | Same | blocked |
| `/jpg-to-favicon-generator` | `/image-to-favicon-generator` | `favicon=jpg` | Same | Same | blocked |
| `/logo-to-favicon-generator` | `/image-to-favicon-generator` | `favicon=logo` | Same | Same | blocked |
| `/svg-to-ico-converter` | `/image-to-favicon-generator` | `favicon=svg-ico` | Same | Same | blocked |
| `/png-to-ico-converter` | `/image-to-favicon-generator` | `favicon=png-ico` | Same | Same | blocked |
| `/svg-to-favicon-for-shopify` | `/image-to-favicon-generator` | `favicon=shopify-svg` | Same | Same | blocked |
| `/logo-to-favicon-for-shopify` | `/image-to-favicon-generator` | `favicon=shopify-logo` | Same | Same | blocked |
| `/png-to-svg-for-canva` | `/png-to-svg-converter` | `workflow=canva` | Add allowlisted context; retain only supported converter params | Test browser fragment preservation | blocked |
| `/png-to-svg-for-figma` | `/png-to-svg-converter` | `workflow=figma` | Same | Same | blocked |
| `/transparent-png-to-svg-converter` | `/png-to-svg-converter` | `workflow=transparent` | Same | Same | blocked |
| `/png-to-svg-for-etsy` | `/png-to-svg-converter` | `workflow=etsy` | Context must also select exact validator/default/presets/filename | Same | blocked |
| `/png-to-svg-for-shopify` | `/png-to-svg-converter` | `workflow=shopify` | Context must also select exact validator/default/display labels/filename | Same | blocked |
| `/logo-to-svg-for-shopify` | `/logo-to-svg-converter` | `workflow=shopify` | Add allowlisted context | Test browser fragment preservation | blocked |
| `/logo-to-svg-for-etsy` | `/logo-to-svg-converter` | `workflow=etsy` | Same | Same | blocked |
| `/logo-to-svg-for-canva` | `/logo-to-svg-converter` | `workflow=canva` | Same | Same | blocked |
| `/logo-to-svg-for-glowforge` | `/logo-to-svg-converter` | `workflow=glowforge` | Same; must not enable laser post-processing | Same | blocked |
| `/logo-to-svg-for-silhouette` | `/logo-to-svg-converter` | `workflow=silhouette` | Same | Same | blocked |
| `/svg-to-png-for-shopify` | `/svg-to-png-converter` | `workflow=shopify` | Add allowlisted context; preserve supported exporter params | Test browser fragment preservation | blocked |
| `/svg-to-png-for-etsy` | `/svg-to-png-converter` | `workflow=etsy` | Same | Same | blocked |
| `/svg-to-png-for-printify` | `/svg-to-png-converter` | `workflow=printify` | Same | Same | blocked |
| `/svg-to-png-for-printful` | `/svg-to-png-converter` | `workflow=printful` | Same | Same | blocked |
| `/sticker-to-png-for-printing` | `/svg-to-png-converter` | `workflow=sticker-print` | Same | Same | blocked |
| `/svg-to-transparent-png-for-printing` | `/svg-to-png-converter` | `workflow=transparent-print` | Same; context must retain transparent default | Same | blocked |
| `/svg-to-png-for-canva` | `/svg-to-png-converter` | `workflow=canva` | Same | Same | blocked |
| `/svg-to-png-for-figma` | `/svg-to-png-converter` | `workflow=figma` | Same | Same | blocked |
| `/svg-resizer-for-shopify` | `/svg-resize-and-scale-editor` | `workflow=shopify` | Add allowlisted context; preserve supported sizing params | Test browser fragment preservation | blocked |
| `/svg-resizer-for-etsy` | `/svg-resize-and-scale-editor` | `workflow=etsy` | Same | Same | blocked |
| `/svg-resizer-for-glowforge` | `/svg-resize-and-scale-editor` | `workflow=glowforge` | Same | Same | blocked |
| `/svg-resizer-for-silhouette` | `/svg-resize-and-scale-editor` | `workflow=silhouette` | Same | Same | blocked |
| `/svg-resizer-for-canva` | `/svg-resize-and-scale-editor` | `workflow=canva` | Same | Same | blocked |
| `/svg-resizer-for-figma` | `/svg-resize-and-scale-editor` | `workflow=figma` | Same | Same | blocked |

No redirect is proposed for Glowforge/laser PNG, Silhouette PNG, Cricut/code/Base64/layered, sketch/drawing, dimensions/file-size, or JPG/JPEG routes.

### 9.3 Canonical, schema, sitemap, and crawler sequencing

- During capability preparation, every source stays self-canonical and indexable exactly as today.
- A destination must never canonicalize to a source.
- A source must not be removed from the XML sitemap before its 301 is deployed; otherwise there is an inconsistent pre-deployment gap.
- In the redirect rollout commit, source manifest status, XML sitemap removal, HTML sitemap/internal-link removal outside All Tools, route loader, and tests change together.
- BreadcrumbList, WebPage/SoftwareApplication URLs, Open Graph URLs, and visible breadcrumbs on the destination use the retained URL. Context parameters do not become canonical URLs.
- Historical source URLs must return one direct 301 to the retained URL/context, never through an existing alias.
- A crawler test must verify status, `Location`, destination 200, destination self-canonical, source absence from XML, source non-indexable manifest policy, and no internal links outside the explicitly excluded All Tools section.
- Because All Tools is excluded, any candidate linked there remains unsafe to redirect under this plan. Keep that source route rendered; do not propose an All Tools change as a consolidation prerequisite.

### 9.4 Rollback

Every family gets two independent rollback points:

1. **Capability/content preparation rollback:** revert the family preparation commit; all public routes still render normally.
2. **Redirect rollout rollback:** revert only the family redirect/manifest/sitemap/internal-link commit; source implementations are still present and can resume rendering.

Do not delete old route implementations in either commit. After a production observation period, a separate cleanup may remove dead source component files only if direct historical URLs, logs, crawler behavior, and rollback policy are approved.

Sources: existing redirect route files under `app/routes/`; `app/routes.ts`; `app/data/routeManifest.ts`; `public/sitemap.xml`; `scripts/route-coverage-audit.mjs`; `scripts/route-http-smoke.mjs`; `scripts/schema-audit.mjs`; `scripts/navigation-audit.mjs`.

## 10. Sitemap and internal-link transition plan

For an approved family:

1. Inventory every source href in route guides, related links, sitemap page data, primary navigation, footer/navigation sections, schema, tests, and docs.
2. Replace contextual links with the retained URL plus allowlisted context only where the context is required to preserve the user's next workflow.
3. Use the plain retained URL for generic links.
4. Do not link internally to the future redirecting source.
5. Remove the source from `public/sitemap.xml` and change its manifest sitemap policy to `exclude` in the redirect rollout commit.
6. Keep the destination's existing XML entry exactly once.
7. Verify no source or context-query URL is added to XML.
8. Verify HTML sitemap group descriptions remain understandable after source removal.
9. Re-run navigation, route coverage, schema, SEO, route HTTP, and redirect-chain checks.

The All Tools implementation is not modified by this plan. If it contains a candidate source, that source stays rendered and is excluded from redirect rollout.

Sources: `app/client/components/navigation/OtherToolsLinks.tsx`; `app/client/components/navigation/toolNavSections.ts`; `app/routes/sitemap.tsx`; `public/sitemap.xml`; `app/data/routeManifest.ts`.

## 11. Family-by-family implementation plans

### 11.1 SVG-to-PNG

1. Snapshot all nine route contexts, visible content, schema, default settings, accepted input, filename, and outputs.
2. Add a family-local typed context map to the base component; first resolve current pathnames only.
3. Move each current route-specific content branch into the map without rewriting text.
4. Add query-context resolution behind tests while all wrapper routes still render.
5. Add full transparent, partial-alpha, opaque, external-resource-error, filter/font, non-square, and large-dimension fixtures.
6. Prove pixels, dimensions, filenames, preview/download identity, reset/second upload, desktop/mobile, and schema.
7. Stop and review. Do not redirect in the preparation commit.
8. Only after approval, and only for sources not linked from the excluded All Tools section, perform one family redirect rollout.

Stop on any pixel/hash difference, filename change, accepted-input change, context mismatch, unsupported SVG rendering difference, schema mismatch, or mobile overflow.

### 11.2 SVG resize

1. Snapshot all seven contexts and every sizing mode.
2. Add a family-local context map without changing serialization.
3. Prove non-square SVGs, non-zero viewBox origins, strokes, percentage/physical units, responsive mode, all `preserveAspectRatio` values, style stripping, copy/download, filename, reset, and second upload.
4. Prepare source content exactly; keep routes.
5. Redirect only in a later approved commit.

Stop on any byte/semantic difference, path/stroke mutation, unit/viewBox change, filename change, or content loss.

### 11.3 General PNG wrappers

Split into two sub-batches:

- **Simple:** Canva, Figma, transparent. Add context and prove the current base validator/presets/default/output/history/filename.
- **Marketplace:** Etsy and Shopify. Preserve narrower validator, exact ordered presets, Shopify display mapping, default, history identity, and filename. Do not reuse the simple context if it broadens behavior.

Glowforge, laser, Silhouette, and Cricut routes are excluded. Stop on any SVG, active/pinned/history, input-error, filename, or editing difference.

### 11.4 General logo wrappers

Baseline Shopify, Etsy, Canva, Glowforge, and Silhouette against the base across transparent/opaque, simple/complex, partial-alpha, one-color/multicolor logos and every route preset. Preserve context copy and current general conversion behavior. Do not absorb Cricut, layered, or favicon outputs. Stop if any wrapper is not exact or if platform guidance implies capabilities the current route lacks.

### 11.5 Favicon and ICO

1. Establish `/image-to-favicon-generator` ownership without changing output.
2. Add format and platform contexts.
3. Test SVG and raster sources, alpha/background, padding, all default/custom sizes, platform groups, only-16, manifests, snippets, filenames, individual/ICO/all/ZIP, clear, second input, failure cleanup, mobile.
4. Compare ZIP entry manifests and ICO directories; raw ZIP bytes may differ only for allowed archive metadata.
5. Redirect only after product approval of the destination identity and all content/schema transitions.

Stop on any package-entry, ICO pixel/directory, snippet, manifest, filename, input, cleanup, or route-context difference.

### 11.6 Cricut, code, Base64, and layered routes

Do not plan redirects. A future isolated prototype may extract pure, tested source-detection or validation helpers from code/Base64 routes. Another isolated layered milestone may compare shared layered implementations. Preserve each public route throughout. Stop if helper extraction changes payloads, error messages, parser precedence, palette/layer order, history, memory, or output.

### 11.7 JPG and JPEG

Do not implement until an owner approves a canonical winner based on product and traffic evidence. Then:

1. Snapshot every accepted MIME/extension and error.
2. Diff exact ordered presets/defaults/effective values.
3. Exercise both trace methods, all editing/history actions, concurrent completion, reset, and second upload.
4. Decide whether destination behavior should become the union while preserving context or whether both routes should remain.
5. Preserve source-specific filenames and guidance via context if redirecting.

Any ambiguity leaves both routes self-canonical.

### 11.8 Dimensions and file-size

Keep both. Add only cross-route regression tests if a shared parsing helper changes. Do not add a combined tab in a consolidation batch.

## 12. Regression gates

### 12.1 Mandatory gate for every family

| Dimension | Gate |
| --- | --- |
| Deterministic fixtures | Use the regression plan's transparent, opaque, partial-alpha, multicolor, sketch, logo, non-square/viewBox, strokes, SVG/code/Base64, and package fixtures. Add only small generated temporary fixtures when a capability is uncovered. |
| Presets | Compare exact ordered IDs, labels, descriptions/help, defaults, pinned/active behavior, effective values, payload values, history ID/label, and output hashes. |
| Advanced settings | Cover every visible and hidden export-affecting setting, pairwise critical interactions, reset, and unchanged defaults. |
| SVG | Require byte identity when deterministic; otherwise normalized XML plus element/path/viewBox/fill/stroke/transform counts and declared allowed differences. Do not normalize path data, transforms, order, precision, or geometry away. |
| Raster | Decode and compare width, height, RGBA pixels, alpha counts, and pixel hash. Exercise transparent, partial-alpha, and solid backgrounds. |
| ZIP/ICO | Compare sorted entry manifest, per-entry size/hash, decoded PNG pixels, ICO directory sizes/entries/pixels, manifest/browserconfig text, and HTML snippet. Treat only documented archive metadata as nondeterministic. |
| Inputs/errors | Test every accepted MIME/extension/signature, mismatches, size/dimension limits, invalid data, and source-specific error messages. |
| Preview/actions | Preview, fullscreen, copy content hash, download initiation and target hash/name, export/package actions, editing/update-preview, and selecting old/new history items. |
| Lifecycle | Reset, clear semantics, second upload, stale completion, duplicate completion, intentional concurrency, Blob URL/worker cleanup, unmount, and port/process cleanup. |
| Responsive | Desktop Chromium plus mobile at 390 px minimum; critical converter layout at the existing responsive widths. No overflow or inaccessible controls. |
| Identity | H1, visible breadcrumb, BreadcrumbList, title, description, Open Graph, canonical, route context, default label, and history label. |
| Transition | Source 301, exact `Location`, query handling, fragment browser test, no chain, destination 200/self-canonical, source absent XML/internal links, source manifest non-indexable, back/forward behavior. |

### 12.2 Reusable current scripts

- `scripts/converter-parity-audit.mjs`: output/pixel/package comparison base.
- `scripts/preset-identity-remediation-audit.mjs`: exact reachable preset identity.
- `scripts/jpeg-active-result-remediation-audit.mjs`: result ownership/concurrency semantics.
- `scripts/client-lifecycle-audit.mjs`: stale/reset/second-upload/cleanup.
- `scripts/output-card-ux-audit.mjs` and conversion action smokes: output actions.
- `scripts/schema-audit.mjs`, `scripts/seo-audit.mjs`, `scripts/route-coverage-audit.mjs`, `scripts/route-http-smoke.mjs`, and `scripts/navigation-audit.mjs`: route transition gates.
- `scripts/public-content-schema-remediation-audit.mjs`: public copy and registered breadcrumb target protections.

Focused tests still required:

- family-local context descriptor completeness and unknown-context fallback;
- context-specific validator/default/preset/filename behavior;
- all candidate source-to-destination redirect mappings and no-chain proof;
- complete SVG-to-PNG and resizer setting combinations;
- logo platform wrapper parity;
- favicon format/platform contexts and failure cleanup;
- exact internal-link inventory excluding, but reporting, the All Tools blocker.

Do not create a permanent golden-output archive. Generate deterministic fixtures and summaries in the OS temporary directory or an ignored repository path and clean them in `finally`.

## 13. Risk register

| ID | Risk | Likelihood/impact | Detection | Mitigation | Stop condition |
| --- | --- | --- | --- | --- | --- |
| `CCR-01` | Output-equal fixture hides input/preset/workflow differences | High/high | Full matrix cells and broader fixtures | Never approve from hash equality alone | Any partial/inconclusive material cell |
| `CCR-02` | Route context changes default, label, validator, or filename | Medium/high | Direct source versus destination-context browser/action comparison | Typed family descriptor; exact snapshots | Any mismatch |
| `CCR-03` | Preset collision or ambiguous history label returns | Medium/high | Preset identity audit and browser active/pin/history checks | Unique IDs; submit exact ID/label | Duplicate reachable ID or wrong label |
| `CCR-04` | New result ownership/stale completion regression | Low/high | JPEG ownership and lifecycle tests | Preserve stable result IDs/generations | Wrong preview/copy/download/editor target |
| `CCR-05` | Laser/layered/package post-processing is lost | Medium/high | Path/pixel/package comparisons | Keep distinct families; do not route through general converters | Any output or package difference |
| `CCR-06` | Raw ZIP nondeterminism is mistaken for content change | Medium/medium | Entry/ICO comparison | Classify archive metadata only | Entry/payload difference |
| `CCR-07` | Redirect chain or canonical/sitemap sequencing error | Medium/high | HTTP/schema/route coverage/navigation audits | Atomic family rollout | Chain, wrong canonical, source left XML |
| `CCR-08` | Useful platform/format content disappears | Medium/medium | Content module inventory and rendered assertions | Migrate exact content first | Missing unique guidance/FAQ/use case |
| `CCR-09` | A candidate source is linked from the excluded All Tools section | High/medium | Internal-link audit | Keep that source route rendered and out of redirect rollout | Redirect planned for a linked source |
| `CCR-10` | Query context becomes indexable duplicate state | Medium/medium | Canonical/SEO crawler tests | Query-free destination canonical; no context URLs in sitemap | Context URL canonical/indexing drift |
| `CCR-11` | Context/preset/result registry grows without bound | Low/high | Memory/lifecycle audits | Static allowlists and bounded history only | Unbounded map/list or retained Blob/worker |
| `CCR-12` | Wrapper source is deleted before rollback confidence | Medium/high | Commit review | Keep implementation through observation period | Redirect and deletion in same initial rollout |
| `CCR-13` | JPG/JPEG winner selected from repository inference | Medium/high | Approval record | Require product/traffic decision | No explicit approval |
| `CCR-14` | External SVG resources/fonts make browser raster output differ | Medium/medium | Dedicated fixtures/errors across browsers | Preserve current errors/limitations; test supported cases | Unexplained pixel difference |

## 14. Rollback strategy

Rollback boundaries are family-scoped and commit-scoped:

1. **Regression-gate commit:** tests/audits only. Revert independently if the harness is defective; it must not change production.
2. **Capability-preparation commit:** destination context, content modules, and schema behavior while every source route still renders. Revert without touching routing or sitemap.
3. **Redirect-rollout commit:** source 301, manifest indexing policy, sitemap, schema, and internal links outside All Tools. Revert this commit to restore source rendering because source implementations remain present.
4. **Deferred dead-code cleanup commit:** only after production observation and separate approval. This is never combined with initial redirects.

Rollback must restore a coherent set: route loader, manifest, XML/HTML sitemap, metadata/schema references, and internal links. Do not roll back only the route loader while leaving the source excluded from sitemap or marked as a redirect in the manifest.

Family rollback labels used in the matrix map to these boundaries:

- `RB-SVGPNG`, `RB-resize`, `RB-PNG-simple`, `RB-PNG-marketplace`, `RB-logo-platform`, and `RB-favicon` are independent.
- `RB-Cricut-*`, `RB-code`, `RB-base64`, `RB-layered`, `RB-sketch`, `RB-drawing`, and `RB-JPGJPEG` remain planning boundaries only because no redirect implementation is recommended.
- `RB-self` means keep the route and revert any accidental shared-helper regression.

Production rollback verification must re-run the same family output baselines, route HTTP checks, canonical/schema checks, navigation audit, memory/lifecycle checks when converter state was touched, and clean-process checks.

## 15. Recommended implementation order and commit boundaries

Each row is one coherent batch. Do not combine unrelated high-risk families.

| Batch | Exact routes | Likely files | Prerequisites | Production behavior allowed to change | Behavior forbidden to change | Tests and browser QA | Output comparison | Stop conditions | Commit/rollback boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. SVG-to-PNG preservation gates and context preparation | Base plus Shopify, Etsy, Printify, Printful, sticker printing, transparent printing, Canva, Figma | `app/routes/svg-to-png-converter.tsx`; eight wrapper files only if route-local wiring is needed; family-local context module; `OtherToolsLinks.tsx` route-guide data only; `scripts/converter-parity-audit.mjs`; schema/content/route tests | Current nine-route parity baseline; approved context IDs | Context can be selected on retained page and wrappers without changing their rendered behavior | Pixels, dimensions, alpha/compositing, filenames, accepted input, defaults, schema identity, public copy meaning, All Tools | Nine routes desktop/mobile; all settings; preview/fullscreen/download/reset/second input; schema | Byte/pixel equality for broad fixture set | Any output/content/schema/default/filename mismatch; All Tools diff | One preparation commit; revert leaves all routes intact |
| 2. SVG-to-PNG redirect rollout | Eligible source wrappers not linked from All Tools | `app/routes.ts`; eligible source route loaders; `app/data/routeManifest.ts`; `public/sitemap.xml`; `app/routes/sitemap.tsx`; internal links outside All Tools; route/schema/SEO tests | Batch 1 green; source context URLs proven; source absent from All Tools; explicit approval | Only GET navigation/canonical destination changes | Converter/output/context/content loss, chain, All Tools change | Direct source desktop/mobile, back/forward, query/fragment, crawler/HTTP | Re-run Batch 1 at destination contexts | Source appears in All Tools; source is not one-hop 301; any other internal source link; wrong canonical/sitemap | Separate rollout commit; retain source implementation |
| 3. SVG resizer preservation gates/context | Base plus Shopify, Etsy, Glowforge, Silhouette, Canva, Figma | `app/routes/svg-resize-and-scale-editor.tsx`; family context module; wrapper/meta/content tests | Seven-route baseline | Context selection only | Serialized SVG, viewBox, attributes, strokes, filename, settings/defaults | Seven routes desktop/mobile; every sizing mode; copy/download/reset/second input | Byte/normalized SVG equality across non-square/unit/stroke fixtures | Any serialization or content/schema mismatch | Family preparation commit |
| 4. SVG resizer redirect rollout | Eligible wrappers not linked from All Tools | Route loaders/registration, manifest, sitemap, internal links outside All Tools, tests | Batch 3 green; source absent from All Tools; approval | GET destination only | Editor behavior/output/content loss | HTTP/crawler/browser transition suite | Re-run Batch 3 | Source appears in All Tools or any chain/canonical/sitemap/internal-link failure | Separate rollout commit |
| 5. General PNG simple wrappers | Canva, Figma, transparent to base; **no redirect in preparation** | `png-to-svg-converter.tsx`; three wrappers/context map; route-guide data; preset/parity/lifecycle tests | Exact base/wrapper baselines | Context display/content only | Validator, presets/default, identity/history, output, filename, settings | Four routes desktop/mobile; every relevant preset; active/pin/history/edit/copy/download/reset/second upload | SVG bytes/normalized/path structure | Any payload/output/history/content difference | `RB-PNG-simple` |
| 6. PNG marketplace wrappers | Etsy and Shopify to base candidate; no redirect initially | `png-to-svg-converter.tsx`; `png-to-svg-for-etsy.tsx`; Shopify wrapper; bounded context/validator policy; preset tests | Batch 5; exact Etsy/Shopify input and preset baselines | Destination can reproduce current contexts | Accepted-input broadening/narrowing, default/label/value/order change, output/filename/history change | Base/Etsy/Shopify desktop/mobile; valid/invalid formats; all presets; history/editing/actions | Default and all differing preset hashes | Any mismatch or broad refactor | `RB-PNG-marketplace` |
| 7. PNG wrapper redirect rollout | Eligible Canva, Figma, transparent, Etsy, or Shopify sources not linked from All Tools | Route loaders/manifest/sitemap/internal links outside All Tools/tests | Batches 5-6 green; each source absent from All Tools; approval | GET destination only | Glowforge/laser/Silhouette/Cricut changes | Transition suite and full PNG regressions | Re-run all baselines | Any source appears in All Tools or unintended route is included | Separate rollout commit |
| 8. General logo platform preparation | Base plus Shopify, Etsy, Canva, Glowforge, Silhouette | `logo-to-svg-converter.tsx`; five wrappers/context; guide/meta tests; parity/preset tests | Broad logo fixture baseline | Context display/content only | Presets/defaults, general output, filename, history, no new laser processing | Six routes desktop/mobile; transparent/opaque/complex logos; all presets/actions | Byte/semantic/path equality | Any wrapper not exact or context overclaim | `RB-logo-platform` |
| 9. Logo wrapper redirect rollout | Eligible platform wrappers not linked from All Tools | Routing/manifest/sitemap/internal links outside All Tools/tests | Batch 8 green; each source absent from All Tools; approval | GET destination only | Cricut/layered/favicon changes | Transition suite | Re-run Batch 8 | Source appears in All Tools, cross-family change, or chain | Separate rollout commit |
| 10. Favicon ownership and preservation | All nine favicon/ICO routes; retained image route | `svg-to-favicon-generator.tsx`; `image-to-favicon-generator.tsx`; favicon context/route-meta/guide modules; package/parity/schema tests | Product approval of destination; complete package baselines | Component ownership and context presentation only | Inputs, settings, package entries/pixels, snippets, filenames, clear/second input | Nine routes desktop/mobile; all source formats/settings/actions/failures | Entry, PNG pixel, ICO directory/pixel, manifest/snippet equality | Any package/content/cleanup difference | `RB-favicon` preparation |
| 11. Favicon redirect rollout | Eligible sources not linked from All Tools | Routing/loaders/manifest/sitemap/internal links outside All Tools/tests | Batch 10 green; each source absent from All Tools; approval | GET destination only | Package behavior and contexts | Transition and package suite | Re-run Batch 10 | Source appears in All Tools or any chain/context/package error | Separate rollout commit |
| 12. Cricut/code/parser prototype | No public route merge; code and Base64 helper candidates only | Pure helper module plus existing route tests | Approved isolated scope | Internal pure helper reuse | Parser precedence, errors, outputs, history, reports, memory | All code/Base64 source modes desktop/mobile | Exact SVG/report hashes | Any behavioral difference | Prototype commit or abandon |
| 13. JPG/JPEG decision and preparation | `/jpg-to-svg-converter`, `/jpeg-to-svg-converter` | Both route sources; optional bounded context; ownership/preset/parity tests | Explicit winner approval; complete input/preset inventory | Only destination additive capability after approval | Existing route behavior before redirect; output/ownership/history/filename | Both routes, every format/preset, controlled concurrency, desktop/mobile | Byte/semantic/action target equality | Missing approval or any mismatch | `RB-JPGJPEG` preparation |
| 14. JPG/JPEG rollout, if approved | One exact source, only if it is not linked from All Tools | Source loader, routes/manifest/sitemap/internal links outside All Tools/tests | Batch 13 green; source absent from All Tools | GET destination only | Any lost accepted input/preset/content/action | Transition suite | Re-run full trace suite | Source appears in All Tools or any parity gap | Separate rollout commit |
| 15. Dimensions/file-size decision | Keep both; tests only if shared parser changes | Inspector sources/tests | Separate approved product request | None by default | Route merge or tab without requirements | Existing route utility tests | Exact reports/downloads | Any attempt to redirect | No consolidation commit |
| 16. Final site-wide validation | All approved family transitions | Audits/tests only | All selected rollouts complete | None | New product behavior | Full route/SEO/schema/nav/build/test/browser gate | All family baselines | Any regression | Final validation commit only if test/docs changes are needed |

The recommended order prioritizes the lowest-risk, already-shared, output-tested client exporter. It does not prioritize family size or search opportunity.

## 16. Routes currently safe to redirect

**None.**

The existing 28 redirect aliases are already implemented and are outside the new decision set. They should continue to pass route and chain audits, but they do not make any current indexable wrapper safe.

To move a source into this section, every preservation matrix cell must be `yes`, its exact context must work on the destination, its content must be retained, transition audits must pass, and the source must not be linked from the excluded All Tools section.

## 17. Routes currently not safe to redirect

### Potential future candidates, currently blocked

- Favicon/ICO: `/svg-to-favicon-generator`, `/png-to-favicon-generator`, `/jpg-to-favicon-generator`, `/logo-to-favicon-generator`, `/svg-to-ico-converter`, `/png-to-ico-converter`, `/svg-to-favicon-for-shopify`, `/logo-to-favicon-for-shopify`.
- PNG wrappers: `/png-to-svg-for-canva`, `/png-to-svg-for-figma`, `/transparent-png-to-svg-converter`, `/png-to-svg-for-etsy`, `/png-to-svg-for-shopify`.
- Logo wrappers: `/logo-to-svg-for-shopify`, `/logo-to-svg-for-etsy`, `/logo-to-svg-for-canva`, `/logo-to-svg-for-glowforge`, `/logo-to-svg-for-silhouette`.
- SVG-to-PNG: `/svg-to-png-for-shopify`, `/svg-to-png-for-etsy`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful`, `/sticker-to-png-for-printing`, `/svg-to-transparent-png-for-printing`, `/svg-to-png-for-canva`, `/svg-to-png-for-figma`.
- Resizer: `/svg-resizer-for-shopify`, `/svg-resizer-for-etsy`, `/svg-resizer-for-glowforge`, `/svg-resizer-for-silhouette`, `/svg-resizer-for-canva`, `/svg-resizer-for-figma`.
- JPG/JPEG: both remain unsafe until a winner is approved and the losing route passes complete parity.

### Routes that should remain separate, not merely blocked

- `/png-to-svg-for-glowforge`, `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-silhouette`.
- All Cricut format, purpose, Print Then Cut, sticker, vinyl, single-output, and layered routes.
- `/code-to-svg-for-cricut`, `/base64-to-svg-for-cricut`, `/base64-to-svg`.
- `/sketch-to-svg-converter`, `/drawing-to-svg-converter`, their Cricut variants, line-art, and B/W tools.
- `/svg-dimensions-inspector`, `/svg-file-size-inspector`.
- Logo Cricut, layered-logo, and favicon-logo output families relative to general logo tracing.

## 18. Open decisions requiring approval

1. **Favicon retained identity:** approve `/image-to-favicon-generator` over the current source component identity `/svg-to-favicon-generator`.
2. **All Tools scope boundary:** approve the rule that a candidate linked from All Tools remains separate. This plan recommends that rule and does not propose changing the section.
3. **Context URL contract:** approve allowlisted query contexts, their names, and whether generic inbound links should include them.
4. **Filename policy:** where wrappers currently inherit a base/template filename, decide whether consolidation must preserve that exact current filename or may adopt a route-context filename. Default position is exact preservation.
5. **Logo Glowforge intent:** confirm that its current general logo conversion should remain unchanged; do not assume it should gain laser processing.
6. **JPG/JPEG canonical winner:** provide product/traffic evidence and a user-facing rationale. No repository-only winner is recommended.
7. **PNG Etsy/Shopify accepted-input policy:** approve exact context-specific enforcement rather than silently broadening to base PNG/WebP acceptance.
8. **Source implementation retention period:** approve the production observation window before dead code can be removed.
9. **Crawler/SEO observation gate:** define the production monitoring evidence required after each family redirect. External keyword research is not part of this plan.
10. **Dimensions/file-size:** confirm the default decision to keep both separate; no combined tab is planned.

## 19. Recommended next implementation batch

**Recommended next batch: SVG-to-PNG preservation gates and route-context preparation, with no redirects.**

Exact scope:

- `/svg-to-png-converter`
- `/svg-to-png-for-shopify`
- `/svg-to-png-for-etsy`
- `/svg-to-png-for-printify`
- `/svg-to-png-for-printful`
- `/sticker-to-png-for-printing`
- `/svg-to-transparent-png-for-printing`
- `/svg-to-png-for-canva`
- `/svg-to-png-for-figma`

The batch should:

1. Add the family-local bounded context descriptor.
2. Preserve current route display/content from pathname while adding a tested destination query-context path.
3. Add full setting, alpha, filename, preview, download, reset, second-input, mobile, metadata, and schema gates.
4. Reuse the production converter and deterministic parity harness.
5. Leave route registration, redirect behavior, canonicals, sitemap, metadata values, and internal links unchanged.
6. Stop before redirect rollout and request a separate adversarial review.

Why this is safest: the converter is already one shared client-only component, nine outputs matched byte-for-byte and pixel-for-pixel for the tested fixture/settings, there is no preset or trace-history state, and the remaining preservation work is localized. The evidence does not make redirects safe; it makes preservation preparation lower risk than the other families.

### Planning-pass validation record

This document was produced from the current post-remediation branch by reconciling route registration, manifest policy, wrapper imports, route-local validators/defaults, converter components, metadata helpers, route guide sources, and the completed runtime/parity/remediation audits. No browser capture or generated planning script is required for the document.

The implementation owner must repeat current-source inspection immediately before each batch because this plan is a point-in-time architecture record, not a substitute for production code review.
