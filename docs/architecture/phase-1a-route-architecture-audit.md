# Phase 1A Route Architecture Audit

Date: 2026-05-10

Branch: final-refactor-and-polish-may-10

Scope: architecture, deduplication, and maintainability audit only. No refactor, route move, URL change, conversion behavior change, preset change, upload validation change, sitemap/nav behavior change, SEO metadata change, or deployment was performed.

## 1. Executive Summary

The app currently registers 139 app routes in `app/routes.ts`. The production surface is working, but the route architecture has two very different styles:

- Newer route-expansion pages are thin wrappers that reuse an existing full route module and only override metadata.
- Older primary converter pages are large route-local modules that combine route metadata, server action handling, upload/decode logic, conversion settings, presets, UI state, output/history behavior, guide/FAQ content, related links, and monetization placement.

The highest-value cleanup is not a conversion rewrite. It is a staged data and shell migration:

1. Introduce a read-only route/content manifest as the source of truth for public route metadata, sitemap intent, nav/related-tool intent, route family, and test coverage classification.
2. Use that manifest to reduce drift across `app/routes.ts`, `public/sitemap.xml`, `app/routes/sitemap.tsx`, `toolNavSections.ts`, and `OtherToolsLinks.tsx`.
3. Extract inline route content and FAQ/sample payloads from giant route modules before moving server actions or client conversion code.
4. Consolidate route wrappers and route metadata helpers first.
5. Migrate converter shells family by family, with the home page and server-assisted upload/conversion modules last.

The safest first migration family is the route-expansion wrapper and metadata layer, followed by static documentation pages and client-only SVG utility pages. The highest-risk modules are the home route, base64/code routes, layered SVG routes, and any route-local server action that accepts uploads or calls Sharp/Potrace/VTracer.

## 2. Route Family Inventory

Source of inventory: `app/routes.ts`, route modules in `app/routes/`, `scripts/route-coverage-audit.mjs`, and route capability/navigation data.

| Family | Count | Representative routes | Notes |
| --- | ---: | --- | --- |
| Raster-to-SVG routes | 20 | `/`, `/png-to-svg-converter`, `/jpg-to-svg-converter`, `/jpeg-to-svg-converter`, `/webp-to-svg-converter`, `/logo-to-svg-converter`, `/icon-to-svg-converter`, `/line-art-to-svg-converter`, `/drawing-to-svg-converter`, `/scan-to-svg-converter`, `/sketch-to-svg-converter`, `/photo-to-svg-outline`, `/image-to-svg-outline`, `/black-and-white-image-to-svg-converter`, `/sticker-to-svg-converter`, `/gif-to-svg-converter`, `/avif-to-svg-converter`, `/bmp-to-svg-converter`, `/tiff-to-svg-converter`, `/transparent-png-to-svg-converter` | Mix of full route modules and thin wrappers. Core upload/decode/action logic is repeated across the larger full modules. |
| Cricut, craft, and marketplace routes | 37 | `/png-to-svg-for-cricut`, `/cricut-svg-converter`, `/image-to-svg-for-cricut`, `/jpg-to-svg-for-cricut`, `/jpeg-to-svg-for-cricut`, `/webp-to-svg-for-cricut`, `/photo-to-svg-for-cricut`, `/line-art-to-svg-for-cricut`, `/drawing-to-svg-for-cricut`, `/sketch-to-svg-for-cricut`, `/sticker-to-svg-for-cricut`, `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-silhouette`, `/png-to-svg-for-etsy`, `/png-to-svg-for-shopify`, `/png-to-svg-for-canva`, `/png-to-svg-for-figma`, platform-specific Etsy, Shopify, Canva, Figma, Glowforge, and Silhouette routes | Most full Cricut routes are large and server-assisted. Platform routes are often thin metadata wrappers around existing converter modules. |
| Layered SVG routes | 8 | `/png-to-layered-svg-for-cricut`, `/layered-svg-for-cricut`, `/image-to-layered-svg-for-cricut`, `/jpg-to-layered-svg-for-cricut`, `/logo-to-layered-svg-for-cricut`, `/image-to-layered-svg-converter`, `/jpg-to-layered-svg-converter`, `/logo-to-layered-svg-converter` | High risk because layered presets, VTracer output, layer editing, source snapshots, history, and post-processing interact. |
| SVG export and editor routes | 42 | `/svg-to-png-converter`, `/svg-to-jpg-converter`, `/svg-to-webp-converter`, `/svg-to-pdf-converter`, `/svg-background-editor`, `/svg-resize-and-scale-editor`, `/svg-recolor`, `/svg-minifier`, `/svg-cleaner`, `/svg-preview-viewer`, `/svg-to-favicon-generator`, `/svg-to-ico-converter`, favicon routes, platform SVG export routes, SVG resizer/cleaner routes | Better first shell candidate than raster upload routes because many are client-only or reuse export behavior. Still must preserve copy/download/update-preview/fullscreen behavior. |
| Text, Base64, and code routes | 10 | `/svg-to-base64`, `/base64-to-svg`, `/base64-to-svg-for-cricut`, `/code-to-svg-for-cricut`, `/text-to-svg-converter`, `/emoji-to-svg-converter`, `/svg-to-jsx-converter`, `/svg-embed-code-generator`, `/inline-svg-vs-img`, `/free-color-picker` | Several are very large and contain inline samples, parser logic, sanitizer boundaries, copy/download behavior, and route-specific forms. |
| Documentation and static content pages | 10 | `/how-it-works`, `/how-it-works/conversion-workflow`, `/how-it-works/presets`, `/how-it-works/settings`, `/how-it-works/troubleshooting`, `/how-it-works/exporting-and-downloads`, `/pro-waitlist`, `/cookies`, `/privacy-policy`, `/terms-of-service` | Low conversion risk. Metadata, sitemap, and navigation consistency can be audited from a manifest early. Legal pages are noindex and should stay that way. |
| Redirect and alias routes | 10 | `/image-to-svg-converter`, `/black-and-white-png-to-svg-converter`, `/tif-to-svg-converter`, `/svg-to-react-component`, `/svg-to-css-background`, `/svg-to-data-uri-converter`, `/svg-inline-code-generator`, `/svg-viewbox-editor`, `/svg-code-cleaner`, `/svg-transparent-background-tool` | Keep these as explicit alias routes until route coverage confirms redirect destinations, canonicals, and sitemap exclusions. |
| API/action routes | 1 | `/api/batch-svg` | High-risk compute path. Keep isolated from layout/content refactors. |
| Sitemap/meta routes | 1 | `/sitemap` | HTML sitemap is large inline route content and duplicates XML sitemap/nav intent. |

## 3. Giant Route Modules Ranked by Cleanup Value

Measured from `app/routes/*.tsx` line counts and feature flags. Cleanup value ranks the combination of file size, duplicated patterns, inline content, and risk of future drift.

| Rank | Route module | Lines | Approx size | Current responsibilities | Cleanup value | Risk |
| ---: | --- | ---: | ---: | --- | --- | --- |
| 1 | `app/routes/home.tsx` | 6303 | 231 KB | Metadata, loader, action, upload/decode, presets, batch UI, settings, output/history, guide content, ads/affiliate | Very high | Very high |
| 2 | `app/routes/code-to-svg-for-cricut.tsx` | 4676 | 1365 KB | Metadata, loader, action, code parsing, inline sample data, converter UI, output behavior, guide content | Very high | High |
| 3 | `app/routes/base64-to-svg.tsx` | 5055 | 248 KB | Metadata, loader, action, Base64 parser, SVG sanitizer, UI, presets, guide content | Very high | High |
| 4 | `app/routes/base64-to-svg-for-cricut.tsx` | 4813 | 241 KB | Base64 route variant, Cricut-specific output intent, action/UI duplication | Very high | High |
| 5 | `app/routes/emoji-to-svg-converter.tsx` | 4400 | 151 KB | Text/emoji input, SVG generation, route-local FAQs, output behavior | High | Medium |
| 6 | `app/routes/png-to-layered-svg-for-cricut.tsx` | 4184 | 149 KB | Upload/action, layered presets, VTracer path, output editing/history | High | Very high |
| 7 | `app/routes/drawing-to-svg-for-cricut.tsx` | 3856 | 120 KB | Route-local trace action, presets, output UI, guide/ads | High | High |
| 8 | `app/routes/image-to-svg-for-cricut.tsx` | 3687 | 115 KB | Route-local trace action, presets, output UI, guide/ads | High | High |
| 9 | `app/routes/cricut-svg-converter.tsx` | 3670 | 118 KB | Route-local trace action, presets, output UI, guide/ads | High | High |
| 10 | `app/routes/jpeg-to-svg-for-cricut.tsx` | 3553 | 113 KB | Route-local trace action, presets, output UI, guide/ads | High | High |
| 11 | `app/routes/jpg-to-svg-for-cricut.tsx` | 3539 | 112 KB | Route-local trace action, presets, output UI, guide/ads | High | High |
| 12 | `app/routes/jpeg-to-svg-converter.tsx` | 3419 | 106 KB | Route-local raster converter UI/action with JPG/JPEG-specific content | High | High |
| 13 | `app/routes/jpg-to-svg-converter.tsx` | 3290 | 101 KB | Route-local raster converter UI/action with JPG-specific content | High | High |
| 14 | `app/routes/icon-to-svg-converter.tsx` | 3311 | 102 KB | Route-local raster converter UI/action with icon-specific presets | Medium-high | High |
| 15 | `app/routes/inline-svg-vs-img.tsx` | 3155 | 110 KB | Static/utility guide plus code/output UI and FAQs | Medium-high | Medium |
| 16 | `app/routes/free-color-picker.tsx` | 2756 | 91 KB | Client utility UI, output/copy behavior, guide content | Medium | Low-medium |
| 17 | `app/routes/svg-embed-code-generator.tsx` | 2588 | 95 KB | Client SVG code utility, output/copy behavior, guide content | Medium | Medium |
| 18 | `app/routes/sitemap.tsx` | 982 | 34 KB | HTML sitemap data, metadata, schema, layout | Medium | Low |

Additional quantitative signals:

- 139 route modules exist in `app/routes`.
- 63 route modules are thin wrappers under roughly 80 lines.
- 45 route files export an `action`.
- 46 route files contain upload/decode patterns such as `sharp`, `metadata`, `arrayBuffer`, multipart parsing, or `validateUploadedImage`.
- 135 route files export route metadata.
- 138 route files reference canonical behavior.
- 67 route files render `OtherToolsLinks`.
- 64 route files render `ContextualAffiliateCard`.
- 67 route files reference AdSense components.
- 40 route files reference shared or bespoke output panels.

## 4. Duplication Hotspots

### Page Shell and Layout

Repeated across many full route modules:

- Header/tool card/output workspace structure.
- Utility-first converter layout.
- Preset display and expansion plumbing.
- Advanced settings visibility and focused editor behavior.
- Upload card, selected-file state, convert button, and error messaging.
- SEO/help content placement below the tool.
- Monetization sections below the utility.

Existing shared pieces reduce some duplication:

- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/BespokeTraceOutputPanel.tsx`
- `app/client/components/converter/FullscreenOutputPreview.tsx`
- `app/client/components/converter/PresetSelector.tsx`
- `app/client/components/converter/AdvancedSettingsPanel.tsx`

The remaining duplication is mostly route module orchestration and route-specific content/config wiring.

### Metadata and Canonical Generation

Nearly every route module owns its own `meta` function with duplicated title, description, viewport, theme color, canonical, Open Graph title/description/type/url, and sometimes robots data. Thin wrapper routes are especially repetitive.

Risk: metadata drift, missing canonical behavior, duplicated aliases, sitemap mismatches.

### Sitemap, Navigation, and Related Links

Route knowledge is currently spread across:

- `app/routes.ts`
- `public/sitemap.xml`
- `app/routes/sitemap.tsx`
- `app/client/components/navigation/toolNavSections.ts`
- `app/client/components/navigation/OtherToolsLinks.tsx`
- `scripts/route-coverage-audit.mjs`
- `scripts/navigation-audit.mjs`
- route modules with inline metadata

`OtherToolsLinks.tsx` has a large `ROUTE_GUIDES`, `RELATED_LINKS`, `UTILITY_SECTIONS`, and `UTILITIES` surface. `toolNavSections.ts` and `sitemap.tsx` repeat much of the same route intent and label data.

Risk: a route can be indexable but missing from XML sitemap, present in nav but absent from related links, or redirected but still listed as a normal tool.

### Presets and Config

Many route modules define local `PRESETS` and `DISPLAY_PRESETS`, then pass them through `extendTracePresets` or `extendLayeredPresets`.

Existing shared preset surfaces:

- `app/client/lib/converter/presetAdditions.ts`
- `app/client/lib/converter/presetIntensity.ts`
- `app/client/lib/converter/routeCapabilities.ts`

Risk: route-local preset arrays may drift from capability rules, intensity metadata, settings UI, and backend server settings.

### Server Action and Upload Parsing

Large raster/Cricut/layered routes repeat:

- Form parsing and multipart handling.
- File upload extraction.
- MIME, extension, and dimension checks.
- Sharp metadata reads.
- Potrace/VTracer selection.
- Safe error response mapping.
- Rate-limit and conversion gate checks.

Existing shared safety helpers exist in `app/utils/backendSecurity.server.ts` and server setting parsing exists in `app/utils/converterSettings.server.ts`, but action orchestration remains route-local.

Risk: high. This is where production behavior, upload safety, and conversion output can regress.

### Output, Copy, Download, and History

Shared output components exist, but many routes still own state orchestration for:

- output history
- active output
- source file snapshots
- copy/download labels
- fullscreen preview
- update-preview behavior
- layer editing state

Existing helper files:

- `app/client/lib/converter/outputHistory.ts`
- `app/client/lib/converter/sourceSnapshots.ts`
- `app/client/lib/converter/outputAppearance.ts`

Risk: medium-high because browser smoke already covers this behavior and users depend on it.

### Affiliate and Ad Placement

Recent work centralized affiliate waterfall storage and state. Route modules still repeat placement calls and related spacing in many places.

Existing shared files:

- `app/client/lib/monetization/useAffiliateWaterfall.ts`
- `app/client/lib/monetization/affiliateWaterfallStorage.ts`
- `app/client/components/ads/ContextualAffiliateCard.tsx`

Risk: medium. Do not combine monetization shell work with converter action refactors.

## 5. Proposed Route and Content Manifest Shape

Do not implement this in one pass. Start read-only and audit-only, then migrate consumers after tests prove parity.

Suggested file location:

```ts
app/client/lib/routes/toolRouteManifest.ts
```

Suggested shape:

```ts
export type ToolRouteFamily =
  | "raster-to-svg"
  | "cricut-craft"
  | "layered-svg"
  | "svg-export"
  | "svg-editor"
  | "text-base64-code"
  | "documentation"
  | "static"
  | "redirect"
  | "api";

export type ToolRouteManifestEntry = {
  id: string;
  path: string;
  sourceFile: string;
  family: ToolRouteFamily;
  public: boolean;
  indexable: boolean;
  sitemap: "xml-and-html" | "html-only" | "exclude";
  canonicalPath: string;
  redirectTo?: string;
  title: string;
  description: string;
  h1: string;
  nav?: {
    primary?: boolean;
    sectionId?: string;
    label: string;
    keywords?: string[];
    priority?: number;
  };
  related?: {
    href: string;
    reason?: string;
  }[];
  content?: {
    guideId?: string;
    faqId?: string;
    docsSectionId?: string;
  };
  converter?: {
    shell:
      | "raster-trace"
      | "cricut-trace"
      | "layered-trace"
      | "svg-export"
      | "svg-utility"
      | "text-code"
      | "static";
    capabilityRouteId?: string;
    acceptsUpload: boolean;
    acceptedInputFormats: string[];
    outputFormats: string[];
    presetGroupIds?: string[];
    routeSpecificDefaults?: string;
  };
  monetization?: {
    affiliateCategories?: string[];
    adSlots?: string[];
  };
  testCoverage?: {
    routeSmoke: boolean;
    conversionAction: boolean;
    hybridBrowser: boolean;
    utilityLayout: boolean;
    accessibility: boolean;
    stage1PresetSmoke: boolean;
  };
};
```

Migration order:

1. Create a manifest from existing known-good route data without changing consumers.
2. Add an audit that compares manifest paths to `app/routes.ts`, XML sitemap, HTML sitemap, nav sections, and related-tool links.
3. Migrate sitemap generation to consume manifest route labels and indexability decisions.
4. Migrate navigation and related-tool data to consume manifest sections.
5. Migrate route metadata helpers for thin wrappers.
6. Migrate full route modules only after metadata/nav/sitemap parity is locked.

## 6. Proposed Shared Shell Architecture

### RasterTraceRouteShell

Candidate routes:

- `/png-to-svg-converter`
- `/jpg-to-svg-converter`
- `/jpeg-to-svg-converter`
- `/webp-to-svg-converter`
- `/logo-to-svg-converter`
- `/icon-to-svg-converter`
- `/line-art-to-svg-converter`
- `/drawing-to-svg-converter`
- `/scan-to-svg-converter`
- `/sketch-to-svg-converter`
- `/photo-to-svg-outline`
- `/image-to-svg-outline`
- `/black-and-white-image-to-svg-converter`
- `/sticker-to-svg-converter`
- `/gif-to-svg-converter`
- `/avif-to-svg-converter`
- `/bmp-to-svg-converter`
- `/tiff-to-svg-converter`
- `/transparent-png-to-svg-converter`

Config fields:

- route id/path/title/description/H1
- accepted formats
- output filename base
- initial preset id
- preset list or preset group ids
- supported capability route id
- upload copy and route-specific notes
- route-specific related links/guide id
- affiliate categories

Exceptions:

- Home has batch behavior and should remain separate until last.
- Photo/outline routes may use different preprocessing defaults.
- Sticker/icon/logo routes may have route-specific presets and background behavior.

Risk: high for server-assisted full modules, low-medium for thin wrapper aliases after shell exists.

Suggested first route in this family: `webp-to-svg-converter` or another lower-traffic raster route only after route metadata and content extraction are complete. Do not start with `/` or `/png-to-svg-converter`.

### CricutCraftRouteShell

Candidate routes:

- `/png-to-svg-for-cricut`
- `/jpg-to-svg-for-cricut`
- `/jpeg-to-svg-for-cricut`
- `/webp-to-svg-for-cricut`
- `/image-to-svg-for-cricut`
- `/photo-to-svg-for-cricut`
- `/logo-to-svg-for-cricut`
- `/line-art-to-svg-for-cricut`
- `/drawing-to-svg-for-cricut`
- `/sketch-to-svg-for-cricut`
- `/sticker-to-svg-for-cricut`
- `/cricut-svg-converter`
- `/png-to-svg-for-cricut-vinyl`
- `/png-to-svg-for-cricut-stickers`
- `/png-to-svg-for-cricut-print-then-cut`
- platform craft routes for Silhouette, Glowforge, Etsy, Shopify, Canva, and Figma where behavior is equivalent.

Config fields:

- route intent label
- craft platform
- accepted formats
- cut-friendly defaults
- preset group ids
- post-processing defaults
- related marketplace links
- route-specific output naming

Exceptions:

- Print Then Cut has specific output behavior and should migrate separately.
- Sticker routes may have extra border/printing concerns.
- Platform routes that are pure wrappers should be handled before full route modules.

Risk: high because the routes are server-assisted and cut-file quality is core behavior.

Suggested first route family: thin marketplace/platform wrappers only, then one low-traffic full craft route.

### LayeredTraceRouteShell

Candidate routes:

- `/layered-svg-for-cricut`
- `/png-to-layered-svg-for-cricut`
- `/image-to-layered-svg-for-cricut`
- `/jpg-to-layered-svg-for-cricut`
- `/logo-to-layered-svg-for-cricut`
- `/image-to-layered-svg-converter`
- `/jpg-to-layered-svg-converter`
- `/logo-to-layered-svg-converter`

Config fields:

- layered trace defaults
- palette/layer count defaults
- layer build mode
- layer editing support
- source snapshot behavior
- preset group ids
- route-specific platform/craft copy

Exceptions:

- `/png-to-layered-svg-for-cricut` is large and heavily covered. Keep it as the reference until later.
- Generic layered converter wrappers can be migrated first if they only override metadata and reuse full route behavior.

Risk: very high.

Suggested first route: generic wrapper routes, not core layered implementation.

### SvgExportRouteShell

Candidate routes:

- `/svg-to-png-converter`
- `/svg-to-jpg-converter`
- `/svg-to-webp-converter`
- `/svg-to-pdf-converter`
- `/svg-to-ico-converter`
- `/svg-to-favicon-generator`
- `/image-to-favicon-generator`
- `/png-to-favicon-generator`
- `/jpg-to-favicon-generator`
- `/logo-to-favicon-generator`
- `/png-to-ico-converter`
- platform SVG export wrappers for Etsy, Shopify, Canva, Figma, Printify, Printful, and printing routes.

Config fields:

- output format
- export size controls
- background/quality controls
- icon/favicon package settings
- paste/upload mode
- output filename base
- route-specific export help

Exceptions:

- PDF export and favicon package generation have specialized output logic.
- SVG-to-PNG is high-demand and should not be first.

Risk: medium.

Suggested first route: a platform wrapper such as `/svg-to-png-for-canva`, then a lower-risk client-only export route.

### SvgUtilityRouteShell

Candidate routes:

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
- platform-specific SVG cleaner/resizer wrappers.

Config fields:

- input mode
- local transform function
- settings groups
- copy/download support
- preview mode
- guide/FAQ ids

Exceptions:

- Security-sensitive sanitizer routes such as SVG Cleaner and Minifier need dedicated sanitizer tests.
- Accessibility/contrast checker has unique analysis UI.

Risk: low-medium to medium.

Suggested first route: wrapper routes for SVG cleaner/resizer variants, then a small client-only utility.

### TextCodeSvgRouteShell

Candidate routes:

- `/text-to-svg-converter`
- `/emoji-to-svg-converter`
- `/code-to-svg-for-cricut`
- `/svg-to-jsx-converter`
- `/svg-embed-code-generator`
- `/svg-to-base64`
- `/base64-to-svg`
- `/base64-to-svg-for-cricut`
- `/inline-svg-vs-img`

Config fields:

- input kind
- parser/validator
- sanitizer policy
- generated SVG defaults
- sample payload id
- copy/download support
- guide/FAQ ids

Exceptions:

- `code-to-svg-for-cricut.tsx` has enormous inline sample/demo data and should first have data extraction only.
- Base64 routes have sanitizer and embedded image behavior that should remain untouched until tests are expanded.

Risk: medium-high to high.

Suggested first route: metadata/content extraction for `svg-to-jsx-converter` or `svg-embed-code-generator`, not parser behavior.

## 7. Proposed Thin Route Module Convention

Do not move files in Phase 1A. For a later migration, use a temporary compatibility pattern so `app/routes.ts` can keep existing file targets until route moves are safe.

Suggested eventual convention:

```text
app/routes/<slug>.tsx                     // thin compatibility re-export during migration
app/routes/<slug>/route.tsx               // route exports: meta, loader, action, default
app/routes/<slug>/client.tsx              // route-specific React composition
app/routes/<slug>/server.ts               // route-specific server action orchestration
app/routes/<slug>/content.ts              // title, intro, FAQ, guide, related links
app/routes/<slug>/presets.ts              // route preset definitions or preset group ids
app/routes/<slug>/test-contract.ts        // optional smoke metadata for audit scripts
```

Recommended interim pattern:

```ts
// app/routes/png-to-svg-for-canva.tsx
export { meta, loader, action } from "./png-to-svg-for-canva/route";
export { default } from "./png-to-svg-for-canva/route";
```

Guidelines:

- Keep route URLs unchanged.
- Preserve generated `+types` imports until React Router route config is migrated.
- Move content/config before action code.
- Keep server-only imports in `server.ts`.
- Keep browser-only components in `client.tsx`.
- Avoid circular imports from route wrappers back into full legacy routes.

## 8. Safe Migration Plan

### Stage 1: Read-only manifest and audit parity

Deliverables:

- `toolRouteManifest.ts`
- audit comparing manifest to `app/routes.ts`, XML sitemap, HTML sitemap, nav sections, related tools, redirects, and noindex decisions.

Expected changes:

- Data and tests only.

Regression gates:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `npm.cmd run build`

### Stage 2: Metadata helper for thin wrappers

Deliverables:

- shared `createRouteMeta` helper
- wrapper metadata generated from manifest entries
- no UI/action changes

Regression gates:

- Stage 1 gates
- `BASE_URL=http://localhost:3000 npm.cmd run test:routes`
- `BASE_URL=http://localhost:3000 npm.cmd run test:utility-layout`
- `BASE_URL=http://localhost:3000 npm.cmd run test:accessibility`

### Stage 3: Sitemap and navigation consumers

Deliverables:

- XML/HTML sitemap derived from manifest where safe
- nav sections and related-tool listings consume manifest subsets
- duplicate link and missing route audits remain strict

Regression gates:

- Stage 2 gates
- `BASE_URL=http://localhost:3000 npm.cmd run test:navigation-browser`
- `npm.cmd run test:route-coverage`

### Stage 4: Extract content from giant modules

Deliverables:

- move FAQs, guide arrays, route copy, large samples, and route config data into separate content modules
- keep imports and rendered output equivalent

Regression gates:

- Stage 2 gates
- route-specific browser smoke for touched pages
- `git diff --check`

### Stage 5: Shared shell for wrapper-heavy route families

Deliverables:

- migrate wrapper-only routes first
- keep behavior inherited from current canonical route module
- prove metadata, canonical, sitemap, nav, and route smoke parity

Regression gates:

- Stage 3 gates
- `BASE_URL=http://localhost:3000 npm.cmd run test:conversion-actions` if the route accepts uploads
- `BASE_URL=http://localhost:3000 npm.cmd run test:hybrid-browser` for browser conversion behavior

### Stage 6: SVG export/editor shell migration

Deliverables:

- first real shared client shell for a low-risk SVG export/editor family
- preserve copy/download/fullscreen/update-preview behavior

Regression gates:

- `npm.cmd run test:output-ux`
- `BASE_URL=http://localhost:3000 npm.cmd run test:focused-editor`
- `BASE_URL=http://localhost:3000 npm.cmd run test:hybrid-browser`
- `BASE_URL=http://localhost:3000 npm.cmd run test:accessibility`

### Stage 7: Server-assisted raster/Cricut/layered routes

Deliverables:

- one family at a time
- route-local action code extracted only after full smoke coverage is in place
- keep `backendSecurity.server.ts`, upload validation, and engine routing behavior unchanged unless a separate task requires it

Regression gates:

- all previous gates
- `npm.cmd run test:trace-engine`
- `BASE_URL=http://localhost:3000 npm.cmd run test:conversion-actions`
- `BASE_URL=http://localhost:3000 npm.cmd run test:hybrid-browser`
- `npm.cmd run test:post-processing`
- full Stage 1 preset smoke for any preset or capability-adjacent migration

### Stage 8: Home page last

Deliverables:

- only after route shells are stable elsewhere
- preserve homepage as source of truth

Regression gates:

- full production QA suite, including Stage 1 full preset smoke.

## 9. Risk Ranking

### Safe First

- Read-only manifest creation.
- Audit-only route coverage improvements.
- Metadata helper for thin wrappers.
- Extracting static content arrays from documentation/static pages.
- Extracting large sample strings from `code-to-svg-for-cricut.tsx`.
- Consolidating nav/sitemap/related route data after manifest parity tests exist.
- Thin wrapper metadata cleanup where route behavior is inherited unchanged.

### Medium Risk

- SVG export/editor shared shell work.
- SVG utility pages with client-only transforms.
- Monetization placement wrapper cleanup.
- OtherToolsLinks decomposition into data plus components.
- Moving FAQ/guide content from full converter modules into separate content files.

### High Risk

- Route-local server actions that accept uploads.
- Shared multipart/upload/decode action orchestration.
- Home route extraction.
- Base64 parser/sanitizer extraction.
- Code-to-SVG parsing and sample handling.
- Layered SVG routes.
- Preset and capability migrations.
- Output history/source snapshot/focused editor behavior.

### Do Not Touch Until Later

- Conversion engine routing.
- Upload validation behavior.
- Preset semantics.
- Potrace/VTracer settings and defaults.
- Layered trace output and post-processing.
- Server security gates, rate limits, and timeout behavior.
- Homepage shell internals.
- Any route URL, canonical URL, or noindex/index decision outside a dedicated SEO task.

## 10. Required Regression Gates by Migration Area

| Migration area | Required gates |
| --- | --- |
| Manifest and route data | `typecheck`, `test`, `test:route-coverage`, `test:navigation`, `test:nav`, `test:links`, `build` |
| Metadata/canonical helpers | Manifest gates plus `test:routes`, `test:utility-layout`, `test:accessibility` against `http://localhost:3000` |
| Sitemap/nav/related links | Metadata gates plus `test:navigation-browser`, route coverage report with zero missing canonical/indexable sitemap routes, zero broken nav links |
| Static content extraction | `typecheck`, `test`, `test:routes`, `build`, route-specific visual/browser spot checks |
| SVG export/editor shell | `typecheck`, `test`, `test:routes`, `test:hybrid-browser`, `test:focused-editor`, `test:output-ux`, `test:accessibility`, `build` |
| Text/Base64/code shell | SVG export gates plus sanitizer/parser-specific tests and browser copy/download checks |
| Raster/Cricut server-assisted shell | `typecheck`, `test`, `test:trace-engine`, `test:conversion-actions`, `test:hybrid-browser`, `test:output-ux`, `test:post-processing`, `test:utility-layout`, `test:accessibility`, `build` |
| Layered SVG shell | Raster/Cricut gates plus focused layer editing, source snapshot, post-processing, and full Stage 1 preset smoke if preset/capability paths move |
| Homepage extraction | Full final QA gate, including Stage 1 full preset smoke |

## 11. What Not To Touch Yet

- Do not change route URLs or canonical URLs.
- Do not change sitemap inclusion decisions except in a dedicated sitemap task.
- Do not change nav grouping or labels except in a dedicated navigation task.
- Do not change upload validation, MIME/signature checks, filename safety, or decode error mapping.
- Do not change preset definitions or defaults.
- Do not change engine routing or tracing quality.
- Do not merge action handlers across routes until their current differences are explicitly mapped and covered.
- Do not migrate home first.
- Do not collapse all route copy into generic shared copy.
- Do not remove route-specific intent, guide content, or output behavior just to reduce file size.
- Do not combine architecture refactors with UI redesign, SEO rewrite, or monetization experiments.

## Appendix: Current Architecture Notes

- `app/root.tsx` owns global layout, navigation, runtime error logging, path normalization, and AdSense script loading.
- `app/routes.ts` manually registers all routes and is a primary source of route truth.
- `app/client/lib/converter/routeCapabilities.ts` already models route capability groups, but it does not cover metadata, sitemap, nav, related links, guide content, or test coverage.
- `app/client/components/navigation/toolNavSections.ts` is the shared desktop/mobile navigation source, but it still duplicates sitemap and related-tool route data.
- `app/client/components/navigation/OtherToolsLinks.tsx` is the largest route/content duplication surface outside route modules.
- `scripts/route-coverage-audit.mjs` is already a useful route matrix and should be extended rather than replaced.
- `scripts/navigation-audit.mjs` already checks duplicate nav links, required popular routes, direct mobile links, route validity, and search behavior.
- The existing architecture can be improved safely by making route data explicit first, then moving behavior only after parity tests are strict.
