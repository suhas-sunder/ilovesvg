# Phase 1D Shared Shell Assessment

Date: 2026-05-10

Branch: `final-refactor-and-polish-may-10-v2`

## Executive Summary

The shared wrapper shell is working for a narrow class of route modules: metadata-only wrappers that bind a route path to a lightweight metadata family helper and then render an existing template component. It should stay limited to that role for now.

The current pattern has reduced repeated route-module wiring without changing URLs, route metadata, conversion behavior, export behavior, navigation grouping, sitemap behavior, or bundle boundaries. The full `routeManifest` remains audit and build-time only, and the older routeMeta monolith is not emitted into client chunks.

Recommendation: pause broad shared-shell expansion after Phase 1D-C. The next safest architecture step is content/FAQ/static-copy extraction or a focused review of remaining metadata-only wrappers. Do not start shared converter shells until route-specific settings, actions, loaders, presets, and output behavior are explicitly mapped.

## Current Shared Shell Status

File path: `app/routes/_shared/createTemplateWrapperRoute.ts`

The helper centralizes:

- route path binding for metadata lookup
- metadata factory hookup
- template component binding
- a tiny route object with `meta()` and `Component`

The helper intentionally does not centralize:

- conversion logic
- server actions or loaders
- upload parsing
- validation
- presets
- output, copy, download, or export behavior
- affiliate or ad placement behavior
- navigation behavior
- sitemap behavior
- route copy or SEO content
- route file movement or route architecture

Current implementation:

```ts
type TemplateWrapperRouteConfig<TPath extends string, TMeta, TComponent> = {
  path: TPath;
  createMeta: (path: TPath) => TMeta;
  Component: TComponent;
};

export function createTemplateWrapperRoute<TPath extends string, TMeta, TComponent>(
  config: TemplateWrapperRouteConfig<TPath, TMeta, TComponent>,
) {
  return {
    meta: () => config.createMeta(config.path),
    Component: config.Component,
  } as const;
}
```

Risk level: low for routes that only repeat metadata and template wiring. Medium to high for any route with a loader, action, route-local conversion/export logic, bespoke editor state, or route-specific behavior.

## Routes Currently Using The Shared Shell

| Route path | Source file | Metadata family | Template/component | Risk level |
| --- | --- | --- | --- | --- |
| `/svg-to-png-for-canva` | `app/routes/svg-to-png-for-canva.tsx` | `canvaFigma` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/svg-to-png-for-figma` | `app/routes/svg-to-png-for-figma.tsx` | `canvaFigma` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/svg-to-png-for-etsy` | `app/routes/svg-to-png-for-etsy.tsx` | `marketplaceExport` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/svg-to-png-for-shopify` | `app/routes/svg-to-png-for-shopify.tsx` | `marketplaceExport` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/svg-to-png-for-printify` | `app/routes/svg-to-png-for-printify.tsx` | `marketplaceExport` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/svg-to-png-for-printful` | `app/routes/svg-to-png-for-printful.tsx` | `marketplaceExport` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/svg-to-transparent-png-for-printing` | `app/routes/svg-to-transparent-png-for-printing.tsx` | `marketplaceExport` | `app/routes/svg-to-png-converter.tsx` default export | Low |
| `/png-to-ico-converter` | `app/routes/png-to-ico-converter.tsx` | `faviconExport` | `app/routes/svg-to-favicon-generator.tsx` default export | Low |
| `/svg-to-ico-converter` | `app/routes/svg-to-ico-converter.tsx` | `faviconExport` | `app/routes/svg-to-favicon-generator.tsx` default export | Low |
| `/png-to-favicon-generator` | `app/routes/png-to-favicon-generator.tsx` | `faviconExport` | `app/routes/svg-to-favicon-generator.tsx` default export | Low |
| `/jpg-to-favicon-generator` | `app/routes/jpg-to-favicon-generator.tsx` | `faviconExport` | `app/routes/svg-to-favicon-generator.tsx` default export | Low |
| `/logo-to-favicon-generator` | `app/routes/logo-to-favicon-generator.tsx` | `faviconExport` | `app/routes/svg-to-favicon-generator.tsx` default export | Low |
| `/image-to-favicon-generator` | `app/routes/image-to-favicon-generator.tsx` | `faviconExport` | `app/routes/svg-to-favicon-generator.tsx` default export | Low |

Shared-shell routes currently use one of two existing templates:

- `app/routes/svg-to-png-converter.tsx`
- `app/routes/svg-to-favicon-generator.tsx`

No shared-shell route currently moves a route file into a folder or centralizes any action/loader behavior.

## Bundle Boundary Status

Latest `npm.cmd run test:manifest-bundle` result after syncing with `origin/main`:

- checked client chunks: `184`
- full `routeManifest` client assets: `0`
- routeMeta monolith client assets: `[]`
- shared metadata helper asset: `createManifestMeta-MMPlsdkl.js`

Family routeMeta chunks:

| Family | Asset | Bytes |
| --- | --- | ---: |
| `canvaFigma` | `canvaFigma-h88QsMDu.js` | 1,588 |
| `marketplaceExport` | `marketplaceExport-B0N1LGhy.js` | 2,004 |
| `marketplaceCraft` | `marketplaceCraft-BHFFmVre.js` | 1,174 |
| `faviconExport` | `faviconExport-DFcnSiQ0.js` | 2,301 |
| `svgPlatformTools` | `svgPlatformTools-CEBT82_y.js` | 2,434 |

Shared shell chunk:

- `createTemplateWrapperRoute-DTS9BcdK.js`: about `0.09 kB`

Current bundle boundary conclusions:

- Full `app/data/routeManifest.ts` is absent from client chunks.
- The old routeMeta monolith is absent from client chunks.
- Family metadata chunks remain isolated.
- The bundle audit verifies that wrapper chunks import only their expected family metadata asset.
- No unrelated metadata family leakage was reported.
- Build still reports the known existing warnings: empty `api.batch-svg` chunk, large chunk warnings, and Vite dynamic/static import warnings around conversion server modules. These are not introduced by the shared shell.

## Benefits Achieved

- Repeated metadata and template wiring was reduced across 13 wrapper routes.
- Route modules are thinner while still remaining valid React Router route modules.
- Route URLs and canonical metadata stayed unchanged.
- Template behavior stayed in the existing implementation routes.
- Export and conversion behavior stayed untouched.
- Bundle boundaries stayed explicit and audited.
- The helper is small enough to be easy to reason about.

## Problems And Risks

Known route families that do not currently fit the helper:

- routes with `loader` or `action` exports
- routes with route-local upload, conversion, export, copy, or download logic
- routes with bespoke editor state
- routes that define or modify presets
- routes with large inline demos, samples, FAQ arrays, or guide content mixed into the module
- core converter routes where the route file is the behavior owner

Route families likely to require helper changes before they could use it:

- SVG editor platform wrappers that need more than metadata and template binding
- Cricut or craft wrappers that carry route-specific settings, presets, or action behavior
- base64/code routes with custom decoding, validation, or UI state
- layered/server-assisted raster routes

Over-generalization risk:

- Adding props, loaders, actions, related-link wiring, ad behavior, or preset wiring to this helper would turn it into a hidden route framework.
- A broad shell could obscure route intent and make it harder to preserve route-specific conversion behavior.
- A barrel export for route metadata families could accidentally rebundle unrelated metadata into wrapper route chunks.

Bundle risk:

- Family metadata chunks are currently small, but they should remain guarded by `scripts/manifest-bundle-audit.mjs`.
- Future migrations should update the audit whenever a family gains routes.
- A failed bundle boundary should stop the migration before committing.

## Recommendation

Pause shared-shell expansion for now.

The helper is useful and safe for the narrow metadata-only wrapper shape, but further expansion has diminishing returns unless the next candidates are just as simple. The next safest architecture step is one of:

1. Content/FAQ/static-copy extraction for repeated, low-risk route content.
2. A route-family design note for a future shared converter shell, without implementation.
3. A very small wrapper audit to confirm whether any remaining route is truly metadata-only.

If shell work continues, the safest next family is not a converter-shell family. It would be a tiny same-template metadata-only wrapper group with no loaders, actions, route-local conversion/export logic, or bespoke state. If fewer than two routes fit that exact shape, stop.

Routes that should remain deferred:

- `app/routes/home.tsx`
- `app/routes/code-to-svg-for-cricut.tsx`
- `app/routes/base64-to-svg.tsx`
- `app/routes/base64-to-svg-for-cricut.tsx`
- layered/server-assisted raster routes
- core converter routes with unique actions/loaders
- complex editor routes such as `svg-background-editor`, `svg-recolor`, `svg-cleaner`, and `svg-resize-and-scale-editor`
- any route with custom export/download behavior in the route module

## Required Regression Gates For Any Next Migration

Required before commit:

- `git status --short --branch`
- `git branch --show-current`
- `git diff --stat`
- `git diff --name-only`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `npm.cmd run test:manifest-bundle`
- `npm.cmd run test:production-logging`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:conversion-actions`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:accessibility`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:utility-layout`
- `npm.cmd run build`
- `npm.cmd audit`
- `node --check scripts/manifest-bundle-audit.mjs`
- `node --check scripts/production-logging-audit.mjs`
- `git diff --check`

Additional parity checks for any migrated route:

- route returns 200 or the existing expected redirect status
- title unchanged
- description unchanged
- canonical unchanged
- one H1 where expected
- visible utility/template still renders
- route module exports remain valid
- no full `routeManifest` client asset
- no routeMeta monolith
- no unrelated metadata family imported into the route chunk

## Current Verification Snapshot

After merging `origin/main` into `final-refactor-and-polish-may-10-v2`, the full required suite passed on 2026-05-10:

- `typecheck`: pass
- unit and trace tests: pass
- route coverage: pass, 139 total app routes, 0 missing XML sitemap routes, 0 missing metadata, 0 missing canonical, 0 broken nav or related targets
- navigation and link audits: pass
- manifest bundle audit: pass
- production logging audit: pass
- route HTTP smoke on `http://localhost:3000`: pass
- conversion actions smoke on `http://localhost:3000`: pass
- accessibility smoke on `http://localhost:3000`: pass
- utility layout smoke on `http://localhost:3000`: pass
- build: pass with known existing Vite warnings
- npm audit: pass, 0 vulnerabilities
- syntax checks for manifest and production logging audits: pass
- `git diff --check`: pass

There is no `lint` script in `package.json` at the time of this report.
