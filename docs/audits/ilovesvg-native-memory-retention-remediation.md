# iLoveSVG native-memory retention remediation

## Milestone

- Starting commit: `7929e832336f279b5dcb9d94512b64407e3beb75`
- Branch: `milestone/native-memory-retention-remediation`
- Scope: server-side native image memory, its JavaScript ownership boundaries, and bounded production-like regression coverage
- Deployment: not performed

This milestone does not change routes, metadata, schema, sitemaps, public content, converter settings, presets, accepted inputs, validation limits, output names, deployment files, or All Tools. It changes only server resource ownership and disabled-by-default internal diagnostics.

## Production evidence supplied for the investigation

The supplied production measurements establish a long-lived `node server.js` process with approximately 827–887 MiB RSS after about 2 days 20 hours. Approximately 779–838 MiB was private anonymous memory, file-backed RSS was about 49 MiB, swap was zero, the reported V8 heap was about 14–25 MiB, and a restart released the accumulated memory. The process had 22 file descriptors, 11 threads, no children, and no deleted open files. Sharp and libvips were loaded. Large anonymous mappings ranged from about 40 MiB to 244 MiB.

Those observations locate the growth in the application process and primarily outside the ordinary V8 heap. They do not, by themselves, distinguish live native allocations from allocator arenas retaining previously freed pages.

## Repository inventory

### Central server image-processing owners

| Owner | Role | Native/intermediate ownership before this milestone |
| --- | --- | --- |
| `app/utils/conversionModules.server.ts` | Common Sharp entry point | Configured Sharp lazily, but did not own the only Sharp import |
| `app/utils/potraceCompat.ts` | Standard Potrace fallback | Independently loaded Sharp; decoded to raw RGBA; copied the entire raw Buffer into a second `Uint8ClampedArray`; 16 MiB/32-entry/10-minute SVG cache |
| `app/utils/bmpDecode.server.ts` | BMP normalization | Independently loaded Sharp; BMP source, decoded RGBA, and encoded PNG can coexist during normalization |
| `app/utils/imagePreprocess.server.ts` | Raster preprocessing | Metadata, transformed pipeline, grayscale/raw masks, edge masks, cleanup arrays, and encoded mask PNG; two exclusive raw buffers were copied before mutation |
| `app/utils/svgLayerTrace.server.ts` | Layered tracing | Source raw RGBA, palette samples, assignments, one per-layer mask at a time, encoded mask, paths, layer metadata, and final SVG |
| `app/utils/conversionGate.server.ts` | Cross-route server admission | Allowed two full native image conversions at once and up to eight queued requests |
| `app/utils/memoryDiagnostics.server.ts` | Opt-in memory checkpoints | Reported process memory and store counts, but not Sharp state, cache bytes, or the global gate snapshot |

### Routes reaching Sharp

The actual route sources were searched, rather than inferred from route names. Forty-three route files call the common `getSharp()` path:

- Standard raster tracing: home, PNG, JPG, JPEG, WebP, Cricut, Etsy, Silhouette, and laser-cutting routes.
- Specialized tracing: outline/photo outline, line-art, sketch, drawing, black-and-white, logo, sticker, icon, scan, and their applicable Cricut routes.
- Layered output: generic/image, PNG, JPG, and logo layered Cricut routes.
- Cricut production output: Print Then Cut and Cricut stickers; Cricut vinyl reaches the standard trace helpers.
- Text/Base64-related raster fallback: Base64 routes and code-to-SVG-for-Cricut.
- Emoji: Sharp metadata validation before the existing conversion flow.

The route files do not import the Sharp package directly; they reach it through `conversionModules.server.ts`. Before this milestone, Potrace and BMP normalization were the two exceptions and route-local code also reset the process-global cache to either 32 or 48 MiB.

SVG-to-PNG, favicon/ICO generation, resize/inspection, archives, and browser previews were checked. Their current production implementations are browser/canvas, text, or client archive paths and do not add a separate server Sharp pipeline. No server-side Sharp rasterization path exists in those route families on this commit.

### Limits and peak representations

- Shared Potrace accepts at most 16 MiB compressed input, 8,000 pixels per side, and 24 megapixels.
- Many public trace actions admit up to 30 MiB and 30 megapixels before the shared trace helper applies its narrower authoritative limit.
- Print Then Cut and sticker actions admit up to 30 MiB, 8,000 pixels per side, and 30 megapixels.
- At 24 megapixels, one RGBA surface is approximately 96 MiB. The former Potrace copy therefore made the JavaScript-visible RGBA ownership approximately 192 MiB per request before Potrace and native decode overhead.
- Two admitted conversions could overlap the compressed uploads, decoded/native surfaces, two RGBA representations per single trace, masks, encoded intermediates, SVG output, and response serialization.

### Long-lived stores

| Store | Ownership and bound |
| --- | --- |
| Server Potrace SVG cache | 32 entries, 16 MiB total, 2 MiB per item, 10-minute expiry; rejected/cancelled work is not written |
| Browser conversion cache | 30 entries, 25 MiB total, 5 MiB per item; client-only and not part of server RSS |
| Rate-limit/session stores | Count- and age-bounded; contain counters/metadata, not image Buffers |
| Shared conversion gate | One fixed process singleton; retains only queued resolve callbacks while waiting |
| Sharp/libvips cache | Process-global; formerly changed between 32 and 48 MiB from multiple request paths |

No server result-history store, output Buffer cache, preview Buffer cache, or unbounded server promise registry was found. Completed SVG results returned in responses are not inserted into server history.

## Reproduction harness

`scripts/native-memory-retention-audit.mjs` runs with `--expose-gc` and has two layers:

1. A direct installed-Sharp matrix exercises module load, repeated metadata, small and large resize, PNG/JPEG/WebP encoding, and transparent processing. It records `process.memoryUsage()`, `v8.getHeapStatistics()`, Sharp cache statistics, Sharp counters, and post-GC/post-idle floors.
2. An isolated built production `node server.js` receives real HTTP action requests for standard trace, specialized black-and-white trace, layered trace, Base64 trace, Print Then Cut, and stickers. It covers repeated identical inputs, repeated unique inputs, two concurrent requests, invalid dimensions, invalid encoded data, repeated oversized uploads, a delayed client abort, settlement, and short/long idle.

Fixtures are generated in memory from the committed small PNG fixture. No fixture, report, heap snapshot, screenshot, browser profile, or server log is written to the repository.

The production child is launched through `scripts/native-memory-server-wrapper.mjs` with a test-only IPC channel and `--expose-gc`; that wrapper then imports the unchanged production `server.js`. The wrapper accepts the exact IPC message only when `ILOVESVG_MEMORY_AUDIT_IPC=1`, an IPC parent exists, and exposed GC is present. It has no HTTP endpoint, records no user data, returns only `process.memoryUsage()`, and is never used by the production start command.

Each server checkpoint combines:

- RSS, heap used/total, external, ArrayBuffer, and approximate unclassified process memory
- active conversion jobs, pending waiters, gate and queue capacity
- Potrace cache entry count and estimated bytes
- Sharp loaded state, concurrency, queue/process counters
- Sharp memory/item/file cache state
- completed, failed, and client-cancelled workload counts derived in the bounded harness

The acceptance check compares multiple post-GC/post-idle floors. It permits warmup and a native allocator high-watermark, but fails continued per-batch growth beyond a relative and fixture-scaled tolerance.

## Controlled causality results

Before production changes, a direct 1,800×1,200 Sharp matrix produced:

| Variant | Start | Post-idle floor | Interpretation |
| --- | ---: | ---: | --- |
| 48 MiB cache, 100 items, concurrency 1 | 52.19 MiB | 56.43 MiB | Stable |
| Cache disabled, concurrency 1 | 52.09 MiB | 54.24 MiB | Only about 2.2 MiB lower; cache is not the principal cause |
| 8 MiB/16-item cache, concurrency 1 | 52.19 MiB | 54.46 MiB | Stable |
| 48 MiB cache, concurrency 4 | 52.36 MiB | 93.66 MiB | Native parallelism retained about 39 MiB more high-watermark RSS |

The earlier unchanged production smoke, using the old two-job gate and smaller 800×400 fixture, reached about 225.2 MiB peak and 209.5 MiB at its final checkpoint. It was not a plateau test and is recorded only as a pre-change reference.

The first new production run deliberately did not force GC in the isolated server. Unique-input checkpoints rose from about 255.2 MiB to 291.2 MiB and external memory remained high. That result was treated as inconclusive, not passed off as a native leak. With the IPC-only post-settlement GC checkpoint, the same workload separated unreachable Buffer memory from the native floor.

Final local results on the development host:

| Workload | Post-GC/post-idle observations |
| --- | --- |
| Direct Sharp, seven mixed batches | 62.03, 62.04, 62.01, 62.02, 62.05, 62.74, 62.21 MiB; last-three spread 0.69 MiB |
| Production identical inputs, five batches | 236.93, 237.72, 240.36, 240.39, 240.15 MiB; last-three spread 0.24 MiB |
| Production unique inputs, six batches | 241.02, 241.58, 241.79, 242.84, 242.16, 246.95 MiB; last-three spread 4.79 MiB |
| Repeated rejected 30 MiB uploads, three batches | 235.67, 249.69, 235.67 MiB; last-three spread 14.02 MiB, with no monotonic rise |
| Production long idle after failure workloads | 236.02 MiB RSS; zero active jobs/waiters/Sharp queue/Sharp processes |

The local production process reached a stable floor after warmup. The intentionally oversized multipart requests varied within a bounded 14.02 MiB window across three post-GC observations, showed no monotonic rise, and returned to 235.67 MiB on the third batch. The process did not return to cold-start RSS and was not required to do so.

## Root cause

The evidence supports a combined root cause:

1. **Excess peak ownership:** every Potrace request copied the full raw RGBA image. At the shared 24-megapixel limit this was an avoidable 96 MiB copy.
2. **Peak multiplication:** the process admitted two full native image conversions simultaneously, allowing their compressed inputs, decoded surfaces, raw arrays, masks, encodes, SVG strings, and responses to overlap.
3. **Inconsistent process-global Sharp policy:** three Sharp loader paths and six route files could bypass or reset cache settings.
4. **Native allocator high-watermark/fragmentation:** the supplied production RSS is private anonymous and far larger than V8 heap/cache ownership. The controlled concurrency experiment retained materially more RSS after idle. Sharp documents that the default glibc allocator can fragment under long-running multithreaded workloads and that RSS can remain above live memory after frees. See [Sharp installation: Linux memory allocator](https://sharp.pixelplumbing.com/install/#linux-memory-allocator) and [Sharp issue 2607](https://github.com/lovell/sharp/issues/2607).

This is not evidence of an indefinitely retained application Buffer collection. It is evidence that unnecessarily high native peaks were repeatedly raising a fragmented allocator floor.

## Corrections

### One Sharp runtime owner

`app/utils/sharpRuntime.server.ts` is now the only Sharp package loader and process-policy owner. `conversionModules.server.ts`, `potraceCompat.ts`, and `bmpDecode.server.ts` all use it. Route-local cache/concurrency resets were removed.

The fixed policy is:

- Sharp concurrency: 1
- Sharp memory cache maximum: 16 MiB
- Sharp operation-cache item maximum: 32
- Sharp file cache maximum: 0

The cache remains enabled. It was reduced and made consistent because controlled results showed a small bounded benefit; disabling it entirely did not materially change the native floor.

### One native conversion at a time

The shared production conversion gate now defaults to one active conversion and eight queued requests. This prevents two maximum-size raw/native pipelines from multiplying peak ownership. FIFO admission, busy response, queue capacity, release behavior, and route behavior remain unchanged.

### Removed full-buffer copies

- Potrace receives a zero-copy `Uint8ClampedArray` view over Sharp's exclusive raw Buffer instead of a second full allocation.
- Grayscale cleanup uses the exclusive Sharp output Buffer directly when no cleanup replacement is needed.
- Route-shared color removal and layered preprocessing mutate their exclusive Sharp output Buffer directly before re-encoding.

The transformations, order, dimensions, path generation, pixels, and encoded outputs are unchanged. Existing parity suites validate that the ownership change is observationally neutral.

### Better disabled diagnostics

When existing memory diagnostics are explicitly enabled, checkpoints now include:

- current gate active/waiting counts and capacities
- Potrace cache bytes as well as entries
- Sharp concurrency, queue/process counters, and cache state

The feature remains disabled by default and the event remains flat, bounded, and free of filenames, request bodies, image data, paths, credentials, and environment values.

## Alternative causes ruled out or bounded

- **V8 object leak:** inconsistent with the supplied 14–25 MiB heap and the post-GC stable local floors.
- **Application cache leak:** the only server SVG cache is byte-, item-, item-size-, and time-bounded; the final workload retained about 1.06 MiB across 10 entries.
- **Sharp cache alone:** disabling it changed the settled direct floor by only about 2.2 MiB.
- **File descriptors/deleted files/children/threads:** supplied production measurements were small/stable and no repository path connects them to retained image buffers.
- **Server output/history retention:** no server binary result history was found.
- **Broad parallel layer encoding:** the shared layered loop is sequential; it does not use `Promise.all` for full-size layer masks.
- **SVG-to-PNG/favicon/ICO server paths:** current implementations do not load Sharp on the server.
- **WASM as the primary production owner:** the production evidence explicitly loads Sharp/libvips and the reproducing server workloads plateau after native peak controls. Browser WASM is not resident in `node server.js`.
- **Sharp pipelines retained in a registry:** no pipeline registry exists, and Sharp queue/process counters return to zero.

## Cleanup, cancellation, and failures

All shared actions release the conversion gate in `finally`. The focused workload ended with zero active jobs, zero pending waiters, zero queue entries, zero Sharp queue entries, and zero Sharp active processes. Invalid dimensions, malformed image data, and repeated oversized requests did not create unbounded post-idle growth or enter the trace cache. The delayed client-abort workload settled without leaving active native ownership.

Sharp and Potrace do not expose cooperative cancellation for every stage. A client disconnect can therefore allow the already-started operation to finish, but the operation is bounded by the single native gate and its references settle afterward. This milestone does not change public timeout, error, retry, or response behavior.

## Output preservation

The deterministic production request repeated before/after diagnostic modes produced identical SVG. The complete converter, trace, layered-output, favicon/ICO, SVG-to-PNG, output-UX, and conversion-action parity gates are required before commit and again on merged main. No baseline is rewritten to accept an output difference.

## Known allocator behavior and limitations

- RSS is not required to return to cold start. libvips and the native allocator can retain reusable pages.
- The local audit host is not the production glibc droplet. It proves bounded ownership and plateau behavior for the reproducing workload; it cannot certify the exact production plateau.
- The harness generates medium/large deterministic fixtures but cannot reproduce several days of real traffic within a repository check.
- The single native gate prioritizes a bounded memory envelope over simultaneous full-resolution native work. Queue semantics and response contracts are preserved.
- No allocator replacement, `MALLOC_ARENA_MAX`, scheduled restart, PM2 memory restart, or deployment configuration change is part of the fix.

## Production verification for the user

After this repository milestone is deployed manually:

1. Record the old production commit and immediate/idle RSS and private-anonymous baseline.
2. Pull the validated `main` commit.
3. Run dependency installation only if the deployed dependency tree requires it; this milestone does not change `package-lock.json`.
4. Build the application.
5. Restart the PM2 application manually.
6. Identify the actual server PID with `pgrep -f 'node server\.js'`; do not assume a wrapper PID is the server.
7. Record immediate RSS and private-anonymous memory for that PID.
8. Record an idle checkpoint after the process settles.
9. Exercise representative single trace, layered trace, SVG-to-PNG, Print Then Cut, sticker, and favicon flows.
10. Record post-conversion and post-idle RSS/private-anonymous memory.
11. Repeat over representative traffic and verify that post-idle measurements approach a plateau rather than rising per batch/day.
12. Keep diagnostics disabled unless a short, privacy-reviewed sample is needed.

Production commands are intentionally not executed by Codex.

## Artifact and privacy result

The audit emits measurements only to stdout. No memory JSON, heap snapshot, profile, screenshot, browser download, fixture, log, browser profile, absolute personal path, credential, or environment dump is committed. Generated build and runtime paths remain ignored. Temporary processes and the isolated audit port are cleaned on success and failure.

## Milestone verdict

The reproducing direct-Sharp and production HTTP workloads reach a stable bounded post-GC/post-idle plateau. Cache bytes stay bounded, native work counters return to zero, and output parity remains mandatory. Manual production observation remains necessary because the production allocator and traffic duration cannot be reproduced exactly on the local host.

`NATIVE MEMORY REMEDIATION COMPLETE: the reproducing workloads reach a stable bounded plateau and output parity passed.`
