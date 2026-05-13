# Performance/Safety-A: Image Complexity Guardrails

## Current limits

- Shared backend upload guardrails: 12 MB per file, 16 MB multipart body, one file per request, 24 MP decoded raster cap, 4 MB uploaded SVG cap, 25,000 SVG elements, 250,000 path commands, and 8 MB sanitized SVG output cap.
- Route-local raster converters commonly allow up to 30 MB uploads, 30 MP decoded raster images, and 8,000 px maximum side length before action-level validation rejects the request.
- Potrace compatibility guardrails: 16 MB input cap, 24 MP raster cap, 8,000 px side cap, and 20 second trace timeout.
- Image preprocessing guardrails: max trace side defaults through route settings, preprocessing clamps dense raster work to 24 MP and 3,000 px max preprocessing side where applicable.
- VTracer client guardrails: 8 MB input cap, 8 MP pixel cap, 2,600 px side cap, palette count clamped to 2 through 40, and browser fallback on oversized SVG or excessive paths.
- Centerline guardrails: 1.8 MP centerline pixel cap, 240,000 skeleton pixel cap, and 950 polyline cap.
- Batch guardrails: lightweight batches can run higher counts, while expensive settings are capped to bounded batch sizes.
- Meaningful SVG guardrails: successful SVGs must have a valid SVG root, non-zero dimensions or viewBox, drawable visible elements, non-hidden content, and route-aware white-output allowances.

## Gaps found

- Fully transparent PNG input could pass through shared server Potrace tracing as a successful action response with an SVG shell and an empty path. The meaningful-output validator rejected that SVG, but the route action still returned HTTP 200 before this pass.
- Dense or noisy outputs already had browser and worker caps, but large successful outputs did not consistently show visible user-facing warnings in output cards.
- Layered and cut-file complexity was mostly represented as diagnostics, path counts, layer counts, and data attributes. Users could miss that a result was meaningful but likely heavy for Cricut, design software, copy, download, or preview.
- Existing clean logo, layered logo, noisy JPG, and large safe raster paths were protected enough to preserve output quality. No global downscale or preset downgrade was justified.

## Fixes implemented

- Added shared output-complexity warning helpers for SVG byte size, path count, layer count, layered output, and cut-friendly routes.
- Added visible non-blocking output warnings to the shared converter output panel and the bespoke output panel. These warnings do not disable copy, download, fullscreen, or editing when output is still meaningful.
- Added server-side meaningful-output validation to shared Potrace fallback output. Blank or non-renderable Potrace SVG output now raises a clear no-visible-vector error instead of returning a successful blank result.
- Mapped no-visible-vector output to the existing invalid-upload error path so fully transparent or visually empty raster uploads return a clear user-facing error.
- Added `test:image-complexity` to audit current limits, runtime handling for generated fixtures, layered pathTags, large safe image handling, noisy Cricut input, and transparent input rejection.

## Deferred intentionally

- No global downscale change was made because clean logos and simple graphics already preserve quality through current route settings and preprocessing.
- No preset was removed, hidden, renamed, or tuned.
- No queue, worker, or server architecture change was made because current concurrency gates, rate limits, worker caps, and timeouts are already present.
- No hard rejection was added for noisy or photo-like images. Those inputs can still produce useful preview artwork, so warnings and existing output caps are safer than blocking them broadly.

## Quality preservation

- Clean PNG and JPG logo fixtures still return meaningful SVG output with one drawable path and small SVG byte size.
- Layered clean logo output still returns visible SVG output with drawable layer pathTags.
- Noisy JPG on a Cricut route remains bounded and returns meaningful output instead of crashing.
- Large but safe raster input still auto-resizes through the existing preprocessing path and returns meaningful SVG output.
- Fully transparent input now fails clearly instead of creating a successful blank output.

## Test coverage

- `scripts/image-complexity-audit.mjs` generates local safe fixtures rather than committing binary test images.
- The audit checks source-level limits for upload size, decoded pixels, Potrace, VTracer, centerline tracing, browser SVG/path rejection, and output warning UI.
- The runtime audit posts generated fixtures to representative converter action routes and validates meaningful SVG output where success is expected.
- Existing meaningful-output, conversion-action, hybrid-browser, output-UX, preset-performance, and full route/preset smokes remain the broader regression gates.

## Remaining production monitoring needs

- Track conversion duration, output SVG bytes, path count, layer count, and fallback frequency by route family and preset.
- Watch for repeated invalid visible-art errors from specific routes or file types to identify confusing upload flows.
- Monitor browser memory or long-task reports around very large but meaningful SVG previews.
- If production traffic shows sustained queue pressure from dense inputs, evaluate a small per-engine work queue or stricter per-route expensive-job limits in a separate architecture pass.
