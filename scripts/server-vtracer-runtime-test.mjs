import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const script = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const childMode = process.argv[2];

if (childMode?.startsWith("--child-")) {
  const moduleUrl = pathToFileURL(process.argv[3]).href;
  if (childMode === "--child-failure") {
    let compileCalls = 0;
    const original = WebAssembly.compile;
    WebAssembly.compile = async () => { compileCalls++; throw new Error("Synthetic runtime initialization failure"); };
    try {
      const helper = await import(moduleUrl);
      const first = helper.getServerVTracerRuntime();
      const second = helper.getServerVTracerRuntime();
      assert.equal(first, second, "Concurrent failed initialization must share one promise");
      await assert.rejects(first, /Synthetic runtime initialization failure/);
      assert.equal(helper.getServerVTracerRuntime(), first, "Failures must stay cached instead of starting initialization storms");
      await assert.rejects(helper.getServerVTracerRuntime(), /Synthetic runtime initialization failure/);
      assert.equal(compileCalls, 1);
      console.log(JSON.stringify({ node: process.versions.node, mode: "failure", compileCalls, cachedFailure: true }));
    } finally { WebAssembly.compile = original; }
  } else {
    let runtime, compileCalls = null;
    if (childMode === "--child-native") {
      runtime = await import("wasm_vtracer");
      runtime.init();
    } else {
      const helper = await import(moduleUrl);
      const original = WebAssembly.compile;
      compileCalls = 0;
      WebAssembly.compile = (...args) => { compileCalls++; return original(...args); };
      try {
        const first = helper.getServerVTracerRuntime();
        assert.equal(helper.getServerVTracerRuntime(), first);
        const results = await Promise.all(Array.from({ length: 8 }, () => helper.getServerVTracerRuntime()));
        runtime = results[0];
        assert.ok(results.every(value => value === runtime));
        assert.equal(compileCalls, 1, "One process must compile the WASM binary once");
      } finally { WebAssembly.compile = original; }
    }
    assert.equal(runtime.isReady(), true);
    const fixtures = [
      { id: "transparent-logo", width: 64, height: 48, pixel: (x, y) => x > 8 && x < 52 && y > 8 && y < 38 ? [187, 51, 0, 255] : [255, 255, 255, 0] },
      { id: "thin-line-and-curve", width: 80, height: 64, pixel: (x, y) => Math.abs(x - y) <= 1 || Math.abs(Math.hypot(x - 48, y - 32) - 18) < 2 ? [0, 0, 0, 255] : [255, 255, 255, 0] },
      { id: "multicolor", width: 72, height: 64, pixel: (x, y) => x < 36 ? (y < 32 ? [250, 50, 20, 255] : [20, 80, 200, 255]) : (y < 32 ? [240, 180, 20, 255] : [30, 180, 90, 255]) },
      { id: "gradient-and-alpha", width: 64, height: 48, pixel: (x, y) => [Math.floor(x * 4), Math.floor(y * 5), 170, x < 4 || y < 4 ? 0 : 255] },
    ];
    const settings = [
      { id: "cutout-spline", hierarchical: "Cutout", mode: "Spline", precision: 6, speckle: 2, difference: 16 },
      { id: "cutout-raw", hierarchical: "Cutout", mode: "None", precision: 8, speckle: 0, difference: 4 },
      { id: "stacked-spline", hierarchical: "Stacked", mode: "Spline", precision: 6, speckle: 4, difference: 24 },
    ];
    const outputs = [];
    for (const fixture of fixtures) for (const setting of settings) {
      const pixels = new Uint8Array(fixture.width * fixture.height * 4);
      for (let y = 0; y < fixture.height; y++) for (let x = 0; x < fixture.width; x++) pixels.set(fixture.pixel(x, y), (y * fixture.width + x) * 4);
      const config = new runtime.TracerConfig();
      try {
        config.setColorMode(runtime.ColorMode.Color);
        config.setHierarchical(runtime.Hierarchical[setting.hierarchical]);
        config.setPathSimplifyMode(runtime.PathSimplifyMode[setting.mode]);
        config.setFilterSpeckle(setting.speckle);
        config.setColorPrecision(setting.precision);
        config.setLayerDifference(setting.difference);
        config.setCornerThreshold(60); config.setLengthThreshold(4); config.setMaxIterations(12); config.setSpliceThreshold(45); config.setPathPrecision(3);
        const svg = runtime.convertImageToSvg(pixels, fixture.width, fixture.height, config);
        assert.match(svg, /<svg\b/); assert.match(svg, /<path\b/);
        outputs.push({ fixture: fixture.id, setting: setting.id, bytes: Buffer.byteLength(svg), sha256: createHash("sha256").update(svg).digest("hex") });
      } finally { config.free(); }
    }
    const binary = await fs.readFile(require.resolve("wasm_vtracer/wasm_vtracer_bg.wasm"));
    console.log(JSON.stringify({ node: process.versions.node, mode: childMode.slice(8), compileCalls, binarySha256: createHash("sha256").update(binary).digest("hex"), outputs }));
  }
} else {
  const directory = path.join(root, "tmp", "server-vtracer-runtime-test", `${process.pid}`);
  await fs.mkdir(directory, { recursive: true });
  const source = await fs.readFile(path.join(root, "app/utils/vtracerRuntime.server.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
  assert.deepEqual(compiled.diagnostics || [], []);
  const modulePath = path.join(directory, "vtracerRuntime.server.mjs");
  await fs.writeFile(modulePath, compiled.outputText);
  function run(executable, mode) {
    const child = spawnSync(executable, [script, `--child-${mode}`, modulePath], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 30_000, windowsHide: true });
    assert.equal(child.status, 0, `${mode} child failed: ${child.error?.message || child.stderr}`);
    return JSON.parse(child.stdout.trim());
  }
  const executables = [...new Set([process.execPath, process.env.RUN2_NODE20_EXECUTABLE, process.env.RUN2_NODE25_EXECUTABLE].filter(Boolean))];
  const manual = executables.map(executable => run(executable, "manual"));
  const failures = executables.map(executable => run(executable, "failure"));
  const nativeExecutable = process.env.RUN2_NODE25_EXECUTABLE || (Number(process.versions.node.split(".")[0]) >= 25 ? process.execPath : null);
  const native = nativeExecutable ? run(nativeExecutable, "native") : null;
  for (const candidate of manual) {
    assert.deepEqual(candidate.outputs, manual[0].outputs, "Manual runtime output must match across configured Node versions");
    assert.equal(candidate.binarySha256, manual[0].binarySha256);
    if (native) {
      assert.deepEqual(candidate.outputs, native.outputs, "Manual Node runtime must preserve exact native-WASM SVG output");
      assert.equal(candidate.binarySha256, native.binarySha256);
    }
  }
  const report = { ok: true, nativeReferenceNode: native?.node || null, manualNodes: manual.map(value => value.node), fixturesAndSettings: manual[0].outputs.length, nativeParityVerified: Boolean(native), binarySha256: manual[0].binarySha256, singletonCompileCalls: manual.map(value => value.compileCalls), cachedFailures: failures.every(value => value.cachedFailure), outputs: manual[0].outputs, note: native ? "All configured runtimes match the native-WASM reference byte-for-byte." : "Conversion/singleton/failure tests passed; set RUN2_NODE25_EXECUTABLE to verify native-WASM reference parity." };
  await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
