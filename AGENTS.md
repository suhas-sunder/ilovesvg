# AGENTS.md

## Project rules

This is a React Router / Remix-style converter site.

The home page is the source of truth for most project-wide styling, UX, layout, component behavior, interaction patterns, and general implementation patterns unless the current task explicitly asks for a new change.

Before editing:

- Inspect the relevant existing files.
- Identify the current route behavior, state flow, conversion flow, imports, presets, advanced settings, preview/history logic, download/copy/export logic, SEO metadata, and validation logic.
- Compare relevant UI and UX decisions against the home page before changing route-level styling or layout.
- Do not guess based only on the prompt.

## Source of truth rules

Use the home page as the primary reference for:

- visual styling
- spacing
- layout structure
- card styling
- button styling
- hover/focus states
- preset display behavior
- advanced settings behavior
- upload UX
- preview/history UX
- explanatory section structure
- FAQ/content style
- general page polish

Do not redesign other pages away from the home page style unless the current prompt explicitly asks for a different direction.

If another route differs from the home page, preserve route-specific behavior, but align shared UX and styling patterns with the home page where safe.

When a new prompt conflicts with the home page, follow the new prompt only for the specific requested change and keep everything else aligned with the home page.

Do not copy home page content blindly. Copy the pattern, spacing, interaction model, and polish, then adapt wording, presets, controls, SEO content, and route intent to the specific page.

## Preservation rules

Do not break or casually change:

- existing route behavior
- imports
- exported route functions
- component names
- function names
- variable names
- TypeScript types
- localStorage keys
- IDs
- canonical URLs
- og:url values
- schema URLs
- internal links
- SEO structure
- preview history
- preset behavior
- advanced settings
- upload behavior
- copy/download/export behavior
- validation behavior
- accessibility attributes

Do not remove existing presets, advanced settings, high-detail modes, preview history, export buttons, or route-specific UX unless the task explicitly requires it.

Do not add links to routes that do not exist.

Only rename or remove existing code when fixing a direct bug or when the current task explicitly requires it.

## Styling rules

Use the existing home page styling as the source of truth unless the current task explicitly asks for a new design or behavior.

All buttons and interactive controls must include:

- cursor-pointer
- visible hover states
- visible focus states where appropriate

All headings should keep text-sky styling where applicable.

Do not bloat the primary tool UI with large explanation blocks.

Keep advanced or secondary explanations inside collapsed sections, SEO sections, or FAQs when appropriate.

Do not make the UI more generic. Keep each route aligned to its specific page intent.

## React and state rules

Do not rely on freshly updated React state for an immediate submit in the same function.

When submitting after upload, preset change, or settings change:

- compute the exact payload first
- pass that payload directly into the submit/conversion function
- then update React state

Do not let advanced settings automatically fire backend conversions unless the existing page already intentionally does that and the task explicitly preserves it.

Preserve preview history. New conversions should add new result/history items unless the existing route intentionally behaves differently.

Each result/history item should keep its own output, metadata, settings snapshot, and layer controls where applicable.

Editing one result must not affect another result.

Second and later uploads must not reuse the old file.

Generated output must not replace the original uploaded source internally unless the user explicitly chooses to use output as the new source.

Preset switching must be deterministic. Applying the same preset to the same uploaded file should produce the same effective settings every time.

## SVG and preview rules

Do not use dangerouslySetInnerHTML for SVG previews unless the SVG is sanitized and there is a clear sanitizer boundary.

Prefer the existing working preview model on each page.

If the page currently previews SVG through an img using a data:image/svg+xml URI, preserve that unless the task explicitly requires otherwise.

Do not switch preview models casually.

Do not create malformed SVG/path markup.

Downloaded/copied SVG should match the currently edited preview state when layer editing exists.

Uploaded SVGs should not be rasterized unless the existing route intentionally does that or the current task explicitly requires it.

Preserve editable layer metadata when applicable:

- data-layer-id
- data-fill-layer-id
- data-stroke-layer-id
- data-layer-label
- data-layer-color

## Backend and security rules

Do not trust client-submitted settings.

Validate and normalize server-side settings before expensive work.

Preserve existing:

- upload limits
- MIME/extension checks
- rate limits
- concurrency gates
- server busy handling
- Retry-After behavior
- timeout handling
- Sharp/Potrace/SVGO safety protections

Do not replace concurrency protection with rate limiting. Use both when needed.

Do not rate limit browser-only actions such as:

- local preview edits
- copy
- download
- client-side recoloring
- client-side layer visibility changes
- local setting changes
- browser-generated exports

Only rate limit backend actions that consume server compute.

Do not expose stack traces, server paths, raw uploaded content, SVG contents, image data, Base64 strings, raw library dumps, or private internals in client responses.

Use safe user-facing error messages.

## Upload validation rules

For upload routes, preserve or add checks for:

- content length where possible
- maximum body size
- maximum file size
- maximum file count
- empty files
- unsupported formats
- corrupt files
- mismatched MIME and extension
- unsafe filenames
- oversized image dimensions
- excessive pixels
- absurd aspect ratios
- decompression-bomb risk

Never use raw user filenames as filesystem paths.

Sanitize filenames before download/export naming.

## Performance rules

Do not optimize by removing user freedom.

Do not remove manual controls, presets, advanced settings, high-detail modes, layer editing, or export options to simplify implementation.

Optimize by:

- reducing duplicate work
- reducing memory pressure
- centralizing shared logic
- caching safe imports
- resizing internally before expensive tracing
- avoiding repeated full-resolution buffers
- avoiding overlapping backend jobs
- using AbortController where appropriate
- ignoring stale async responses
- preserving or improving output quality

Do not introduce expensive repeated full-image tracing attempts unless the task explicitly requires it and the reason is clear.

## TypeScript and output rules

Keep TypeScript strict and correct.

Do not use placeholders, ellipses, or "same as before" when asked for full code.

Do not use `any` casually when a proper type is reasonable.

Do not ignore TypeScript errors.

When changing files:

- return complete changed files if requested
- explain what changed briefly
- list any assumptions
- list what was not changed

## Verification required before finishing

Before returning the final answer, verify logically:

- app still compiles
- changed route behavior matches the prompt
- changed UI follows the home page pattern unless the task explicitly asked otherwise
- route-specific page intent is preserved
- existing presets still exist
- existing advanced settings still exist
- preview still works
- copy/download still use the correct output
- second upload does not reuse the old file
- preset switching is deterministic
- stale requests cannot overwrite newer results
- no unrelated SEO/canonical/internal-link changes were made
- no non-existent internal links were added

Run available checks when possible:

- npm run typecheck
- npm run lint
- npm run build
- npm test

If a command is unavailable or fails for unrelated existing reasons, state that clearly.
