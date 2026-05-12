# Phase 1F Refactor Checkpoint

Date: 2026-05-10

Branch: `final-refactor-and-polish-may-10-v2`

## 1. Executive summary

The local architecture cleanup is stable at this checkpoint. The completed work centralized route facts, lightweight wrapper metadata, shared wrapper wiring for a narrow wrapper shape, and selected docs/legal content without changing public route URLs, conversion behavior, upload validation, presets, navigation grouping, sitemap behavior, affiliate behavior, or SEO copy.

The safest refactor surface has mostly been used. Remaining route bloat is concentrated in large mixed-concern converter/editor modules that combine actions, loaders, client state, presets, output controls, and route copy. Those files should not be touched through broad shell migration yet.

Recommended next phase: start `Phase SEO-A`, a report-only SEO audit. This keeps SEO work separate from architecture refactors, avoids high-risk converter behavior, and creates a ranked plan before changing any titles, descriptions, schema, internal links, or route copy.

## 2. Completed refactor phases

| Phase | Commit | Result |
| --- | --- | --- |
| Phase 1A | `4ec2e82` | Added the route architecture audit. |
| Phase 1B | `0947865` | Added the full route/content manifest foundation. |
| Phase 1B.1 | `ed7714c` | Split manifest import boundaries so route modules avoid the full manifest. |
| Phase 1C-A | `fc2c968` | Expanded lightweight metadata usage to low-risk wrappers. |
| Phase 1C-B | `99485db` | Expanded SVG wrapper metadata usage. |
| Phase 1C-C | `799dfa6` | Split lightweight route metadata by family. |
| Phase 1C-D | `b97581b` | Migrated a final conservative wrapper metadata batch. |
| Phase 1D-A | `a5000cf` | Prototyped the shared wrapper route shell. |
| Phase 1D-B | `531eb82` | Expanded the shell to same-template SVG-to-PNG wrappers. |
| Phase 1D-C | `e97ef52` | Expanded the shell to favicon/ICO wrappers. |
| Phase 1D-D | `3d3fcda` | Documented shared-shell status and expansion risk. |
| Phase 1E-A | `0c8eaf5` | Extracted static content from the how-it-works docs family. |
| Phase 1E-B | `1a0900f` | Extracted static legal/docs content from cookies and terms. |
| Phase 1E-C | `13140b9` | Extracted privacy policy content into scoped legal content. |

## 3. Current centralized architecture

Route facts are centralized in `app/data/routeManifest.ts`. It currently covers 139 registered route facts for audits and build-time checks, including path, source file, route family, public/indexable/sitemap/nav flags, canonical path, related links, guide classification, and test coverage classification.

Shared manifest types live in `app/data/routeManifest.types.ts`. Route modules do not import the full manifest for metadata.

Lightweight route metadata is split by family under `app/data/routeMeta/`:

| Module | Purpose | Source size |
| --- | --- | ---: |
| `createManifestMeta.ts` | Shared metadata helper only. | 1,300 bytes |
| `canvaFigma.ts` | Canva/Figma wrapper metadata. | 2,113 bytes |
| `marketplaceExport.ts` | Etsy/Shopify/Printify/Printful and print PNG export metadata. | 2,607 bytes |
| `marketplaceCraft.ts` | Etsy/Shopify/Silhouette craft SVG metadata. | 1,658 bytes |
| `faviconExport.ts` | Favicon and ICO wrapper metadata. | 2,917 bytes |
| `svgPlatformTools.ts` | SVG resizer and cleaner platform wrapper metadata. | 3,111 bytes |

The shared wrapper shell is `app/routes/_shared/createTemplateWrapperRoute.ts`. It centralizes only route path binding, metadata factory hookup, and template component binding.

Static content is scoped under `app/content/`:

| Module | Purpose | Source size |
| --- | --- | ---: |
| `app/content/docs/howItWorksRouteContent.ts` | How-it-works docs family copy and guide data. | 16,127 bytes |
| `app/content/legal/policyRouteContent.ts` | Cookies and terms legal content. | 11,011 bytes |
| `app/content/legal/privacyPolicyContent.tsx` | Privacy policy legal content. | 31,646 bytes |

Audit scripts now enforce route and bundle boundaries:

- `scripts/route-coverage-audit.mjs`
- `scripts/navigation-audit.mjs`
- `scripts/manifest-bundle-audit.mjs`
- `scripts/production-logging-audit.mjs`

## 4. Remaining duplication hotspots

The low-risk duplication is mostly handled for the migrated wrapper groups. Remaining duplication is higher risk because it is interleaved with behavior:

- Core converter route modules still mix route copy, metadata, upload UI, actions/loaders, settings, presets, preview state, output controls, and conversion request construction.
- Cricut/cut-file routes repeat route-specific conversion/preset/output logic but are not safe for broad extraction without a dedicated capability map.
- Layered/server-assisted raster routes still carry expensive conversion behavior and layered output controls in route modules.
- Base64/code routes are large and bespoke, with validation, decoding, samples, and utility UI tightly coupled.
- Complex SVG editor routes still combine editor state, SVG parsing/sanitization, output rendering, and static guide/FAQ copy.
- Some static content remains inside route modules, but the next extraction should be chosen only after confirming it is not coupled to runtime state.

Safer route families now:

- Metadata-only Canva/Figma wrappers.
- Metadata-only marketplace export and craft wrappers.
- Metadata-only favicon/ICO wrappers.
- Metadata-only SVG resizer/cleaner platform wrappers.
- How-it-works docs pages.
- Cookies, terms, and privacy legal pages.

Riskier route families still deferred:

- Home page and source-of-truth converter UX.
- Base64/code utility routes.
- Cricut/cut-file routes.
- Layered SVG routes.
- Server-assisted raster-to-SVG routes.
- Complex SVG editor implementation routes.

## 5. Largest route modules and risk ranking

Largest route modules by line count:

| Rank | Route module | Lines | Main bloat type | Cleanup value | Risk | Recommendation |
| ---: | --- | ---: | --- | --- | --- | --- |
| 1 | `app/routes/home.tsx` | 6,303 | Source-of-truth converter UX, action/loader, client state, presets, output controls, static copy. | Very high | Very high | Defer until a dedicated home-source-of-truth extraction plan exists. |
| 2 | `app/routes/base64-to-svg.tsx` | 5,055 | Base64 validation, samples, state, output/copy/download, route copy. | High | Very high | Defer. Audit separately before touching. |
| 3 | `app/routes/base64-to-svg-for-cricut.tsx` | 4,813 | Base64 plus Cricut-specific output intent. | High | Very high | Defer. Do not combine with general Base64 work. |
| 4 | `app/routes/code-to-svg-for-cricut.tsx` | 4,676 | Code samples, validation, UI state, route copy, output behavior. | High | Very high | Defer. It is explicitly high risk. |
| 5 | `app/routes/emoji-to-svg-converter.tsx` | 4,400 | Utility state, conversion behavior, static guide copy, output controls. | Medium | High | Audit only. Possible later content extraction if isolated. |
| 6 | `app/routes/png-to-layered-svg-for-cricut.tsx` | 4,184 | Layered conversion, server action, settings, output controls. | High | Very high | Defer until layered capability model work. |
| 7 | `app/routes/drawing-to-svg-for-cricut.tsx` | 3,856 | Server-assisted Cricut conversion, presets, static copy. | Medium | High | Defer. Candidate only after Cricut route map exists. |
| 8 | `app/routes/image-to-svg-for-cricut.tsx` | 3,687 | Server-assisted Cricut conversion, presets, output controls. | Medium | High | Defer. Candidate only after representative Cricut prototype. |
| 9 | `app/routes/cricut-svg-converter.tsx` | 3,670 | Cricut conversion shell, settings, output behavior, route copy. | Medium | High | Defer. Needs behavior inventory first. |
| 10 | `app/routes/jpeg-to-svg-for-cricut.tsx` | 3,553 | Server-assisted Cricut raster conversion and route copy. | Medium | High | Defer. Same family as other Cricut routes. |
| 11 | `app/routes/jpg-to-svg-for-cricut.tsx` | 3,539 | Server-assisted Cricut raster conversion and route copy. | Medium | High | Defer. Do not migrate as a wrapper. |
| 12 | `app/routes/black-and-white-image-to-svg-for-cricut.tsx` | 3,468 | Cricut-specific raster conversion, presets, output controls. | Medium | High | Defer. |
| 13 | `app/routes/jpeg-to-svg-converter.tsx` | 3,419 | General raster conversion action/state/presets/output. | High | High | Potential later shared converter-shell prototype, not yet. |
| 14 | `app/routes/icon-to-svg-converter.tsx` | 3,311 | Raster conversion plus icon-specific route copy. | Medium | High | Defer until general raster route map exists. |
| 15 | `app/routes/jpg-to-svg-converter.tsx` | 3,290 | General raster conversion action/state/presets/output. | High | High | Potential later shared converter-shell prototype, not yet. |
| 16 | `app/routes/drawing-to-svg-converter.tsx` | 3,242 | General raster conversion plus drawing intent. | Medium | High | Defer until general raster route map exists. |
| 17 | `app/routes/black-and-white-image-to-svg-converter.tsx` | 3,238 | General raster conversion with B/W intent. | Medium | High | Defer until general raster route map exists. |
| 18 | `app/routes/inline-svg-vs-img.tsx` | 3,155 | Static educational content plus interactive/client utility behavior. | Medium | Medium | Possible future static content extraction after isolated audit. |
| 19 | `app/routes/sketch-to-svg-for-cricut.tsx` | 3,141 | Cricut conversion and presets. | Medium | High | Defer with Cricut family. |
| 20 | `app/routes/layered-svg-for-cricut.tsx` | 3,115 | Layered conversion and Cricut behavior. | High | Very high | Defer with layered routes. |

Highest cleanup value is in the general raster and Cricut families, but those are also the easiest places to break conversion behavior, presets, upload validation, output state, or history. They should be approached through report-only mapping first, not direct extraction.

## 6. Bundle/import boundary status

Latest manifest bundle audit result:

- Checked client chunks: 185.
- Full `routeManifest` client assets: `0`.
- Old routeMeta monolith client assets: `[]`.
- Shared metadata helper asset: `createManifestMeta-MMPlsdkl.js`, 645 bytes.
- Shared route shell asset: `createTemplateWrapperRoute-DTS9BcdK.js`, 90 bytes.

Family metadata client assets:

| Family | Asset | Bytes |
| --- | --- | ---: |
| `canvaFigma` | `canvaFigma-h88QsMDu.js` | 1,588 |
| `marketplaceExport` | `marketplaceExport-B0N1LGhy.js` | 2,004 |
| `marketplaceCraft` | `marketplaceCraft-BHFFmVre.js` | 1,174 |
| `faviconExport` | `faviconExport-DFcnSiQ0.js` | 2,301 |
| `svgPlatformTools` | `svgPlatformTools-CEBT82_y.js` | 2,434 |

Content bundle status:

- `howItWorksRouteContent-DowGVacn.js` is scoped to the how-it-works docs family.
- `policyRouteContent-gz5yT-Fr.js` is scoped to cookies and terms.
- Privacy policy content is scoped to the `privacy-policy-M4CIE9-w.js` route chunk.
- Unique privacy strings were found only in the privacy policy route chunk.
- No `app/content` barrel file exists.
- No global content chunk was observed.

The bundle audit verifies that migrated wrapper route chunks import only their expected routeMeta family asset and do not pull unrelated metadata families. The full manifest remains audit/build-time only.

## 7. Shared shell assessment

Current shared shell:

- `app/routes/_shared/createTemplateWrapperRoute.ts`

It centralizes:

- metadata factory hookup
- route path binding
- template component binding

It intentionally does not centralize:

- conversion logic
- actions/loaders
- upload parsing
- output/copy/download behavior
- presets
- affiliate/ad behavior
- navigation
- sitemap
- SEO content
- route file layout

Routes using the shared shell:

- `/svg-to-png-for-canva`
- `/svg-to-png-for-figma`
- `/svg-to-png-for-etsy`
- `/svg-to-png-for-shopify`
- `/svg-to-png-for-printify`
- `/svg-to-png-for-printful`
- `/svg-to-transparent-png-for-printing`
- `/png-to-ico-converter`
- `/svg-to-ico-converter`
- `/png-to-favicon-generator`
- `/jpg-to-favicon-generator`
- `/logo-to-favicon-generator`
- `/image-to-favicon-generator`

Assessment: pause shared-shell expansion for now. The helper is safe for the exact shape it handles, but broadening it toward conversion shells would require a route capability map, preset inventory, action/loader parity proof, and targeted route smoke coverage.

## 8. Static content extraction assessment

Static extraction has been useful where routes are docs/legal pages or mostly static route-copy pages:

- How-it-works docs content is now in a scoped docs module.
- Cookies and terms legal content now share a scoped legal policy module.
- Privacy policy copy now lives in a dedicated privacy content module, avoiding privacy content in cookies/terms chunks.

Static extraction should pause for legal/docs pages unless a specific bloat issue appears. The next static candidates, such as large educational utility pages, must be audited route by route because several combine static copy with interactive client behavior.

Good future static-content candidates:

- Educational utility pages with bulky static copy and no actions/loaders.
- Route FAQ/schema arrays that are clearly static and not coupled to runtime state.
- Guide card arrays in low-risk docs-style routes.

Deferred static-content candidates:

- Home page.
- Cricut/cut-file routes.
- Base64/code routes.
- Layered/server-assisted raster routes.
- Complex SVG editor implementation pages.

## 9. Future SEO-A audit

Do not change SEO content as part of this architecture checkpoint.

A future dedicated `Phase SEO-A` audit should review:

- English-first, mostly US search audience targeting.
- Page titles.
- Meta descriptions.
- Canonical tags.
- H1/H2 structure.
- Route-specific SEO sections.
- Internal linking.
- Schema and FAQ quality.
- Duplicate or thin-page risk.
- Keyword targeting without stuffing.
- Practical user value in lower-page SEO sections.

This should be separate from architecture refactors. The audit should produce recommendations first, then any SEO content changes should be applied in small route-family batches with metadata and route-smoke parity checks.

## 10. Recommended next implementation phase

Recommended next phase: `Phase SEO-A`, report-only SEO audit.

Why this is the safest next package:

- It does not require touching conversion behavior, upload validation, output behavior, presets, navigation grouping, sitemap behavior, or route URLs.
- It keeps SEO decisions separate from route architecture cleanup.
- It can identify duplicate/thin-page risk before any route copy is changed.
- It provides a safer basis for future SEO edits than continuing opportunistic content extraction.
- It avoids starting shared converter-shell work before route capabilities and behavior contracts are mapped.

Not recommended next:

- Continuing shared shell expansion: current low-risk shell candidates are mostly exhausted.
- Starting a converter-shell prototype immediately: the largest candidates are behavior-heavy and high risk.
- Continuing legal/docs static extraction broadly: privacy, cookies, terms, and how-it-works have already been extracted.
- Production deployment: this branch is still a local refactor branch and this phase is report-only.

## 11. Required regression gates for the next phase

For `Phase SEO-A` report-only audit:

- `git status --short --branch`
- `git branch --show-current`
- `git diff --stat`
- `git diff --name-only`
- `git log --oneline --decorate -n 80`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `npm.cmd run test:manifest-bundle`
- `npm.cmd run test:production-logging`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run build`
- `npm.cmd audit`
- `node --check scripts/manifest-bundle-audit.mjs`
- `node --check scripts/route-coverage-audit.mjs`
- `node --check scripts/navigation-audit.mjs`
- `git diff --check`

If the SEO audit leads to implementation later, add route-family parity checks for every changed route:

- route returns 200
- public route URL unchanged
- title and description changes are intentional and documented
- canonical unchanged unless the audit proves a bug
- H1/H2 changes are intentional and documented
- FAQ/schema output preserved or intentionally changed
- route coverage, nav, and link audits remain clean
- no conversion/editor/output behavior touched
- no full `routeManifest` client asset
- no routeMeta monolith
