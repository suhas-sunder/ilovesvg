# AGENTS.md

## Project rules

This is a React Router / Remix-style SVG, Cricut, image conversion, and converter-tool site.

The home page is the source of truth for most project-wide styling, UX, layout, component behavior, interaction patterns, preset behavior, advanced settings behavior, upload UX, preview/result UX, and general implementation patterns unless the current task explicitly asks for a new change.

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
- result card behavior
- copy/download/export behavior
- explanatory section structure
- FAQ/content style
- general page polish

Do not redesign other pages away from the home page style unless the current prompt explicitly asks for a different direction.

If another route differs from the home page, preserve route-specific behavior, but align shared UX and styling patterns with the home page where safe.

When a new prompt conflicts with the home page, follow the new prompt for the specific requested change and keep everything else aligned with the home page.

Do not copy home page content blindly. Copy the pattern, spacing, interaction model, and polish, then adapt wording, presets, controls, SEO content, upload labels, settings, and route intent to the specific page.

## Core implementation rule

When a task asks for a feature, setting, control, preset, upload behavior, conversion behavior, shared component, route capability system, or conversion pipeline change, implement the real functional change unless it is unsafe, unsupported by the actual pipeline, or would clearly break route intent.

Do not satisfy a functional task with a cosmetic refactor only.

Do not stop at “audit complete” unless the prompt explicitly asks for audit-only work.

Do not avoid implementation by saying the feature would require pipeline support. If the requested feature needs pipeline support and can be implemented safely, implement the pipeline support.

If a requested feature cannot be implemented safely, state the exact technical reason and what would be required to support it.

A visible setting must be wired end-to-end:

- typed in the relevant Settings type
- included in DEFAULTS where appropriate
- included in preset merge behavior where appropriate
- rendered only on routes that support it
- included in client payload construction where backend conversion is used
- parsed and validated server-side where backend conversion is used
- connected to actual conversion, SVG editing, raster export, preview, download, or output behavior
- verified to make a meaningful visible or functional change

Do not add fake controls.

Do not add settings that only update React state but do not affect output.

Do not hide behind “route-specific” as a reason to avoid shared components if repeated UI or logic clearly exists.

When a prompt explicitly asks to improve advanced settings, route capabilities, presets, or conversion controls, implementation is required unless the setting is unsafe, unsupported by the actual pipeline, or inappropriate for that route.

A targeted refactor is not enough when the prompt asks for functional user-facing improvement.

## Preservation rules

Preserve existing behavior by default, but do not use preservation as an excuse to avoid requested improvements.

Do not casually break or rename:

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

Only rename or remove existing code when:

- fixing a direct bug
- removing verified dead code
- implementing a requested feature cleanly
- extracting repeated code into a safe shared component/helper
- the current task explicitly requires it

Do not remove existing presets, advanced settings, high-detail modes, preview history, export buttons, layer editing, or route-specific UX unless the current task explicitly requires replacing them with equal or better functionality.

Do not add links to routes that do not exist.

## Shared component and duplication rules

If a UI pattern, setting group, preset selector, export control, upload note, result card, validation message, internal-link block, helper function, or conversion utility is repeated across routes, consider extracting it into a shared component or helper.

Shared components are expected when the same route-local UI is recreated across many pages.

Good shared component candidates:

- preset selectors
- advanced settings panels
- setting field rows
- setting groups
- upload format notes
- export/download controls
- result cards
- layer controls
- validation/error messages
- route-aware internal link sections
- reusable page/tool sections

Good shared utility candidates:

- settings normalization
- route capabilities
- preset definitions
- preset dedupe
- upload format handling
- color parsing
- selected color removal
- SVG sanitization
- SVG post-processing
- raster preprocessing
- mask cleanup
- output-size normalization
- localStorage validation
- filename sanitization
- rate limit helpers
- conversion gate helpers

Do not extract something if:

- it is used by only one route
- it would make route-specific behavior harder to understand
- it would make every page read the same
- it would hide important route intent
- it would require unrelated rewrites beyond the task scope

When creating shared components:

- preserve home page styling
- keep route-specific text passed in as props or data
- do not hardcode generic copy
- do not hardcode non-existent links
- preserve accessibility labels and aria attributes
- keep component APIs typed and understandable
- keep buttons and controls cursor-pointer with visible hover/focus states

Shared structure is good. Shared generic copy is bad.

## Route capability rules

Use route capabilities when settings, presets, input formats, or output formats differ by route.

Do not treat every route as the same type of converter.

A route capability model should control:

- route id/path
- route group
- page intent
- accepted input formats
- output formats
- whether the route supports file upload
- whether the route supports pasted SVG
- whether the route supports pasted Base64
- whether the route supports text/code/emoji input
- whether the route supports raster tracing
- whether the route supports uploaded SVG cleanup
- whether the route supports SVG-to-raster export
- whether the route supports SVG-to-PDF export
- whether the route supports single trace
- whether the route supports layered trace
- whether the route supports edge/photo preprocessing
- whether the route supports mask cleanup
- whether the route supports selected color removal
- whether the route supports background controls
- whether the route supports transparency controls
- whether the route supports alpha controls
- whether the route supports output size controls
- whether the route supports trim/crop controls
- whether the route supports SVG utility settings
- whether the route supports visual effects
- whether the route supports layer editing
- whether the route supports cut-friendly output
- whether conversion is backend-assisted, client-only, or mixed
- supported preset groups
- supported advanced setting groups
- default settings
- visible settings
- hidden or unsupported settings

Unsupported settings should be hidden, not shown as fake disabled controls.

## Preset rules

Preset behavior must be deterministic.

Applying the same preset to the same source image should produce the same effective settings every time.

When applying a preset:

1. Build settings from a clean baseline.
2. Merge the preset settings.
3. Validate the effective settings against route capabilities.
4. Update state.
5. Submit the exact computed settings if the page uses live preset conversion.

Do not rely on freshly updated React state for immediate conversion.

If a shared preset component is used:

- show the first two presets by default
- hide the rest until the user expands the preset menu
- allow collapse again
- preserve active preset styling
- keep route-specific presets
- dedupe true duplicate presets
- do not show irrelevant presets
- do not inject global presets into routes that should not have them

Do not dedupe only by label.

Dedupe by:

- preset id
- label
- effective settings
- route capability compatibility
- actual output behavior

If two presets share a label but differ in output, keep both or rename clearly.

If two presets have different labels but identical behavior, consolidate only if it does not break route intent.

If the first visible preset becomes the intended default, update:

- activePreset initial state
- DEFAULTS
- first-conversion behavior
- localStorage fallback behavior where applicable

Do not let stale localStorage values override intended new defaults without validation.

## Advanced settings rules

Advanced settings must be real, route-aware, and useful.

Do not add decorative settings.

Do not add controls that do not affect output.

Do not show settings on pages where they do not apply.

Advanced settings should be capability-based and grouped where appropriate.

Possible setting groups:

- Trace detail
- Color and layers
- Edges and cleanup
- Appearance
- Output geometry
- Layer effects
- SVG/raster export
- SVG utility controls

A setting may be shown only when:

1. the route supports it,
2. the conversion or editing pipeline reads it,
3. it changes the output meaningfully,
4. it is validated client-side,
5. it is validated server-side when backend conversion is used.

If a prompt asks for advanced setting improvements, do not only move old fields into a shared component. Improve the actual setting coverage and pipeline support where safe.

For backend-assisted routes:

- advanced setting changes should normally update local state only
- do not auto-submit on every advanced setting change unless the route intentionally uses live preview and the task preserves that behavior
- provide Convert, Apply, or Update preview behavior
- submit the exact computed settings when applying

For cheap client-only edits:

- immediate preview updates are acceptable if responsive
- throttle only expensive drag/range/color updates
- do not throttle simple checkboxes or selects unnecessarily

For color pickers and range sliders:

- keep local control state responsive
- avoid expensive SVG regeneration on every tiny drag movement
- commit expensive changes on pointerup, mouseup, touchend, blur, or short debounce
- clear timers on unmount

## Functional setting implementation rules

When implementing settings, update the whole path:

- Settings type
- DEFAULTS
- preset merge behavior
- UI control
- localStorage validation if persisted
- FormData or request payload
- client normalization
- server parsing
- server validation
- conversion helper
- output post-processing
- preview/result metadata
- copy/download/export behavior if affected

Settings that commonly require full wiring:

- selected color removal
- remove color tolerance
- layer alpha
- fill alpha
- background alpha
- output width
- output height
- preserve aspect ratio
- trim artwork
- preserve canvas
- trim padding
- brightness
- contrast
- noise reduction/despeckle
- gap closing
- island removal
- hole filling
- edge threshold
- edge thickness
- color merge tolerance
- posterize strength
- layer sorting
- preserve outlines
- outline color
- outline placement
- max trace side
- transparent background
- background color
- raster export quality
- PDF page size/orientation
- SVG cleanup/minify options
- stroke width
- flip/rotate
- SVG recolor/background editing

If a setting is unsafe or unsupported, do not show it. Explain why if the prompt specifically requested it.

For cut-file/Cricut/Silhouette/laser/vinyl routes, prioritize:

- clean paths
- fewer tiny islands
- fewer jagged edges
- usable layers
- predictable fills
- clear background/transparency behavior
- no unnecessary SVG filters
- no malformed SVG
- no hidden raster embedding unless explicitly intended

For artistic/image-preview routes, visual effects such as texture, blur, gradients, and alpha can be offered only if implemented safely and clearly.

## React and state rules

Do not rely on freshly updated React state for an immediate submit in the same function.

When submitting after upload, preset change, or settings change:

- compute the exact payload first
- pass that payload directly into the submit/conversion function
- then update React state

Preserve preview history.

New conversions should add new result/history items unless the existing route intentionally behaves differently.

Each result/history item should keep its own:

- output
- metadata
- settings snapshot
- active preset where applicable
- layer controls where applicable

Editing one result must not affect another result.

Second and later uploads must not reuse the old file.

Generated output must not replace the original uploaded source internally unless the user explicitly chooses to use output as the new source.

Stale requests must not overwrite newer results.

Use AbortController or latest-request-wins behavior where appropriate.

## SVG and preview rules

Do not use dangerouslySetInnerHTML for SVG previews unless the SVG is sanitized and there is a clear sanitizer boundary.

Prefer the existing working preview model on each page unless the task explicitly requires a better preview model.

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

SVG sanitization must remove or block unsafe content such as:

- script tags
- event handlers
- javascript: URLs
- unsafe external references
- unsafe foreignObject usage
- unsafe embedded content

## Backend and security rules

Do not trust client-submitted settings.

Validate and normalize server-side settings before expensive work.

Preserve existing:

- upload limits
- MIME/extension checks
- magic-byte checks where present
- image dimension checks
- megapixel checks
- rate limits
- concurrency gates
- server busy handling
- Retry-After behavior
- timeout handling
- Sharp/Potrace/SVGO safety protections
- SVG sanitization behavior

Do not weaken server safety to support broader uploads or more settings.

Do not replace concurrency protection with rate limiting. Use both when needed.

Only rate limit backend actions that consume server compute.

Do not rate limit browser-only actions such as:

- local preview edits
- copy
- download
- client-side recoloring
- client-side layer visibility changes
- local setting changes
- browser-generated exports

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

Where broader upload format support is requested, implement it only if the conversion pipeline actually supports it safely.

If upload support changes:

- update accept attributes
- update client validation
- update server validation
- update visible accepted-file copy
- update error messages
- ensure page copy does not contradict actual behavior

Preferred image formats for converter routes where safe:

- PNG
- JPG
- JPEG
- WebP
- GIF
- AVIF
- BMP
- TIFF
- SVG

Do not blindly expand SVG-only routes if the pipeline cannot handle raster input.

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

Do not make conversion slower by default.

Do not add expensive effects to the default conversion path.

Do not introduce expensive repeated full-image tracing attempts unless the task explicitly requires it and the reason is clear.

When a task asks for better quality or advanced controls, implement improvements in the pipeline where safe instead of removing or hiding controls.

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

Keep preset and advanced settings compact.

Prefer:

- first two presets visible
- show more/show fewer preset behavior
- advanced settings collapsed by default where appropriate
- grouped controls
- concise helper text
- longer explanations below the tool

## SEO and route intent rules

Do not make page copy contradict route behavior.

If a route accepts broader upload formats, update visible upload labels and supporting copy accurately.

Do not rewrite SEO copy unless the task requires it, but do not leave misleading copy that contradicts the tool.

Keep canonical URLs, og:url values, schema URLs, and route slugs unchanged unless fixing a direct bug.

Do not add internal links to routes that do not exist.

Do not make every page generic. Preserve route-specific page intent.

## Accessibility rules

Preserve or improve:

- semantic headings
- input labels
- select labels
- aria-labels
- aria-describedby
- aria-live status messages
- keyboard operation
- focus-visible states
- readable helper text
- non-color-only feedback

Do not remove accessibility attributes unless removing the control they describe.

Do not trap keyboard focus unless implementing a proper modal/dialog.

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
- list any intentionally unsupported requested items and why

## Verification required before finishing

Before returning the final answer, verify logically:

- app still compiles
- changed route behavior matches the prompt
- changed UI follows the home page pattern unless the task explicitly asked otherwise
- route-specific page intent is preserved
- existing presets still exist or were intentionally replaced with equal/better shared behavior
- existing advanced settings still exist or were intentionally replaced with equal/better shared behavior
- every visible setting changes output or behavior meaningfully
- every setting sent to a backend action is parsed and validated server-side
- unsupported settings are hidden by route capability, not merely disabled
- shared components replaced repeated route-local UI where safe
- the task was not satisfied by cosmetic refactoring when functional implementation was requested
- preview still works
- preview history still works
- copy/download/export still use the correct output
- second upload does not reuse the old file
- preset switching is deterministic
- stale requests cannot overwrite newer results
- upload validation still works
- server safety remains intact
- no unrelated SEO/canonical/internal-link changes were made
- no non-existent internal links were added
- no unsafe SVG rendering was introduced

Run available checks when possible:

- npm run typecheck
- npm run lint
- npm run build
- npm test
- git diff --check

If a command is unavailable or fails for unrelated existing reasons, state that clearly.
