# AGENTS.md

## Project context

This is a React Router / Remix-style SVG, Cricut, image conversion, and converter-tool site.

The home page is the source of truth for most project-wide styling, UX, layout, component behavior, interaction patterns, preset behavior, advanced settings behavior, upload UX, preview/result UX, and general implementation patterns unless the current task explicitly asks for a new change.

The project includes converter routes for SVG utilities, raster-to-SVG conversion, Cricut/cut-file workflows, layered SVG workflows, Base64 tools, image conversion, export/download flows, previews, presets, advanced settings, server-assisted conversion, and client-only utilities.

## Priority order

When instructions conflict, follow this order:

1. The current user prompt
2. Security, privacy, and data-safety rules
3. Existing working behavior
4. Route-specific intent
5. Home page styling and UX patterns
6. Shared refactor and cleanup preferences
7. Nice-to-have polish

Do not perform broad rewrites unless the current prompt asks for them.

Do not use this file as permission to refactor unrelated areas.

Do not ignore the current prompt because a broader rule in this file sounds related.

If the current prompt asks for a targeted fix, make the targeted fix.

If the current prompt asks for a site-wide audit, refactor, or conversion-pipeline improvement, inspect broadly and proceed carefully.

## Required workflow

For non-trivial tasks:

1. Inspect relevant files first.
2. Identify the current route behavior, state flow, conversion flow, imports, presets, advanced settings, preview/history logic, download/copy/export logic, SEO metadata, validation logic, and server interaction.
3. Compare relevant UI and UX decisions against the home page before changing route-level styling or layout.
4. Summarize the existing architecture briefly before implementing when the task is large or risky.
5. Identify the exact files that need changes.
6. Identify risk level before editing.
7. Implement the smallest safe change that satisfies the prompt.
8. Preserve route-specific behavior unless the prompt requires changing it.
9. Run available checks.
10. Report changed files, checks run, and anything not verified.

For large tasks, do low-risk changes before high-risk pipeline changes.

Do not start implementation by guessing from the prompt alone.

Do not stop at “audit complete” unless the prompt explicitly asks for audit-only work.

## Scope control

Only edit files required for the current task.

Before making broad shared changes, confirm from the existing code that:

- the logic is duplicated in multiple places,
- the behavior is actually equivalent or intentionally capability-driven,
- extraction will not make route-specific behavior harder to maintain,
- the shared abstraction will reduce maintenance cost without hiding route intent.

Do not refactor unrelated routes just because similar code exists.

Do not change route copy, SEO, schema, metadata, canonical URLs, og:url values, or internal links unless:

- the task explicitly requires it,
- the existing copy becomes inaccurate because of the code change,
- there is a direct bug,
- a route slug or URL is clearly inconsistent with the existing route.

Do not rewrite the whole app just to make the code look cleaner.

Do not replace working architecture with a new architecture unless the task explicitly asks for it.

## Large-task staging

For large refactors, migrations, conversion-engine work, or repo-wide audits, proceed in stages:

1. Inspect and audit.
2. Identify shared architecture and route-specific differences.
3. Add diagnostics or measurement helpers where useful.
4. Make low-risk cleanup first.
5. Extract shared helpers only where duplication is verified.
6. Update one representative route where appropriate.
7. Verify behavior.
8. Apply the pattern to additional routes only after the first route is stable.
9. Run checks.
10. Summarize what was changed and what remains.

Do not combine unrelated high-risk changes in one pass.

High-risk areas include:

- tracing pipeline changes,
- layered SVG logic,
- thresholding changes,
- upload validation changes,
- server gate/rate-limit changes,
- SVG sanitization changes,
- route capability changes affecting many routes,
- shared setting normalization,
- preset behavior,
- preview/history state behavior,
- download/copy/export behavior.

## Source of truth rules

Use the home page as the primary reference for:

- visual styling
- spacing
- layout structure
- card styling
- button styling
- hover states
- focus states
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

Do not copy home page content blindly.

Copy the pattern, spacing, interaction model, and polish, then adapt wording, presets, controls, SEO content, upload labels, settings, and route intent to the specific page.

## Core implementation rule

When a task asks for a feature, setting, control, preset, upload behavior, conversion behavior, shared component, route capability system, or conversion pipeline change, implement the real functional change unless it is unsafe, unsupported by the actual pipeline, or would clearly break route intent.

Do not satisfy a functional task with a cosmetic refactor only.

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

Shared components are expected when the same route-local UI is recreated across many pages and the behavior is equivalent or capability-driven.

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
- the abstraction would be harder to maintain than the duplicated code

When creating shared components:

- preserve home page styling
- keep route-specific text passed in as props or data
- do not hardcode generic copy
- do not hardcode non-existent links
- preserve accessibility labels and aria attributes
- keep component APIs typed and understandable
- keep buttons and controls cursor-pointer with visible hover/focus states

Shared structure is good.

Shared generic copy is bad.

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

Do not expose a setting on a route unless the route capability model supports it and the underlying pipeline reads it.

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

When a user changes settings during conversion:

- keep local UI responsive,
- avoid overlapping backend jobs,
- abort or ignore stale requests where possible,
- make the latest request win,
- do not let old results replace newer results.

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

Sanitized SVG boundaries must be clear in the code.

Never render unsanitized uploaded SVG content directly into the DOM.

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

Do not expose the following in client responses:

- stack traces
- server paths
- raw uploaded content
- SVG contents
- image data
- Base64 strings
- raw library dumps
- private internals
- secrets
- environment variables

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

## Conversion performance rules

Do not optimize by removing user freedom.

Do not remove manual controls, presets, advanced settings, high-detail modes, layer editing, or export options to simplify implementation.

Optimize by:

- reducing duplicate work
- reducing memory pressure
- centralizing shared logic where safe
- caching safe imports
- configuring heavy libraries once where appropriate
- resizing internally before expensive tracing
- avoiding repeated full-resolution buffers
- avoiding overlapping backend jobs
- using AbortController where appropriate
- ignoring stale async responses
- preserving or improving output quality
- avoiding repeated full-image tracing attempts unless justified

Do not make conversion slower by default.

Do not add expensive effects to the default conversion path.

Do not introduce expensive repeated full-image tracing attempts unless the task explicitly requires it and the reason is clear.

When a task asks for better quality or advanced controls, implement improvements in the pipeline where safe instead of removing or hiding controls.

If a performance improvement changes output quality, keep it route-aware and controllable.

## Conversion diagnostics rules

For conversion-performance tasks, add or use controlled diagnostics instead of production console spam.

Useful diagnostics include:

- upload size
- source dimensions
- input format
- route/mode
- quality mode/preset
- internal trace dimensions
- layer count
- preprocessing time
- thresholding time
- mask cleanup time
- tracing time
- SVGO time
- final output byte size
- path count
- estimated node count
- warning count
- server queue/gate state
- total request duration
- client-side conversion duration where relevant
- memory-heavy buffer creation points

Diagnostics must be enableable/disableable.

Do not log raw uploaded content, SVG contents, image data, Base64 strings, secrets, or private internals.

## Layered SVG and Cricut rules

Layered SVG and Cricut routes are high-risk areas.

Preserve existing layered settings, layer metadata, layer editing, download behavior, and route-specific intent unless the current task explicitly asks for a change.

For layered SVG and Cricut/cut-file routes, prioritize:

- predictable layers
- editable groups
- clean paths
- fewer tiny islands
- fewer jagged edges
- preserved transparency behavior
- clear white/background handling
- valid SVG output
- Cricut/Silhouette compatibility
- no unnecessary filters
- no hidden raster embedding unless explicitly intended

Do not simplify a layered route into a single-trace route.

Do not remove high-detail modes to make conversion easier.

Do not remove manual threshold, turd size, curve smoothing, turn policy, layer editing, copy/download freedom, preview freedom, or local UI freedom unless the current prompt explicitly requires equal or better replacement behavior.

## Client behavior and request safety rules

Do not throttle local UI controls unnecessarily.

Allowed behavior:

- immediate local UI updates
- instant preview-only changes when cheap
- instant layer color edits when cheap
- instant copy/download of existing output
- short debounce only for expensive backend conversion calls
- AbortController for stale backend requests
- latest request wins
- automatic retry on server busy response where appropriate
- manual Convert, Apply, or Update Preview button for expensive modes

Do not create overlapping backend jobs from rapid setting changes.

If a request is stale:

- abort it where possible,
- ignore its result if it returns late,
- keep only the latest result active.

If the user navigates away during conversion, clean up pending requests where possible.

Revoke object URLs on cleanup.

Avoid base64 strings for huge files unless the route specifically requires them.

## Styling rules

Use the existing home page styling as the source of truth unless the current task explicitly asks for a new design or behavior.

All buttons and interactive controls must include:

- cursor-pointer
- visible hover states
- visible focus states where appropriate

All headings should keep text-sky styling where applicable.

Do not bloat the primary tool UI with large explanation blocks.

Keep advanced or secondary explanations inside collapsed sections, SEO sections, or FAQs when appropriate.

Do not make the UI more generic.

Keep each route aligned to its specific page intent.

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

Do not make every page generic.

Preserve route-specific page intent.

When adding explanatory sections, FAQs, examples, or SEO content:

- keep the content specific to the route,
- explain what the tool actually does,
- avoid generic converter copy,
- avoid misleading claims,
- avoid unsupported claims about quality, speed, or compatibility.

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

Errors should be readable and associated with the relevant input or action where appropriate.

## TypeScript rules

Keep TypeScript strict and correct.

Do not use placeholders, ellipses, or “same as before” when asked for full code.

Do not use `any` casually when a proper type is reasonable.

Do not ignore TypeScript errors.

Do not silence errors with unsafe casts unless there is a clear reason.

Prefer explicit route settings, capability types, and helper return types for shared conversion code.

When changing files:

- return complete changed files if requested,
- explain what changed briefly,
- list any assumptions,
- list what was not changed,
- list any intentionally unsupported requested items and why.

## Testing rules

Run available checks before finishing when possible:

- npm run typecheck
- npm run lint
- npm run build
- npm test
- git diff --check

If the project uses different commands, inspect package scripts and run the relevant equivalents.

For conversion-related changes, add or update tests where the project setup supports it.

Useful test categories include:

- settings normalization
- route capability filtering
- preset merge behavior
- upload validation
- file type validation
- SVG sanitization
- selected color parsing
- selected color removal
- white/background handling
- alpha threshold behavior
- mask cleanup
- SVG complexity scoring
- cache key generation
- simple raster-to-SVG conversion
- layered SVG conversion
- uploaded SVG cleanup
- unsupported/corrupt file handling
- oversized image handling
- stale request behavior
- route-level upload/convert/preview/download behavior

Do not claim tests passed if they were not run.

If a command is unavailable or fails for unrelated existing reasons, state that clearly.

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
- no private secrets were added
- no broken imports were introduced
- no route build failures were introduced

Run available checks when possible:

- npm run typecheck
- npm run lint
- npm run build
- npm test
- git diff --check

If a test or command cannot be run, explicitly state:

- which command could not be run,
- why it could not be run,
- what was checked instead.

## Final response rules

When returning work:

- be concise,
- list changed files,
- summarize the actual functional changes,
- mention checks run,
- mention checks not run,
- mention any remaining risks or follow-up work,
- do not provide generic advice,
- do not say “similar changes apply,”
- do not omit changed files when full files are requested,
- do not include placeholders,
- do not include ellipses,
- do not hide failed checks.

When asked for full code, return full changed files in full.

When asked for a prompt, return the complete prompt in full.

When asked for an audit, return the audit directly and clearly.

When asked to fix a mistake, fix it directly and avoid unnecessary explanation.