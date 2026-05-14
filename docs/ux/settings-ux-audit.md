# Settings UX Audit-B

Date: 2026-05-13

Branch: `settings-ux-audit-b-may-13`

Scope: report-first review of the live preview editing and conversion settings UI. This audit does not change code, presets, conversion behavior, output quality, route URLs, SEO metadata, navigation, sitemap behavior, monetization, or the capability-aware SVG editing model.

## 1. Executive Summary

The capability-aware settings work solved the most important functional problem: unsupported live preview controls are now hidden or guarded, and output edits flow into preview, copy, download, fullscreen, and batch behavior. The remaining issue is user comprehension. The UI still exposes internal SVG concepts too directly, especially in target selectors and color controls.

The highest-impact UX problem is color and layer targeting. A target such as `Color: #d9dbfd (1)` is technically precise, but it makes the user decode a hex value instead of recognizing the artwork region. The user needs a visible swatch, a plain target type, and an object count. Hex values should remain available as secondary detail for power users, not be the primary label.

The settings structure is functional but still reads like a capability model in places. Users think in goals: change this output now, recolor a visible area, adjust outlines, remove a source color, or rerun conversion with different trace settings. The next implementation pass should keep the protected top-level split between Live Preview Edits and Click To Convert, then make labels, grouping, and target controls follow those user goals.

Recommended first batch: improve target labels and target selector UI without changing behavior. Add swatches, demote hex values, improve layer labels, and preserve the current target-aware mutation pipeline. This is the best first move because it addresses the clearest retention risk with limited implementation risk.

## 2. Current Settings Structure Inventory

### Shared Advanced Settings Panel

Primary files:

- `app/client/components/converter/AdvancedSettingsPanel.tsx`
- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/BespokeTraceOutputPanel.tsx`
- `app/client/lib/converter/svgEditingModel.ts`
- `app/client/lib/converter/outputAppearance.ts`

The shared converter settings UI is split into two top-level accordion groups:

- `Live Preview Edits`
- `Click To Convert`

The protected Live Preview Edits intro remains:

> These controls update the visible SVG right away. Copy, download, fullscreen, and batch use what you see here.

The protected Click To Convert intro remains:

> Use Update preview when you are ready. These controls rebuild this output from the original image, so the app does not restart conversion after every slider or color change.

### Live Preview Edits

| Section | Visible Condition | Main Controls | Model | Timing | Targeting | Reset | Output Actions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Post-processing / Output appearance | Current output has useful capability-aware controls | Stroke output mode when retrace is actionable, sticker border, stroke effects, fill effects, fill style, shadow and glow | `OutputAppearanceSettings`, `OutputAppearanceSupport`, `SvgEditingModel` | Immediate local SVG mutation | Fill target, stroke target, color target, layer target where supported | Global reset plus local effect resets | Finalized edited SVG feeds preview, copy, download, fullscreen, and batch |
| Remove detected output colors | `supportsLayerEditing` and real output layer controls exist | Visibility checkbox per output layer/color | `OutputLayerControlItem` | Immediate output-layer state | One row per layer/color item | Per-row reset | Copy/download use current layer state |
| Layer colors | `supportsLayerEditing` and reliable layer items exist | Visibility, color picker, hex input, RGB details, per-layer opacity | `OutputLayerControlItem` | Throttled immediate commits | One row per layer | Per-row reset and reset all | Copy/download use current layer state |
| Size and export | `supportsOutputGeometry` and not cut-friendly output | Width, height, aspect lock, output size reset | Advanced trace settings and output size metadata | Immediate output size state | Whole output | Reset dimensions | Export uses current size state |
| SVG/raster export | SVG-to-raster routes | Width, height, aspect lock, pixel ratio, anti-aliasing | `SvgRasterExportSettings` | Immediate export-preview state | Whole export | No clear scoped reset in the shared export panel | Copy/download use current export state |
| SVG/raster appearance | SVG-to-raster routes | Transparent or solid background, background color | `SvgRasterExportSettings` | Immediate export-preview state | Whole export | No clear scoped reset in the shared export panel | Download/export uses current background state |

### Live Output Appearance Controls

The output appearance controls are capability-aware and are hidden when impossible. The current presentation groups are:

- `Stroke output mode`
- `Sticker border`
- `Stroke effects`
- `Fill effects`
- `Fill style`
- `Shadow and glow`

Control details:

- Stroke output mode appears only when `strokeOutputModeAvailable && !strokeModeDisabled`.
- Sticker border appears only when `support.supportsStickerBorder`.
- Stroke effects appear only when stroke color or line weight can apply.
- Fill effects appear only when fill color, fill spread, gradient, or pattern can apply.
- Fill style appears only when gradient or pattern fill can apply.
- Shadow and glow appear only when shadow support exists.
- High-frequency color/range edits use throttling and final flush handling.

The main UX issue is not capability correctness. It is how targets and nested effects are presented.

### Click To Convert

| Section | Visible Condition | Main Controls | Model | Timing | Targeting | Reset | Output Actions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Line tracing | Shared trace routes | SVG mode, threshold, tiny specks, curve smoothing, corner handling, trace detail limit | `TraceAdvancedSettings` | Requires Update preview | Whole source conversion | No scoped section reset | New/rebuilt output then drives output actions |
| Color and layers | Layered-capable routes and layered mode | Layer count, detail limit, small color region removal, simplify colors, color simplification, color merge, layer order | `TraceAdvancedSettings` | Requires Update preview | Whole source conversion | No scoped section reset | New/rebuilt output |
| Edges and cleanup | Cleanup-capable single-trace routes | Brightness, contrast, ignore white, ignore transparent, edge threshold/thickness, noise/gap/island/hole controls where supported | `TraceAdvancedSettings` | Requires Update preview | Whole source conversion | No scoped section reset | New/rebuilt output |
| Remove colors | Selected-color-removal capable routes | Detected color swatches, custom color, remove list, tolerance | Source palette plus output layer color list | Requires Update preview | Source conversion color removal | Remove one chip at a time | New/rebuilt output |
| Appearance | Background-capable routes | Transparent background, background color, global layer opacity, background opacity | `TraceAdvancedSettings` | Requires Update preview | Whole source conversion | No scoped section reset | New/rebuilt output |

The protected top-level split is correct because it teaches the right mental model: live edits mutate the current SVG, while Click To Convert rebuilds from the source image. Inside each top-level group, the labels are still more implementation-oriented than user-oriented.

### Layer Palette Editor Component

Primary file: `app/client/components/svg/LayerPaletteEditor.tsx`

This component is used by some route-local output editors and layered history flows. It offers:

- `Layer colors`
- visibility checkbox
- color picker
- layer label
- original hex color
- optional opacity slider
- per-layer reset
- reset all

Its behavior is appropriate: color and opacity commits are throttled and flushed on release, blur, and native color-picker final commit events. The UX issue is similar to the shared layer controls: `Original #hex` is prominent, while the visual identity of the layer is mostly the small color input and internal label.

### Target Model Behind Live Editing

Primary file: `app/client/lib/converter/svgEditingModel.ts`

Current target types:

- `allFills`
- `allStrokes`
- `color`
- `layer`
- `text`
- `none`

Current target labels are generated inside the SVG editing model:

- `All fills (n)`
- `All strokes (n)`
- `Color: #xxxxxx`
- `Color: #xxxxxx (n)`
- `Layer: label`

The model also carries richer data that the UI can use:

- target id
- target type
- count
- paint type
- normalized color
- layer id
- supported operations

This means the next UX pass can improve presentation without weakening capability detection. The UI does not need to parse labels to know whether a target is a fill, stroke, color, or layer.

### Target Selector Behavior

Primary file: `app/client/components/converter/TraceOutputPanel.tsx`

`TargetSelect` is a native select rendered only when more than one target exists. It currently receives only `id`, `label`, and `count`, then renders plain text options. Because native option content cannot reliably show structured swatches, the current control cannot present color targets in a visual way.

This is the most visible target UX limitation:

- no swatches inside the dropdown
- hex values become the main label
- object count is unclear when shown as `(1)`
- color target and layer target labels look equally technical
- fill versus stroke target scope is not obvious unless the section heading is read carefully

### Detected Color Controls

Primary file: `app/client/components/converter/AdvancedSettingsPanel.tsx`

Current color controls:

- `DetectedColorSwatches` renders a swatch plus the hex string.
- `RemoveColorChips` renders a swatch plus the hex string.
- `OutputColorRemovalSection` renders a swatch, label, mono hex, checkbox, and reset.
- `OutputLayerStyleRow` renders color input, hex input, RGB details, label, original hex, percent, opacity, and reset.

The controls are functional, but normal users see too many raw values before they see a plain target name. Hex should be retained for precision editing, but it should not be the first or only descriptor for a target.

### Route-Local Settings

Several routes still have local settings UIs rather than the shared advanced panel. Examples include:

- `app/routes/svg-recolor.tsx`
- `app/routes/svg-stroke-width-editor.tsx`
- `app/routes/svg-background-editor.tsx`
- `app/routes/svg-embed-code-generator.tsx`
- `app/routes/svg-file-size-inspector.tsx`
- `app/routes/svg-to-jpg-converter.tsx`
- `app/routes/svg-to-png-converter.tsx`
- `app/routes/svg-to-webp-converter.tsx`
- older black-and-white and specialized converter routes with local output editors

These route-local tools often use settings such as `Apply to`, global color, stroke width, background, dimensions, export quality, and SVG cleanup toggles. They are outside the immediate shared live-preview model, but they create consistency pressure. The audit should treat them as follow-up alignment targets, not as a reason to rewrite route-local tools in this pass.

## 3. Main UX Problems

### Technical Labels Are Too Prominent

The current label style exposes the implementation model:

- `Color: #d9dbfd (1)`
- `Layer: Layer 2`
- `All fills (3)`
- `All strokes (4)`
- `Original #f97316`
- `Per-layer opacity 82%`

These are useful facts, but they are not the most helpful primary labels. A user should first understand what part of the artwork is affected.

### Hex-Only Color Labels Hurt Recognition

Hex values are precise but not recognizable. A user cannot tell whether `#d9dbfd` means a lavender background, a shirt fill, or a small icon detail without a visual swatch and target context. This is especially weak when the count is `(1)`, because a single object may be tiny or visually central.

### Target Scope Is Not Obvious Enough

The UI has separate Fill effects and Stroke effects groups, but the target selector itself still says `Apply to`. When an option says `Color: #xxxxxx`, users may not know whether it means:

- every fill with that color
- every stroke with that color
- both fills and strokes
- a generated layer
- one path
- all visually matching regions

The model already knows paint type and count, but the selector does not expose that clearly.

### Grouping Still Mixes User Goals And SVG Internals

`Stroke effects`, `Fill effects`, and `Fill style` are technically accurate. They are also SVG-centric. Many users think in simpler goals:

- change colors
- make outlines thicker
- add a border
- add a gradient or pattern
- resize the output
- rerun conversion for cleaner paths

The current structure is usable for power users, but the next pass should reduce SVG vocabulary in primary labels where possible.

### Nested Controls Can Still Feel Dense

The current output polish section may show:

- a section accordion
- effect group dividers
- toggles
- target selector
- nested gradient controls
- nested pattern controls
- nested internal gap controls
- resets in multiple locations

This is not a broken structure, but it is cognitively heavy. It is especially dense on mobile and in the focused editor side panel.

### Similar Actions Have Different Names

Examples:

- `Post-processing`, `Output appearance`, and `Output polish` refer to similar live output edits.
- `Remove detected output colors` and Click To Convert `Remove colors` sound similar but affect different stages.
- `Layer colors` appears in both shared and route-local contexts.
- `Appearance` can mean output styling, conversion background, or raster export background depending on route.

The Live Preview Edits versus Click To Convert split helps, but the sub-section labels should make the scope clearer.

### Reset Placement Is Inconsistent

Reset actions exist at different levels:

- global output appearance reset
- reset stroke
- reset fill
- reset gradient
- reset pattern
- reset gap
- reset all layers
- per-layer reset
- remove one selected color chip

The functionality is useful, but reset scope is not always obvious at a glance. A user should understand whether Reset affects one layer, one effect group, or every live edit.

### Mobile Usability Risk

The focused editor settings panel can be narrow. Rows with a checkbox, color picker, hex input, RGB details, long label, original color, percent, opacity slider, and reset button can wrap heavily. The UI is responsive, but target selection and layer rows need a clearer mobile hierarchy:

- primary row: swatch, plain label, count, action
- secondary row: hex/RGB/opacity, details, reset

### Accessibility And Keyboard Risk

Native select is accessible but cannot show swatches. A custom visual selector could fix swatches but must be built as an accessible listbox, radio group, or disclosure menu. The next implementation must avoid trading clarity for worse keyboard behavior.

Color-only swatches need text labels for screen readers. Hex-only labels are not ideal, but swatches without accessible names would be worse.

### Performance Risk From Color Controls

The current implementation is careful with throttled commits for color pickers and sliders. Any UX improvement must preserve that:

- local draft feedback remains immediate
- expensive SVG/history/output commits stay throttled
- final commits flush on release, blur, change, and native color picker final events
- reset cancels pending commits
- copy/download use the committed current state

## 4. Target Selector And Color Control Problems

### Current Target Selector

Current examples:

- `All fills (6)`
- `Color: #d9dbfd (1)`
- `Layer: Layer 3`
- `All strokes (2)`

Problems:

- Hex value is the main label.
- No swatch is visible.
- Count is terse and not translated into a human phrase.
- Paint scope is implied by the surrounding section, not by the option.
- Layer targets and color targets are visually indistinguishable.
- Native select cannot provide rich option rows.

### Current Detected Color Swatches

Current behavior:

- swatch is present
- hex is visible next to the swatch
- button title says keep or remove plus the label

Problems:

- visible text is still just the hex value
- no object count when source data has enough context
- selected state says remove/keep indirectly through button state
- color chips are compact but not self-explanatory on mobile

### Current Layer Rows

Current behavior:

- color picker is visible
- hex input is prominent
- label is visible
- original hex is visible
- RGB disclosure exists
- opacity slider is visible

Problems:

- the editable hex field can appear more important than the layer name
- `Original #hex` is technical and visually prominent
- RGB details add power-user capability but increase density
- row wrapping can make the relationship between color, label, opacity, and reset unclear

### Proposed Target Label Patterns

Use structured target presentation rather than a single model label string.

Recommended labels:

- swatch + `All filled areas` + `6 objects`
- swatch + `Light color areas` + `1 object` + secondary `#d9dbfd`
- swatch + `All matching light purple fills` + `4 objects` + secondary `#b9a7ff`
- swatch + `Stroke color` + `2 lines` + secondary `#111827`
- swatch + `Layer 3` + `5 objects` + secondary `#e5e7eb`
- `All fills` + `6 objects`
- `All strokes` + `2 objects`

Do not require exact color names unless a robust utility already exists. If no reliable color naming utility is present, use:

- swatch
- target type
- object count
- hex as secondary text

Example without color naming:

- swatch + `Matching fill color` + `1 object` + secondary `#d9dbfd`
- swatch + `Matching stroke color` + `3 objects` + secondary `#0f172a`
- swatch + `Layer 2` + `4 objects` + secondary `#f97316`

### Data Needed By The UI

The model already has enough fields for a first pass:

- `target.type`
- `target.count`
- `target.paint`
- `target.color`
- `target.layerId`
- `target.supportedOperations`

The UI should avoid relying on `target.label` for presentation. It should render target rows from structured fields and keep `target.label` as a fallback or accessible compatibility field.

## 5. Proposed User-Centered Settings Structure

### Design Principles

1. Show visual swatches wherever a color is referenced.
2. Do not make hex values the primary label.
3. Put human labels first and technical details second.
4. Group by user goal, not internal SVG implementation.
5. Preserve the top-level distinction between editing this output now and rerunning conversion.
6. Keep advanced SVG-specific details tucked away.
7. Hide impossible controls and do not reintroduce no-op controls.
8. Keep copy, download, fullscreen, and batch behavior obvious.
9. Make reset actions scoped and predictable.
10. Keep mobile layouts usable with primary and secondary rows.
11. Keep color picker and slider interaction responsive.
12. Preserve capability-aware target detection and final SVG validation.

### Live Preview Edits

Keep the protected intro unchanged.

Recommended groups:

#### Quick Color Edits

Controls:

- target selector for fill color targets
- target selector for stroke color targets when stroke recolor is available
- fill color toggle and color picker
- stroke color toggle and color picker
- opacity for selected target where supported
- remove detected output colors only when reliable layer/color rows exist

When shown:

- show only if at least one fill, stroke, color, or reliable output color target exists
- hide on outputs with no editable paint targets

Target selector behavior:

- render visual rows, not hex-only native options, if there is more than one target
- show swatch for color and layer targets
- show target kind and count
- show hex as secondary detail

Reset behavior:

- one scoped reset for color edits
- per-target reset only where a target has independent state

Mobile behavior:

- selected target appears as a compact swatch row
- expanded menu rows show label, count, and secondary hex

Accessibility:

- if custom menu is used, implement keyboard navigation and `aria-activedescendant` or a radio-group pattern
- swatches must have accessible names such as `Matching fill color #d9dbfd, 1 object`

#### Layer Colors

Controls:

- layer visibility
- layer color
- per-layer opacity
- reset layer
- reset all

When shown:

- show only when reliable layer metadata and layer selectors exist
- do not show for SVG cleanup/pass-through without layer metadata

Target selector behavior:

- layer rows should prioritize swatch + layer name + object or area hint
- original hex moves to secondary detail

Reset behavior:

- `Reset layer` for one row
- `Reset all layers` for the section

Mobile behavior:

- row header: visibility, swatch, layer label, reset
- details row: color value, RGB disclosure, opacity

Accessibility:

- visibility checkbox label should include the layer name
- color input label should include the layer name

#### Outline And Stroke

Controls:

- line weight
- non-scaling stroke
- stroke color if not already included in Quick Color Edits
- centerline or stroke output mode only when actionable and source-supported

When shown:

- show only when stroke targets exist or raster retrace stroke mode is actionable
- hide entirely for fill-only and layered color outputs where centerline is unavailable

Target selector behavior:

- target rows distinguish `All strokes`, `Matching stroke color`, and `Layer stroke`

Reset behavior:

- `Reset outline` or `Reset stroke`

Mobile behavior:

- keep range label and current value on the same line
- avoid long helper copy below normal values

Accessibility:

- range labels should include current value in text

#### Background And Border

Controls:

- sticker border
- border color
- thickness
- opacity
- border placement
- internal gap fill when supported
- shadow and glow, if kept in this group

When shown:

- show sticker border only when supported by filled targets
- show internal gap fill only when the algorithm can apply
- show shadow/glow only when supported and not precision output

Target selector behavior:

- if border can target specific fill targets, use the same visual target rows

Reset behavior:

- `Reset border`
- `Reset gap fill`
- `Reset shadow`

Mobile behavior:

- keep advanced subcontrols collapsed after the main enable toggle
- avoid three nested sections open at once

Accessibility:

- toggles should announce whether enabling the effect changes the current SVG

#### Size And Export

Controls:

- output width
- output height
- preserve aspect ratio
- reset dimensions
- export pixel ratio for raster export routes
- raster background for SVG-to-raster routes

When shown:

- show when output geometry or raster export controls can apply
- hide for cut-friendly outputs if changing size would conflict with route intent

Target selector behavior:

- none, this is whole-output only

Reset behavior:

- `Reset size`

Mobile behavior:

- width and height should stack
- aspect lock should remain adjacent to dimensions

Accessibility:

- numeric inputs should expose units in labels

### Click To Convert

Keep the protected intro unchanged.

Recommended groups:

#### Trace Style

Controls:

- SVG mode
- threshold
- trace detail limit
- centerline/stroke output if it requires retrace and is source-supported

When shown:

- raster trace routes only
- hide for SVG cleanup/pass-through outputs that cannot retrace

Target selector behavior:

- none, this is source conversion

Reset behavior:

- `Reset trace style` in a later pass if scoped reset is added

Mobile behavior:

- keep mode and main threshold near the top

Accessibility:

- mode options should describe output type, not engine internals

#### Detail And Cleanup

Controls:

- remove tiny specks
- curve smoothing
- corner handling
- brightness
- contrast
- edge threshold
- edge thickness
- noise reduction
- gap closing
- island removal
- hole filling

When shown:

- route capability supports these conversion settings

Target selector behavior:

- none, this applies to source preprocessing or trace generation

Reset behavior:

- `Reset cleanup`

Mobile behavior:

- organize as short slider rows with current values

Accessibility:

- sliders should include labels with value and unit where needed

#### Colors To Remove

Controls:

- detected source colors with swatches
- custom color picker/input
- selected color chips
- tolerance

When shown:

- source color removal is supported and applies to current source type

Target selector behavior:

- color chips should use swatch + plain label + secondary hex

Reset behavior:

- clear selected colors
- reset tolerance

Mobile behavior:

- chips wrap cleanly and remain tappable

Accessibility:

- selected state should be clear via `aria-pressed` plus text

#### Appearance

Controls:

- transparent background
- background color
- global layer opacity
- background opacity

When shown:

- route supports conversion-time background or alpha settings

Target selector behavior:

- whole output only

Reset behavior:

- reset appearance settings

Mobile behavior:

- background color disabled state should be visually clear when transparent is on

Accessibility:

- disabled reason can be a short title or inline microcopy only where needed

## 6. Proposed Color And Layer Target Labeling System

### Target Display Fields

A target row should be rendered from structured values:

- `kind`: all fills, all strokes, matching fill color, matching stroke color, layer
- `swatch`: target color when available
- `primaryLabel`: human label
- `secondaryLabel`: object count and optional hex
- `technicalValue`: hex or layer id, visually secondary
- `accessibleLabel`: complete scope for screen readers

### Recommended Labels

| Target Type | Primary Label | Secondary Label | Swatch |
| --- | --- | --- | --- |
| `allFills` | All filled areas | `6 objects` | optional neutral fill icon or none |
| `allStrokes` | All outlines | `2 objects` | optional line icon or none |
| fill color | Matching fill color | `1 object, #d9dbfd` | yes |
| stroke color | Matching stroke color | `3 objects, #111827` | yes |
| mixed color | Matching color | `5 objects, #22c55e` | yes |
| layer fill | Layer 2 | `Filled layer, 4 objects, #f97316` | yes when color exists |
| layer stroke | Layer 2 outline | `Stroke layer, 3 objects, #111827` | yes when color exists |
| layer mixed | Layer 3 | `Mixed layer, 7 objects` | yes when representative color exists |

### Dropdown Or Selector Pattern

Preferred pattern for Batch 1:

- keep the existing behavior and selected target state
- replace the plain native select only where a visual target selector is needed
- use a compact disclosure button showing the selected target row
- open a keyboard-accessible listbox or radio group of targets
- keep native select as a fallback only if implementation time is constrained

Lower-risk fallback:

- keep the native select
- add a selected-target preview row above it with swatch, human label, count, and secondary hex
- update option labels to remove `Color:` and use `Matching fill color - 1 object`

The fallback is less polished but materially better and lower risk. A custom selector is more premium but must pass keyboard and accessibility checks.

### Color Naming

Do not block this work on exact color names. If the codebase does not already include a reliable color-name utility, avoid adding broad color naming in Batch 1. Use target type plus swatch and count:

- `Matching fill color`
- `Matching stroke color`
- `Layer 2`
- `All filled areas`
- `All outlines`

If a small local helper is later added, it can use conservative names such as light, dark, gray, red, orange, yellow, green, cyan, blue, purple, pink, brown, black, and white. It should never claim exact art semantics.

### Hex Placement

Hex should remain available:

- in secondary text
- in text inputs for editable color values
- in tooltips or details
- in accessibility labels after the human label

Hex should not be the only visible name for:

- target dropdown options
- detected source color chips
- output color removal rows
- layer rows

## 7. Implementation Batches

### Batch 1: Target Labels And Swatches

Scope:

- improve live output target selectors
- add swatches to selected target display
- demote hex values to secondary text
- improve detected color chip labels
- improve layer row hierarchy without changing behavior
- keep existing target ids, target matching, mutation, validation, copy/download behavior, and throttling

Files likely to change:

- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/BespokeTraceOutputPanel.tsx` if it needs prop shape parity
- `app/client/components/converter/AdvancedSettingsPanel.tsx`
- `app/client/components/svg/LayerPaletteEditor.tsx`
- `app/client/lib/converter/svgEditingModel.ts` only if label metadata needs to be enriched, not for behavior changes
- `scripts/live-preview-editing-model-smoke.mjs`
- `scripts/output-card-ux-audit.mjs`
- `scripts/hybrid-browser-smoke.mjs`

Risk level: low to medium.

Why first:

- directly fixes the clearest user-facing problem
- does not require conversion or mutation changes
- preserves the capability model
- can be tested with DOM and SVG string assertions

Acceptance criteria:

- no target option presents hex as the primary visible label
- color targets show a swatch wherever selected or listed
- layer targets show a plain layer label plus count or role
- `All fills` and `All strokes` remain available where supported
- unsupported targets remain hidden
- fill, stroke, gradient, pattern, layer, copy, and download behavior remain unchanged
- color and range controls remain throttled

Tests to update:

- assert protected Live Preview Edits and Click To Convert intros remain
- assert color target UI includes swatches or selected target preview rows
- assert hex values are secondary, not the target option primary label
- assert filled SVG and stroke-only SVG still expose correct available controls
- assert SVG cleanup/pass-through still hides fake retrace/centerline controls
- assert copy/download include edited SVG

### Batch 2: Group Labels And Reset Clarity

Scope:

- rename live subgroups around user goals
- reduce `Post-processing`, `Output appearance`, and `Output polish` naming mismatch
- clarify `Remove detected output colors` versus conversion-time `Remove colors`
- align reset button labels by scope
- simplify nested controls so only useful groups open

Files likely to change:

- `app/client/components/converter/AdvancedSettingsPanel.tsx`
- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/BespokeTraceOutputPanel.tsx`
- focused editor browser smoke scripts
- output UX audit script

Risk level: medium.

Why second:

- grouping changes affect more screenshots, smoke assertions, and user flows
- label changes are not technically hard, but they can create test churn

Acceptance criteria:

- protected intros remain unchanged
- live edit groups read as user goals
- conversion groups still clearly require Update preview
- reset labels show scope, such as `Reset stroke`, `Reset fill`, `Reset all layers`
- no disabled diagnostic sections return
- no valid controls disappear incorrectly

Tests to update:

- output UX audit should check structure and absence of verbose diagnostics, not brittle old labels
- focused editor smoke should verify one open section at a time
- live preview smoke should continue checking capability behavior

### Batch 3: Mobile, Keyboard, And Performance Polish

Scope:

- optimize target selector mobile layout
- verify keyboard access for custom target menus
- improve layer rows on narrow screens
- audit focus rings and aria labels
- preserve draft/committed color and range behavior

Files likely to change:

- `app/client/components/converter/TraceOutputPanel.tsx`
- `app/client/components/converter/AdvancedSettingsPanel.tsx`
- `app/client/components/svg/LayerPaletteEditor.tsx`
- `app/client/hooks/useThrottledCommit.ts` only if a small reusable helper is needed
- accessibility and browser smoke scripts

Risk level: medium.

Why third:

- custom interaction polish must be verified in browser
- keyboard and mobile work is easier after target labels and grouping settle

Acceptance criteria:

- target selector is usable by keyboard
- swatch-only information has accessible labels
- no horizontal overflow in focused editor settings
- no color picker lag regression
- pending throttled commits flush before copy/download
- mobile sections remain scannable

## 8. Regression Tests Needed

Update or add tests around behavior and clean UI, not long explanatory copy.

Required coverage:

- protected Live Preview Edits intro remains visible
- protected Click To Convert intro remains visible
- fill controls appear for SVGs with fill targets
- stroke controls appear for stroke-only SVGs
- fill-only controls stay hidden for stroke-only SVGs
- stroke-only controls stay hidden for fill-only SVGs
- layer controls appear only when reliable layer metadata exists
- SVG cleanup/pass-through does not show fake centerline or raster retrace controls
- color target selector shows swatches or selected target preview rows
- hex is secondary in color target UI
- layer target labels are human-readable
- unsupported controls are not clickable
- gradient and pattern still mutate filled targets
- stroke width and stroke color still mutate stroke targets
- layer edits still mutate current SVG
- reset actions remain scoped
- copy and download use edited output
- fullscreen uses edited output
- batch uses edited output
- no blank successful output
- color picker and range controls still use throttled commit behavior
- no visible diagnostic summary appears by default

Suggested commands for implementation batches:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:live-preview-editing`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:focused-editor`
- `npm.cmd run test:output-ux`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:hybrid-browser` when browser behavior changes
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:accessibility` when custom target selector behavior changes
- `npm.cmd run build`
- `git diff --check`

## 9. Routes And Output Types To Manually Verify

### Homepage

- raster PNG/JPG/JPEG/WebP traced output
- SVG cleanup/pass-through with filled shapes
- SVG cleanup/pass-through with stroke-only shapes
- SVG cleanup/pass-through with both fills and strokes
- SVG cleanup/pass-through with class/style colors
- SVG cleanup/pass-through with text
- failed conversion state with no enabled output actions

### Layered Routes

- `/jpg-to-layered-svg-for-cricut`
- `/png-to-layered-svg-for-cricut`
- `/image-to-layered-svg-for-cricut`
- `/layered-svg-for-cricut`
- one generated output with reliable `data-layer-id`, `data-fill-layer-id`, or `data-stroke-layer-id`

Verify:

- layer targets are human-readable
- layer rows show swatches
- layer color and opacity remain responsive
- preview, copy, and download match edited output

### Single-Trace Raster Routes

- `/jpg-to-svg-converter`
- `/jpeg-to-svg-converter`
- `/png-to-svg-converter`
- `/webp-to-svg-converter`
- `/line-art-to-svg-converter`
- `/logo-to-svg-converter`
- `/scan-to-svg-converter`
- `/sketch-to-svg-converter`

Verify:

- Click To Convert groups remain clear
- Update preview remains required for retrace settings
- live output edits apply only where targets exist

### Cut-Friendly Routes

- `/png-to-svg-for-cricut`
- `/jpg-to-svg-for-cricut`
- `/jpeg-to-svg-for-cricut`
- `/line-art-to-svg-for-cricut`
- `/sticker-to-svg-for-cricut`
- `/png-to-svg-for-laser-cutting`
- `/png-to-svg-for-silhouette`

Verify:

- size/export changes do not conflict with cut-file intent
- sticker/border controls only show where supported
- output quality and path usability are not reduced

### SVG Utility Routes

- `/svg-cleaner`
- `/svg-preview-viewer`
- `/svg-to-png-converter`
- `/svg-recolor`
- `/svg-stroke-width-editor`
- `/svg-background-editor`

Verify:

- route-local color and `Apply to` settings are not more technical than the shared live editor
- SVG cleanup/pass-through outputs remain editable when markup supports it
- unsafe SVG does not pass through raw

### Complex SVG Cases

Use fixtures with:

- gradients
- patterns
- inline styles
- class styles
- text
- image elements
- hidden elements
- `fill="none"`
- mixed fills and strokes

Verify:

- target detection remains conservative
- fake controls do not appear
- no crashes
- no unsafe SVG passthrough
- copy/download match preview

## Final Recommendation

Implement Batch 1 next. It improves the most visible UX defect while keeping behavior unchanged: structured target labels with swatches, human-readable target names, counts, and secondary hex values. That batch should not touch conversion, presets, output quality, route URLs, SEO metadata, navigation, sitemap behavior, monetization, or target-aware SVG mutation.
