# iLoveSVG memory-safety and post-processing cleanup audit

- Audit date: 2026-07-12
- Repository scope: iLoveSVG.com only
- Branch: `milestone/memory-safety-cleanup`
- Pass: first-pass repository audit; no application fixes in this pass
- Evidence boundary: source and configuration committed in this repository. Production host state was not available and is listed separately in section 12.

## Audit method and architecture summary

The audit covered the complete tracked repository, including the React Router route manifest and wrapper routes, Express server entry, server-assisted actions, browser-only converters, shared tracing and post-processing helpers, Web Workers, cache and gate utilities, deployment files, and diagnostic/smoke scripts. Wrapper routes that re-export or delegate to a template route inherit the template's allocation and cleanup behavior; they were not treated as independent implementations merely because they have different public URLs.

The server uses in-memory multipart upload handlers and returns conversion results in JSON. Server raster tracing is primarily Sharp/libvips plus Potrace or VTracer-style layered processing. Browser conversion paths use `File`/`Blob`, `ArrayBuffer`, canvas, Web Workers, data URIs, and retained result history. There is no production disk-backed temporary-file pipeline in the application code. `server.js` loads one production server bundle in one Node process when started by the repository's Docker/npm configuration; an external process manager may change that in production, but none is defined here.

Terminology in this report is deliberate:

- **JavaScript heap** means objects, Maps/Sets, closures, arrays, and strings managed by V8.
- **External/Buffer memory** means Node `Buffer` storage reported outside ordinary V8 heap accounting.
- **ArrayBuffer/typed-array memory** means browser or Node backing stores, sometimes reported separately from heap.
- **Native memory** means Sharp/libvips decode surfaces, caches, WASM memory, canvas/browser image resources, and native library allocations not fully represented by `heapUsed`.
- **Retained** means reachable by design or by a missing lifecycle cleanup. **Temporary** means reclaimable after all references and native work are finished. Neither term alone means “leak.”

## 1. Executive summary

### Most likely sustained-memory causes

1. The shared backend rate-limit store in `app/utils/backendSecurity.server.ts` is process-wide and has no deletion, TTL pruning, entry cap, or byte cap. Its key contains IP, user agent, route, and action, so cardinality can grow for the full process lifetime.
2. Several route-local/global rate-limit stores have the same process-lifetime growth pattern. The common `__ilovesvg_action_rate_limits` store is used by thirteen route implementations; four additional routes use separate named global stores. These protections must be preserved and made bounded, not removed.
3. The module-level appearance caches in both trace output panels survive route unmount and can retain the last route's base and edited SVG strings until another compatible panel mounts and prunes them.
4. Output history intentionally retains SVG strings, settings snapshots, layer path metadata, source snapshots, and sometimes one previous/next edited version per result. This is expected product behavior, not a defect. The geometry is often present both in the SVG and in `layers[].pathTags`, so the retained amount can materially exceed the SVG string alone.
5. The conversion cache, export-compression caches, font cache, Twemoji cache, and Potrace result cache are entry-bounded. Some are not byte-bounded or use approximate byte accounting, so actual retained memory can exceed their nominal budgets, but they are not unbounded by entry count.
6. `code-to-svg-for-cricut.tsx` contains a very large module-level sample assembled from Base64 fragments. It is static, bounded, and expected to remain while that module/chunk is loaded; it is not a leak, although it adds avoidable baseline memory and bundle parse cost.

### Most likely burst-memory causes

1. All 44 server conversion-gate call sites parse multipart form data, JSON, or form data before acquiring the gate. The gate limits active conversion work, but up to the running and queued limits—and additional requests rejected only after parsing—can already hold complete `File`, Base64, or SVG bodies in memory.
2. Potrace single-trace processing can overlap the uploaded `Buffer`, Sharp/libvips decode state, raw RGBA (`4 × pixels` bytes), a second `Uint8ClampedArray` copy (`4 × pixels`), Potrace structures, SVG text, optimized SVG text, and JSON serialization. At the 24-megapixel validation ceiling, each full RGBA representation is about 96 MB before object/native overhead.
3. Image cleanup algorithms use full-frame grayscale/RGBA buffers plus masks, visited arrays, and `Int32Array` queues. A 24-megapixel connected-component pass can require roughly 24 MB per one-byte mask/visited array and 96 MB for a full `Int32Array` queue, in addition to input/output and native decode memory.
4. Layered tracing retains a raw RGBA image, pixel-to-layer indexes, layer masks and PNGs, accumulated traced path strings, and duplicated layer metadata. The compact-trace quality fallback may perform a compact trace and then a full per-color trace for the same input when the compact result has too few groups. This is quality-preserving behavior but creates a high peak.
5. Browser layered workers can overlap decoded `ImageData`, a copied RGBA array, quantizer data, layer-index arrays, multiple full-frame masks, traced strings, and WASM memory. The client trace scheduler permits two active jobs, so two peaks can overlap.
6. SVG-to-PDF can overlap a canvas as large as the route's 80-million-pixel ceiling (approximately 320 MB just for RGBA), SVG/Canvg structures, a Base64 PNG/JPEG data URI, jsPDF image state, PDF bytes, and an additional `Uint8Array` copy used to make the result Blob.
7. Favicon/ICO/ZIP generation converts canvas pixels through `toDataURL`, an expanded Base64 string, `atob` binary strings, and `Uint8Array` copies, then retains PNG bytes and a copied ICO/archive output. Base64 generally expands byte data by about one third before JavaScript string representation overhead.

### Confirmed defects

- Unbounded process-wide shared and route-specific rate-limit Maps can grow for the full process lifetime.
- Request bodies are fully parsed before conversion-gate admission at every audited gate call site, so the gate does not bound upload/body memory.
- A request aborted while waiting in the server gate is not removed from the queue; the queued closure can retain its parsed body and later run unnecessary conversion work.
- `withTraceTimeout` rejects without cancelling the underlying Potrace/Sharp task. Synchronous `getSVG()` also blocks the event loop, so a JavaScript timer cannot interrupt the expensive synchronous phase. If timeout wins during an asynchronous phase, the action releases its gate slot while detached native/trace work can continue, temporarily exceeding configured concurrency.
- `svg-to-favicon-generator.tsx` revokes the temporary SVG object URL only after a successful image load; the failure path does not revoke it.
- `png-to-svg-for-cricut.tsx` and `png-to-svg-for-silhouette.tsx` create output source snapshot object URLs but do not provide the unmount cleanup used by peer routes.
- `useHybridTraceFetcher.ts` rejects its server-dedupe waiters on unmount but does not invoke all retained client cancellation handlers. Active or queued client workers can therefore continue after navigation until they finish or time out.
- `TraceOutputPanel.tsx` and `BespokeTraceOutputPanel.tsx` do not clear/prune their module-level output appearance SVG caches on unmount, leaving the last route's large strings reachable.
- `vtracer.worker.ts` frees the trace configuration only on the successful line after conversion rather than in `finally`. Parent-side worker termination ultimately releases worker memory, but the resource is not promptly released on an in-worker exception.

### Suspected or measurement-dependent issues

- Sharp cache configuration is process-global but is applied in multiple route request paths with both 32 MB and 48 MB values. This is not evidence of a leak, but concurrent requests can repeatedly change global native-cache behavior. Consolidation would change runtime configuration semantics and needs measurement and explicit approval.
- The nominal 25 MB browser conversion-cache budget undercounts UTF-16 string/object overhead and layer path duplication. It is bounded, but the true heap footprint is unknown.
- Export source/compression caches are count-bounded to 48 entries rather than byte-bounded. `sourceCacheRef` can retain removed outputs until eviction while the component stays mounted.
- The worker queue is an unbounded JavaScript array. Normal batch limits constrain common use, but direct or future callers can enqueue arbitrary closures and their captured files/settings.
- Source snapshot URLs created for replacement jobs on the two identified routes may also survive failed replacement paths. This must be confirmed with a targeted failure test before changing job/history semantics.
- Sharp/libvips native memory and WASM/canvas backing stores can remain above baseline after JavaScript objects become unreachable because allocators and native caches retain reusable pages. RSS remaining high by itself is not proof of a leak.
- External deployment restarts may be masking sustained growth, but the repository contains no memory-based restart or scheduled-restart configuration. Production evidence is required.

### Normal and expected behavior

- User-visible output history, source snapshots, editing metadata, current previews, output Blobs, and copied/downloadable data remain reachable while the owning route is mounted. Their retention is intentional and must not be reduced.
- Fixed MIME/extension/SVG sanitizer/preset/capability/navigation Sets are immutable, small, and bounded by source code.
- The Potrace cache is capped at 32 entries and an estimated 16 MB; the browser conversion cache is capped at 30 entries and an estimated 25 MB; Twemoji is capped at 512 entries; the font cache is capped at 64 entries. Expired or unused items may remain until traffic/activity, but entry growth is bounded.
- A Node `Buffer.from(arrayBuffer)` that wraps an `ArrayBuffer` without offset transformation can share its backing store; not every `Buffer.from` is a copy. By contrast, `Buffer.from(existingBuffer)`, `new Uint8ClampedArray(typedArray)`, `arrayBuffer.slice(0)`, Base64 decode/encode, `structuredClone`, and canvas `toDataURL` produce significant copies in the audited paths.
- Sharp metadata and decode work, SVGO parse/serialize, JSON serialization, browser image decode, canvas surfaces, and Blob creation necessarily allocate temporary memory. The cleanup question is whether their references/native work end, not whether the allocation exists.

### Safe versus approval-required next work

Immediate low-risk work is bounded-store pruning that never evicts active protection, lifecycle cleanup in `finally`/unmount, and opt-in measurement. Changes to request admission, Potrace cancellation architecture, Sharp configuration, layered representations, history serialization, sample delivery, or zero-copy mutation boundaries can change timing or behavior and require explicit approval after measurement.

## 2. Memory-risk table

| Priority | Risk level | Source file | Symbol/function | Route or conversion family | Resource type | Growth pattern | Cleanup behavior | User-visible behavior risk | Recommended future fix |
|---|---|---|---|---|---|---|---|---|---|
| P0 | High, confirmed | `app/utils/backendSecurity.server.ts` | `__ilovesvg_backend_rate_limits` / `checkBackendActionRateLimit` | Shared server actions | JS heap Map | Unbounded by IP + UA + route + action for process lifetime | Window counters reset on access; records never deleted | Low if active limits fail closed and only expired records are pruned | Add expiry-aware scheduled pruning, hard entry/byte accounting, and fail-closed overflow behavior; preserve all limits |
| P0 | High, confirmed | Thirteen route files listed in section 3 | `__ilovesvg_action_rate_limits` | Raster/Cricut/layered actions | JS heap Map | Unbounded high-cardinality process-wide store | No idle cleanup, entry cap, or byte cap | Low with parity tests | Move equivalent records to one bounded implementation without changing keys/windows |
| P0 | High, confirmed | Four special route files listed in section 3 | Named route rate-limit globals | Route actions | JS heap Map | Unbounded process-lifetime cardinality | No deletion/cap | Low with parity tests | Apply the same bounded/fail-closed policy; preserve route-specific limits |
| P0 | High burst, confirmed | `app/utils/conversionGate.server.ts`; all 44 action call sites | `acquireConversionSlot` | All server-assisted families | Parsed `File`/Buffer/string plus queue closures | Queue is bounded to 8, but bodies are parsed before admission and aborted waiters remain | Slot release is safe; queued request cancellation is absent | Medium; admission order affects request errors/timing | First add measurement; then design abort-aware pre-body admission or streaming admission with explicit approval |
| P0 | High burst, confirmed | `app/utils/potraceCompat.ts` | `withTraceTimeout`, `traceRasterToSvg` | Single raster-to-SVG/Potrace | Native work, Buffer, typed array, detached promise | A timed-out task may continue after gate release | Timer is cleared; underlying work is not cancelled | High; architecture change could affect output/timing | Measure detached work; only then introduce a cancellable isolation boundary with explicit approval |
| P1 | High burst, expected | `app/utils/potraceCompat.ts` | raw Sharp output / `new Uint8ClampedArray(raw.data)` | Single raster-to-SVG | Native RGBA + Buffer + typed-array copy | Per job; up to about 192 MB for two 24 MP RGBA copies | Reclaimable after trace promise and native work finish | Medium; mutation assumptions must be proven | Benchmark whether Potrace accepts a safe view without mutation; retain copy unless equivalence is demonstrated |
| P1 | High burst, expected | `app/utils/imagePreprocess.server.ts` | component cleanup, edge/mask helpers | Raster/Cricut preprocess | Raw buffers, byte masks, visited arrays, Int32 queues | Several full-frame representations per active job | Function-local/reclaimable | High; algorithms affect quality | Instrument per stage; optimize one proven redundant copy at a time with pixel/SVG equivalence fixtures |
| P1 | High burst, expected | `app/utils/svgLayerTrace.server.ts` | layered tracing and compact fallback | Layered SVG/Cricut | RGBA, indexes, masks, PNGs, path strings, layer metadata | Per layer/job; compact work may precede full fallback | Sequential locals reclaim; output/layers retained intentionally | High | Measure by preset/layer count; avoid architecture changes unless peaks remain unacceptable |
| P1 | High burst, expected | `app/client/workers/vtracer.worker.ts` and layered helpers | decode/quantize/trace | Client raster/layered SVG | ArrayBuffers, ImageData, typed arrays, WASM, masks | Two active workers can overlap; queued callbacks unbounded | Worker terminated per job; config exception cleanup incomplete | Medium | Add `finally` cleanup now; measure queue/worker peaks; consider bounded queue later without reducing allowed workflows |
| P1 | High burst, expected | `app/routes/svg-to-pdf-converter.tsx` | canvas + Canvg + jsPDF conversion | SVG-to-PDF | Canvas/native image, Base64 string, PDF typed arrays/Blob | Per conversion; canvas can approach ~320 MB RGBA at current limit | Locals reclaim; result bytes/URL retained intentionally | High | Instrument exact stages; evaluate `toBlob`/ArrayBuffer copy removal only with byte/render parity approval |
| P1 | Medium sustained, confirmed | `app/client/components/converter/TraceOutputPanel.tsx` | `outputAppearanceStore`, `outputAppearanceSvgCache` | Shared output/history | JS heap SVG strings/settings | Last mounted route can remain after navigation | Pruned only by later history synchronization | Low | Delete entries owned by the unmounting panel, guarded against multiple mounted owners |
| P1 | Medium sustained, confirmed | `app/client/components/converter/BespokeTraceOutputPanel.tsx` | `appearanceStore`, `appearanceSvgCache` | Bespoke output/history | JS heap SVG strings/settings | Same as shared panel | No unmount prune | Low | Add ownership-aware unmount pruning |
| P1 | Medium lifecycle, confirmed | `app/client/hooks/useHybridTraceFetcher.ts` | `clientCancelHandlersRef` | Hybrid client traces | Worker/closures/File/settings | Continues until finish/timeout after route unmount | Server waiters rejected; client handlers not invoked | Low if cancellation is limited to unmount | Invoke and clear every handler in unmount cleanup; prevent late state commits |
| P1 | Medium lifecycle, confirmed | `app/routes/png-to-svg-for-cricut.tsx`; `app/routes/png-to-svg-for-silhouette.tsx` | source snapshot URL lifecycle | Two hybrid routes | Blob/object URLs and source Blob | Can survive route unmount | Peer-route unmount cleanup is absent | Low | Revoke all remaining snapshots on unmount and failed non-history replacement jobs |
| P1 | Low/medium lifecycle, confirmed | `app/routes/svg-to-favicon-generator.tsx` | `loadAsImage` | Favicon/ICO/ZIP | Blob URL | One leak per failed SVG image load | Revoke only on success | Very low | Put URL revocation in `finally`/load-error cleanup |
| P1 | Low lifecycle, confirmed | `app/client/workers/vtracer.worker.ts` | trace config | Client trace worker | WASM/native wrapper | Retained until worker termination when conversion throws | Free only on success | Low | Use `try/finally` around conversion |
| P2 | Medium bounded | `app/client/lib/converter/conversionCache.ts` | `entries` | Client conversion reuse | JS heap cloned outputs | 30 entries / estimated 25 MB, but estimate undercounts | LRU eviction; no timer needed | Medium if cloning/shape changes | Correct accounting first; change copies only after cache-hit/output parity tests |
| P2 | Medium bounded | `app/client/components/converter/ExportCompressionControls.tsx` | `cacheRef`, `sourceCacheRef` | Export compression | JS heap large SVG strings | 48 entries each; no byte cap | Active cache pruned; source cache only count-evicted/unmount-released | Low | Add byte accounting and delete sources absent from current outputs |
| P2 | Medium burst | `app/routes/svg-to-favicon-generator.tsx` | PNG/ICO/ZIP generation | Favicon/archive | Canvas, Base64/binary strings, Uint8Arrays, ZIP bytes | Per export, multiple full encodings overlap | Locals reclaim; current result retained | High | Measure; replace conversion steps only with byte-identical fixture validation |
| P2 | Medium burst | Base64 route/client utilities | encode/decode helpers | Base64 | Input/output strings, binary strings, Buffers/typed arrays | 1.33× Base64 plus UTF-16 and decoded copies | Locals reclaim; displayed output retained | High | Stage measurements; avoid zero-copy proposals that change validation/sanitization |
| P2 | Medium operational | `app/utils/conversionModules.server.ts` and listed routes | `sharp.concurrency`, `sharp.cache` | Server raster work | Native libvips cache/thread state | Bounded, but configuration is repeatedly changed process-wide | Native allocator/cache managed by Sharp | Medium/high | Do not change until production RSS/native metrics exist; consolidate only with approval |
| P2 | Low bounded | `app/utils/potraceCompat.ts` | trace result cache | Potrace | JS heap SVG strings | 32 entries / estimated 16 MB / 10-minute TTL | Activity-triggered pruning only | Low | Optional unref'ed expiry cleanup; keep identical keys/results |
| P2 | Low/medium bounded | `app/routes/emoji-to-svg-converter.tsx` | `__twemoji_cache` | Emoji SVG | JS heap SVG strings | 512 entries; no byte cap/TTL | FIFO count eviction | Low | Add observed-byte accounting; do not change fetched/sanitized content |
| P2 | Low bounded | `app/routes/text-to-svg-converter.tsx` | `__textsvg_font_cache` | Text SVG | Uint8Array font bytes | 64 entries; normal keys are finite built-in URLs | FIFO count eviction | Low | Measure only; uploaded fonts are not cached |
| P2 | Low static | `app/routes/code-to-svg-for-cricut.tsx` | `SAMPLE_CODE` | Code-to-SVG | Large static JS string | Fixed by source; retained with module | Process/chunk lifetime | Medium; delivery can change UI/network timing | Leave unchanged unless baseline remains material; explicit approval for asset/lazy-load redesign |

## 3. Process-wide store table

Approximate sizes below are engineering estimates, not measurements. JavaScript engine, string encoding, object layout, and shared backing stores can change actual values.

| Store / source | Purpose; key → value | Creation and approximate value size | Removal, expiration, pruning | Hard entry / byte limit | Cleanup without traffic? | Cardinality and lifetime | Risk / future action |
|---|---|---|---|---|---|---|---|
| `__ilovesvg_backend_rate_limits`, `app/utils/backendSecurity.server.ts` | Shared action limiting; normalized IP + UA + route slug + action → four window records | On first request per composite key; roughly 1.5–3 KB per record including key/object/Map overhead | Counters roll on access; record is never deleted | None / none | No | IP, UA, route, and action are all cardinality multipliers; full process lifetime | High/unbounded. Add expired-only idle pruning and fail-closed entry/byte bounds |
| `__ilovesvg_action_rate_limits` in `home.tsx`, `cricut-svg-converter.tsx`, `drawing-to-svg-converter.tsx`, `icon-to-svg-converter.tsx`, `image-to-layered-svg-for-cricut.tsx`, `image-to-svg-for-cricut.tsx`, `image-to-svg-outline.tsx`, `jpeg-to-svg-converter.tsx`, `jpeg-to-svg-for-cricut.tsx`, `jpg-to-svg-converter.tsx`, `jpg-to-svg-for-cricut.tsx`, `layered-svg-for-cricut.tsx`, `sketch-to-svg-for-cricut.tsx` | Shared inline limiter; IP/UA/route/action-shaped key → window counters | Created by each action's limiter helper; small record, high key overhead | Window reset on lookup; no deletion | None / none | No | Can grow for full process lifetime | High/unbounded. Preserve exact limits while migrating to bounded shared storage |
| `__iheartsvg_page_rate_limits`, `black-and-white-image-to-svg-for-cricut.tsx` | Route limiter; high-cardinality client identity → counters | Per unseen identity | No record deletion | None / none | No | Process lifetime | High/unbounded. Same bounded policy |
| `__drawing_to_svg_for_cricut_action_rate_limits`, `drawing-to-svg-for-cricut.tsx` | Route limiter → counters | Per unseen composite identity | No record deletion | None / none | No | Process lifetime | High/unbounded. Same bounded policy |
| `__ilovesvg_emoji_converter_rate_limits`, `emoji-to-svg-converter.tsx` | Emoji action limiter → counters | Per unseen composite identity | No record deletion | None / none | No | Process lifetime | High/unbounded. Same bounded policy |
| `__ilovesvg_jpg_layer_action_rate_limits`, `jpg-to-layered-svg-for-cricut.tsx` | Layered route limiter → counters | Per unseen composite identity | No record deletion | None / none | No | Process lifetime | High/unbounded. Same bounded policy |
| Module `rateLimitStore`, `base64-to-svg.tsx` and `base64-to-svg-for-cricut.tsx` | Base64 route + IP + UA → counters/lastSeen | Per composite identity; small record | Traffic-triggered sweep deletes records idle more than one day | None / none | No | Age-bounded under continued traffic; burst cardinality unbounded | Medium. Add hard/fail-closed bounds and unref'ed idle sweep |
| `__ilovesvg_batch_sessions`, `home.tsx` | Batch authorization/session accounting; IP + UA + session ID → timestamps/counts | On accepted batch session; four primitive fields plus key | Sliding TTL; expired records swept only when batch-session checks run | None / none | No | New-session rate limiting constrains one client, but distributed cardinality can burst | Medium. Add hard bounds and idle pruning without reducing batch behavior |
| `__ilovesvg_shared_conversion_gate`, `app/utils/conversionGate.server.ts` | Global semaphore; singleton object with running count + queue of resolver closures | One object; up to 8 queued closures under defaults | Idempotent release dequeues; busy requests rejected | 8 queued, 2 running by default / no byte limit | Event driven | Queue itself is bounded, but each closure can retain a fully parsed request | High burst. Add abort-aware queue removal; admission redesign requires approval |
| Potrace trace cache, `app/utils/potraceCompat.ts` | Trace fingerprint/settings → SVG result + size/time metadata | On cacheable trace result | LRU/TTL pruning on cache activity | 32 entries / estimated 16 MB; 2 MB per item; 10-minute TTL | No | Count/estimated-byte bounded | Low. Safe; optional idle expiry, and validate actual string accounting |
| Sharp lazy module refs, `app/utils/conversionModules.server.ts`, `app/utils/potraceCompat.ts`, `app/utils/bmpDecode.server.ts` | Singleton imported Sharp module promise/reference | First use; tiny JS reference, native Sharp/libvips process state is separate | Never removed by design | One ref per helper / native cache configured separately | N/A | Process lifetime, fixed | Expected. Repeated global config is operational risk, not Map growth |
| Twemoji cache `__twemoji_cache`, `emoji-to-svg-converter.tsx` | codepoint → sanitized SVG; plus FIFO order | Successful remote fetch/sanitize | Oldest removed after 512 | 512 / no byte cap | No | Count bounded; normal SVGs small, theoretical sanitized input much larger | Low/medium. Add observed bytes/TTL only if measured |
| Font cache `__textsvg_font_cache`, `text-to-svg-converter.tsx` | built-in font URL → font `Uint8Array`; FIFO order | First use of configured remote font | Oldest removed after 64 | 64 / no byte cap | No | Count bounded; normal key set finite; uploaded fonts not inserted | Low/expected |
| Browser conversion cache `entries`, `app/client/lib/converter/conversionCache.ts` | conversion fingerprint → cloned output/settings metadata | Successful cache insertion; `structuredClone` isolates mutation | LRU eviction and explicit cache behavior | 30 / estimated 25 MB; 5 MB item | N/A while page runtime exists | Bounded, but estimator undercounts UTF-16/object/layer duplication | Medium bounded. Correct measurement before changing isolation |
| Browser in-flight dedupe `inFlightConversions`, `app/client/lib/converter/inFlightConversionDedupe.ts` | conversion key → Promise, controller, consumer/refcount metadata | On first matching request | Removed on resolve/reject; consumer abort releases reference | No hard cap/bytes | Promise settlement driven | A never-settling producer can persist; current workers/server requests normally settle | Low/medium. Add diagnostic timeout visibility, not duplicate cancellation semantics blindly |
| Client trace scheduler, `app/client/lib/converter/vtracerWorkerClient.ts` | `activeClientTraceSlots`; FIFO `queuedClientTraceResolvers` closures | When more than two trace calls overlap | Release after worker `finally`; abort removes queued callback | 2 active / queue unbounded | Event driven | Queue closures capture files/settings; common batch limits provide indirect bounds only | Medium burst. Measure queue length, then bound without blocking supported batch workflows |
| Output appearance stores, `TraceOutputPanel.tsx` | output ID → appearance settings; output ID/base settings → base/edited SVG strings | When rendering/editing history outputs | Pruned on later history synchronization only | No entry/byte cap; current history indirectly bounds while mounted | No | Last route remains after unmount | Medium confirmed retention. Add owner-aware unmount cleanup |
| `svgByteSizeCache`, `TraceOutputPanel.tsx` | full SVG string → computed byte length | Size display/export checks | Oldest count eviction | 80 / no byte cap | No | Count bounded but keys themselves can be large | Medium bounded. Key by stable output identity/version or add byte budget after tests |
| Appearance stores, `BespokeTraceOutputPanel.tsx` | output ID/settings → settings and base/edited SVG strings | Same as above | Same as above | No direct cap | No | Last route remains after unmount | Medium confirmed retention. Add owner-aware unmount cleanup |
| `cacheRef` and `sourceCacheRef`, `ExportCompressionControls.tsx` | output/settings → compressed SVG; output/version → source SVG | Compression preview/export | Both count-evict at 48; active cache pruned to current output keys, source cache is not | 48 each / no byte cap | Component lifecycle only | Bounded count; removed outputs may remain until eviction/unmount | Medium bounded. Prune source entries and add byte accounting |
| `onceKeys`, `app/client/lib/analytics/toolEngagement.ts` | route + static event token → presence | First one-time engagement event | Never removed | No formal cap | N/A | Call-site token set is finite in current source; route set is finite | Low/fixed-by-code. Document invariant or cap defensively |
| Source fingerprint WeakMap, client converter helper | `File` object → fingerprint Promise/string | First fingerprint of File | Garbage collected when File is unreachable | Weak keys / no byte cap | GC | Does not keep File alive; digest temporarily materializes full ArrayBuffer | Low/expected |
| Layer palette WeakMap, layer editor helper | layers array → derived palette/grouping | First derivation | GC with layers array | Weak keys | GC | Does not retain unreachable history | Low/expected |
| Optional `window.__ILOVESVG_HYBRID_TRACE_DEBUG__` event array | External/test-provided global array receives debug events | Only if another actor creates/enables it | No internal pruning | None | No | Not enabled or created by production code; could grow during diagnostic sessions | Low conditional. Bound in future diagnostic implementation |
| Fixed Sets/Maps across route MIME/extension allowlists, `svgSanitize.server.ts`, `bmpDecode.server.ts`, route capabilities/preset tiers, SVG editing tags, navigation, monetization, and generated route manifest | Static string/number lookup → boolean/config/importer | Module evaluation | Never removed by design | Source-code bounded | N/A | No traffic-controlled growth | Normal/expected; no action |

Script-only Maps/Sets/arrays are short-lived within audit/smoke Node processes and are not production stores. React component state, refs, and per-request `Map`s such as conversion timing diagnostics are addressed in the relevant lifecycle sections rather than misclassified as process-wide singletons.

## 4. Conversion-family allocation table

| Family | Input and decoded representation | Major temporary representations and overlaps | Retained afterward | Cleanup point / concern |
|---|---|---|---|---|
| Raster to SVG, server Potrace | Multipart `File` → `ArrayBuffer` → Node Buffer view; optional BMP decode to PNG; Sharp metadata/decode | Native decode; raw RGBA Buffer; full `Uint8ClampedArray`; Potrace bitmap/path objects; SVG; sanitized/optimized SVG; response JSON/compression | Client history keeps SVG, settings, metadata, layer/edit fields; Potrace cache may keep eligible SVG | Action locals end after response; timeout does not stop underlying work; gate body is parsed before acquire |
| Raster to SVG, client VTracer/centerline | `File` → transferred ArrayBuffer/Blob → `ImageBitmap` → canvas `ImageData` | ImageData RGBA, copied RGBA, grayscale/edge/trace typed arrays, WASM memory, SVG string, transferred result string | Current/history output, source snapshot, settings; conversion cache clones eligible result | Worker termination normally frees native/WASM resources; hook unmount cancellation gap can extend lifetime |
| Layered raster to SVG, server | Parsed File/Buffer → Sharp raw RGBA at trace size | Sample pixel objects (bounded), quantizer/palette, `Int16Array` pixel layer map, full masks, per-layer PNGs, trace engine buffers, accumulated paths; compact trace can precede full fallback; output SVG plus duplicated `layers[].pathTags` | SVG, layer metadata, history/settings/source snapshot; caches when eligible | Layer work is mostly sequential, but output geometry is intentionally duplicated; no safe representation change established |
| Layered raster to SVG, client | Transferred File bytes → ImageBitmap/ImageData | Copied RGBA, image-q point/quantized data, layer indexes, per-layer masks retained in a Map, WASM/trace data, SVG/path strings | Same layered history/editing representations | Worker terminated; two workers may peak together; config exception cleanup should move to `finally` |
| Cricut/cut-file conversion | Same raster/SVG representations as selected trace engine; route preprocess adds background/threshold/cleanup/cut settings | Raw buffers, selected-color/background masks, connected-component/island/hole queues, trace buffers, post-processed SVG strings | Cut-friendly SVG, editable layers, settings/history/source snapshot | All quality/security semantics must remain; optimization must be byte/pixel/path equivalent |
| SVG to PNG | SVG text → sanitized/sized SVG Blob URL → decoded image | Image/native decode, canvas RGBA, PNG Blob, output object URL; live preview and final Blob may coexist | Current preview/final Blob URL and output metadata | Input URL is normally revoked in `finally`; stale jobs revoke their output; result URLs revoked on replacement/reset/unmount |
| SVG to JPEG/WebP | SVG text/Blob URL → image → canvas | Canvas RGBA; encoded bytes become `toDataURL` Base64 string (about 1.33× bytes before JS string overhead) | Result data URI/current preview | Input URL handlers revoke; result string released on replacement/reset/unmount |
| SVG cleanup/optimization | Uploaded/pasted SVG string | Sanitized string, sequential regex/post-processing strings, SVGO AST and one/multiple serialized strings, encoded preview/data URI | Current output/history; compression caches may keep source and compressed variants | Function locals reclaim; module/component caches are the sustained component |
| Favicon, PNG-size set, ICO, ZIP | SVG string/Blob URL → master image/canvas | Master canvas up to 2048² (~16 MB RGBA), child canvases, `toDataURL`, Base64/binary strings, per-size PNG Uint8Arrays, ICO builder copies, preview `buffer.slice(0)`, ZIP input and compressed bytes | Per-size PNG bytes, ICO bytes, current preview/output; archive only through download lifecycle | Temporary load URL misses failure revocation; retained formats are expected product output |
| PDF export | SVG string → sanitized/postprocessed SVG → Canvg | Canvg parse tree, canvas up to 80 MP (~320 MB RGBA), PNG/JPEG data URI, jsPDF internal image/PDF, output Uint8Array, copied Blob bytes | `pdfBytes`, PDF object URL/current output | Locals reclaim after conversion; bytes and Blob coexist intentionally; copy removal needs render/byte parity proof |
| ZIP/archive export | Current history/source Blobs/strings → fflate inputs | All selected files plus compressed archive Uint8Array and download Blob/URL | Existing history remains; archive URL only for download | Download URL is revoked; peak scales with selected output total without changing history |
| Base64 decode, server | JSON string with Base64 → normalized string → Buffer; SVG text or raster bytes | Original request string, normalized/decoded bytes, optional Sharp/trace buffers, SVG/postprocessed strings, JSON response | Client output/history | Body is parsed before gate; all large forms can overlap until action settles |
| Base64 decode, client | Input text → normalized Base64 → `atob` binary string → UTF-8/byte data → sanitized SVG | Input and normalized strings, binary string, decoded string/bytes, preview data URI | Input text and decoded result/history/preview | Released on reset/replacement/unmount according to route state; no evidence of persistent global cache |
| Base64 encode | SVG text → sanitize/minify strings → TextEncoder bytes → chunked binary string → `btoa` Base64 → wrapped/data-URI variants | Several complete strings plus typed array overlap; Base64 expands bytes | User-visible encoded output and current source | Temporary transforms reclaim when handler/state references end; output retention is intentional |
| Client-only SVG utilities | SVG string → DOM/XML/regex transforms → one or more edited strings/data URIs/Blobs | Parser trees, transformed strings, repeated `encodeURIComponent` for data URI in some preview paths, copy/download Blob | Current output/history/edit state | Most Blob download URLs revoke immediately/delayed; large render-time data-URI generation should stay memoized/cached and lifecycle-bound |

### Temporary-file result

No production application path writes conversion uploads or outputs to disk-backed temporary files or directories. Upload handlers are in-memory. Therefore there is no application temp filename, startup sweep, age-based disk cleanup, or retained-file ceiling to document. Test/smoke scripts may create their own temporary fixtures/directories within their short-lived process and are not used by deployed route actions.

## 5. Buffer-copy table

| Source / path | Copy or representation | Why it exists | Approximate worst case and overlap | Avoidability / change risk |
|---|---|---|---|---|
| Server actions | `File.arrayBuffer()` then Buffer wrapper | Web `File` API to Node/native library input | Full upload bytes; Buffer may share the ArrayBuffer backing store, but parsed multipart storage already exists | Do not assume a copy. Admission/streaming changes are higher risk |
| Base64 server/client | normalized Base64 string + `Buffer.from(..., "base64")` or `atob` | Validation and binary recovery | Encoded input ~1.33× binary, UTF-16 may cost more; decoded full bytes overlap | Fundamental; reduce overlap only after validation/sanitization parity tests |
| `potraceCompat.ts` | Sharp raw `data` → `new Uint8ClampedArray(raw.data)` | Potrace-compatible mutable typed array | 96 MB + 96 MB at 24 MP, plus native decode/input | Potentially avoidable only if Potrace ownership/mutation is proven; medium/high risk |
| `bmpDecode.server.ts` | BMP source → decoded raw → PNG Buffer | Normalize unsupported Sharp/Potrace input | Full BMP + raw pixels + PNG compressed bytes | Required compatibility; streaming/alternate decoder would be architecture work |
| `imagePreprocess.server.ts` | `Buffer.from(prepared.data)` | Produce mutable/isolated grayscale work buffer | One byte per pixel plus prepared output/native input | Appears measurable; cleanup paths may already return new data, but alias/mutation proof is required |
| `imagePreprocess.server.ts` | `Buffer.from(data)` before selected-color mutation | Preserve caller input | Full grayscale/RGBA buffer | Deliberate mutation isolation; high regression risk for zero-copy |
| Component cleanup helpers | mask + visited byte arrays + `Int32Array` queue | Connected components, holes, islands, borders | For 24 MP: ~24 MB each byte plane and ~96 MB full queue, beside input/output | Algorithmic workspace, not a simple duplicate; quality-sensitive |
| `svgLayerTrace.server.ts` | raw RGBA, sample objects, `Int16Array` assignments, layer masks, mask PNGs | Palette assignment and per-layer tracing | RGBA 4B/pixel, index 2B/pixel, masks 1B/pixel/layer plus compressed PNG/path outputs | Some lifetimes may be shortened; structure changes are high-risk |
| Server layered response | full SVG plus `layers[].pathTags`, then JSON serialization/compression | Layer editing and API response | Geometry can appear in SVG, layer metadata, serialized JSON, and response compression buffers | Intentionally required; representation change needs explicit approval and full editing/export parity |
| `conversionCache.ts` | `structuredClone` on insert and lookup | Prevent one history/result edit from mutating cached results | Up to configured item limit; doubles object/string graphs during clone | Required isolation unless immutability is formally enforced; medium/high risk |
| History/editor | edited SVG plus previous/next version, settings and layers | Undo/redo/edit parity and independent results | Several full strings for an actively edited result; history capped by existing route rules | Intentional; must not reduce history or editing |
| Source fingerprint | `File.arrayBuffer()` for SHA-style fingerprint | Stable cache/dedupe key | Full source bytes during digest; weak-cache result afterward | Web Crypto requires bytes; streaming hash would add complexity/dependency |
| Worker input | `File.arrayBuffer()` transferred to worker | Decode off main thread | Full bytes materialized; transfer avoids an additional main-thread copy | Appropriate zero-copy transfer; retain |
| `vtracer.worker.ts` | `ImageData.data` → `new Uint8ClampedArray(...)` | Stable/mutable trace input independent of canvas data | 4B/pixel twice plus bitmap/canvas/native decode | Mutation/ownership must be proven before removal |
| Layered worker | quantizer source/quantized arrays, index arrays, masks per layer | Palette and layered trace | Multiple full typed arrays; masks can scale with layer count | Major measurement target; high quality/equivalence risk |
| SVG preview paths | `encodeURIComponent(svg)` + `data:image/svg+xml,...` | `<img>` preview without direct DOM injection | Encoded string can be substantially larger than SVG and overlap with base/edited strings | Memoize/lifecycle-bind where not already; Blob URL switch only when measured and parity-safe |
| SVG compression | sequential transformed strings and SVGO browser output | Sanitization/minification/optimization | Multiple SVG-sized strings and AST overlap | Reclaimable; keep sanitization boundary and exact output semantics |
| SVG-to-JPEG/WebP | canvas `toDataURL` | Browser encoding/output preview | Encoded bytes + Base64 + JS string + canvas | `toBlob` may lower string peak but changes async/data representation; requires output tests |
| SVG-to-PDF | canvas data URI + jsPDF + output bytes + `new Uint8Array(bytes)` for Blob | jsPDF image input and retained downloadable result | Canvas may be ~320 MB; PDF buffers/strings add peak; Uint8Array constructor copies an existing typed array | Strong measured candidate, but PDF bytes/rendering and Blob lifetime must remain identical |
| Favicon PNG extraction | `toDataURL` → `atob` binary string → Uint8Array | Convert canvas output to bytes for ICO/ZIP | Repeats per size; Base64 and binary string overlap PNG bytes | `toBlob`/ArrayBuffer route may help; require PNG/ICO byte/decoder tests |
| ICO preview | `bytes.buffer.slice(0)` then Blob | Isolate exact output buffer range | Full ICO copy | May use exact view with offset/length if Blob semantics proven; low/medium risk |
| ZIP export | selected outputs + archive Uint8Array + Blob | Batch download | Sum of all selected source bytes plus compressed archive | Expected; streaming archive would be architecture/dependency change |
| Copy/download | string → Blob, encoded URI, clipboard payload | User-requested output | One additional output-sized allocation during the operation | Short-lived and expected; ensure URL/promise cleanup, do not degrade behavior |

## 6. Cleanup-path findings

### Success

- Every audited server conversion action that acquires the shared gate calls its release function from a `finally`. Release is idempotent, so success and downstream exceptions do not leak a slot.
- Worker clients clear timers/listeners, terminate workers, close `ImageBitmap` where created, and release the client scheduler slot in normal `finally` paths.
- Most route preview object-URL effects revoke the previous URL when dependencies change and revoke on unmount. Temporary download URLs are revoked immediately or after a short browser-safe delay.
- Successful conversion still intentionally leaves current/history output, settings snapshots, editable layer metadata, source snapshots, and output Blob URLs reachable.

### Error

- Server gate release remains protected by `finally`, including helper failures and response-construction throws inside the guarded block.
- `loadAsImage` in the favicon route omits revocation if image loading rejects.
- `vtracer.worker.ts` omits trace-config `free()` if conversion throws, although parent worker termination is a later backstop.
- The two snapshot routes need a targeted failed-replacement test because a created snapshot not represented by a pending history item may not be revoked.

### Abort and client disconnect

- Server gate acquisition accepts no `AbortSignal`. A disconnected/aborted request waiting in the queue remains captured and can later consume a slot and compute.
- Server trace helpers do not cooperatively stop Sharp/Potrace work when the request is aborted. No `request.signal` propagation was found in the 44 guarded action paths.
- Worker clients handle explicit abort signals while queued or running, but `useHybridTraceFetcher` does not invoke all client handlers when the owning component unmounts.

### Timeout

- Gate waiting has no queue timeout; a bounded queue avoids unlimited entries but can retain parsed bodies until a slot opens.
- Potrace's 20-second Promise race is not cancellation. It cannot interrupt synchronous `getSVG()`, and it can release the gate before asynchronous underlying work settles.
- Client worker calls have finite timeouts and parent-side termination. A `File.arrayBuffer()` promise itself is not cancellable; if a timeout wins, the late byte allocation is eventually reclaimable after the File/promise closure becomes unreachable.

### Reset

- Current implementations intentionally vary: many routes clear current/history/source state on reset, while the home/hybrid model preserves route-specific history semantics. No recommendation in this audit changes reset behavior or the history limit.
- High-frequency edit helpers generally cancel pending commits on reset/output changes. Regression tests must explicitly prove that a delayed throttled commit cannot resurrect a cleared output or old SVG string.
- Module-level output-panel caches are not inherently cleared merely because route state resets; history-driven pruning handles active routes, while unmount remains the confirmed gap.

### Second upload and output switch

- Newer hybrid routes use source snapshots so each retained result refers to its own source; older route families may replace/clear state according to their existing design. Neither behavior should be standardized as part of memory work.
- In-flight latest-request/job-ID guards generally prevent stale preview replacement and revoke stale result URLs. The two identified snapshot routes need exact second-upload/error coverage before lifecycle changes.
- Pending throttled edits and compression/source-cache entries are the main places where old output strings can remain after an output switch; most are bounded, but source compression entries are not pruned to current output identities.

### Unmount and navigation

- Home performs robust cleanup for its history preview URL map and source snapshots and removes its registered listeners/intervals. Its direct client abort-controller registry still needs an explicit unmount-abort verification/fix.
- `TraceOutputPanel` and `BespokeTraceOutputPanel` leave module caches reachable after unmount.
- `png-to-svg-for-cricut` and `png-to-svg-for-silhouette` lack the source-snapshot unmount cleanup present in peer routes.
- One-shot toast timers are short (roughly 1.2–1.5 seconds) and retain small closures. They are low risk, though future shared timer cleanup would improve discipline.

### Stale request completion

- Client conversions generally use job IDs, abort controllers, or latest-request-wins checks so older results do not overwrite newer output.
- In-flight conversion dedupe deletes entries on resolve/reject; an actually never-settling producer would remain, so diagnostics should expose age and count.
- A timed-out server Potrace job is the important exception: it can complete detached after its response and gate lifecycle have ended.

## 7. Conversion-gate findings

### Implementation

- File: `app/utils/conversionGate.server.ts`
- Storage: process-wide `__ilovesvg_shared_conversion_gate`
- Default concurrency: `min(2, available CPU count)` with a minimum of one
- Default waiting capacity: eight queued acquisitions
- Busy behavior: rejects beyond the queue with the existing server-busy/estimated retry behavior
- Queue timeout: none
- Abort behavior: none
- Release: idempotent closure decrements `running` and transfers the slot to the next FIFO waiter
- Configuration note: the first-created global gate wins; later option differences would not reconfigure it

### Call sites and release safety

The following 44 action implementations each contain one acquire and a release in `finally`: `base64-to-svg-for-cricut.tsx`, `base64-to-svg.tsx`, `black-and-white-image-to-svg-for-cricut.tsx`, `black-and-white-image-to-svg-converter.tsx`, `code-to-svg-for-cricut.tsx`, `cricut-svg-converter.tsx`, `drawing-to-svg-converter.tsx`, `drawing-to-svg-for-cricut.tsx`, `emoji-to-svg-converter.tsx`, `home.tsx`, `icon-to-svg-converter.tsx`, `image-to-layered-svg-for-cricut.tsx`, `image-to-svg-for-cricut.tsx`, `image-to-svg-outline.tsx`, `jpeg-to-svg-converter.tsx`, `jpeg-to-svg-for-cricut.tsx`, `jpg-to-layered-svg-for-cricut.tsx`, `jpg-to-svg-converter.tsx`, `jpg-to-svg-for-cricut.tsx`, `layered-svg-for-cricut.tsx`, `line-art-to-svg-converter.tsx`, `line-art-to-svg-for-cricut.tsx`, `logo-to-layered-svg-for-cricut.tsx`, `logo-to-svg-converter.tsx`, `logo-to-svg-for-cricut.tsx`, `photo-to-svg-for-cricut.tsx`, `photo-to-svg-outline.tsx`, `png-to-layered-svg-for-cricut.tsx`, `png-to-svg-converter.tsx`, `png-to-svg-for-cricut-print-then-cut.tsx`, `png-to-svg-for-cricut-stickers.tsx`, `png-to-svg-for-cricut-vinyl.tsx`, `png-to-svg-for-cricut.tsx`, `png-to-svg-for-etsy.tsx`, `png-to-svg-for-laser-cutting.tsx`, `png-to-svg-for-silhouette.tsx`, `scan-to-svg-converter.tsx`, `sketch-to-svg-converter.tsx`, `sketch-to-svg-for-cricut.tsx`, `sticker-to-svg-converter.tsx`, `sticker-to-svg-for-cricut.tsx`, `text-to-svg-converter.tsx`, `webp-to-svg-converter.tsx`, and `webp-to-svg-for-cricut.tsx`.

Public wrapper routes that re-export these actions inherit the same gate path. `api.batch-svg.tsx` delegates to the home action.

No acquire-without-finally slot leak was found for success, validation after acquisition, conversion exception, or response construction. The material inconsistency is admission timing: every call site performs `parseMultipartFormData`, `request.formData`, or `request.json` before acquire. Validation that occurs before acquire does not need release, but its input allocation is not gate-bounded. Validation after acquire is release-safe.

The second material problem is cancellation: a queued closure captures action scope after the complete body has been parsed. If the client disconnects, there is no queue removal, and once admitted the action can continue even though its response is no longer useful.

The Potrace timeout also weakens effective concurrency because a released slot can coexist with the detached timed-out job. No current code change should alter gate limits, busy behavior, Retry-After behavior, or rate limiting. Any admission/cancellation design must preserve those contracts exactly.

### Sharp/libvips and post-processing findings

- `app/utils/conversionModules.server.ts` lazily imports one Sharp module and configures `sharp.concurrency(1)` plus `sharp.cache({ files: 0, memory: 48 })` when that helper first loads.
- `app/utils/potraceCompat.ts` and `app/utils/bmpDecode.server.ts` maintain separate cached JavaScript import references to the same Sharp package. They do not create separate libvips processes, but they bypass the central helper's initialization path.
- Request paths also call Sharp's process-global configuration: `black-and-white-image-to-svg-converter.tsx` uses the 32 MB setting at two sites; `base64-to-svg.tsx` and `base64-to-svg-for-cricut.tsx` use 32 MB for single traces and 48 MB for layered traces; `black-and-white-image-to-svg-for-cricut.tsx`, `png-to-svg-for-cricut-print-then-cut.tsx`, and `png-to-svg-for-cricut-stickers.tsx` use 48 MB. Repeated calls are not a leak, but concurrent route traffic can toggle one global cache setting.
- Metadata and final decode are separate Sharp operations in important paths. Potrace performs metadata inspection and then a raw RGBA decode. Preprocessing may decode/transform once, then downstream tracing decodes the produced buffer again. These are sometimes necessary for validation and pipeline boundaries, but they can overlap if old references remain in caller scope.
- The inspected layered server work is largely sequential rather than unbounded `Promise.all` across all layers. Path strings accumulate by necessity. Browser favicon/archive generation also iterates sizes rather than launching unlimited canvas encodes.
- SVGO/browser compression creates parse/serialize and multipass string/AST allocations. No process-wide SVGO cache or retained optimizer instance was found.
- No application-level forced garbage collection exists, and none is recommended. A high RSS after native work may reflect allocator/libvips reuse; diagnostics must separate RSS, V8 heap, external, ArrayBuffer, and native/cache observations.

## 8. Client resource findings

### Object URLs and Blobs

- Most input preview effects revoke old URLs on dependency change and unmount. Result URLs are generally revoked on replacement, reset, unmount, or stale-job detection.
- Home maintains and prunes a history-preview object URL Map and cleans it on unmount. Source snapshots are cleaned on history removal/error/unmount.
- Confirmed gaps are the favicon failed-load URL and missing unmount source-snapshot cleanup on the two PNG cut-file routes.
- Download URLs are deliberately short-lived and revoked. A delay used to allow the browser to begin a download is normal, not a leak.

### Workers, cancellation, and queues

- Two workers are present: VTracer and centerline trace workers. They are created per job and terminated in parent `finally` blocks; no permanent worker pool exists.
- Worker input ArrayBuffers are transferred, avoiding a second main-thread byte copy. `ImageBitmap` objects are closed.
- The scheduler has two active slots and an unbounded resolver array. Abort removes a queued resolver, and normal completion releases a slot.
- `useHybridTraceFetcher` does not call all stored client cancellation handlers on unmount. Home's direct abort-controller registry also requires explicit unmount cancellation coverage.
- Worker trace configuration should be freed in `finally`; worker termination is currently the ultimate exception-path cleanup.

### Timers, listeners, observers, subscriptions

- Navigation, root, advertisement, and home listeners/intervals inspected in this pass return cleanup functions.
- Conversion timeouts and worker signal listeners are normally cleared in settle/finally paths.
- Short toast timers are not always registered for unmount cleanup, but their duration and captured data are small; they are not a likely sustained-memory cause.
- No persistent application observer/subscription registry or service-worker cache was found in the audited source.

### Preview and history retention

- Most trace histories are capped by existing route behavior (commonly ten results, with a smaller cap on at least one sticker workflow). This cap and all route-specific history behavior must remain unchanged.
- Each history item can own output SVG, metadata, settings/preset snapshot, layers with path strings, a source snapshot Blob URL, and current edit versions. These are intentionally independent so editing one result does not mutate another.
- Appearance and compression caches add additional base/edited/compressed strings. The appearance caches have a confirmed route-unmount retention issue; compression caches are count-bounded but lack a byte budget.
- Repeated data-URI encoding is most expensive when done from large edited SVG strings. Existing memoization should be preserved; any switch to Blob URLs must also preserve copy/download parity and revoke on all transitions.

## 9. Deployment/configuration findings

### Verified repository facts

- `server.js` is the Node/Express entry and production imports `build/server/index.js` once.
- The Dockerfile uses Node 20 Alpine and starts the npm production command. It does not declare cluster mode, workers, a memory limit, a Node heap flag, or a memory restart threshold.
- No PM2 ecosystem file, systemd unit, Docker Compose process topology, scheduled restart, or log-rotation configuration is committed.
- No `SIGTERM`/`SIGINT` graceful-shutdown handler was found. `uncaughtException` logs and exits; `unhandledRejection` is logged.
- No production disk temp cleanup is needed because application conversion data is memory-backed.
- The repository has no use of `process.memoryUsage()`, RSS/heap/external/ArrayBuffer sampling, forced GC, Sharp counter sampling, or browser heap sampling.
- Existing diagnostics focus on conversion timing/warnings. `conversionDiagnostics.server.ts` keeps per-request timers and clears them in `finally`/finish; it is not a process-wide retention source.

### Existing useful validation assets

- Store/concurrency: `scripts/conversion-cache-audit.mjs`, `scripts/conversion-queue-audit.mjs`, `scripts/hybrid-browser-smoke.mjs`.
- Trace correctness/quality: `scripts/trace-engine-audit.mjs`, `scripts/trace-quality-smoke.mjs`, `scripts/post-processing-smoke.mjs`, `scripts/post-conversion-editability-smoke.mjs`.
- Client edit/export stress: `scripts/cumulative-edit-performance-smoke.mjs`, `scripts/converter-export-compression-smoke.mjs`, `scripts/high-fidelity-browser-output-smoke.mjs`.
- Input/action coverage: `scripts/input-compatibility-smoke.mjs`, `scripts/conversion-action-smoke.mjs`.
- Representative committed source fixture: `tests/fixtures/IMG_8487.PNG`; smoke scripts also generate controlled PNG/JPEG/WebP/SVG fixtures.

### Minimum diagnostics recommended for the next pass

Add an opt-in, redacted per-conversion sampler that records `rss`, `heapUsed`, `heapTotal`, `external`, and `arrayBuffers` at request entry, after body parse, after decode/preprocess, after trace, after post-processing/serialization, in `finally`, and after a controlled idle interval. Add gate running/queued/aborted-waiter/detached-timeout counters, long-lived store entry counts plus estimated bytes, and client test-build counters for workers/object URLs/history bytes. Record durations and dimensions/preset family, never source bytes, SVG contents, filenames, IPs, user agents, or Base64 data. Do not force GC. Production comparison must use the same process before, at peak, and after idle across repeated representative jobs.

### Unknown production behavior

The repository cannot verify actual process count, container/droplet limits, external restart policy, proxy upload buffering, or OOM/restart history. A single-process Docker command is only the repository default, not proof of deployed topology. Process restarts could mask growth only if an external manager or platform performs them.

## 10. Recommended implementation batches

### Batch A: definitely safe bounded-store cleanup

**Exact files:** `app/utils/backendSecurity.server.ts`; `app/routes/home.tsx`; `app/routes/cricut-svg-converter.tsx`; `app/routes/drawing-to-svg-converter.tsx`; `app/routes/icon-to-svg-converter.tsx`; `app/routes/image-to-layered-svg-for-cricut.tsx`; `app/routes/image-to-svg-for-cricut.tsx`; `app/routes/image-to-svg-outline.tsx`; `app/routes/jpeg-to-svg-converter.tsx`; `app/routes/jpeg-to-svg-for-cricut.tsx`; `app/routes/jpg-to-svg-converter.tsx`; `app/routes/jpg-to-svg-for-cricut.tsx`; `app/routes/layered-svg-for-cricut.tsx`; `app/routes/sketch-to-svg-for-cricut.tsx`; `app/routes/black-and-white-image-to-svg-for-cricut.tsx`; `app/routes/drawing-to-svg-for-cricut.tsx`; `app/routes/emoji-to-svg-converter.tsx`; `app/routes/jpg-to-layered-svg-for-cricut.tsx`; `app/routes/base64-to-svg.tsx`; `app/routes/base64-to-svg-for-cricut.tsx`; and targeted rate-limit tests/scripts.

**Intended changes:** preserve every current key component, window, threshold, status, and Retry-After behavior. Add last-expiry metadata, prune only fully expired records, run an unref'ed idle sweep, count approximate bytes, and enforce a conservative hard entry/byte ceiling. When capacity is exhausted by active entries, fail closed or use a bounded overflow limiter; never evict an active entry in a way that weakens protection. Apply the same lifecycle to batch sessions. Extract a shared helper only after record/behavior equivalence is verified route by route.

**Expected benefit:** removes confirmed process-lifetime growth and bounds burst cardinality while preserving or strengthening abuse protection.

**Regression risk:** low to medium because rate-limit identity and timing are security behavior. **Validation:** deterministic clock tests for all windows, expiry, idle cleanup, capacity overflow, distributed high-cardinality input, Retry-After, route/action separation, batch-session continuation, and no timer keeping Node alive. **Explicit approval:** not needed for expired-only pruning/fail-closed bounds; needed if any key/window/limit/status behavior would change.

### Batch B: definitely safe lifecycle cleanup

**Exact files:** `app/routes/svg-to-favicon-generator.tsx`; `app/routes/png-to-svg-for-cricut.tsx`; `app/routes/png-to-svg-for-silhouette.tsx`; `app/client/hooks/useHybridTraceFetcher.ts`; `app/routes/home.tsx`; `app/client/components/converter/TraceOutputPanel.tsx`; `app/client/components/converter/BespokeTraceOutputPanel.tsx`; `app/client/workers/vtracer.worker.ts`; and focused browser/unit tests.

**Intended changes:** move temporary URL/config cleanup into `finally`; revoke all route-owned source snapshots on unmount and failed non-history jobs; invoke/clear client cancellation handlers and direct abort-controller registries on unmount; prevent late state commits; make module-cache cleanup owner-aware so one mounted panel cannot clear another; clear pending timers/commits only at their existing lifecycle boundaries.

**Expected benefit:** promptly releases Blob/native/worker/SVG references after errors and navigation and prevents background work after ownership ends.

**Regression risk:** low if ownership and history identity are tested. **Validation:** successful/failed image load, reset, second upload, replace, route navigation, two mounted panels if supported, active/queued worker unmount, stale completion, copy/download after final color/opacity edit, and all existing history/editability smoke tests. **Explicit approval:** not needed for cleanup after the resource has no valid owner; needed if a result/history item would be removed or a still-owned job cancelled earlier than current navigation/unmount semantics.

### Batch C: controlled diagnostics

**Exact files:** new `app/utils/memoryDiagnostics.server.ts`; `app/utils/conversionGate.server.ts`; `app/utils/potraceCompat.ts`; `app/utils/imagePreprocess.server.ts`; `app/utils/svgLayerTrace.server.ts`; representative action wiring in `app/routes/home.tsx`, `app/routes/base64-to-svg.tsx`, and `app/routes/svg-to-pdf-converter.tsx`; client test instrumentation near `app/client/lib/converter/vtracerWorkerClient.ts`; and new/extended scripts under `scripts/`.

**Intended changes:** add opt-in sampled stage metrics described in section 10, store/gate counters, detached-timeout counts, and test-only URL/worker lifecycle counters. Keep diagnostics disabled by default and bounded when enabled; redact all user-controlled content.

**Expected benefit:** distinguishes JS heap, external/ArrayBuffer, native/RSS peaks, intentional history, and non-returning post-job memory before risky changes.

**Regression risk:** low if sampling is off by default and logging is bounded. **Validation:** diagnostics-disabled overhead check, redaction test, bounded event count, exception/finally coverage, and representative repeated-job measurement. **Explicit approval:** not needed for local/test-only bounded diagnostics; production enablement and retention policy require operational approval.

### Batch D: measured buffer-copy improvements

**Exact files:** `app/utils/potraceCompat.ts`; `app/utils/imagePreprocess.server.ts`; `app/utils/svgLayerTrace.server.ts`; `app/client/workers/vtracer.worker.ts`; layered worker helpers; `app/client/lib/converter/conversionCache.ts`; `app/client/components/converter/ExportCompressionControls.tsx`; `app/routes/svg-to-pdf-converter.tsx`; `app/routes/svg-to-favicon-generator.tsx`; and relevant Base64/SVG raster route helpers.

**Intended changes:** choose only copies proven by Batch C to materially contribute. Candidate work includes safe typed-array views where mutation is impossible, shorter lifetime scopes for masks/queues, byte-accurate cache budgets, pruning compression sources no longer in outputs, avoiding a redundant PDF/ICO Blob copy, and `toBlob`-based canvas encoding where byte/render parity is demonstrated. Make one candidate change at a time.

**Expected benefit:** lowers peak external/typed-array/string memory without changing limits, quality, algorithms, history, or output formats.

**Regression risk:** medium to high; aliasing can corrupt input/history, encoder changes can alter bytes, and shorter lifetimes can break asynchronous work. **Validation:** exact/pixel/visual SVG-PNG-JPEG-WebP-PDF-ICO-ZIP parity, all presets/settings, concurrent jobs, edit/copy/download parity, mutation-isolation tests, and memory before/after. **Explicit approval:** required for any change that can alter output bytes, rendering, timing, cache semantics, or user-visible behavior; not required for a demonstrably redundant same-range byte copy with exhaustive parity.

### Batch E: optional architecture changes only if measurement still requires them

**Exact files likely affected:** `server.js`; `app/utils/conversionGate.server.ts`; all 44 action call sites or a shared request wrapper; `app/utils/potraceCompat.ts`; upload parsing helpers; client trace scheduler; and potentially `code-to-svg-for-cricut.tsx` plus a static asset.

**Potential changes:** abort-aware pre-body admission or streaming/spooled upload design, a genuinely cancellable isolation boundary for synchronous Potrace, formal client queue capacity with existing batch workflow preserved, a shared immutable output representation, or lazy/static delivery of the large sample. Do not add process restarts, forced GC, lower limits/quality, worker processes, queues, or dependencies as a substitute for evidence.

**Expected benefit:** can bound the largest upload/trace peaks or detached work if Batches A–D are insufficient.

**Regression risk:** high. Request timing, abort semantics, error responses, native isolation, output serialization, cache identity, and UI loading can change. **Validation:** full route/action/browser suite, load/concurrency/abort tests, byte and visual output comparisons, security limit tests, deployment shutdown tests, and production canary measurement. **Explicit approval:** always required.

## 11. Regression-validation plan

### Route and family matrix

Before accepting any memory fix, test at least:

- `/` for default single trace, `line-accurate`, centerline/stroke, `photo-many-colors`, and `filled-layers-separate-colors`; primary/expanded preset application must submit exact settings.
- `/png-to-svg-converter`, `/jpeg-to-svg-converter`, `/webp-to-svg-converter`, `/drawing-to-svg-converter`, `/line-art-to-svg-converter`, `/sketch-to-svg-converter`, `/logo-to-svg-converter`, `/image-to-svg-outline`, and their public wrappers for single trace, edge/photo preprocessing, and uploaded SVG handling where supported.
- `/png-to-layered-svg-for-cricut`, `/image-to-layered-svg-for-cricut`, `/jpg-to-layered-svg-for-cricut`, `/logo-to-layered-svg-for-cricut`, and `/layered-svg-for-cricut` for medium/high/amazing layered tiers, flat-color and photo-many-colors presets, maximum supported layer count, sorting, alpha, outline, and layer editing.
- `/png-to-svg-for-cricut`, `/image-to-svg-for-cricut`, `/cricut-svg-converter`, `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-cricut-stickers`, `/png-to-svg-for-cricut-vinyl`, `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-silhouette`, and Cricut drawing/sketch/photo/logo routes for cut cleanup, transparent/white removal, selected-color tolerance, islands/holes/gaps, and clean-path outputs.
- `/base64-to-svg` and `/base64-to-svg-for-cricut` for SVG Base64, raster Base64, invalid input, single/layered output, copy/download, and near-limit JSON bodies; plus browser SVG-to-Base64 encode/minify/wrap/data-URI workflows.
- SVG-to-PNG/JPEG/WebP routes and wrappers at default and maximum accepted output geometry, aspect preservation, trim/crop, transparency/background, quality, live preview, final convert, stale preview, download, and reset.
- `/svg-to-pdf-converter` for page size/orientation, raster quality/background, maximum accepted canvas dimensions, repeated conversion, PDF open/render, and byte retention/revocation.
- `/svg-to-favicon-generator` and ICO/favicon wrappers for all PNG sizes, ICO, ZIP, failed SVG decode, repeated generation, preview, download, reset, and navigation.
- SVG cleanup/minify/utility routes for sanitization, unsafe element/reference rejection, optimization settings, recolor/background/stroke/flip/rotate where supported, preview/copy/download equality.
- `/text-to-svg-converter`, `/emoji-to-svg-converter`, and `/code-to-svg-for-cricut` for built-in and uploaded font behavior, Twemoji cache hit/miss/failure, large static sample, edit/export, and route navigation.
- Batch/API flows for accepted batch sizes, per-item success/failure, queue-full response, archive output, cancellation, and source/result independence.

### Fixtures and settings

Use `tests/fixtures/IMG_8487.PNG`, generated transparent and opaque PNGs, high-detail photo JPEG/WebP, BMP/TIFF/GIF/AVIF compatibility fixtures, line drawing/logo/sketch fixtures, an image near current dimension/megapixel/upload limits, flat-color images with 2 and maximum layers, transparent-edge/white-background/Cricut fixtures, SVGs with paths/strokes/groups/gradients/large path data/layers, and deliberately unsafe SVG references for sanitizer tests. Generate valid/invalid/whitespace/data-URI Base64 fixtures. Preserve all existing limits.

Exercise threshold, turn policy, turd size, optimization tolerance, trace size, brightness, contrast, noise/despeckle, edge threshold/thickness, gap/island/hole cleanup, selected-color removal/tolerance, transparency/background/alpha, layer count/merge/sort/outlines, trim/preserve canvas/padding, output width/height/aspect, export quality, page size/orientation, and SVG utility controls on routes whose capability model exposes them.

### Lifecycle and concurrency workflow

For each changed ownership path, test success, validation failure before and after gate acquisition, trace/helper exception, timeout, explicit abort, client disconnect, queue-full, queued abort, reset during work, immediate second upload, output switch during an edit, route unmount, stale older completion, repeated preset changes, batch concurrency, and repeated jobs in one process. Confirm slot counts return to zero; cache/store counts are bounded; object URLs/workers/timers return to their owned baseline; latest result wins; history items remain independent; copied/downloaded/exported data matches the current edited preview; and security/rate/concurrency behavior is unchanged.

## 12. Unknown production data needed

Only production inspection can provide:

- Droplet/VM/container RAM, container memory limit, swap size/use, and kernel overcommit settings.
- Actual Node process/container/replica count, cluster mode, process manager, Node memory flags, and deployed commit/runtime versions.
- Process uptime, restart history/reasons, platform health restarts, deploy cadence, uncaught exceptions, OOM kills, and kernel/container OOM logs.
- Reverse-proxy/CDN request-body buffering, request size/timeouts, client-disconnect propagation, and concurrency reaching the app.
- RSS, heap, external, ArrayBuffer, Sharp/libvips cache/counters, and CPU before, at peak, immediately after, and after controlled idle for representative single, layered, PDF, favicon, Base64, and batch jobs.
- Repeated-job trend in the same process, including whether RSS plateaus, whether external/ArrayBuffer returns, and whether native memory is reusable rather than still reachable.
- Live sizes/cardinality/age distribution of each rate-limit/session/cache store without logging raw IPs, user agents, filenames, or content.
- Real traffic distribution by upload byte size, decoded dimensions, preset/layer count, simultaneous requests, aborts, timeouts, queue-full events, and cache hit rate.

These production facts are necessary to rank native allocator retention versus JavaScript stores and to decide whether any approval-required architecture work is justified.

## Audit conclusion

The repository contains several concrete, safely addressable lifecycle and bounded-store problems, but its largest peaks are primarily explainable by required full-image representations, layered masks, canvas/PDF encoding, Base64/string expansion, and intentionally retained editable history. The next pass should begin with Batch A and Batch B, then measure before altering buffer ownership, Sharp behavior, tracing architecture, quality, limits, history, or serialization. No evidence in this audit supports reducing output quality, dimensions, presets, settings, layer counts, security protections, gate limits, or rate limits.

## Batch A implementation status — 2026-07-12

Batch A is implemented in the worktree and remains uncommitted. The implementation adds no timer, dependency, environment variable, new key transformation, or conversion-path change.

### Stores fixed and bounds introduced

| Store | Files | Expiration rule preserved | Pruning trigger | Hard bound | Full-capacity behavior |
|---|---|---|---|---:|---|
| `__ilovesvg_backend_rate_limits` | `app/utils/backendSecurity.server.ts` | A record is definitely expired only when all four `resetAt` values are at or before the current time | Before selected new-key insertions at the shared stride and always at capacity | 20,000 | Existing keys continue normally; a new key receives the existing generic 429 rate-limit response and active entries are not evicted |
| `__ilovesvg_action_rate_limits` | `home.tsx` plus the twelve shared action-rate route implementations listed below | Same all-four-windows rule | Same thresholded new-key/capacity pruning | 20,000 across the shared process-global Map | Same fail-closed 429 behavior; existing counters and windows continue normally |
| `__iheartsvg_page_rate_limits` | `black-and-white-image-to-svg-for-cricut.tsx` | All four `windowStart + window duration` values must be at or before now | Thresholded new-key/capacity pruning | 5,000 | Existing key continues; new key fails through the route's existing rate-limit response shape |
| `__drawing_to_svg_for_cricut_action_rate_limits` | `drawing-to-svg-for-cricut.tsx` | All four `resetAt` values must have elapsed | Thresholded new-key/capacity pruning | 5,000 | Existing key continues; new key fails closed with existing headers/message flow |
| `__ilovesvg_emoji_converter_rate_limits` | `emoji-to-svg-converter.tsx` | All four `resetAt` values must have elapsed | Thresholded new-key/capacity pruning | 5,000 | Same |
| `__ilovesvg_jpg_layer_action_rate_limits` | `jpg-to-layered-svg-for-cricut.tsx` | All four `resetAt` values must have elapsed | Thresholded new-key/capacity pruning | 5,000 | Same |
| Module `rateLimitStore` | `base64-to-svg.tsx` and `base64-to-svg-for-cricut.tsx` | Existing strict rule remains: `now - lastSeen > 24 hours` | Existing five-minute opportunistic cleanup now runs before admission; the shared helper also prunes at its insertion stride and at capacity | 5,000 per module store | Existing key continues; new key gets the existing generic rate-limit 429 with zero remaining capacity headers |
| `__ilovesvg_batch_sessions` | `home.tsx` | Existing `expiresAt <= now` rule and 20-minute sliding TTL remain | Existing full expired-session scan on each batch-session check, expressed through the typed helper; capacity is rechecked before insertion | 2,000 | Active continuation and existing-key restart remain allowed; only a new key fails closed with a generic 429 server-busy response and Retry-After; active sessions are never evicted |

The generic helper in `app/utils/boundedStore.ts` scans on every 256th new-key insertion and whenever capacity is reached. It has no state of its own. It checks an existing key before pruning or capacity rejection, deletes only entries accepted by the store-specific definite-expiry predicate, rechecks size, and inserts synchronously only below the configured limit. At capacity, Retry-After is derived conservatively from the earliest time an active record can become fully expired. This preserves current Node single-threaded mutation safety and prevents all normal insertion paths from exceeding their bound.

The twelve route implementations sharing `__ilovesvg_action_rate_limits` are `cricut-svg-converter.tsx`, `drawing-to-svg-converter.tsx`, `icon-to-svg-converter.tsx`, `image-to-layered-svg-for-cricut.tsx`, `image-to-svg-for-cricut.tsx`, `image-to-svg-outline.tsx`, `jpeg-to-svg-converter.tsx`, `jpeg-to-svg-for-cricut.tsx`, `jpg-to-svg-converter.tsx`, `jpg-to-svg-for-cricut.tsx`, `layered-svg-for-cricut.tsx`, and `sketch-to-svg-for-cricut.tsx`. `home.tsx` is the thirteenth implementation and preserves its route-selected page/batch limit values.

### Files changed for Batch A

- Shared logic: `app/utils/boundedStore.ts`, `app/utils/backendSecurity.server.ts`.
- Shared action-rate routes: `app/routes/home.tsx`, `app/routes/cricut-svg-converter.tsx`, `app/routes/drawing-to-svg-converter.tsx`, `app/routes/icon-to-svg-converter.tsx`, `app/routes/image-to-layered-svg-for-cricut.tsx`, `app/routes/image-to-svg-for-cricut.tsx`, `app/routes/image-to-svg-outline.tsx`, `app/routes/jpeg-to-svg-converter.tsx`, `app/routes/jpeg-to-svg-for-cricut.tsx`, `app/routes/jpg-to-svg-converter.tsx`, `app/routes/jpg-to-svg-for-cricut.tsx`, `app/routes/layered-svg-for-cricut.tsx`, and `app/routes/sketch-to-svg-for-cricut.tsx`.
- Route-specific stores: `app/routes/black-and-white-image-to-svg-for-cricut.tsx`, `app/routes/drawing-to-svg-for-cricut.tsx`, `app/routes/emoji-to-svg-converter.tsx`, `app/routes/jpg-to-layered-svg-for-cricut.tsx`, `app/routes/base64-to-svg.tsx`, and `app/routes/base64-to-svg-for-cricut.tsx`.
- Focused verification: `scripts/bounded-store-audit.mjs`.
- Status record: `docs/audits/ilovesvg-memory-safety-audit.md`.

### Tests and validation

`scripts/bounded-store-audit.mjs` transpiles and exercises the actual TypeScript helper and statically verifies every audited insertion path. It covers expired removal, active retention, existing-key updates at capacity, admission after expired pruning, fail-closed rejection, no active eviction, unchanged counters/window objects, partial-window retention, exact window-start and Base64 expiration boundaries, unchanged session TTL/continuation, idempotent pruning, hard-size enforcement, capacity headers, and invalid configuration rejection.

Validation completed on 2026-07-12:

- `node scripts/bounded-store-audit.mjs` — passed.
- `npm run typecheck` — passed (`react-router typegen && tsc -b`).
- `npm run build` — passed; only existing Vite chunk-size and mixed dynamic/static import warnings were reported.
- `npm test` — passed (`test:conversion-cache`, `test:trace-engine`, and `test:trace-quality`).
- `npm run lint` — unavailable and failed because this repository defines no `lint` script and has no ESLint dependency/configuration.
- Final whitespace/status checks are recorded in the task handoff.

### Intentionally unchanged and deferred

Already bounded Potrace, conversion, Twemoji, font, export, and browser caches were left unchanged because they are not Batch A's confirmed unbounded security/session stores. The conversion gate, request parsing order, Sharp configuration, Potrace timeout/cancellation, worker/object-URL lifecycle, output/history caches, buffer copies, conversion algorithms, output quality, routes, presets, settings, UI, and SEO remain deferred to later approved batches. Count bounds do not provide byte-accurate accounting; production store cardinality and memory measurements remain a Batch C diagnostic need.

## Batch B implementation status — 2026-07-12

Batch B is implemented in the worktree and remains uncommitted. The changes are lifecycle-only: they release resources after their confirmed owner ends, preserve every visible history item and independent concurrent result, and do not alter conversion inputs, algorithms, settings, output bytes, quality, routes, UI, or metadata.

### Batch A adversarial review

The bounded helper and every Batch A insertion path were re-read before Batch B. The helper is synchronous and deterministic, checks existing keys before capacity admission, prunes only through each store's exact expiration predicate, never evicts active records, and owns no timer or state. The four-window stores retain partially active records; the Base64 stores retain their strict `now - lastSeen > 24 hours` boundary; batch sessions retain their 20-minute sliding expiry and existing-key continuation at capacity. Key composition, counters, windows, shared global Map names, response shapes, and Retry-After behavior remain unchanged. `node scripts/bounded-store-audit.mjs` passes. No functional or security defect was found; the only Batch A cleanup was removal of an unused `pathToFileURL` test-script import.

### Files changed for Batch B

- Shared lifecycle logic and tests: `app/client/lib/lifecycleCleanup.ts`, `scripts/client-lifecycle-audit.mjs`, and updated owner-lifecycle assertions in `scripts/output-card-ux-audit.mjs`.
- Output cache ownership: `app/client/components/converter/TraceOutputPanel.tsx` and `app/client/components/converter/BespokeTraceOutputPanel.tsx`.
- Worker/native cleanup: `app/client/lib/tracing/useHybridTraceFetcher.ts` and `app/client/workers/vtracer.worker.ts`.
- Route ownership: `app/routes/home.tsx`, `app/routes/svg-to-favicon-generator.tsx`, `app/routes/png-to-svg-for-cricut.tsx`, and `app/routes/png-to-svg-for-silhouette.tsx`.

### Object URLs, snapshots, and caches fixed

- The favicon route now has one stable component owner for its three persistent preview URLs. Replacement/reset continues to revoke only the replaced value; unmount revokes the then-current unique set. The temporary SVG decode URL is revoked in `finally` after either load or failure, and image handlers are detached. Existing delayed revocation for one-shot downloads remains unchanged so the browser can begin the download safely.
- The PNG Cricut and Silhouette routes now release all history-owned and pending-submission source snapshots on unmount. Failed replacement jobs release only snapshots not referenced by visible history. Cricut BUSY retries delete superseded replacement submissions before resubmission. Silhouette's existing new-file behavior destroys the old history, so it now also cancels the old submitted client jobs and releases their snapshots before clearing that owned state. Cricut intentionally preserves prior history on file replacement, so still-owned history jobs are not canceled speculatively.
- Both output panels now reference-count output keys across mounted component owners. Removed outputs and unmounted panels delete appearance state and finalized-SVG cache entries only after the last owner releases the key. Active and visible history output is never evicted, and repeated release is safe.

### Workers, native resources, and stale completion fixed

- `useHybridTraceFetcher` now cancels and clears every component-owned client job on unmount, rejects pending server-cache waiters, clears cancellation bookkeeping, and prevents post-unmount progress, result, error, and active-count state updates. Canceled jobs cannot commit late results. Independent older jobs that are still active continue to publish their own successful results; the existing latest-only failure/server-fallback policy remains unchanged.
- Home now aborts its direct per-job controllers and component/batch controller on unmount, clears their registries and pending source snapshots, and guards direct trace/batch state writes after unmount or abort. The component signal reaches browser batch tracing. Existing server request behavior is unchanged because redesigning server-request cancellation is outside this batch.
- The VTracer worker now calls the library-supported `config.free()` in a best-effort `finally` boundary after `convertImageToSvg` has produced or thrown. Cleanup runs on success and failure, and a cleanup exception cannot hide the original conversion error or replace a successful output. Parent VTracer and centerline worker clients already terminate workers in `finally` and abort handlers; no worker Blob URL exists because both workers use module URLs.
- No additional timer/listener change was required. The scoped BUSY retry already returns `clearTimeout`, worker signal listeners already settle/remove, and the audited short toast timers retain only small UI state.

During review of the first Batch B draft, a latest-run success guard was found to conflict with intentional concurrent output history. It was corrected before final validation: only canceled/unmounted jobs are suppressed, while older active successful jobs remain independently deliverable. The first production build also exposed a worker-only alias-resolution failure; the worker import was changed to the equivalent relative path and the build then passed.

### Tests and validation

`scripts/client-lifecycle-audit.mjs` executes the actual typed ownership/cleanup helpers and verifies shared cache ownership, last-owner deletion, idempotent release, temporary versus visible source-snapshot revocation, successful and failing native cleanup, and preservation of the original error when cleanup also fails. It statically verifies the route unmount/reset/replacement paths, all cancellation registries and stale-state guards, worker termination/abort behavior, favicon URL ownership, and VTracer `free()` coverage.

Validation completed on 2026-07-12:

- `node scripts/client-lifecycle-audit.mjs` — passed.
- `node scripts/bounded-store-audit.mjs` — passed.
- `npm run test:output-ux` — passed after its assertions were updated from the removed destructive prune names to owner-aware lifecycle checks.
- `npm run typecheck` — passed. An earlier run caught an invalid `null` assignment to Home's existing submission sentinel; it was corrected without changing behavior.
- `npm run build` — passed after correcting the worker-bundle import path. Existing Vite mixed static/dynamic import and chunk-size warnings remain.
- `npm test` — passed (`test:conversion-cache`, `test:trace-engine`, and `test:trace-quality`).
- Route-filtered `npm run test:hybrid-browser` — passed for `/`, `/png-to-svg-for-cricut`, and `/png-to-svg-for-silhouette`. Home covered default Potrace, VTracer, Potrace-preset, and centerline-preset paths. Each reported decoded, unbroken output previews, copy/download/update behavior, and no console errors.
- In-app browser checks at `http://localhost:3000` directly loaded `/`, `/png-to-svg-for-cricut`, `/png-to-svg-for-silhouette`, and `/svg-to-favicon-generator` without console errors. The favicon example generated 24 files and decoded 512/192/180/64/32/16 previews; Clear removed owned previews and a second example load decoded correctly. The download click was initiated, but the in-app harness did not capture its download event, so file receipt was not claimed from that check.
- `npm run test:focused-editor` exceeded its 184-second command limit and is inconclusive; `npm run test:post-conversion-editability` also exceeded its 124-second combined-command limit before producing a result.
- `npm run test:cumulative-edit-performance` exceeded its 184-second command limit without producing a result and is inconclusive.
- `npm run test:queue` completed its checks but failed one unrelated existing static preset token: it expects `photo-many-colors` to contain `layerBuildMode: "raw-vtracer"`; current preset quality tests verify that preset as `per-color-cutout`. Batch B did not change preset definitions or this assertion.

Final typecheck, focused lifecycle scripts, diff whitespace, new-file whitespace, and status checks are recorded in the task handoff.

### Intentionally unresolved and deferred

- The Cricut route keeps prior history across a second upload. Ownership of still-running jobs associated with that visible history is product state, so they were not canceled on file replacement; unmount cancellation is handled by the shared hook and snapshot release occurs when route ownership ends.
- Server fallback requests are not redesigned or aborted in this batch. Parsed request bodies before gate admission, queued server abort removal, Potrace timeout cancellation, Sharp configuration, buffer copies, byte-accurate cache accounting, and production diagnostics remain assigned to later batches.
- Count-bounded compression/conversion caches and visible output history remain unchanged. Their byte footprint requires Batch C measurement before any eviction or copy change.
- Worker script URLs are module URLs rather than component-created Blob URLs, so there is no Blob URL to revoke. No speculative cleanup API was added to any other library.

All routes, accepted inputs, output formats, conversion behavior and quality, presets and defaults, advanced settings, upload/preview/history/edit/copy/download/export/reset behavior, security limits, gate/concurrency behavior, UI, SEO content, canonical URLs, sitemap behavior, and internal links are preserved.

## Batch C implementation status — 2026-07-12

Batch C adds server-only, immediate-log memory diagnostics and remains uncommitted. Diagnostics are disabled by default and do not create a completed-job registry, event array, Map, timer, interval, file, database, network exporter, or retained request/output reference. When disabled, job creation returns before reading memory, generating an ID, sampling, inspecting stores, or logging.

### Helper files and flags

- `app/utils/memoryDiagnostics.server.ts` contains the typed configuration, per-job logger, memory snapshot, safe error classifier, and aggregate store-count reader. Its `.server.ts` boundary is not imported into client components or workers.
- `app/utils/conversionGate.server.ts` accepts an optional diagnostic job, emits wait/acquire/release checkpoints only when one was sampled, and exposes a frozen read-only snapshot. Capacity, maximum queue size, FIFO resolver order, busy response, wait policy, and idempotent release behavior are unchanged.
- `app/utils/imagePreprocess.server.ts`, `app/utils/potraceCompat.ts`, and `app/utils/svgLayerTrace.server.ts` provide central preprocessing, Potrace, and layered checkpoints.
- `app/routes/home.tsx` provides representative overall/gate context for single and layered raster-to-SVG work. `app/routes/base64-to-svg.tsx` provides representative Base64 decode/conversion context. No request is reparsed and no buffer, SVG, or output is cloned for measurement.
- `scripts/memory-diagnostics-audit.mjs` verifies configuration, privacy, boundedness, sampling, aggregate stores, and gate snapshot behavior. `scripts/memory-diagnostics-smoke.mjs` starts an isolated production build, exercises real HTTP action paths, captures a bounded number of events, then repeats a conversion with diagnostics disabled for output parity.

The server-only flags are:

- `ILOVESVG_MEMORY_DIAGNOSTICS=1` enables diagnostics. Any other or absent value disables them.
- `ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE=0..1` makes one decision per diagnostic job. When enabled and unspecified or invalid, it safely defaults to `0.1`. `0` emits nothing; `1` is intended for targeted local runs.
- `ILOVESVG_MEMORY_DIAGNOSTICS_ROUTES=home,base64-to-svg,...` optionally accepts at most 32 comma-separated exact route IDs or conversion-family names. Empty means all eligible jobs. Tokens are normalized and limited to 80 characters.

The flags are not enabled automatically in development or production, are not returned by a loader/action, and are not added to deployment configuration.

### Event, memory, gate, and store fields

Each sampled job receives a `crypto.randomUUID()` correlation ID containing no request data. The flat JSON event can contain only the event name, ISO timestamp, checkpoint, correlation ID, normalized route/family/mode/preset tokens, elapsed milliseconds, approved numeric conversion metadata, memory bytes, and aggregate counts. It never accepts a request, filename, IP, user agent, cookie, session ID, key, body, Buffer, Base64 string, SVG, stack, filesystem path, or arbitrary error message.

Memory fields are `rssBytes`, `heapTotalBytes`, `heapUsedBytes`, `externalBytes`, and `arrayBufferBytes`, obtained from `process.memoryUsage()`. `unclassifiedProcessBytes` is clamped to `max(0, rss - heapTotal - external)`. This is only an approximation that may include native allocations, libvips, shared libraries, thread stacks, allocator arenas/retention, memory-mapped pages, and other process memory. It is not exact Sharp/libvips usage.

Conversion fields, when already cheaply known, are `inputBytes`, source and processing dimensions, layer count, output bytes, path count, warning count, and elapsed time. Output byte counts use existing string/buffer length operations; diagnostics do not parse SVG solely to count nodes or paths.

Gate fields are `gateActive`, `gateQueued`, `gateCapacity`, `gateQueueCapacity`, and `gateWaitMs`. The frozen diagnostic snapshot cannot mutate the gate. Gate logging retains only the same bounded queue closure while a request is actually waiting and no metadata after the caller drops its release closure.

Aggregate store fields are count-only: backend/shared/page/drawing/emoji/layered rate-limit entries, batch-session entries, Potrace-cache entries, and Twemoji-cache entries. Reads use `.size`; no keys, values, expiry records, IP/user-agent components, or session IDs are iterated or logged. The two module-private Base64 rate-limit Maps and other module-private caches are not exposed merely for diagnostics; their count coverage remains a documented gap.

### Checkpoints and coverage

Supported checkpoints are `request-received-after-parse`, `gate-wait-start`, `gate-acquired`, `conversion-start`, `preprocessing-complete`, `tracing-complete`, `optimization-complete`, `output-created`, `response-ready`, `conversion-error`, `conversion-aborted`, `conversion-finally`, and `gate-released`. Not every family emits every checkpoint; a checkpoint is emitted only where that state is already known without duplicating work.

Coverage includes:

- Shared Potrace raster-to-SVG, including decode/raw preparation, cache-hit output, tracing, output size, error classification, and finally.
- Shared raster preprocessing, including source/processing dimensions and produced mask bytes.
- Shared layered raster-to-SVG, including source/raw dimensions, trace/optimization completion, layer/warning counts, output size, error, and finally. This also covers server-assisted layered/Cricut routes using the shared helper.
- Home single and layered action flows, including after-parse input size, gate lifecycle, preset/mode, output, response-ready, error, and finally.
- Base64 single/layered server conversion, including decoded input size, source dimensions, gate lifecycle, output, response-ready, dimension/conversion error, and finally.

SVG-to-PNG/JPEG/WebP, SVG-to-PDF, favicon/ICO/ZIP, and browser VTracer conversion are client-only in the current repository. Server diagnostics cannot truthfully measure their browser heap/Blob/canvas/WASM allocations, so no server-only module was imported into those bundles. Server fallback work that reaches shared Potrace/layered helpers is covered, but browser work before fallback is not. Exact per-route correlation is available for Home and Base64; shared helper events use their own IDs because propagating route context through every action was intentionally avoided in this low-risk pass.

### Privacy, sampling, and failure isolation

Events are immediately sent through one best-effort `console.info(JSON.stringify(event))` call. The payload is flat and bounded to the fixed schema. Sampling is decided once when a job is created and remains stable for all of that job's checkpoints. A completed job ignores repeated `finish()` and late checkpoints. Logger, memory API, store snapshot, date, or serialization failure is caught inside the helper and cannot change conversion status, output, retries, or error handling. Safe error classification uses only controlled categories (`aborted`, `busy`, `timeout`, `validation`, `conversion`, or `unknown`) and never logs the original message or stack.

### Focused and manual verification

`node scripts/memory-diagnostics-audit.mjs` covers disabled-by-default/no-side-effect behavior, enabled safe fields, forbidden-field absence, non-user correlation IDs, non-negative numeric memory fields, clamped unclassified memory, one sampling decision, invalid sample fallback, route/family filtering, logger failure isolation, frozen gate snapshots, count-only store snapshots, completed-job non-retention, stack/message exclusion, and bounded flat payloads.

After `npm run build`, `node scripts/memory-diagnostics-smoke.mjs` used the committed `tests/fixtures/IMG_8487.PNG` through the production HTTP actions on isolated `http://localhost:3197`. It ran one single Potrace conversion, one layered conversion, one Base64 conversion, two sequential conversions, two concurrent conversions under the unchanged gate, a one-pixel Base64 dimension error generated from the existing fixture, and a conversion after a controlled idle delay. With explicit sample rate `1` and five route filters it captured 282 events across 50 route/helper correlations, including all implemented checkpoints except the unexercised abort checkpoint. The maximum observed RSS in the final local run was 220,921,856 bytes; repeated runs varied, so this is a test-environment observation rather than a production capacity claim. The final Home event reported RSS 218,226,688, heap used 48,311,736, external 43,519,801, ArrayBuffer 4,236,975, and approximate unclassified 67,145,927 bytes. A fresh disabled server emitted zero diagnostic events and produced an exactly equal deterministic single-trace SVG.

The browser-only `/svg-to-favicon-generator` boundary was manually checked at `http://localhost:3000`: its example generated favicon/PNG outputs with decoded Blob previews and no alert, Clear removed all owned Blob images and disabled generation, and navigation away completed. No server memory event is expected for this client-only conversion.

### Validation status

- `node scripts/memory-diagnostics-audit.mjs` — passed.
- `node scripts/memory-diagnostics-smoke.mjs` — passed after the production build.
- `npm run typecheck` — passed during implementation.
- `npm run build` — passed with the repository's existing chunk-size and mixed dynamic/static import warnings.
- `npm test` — passed (`test:conversion-cache`, `test:trace-engine`, and `test:trace-quality`). The first run exposed a Node-native TypeScript import-resolution mismatch in the new Potrace helper import; adding the explicit `.ts` extension fixed the harness, after which the full suite passed.
- `npm run test:conversion-actions` — passed across the existing raster, Cricut, layered, batch, and invalid-upload action matrix at `http://localhost:3000`.
- `npm run test:queue` — still fails only its pre-existing unrelated `photo-many-colors` static token expectation (`raw-vtracer` versus the currently validated `per-color-cutout` preset); all gate/client queue checks before that assertion passed. Batch C did not change presets.
- A built-client search found no memory diagnostic event token or environment-flag name, confirming the server-only bundle boundary.
- Remaining required final checks are recorded in the task handoff.

### How to collect production data later

These commands are documentation only; they were not run on a production server. Run them through the normal authorized server-access process and redact hostnames, user data, and secrets before sharing output.

System capacity and swap:

```sh
free -h
swapon --show
grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree' /proc/meminfo
```

Process count, RSS, and Node flags:

```sh
ps -eo pid,ppid,%mem,rss,etime,args --sort=-rss | head -n 25
pgrep -af 'node|pm2'
tr '\0' ' ' </proc/<NODE_PID>/cmdline; echo
```

Use only the manager actually deployed:

```sh
pm2 status
pm2 jlist
systemctl status <SERVICE_NAME> --no-pager
systemctl show <SERVICE_NAME> -p NRestarts -p ExecMainStartTimestamp -p MemoryCurrent
docker ps --no-trunc
docker stats --no-stream
docker inspect <CONTAINER_NAME_OR_ID> --format '{{.HostConfig.Memory}} {{.RestartCount}}'
```

Restart and OOM evidence:

```sh
journalctl -u <SERVICE_NAME> --since '7 days ago' --no-pager
journalctl -k --since '7 days ago' --no-pager | grep -Ei 'oom|out of memory|killed process'
dmesg -T | grep -Ei 'oom|out of memory|killed process'
```

For a controlled local or staging diagnostic run, first build, then use the focused harness:

```sh
npm run build
node scripts/memory-diagnostics-smoke.mjs
```

For a deliberately sampled server session, set flags only for that process and preserve the normal start command:

```sh
ILOVESVG_MEMORY_DIAGNOSTICS=1 \
ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE=0.1 \
ILOVESVG_MEMORY_DIAGNOSTICS_ROUTES=home,base64-to-svg,shared-potrace,shared-layered-trace \
npm start
```

Record the deployed commit, process ID/uptime, process/replica count, droplet/container RAM and limit, swap, Node flags, and restart/OOM history. For the same process, compare a sampled job's first checkpoint, largest checkpoint, `conversion-finally`, the next job after a controlled idle period, and repeated sequential/concurrent jobs. Compare `heapUsedBytes`, `externalBytes`, `arrayBufferBytes`, RSS, gate counts, and store counts separately. Do not force GC. RSS may stay elevated because native allocators and arenas remain reusable; JavaScript collection timing is nondeterministic; available system memory also matters. Repeated post-job baseline growth is more concerning than one bounded peak. An abrupt memory drop may indicate deployment or process restart, so correlate with PID/uptime and restart logs. These diagnostics cannot isolate exact libvips memory without external/native tooling.

### Limitations and remaining production needs

Production RAM/container limits, swap, process/replica count, manager and restart policy, actual Node flags, proxy buffering, OOM/restart history, traffic concurrency, and representative before/peak/finally/next-idle trends remain unknown. Exact Sharp/libvips attribution, module-private Base64 store counts, client-only conversion memory, queued-client disconnect behavior, detached Potrace timeout work, and byte-accurate cache accounting remain outside this pass.

Diagnostics remain disabled by default. Batch C changes no route, input, output, algorithm, quality setting, preset/default, upload/validation limit, Sharp/Potrace configuration, gate capacity/order, rate/session semantics, timeout, client state, UI, copy, metadata, SEO content, canonical URL, sitemap behavior, or internal link.

## Final milestone review — 2026-07-12

The accumulated Batch A, Batch B, and Batch C diff was reviewed as one milestone before commit. The review covered every changed production file, the new helpers, every bounded-store insertion path, client ownership and Strict Mode cleanup behavior, worker/native cleanup, diagnostic privacy and server/client boundaries, audit scripts, and this report. No unrelated route, metadata, preset, setting, conversion, content, or layout change was found.

### Final verdicts

- **Batch A — approved after one final correction.** Active rate-limit records are never evicted; partially active multi-window records remain active; existing keys continue at capacity; new keys prune only definitely expired entries and then fail closed; all normal insertion paths enforce the 20,000 shared, 5,000 route-local, or 2,000 session bounds. Keys, counters, windows, `Retry-After`, the 20-minute sliding session lifetime, and active session continuation are unchanged. The final review replaced an unnecessary full batch-session scan on every continuation with an exact-key expiration check; new-session threshold/capacity pruning still uses the bounded helper.
- **Batch B — approved.** Current/visible history resources retain ownership, obsolete object URLs and temporary snapshots are released, component cache owner counts cannot become negative, entries are removed only after the final owner releases them, repeated cleanup is safe, unmount/reset/file-replacement cancellation cannot update newer state, and VTracer `config.free()` is the supported API in `wasm_vtracer.d.ts`. The SVG string is obtained before cleanup and cleanup failure cannot hide the conversion result or original error. Independent intentional history jobs remain deliverable.
- **Batch C — approved after two defensive corrections.** Diagnostics remain exactly opt-in, server-only, immediate-log, sampled once per job, flat, bounded, content-free, and non-retaining. Disabled route error paths no longer load the diagnostic module, job creation is best effort as well as logging, and the isolated smoke server now escalates to forced termination if graceful shutdown stalls. Gate snapshots are frozen/read-only and stores expose count-only `.size` values.

### Defects found and corrections made

1. `app/routes/home.tsx` scanned the complete batch-session Map on every continuation. It now checks and removes only an expired matching session during lookup; thresholded or at-capacity new-key admission performs full expired-only pruning through `getOrCreateBoundedStoreEntry`.
2. `app/routes/home.tsx` and `app/routes/base64-to-svg.tsx` dynamically imported error classification even when diagnostics were disabled. Both imports are now guarded by the already sampled diagnostic job, so disabled error behavior has only the cheap environment/job guard and cannot have its original error masked by a diagnostic import.
3. `app/utils/memoryDiagnostics.server.ts` now catches production job-creation failure and returns `null`, matching checkpoint/logger failure isolation.
4. `scripts/memory-diagnostics-smoke.mjs` no longer throws from a stream event callback and now records a bounded capture error for the controlled flow. It performs graceful termination, then forced termination with a second bounded wait, and fails if the isolated process still does not exit.
5. `scripts/conversion-queue-audit.mjs` contained the stale expectation that `photo-many-colors` used `raw-vtracer`. The production preset, trace-engine audit, trace-quality smoke, adaptive palette tests, and region-fidelity tests consistently specify `per-color-cutout`; only the assertion was corrected. No preset or conversion behavior changed.

### Files in the milestone

- Store/security helpers and diagnostics: `app/utils/boundedStore.ts`, `app/utils/backendSecurity.server.ts`, `app/utils/conversionGate.server.ts`, `app/utils/memoryDiagnostics.server.ts`, `app/utils/imagePreprocess.server.ts`, `app/utils/potraceCompat.ts`, and `app/utils/svgLayerTrace.server.ts`.
- Client lifecycle: `app/client/lib/lifecycleCleanup.ts`, `app/client/lib/tracing/useHybridTraceFetcher.ts`, `app/client/workers/vtracer.worker.ts`, `app/client/components/converter/TraceOutputPanel.tsx`, and `app/client/components/converter/BespokeTraceOutputPanel.tsx`.
- Route-local lifecycle/diagnostics/session work: `app/routes/home.tsx`, `app/routes/base64-to-svg.tsx`, `app/routes/png-to-svg-for-cricut.tsx`, `app/routes/png-to-svg-for-silhouette.tsx`, and `app/routes/svg-to-favicon-generator.tsx`.
- Bounded route stores: `app/routes/base64-to-svg-for-cricut.tsx`, `app/routes/black-and-white-image-to-svg-for-cricut.tsx`, `app/routes/cricut-svg-converter.tsx`, `app/routes/drawing-to-svg-converter.tsx`, `app/routes/drawing-to-svg-for-cricut.tsx`, `app/routes/emoji-to-svg-converter.tsx`, `app/routes/icon-to-svg-converter.tsx`, `app/routes/image-to-layered-svg-for-cricut.tsx`, `app/routes/image-to-svg-for-cricut.tsx`, `app/routes/image-to-svg-outline.tsx`, `app/routes/jpeg-to-svg-converter.tsx`, `app/routes/jpeg-to-svg-for-cricut.tsx`, `app/routes/jpg-to-layered-svg-for-cricut.tsx`, `app/routes/jpg-to-svg-converter.tsx`, `app/routes/jpg-to-svg-for-cricut.tsx`, `app/routes/layered-svg-for-cricut.tsx`, and `app/routes/sketch-to-svg-for-cricut.tsx`.
- Verification and documentation: `scripts/bounded-store-audit.mjs`, `scripts/client-lifecycle-audit.mjs`, `scripts/memory-diagnostics-audit.mjs`, `scripts/memory-diagnostics-smoke.mjs`, `scripts/output-card-ux-audit.mjs`, `scripts/conversion-queue-audit.mjs`, and this audit.

### Final validation matrix

| Check | Final result |
|---|---|
| `node scripts/bounded-store-audit.mjs` | Passed after the exact-key session-pruning correction |
| `node scripts/client-lifecycle-audit.mjs` | Passed |
| `node scripts/memory-diagnostics-audit.mjs` | Passed |
| `node scripts/memory-diagnostics-smoke.mjs` | Passed against the production build on isolated port 3197; 282 enabled events/50 correlations, zero disabled events, exact SVG parity, and deterministic server teardown. Final run maximum RSS was 232,857,600 bytes; this is local evidence, not a production limit |
| `npm run test:output-ux` | Passed |
| `npm run test:conversion-actions` | Passed |
| `npm run test:queue` | Passed after correcting only its stale `photo-many-colors` assertion |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with the repository's existing chunk-size and mixed dynamic/static import warnings |
| `npm test` | Passed: conversion-cache, trace-engine, and trace-quality |
| Hybrid browser `ROUTE_FILTER=/` | Passed default Potrace, browser VTracer, Potrace preset, and centerline; decoded preview, update, copy, and download initiation passed with no console errors |
| Hybrid browser `ROUTE_FILTER=/png-to-svg-for-cricut` | Passed Potrace parity, preview, update, copy, and download initiation with no console errors |
| Hybrid browser `ROUTE_FILTER=/png-to-svg-for-silhouette` | Passed Potrace parity, preview, update, copy, and download initiation with no console errors |
| `git diff --check` | Passed; only Git's informational LF-to-CRLF worktree warnings appeared |
| New-file trailing-whitespace and local-absolute-path scans | Passed |
| Built-client diagnostic boundary search | Passed: no flag, event, or checkpoint diagnostic token in `build/client` |

### Previously inconclusive and performance-oriented tests

- `npm run test:focused-editor` completed instead of timing out. All six routes converted, focused the editor, preserved history, copied, downloaded, and reported zero console errors. The command failed only its existing `accordionStable` animation-settling threshold at some wide viewports (roughly 2–10 px during the sampling window). This milestone changes no CSS, layout, accordion, or animation implementation, so this is not a memory-safety regression.
- The full `npm run test:post-conversion-editability` run passed six of seven routes. Its JPG layered case missed only timing thresholds after several heavy scenarios while all functional assertions passed. An isolated rerun with `POST_CONVERSION_ROUTE_FILTER=jpg-layered-flat-color` passed (settings 471 ms, color 360 ms, slider 801 ms), verifying the changed `BespokeTraceOutputPanel` path.
- `npm run test:cumulative-edit-performance` completed instead of timing out. The changed shared `TraceOutputPanel` and `BespokeTraceOutputPanel` scenarios passed repeated edits, bounded edit-growth, exact preview/copy/download parity, and reset. The unchanged route-local Home panel exceeded timing thresholds under the 1440×1080 stress fixture, but its edits, parity, 1.23 growth factor, copy, download, and reset completed. No product code was changed for timing-only unrelated thresholds.
- No final test remained inconclusive. The non-zero performance-suite commands above are recorded as unrelated threshold failures, not hidden as passes.

### Manual and browser-assisted verification

- Home was loaded directly at `http://localhost:3000`; the route-filtered browser suite covered first upload, default Potrace, browser VTracer, explicit Potrace, centerline, decoded preview, history/update-preview, copy, and download initiation.
- `/png-to-svg-for-cricut` and `/png-to-svg-for-silhouette` loaded directly; their route-filtered suites covered upload, conversion, decoded preview, history/update-preview, copy, download initiation, and no console errors. Silhouette also exercised an in-flight join under the existing scheduler.
- `/svg-to-favicon-generator` loaded an example, generated 24 favicon/PNG/manifest outputs with decoded previews, initiated ZIP download, cleared back to an empty disabled state, loaded a second example successfully, and navigated through Cricut, Silhouette, and Home without a broken preview or alert.
- The production diagnostic smoke covered Potrace, layered/Cricut shared processing, Base64, two sequential jobs, two concurrent jobs, a safe validation error, a post-idle job, disabled logging, and output parity. No production server data was claimed.

### Security and privacy review

No active security record is evicted, no insertion bypasses a bound, no protection fails open, and capacity responses reveal no keys, IPs, user agents, session IDs, store names, or capacities. Existing rate-limit and gate semantics are unchanged. Diagnostics accept only fixed identifiers and numeric metadata, sanitize bounded tokens, use a random UUID unrelated to user data, and never retain or log filenames, input/output contents, SVG, Base64, Buffers, request bodies, IPs, user agents, cookies, sessions, keys, stacks, paths, secrets, or arbitrary error messages. The client production bundle contains none of the server diagnostic tokens.

### Behavior preservation

The final diff changes internal resource ownership, bounded store admission, best-effort cleanup, and disabled-by-default diagnostics only. It does not remove, rename, reduce, or alter any public route, accepted input, output format/bytes intentionally, conversion algorithm or quality, image limit, preset/default, advanced setting, upload/drag-and-drop behavior, preview/history/edit behavior, copy/download/export/reset workflow, security limit/window, session lifetime, gate capacity/FIFO/order, request parsing order, Sharp/Potrace configuration, timeout, UI/content, metadata, SEO, canonical, sitemap, or internal link.

### Deferred risks requiring a separate approved milestone or production measurement

- **Request bodies parsed before gate admission:** changing admission or upload parsing order can alter validation, response timing, and request semantics.
- **Queued disconnect retention:** abort-aware queue removal changes gate lifecycle/FIFO behavior and needs a separate concurrency design and load testing.
- **Detached Potrace timeout work:** synchronous tracing cannot be canceled safely without an isolation/worker architecture decision.
- **Sharp/libvips configuration and allocator behavior:** RSS, cache, native thread, and allocator retention require production topology and repeated-job measurement before changing concurrency or cache settings.
- **Large buffer-copy optimization:** aliasing or encoder changes can corrupt mutation isolation or alter bytes/quality; each copy needs measured proof and parity validation.
- **Byte-accurate cache accounting:** count-bounded caches remain safe from unbounded entry growth, but byte budgets could alter current cache retention and performance.
- **Client-only canvas/PDF/favicon peak diagnostics:** server diagnostics cannot observe browser canvas, Blob, PDF, ZIP, ICO, or WASM peaks; browser-specific bounded instrumentation is a separate pass.
- **Production process topology and restart behavior:** droplet/container RAM, swap, process/replica count, Node flags, PM2/systemd/container status, restarts, and OOM logs are unavailable from the repository.

These deferred items were intentionally not implemented because they require production evidence or can change behavior, output, timing, gate semantics, or architecture. They remain candidates only for a separately approved milestone.
