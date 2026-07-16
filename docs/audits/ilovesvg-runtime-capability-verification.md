# iLoveSVG runtime capability verification

Audit date: 2026-07-13

Branch: `milestone/site-inventory-capability-audit`

Application: iLoveSVG only

Mode: runtime audit; no product code, content, metadata, route, preset, or setting changes

Evidence precedence: Sections 1-21 preserve the first browser-pass record. Section 22 supersedes the first pass where deterministic output or state evidence resolved an earlier question. Section 23 is the final milestone verdict.

## 1. Executive summary

This pass verified the local application at `http://localhost:3000` with the in-app browser and the repository's existing headless-browser smoke harness. The runtime route system still reports 157 registered routes, 156 public routes, 28 redirects, and 125 XML-sitemap entries. The wrong-application sentinel did not appear. Sixty public routes were opened directly or exercised through a production-path browser smoke; representative desktop and mobile states were inspected at 1440 x 1000 and 390 x 844, and 27 evidence screenshots were archived under `docs/audits/runtime-verification/`.

The most important verified facts are:

- The favicon/ICO routes tested use the same generator controls and, for the built-in example, generate the same 24-file package with the same displayed filenames and sizes. Their H1s, titles, and guidance remain route-specific, so runtime functional parity is not a content-preservation plan.
- The favicon family visibly links to the unregistered `/svg-favicon-generator`; the same invalid URL appears in BreadcrumbList schema and returns 404. The stroke and flip/rotate utilities likewise expose invalid visible and schema breadcrumb destinations that return 404.
- PNG platform wrappers are not behaviorally identical at first render. `/png-to-svg-for-shopify` visibly selects `Etsy PNG - Accurate trace (default)`, while the base, Canva, and Figma routes select `Lineart - Accurate (default)` and Glowforge selects a laser-cut preset.
- Duplicate preset IDs are a real interaction risk. Selecting the local `icon-bold` or `logo-smooth` card makes both same-ID cards appear pressed even though their effective settings differ. `/webp-to-svg-for-cricut` renders both `cricut-clean-cut` cards pressed at initial state.
- The three routes with appended display preset arrays accept the clicked display preset directly. Added presets on print-then-cut, stickers, and black-and-white routes became the sole active card. No display-to-conversion mismatch was reproduced before upload; output parity for those non-default cards remains unmeasured.
- `/svg-dimensions-inspector` and `/svg-file-size-inspector` are distinct. The former reports sizing/viewBox repair concerns; the latter reports bytes/minified size and enables Copy stats and Download SVG.
- `/base64-to-svg`, `/code-to-svg-for-cricut`, `/emoji-to-svg-converter`, and `/text-to-svg-converter` have unique input and output workflows that must be preserved. Their built-in inputs produced actual SVG results and enabled their route-specific editing/copy/download actions.
- The sketch rental/budget disclaimer is always-visible lower-page content, not a hidden or conditional string.
- `PNG to SVG keyword cluster`, `JPG to SVG keyword cluster`, `search intent`, `Additional SEO-safe converter...`, and `Expanded SVG workflow routes` are rendered public content.
- The SVG-to-PNG background control exposes `Transparent` and `Solid color`; choosing solid reveals a `Background color` input. The runtime UI consistently describes this as canvas/raster-export background behavior. No artwork-fill recolor control is rendered.
- The repository browser harness passed Potrace, VTracer, centerline, preview, copy, download initiation, and update-preview flows on representative raster routes. The deterministic follow-up proved JPG/JPEG production-action byte identity for four equal-input/equal-setting scenarios; complete workflow parity remains blocked by a confirmed JPEG VTracer active-output/history mismatch whose occurrence was captured once but whose timing was not reproduced in the final clean retry.

No route is currently proven safe to consolidate. Functional overlap is substantial, but every candidate still has unresolved content, metadata/schema transition, preset, input, or output-preservation work.

## 2. Environment and commands

The canonical local application was started from the repository root with:

```text
npm run dev
```

The server reported `Server is running on http://0.0.0.0:3000`; all browser and HTTP checks targeted `http://localhost:3000`. Before startup, ports 3000, 4175, 4186, and 4191 were checked and no stale `node server.js` process was listening. The running page had the expected iLoveSVG title, H1, converter, navigation, and 123-tool mobile menu; the wrong-app sentinel was absent.

Runtime/read-only commands included:

```text
node scripts/schema-audit.mjs
node scripts/route-coverage-audit.mjs
npm run test:seo
npm run test:routes
npm run test:navigation-browser
npm run test:stage1-route-presets
npm run test:converter-route-parity
node scripts/hybrid-browser-smoke.mjs  # route-filtered runs
```

The hybrid harness used the existing generated local fixtures and production UI/action paths. Route-filtered reports were temporary validation artifacts and are not part of this audit deliverable.

## 3. Routes tested

The following 60 public routes were opened in the in-app browser, exercised by the repository browser harness, or both:

- Home: `/`.
- Favicon/ICO: `/svg-to-favicon-generator`, `/image-to-favicon-generator`, `/svg-to-favicon-for-shopify`, `/svg-to-ico-converter`, `/png-to-ico-converter`, `/png-to-favicon-generator`, `/jpg-to-favicon-generator`, `/logo-to-favicon-generator`, `/logo-to-favicon-for-shopify`.
- Breadcrumb utilities: `/svg-stroke-width-editor`, `/svg-flip-and-rotate-editor`.
- PNG/platform: `/png-to-svg-converter`, `/png-to-svg-for-shopify`, `/png-to-svg-for-canva`, `/png-to-svg-for-figma`, `/png-to-svg-for-etsy`, `/transparent-png-to-svg-converter`, `/png-to-svg-for-glowforge`.
- SVG-to-PNG: `/svg-to-png-converter`, `/svg-to-png-for-shopify`, `/svg-to-png-for-etsy`, `/svg-to-png-for-canva`, `/svg-to-png-for-figma`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful`, `/sticker-to-png-for-printing`, `/svg-to-transparent-png-for-printing`.
- Sketch/drawing: `/sketch-to-svg-converter`, `/drawing-to-svg-converter`, `/sketch-to-svg-for-cricut`, `/drawing-to-svg-for-cricut`.
- JPG/JPEG: `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`.
- Resize/inspect: `/svg-resize-and-scale-editor`, `/svg-resizer-for-canva`, `/svg-resizer-for-shopify`, `/svg-resizer-for-etsy`, `/svg-resizer-for-figma`, `/svg-resizer-for-glowforge`, `/svg-resizer-for-silhouette`, `/svg-dimensions-inspector`, `/svg-file-size-inspector`.
- Cricut/code/Base64: `/cricut-svg-converter`, `/code-to-svg-for-cricut`, `/base64-to-svg`, `/base64-to-svg-for-cricut`, `/jpeg-to-svg-for-cricut`, `/jpg-to-svg-for-cricut`, `/png-to-svg-for-cricut`, `/webp-to-svg-for-cricut`, `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-cricut-stickers`.
- Retained routes: `/emoji-to-svg-converter`, `/black-and-white-image-to-svg-converter`, `/image-to-svg-outline`, `/text-to-svg-converter`, `/logo-to-svg-converter`, `/icon-to-svg-converter`.
- Directory: `/sitemap`.

The three rendered invalid breadcrumb targets were also requested directly and returned 404: `/svg-favicon-generator`, `/svg-stroke-width-adjust`, and `/svg-flip-rotate-editor`.

## 4. Desktop/mobile coverage

| Coverage | Routes/states | Result |
| --- | --- | --- |
| Desktop 1440 x 1000 | All 60 routes at initial or relevant interaction state | Correct iLoveSVG app and route H1s rendered; no in-app console warnings/errors |
| Mobile 390 x 844 | `/`, favicon, PNG base/Shopify, SVG-to-PNG, sketch, JPG, JPEG, resize, both inspectors, Cricut, code, Base64, emoji, black-and-white, outline, text | No horizontal overflow in the checked initial states; route controls remained reachable |
| Responsive harness | `/svg-to-png-converter` at 320, 360, 390, 430, 768, 1024, and 1280 px | Passed; input/output layout found at every width, no width-specific failures |
| Mobile navigation | `/` at 390 px | Menu opened after hydration, rendered 123 tools and search UI |
| Result states | Favicon, Base64, code-to-Cricut, emoji, text-to-SVG, both inspectors | Result/output actions rendered and remained usable at tested viewport |

The repository `test:navigation-browser` script failed twice at 320 px because it clicks the menu before hydration and then waits for a dialog that never opened. Manual runtime verification after a 900 ms hydration wait opened the same dialog successfully. This is an audit-harness race, not proof of a product navigation failure.

## 5. First-pass runtime capability matrix

This matrix records the initial browser pass. Section 22 supersedes cells that were then marked untested or unresolved.

`Server payload changes` is reported only where the production browser harness observed a different engine/action path. A visible setting is not called output-affecting merely because it exists.

| Route | Control/preset | Visible state | Default value | Interaction type | Preview changes | Exported output changes | Server payload changes | Client-only behavior | Verified working | Misleading label risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Lineart default plus expanded trace presets | Initial and expanded | Lineart - Accurate | preset/click | yes in harness | yes | Potrace/VTracer/centerline paths observed | output edit/copy/download | yes | internal engine warnings | Four production scenarios passed; history/output card present |
| `/png-to-svg-converter` | default, VTracer, Potrace, centerline presets | Initial/expanded/result in harness | Lineart - Accurate | preset/click | yes | yes | engine changed as selected | output edit/copy/download | yes | public keyword-cluster and engine text | All four scenarios passed |
| `/png-to-svg-for-shopify` | route default | initial desktop/mobile | Etsy PNG - Accurate trace | preset | not output-tested | not output-tested | not inspected | same inherited client UI | active state verified | high: Etsy wording on Shopify | Source is `app/routes/png-to-svg-for-etsy.tsx` wrapper behavior |
| `/png-to-svg-for-canva`, `/png-to-svg-for-figma` | route default | initial | Lineart - Accurate | preset | not output-tested | not output-tested | not inspected | inherited controls | active state verified | schema identity mismatch | Converter controls match base at initial state |
| `/png-to-svg-for-etsy` | default conversion | result via harness | Etsy PNG - Accurate | preset/click | yes | yes | Potrace observed | output edit/copy/download | yes | no new runtime label issue | Copy, download, update preview passed |
| `/png-to-svg-for-glowforge` | route default | initial | Laser Cut - Clean Outline | preset | not output-tested | not output-tested | not inspected | inherited controls | active state verified | none established | Meaningful route-family preset difference |
| `/jpg-to-svg-converter` | default/VTracer/Potrace | initial/result | JPG Scan - Clean | preset/click | yes | yes | engine changed | output edit/copy/download | yes | keyword/search-intent wording | 156 additional presets shown |
| `/jpeg-to-svg-converter` | default/VTracer/Potrace | initial/result | JPG Scan - Clean | preset/click | yes | yes | engine changed | output edit/copy/download | yes | JPG-named default on JPEG route is reviewable, not proven wrong | 157 additional presets shown |
| `/sketch-to-svg-converter` | Sketch Pencil default | initial/result | Sketch - Pencil (light) | preset/click | yes | yes | Potrace observed | output edit/copy/download | yes | unrelated rental disclaimer | Production scenario passed |
| `/cricut-svg-converter` | Cricut clean trace | initial/result | Cricut - Clean trace | preset/click | yes | yes | Potrace observed | output edit/copy/download | yes | backend/pipeline wording | Cut-file route remains distinct |
| `/black-and-white-image-to-svg-converter` | B/W default and appended Lineart preset | initial/expanded/result | B/W - Clean | preset/click | yes | yes for default harness | Potrace observed | trace settings and output edits | yes | route copy says PNG in one limits section | Appended `Lineart - Clean` became sole active card |
| `/image-to-svg-outline` | Clean outline | initial/result | Clean outline | preset/click | yes | yes | Potrace observed | output edit/copy/download | yes | internal server wording | Production scenario passed |
| `/logo-to-svg-converter` | local/shared `logo-smooth` | expanded | Logo - Clean shapes | preset/click | not without input | not measured | not measured | active-state UI | collision reproduced | high: two cards appear selected | Local and shared settings differ |
| `/icon-to-svg-converter` | local/shared `icon-bold` | expanded/result harness | Layered color SVG | preset/click | yes for default harness | yes for default harness | VTracer observed | active-state UI | collision reproduced | high: two cards appear selected | Local and shared settings differ |
| `/webp-to-svg-for-cricut` | local/shared `cricut-clean-cut` | expanded | Cricut clean cut ID | preset | not output-tested | not output-tested | not inspected | active-state UI | collision reproduced | high | Both cards pressed at initial state |
| `/png-to-svg-for-cricut-print-then-cut` | appended `Cricut - Clean Cut` | expanded | Sticker - Clean Offset | preset/click | requires input | requires input | source passes clicked settings | active-state UI | selection verified | no mismatch reproduced | Appended card became sole active card |
| `/png-to-svg-for-cricut-stickers` | appended `Sticker - Clean Edge` | expanded | Sticker - White Border | preset/click | requires input | requires input | source passes clicked settings | active-state UI | selection verified | no mismatch reproduced | Appended card became sole active card |
| `/svg-to-png-converter` | size, lock, pixel ratio, anti-aliasing, background | Settings open | 1024 x 1024, lock on, 1x, AA on, transparent | live UI plus Convert | settings state changes; output preview requires source | base PNG conversion passed | none; client canvas | yes for conversion/layout | wording is canvas background, not recolor | Solid reveals `Background color`; no artwork recolor control |
| SVG-to-PNG wrappers | same export controls | initial | inherited | client canvas | not individually output-tested | not individually output-tested | none | client only | initial parity verified | wrapper schema points to base | Preserve route-specific guide/metadata |
| `/svg-to-favicon-generator` and three tested wrappers | platform/size/background/package settings | settings/result | all platform groups; 512 master; transparent; standard ICO sizes | client generation | seven previews | 24-file package | none | client only | yes | `UI flag only unless you wire uploads` | Example produced ICO, PNG, manifest, browserconfig files |
| `/svg-dimensions-inspector` | load example and sizing report | result | example | client analysis | report/preview | repair/export not exercised | none | client only | report verified | none | Missing width/height warnings and viewBox guidance shown |
| `/svg-file-size-inspector` | load example, Copy stats, Download SVG | result/settings | 96 DPI; fallback 1024; preview safety on | client analysis | size report | actions enabled | none | client only | yes | H2 emphasizes dimensions despite file-size route | 598 B raw and 566 B estimate displayed |
| `/base64-to-svg` | Clean SVG, sample, decode settings | result desktop/mobile | Clean SVG | client decode | latest SVG preview | Download/Copy enabled | none for SVG data URL | client only | yes | backend-limit prose is internal | Sample decoded 1024 x 1024, 1 path, 3 elements |
| `/code-to-svg-for-cricut` | source mode, sample, layered preset | result | Auto; Layered color SVG | sample/auto conversion | raster traced output | Download/Copy enabled | raster trace path used | parsing/UI local, tracing assisted | yes | pipeline/backend wording | Sample Data URI produced 1254 x 1254, 12.9 KB output |
| `/emoji-to-svg-converter` | text mode and default emoji | result | `😀🔥❤️` | click convert | 3 emoji/layers | Download/Copy enabled | Twemoji request path | editing client-side | yes | `Twemoji pipeline` terminology | Per-instance and same-emoji layer edits rendered |
| `/text-to-svg-converter` | grouped output, built-in Roboto | result | grouped; Roboto | click convert | SVG output | Download/Copy enabled | font outline action | output actions client-side | yes | none established | True SVG path workflow distinct from raster tracing |
| `/svg-resize-and-scale-editor` and wrappers | Settings, width/height/scale/viewBox | initial desktop/mobile | hidden until Settings | client utility | not source-tested | not source-tested | none | client only | controls rendered | none established | Output comparison remains unresolved |

## 6. First-pass preset collision findings

The deterministic follow-up in Section 22 supersedes the first-pass visibility limits: all six pairs are simultaneously reachable in their extended preset arrays, all six share ambiguous ID-only active/pin/label state, and five of six produced different fixture output.

The collision behavior is caused by state keyed only by preset ID while the selector deliberately preserves cards whose ID matches but label/settings differ. Sources: `app/client/components/converter/PresetSelector.tsx`, `app/client/lib/converter/presetAdditions.ts`, and the route-local preset arrays.

| Route | ID | Local card/effective settings | Shared card/effective settings | Runtime result | Risk |
| --- | --- | --- | --- | --- | --- |
| `/icon-to-svg-converter` | `icon-bold` | `Icon - Bold fill`: threshold 198, turd 3, opt 0.42, black | `Icon - Bold`: threshold 206, turd 3, opt 0.32, black | Clicking the local card made both cards pressed | Confirmed ambiguous active UI; clicked object likely applies correctly, but later ID lookup cannot distinguish labels/settings |
| `/logo-to-svg-converter` | `logo-smooth` | `Logo - Extra smooth (fewer nodes)`: threshold 212, turd 2, opt 0.55, majority | `Logo - Smooth`: threshold 214, turd 3, opt 0.5, majority | Clicking the local card made both cards pressed | Confirmed ambiguous active UI and history-label risk |
| `/webp-to-svg-for-cricut` | `cricut-clean-cut` | `Cricut - Clean cut file`: threshold 224, turd 3, opt 0.34 | `Cricut - Clean Cut`: threshold 216, turd 7, opt 0.62 | Both cards were pressed at initial state | Highest collision risk; visually indistinguishable active source |
| `/jpeg-to-svg-for-cricut` | `cricut-clean-cut` | Local `Cricut - Clean cut file` rendered active | Shared addition not observed as a second matching active card | One matching active card in this pass | No reproduced double-active issue; retain for focused regression |
| `/jpg-to-svg-for-cricut` | `cricut-clean-cut` | Local `Cricut - Clean cut file` rendered active | Shared addition not observed as a second matching active card | One matching active card in this pass | Same |
| `/png-to-svg-for-cricut` | `cricut-clean-cut` | Local `Cricut - Clean Cut (default)` rendered active | Shared addition not observed as a second matching active card | One matching active card in this pass | Same |

No IDs were renamed and no preset behavior was changed.

## 7. Display-versus-conversion preset findings

The static audit's three `DISPLAY_PRESETS` concerns were refined:

| Route | Runtime selection | Source application path | Verdict |
| --- | --- | --- | --- |
| `/png-to-svg-for-cricut-print-then-cut` | `Cricut - Clean Cut` became the only pressed card | `applyPreset(preset)` merges the clicked `preset.settings`; `PresetPicker` receives `DISPLAY_PRESETS` | No pre-upload mapping mismatch reproduced; non-default output still requires a real comparison |
| `/png-to-svg-for-cricut-stickers` | `Sticker - Clean Edge` became the only pressed card | Same direct clicked-object pattern | No pre-upload mapping mismatch reproduced |
| `/black-and-white-image-to-svg-converter` | `Lineart - Clean` became the only pressed card | `buildPresetSettings(preset, settings)` receives the clicked object; submit receives the selected ID/settings | No pre-upload mapping mismatch reproduced |

`npm run test:stage1-route-presets` also passed 798 preset smokes across 67 routes with zero failures. That test supports render/selection wiring; it is not proof that every setting changes exported pixels or paths.

## 8. First-pass route-family runtime comparisons

Section 22 provides the current output-comparison verdicts for JPG/JPEG, PNG wrappers, SVG-to-PNG, resizers, and favicons.

| Family | Runtime-equivalent behavior | Verified differences | Preservation conclusion |
| --- | --- | --- | --- |
| Favicon/ICO | Same generator/settings; built-in example generated the same 24 displayed files on base, image, Shopify, and PNG-to-ICO routes | H1/title/guide, platform intent, and FAQ/schema coverage differ | No redirect safe; preserve content/metadata and repair breadcrumb identity first |
| PNG/platform | Shared upload/output shell and broad trace preset system | Shopify inherits Etsy default/copy; base/Canva/Figma use lineart default; Glowforge uses laser default; schema identities differ | No redirect safe |
| SVG-to-PNG | Same visible export controls and client-canvas architecture | Route H1/title/guide differ; wrappers self-canonical but BreadcrumbList identifies base | No redirect safe without content/schema plan and wrapper output parity |
| Sketch/drawing | Shared trace shell | Different defaults and craft intent; sketch contains unrelated rental text | Keep separate pending content correction and full preset/output parity |
| JPG/JPEG | Same default label, controls, engines, output byte counts in three scenarios | H1/title/description, one additional visible preset count, route guidance | Not safe to consolidate without accepted-input/preset/content and transition proof |
| Resize | Same visible utility controls and inherited base breadcrumb | Platform H1/title/guide differ | Output was not compared; no redirect safe |
| Dimensions/file size | Both accept SVG/example and inspect size signals | Dimension route emphasizes viewBox/sizing repair; file-size route shows bytes/minified estimate and copy/download | Demonstrably distinct; retain both |
| Cricut/code/Base64 | Some share tracing/output cards | Uploaded raster, pasted code, Base64/data URI, and cut-friendly settings are different input/workflow capabilities | Redirects would lose unique parsing/workflow capability |
| Retained high-traffic | Shared output patterns where appropriate | Emoji has text/image modes and layer editing; text uses fonts/outlines; B/W and outline have distinct presets; Base64 decodes data | No consolidation assumption supported |

## 9. First-pass output comparison results

The inconclusive hash, SVG-to-PNG wrapper, and resizer rows below are historical first-pass results, not the final milestone conclusions. Section 22 resolved them for the explicitly listed fixtures and settings.

| Pair/family | Input/settings | Result | Classification |
| --- | --- | --- | --- |
| Home trace modes | Existing generated PNG fixture; route presets | Potrace 11,028 bytes; VTracer and centerline paths also produced decoded previews and valid copy/download output | Behaviorally different as intended |
| JPG vs JPEG | Same generated JPEG fixture; default | Both 11,052 bytes | Same byte count; structural/visual parity supported, byte identity not claimed |
| JPG vs JPEG | Same fixture; VTracer preset | Both 15,241 bytes | Same byte count; structural/visual parity supported |
| JPG vs JPEG | Same fixture; Potrace preset | Both 11,052 bytes | Same byte count; structural/visual parity supported |
| Favicon base/image/Shopify/PNG-to-ICO | Same built-in SVG example and default settings | Each displayed `Generated 24 files`, the same filenames, same displayed sizes, and same preview set | Structurally equivalent package; binary hashes not captured |
| PNG base | Existing generated PNG fixture; four engine scenarios | All decoded, copied, downloaded, and updated successfully | Base behavior verified |
| PNG Etsy wrapper | Existing generated PNG fixture; default | Potrace output/actions passed | Wrapper behavior verified, not compared under an equivalent base preset |
| SVG-to-PNG base | Existing generated SVG fixture in responsive harness | Converted PNG, fullscreen opened/closed, download initiation passed | Base client export verified |
| SVG-to-PNG wrappers | Initial settings only | No equivalent-output binary capture | Inconclusive |
| Resize wrappers | Initial controls only | No source/output comparison | Inconclusive |

The attempted JPG/JPEG SHA-256 rerun hit `attach-file: Timed out waiting for browser state` before the first comparison completed. The earlier six conversion scenarios passed, but the hash attempt is recorded as inconclusive rather than passed.

## 10. Internal/developer-note findings

| Priority | Exact rendered/runtime text | Route/state | Evidence | Classification |
| --- | --- | --- | --- | --- |
| High | `Browser VTracer was not used: This preset keeps Potrace for current line-art/cut-file parity.` (route variant also reproduced) | Potrace results on PNG, JPG/JPEG, sketch, Cricut, B/W, outline, logo, Etsy | Production browser reports in `warnings` | User-facing output warning; rewrite later without engine/parity details |
| High | Both same-ID preset cards appear active | icon/logo/WebP Cricut expanded preset state | `logo-to-svg-converter-desktop-preset-collision.png` plus runtime DOM | Internal ID collision leaking into interaction state |
| Medium | `UI flag only unless you wire uploads` | Favicon Settings, Include in gallery | `svg-to-favicon-generator-desktop-settings.png` | Direct developer note in visible UI |
| Medium | `Speed tags estimate backend processing cost and do not change output.` | Preset tooltips | Runtime button titles | User-visible implementation/cost wording |
| Medium | `Only backend conversion work is rate limited` and detailed backend limits | Numerous trace/code/Base64 route lower sections | Runtime body text on tested routes | Security facts should remain, but backend/React/pipeline wording is internal |
| Medium | `The converter supports two distinct pipelines`, `Text -> SVG (Twemoji pipeline)`, `Image -> SVG (Tracing pipeline)` | Emoji lower help | Runtime body text | User-visible; Twemoji attribution may remain but pipeline framing should be rewritten |
| Review | `Converted in your browser with VTracer` and raw `Engine:` labels | Result/history paths | Existing output component source plus production smoke output | Static finding remains; not screenshot-captured in the in-app browser because its file picker cannot attach local fixtures |

No public Sharp or SVGO note was reproduced. Server source comments and diagnostics were not treated as public content.

## 11. SEO/editorial terminology findings

All static findings below are runtime-visible, indexable route content:

| Route | Exact text | State/evidence | Rewrite purpose for later pass |
| --- | --- | --- | --- |
| `/png-to-svg-converter` | `PNG to SVG keyword cluster` | Always-visible lower guide; screenshot archived | Describe PNG vectorization workflows/users |
| `/png-to-svg-converter` | `Transparent PNG to SVG and png to svg converter free searches.` | Same guide | Describe transparent logos, icons, stickers, and graphics |
| `/jpg-to-svg-converter` | `JPG to SVG keyword cluster` | Always-visible lower guide; screenshot archived | Describe JPG photo/scan workflows |
| `/jpg-to-svg-converter` | `Use JPEG to SVG if your search intent or source wording specifically says JPEG.` | Lower route guide | Explain actual accepted formats or meaningful route difference |
| `/sitemap` | `Additional SEO-safe converter, seller, print, design handoff, favicon, and developer routes built on supported iLoveSVG tools.` | HTML sitemap; screenshot archived | Describe the tools rather than editorial safety |
| `/sitemap` | `Expanded SVG workflow routes` | HTML sitemap heading | Use a user navigation heading |

Ordinary `SEO` wording in the Inline SVG versus IMG comparison remains outside this finding because it describes a real embed tradeoff.

## 12. Content bug verification

| Severity | Route | Verified content/behavior | Evidence | Preservation/correction requirement |
| --- | --- | --- | --- | --- |
| High | `/sketch-to-svg-converter` | The full budgeting/365-day/rental-agreement disclaimer is always visible below the FAQ and above the All SVG tools section | `sketch-to-svg-converter-desktop-content-bug.png` | Remove or replace only in a later content pass; preserve surrounding sketch guidance |
| High | `/png-to-svg-for-shopify` | Active default visibly reads `Etsy PNG - Accurate trace (default)` | `png-to-svg-for-shopify-desktop-default-preset.png` | Determine intended Shopify preset mapping before any copy/preset change |
| Medium | `/svg-to-favicon-generator` | Intro says the generator supports SVG/PNG/JPG/WEBP, while lower guidance says `This generator starts from SVG and does not vectorize raster logos.` | Runtime body text | Clarify raster acceptance versus vectorization without changing accepted inputs |
| Medium | `/svg-to-favicon-generator` family | `Include in gallery - UI flag only unless you wire uploads` appears in Settings | Settings screenshot | Rewrite/remove developer note without removing the control until ownership/function is decided |
| Medium | PNG/JPG guides and sitemap | Editorial/query text listed above | Three screenshots | Content-only rewrite later; no route/metadata change in the same step |

## 13. Canonical/schema/breadcrumb runtime findings

| Priority | Route(s) | Canonical/OG | Visible breadcrumb | Schema URL | Destination result | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| High | Favicon/ICO family | self-canonical and self OG | `Favicon Generator` -> `/svg-favicon-generator` | BreadcrumbList uses the same invalid URL | 404 | Verified user-visible and crawler defect |
| High | `/svg-stroke-width-editor` | self-canonical/self OG | `Stroke Width` -> `/svg-stroke-width-adjust` | same invalid URL | 404 | Verified user-visible and crawler defect |
| High | `/svg-flip-and-rotate-editor` | self-canonical/self OG | `Flip & Rotate` -> `/svg-flip-rotate-editor` | same invalid URL | 404 | Verified user-visible and crawler defect |
| High | SVG-to-PNG wrappers | self-canonical/self OG | Base SVG-to-PNG breadcrumb | BreadcrumbList identifies `/svg-to-png-converter` | 200 base route | Verified schema/canonical identity disagreement |
| High | SVG resizer wrappers | self-canonical/self OG | Base resize breadcrumb | BreadcrumbList identifies `/svg-resize-and-scale-editor` | 200 base route | Verified schema/canonical identity disagreement |
| High | `/png-to-svg-for-canva`, Figma representative | self-canonical/self OG | wrapper route in breadcrumb | WebPage URL identifies `/png-to-svg-converter` | 200 base route | Verified schema/canonical identity disagreement |
| Review | XML sitemap | 125 unique paths | n/a | n/a | route-coverage exact policy match | No runtime sitemap defect found |

`node scripts/schema-audit.mjs` passed its 27-route runtime set with zero failures. It does not flag semantically wrong-but-valid breadcrumb URLs, which is why the direct DOM/schema/HTTP comparison above remains necessary. `npm run test:seo` passed 59 routes, and `npm run test:routes` passed all 157 registered routes/redirects. The self-canonical checks are sound; inherited schema identity is the outstanding defect class.

## 14. Console/network errors

- In-app browser console query after the route matrix: zero warnings and zero errors.
- All successful hybrid conversion reports: zero console errors and no broken preview.
- Raster hybrid scenarios each recorded one `net::ERR_FILE_NOT_FOUND` after a download action while the downloaded SVG itself was present and validated. This appears to be the headless download/file handoff, not a conversion failure; it is recorded rather than suppressed.
- The local pages reference existing `https://assets.ilovesvg.com/...` illustrative content. Those requests are an existing page dependency, not an audit-added network call. No private data was used.
- `test:navigation-browser` failed twice on its pre-hydration menu click; direct hydrated browser interaction passed.
- One hash-only rerun failed attaching its fixture. The earlier route conversions passed.

## 15. Screenshot evidence index

All files are PNGs captured from the local app with no private data or filesystem paths in the viewport.

| Screenshot | Route | Viewport | State/finding |
| --- | --- | --- | --- |
| `home-desktop-initial.png` | `/` | desktop | Upload-first initial layout/default presets |
| `home-mobile-initial.png` | `/` | mobile | Initial mobile converter |
| `home-mobile-menu-open.png` | `/` | mobile | Open 123-tool navigation/search dialog |
| `png-to-svg-converter-desktop-presets-expanded.png` | PNG base | desktop | 170-preset expanded selector |
| `png-to-svg-converter-desktop-editorial-copy.png` | PNG base | desktop | Public keyword-cluster content |
| `png-to-svg-for-shopify-desktop-default-preset.png` | Shopify PNG | desktop | Etsy-named active default |
| `jpg-to-svg-converter-desktop-editorial-copy.png` | JPG | desktop | Public keyword/search-intent content |
| `logo-to-svg-converter-desktop-preset-collision.png` | Logo | desktop | Both `logo-smooth` cards pressed |
| `svg-to-png-converter-desktop-settings.png` | SVG-to-PNG | desktop | Size/quality/background controls |
| `svg-to-png-converter-mobile-settings.png` | SVG-to-PNG | mobile | Live Preview and Click To Convert groups |
| `svg-to-favicon-generator-desktop-settings.png` | Favicon base | desktop | Default package and background settings |
| `svg-to-favicon-generator-desktop-result.png` | Favicon base | desktop | Generated 24-file package/previews and visible UI-only gallery note |
| `svg-to-favicon-generator-mobile-result.png` | Favicon base | mobile | Generated 24-file state and output previews on mobile |
| `svg-to-favicon-for-shopify-desktop-result.png` | Shopify favicon | desktop | Equivalent generator result, distinct route identity |
| `svg-to-favicon-generator-desktop-breadcrumb.png` | Favicon base | desktop | Invalid visible breadcrumb |
| `svg-stroke-width-editor-desktop-breadcrumb.png` | Stroke editor | desktop | Invalid visible breadcrumb |
| `svg-flip-and-rotate-editor-desktop-breadcrumb.png` | Flip/rotate | desktop | Invalid visible breadcrumb |
| `sketch-to-svg-converter-desktop-content-bug.png` | Sketch | desktop | Always-visible rental/budget disclaimer |
| `svg-dimensions-inspector-desktop-result.png` | Dimensions | desktop | Example sizing/viewBox report |
| `svg-file-size-inspector-desktop-result.png` | File size | desktop | Example byte/minified-size report |
| `svg-resize-and-scale-editor-mobile-initial.png` | Resize | mobile | Mobile initial utility layout |
| `base64-to-svg-desktop-sample-result.png` | Base64 | desktop | Decoded SVG result and layer tools |
| `base64-to-svg-mobile-sample-result.png` | Base64 | mobile | Sample input/result workflow on mobile |
| `code-to-svg-for-cricut-desktop-sample-result.png` | Code/Cricut | desktop | Data-URI sample and traced output |
| `emoji-to-svg-converter-desktop-result.png` | Emoji | desktop | Three-emoji output/layer editing |
| `text-to-svg-converter-desktop-result.png` | Text | desktop | Font-outline output actions |
| `sitemap-desktop-editorial-copy.png` | Sitemap | desktop | SEO/editorial labels |

## 16. Corrected static assumptions

- Static concern corrected to runtime fact: Shopify PNG does not merely share the Etsy implementation; it visibly exposes the Etsy-named default preset.
- Static inheritance confirmed: favicon routes share the generator and default example package, but route identity/content remains distinct.
- Static distinction confirmed: dimensions and file-size inspectors solve different tasks and expose different result actions.
- Static collision concern strengthened: three route experiences show same-ID double-active cards; this is not a theoretical dedupe concern.
- Static display-array concern narrowed: the three appended-display routes correctly activate the clicked object before upload. Their non-default output still needs a later fixture comparison.
- Static SVG-to-PNG concern narrowed: no artwork recolor control renders. The background selector is presented as raster canvas/export background. Wrapper-specific prose still needs editorial review.
- Static sketch content issue confirmed as always visible.
- Static route/schema findings confirmed at runtime, including 404 results for all three invalid breadcrumb targets.
- Static capability inventory expanded: `code-to-svg-for-cricut` accepts a large raster Data URI in Auto mode and auto-produces a traced SVG result; this input/parsing workflow is unique and preservation-critical.
- Mobile navigation works after hydration, while the existing audit script has a click-before-hydration race.

## 17. Questions unresolved after the first browser pass

Items 1-5 were subsequently resolved or narrowed by Section 22. Items 6-8 remain limitations of the milestone.

1. Which exact preset object is used for history labeling, pinning, and re-application after selecting each colliding ID? The UI proves ambiguity; a focused implementation test must trace ID lookup after conversion.
2. Do the appended display presets produce the intended server payload/output on print-then-cut, stickers, and black-and-white routes? Selection is wired; non-default conversion was not run.
3. Are SVG-to-PNG wrapper outputs byte-identical under equivalent source/settings? Only base output and wrapper initial UI were exercised.
4. Does the SVG-to-PNG solid background change only transparent canvas pixels in every browser? UI/source intent is clear, but a pixel comparison was not archived.
5. Are SVG resizer wrappers output-identical and do viewBox/unit modes behave identically? No local SVG was attached through the in-app picker.
6. Does favicon download initiation consistently fire through the in-app browser event API? Buttons enabled and files generated; the event wait timed out, so no completion is claimed.
7. Which content and traffic signals justify any canonical consolidation? Repository runtime cannot answer this.
8. Error, stale-request, reset, and second-upload states need a dedicated browser regression pass for every high-risk family; this audit covered representative result and clear/reload behavior, not every permutation.

## 18. Feature-preservation updates

- Favicon consolidation must preserve all accepted raster/SVG inputs, 24-file package generation, custom ICO sizes, platform toggles, manifest/browserconfig output, snippet copy, individual ICO, ZIP, all-files actions, previews, and route-specific Shopify/format guidance.
- PNG platform work must preserve each route's active default, route preset subset, accepted PNG/JPG/JPEG/WebP inputs, engine choices, history/layer editing, and platform guidance. The Shopify/Etsy default issue must be resolved deliberately, not by redirect.
- JPG/JPEG work must preserve both route names, accepted extension/MIME behavior, the extra JPEG preset difference, scan/photo guidance, and identical output quality.
- SVG-to-PNG work must preserve exact size/aspect/pixel-ratio/anti-alias/background behavior, fullscreen preview, transparent output, download, and platform-specific guidance. Background is not artwork recolor.
- Resize work must preserve width/height, units, aspect lock, scale, viewBox behavior, preview, copy/download, warnings, and platform guidance.
- Dimensions and file-size routes must stay distinct unless every repair/report/action capability is deliberately combined without loss.
- Code/Base64/Cricut routes must preserve uploaded raster, pasted code, SVG, Base64, data URI, CSS/Markdown/HTML/JSON extraction, source-mode detection, cut/layer controls, report/CSV actions, history, and editing.
- Emoji must preserve text and image modes plus per-instance and same-emoji layer editing. Text-to-SVG must preserve font upload/built-in fonts, grouped/individual output, and true outline paths.
- Output history and current-source behavior were not reduced. `Clear` on the code route cleared the input while leaving the existing output available; this is preservation-sensitive behavior, not a memory/content bug.

## 19. Routes safe to consolidate now

None.

Even the strongest functional overlaps (favicon wrappers, JPG/JPEG, SVG-to-PNG wrappers, resize wrappers) still lack at least one of: complete input/output equivalence, preset parity, content-preservation mapping, schema/canonical transition design, or browser proof for all supported states.

## 20. Routes not safe to consolidate

- All favicon/ICO routes: equivalent generator output does not erase distinct route guidance/metadata, and the breadcrumb/schema identity is already defective.
- PNG platform routes: verified default/preset and schema differences.
- JPG/JPEG: output byte counts align, but preset count, route identity, accepted-input semantics, content, and transition evidence remain.
- SVG-to-PNG wrappers: output parity and content/schema preservation incomplete.
- Resize wrappers: output behavior not compared.
- Dimensions/file-size inspectors: runtime tasks and actions are distinct.
- Cricut/code/Base64 routes: unique parsers and workflows.
- Sketch/drawing/high-traffic routes: unique intent, presets, editing, and content.

## 21. Initial recommended deterministic follow-up

1. Create a no-change implementation plan split into independent workstreams: broken breadcrumb/schema URLs, public developer/editorial copy, preset-ID collision semantics, and platform-default/content mismatches.
2. Before changing collisions, add focused tests proving clicked preset settings, active-card identity, history label, pin/localStorage identity, and re-apply behavior for icon, logo, and WebP Cricut.
3. Add fixture-driven output comparisons for SVG-to-PNG wrappers, resize wrappers, and appended display presets. Compare pixels/semantic SVG structure; do not infer equality from shared imports.
4. Plan content corrections separately from redirects/canonicals. Preserve security limits and legal attribution while removing implementation/editorial language.
5. Repair invalid breadcrumb/schema identities before considering family consolidation.
6. Keep the safe-to-consolidate list empty until input, output, setting, preset, workflow, content, and transition parity are all proven.
7. Leave the All Tools section unchanged.

No application code, public text, metadata, schema, canonical, route, redirect, sitemap entry, preset, setting, test, or dependency was changed in this pass.

## 22. Deterministic parity and preset-resolution follow-up - 2026-07-13

This follow-up resolves the output and state questions that could not be proved by the first browser pass. Evidence came from the real local application at `http://localhost:3000`, production route actions, production browser conversion/download paths, decoded raster pixels, parsed SVG, and ZIP/ICO inspection. The read-only harness is `scripts/converter-parity-audit.mjs`; it creates deterministic fixtures in a temporary directory and removes them in `finally`.

### Fixture matrix

The fixture paths below are temporary basenames, not retained repository assets. SHA-256 covers the exact input bytes.

| Fixture | Format and dimensions | Alpha | Bytes | SHA-256 | Intended evidence |
| --- | --- | --- | ---: | --- | --- |
| `transparent.png` | PNG 120 x 80 | yes | 1,253 | `6d4aaad7951e...f66ad` | Raster input and alpha reference |
| `opaque.png` | PNG 96 x 64 | no | 881 | `28a4826bf3d8...5f40` | PNG wrapper and cut-preset parity |
| `photo.jpg` / `photo.jpeg` | JPEG 160 x 96 | no | 3,861 each | `70d0632b83e5...c5dc` | Same bytes under both extensions |
| `mono-logo.png` | PNG 160 x 96 | yes | 1,187 | `40bbfe32ada0...3f74` | Icon/logo collision output |
| `multi-color.png` | PNG 160 x 96 | yes | 1,690 | `9a9e914c6225...030f` | Platform/layered trace |
| `multi-color.webp` | WebP 160 x 96 | no | 1,488 | `ad51f09fd264...f6a5` | WebP Cricut collision |
| `sketch.png` | PNG 160 x 96 | yes | 2,904 | `6fb08e490132...1c59` | Sketch/line drawing |
| `fillsSvg.svg` | SVG 96 x 64 | yes | 245 | `1591b7b1c451...ecd` | Filled SVG utilities |
| `strokesSvg.svg` | SVG 120 x 80 | yes | 229 | `a04f5162c454...4830` | Stroke and code input |
| `transparentSvg.svg` | SVG 120 x 80 | yes | 372 | `e291a74daf84...c2c` | Pixel-level transparent export |
| `nonSquareSvg.svg` | SVG 120 x 80; `viewBox=10 20 120 80` | yes | 294 | `46d38b00fad7...87ba` | Resizer/viewBox behavior |
| Base64/data URI sample | SVG 96 x 64 | no | 354 | `eaae26e79416...1410` | Base64/code parsing |

### Resolved preset-ID collisions

`PresetSelector` keeps same-ID presets when labels/settings differ, but active-card and pin state compare only `preset.id`; `getPresetLabelById` returns the first matching card (`app/client/components/converter/PresetSelector.tsx`). `extendTracePresets` supplies the shared additions (`app/client/lib/converter/presetAdditions.ts`). Therefore both cards render, both appear active, pinning either pins both, and history-label lookup cannot distinguish which object was clicked. Conversion itself uses the clicked object's settings, so this is not harmless duplication.

| Route | ID | Local card then shared card | Output result | Classification |
| --- | --- | --- | --- | --- |
| `/icon-to-svg-converter` | `icon-bold` | Icon - Bold fill / Icon - Bold | `7804bb...` vs `b0b500...` | State, pin, history-label, and confirmed output risk |
| `/logo-to-svg-converter` | `logo-smooth` | Logo - Extra smooth / Logo - Smooth | Both `9ff7ff...` on the simple logo fixture | State/pin/history-label risk; output difference not reproduced on this fixture |
| `/webp-to-svg-for-cricut` | `cricut-clean-cut` | Cricut - Clean cut file / Cricut - Clean Cut | `c49a11...` vs `f526f7...` | State, pin, history-label, and confirmed output risk |
| `/jpeg-to-svg-for-cricut` | `cricut-clean-cut` | Same labels | `e5d1d5...` vs `97375d...` | State, pin, history-label, and confirmed output risk |
| `/jpg-to-svg-for-cricut` | `cricut-clean-cut` | Same labels | `e5d1d5...` vs `97375d...` | State, pin, history-label, and confirmed output risk |
| `/png-to-svg-for-cricut` | `cricut-clean-cut` | Cricut - Clean Cut (default) / Cricut - Clean Cut | `5bad4e...` vs `08a33f...` | State, pin, history-label, and confirmed output risk |

For all six, display order is route-local first and shared second. Selecting a card applies that card's effective values, but the submitted ID is indistinguishable. Reset and second upload can preserve the ID, not the selected object identity. Both cards can remain visually active. No preset was renamed or removed during this audit.

### Display preset versus conversion preset mapping

| Pattern/routes | Runtime/source result | Classification |
| --- | --- | --- |
| Routes using `extendTracePresets`, including the six collision routes | The clicked object supplies exact settings; rendered and conversion arrays are the same extended objects. ID-only active/pin/label resolution is ambiguous for collisions. | Value-exact, ID-ambiguous for collisions |
| `/black-and-white-image-to-svg-converter` | `submitConvertWith(file, nextSettings, preset.id)` passes the clicked ID explicitly. | Exact |
| `/png-to-svg-for-cricut-print-then-cut` and `/png-to-svg-for-cricut-stickers` | Route-local display additions supply clicked settings, but conversion submission reads the `activePreset` React closure. | Values exact; preset/history ID may lag one selection |
| `/jpg-to-svg-converter` and `/jpeg-to-svg-converter` | Immediate preset conversion submits clicked settings, while `submitConvertWith` can read the previous `activePreset` closure for metadata. Direct route-action output is correct; history label/ID timing remains risky. | Values exact; metadata ID timing risk |
| `/base64-to-svg` | `DISPLAY_PRESETS` reorders the same `PRESETS` objects and resolves by ID. No separate conversion-only value table was found. | Exact for unique IDs |

The first runtime report's statement that appended cards activate correctly remains true, but activation alone did not prove payload metadata identity. This follow-up narrows the concern to preset ID/history metadata, not the clicked setting values.

### Deterministic route-family comparisons

#### JPG/JPEG

The same 3,861-byte JPEG input was submitted to both production actions. Default (`c55d28...`, 1,560 bytes), Photo Bold (`fdad9c...`, 3,602 bytes), threshold 180 (`65bbaf...`, 1,588 bytes), and Lineart Clean (`e5d1d5...`, 1,447 bytes) were byte-identical, normalized-XML-identical, and structurally equivalent between the routes. ViewBox/path/fill/stroke summaries matched.

The browser default scenario also downloaded identical 11,052-byte SVGs. A JPG VTracer run completed with the expected 15,241-byte layered output. In one captured JPEG run, VTracer conversion metrics reported the same 15,241-byte result, but copy/download still targeted the earlier 11,052-byte Potrace history item and Update preview then had no visible output. That observed state mismatch is a confirmed occurrence and blocks a claim of complete browser-workflow parity even though equal production-action inputs/settings are deterministic. A final clean route-filtered retry completed correctly after an earlier fixture-attachment timeout, so the race is intermittent or timing-sensitive rather than deterministically reproduced by the current harness. The two routes also advertise different accepted formats: the JPEG implementation exposes GIF/AVIF/BMP/TIFF in addition to the common JPG/JPEG/PNG/WebP/SVG family.

Exact JPEG reproduction for the remediation milestone:

1. Start the verified local iLoveSVG app and open `/jpeg-to-svg-converter` in a fresh browser state.
2. Attach the deterministic JPEG fixture used by the repository browser harness and let the default Potrace conversion complete. Confirm that its result is selected and that Copy SVG and Download SVG both resolve to the 11,052-byte Potrace item.
3. Select the VTracer-compatible layered preset and wait for conversion completion, the 15,241-byte result metrics, and the new history/result entry. Do not click another history item.
4. Wait beyond the normal result render/settling interval and inspect whether the active selected item remains the earlier Potrace entry even though the later VTracer result exists. If it does, this separates the captured defect from delayed paint or a stale attachment; record elapsed timings because the final clean audit retry did not reproduce the mismatch.
5. Invoke Copy SVG and Download SVG and compare their bytes/hash with both history entries; both actions still resolve to the prior Potrace bytes. Open Settings/Edit and invoke Update preview; the active-output state remains inconsistent and no VTracer output becomes the visible action target.
6. Repeat from a fresh page with a newly attached copy of the same deterministic fixture and continue until the timing boundary is isolated. Scope the confirmed occurrence to JPEG. The equivalent JPG VTracer run completed and targeted its new output in the tested scenario; do not describe JPG as affected without an independent reproduction.

#### PNG platform wrappers

With the same opaque PNG and manually equalized settings, base, Canva, Figma, Shopify, Etsy, and transparent-PNG routes were byte-identical (`5bad4e...`, 1,240 bytes). Glowforge produced `a137b8...` (1,341 bytes) because it uses the laser-cutting post-processing path. Defaults remain different: Shopify visibly inherits the Etsy-named default; base/Canva/Figma start from line-art defaults; Glowforge starts from laser intent. Equalized-action parity therefore does not imply default/workflow/content parity.

#### SVG-to-PNG wrappers

Nine routes - base, Shopify, Etsy, Printify, Printful, sticker printing, transparent printing, Canva, and Figma - produced byte- and pixel-identical 120 x 80 PNGs from the same SVG and equivalent settings. All had byte hash `b1e32d...` and decoded-pixel hash `120832...`. This proves converter output parity for that fixture/settings combination only; it does not supply a content or metadata transition plan.

#### SVG resizer wrappers

The base editor plus Shopify, Etsy, Glowforge, Silhouette, Canva, and Figma wrappers serialized byte-identical SVG (`8dc08a...`) from the non-square/viewBox fixture. Locked width 240 yielded 240 x 160 while preserving `viewBox=10 20 120 80`; unlocked 240 x 100 with match-output yielded `viewBox=0 0 240 100`; scale 50 yielded 60 x 40 while preserving the source viewBox. These controls are verified export-affecting.

#### Favicon/ICO wrappers

Nine compatible routes generated the same 24 filenames, per-file sizes/hashes, seven ICO entries (16, 24, 32, 48, 64, 128, 256), and 514-byte HTML snippet (`01e859...`) from the built-in example. Raw ZIP hashes differed because archive metadata/timestamps are nondeterministic; package contents were identical. A white background changed all 22 raster/ICO payloads while leaving `browserconfig.xml` and `site.webmanifest` unchanged. Selecting only 16 x 16 changed the ICO directory to one entry but retained the 24-file package. Route input claims, guidance, metadata, and Shopify content remain preservation blockers.

### SVG-to-PNG background pixel result

| Mode | Alpha counts | Pixel result |
| --- | --- | --- |
| Transparent | 5,931 fully transparent, 1,773 partial-alpha, 1,896 opaque | Reference output |
| White solid | 9,600 opaque | 7,704 pixels differ: all transparent and partial-alpha pixels; zero fully opaque artwork pixels differ |
| Custom solid | 9,600 opaque | Same affected-pixel categories; zero fully opaque artwork pixels differ |

The control changes the canvas compositing background, not opaque SVG artwork fill/stroke colors. Partially transparent antialiased/internal-alpha pixels correctly blend against the selected background, so their RGB values change. A solid background removes output alpha. Preview and downloaded output use the same generated Blob/PNG path in the tested workflow.

### Settings-effect matrix

| Route/family | Control | Changed value | Preview/payload/output evidence | Reset/second upload | Classification |
| --- | --- | --- | --- | --- | --- |
| JPG/JPEG trace | Preset | Default to Photo Bold / Lineart Clean | Production payload and SVG hashes changed; same settings remained cross-route identical | Defaults restore; source replacement does not alter production action semantics | Conversion-affecting |
| JPG/JPEG trace | Threshold | default to 180 | Both routes changed to identical `65bbaf...` output | Default restored by reset | Conversion-affecting |
| Collision routes | Local/shared same-ID card | Click each object | Effective settings and five of six fixture outputs differ; active/pin/history identity does not | ID ambiguity survives reset/second-upload paths | Conversion-affecting plus misleading state risk |
| SVG-to-PNG | Background | transparent to white/custom | Preview/download pixels changed only alpha-bearing regions; opaque artwork unchanged | Transparent default restored | Export-affecting |
| SVG-to-PNG | Dimensions/scaling | explicit/equivalent sizes | Output dimensions and bytes change; wrappers match when equalized | Source can be replaced without changing route defaults | Export-affecting |
| SVG resizer | Aspect lock | width 240 locked | Height became 160, viewBox preserved | New source is reparsed | Export-affecting |
| SVG resizer | Unlock + match output | 240 x 100 | Serialized dimensions and viewBox changed | Reset returns source dimensions | Export-affecting |
| SVG resizer | Scale | 50 percent | Output became 60 x 40, viewBox preserved | Reset restores 100 percent | Export-affecting |
| Favicon | Background | white | 22 image/ICO payload hashes changed; XML/manifest did not | Regeneration replaces owned package | Export-affecting |
| Favicon | ICO sizes | 16 only | `favicon.ico` contains only 16 x 16; package remains 24 files | Regeneration restores default seven sizes | Export-affecting (ICO only) |
| Output editing routes | Color/opacity/update preview | representative edits | `test:post-conversion-editability` confirmed edited copy/download/update behavior on seven routes | History replacement assertions passed in focused editor test | Preview/export-affecting; timing thresholds failed separately |

### History, reset, second upload, and stale state

- `scripts/client-lifecycle-audit.mjs` passed ownership, URL revocation, worker termination, second-upload, reset, and stale-result static/runtime guards.
- `npm run test:output-ux` and `npm run test:conversion-actions` passed.
- `npm run test:stage1-route-presets` passed 67 routes and 798 preset smokes with zero failures.
- `npm run test:focused-editor` confirmed copy, download, output-history replacement, settings-section state, and zero console errors on all six tested routes. It failed only its responsiveness assertion on all six routes; no correctness assertion failed.
- `npm run test:post-conversion-editability` functionally completed all seven route scenarios, including copy/download and color/opacity or route-appropriate editing. It exited nonzero only for existing responsiveness thresholds on home/JPG-layered cases.
- The collision tests prove that ID-only history labels cannot preserve which same-ID object produced an output. This is a verified history-label/pinning defect risk, not evidence that history data bytes are lost.
- A JPEG VTracer run exposed an active-history selection mismatch: a completed later output did not become the copy/download target. A final clean retry passed, so deterministic reproduction remains unresolved; the confirmed occurrence still blocks JPG/JPEG consolidation.
- No stale worker completion replaced a new source in the lifecycle audit or focused routes. Exhaustive slower-then-faster timing was not forced because changing conversion timing/concurrency was out of scope.

### Consolidation readiness after deterministic evidence

| Family | Input | Output | Presets/settings | History/editing | Package/export | Content/metadata | Redirect safe | Blocking differences |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Favicon/ICO | partial | yes for common example/default | partial | partial | yes for common example/default | no | no | Input claims, route guidance, metadata/schema, settings-state coverage |
| PNG platform | partial | partial | no | partial | partial | no | no | Defaults/presets; Glowforge post-processing; platform guidance |
| Logo wrappers | partial | inconclusive | no | partial | partial | no | Collision and distinct cut/favicon workflows |
| SVG-to-PNG | yes for tested SVG | yes for tested equal settings | yes for tested controls | partial | yes | no | Content/schema preservation and broader fixture coverage |
| Resize | yes for tested SVG | yes for tested modes | yes for tested controls | partial | yes | no | Platform content/metadata preservation |
| Dimensions/file size | yes | no | no | no | no | no | Different reports/actions/tasks |
| Cricut/code/Base64 | no | no | no | partial | no | no | Unique parsers, inputs, cut/layer workflows |
| Sketch/drawing | partial | inconclusive | no | partial | partial | no | Route intent/preset/content differences |
| JPG/JPEG | partial | yes for equal action settings | partial | no | yes for deterministic action | no | no | Accepted inputs, extra presets/content, JPEG active-output race |

No route is safe to consolidate now. Even the strongest output matches remain blocked by at least one partial/no category and by the absence of a complete content/metadata transition plan.

### Console, network, and limitations

The parity harness recorded no local conversion-request failure. Browser logs contained existing advertising/tracking-prevention messages and 26 `net::ERR_BLOCKED_BY_ORB` failures for external ad resources; those were not local converter failures. Dev output retained the existing sourcemap, experimental WASM, and fontconfig warnings.

The direct action comparisons prove conversion determinism for specified inputs/settings, not complete UI workflow parity. Raw ZIP bytes are intentionally not normalized into false equality; only explicit entry names, sizes, hashes, snippets, manifests, and ICO directories are compared. VTracer browser parity remains incomplete on JPEG because the captured active-output/history mismatch is material evidence even though the final clean retry passed. No timing threshold was relaxed and no product source was changed.

### Validation record

| Command/check | Result |
| --- | --- |
| `node scripts/converter-parity-audit.mjs` | Passed all requested sections; no harness failures. A browser-readiness wait was then tightened after one Figma resizer capture occurred before source parsing completed. |
| `CONVERTER_PARITY_SECTIONS=resizers node scripts/converter-parity-audit.mjs` | Passed after the harness-only wait correction; all seven resizer outputs byte-identical. |
| `node --check scripts/converter-parity-audit.mjs` | Passed. |
| `node scripts/client-lifecycle-audit.mjs` | Passed. |
| `npm run test:output-ux` | Passed. |
| `npm run test:conversion-actions` | Passed. |
| `npm run test:stage1-route-presets` | Passed: 67 routes, 798 preset smokes, zero failures. |
| `npm run test:focused-editor` | Nonzero only because all six responsiveness assertions failed; copy, download, history replacement, settings-section state, and console checks passed. |
| `npm run test:post-conversion-editability` | Nonzero only for timing thresholds; functional scenarios completed on all seven routes. |
| Route-filtered JPG/JPEG hybrid browser checks | Default production downloads matched; JPG VTracer passed. One earlier JPEG run captured the material active-output/history mismatch; in this final pass, one JPEG attempt timed out while attaching the fixture and a fresh retry passed copy, download, and update-preview against VTracer. Deterministic race reproduction remains inconclusive. |
| SVG utility/layout hybrid browser check | Passed, including SVG-to-PNG conversion. |
| `node scripts/schema-audit.mjs` | Passed 27 scoped routes with zero failures. |
| `node scripts/route-coverage-audit.mjs` | Passed: correct app, 157 registered routes, 156 public routes, 125 sitemap paths, zero coverage failures. |
| UTF-8 validation | Passed for all three audit documents and the parity script. |
| Trailing-whitespace scan | Passed for all audit/script files. |
| Screenshot PNG validation | Passed for all 27 evidence screenshots after three mislabeled captures were replaced with evidence-bearing states. |
| `git diff --check` | Passed. |

An initial parallel wrapper around the schema and route-coverage audits timed out at 124 seconds before returning either child result. Both audits were rerun independently with their supported longer allowance and passed; the wrapper timeout is not reported as an application failure. The final milestone pass also ran typecheck, production build, and the full test suite successfully.

### Recommended next pass

1. Design a product-fix plan for unique preset identity that preserves IDs externally while distinguishing card/object/history identity internally; do not implement it together with redirects.
2. Reproduce and isolate the JPEG VTracer active-output selection race with a deterministic focused browser test.
3. Establish the regression baselines in `ilovesvg-output-quality-regression-plan.md` before any preset, setting, converter, or redirect change.
4. Keep every consolidation candidate blocked until all preservation columns are yes and an explicit content/metadata transition is approved.
5. Leave the All Tools section unchanged.

This follow-up changed only audit documentation and a read-only audit script. It changed no application route, behavior, preset, setting, output, metadata, content, canonical, sitemap entry, or All Tools content.

## 23. Final milestone review

### Full audit verdict and artifact set

The site-inventory and capability-audit milestone is ready as an evidence-backed planning baseline. Its claims now distinguish static verification, production-action comparison, browser runtime evidence, source inference, confirmed defects, unresolved timing questions, and fixture limitations. The milestone contains the route/component inventory, this runtime verification, the output-quality regression plan, 27 indexed runtime PNG screenshots, and `scripts/converter-parity-audit.mjs`. No production application file is part of the milestone.

Coverage remains deliberately bounded: 157 registered routes, 156 public routes, 125 XML-sitemap paths, 60 directly opened or production-browser-smoked public routes, 67 routes/798 presets in the stage-one preset smoke, and focused deterministic comparisons for the families described in Section 22. These figures do not imply exhaustive input, setting, browser, or workflow coverage.

### Confirmed-defect register

Severity uses product impact, not audit inconvenience. No item qualifies as critical because the evidence does not show security loss, data loss, or broad application failure.

| Defect ID | Route/family, exact behavior, severity | User/output/history impact | Source locations and runtime/script/screenshot evidence | Future milestone, preservation constraints, consolidation blocker |
| --- | --- | --- | --- | --- |
| `ILSVG-DEF-001` | `/icon-to-svg-converter`: two reachable cards use `icon-bold`; both can appear active/pinned. **Medium.** | Users cannot identify the selected definition; five-pair output test includes materially different icon SVGs; ID-only history labels are ambiguous, although clicked values are used. | `app/routes/icon-to-svg-converter.tsx`; `app/client/lib/converter/presetAdditions.ts`; `PresetSelector.tsx`. Parity collision hashes and `logo-to-svg-converter-desktop-preset-collision.png` as family-state corroboration. | Preset-identity remediation; preserve both labels/settings/output and stored-ID compatibility. Blocks icon-family consolidation. |
| `ILSVG-DEF-002` | `/logo-to-svg-converter`: two reachable cards use `logo-smooth`; both can appear active/pinned. **Medium.** | Selected identity/history label is ambiguous; effective settings differ, but the tested simple fixture produced matching SVG bytes, so universal output difference is not claimed. | `app/routes/logo-to-svg-converter.tsx`; shared additions and selector sources above; `logo-to-svg-converter-desktop-preset-collision.png`; parity logo row. | Preset-identity remediation; preserve both definitions and treat the fixture match as limited. Blocks logo-family consolidation. |
| `ILSVG-DEF-003` | `/webp-to-svg-for-cricut`: local and shared cards use `cricut-clean-cut` and are simultaneously active/pinnable. **Medium.** | Ambiguous choice/history; clicked values produce materially different SVGs. | `app/routes/webp-to-svg-for-cricut.tsx`; shared additions/selector; parity collision row. | Preset-identity remediation; preserve cut settings/output and compatibility. Blocks Cricut-wrapper consolidation. |
| `ILSVG-DEF-004` | `/jpeg-to-svg-for-cricut`: duplicate reachable `cricut-clean-cut` identity. **Medium.** | Ambiguous active/pin/history state; clicked definitions produced different SVGs. | `app/routes/jpeg-to-svg-for-cricut.tsx`; shared additions/selector; parity collision row. | Preset-identity remediation; preserve both effective settings and output. Blocks consolidation. |
| `ILSVG-DEF-005` | `/jpg-to-svg-for-cricut`: duplicate reachable `cricut-clean-cut` identity. **Medium.** | Ambiguous active/pin/history state; clicked definitions produced different SVGs. | `app/routes/jpg-to-svg-for-cricut.tsx`; shared additions/selector; parity collision row. | Preset-identity remediation; preserve both effective settings and output. Blocks consolidation. |
| `ILSVG-DEF-006` | `/png-to-svg-for-cricut`: duplicate reachable `cricut-clean-cut` identity. **Medium.** | Ambiguous active/pin/history state; clicked definitions produced different SVGs. | `app/routes/png-to-svg-for-cricut.tsx`; shared additions/selector; parity collision row. | Preset-identity remediation; preserve default behavior and both definitions. Blocks consolidation. |
| `ILSVG-DEF-007` | `/jpeg-to-svg-converter`: one captured VTracer completion added the new result while active actions remained on the prior Potrace output. **High.** | Users can copy/download the wrong prior SVG; conversion bytes themselves completed; active history/update state became inconsistent. A final clean retry passed, so deterministic timing reproduction remains unresolved. | `app/routes/jpeg-to-svg-converter.tsx` history/result effects; `TraceOutputPanel.tsx`; captured 15,241-byte VTracer metrics versus 11,052-byte copy/download evidence and the Section 22 reproduction procedure. No screenshot asserts the race. | Converter-state remediation with a deterministic race regression; preserve JPG behavior, history, editing, filenames, and both engines. Blocks JPG/JPEG consolidation. |
| `ILSVG-DEF-008` | `/png-to-svg-for-shopify` exposes `Etsy PNG - Accurate trace (default)`. **Medium.** | Misleading platform default; output changes only through the selected preset/settings; no separate history corruption shown. | `app/routes/png-to-svg-for-shopify.tsx` wrapper behavior and `png-to-svg-for-shopify-desktop-default-preset.png`. | Default-identity/content remediation; preserve current conversion until an intentional baseline is approved. Blocks PNG-wrapper consolidation. |
| `ILSVG-DEF-009` | `/svg-to-favicon-generator` visible breadcrumb and BreadcrumbList target `/svg-favicon-generator`, which returns 404. **Medium.** | Broken navigation/schema; no generated package or history impact. | `app/routes/svg-to-favicon-generator.tsx`; runtime 404/schema audit; `svg-to-favicon-generator-desktop-breadcrumb.png`. | Navigation/schema remediation; preserve generator inputs, package manifest/snippet, canonical, and route. Blocks favicon consolidation. |
| `ILSVG-DEF-010` | `/svg-stroke-width-editor` targets invalid `/svg-stroke-width-adjust`. **Medium.** | Broken visible/schema navigation; no SVG output/history corruption shown. | `app/routes/svg-stroke-width-editor.tsx`; runtime 404/schema evidence; `svg-stroke-width-editor-desktop-breadcrumb.png`. | Navigation/schema remediation; preserve editor behavior and canonical. Blocks related route consolidation. |
| `ILSVG-DEF-011` | `/svg-flip-and-rotate-editor` targets invalid `/svg-flip-rotate-editor`. **Medium.** | Broken visible/schema navigation; no transformed output/history corruption shown. | `app/routes/svg-flip-and-rotate-editor.tsx`; runtime 404/schema evidence; `svg-flip-and-rotate-editor-desktop-breadcrumb.png`. | Navigation/schema remediation; preserve transform behavior and canonical. Blocks related consolidation. |
| `ILSVG-DEF-012` | `/sketch-to-svg-converter` renders rental-agreement/budgeting content. **Low.** | Confusing unrelated public guidance; no output/history impact. | `app/routes/sketch-to-svg-converter.tsx`; `sketch-to-svg-converter-desktop-content-bug.png`. | Focused public-content remediation; preserve the converter and useful sketch guidance. Content blocks consolidation. |
| `ILSVG-DEF-013` | Raster-converter UI exposes internal Potrace/VTracer/parity/backend notes. **Low.** | Internal terminology confuses users; no measured output/history impact. | `useHybridTraceFetcher.ts`, `enginePolicy.ts`, `TraceOutputPanel.tsx`, relevant converter routes; runtime report text/console evidence. | Focused public-content remediation; preserve honest limitation/error information and engine behavior. Content blocks consolidation where inherited. |
| `ILSVG-DEF-014` | Public converter/sitemap content includes SEO/editorial terminology such as keyword cluster and search intent. **Low.** | Editorial implementation language is user-visible; no output/history impact. | `OtherToolsLinks.tsx`, route guide sources, `app/routes/sitemap.tsx`; PNG/JPG/sitemap editorial screenshots. | Focused public-content remediation; preserve useful route links and do not alter All Tools. Content blocks consolidation mapping. |
| `ILSVG-DEF-015` | Favicon guidance simultaneously describes raster input support and an SVG-only/non-vectorizing limitation. **Medium.** | Users receive contradictory accepted-input guidance; package output/history is not shown corrupt. | `app/routes/svg-to-favicon-generator.tsx` and wrappers; favicon settings/result screenshots and accepted-input runtime checks. | Favicon content/capability clarification; preserve accepted inputs, 24-file manifest, snippets, ICO sizes, and route-specific workflows. Blocks favicon consolidation. |

### Evidence verdicts

- **Preset collisions:** all six are real identity defects. The cards are simultaneously reachable, active/pin state and label lookup are ID-only, and clicked objects supply their own values. Five tested pairs produced materially different SVGs; the logo pair matched only on the simple fixture. Immediate-submit metadata timing is strongly supported by source and remains separate from clicked-value correctness.
- **JPEG VTracer state:** the conversion and new-result metrics completed in the captured failing occurrence while actions remained on the prior Potrace item. The defect occurrence is confirmed and scoped to JPEG; the final clean retry passed, making deterministic reproduction and the exact scheduling boundary inconclusive. JPG is not classified as affected.
- **JPG/JPEG actions:** byte-, normalized-SVG-, and structural identity for four equal-input/equal-setting production-action scenarios. Workflow parity remains blocked.
- **PNG wrappers:** base, Canva, Figma, Shopify, Etsy, and transparent-PNG were byte-identical under equal settings; Glowforge differed through real laser post-processing. Defaults/content remain distinct.
- **SVG-to-PNG:** nine routes were byte- and pixel-identical for one 120 x 80 fixture/equal settings. Solid backgrounds composite transparent and partial-alpha pixels, remove alpha, and do not recolor fully opaque artwork.
- **Resizers:** seven routes serialized byte-identical output for the tested source/defaults; lock, unlocked dimensions/viewBox, and proportional scale alter output as documented.
- **Favicon packages:** nine routes had equivalent 24-entry package contents, manifests/snippets, and ICO entries. Raw ZIP bytes differed only through archive metadata. Settings and route content remain material distinctions.
- **Consolidation:** no family is redirect- or consolidation-ready. Output equality is neither workflow/content parity nor redirect evidence.

### Privacy, screenshots, and script review

The milestone text contains no absolute repository/user path, username, email address, cookie, session ID, credential, secret, token, environment value, browser-profile path, Downloads path, or private uploaded filename. Repository-relative source and deterministic fixture names are intentional. All 27 screenshots were visually reviewed, decode as PNG, are individually indexed, and contain no private desktop/browser/terminal material. Dimensions are 19 at 1425 x 990, four at 375 x 811, two at 1410 x 980, one at 390 x 843, and one at 360 x 778. Three mislabeled captures were replaced: expanded PNG presets, the code-to-Cricut sample result, and the mobile favicon result.

The parity script invokes production actions and browser behavior; its fixtures are deterministic/local, comparisons distinguish bytes, normalized SVG, decoded pixels, package entries, and raw ZIP metadata, and assertions exit nonzero on a comparison regression. Temporary fixtures live below the OS temporary directory, cleanup is in `finally`, browser shutdown is awaited with a Windows fallback, no external website or user Downloads folder is used, and the summary omits nondeterministic timestamps/ZIP hashes. Two independent full runs produced byte-identical JSON summaries with SHA-256 `178bc8bc60c44df440396b0fb6aa7fd63f9f44419d082c5990d2ff811b5834c0` and left no parity child processes or fixture children.

### Final validation matrix

| Check | Final result |
| --- | --- |
| Two independent `node scripts/converter-parity-audit.mjs` runs | Passed; byte-identical deterministic summaries; all focused collision/logo/PNG/SVG-to-PNG/resizer/favicon/partial-alpha evidence included |
| `node scripts/client-lifecycle-audit.mjs` | Passed |
| `npm run test:output-ux` | Passed |
| `npm run test:conversion-actions` | Passed |
| `npm run test:stage1-route-presets` | Passed: 67 routes, 798 preset smokes |
| Route-filtered JPEG VTracer checks | One attachment timeout, then clean VTracer copy/download/update pass; prior captured mismatch retained as confirmed but timing-sensitive |
| `node scripts/schema-audit.mjs` | Passed, zero failures |
| `node scripts/route-coverage-audit.mjs` | Passed: 157 registered, 156 public, 125 sitemap paths, zero failures |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with existing bundle/dynamic-import warnings |
| `npm test` | Passed |
| Script syntax and `node --check server.js` | Passed |
| UTF-8, trailing whitespace, `git diff --check` | Passed |
| PNG signature/decode/dimensions and index coverage | Passed: 27 of 27 |
| Absolute-path/privacy scan | Passed: zero milestone matches |

Failed or inconclusive checks are limited to known timing evidence: earlier focused-editor/post-conversion responsiveness thresholds failed while their correctness assertions passed; the first final JPEG attempt timed out during fixture attachment; and the captured JPEG active-output mismatch did not recur in the clean retry. None is represented as broader fixture or route failure. The audits do not cover every file type, preset, setting combination, browser engine, device, package consumer, or production traffic/SEO outcome, and they do not authorize consolidation.

### Preservation confirmation and next milestone

The existing All Tools implementation remains untouched, excluded from consolidation, and is not recommended for reduction, replacement, or removal. This milestone changes no production route, behavior, preset, setting, output, filename, public content, metadata, schema, canonical, sitemap, or All Tools content.

Recommended next milestone: **A focused production-defect remediation milestone for confirmed converter state and preset-identity defects.** Do not begin that milestone as part of this audit.
