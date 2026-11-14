# Phase 2 functional candidate: SVG Sprite Generator

Foundation: PR #12 commit `78dda78994ea90e7b3a839725021bc316463434e`. The registered route passed independent acceptance on a local production-mode build. See the [validation and screenshots](../../releases/weekly/phase2-sprite/validation.md). No release or deployment occurred during validation.

## Why this workflow

- `app/data/routeManifest.ts` lists the SVG Viewer and SVG Embed Code Generator and consolidates `/svg-inspector` and `/svg-inline-code-generator` into them. The viewer already exposes source, ID/definition counts and an element picker with bounding boxes. The embed generator creates single-file inline, image, CSS and data-URI snippets.
- Emoji and text routes can generate symbols for their own artwork. They do not assemble user-selected SVG icons into one reusable file.
- A DXF handoff needs an explicit mapping from SVG units, viewBox and transforms to DXF drawing units, origin/axis conventions and path entities. Filled, compound, clipped and open/stroked paths cannot safely imply a cut contour without user intent; Bézier and arc conversion also needs an agreed tolerance. No CAD/cutter imports were verified. Defer DXF without a library, backend, compatibility claims or route.

## Implementation and limits

- `app/client/lib/converter/svgSprite.ts` parses bounded SVG XML in a detached document. It reconstructs allowed markup with namespace-aware DOM operations, rewrites local IDs and gradient references, and reparses the generated output for structure, ID uniqueness, local references and cycles. The existing regex server sanitizer removes gradient URL paints; the viewer's adjustable sanitization and inline preview are not a suitable security boundary for downloadable inline sprites.
- `app/routes/svg-sprite-generator.tsx` accepts local UTF-8 SVG files, shows image-mode blob previews, downloads deterministic `sprite.svg`, and copies markup plus accessible or decorative local `<use>` snippets. No loader/action, external dependencies, storage or new analytics. The editor, including local names and preview markup, is in the installed PostHog SDK's `ph-no-capture` subtree for autocapture and replay.
- Supported input is intentionally narrow: basic shapes/groups, simple paints and local gradients. Styles, arbitrary namespaces, external or embedded resources, live text, nested SVG, clip paths, masks, filters, animation and user-supplied `<use>` fail with a file-specific error instead of silently changing artwork. Boundaries: 12 files, 128 KiB each, 512 KiB total, 1,000 nodes per icon, 4,000 per batch, depth 24, 6,000 path segments/geometry values per icon, 16,000 per batch, 768 KiB exported. The name allocation is deterministic for a given selection order. Combining all icons for a page in one sprite avoids duplication between separate tool runs; global CSS in a destination site can still override presentation attributes.
- The export is meant for inline installation. Playwright WebKit rendered the same gradient in a standalone SVG and in same-document symbol references, but rendered it transparent via external `<use href="./sprite.svg#…">`. Nesting and hoisting definitions, referencing a group, and relative URL variants did not fix that in the local probe. The app provides only the tested inline workflow. Browser engines here are automated Chromium/WebKit, not physical Safari or iPhone tests.

## Evidence

The durable browser suite is `ai-issues/releases/weekly/phase2-sprite/svg-sprite-browser.mjs`. Run from the repository root in PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs'
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-browser.mjs
```

The parser and inline rendering passed in Chromium and WebKit. Each checked 59 rejected cases and bounds, including XML directives and entities, namespaces, active content, remote and escaped CSS references, duplicate or cyclic IDs, wrong targets, dashed strokes, combined transforms, non-ASCII path commands, and byte, node, depth and geometry limits. The independent reviewer found two ways dashes could stall the browser. A malformed list triggered regex backtracking, and 995 otherwise valid paths with 0.000025-unit dashes stalled the renderer. The tool now rejects dash patterns and offsets before preview and explains how to convert dashed strokes to filled outlines. The regression suite includes both reproductions.

The same review found that individually valid SVG transforms could multiply into a blank preview. The tool now checks the affine matrix for each operation, its running product and the result after combining parent and child transforms. It rejects unstable or extreme matrices before rendering.

Positive fixtures test colliding filenames and prototype-like IDs, gradient inheritance, negative-origin viewBox, pixel dimensions, accessible HTML and image-mode output. The worst mean channel delta versus the three original artworks was 0.536/255. Inline HTML also verified gradient and solid pixels and geometry. The browser harness observed no unexpected HTTP request from input parsing or preview. `npm run typecheck`, `node --check server.js`, and `git diff --check` passed on the active worktree during implementation.

The registered-route run used the local production build through `BASE_URL` and passed both engines. It exercised the file input, examples, keyboard focus, remove and clear, invalid UTF-8 and oversized input, recovery, copy and download, mobile layout, and actual downloaded bytes rendered in inline HTML. Additional ownership, replay, resource and accessibility checks are recorded in the [independent review](./sprite-independent-review.md).
