# Bounded raster preparation — November 8, 2026

Status: IMPLEMENTED and locally VALIDATED, including candidate production-build route upload → SVG → download. Production deployment remains a separate gate in CURRENT-STATUS.md.

## Confirmed defects and scope

The PNG implementation and its delegated Canva, Figma, transparent-PNG and Shopify entrypoints prepared oversized inputs only by compressed file bytes. A tiny compressed raster exceeding 8000 pixels on one side or 30 megapixels passed preparation, was fully decoded for dimension checks, and was then rejected. The previous >25 MiB helper always exported JPEG, which could discard PNG alpha and add compression artifacts; it did not close its ImageBitmap. Dimension measurement, pre-submit validation, cache fingerprinting, and worker eligibility also made redundant bitmap decodes.

This is a confirmed code-path defect, not a diagnosis of the owner's unavailable original iPhone upload. The original DNG and screenshot attachments were not accessible to this worker. TIFF/DNG and HEIC are unsupported by this PNG/JPEG/WebP entrypoint; the new message explains exporting JPEG/PNG. It does not advertise a DNG or HEIC decoder.

## Changes

- Read at most 256 KiB of PNG/JPEG/WebP headers for dimensions, including JPEG EXIF orientation. Unreadable or unusually metadata-heavy headers fail safely with an export instruction; they do not trigger an unbounded fallback decode.
- Retain the exact File object and bytes for existing supported inputs at or below 30 MiB, 30 MP and 8000 pixels on either side. In particular 25–30 MiB files no longer suffer unnecessary JPEG recompression.
- Admit normalization only for originals ≤64 MiB, with a full-source decoded-pixel cap (32 MP mobile / 48 MP other browsers), 32767-pixel source-side cap, and conservative estimated working memory (192 MiB mobile / 384 MiB other browsers). These are admission estimates, not measured browser peak-memory guarantees. Safari resize decode options are not assumed to save full-source memory.
- Preserve aspect ratio with no crop/upscale; normalize to ≤8000 pixels per side and ≤6 MP mobile / 12 MP other browsers. Use lossless PNG to preserve alpha and avoid further JPEG artifacts. Bound output attempts to four and normalized payload to the unchanged 30 MiB server upload ceiling.
- Allow only one active oversized-image normalization. An additional large upload gets a wait-and-reselect message instead of a concurrent expensive decode. Valid uploads bypass normalization.
- Close bitmap resources, clear canvases, release image URLs and HTML image sources. A preparation token prevents a finished older upload from submitting after a newer selection, removal, or route unmount.
- Use cheap headers instead of full raster decodes for recognized cache/worker dimension probes; other format probes retain their previous behavior. A failed recognized header probe prevents browser-worker admission and can use the existing compatible server path.
- Keep all route metadata, canonicals, redirects, sitemap, tracing settings/defaults, server ceilings/concurrency, and protected ad lifecycle unchanged.

## Validation

- `node scripts/raster-upload-preparation-audit.mjs` PASS: real Sharp PNG/JPEG/WebP headers; EXIF 1/3/6/8; exact byte/pixel/side boundaries; oversize normalization plan; unsafe source rejection before allocation; unsupported TIFF/DNG; malformed JPEG; no recompression/no browser decode for valid inputs.
- `npm run test:conversion-cache` PASS after adding the new transitive module to its existing transpilation harness.
- `npm run typecheck` PASS.
- `node scripts/raster-upload-preparation-browser.mjs` PASS in desktop Chromium, mobile Chromium emulation, desktop Firefox, desktop WebKit, mobile WebKit emulation. These are actual desktop browser engines; emulation is not physical iPhone Safari verification.
- All five browser configurations recover a transparent 9000×120 PNG to 8000×106, preserve background alpha zero and exact interior RGB, and normalize an EXIF-6 JPEG to 106×8000. Both ImageBitmap and forced HTML-image fallback paths were executed. Independent Sharp-resized reference mean absolute channel differences are 0.873–0.901 out of 255. Existing small valid files preserve identity and make zero decode calls during preparation.
- Browser adversarial cases in all five configurations reject a synthetic 100000×100000-pixel PNG header before any decoder call, refuse a second concurrent oversized normalization, and release the admission lock for subsequent successful normalization.
- `node scripts/raster-upload-route-browser.mjs` PASS **25/25** against the candidate production build at localhost:3000: desktop Chromium, mobile Chromium emulation, desktop Firefox, desktop WebKit, mobile WebKit emulation each execute small PNG, safe oversized PNG, unsupported DNG, unsafe pixel-count and replacement-during-normalization workflows. Real server actions return 200 and downloaded SVGs contain paths without embedded raster images. The 621-byte ordinary SVG and 1122-byte oversized-input SVG match byte-for-byte across all five configurations. DNG/unsafe images make zero POSTs and zero decoder calls. A delayed original preparation cannot submit after its replacement; only the replacement receives a successful server response.
- These route cases observe one visible H1, no horizontal overflow at 1280/390 CSS pixels, no page/hydration exceptions and successful downloads. Desktop/mobile screenshots captured under light and OS dark color-scheme preferences were inspected using the image viewer; controls/result remain readable and available. iLoveSVG currently has no theme toggle or implemented dark palette, so OS-dark captures correctly retain the existing light design. No dark-mode feature is implied. Screenshots/reports/downloads are in the OS temporary directory `ilovesvg-raster-route-browser`.
- `npm run test:input-compatibility` against the pre-change production build failed at the existing `/svg-to-png-converter-accepts-svg-ui` markup assertion. It must not be reported as a candidate regression or as passing.
- `git diff --check` PASS (working-copy LF/CRLF informational warnings).

The browser audit requires Playwright supplied externally via `PLAYWRIGHT_MODULE` (absolute path to its index.mjs), with optional `RASTER_CHROMIUM_EXECUTABLE`, `RASTER_FIREFOX_EXECUTABLE`, `RASTER_WEBKIT_EXECUTABLE`. It adds no production dependency. Report defaults to the OS temporary directory `ilovesvg-raster-browser/report.json`; fixtures are deterministic synthetic graphics, not user artwork. Cached browsers need a matching Playwright protocol version.

## Remaining limitations / release gates

- No physical iPhone was available. Browser-native allocation may differ on iOS; admission limits deliberately decline very large inputs rather than risk decoding them. No numerical claim about physical iPhone peak RAM is made.
- The 256 KiB header ceiling can conservatively decline rare JPEGs whose dimension marker occurs beyond unusually large metadata. An export instruction is preferable to a speculative full decode.
- This normalization hookup is intentionally scoped to the shared PNG implementation. Other standalone raster entrypoints retain their existing upload preparation; cheap shared cache/worker probing benefits them. Broadening normalization requires each owner-route behavior contract and rendered-flow QA.
- A renderer killed by the OS cannot run fallback JavaScript. Normalization does not guarantee recovery from every browser resource failure.
- Do not raise server limits to bypass a normalization refusal. No new server preprocessor is introduced.
- Other-family regression gates and deployment are owned by the managing engineer. Roll back the focused technical commit if those gates fail; no production release is claimed by this report.
