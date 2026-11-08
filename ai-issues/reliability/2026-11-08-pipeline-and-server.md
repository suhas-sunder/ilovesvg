# Conversion pipeline and server protection — November 8, 2026

## Upload to downloaded SVG

The route-family manifest resolves wrappers to actual owner components. Uploads arrive via their picker/drop handler (the PNG owner uses handleNewFile); clipboard support is route-specific, not globally promised. Mobile Photos selection still supplies a File and can be a format the route does not support. PNG/JPEG/WebP headers are now read from a bounded slice before dimensional decisions on the PNG owner. HEIC/HEIF and ProRAW/DNG are not supported by that owner; renaming them cannot make their TIFF/HEIF bytes a JPEG.

PNG-family preparation leaves valid files unchanged. Only over-limit files enter bounded local normalization; unsafe sources stop with export/resizing guidance. Preview object URLs and dimensional state precede conversion validation and the settings snapshot. File/settings fingerprints drive bounded cache/in-flight deduplication. Shared engine policy admits supported browser worker/WASM tracing within its own limits. Default legacy line/outline/Potrace paths and quality-tier layered settings may deliberately use the server. Explicit centerline/VTracer failures are not silently replaced by an incompatible engine. See the hybrid report for the capability matrix.

When supported, browser failure submits multipart once through the React Router fetcher. Express server.js checks browser Origin/Referer against expected origin (forwarded proto/host where configured). Route actions apply their own same-origin/rate checks, request-size guard, bounded multipart parser, file-count/type/extension/signature validation and conversion gate. PNG checks dimensions with Sharp metadata. Shared normalization prepares raster pixels, then Potrace or the layered pipeline generates geometry. Native work retains gate ownership through settlement; returned SVG is made editable/responsive, recolored and output settings applied. JSON/fetcher data includes job identity where implemented; pending UI/history resolves to the source/settings snapshot. Copy/download use the saved output. Existing SVG/appearance post-processing and history stay intact.

Cancellation now prevents shared-hook work during hashing, releases cache waiters, suppresses canceled late results, and removes queued server waiters for homepage/PNG actions when their request signal aborts. It does not claim to interrupt active native work or recover after the operating system terminates a tab. Other gate callers have not yet opted into the new signal argument.

## Distinct limits; no ceiling was raised

| Layer | Source-backed limit / behavior |
| --- | --- |
| PNG owner upload | 30 MiB; 30 MP; 8000px side; multipart declared-length rejection above 35 MiB; one file |
| Shared backend defaults | 12 MiB file; 16 MiB multipart; 24 MP; route options can override defaults |
| Browser VTracer | 8 MiB; 8 MP; 2600px side plus required browser APIs/settings eligibility |
| New local normalizer | original at most 64 MiB; bounded 256 KiB header; over-limit source at most 32 MP/mobile or 48 MP/desktop plus estimated 192/384 MiB working budget; target 6/12 MP; at most four lossless PNG encoding attempts; output at most 30 MiB |
| Shared server gate | one active conversion, at most eight waiters per process; unchanged |
| Sharp runtime | concurrency one; native cache 16 MiB, 32 items, zero files; unchanged |
| Potrace input | 24 MP after upstream preparation; own side/signature guards; unchanged |

30/12 MiB and 30/24 MP are layered route/default/engine contracts, not proof that every 30 MP source is sent unchanged to a 24 MP trace engine. No general-purpose server resizing service or new upload ceiling was introduced. Native caches, conversion cache and rate-limit stores already have repository bounds; historical unbounded-store findings must not be presented as still present without reproduction.

## Production evidence boundary

Live / and /png-to-svg-converter returned 200 behind Cloudflare. One deterministic 32x24 synthetic black-shape PNG POST to /png-to-svg-converter.data returned 200 and SVG in about 121 ms from this host. This is a real public server action, not proof of all engines, mobile requests, overload handling or deployed source SHA. No user artwork was uploaded.

Origin headers, actual reverse-proxy trust, process/container count, Droplet identity, resource limits, co-hosted sites, production logs, idle/peak RAM, CPU and rollback/deployment mechanism remain unavailable. Never infer that a named DigitalOcean Droplet is this runtime, or that current GitHub main is the deployed version. No production restart, infrastructure change or memory-heavy probe was performed. Deployment remains BLOCKED until identity and rollback can be verified.

## Confirmed server-waiter defect

The previous gate ignored request cancellation. A queued closure remained until an active job released its slot, then could start work for a disconnected request. scripts/conversion-gate-cancellation.mjs reproduced failure to settle before the fix. Optional AbortSignal support now removes queued waiters promptly, removes listeners when acquired/canceled and retains FIFO/idempotent release. Tests cover pre-abort, queued abort, middle-waiter removal and abort after acquisition; active work keeps its slot. Homepage/PNG callers return an empty 499 for a canceled waiter rather than mislabeling it BUSY. No output algorithm changes.

## Open server risks

Multipart parsing still precedes gate admission in many route actions, so the gate alone is not a global bound on all incoming upload bodies. A safe process-wide streaming admission change needs separate integration and actual proxy topology; increasing concurrency is not a remedy. Forwarded-origin trust must be evaluated at the real proxy before any security change. Some trace phases are synchronous and cannot be interrupted by a JavaScript timeout; do not release native ownership early to appear canceled.
