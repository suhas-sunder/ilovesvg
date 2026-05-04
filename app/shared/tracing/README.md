# Tracing Engine Architecture

Raster-to-SVG tracing is routed through a small engine policy layer instead of
calling a concrete tracer directly from UI code.

- `auto` mode prefers VTracer when the browser can run the worker safely and the
  selected settings are color, layered, photo/edge, or otherwise VTracer-friendly.
- Potrace remains the compatibility fallback for legacy line-art, logo, scan,
  silhouette, cut-file, oversized, unsupported-browser, and failed-worker cases.
- Client VTracer work runs in a lazy module worker. The WASM file is emitted as a
  separate asset and is only requested when a conversion is routed to VTracer.
- Server routes keep the existing validation, rate-limit, concurrency, Sharp,
  Potrace, and SVG-sanitization protections for fallback paths.

Do not route a preset to VTracer only because VTracer exists. Route it when the
output intent benefits from color/vector layering or browser-side tracing and
fallback to Potrace whenever quality parity is uncertain.
