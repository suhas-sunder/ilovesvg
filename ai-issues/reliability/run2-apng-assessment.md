# Run 2 animated PNG preparation assessment

Status: LOCAL VALIDATED for the synthetic cases below. No application, package, server, preset or decoder change was made. No private incident files or production uploads were used.

## Fixture and paths

`scripts/apng-preparation-browser.mjs` constructs valid two-frame APNG containers from two independently Sharp-encoded RGBA PNG frames. The file contains standard acTL/fcTL/IDAT/fdAT chunks, sequential frame/control numbers and independently checked PNG CRC32 values. Frame one contains an opaque red shape over transparency; frame two contains blue, each with a one-second delay. The default PNG image is the first animation frame. Sharp independently decodes that default frame as red. No new animation decoder dependency was installed.

Small fixture: 300x120; oversized-side fixture: 9000x120. Generated fixtures and reports stay in ignored `tmp/run2-apng-preparation/`.

The current `prepareRasterUpload` module was executed in actual Chromium, Firefox and WebKit engines, with Chromium/WebKit mobile emulation in addition to desktop. Both ImageBitmap and explicitly forced HTMLImageElement paths ran where supported: five configurations, ten normalization paths, all passed.

## Results

- The valid small APNG returns the **same original File object**, with zero decode calls during preparation. The normal fast path does not universally flatten or recompress animated files.
- Each oversized APNG is normalized to **8000x106**, retaining the first/default red frame (RGB 240,20,30), opaque interior and alpha-zero background.
- Each normalized output is a static PNG with **no acTL animation chunk**. Preparing an oversized animated source therefore preserves one static frame, not its animation. This matches the static tracing/export workflow; it is not animated SVG export or a promise to retain all source frames.
- Both ImageBitmap and HTMLImageElement paths produced the same first-frame/alpha semantics in these cases. No unexpected blue frame or black background appeared.
- An APNG-derived PNG header declaring 100000x100000 pixels was refused before any decode call in every configuration. This is a deliberate hostile-header admission probe, not a claim that a full valid ten-billion-pixel animation was generated or decoded.
- Fixture CRC/frame structure and normalized dimensions/colors/alpha/static format are asserted, not inferred from a success message.

## Memory and compatibility limits

This bounded two-frame test does not measure iOS native decoder caches, GPU surfaces, WASM memory or aggregate memory for arbitrary frame counts. The normalizer's source/working budget currently uses the primary image dimensions and compressed file bytes; it does not count every acTL frame's full decoded raster as a simultaneous allocation. A long, highly compressed animation can have a very different internal browser/cache cost. These tests do not establish that all such inputs are safe, and no memory ceiling was expanded to accommodate them.

ImageBitmap/HTML/canvas output was observed on desktop engines and mobile emulation. No physical iPhone was tested. This assessment also does not imply that any converter implements animated output: ordinary source preservation and a static conversion result are separate behaviors.

## Reproduction

Provide an existing compatible Playwright module using `PLAYWRIGHT_MODULE`; optional cached browser overrides use `RASTER_CHROMIUM_EXECUTABLE`, `RASTER_FIREFOX_EXECUTABLE` and `RASTER_WEBKIT_EXECUTABLE`. Then run:

```
node scripts/apng-preparation-browser.mjs
```

Result: `tmp/run2-apng-preparation/report.json`. The script runs the module on about:blank and makes no conversion request or third-party service call.
