import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type * as VTracerRuntime from "wasm_vtracer/wasm_vtracer_bg.js";

const require = createRequire(import.meta.url);
let runtimePromise: Promise<typeof VTracerRuntime> | null = null;

export function getServerVTracerRuntime(): Promise<typeof VTracerRuntime> {
  // Node 20 does not enable native .wasm ESM imports by default. Load the same
  // package binary explicitly, once per process, without experimental flags.
  // Cache failures too: an unavailable runtime must not create an init storm.
  return runtimePromise ??= initializeRuntime();
}

async function initializeRuntime(): Promise<typeof VTracerRuntime> {
  const runtime = await import("wasm_vtracer/wasm_vtracer_bg.js");
  const bytes = await readFile(require.resolve("wasm_vtracer/wasm_vtracer_bg.wasm"));
  const module = await WebAssembly.compile(Uint8Array.from(bytes));
  const functions: WebAssembly.ModuleImports = {};
  for (const entry of WebAssembly.Module.imports(module)) {
    const value = runtime[entry.name as keyof typeof runtime];
    if (entry.module !== "./wasm_vtracer_bg.js" || entry.kind !== "function" || typeof value !== "function") {
      throw new Error("Unsupported server tracing runtime imports.");
    }
    functions[entry.name] = value;
  }
  const instance = await WebAssembly.instantiate(module, { "./wasm_vtracer_bg.js": functions });
  runtime.__wbg_set_wasm(instance.exports);
  const start = instance.exports.__wbindgen_start;
  if (typeof start === "function") start();
  runtime.init();
  return runtime;
}
