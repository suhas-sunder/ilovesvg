# Run 2 — Node 20 server tracing and test portability

Status: LOCAL VALIDATED. The parent owns the application runtime fix and release/deployment decision; this subtask added tests and the test-only TypeScript loader. No commit or deployment by this subtask.

## Two different compatibility defects

1. The existing server VTracer package entry imports a `.wasm` ESM module. The parent reproduced an actual PNG server action returning 500 on Node 20.20.2 because that runtime does not load the package's native WASM ESM import by default. A passing Windows Node 25 run had not established deployment-runtime compatibility. The parent's new `app/utils/vtracerRuntime.server.ts` initializes the same package JS bindings/binary explicitly, once per process, without an experimental production flag; `svgLayerTrace.server.ts` uses that initializer. This is runtime loading, not an engine or tracing-parameter replacement.
2. `test:trace-quality` imported application `.ts` files directly. Node 25 can execute that source, but direct Node 20 execution failed `ERR_UNKNOWN_FILE_EXTENSION` before the assertions ran. This is a test-runner portability defect, separate from conversion output quality.

## Exact WASM-output comparison

`server-vtracer-runtime-test.mjs` transpiles the actual server initializer with the repository's existing TypeScript dependency into ignored `tmp/server-vtracer-runtime-test/<pid>/`. Separate child processes compare:

- Native package `.wasm` import on Node 25.9.0 (reference).
- Explicit initializer on Node 25.9.0.
- Explicit initializer on Node 20.20.2.

All 12 cases match exact raw SVG bytes/SHA-256: four deterministic RGBA fixtures (transparent logo, thin line/curve, multicolor regions, gradient/alpha) across Cutout/Spline, Cutout/None and Stacked/Spline configurations. No old quality thresholds, golden SVGs, defaults, algorithms or trace settings changed.

All processes read the identical WASM binary:

`f45816d016aa0d75f86a81ac5737ce24985dacecb7323405fec42210eb8664be`

Eight concurrent initializer consumers share the same Promise/runtime object and perform exactly one compile per process. A separately injected compile failure also performs one compile and retains the same rejected Promise for later callers, preventing reinitialization storms. Each fixture frees its trace config in `finally`.

Cross-runtime usage:

```
RUN2_NODE20_EXECUTABLE=<node20 executable>
RUN2_NODE25_EXECUTABLE=<node25 executable>
node scripts/server-vtracer-runtime-test.mjs
```

When only Node 20 exists (for example the deployment-compatible CI image), the same script checks actual conversion, singleton initialization and cached failure. It explicitly reports `nativeParityVerified: false` unless a Node 25 reference executable is supplied. It must not claim native-reference equivalence from that single-runtime run. The local cross-runtime run did supply both and reports `nativeParityVerified: true`.

## Portable unchanged quality suite

The one package command is now:

```
node --import ./scripts/register-typescript-test-loader.mjs scripts/trace-quality-smoke.mjs
```

The registration uses Node's built-in `module.register`. The separate ESM loader uses existing `typescript.transpileModule` only for application TypeScript, handles its relative/alias references, and leaves third-party/native modules to Node. It adds no dependency, production loader, server flag or source algorithm change. Production remains the built React Router bundle.

The unchanged trace-quality suite passes on both Node 20.20.2 and Node 25.9.0 through this loader. Its entire metrics report matches exactly between runtimes, excluding only the manual audit timestamp. Full `npm test` also passes under Node 20 (explicit executable/CLI with the Node 20 directory first in PATH) and Node 25, covering cache, engine, quality and the existing reliability regressions.

## Evidence and limits

PASS:

- Cross-runtime server VTracer test: Node 25 native versus manual Node 20/25, 12 exact-output cases.
- Manual Node 20-only runtime functional/singleton/failure checks, honestly without native-reference coverage.
- Trace-quality suite with portable loader on Node 20 and Node 25; exact metrics parity.
- Full npm test on both runtimes.
- Syntax checks on all new test/loader files; scoped whitespace checks.

Failed baseline: direct old invocation on Node 20 rejects the raw application `.ts` import, preserved in `tmp/run2-family-audit/trace-quality-node20-before.log`. Other logs (cross-runtime outputs, both quality reports and full-test runs) are under the same ignored audit directory. Compiled local test modules/reports are intentionally ignored. Only synthetic RGBA fixtures are used; no private source artwork or metadata is accessed.

These are local Windows Node-runtime results. Linux/Alpine deployment-image checks, actual server-action verification after rebuilding, memory/resource acceptance and production rollout remain the parent's release gates. Output parity for this corpus does not establish every possible image/preset or a physical iPhone result.