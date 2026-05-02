# AGENTS.md

## Project context

This is a React Router / Remix-style SVG, Cricut, image conversion, and converter-tool site.

The project includes converter routes for:

- SVG utilities
- raster-to-SVG conversion
- SVG-to-raster export
- SVG-to-PDF export
- Cricut/cut-file workflows
- layered SVG workflows
- Base64 tools
- image conversion tools
- export/download flows
- previews
- presets
- advanced settings
- server-assisted conversion
- client-only utilities

The site is an ad-supported utility site. It should feel:

- fast
- useful
- professional
- non-spammy
- upload-first
- route-specific
- power-user capable without overwhelming first-time users

The home page is the source of truth for most project-wide styling, UX, layout, component behavior, interaction patterns, preset behavior, advanced settings behavior, upload UX, preview/result UX, and general implementation patterns unless the current task explicitly asks for a new change.

Do not make the site look like a generic SaaS landing page.

Do not make ads more prominent than the tool.

Do not hide core functionality to make the UI simpler.

Do not reduce conversion quality to improve visual simplicity or speed.

Use free/open-source resources only unless the current prompt explicitly says otherwise.

Allowed resources include:

- existing project dependencies
- free Google Fonts
- free/open-source libraries already in the project
- Sharp
- Potrace
- SVGO
- JSZip only where archive/batch output actually needs it
- custom TypeScript utilities

Do not add:

- paid APIs
- paid design systems
- paid fonts
- paid conversion services
- paid image-processing services
- AI background-removal services
- heavy UI libraries without a clear need
- new dependencies that duplicate existing project capability

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

- the logic is duplicated in multiple places
- the behavior is actually equivalent or intentionally capability-driven
- extraction will not make route-specific behavior harder to maintain
- the shared abstraction will reduce maintenance cost without hiding route intent

Do not refactor unrelated routes just because similar code exists.

Do not change route copy, SEO, schema, metadata, canonical URLs, og:url values, or internal links unless:

- the task explicitly requires it
- the existing copy becomes inaccurate because of the code change
- there is a direct bug
- a route slug or URL is clearly inconsistent with the existing route

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

- tracing pipeline changes
- layered SVG logic
- thresholding changes
- upload validation changes
- server gate/rate-limit changes
- SVG sanitization changes
- route capability changes affecting many routes
- shared setting normalization
- preset behavior
- advanced settings behavior
- preview/history state behavior
- download/copy/export behavior
- output/layer editing behavior
- route-wide layout changes

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

## Product layout rules

The preferred converter layout is now an upload-first hybrid.

Desktop initial state:

- desktop ad stays above the utility
- upload-first converter card is centered below the ad
- primary presets remain visible
- advanced settings are available but visually secondary
- upload/dropzone is the clearest primary action
- convert button remains obvious
- the large empty output panel should not compete with upload before a file exists

Desktop after upload, conversion, or existing output history:

- show the selected file/upload card clearly
- show the settings/output workspace below
- settings and output should be side-by-side where desktop space allows
- output should generally receive equal or slightly more space than settings
- preserve history, output editing, copy, download, layer editing, and reset behavior

Mobile order:

1. title/tool context
2. primary presets
3. upload/dropzone or selected file row
4. convert button
5. output/results when available
6. advanced settings
7. mobile ad
8. SEO/help content

Mobile ad must stay below the utility unless the current prompt explicitly changes that.

Do not show ads inside the tool card.

Do not make the upload area visually resemble an ad.

Do not move SEO, affiliate, or help sections above the core utility.

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
- preset intensity metadata
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
- throttled/draft commit helpers for high-frequency UI input

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

## Route consistency rules

When a task asks for route consistency, inspect each affected converter page individually.

Do not say “similar pages updated” without naming pages.

For each affected page, report:

- route/page
- issue found
- why it matters
- fix made
- verification result

Do not force every route to have identical controls.

Consistency means routes in the same route family should share relevant layout, upload behavior, preset behavior, advanced settings behavior, output behavior, and validation behavior.

Route families include:

- raster-to-SVG
- Cricut/cut-file
- layered SVG
- SVG-to-raster
- SVG-to-PDF
- SVG utility
- Base64
- batch tools

Examples:

- SVG-to-PNG routes should expose SVG-to-raster settings, not raster tracing controls.
- Raster-to-SVG routes should expose trace presets/settings.
- Layered SVG routes should expose layered settings.
- Cricut routes should expose cut-friendly settings.
- Base64 routes should expose encode/decode settings, not trace settings.

If a page intentionally differs because its route intent differs, state that clearly.

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

- keep the first-screen preset experience compact
- show only the primary presets by default
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

## Preset expansion rules

Existing presets must not be renamed or removed unless the current prompt explicitly requires it.

When adding presets:

- add only real, useful presets
- use concise semantic names
- avoid bloated names
- avoid duplicate behavior
- avoid fake AI, magic, or perfect claims
- avoid route-irrelevant presets
- route capabilities must control which presets appear
- every preset must normalize through the same settings path
- every preset must map to real settings
- every preset must be reflected correctly in the settings UI
- every preset must submit or locally apply the exact effective settings
- every preset must have a backend intensity tag

Preset lists may be large, but the UI must remain scannable.

Use grouping where helpful:

- Lineart
- Sketch/Drawing
- Photo Edge
- Scan
- Logo/Icon
- Diagram
- Cricut/Cutting
- Layered Color
- Background/Style

Do not show every preset above the upload area by default.

## Preset intensity tag rules

Do not show preset tags such as:

- Server trace
- Client side
- Hybrid

Visible preset tags should describe predicted backend processing intensity, not where the work happens.

Use these labels:

1. Lightning Fast
2. Insane Speed
3. Extreme Speed
4. High Speed
5. Low Speed
6. Slow Speed

Tags should be based on real backend cost.

Suggested meaning:

- Lightning Fast: local-only edit after output exists, or very low-cost SVG/raster utility work
- Insane Speed: very simple single trace, low trace size, no layered trace
- Extreme Speed: simple single trace with light preprocessing
- High Speed: normal single trace or moderate preprocessing
- Low Speed: high-detail single trace, photo-edge trace, larger trace dimensions, lower simplification
- Slow Speed: layered color tracing, high layer count, high detail, expensive cleanup, complex photo/sticker/Cricut output

Do not label a heavy layered preset as fast.

Do not choose speed tags for marketing reasons.

Centralize intensity metadata and styles.

Suggested color mapping:

- Lightning Fast: emerald
- Insane Speed: lime
- Extreme Speed: cyan/sky
- High Speed: blue
- Low Speed: amber/orange
- Slow Speed: rose/red

Keep tags compact, readable, accessible, and secondary to the preset name.

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

1. the route supports it
2. the conversion or editing pipeline reads it
3. it changes the output meaningfully
4. it is validated client-side
5. it is validated server-side when backend conversion is used

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

## Advanced settings layout rules

When the advanced settings area is shown, use two visible top-level sections where relevant:

1. Advanced settings (Live preview)
2. Advanced settings (Click to convert)

Live preview must appear first.

Click to convert must appear second.

Both top-level sections should be open by default when the Advanced settings area is visible.

Each top-level section should have a subtle background color matching the site palette so users can visually distinguish them.

Inside each top-level section:

- submenus should be collapsed by default
- opening one submenu should close the currently open submenu in that same section
- accordion state should be stable
- opening or closing a submenu must not trigger conversion
- opening or closing a submenu must not reset settings
- opening or closing a submenu must not cause render loops
- animations should be subtle and respect prefers-reduced-motion

Classify settings based on actual behavior.

Live preview settings include settings that can update the current preview/output locally or cheaply, such as:

- local output styling
- layer color
- layer visibility
- layer opacity
- background display/color when local
- output size when local
- preview-only controls
- copy/download presentation settings when local

Click to convert settings include settings that require backend retrace or reprocessing, such as:

- trace mode
- threshold
- turd size
- opt tolerance
- turn policy
- preprocessing
- edge detection
- mask cleanup
- selected input color removal
- layered trace controls
- layer count
- trace dimensions
- posterize
- white/transparent removal before tracing
- any setting requiring backend retrace/reprocessing

Do not guess classification. Inspect whether the setting affects local SVG/output state or backend conversion.

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

- keep local UI responsive
- avoid overlapping backend jobs
- abort or ignore stale requests where possible
- make the latest request win
- do not let old results replace newer results

For every changed `useEffect` or `useLayoutEffect`, verify:

- what triggers it
- whether it updates one of its own dependencies
- whether it depends on objects, arrays, or functions recreated each render
- whether it calls a parent setter
- whether it dispatches to state that updates one of its dependencies
- whether it normalizes/clamps/sanitizes without equality guards
- whether the same value could be derived with `useMemo`
- whether it can run repeatedly during upload, conversion, reset, preset switching, or error handling
- whether cleanup is complete
- whether cancellation is complete

Avoid:

- state updates during render
- parent setter calls during child render
- effects that update their own dependencies without equality guards
- unstable object/array dependencies that trigger repeated effects
- derived arrays/objects stored every render
- repeated logging effects from identity-changing dependencies
- repeated conversion submissions from render/effect loops
- state updates after unmount
- maximum update depth errors

## High-frequency input rules

Color pickers, palette drags, sliders, opacity controls, and range inputs can cause lag if they rewrite SVG/history/output state too often.

Use a draft-vs-committed model for expensive edits.

Required behavior:

- local control feedback should feel immediate
- expensive parent/history/SVG/output updates should be throttled during dragging
- final value must commit immediately on release, change, blur, confirm, pointerup, pointercancel, or equivalent browser event
- final value must not wait for the throttle delay
- pending throttled commits must be canceled on reset, output switch, file switch, unmount, and new conversion
- stale throttled commits must not overwrite newer final values
- identical normalized values should not update state
- normal color drag/edit events must not trigger backend conversion
- normal color drag/edit events must not trigger logging
- copy/download must use the latest committed final value

For native `input type="color"`:

- use immediate local draft state
- use `onInput` for draft/throttled updates where supported
- use `onChange` and `onBlur` as final commit fallbacks
- do not rely only on `pointerup` because native color picker popups differ by browser

For sliders/ranges:

- local thumb movement should remain responsive
- expensive commits should be throttled
- final release/blur/change should flush immediately

Do not add lodash or a heavy dependency just for throttling.

Use a small typed helper/hook when useful.

## SVG and preview rules

Do not use `dangerouslySetInnerHTML` for SVG previews unless the SVG is sanitized and there is a clear sanitizer boundary.

Prefer the existing working preview model on each page unless the task explicitly requires a better preview model.

If the page currently previews SVG through an `img` using a `data:image/svg+xml` URI, preserve that unless the task explicitly requires otherwise or performance profiling shows it is causing lag.

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
- data-editor-opacity

SVG sanitization must remove or block unsafe content such as:

- script tags
- event handlers
- javascript: URLs
- unsafe external references
- unsafe foreignObject usage
- unsafe embedded content

Sanitized SVG boundaries must be clear in the code.

Never render unsanitized uploaded SVG content directly into the DOM.

## Expensive SVG preview rendering rules

Avoid regenerating large edited SVG strings and data URLs on every render.

If a preview currently calls expensive functions such as edited SVG generation, layer edit application, `encodeURIComponent`, or `data:image/svg+xml` construction during render, inspect whether it contributes to lag.

Where safe:

- memoize edited SVG strings
- memoize encoded preview URLs
- memoize output/history cards
- preserve object identity for unchanged history items
- update only the edited output item
- avoid rerendering every history item for one layer edit
- use Blob/object URLs for large SVG previews only when beneficial
- revoke Blob/object URLs on change/unmount
- do not break copy/download
- do not break current edited-preview parity
- do not switch preview architecture casually unless the current task asks for it or performance requires it

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

## Error handling and logging rules

Error handling must keep the app usable.

For upload, preview, color detection, settings validation, canvas/image operations, and conversion:

- show clear user-facing errors
- do not expose raw stack traces or sensitive implementation details
- reset loading/conversion state in finally blocks
- allow retry after failure
- prevent stale async errors from overwriting newer valid state
- avoid recursive retry loops
- avoid update loops caused by error state changes

Logging must be best-effort and non-blocking.

Do not let logging failure crash the app.

Do not let logging update React state in a way that can cause loops.

Do not log normal high-frequency UI events such as color dragging, slider movement, or local layer edits.

Do not log image contents, base64 data, blob URLs, full local paths, secrets, or unnecessary personal data.

If temporary Google Sheets / Apps Script logging exists, preserve it unless the current task explicitly asks to change it or a direct bug is found.

Do not add new logging infrastructure unless the current task asks for it.

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

## Server optimization rules

For server-assisted conversion, prioritize bounded resource usage.

Prefer:

- early validation before decoding or converting
- rejecting unsupported files early
- rejecting oversized files early
- rejecting impossible settings early
- max upload byte size
- max multipart part size
- max pixel count
- max width/height
- max internal trace dimensions
- conversion timeout where practical
- safe concurrency behavior
- request abort handling where supported
- efficient buffer use
- avoiding unnecessary base64 conversions
- avoiding duplicate full-size image buffers
- avoiding repeated decoding when one decode can be reused safely
- debounced/throttled client calls that hit the server
- bounded caches
- cleanup for temp files, object URLs, Blob references, timers, workers, and event listeners

Do not:

- use unbounded `Promise.all` for expensive work
- add aggressive retries
- create repeated backend calls from render or effect loops
- process remote URLs unless explicitly supported and protected
- trust client-provided MIME type, dimensions, or file size without verification
- store user files indefinitely
- cache user outputs in a way that risks cross-user leakage

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

Do not claim performance improvement without measured or clearly reasoned evidence.

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
- draft/throttled commit model for expensive local SVG/history updates
- AbortController for stale backend requests
- latest request wins
- automatic retry on server busy response where appropriate
- manual Convert, Apply, or Update Preview button for expensive modes

Do not create overlapping backend jobs from rapid setting changes.

If a request is stale:

- abort it where possible
- ignore its result if it returns late
- keep only the latest result active

If the user navigates away during conversion, clean up pending requests where possible.

Revoke object URLs on cleanup.

Avoid base64 strings for huge files unless the route specifically requires them.

## Styling rules

Use the existing home page styling as the source of truth unless the current task explicitly asks for a new design or behavior.

All buttons and interactive controls must include:

- cursor-pointer
- visible hover states
- visible focus states where appropriate

Do not bloat the primary tool UI with large explanation blocks.

Keep advanced or secondary explanations inside collapsed sections, SEO sections, or FAQs when appropriate.

Do not make the UI more generic.

Keep each route aligned to its specific page intent.

Keep preset and advanced settings compact.

Prefer:

- compact primary presets
- show more/show fewer preset behavior
- grouped controls
- concise helper text
- longer explanations below the tool
- calm, professional card styling
- subtle borders and shadows
- readable contrast for small text

When typography is changed:

- prefer Inter for body, UI, forms, nav, buttons, and dense controls
- prefer Inter Tight only for H1/H2/display headings if practical
- do not use decorative, playful, script, or overly rounded fonts
- do not load excessive font weights
- use free fonts only
- use font-display swap when loading fonts

Preferred visual direction:

- title/header navy: #082f49
- primary CTA blue: #2563eb
- primary CTA hover: #1d4ed8
- page background: #f8fafc
- border color: #dbe3ef or slate-200
- muted text should generally be slate-600 or darker for small text
- active preset can use soft sky/blue
- advanced settings should use neutral or subtle section colors
- dark output panels should look intentional, not like blank boxes

Do not make the site flashy.

Do not make the site look spammy.

## Ad layout rules

The site is ad-supported, but the tool must remain the primary focus.

Preserve existing ad components and slots unless the current prompt explicitly asks to change them.

Desktop:

- ad banner may appear above the utility
- reserve ad space to reduce layout shift
- keep the ad visually separate from the upload card

Mobile:

- mobile ad should stay below the utility
- do not place the ad above the first upload action unless explicitly requested

Do not place ads inside the tool card.

Do not make the upload area resemble an ad.

Do not move affiliate or SEO sections above the core utility.

## SEO and route intent rules

Do not make page copy contradict route behavior.

If a route accepts broader upload formats, update visible upload labels and supporting copy accurately.

Do not rewrite SEO copy unless the task requires it, but do not leave misleading copy that contradicts the tool.

Keep canonical URLs, og:url values, schema URLs, and route slugs unchanged unless fixing a direct bug.

Do not add internal links to routes that do not exist.

Do not make every page generic.

Preserve route-specific page intent.

When adding explanatory sections, FAQs, examples, or SEO content:

- keep the content specific to the route
- explain what the tool actually does
- avoid generic converter copy
- avoid misleading claims
- avoid unsupported claims about quality, speed, or compatibility

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

For accordions and collapsible panels:

- use buttons for headers
- use `aria-expanded`
- use `aria-controls`
- use stable IDs
- preserve focus states
- do not hide content in a way that screen readers still read collapsed content unless intentional and accessible
- respect prefers-reduced-motion for animations

## TypeScript rules

Keep TypeScript strict and correct.

Do not use placeholders, ellipses, or “same as before” when asked for full code.

Do not use `any` casually when a proper type is reasonable.

Do not ignore TypeScript errors.

Do not silence errors with unsafe casts unless there is a clear reason.

Prefer explicit route settings, capability types, and helper return types for shared conversion code.

When changing files:

- return complete changed files if requested
- explain what changed briefly
- list any assumptions
- list what was not changed
- list any intentionally unsupported requested items and why

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
- preset intensity metadata
- preset route filtering
- advanced settings grouping
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
- draft/throttled commit helpers
- final color/opacity commit flushing
- reset/unmount cancellation for throttled commits

Do not claim tests passed if they were not run.

If a command is unavailable or fails for unrelated existing reasons, state that clearly.

## Preset and settings verification rules

When presets or advanced settings change, verify:

- existing presets still exist
- existing preset IDs are preserved unless intentionally changed
- new preset IDs are unique
- new preset labels are unique unless an intentional exception exists
- every preset has valid normalized settings
- every preset has a valid backend intensity tag
- every preset appears only on relevant routes
- every preset updates the visible settings correctly
- hidden unsupported settings do not affect output
- switching presets does not leave stale settings
- switching from preset to custom works
- reset after preset works
- upload after preset works
- conversion after preset works
- failed conversion after preset recovers correctly

When advanced settings layout changes, verify:

- Live preview section appears first
- Click to convert section appears second
- both top-level sections are open by default
- submenus are collapsed by default
- only one submenu opens within each section
- accordion animation is smooth
- accessibility attributes are correct
- opening submenus does not submit conversion
- opening submenus does not reset settings

## Manual QA rules

When the task affects conversion, upload, settings, presets, output, or route layout, manually verify where practical:

- route renders directly
- route refresh works
- upload works
- drag/drop works if supported
- invalid file rejection works
- presets apply
- advanced settings apply
- convert works
- preview works
- output history works
- download works
- copy works
- reset works
- second image upload works
- repeated conversion works
- rapid convert clicks do not create unsafe overlapping jobs
- changing settings during conversion is safe
- stale request result is ignored
- error states recover
- mobile layout has no horizontal overflow
- no console errors
- no React maximum update depth errors
- no hydration mismatch
- no object URL leaks where inspectable

When the task affects color pickers, palette editing, or opacity sliders, manually verify:

- dragging feels smooth
- preview updates at controlled frequency
- final value applies instantly
- reset cancels pending commits
- output switch cancels pending commits
- file switch cancels pending commits
- copy/download use final committed values
- backend requests are not spammed
- stale throttled commits do not overwrite newer final values

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
- no expensive color/slider drag path was introduced
- no normal local UI action triggers backend request spam

Run available checks when possible:

- npm run typecheck
- npm run lint
- npm run build
- npm test
- git diff --check

If a test or command cannot be run, explicitly state:

- which command could not be run
- why it could not be run
- what was checked instead

## Final response rules

When returning work:

- be concise
- list changed files
- summarize the actual functional changes
- mention checks run
- mention checks not run
- mention any remaining risks or follow-up work
- do not provide generic advice
- do not say “similar changes apply”
- do not omit changed files when full files are requested
- do not include placeholders
- do not include ellipses
- do not hide failed checks

When asked for full code, return full changed files in full.

When asked for a prompt, return the complete prompt in full.

When asked for an audit, return the audit directly and clearly.

When asked to fix a mistake, fix it directly and avoid unnecessary explanation.