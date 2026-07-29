import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const modulePath = path.join(
  root,
  "app",
  "client",
  "lib",
  "converter",
  "publicTracePresentation.ts",
);
const source = await readFile(modulePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: modulePath,
  reportDiagnostics: true,
});
assert.deepEqual(
  transpiled.diagnostics ?? [],
  [],
  "public trace presentation module should transpile without diagnostics",
);

const presentation = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`
);
const {
  MAX_VISIBLE_PUBLIC_TRACE_WARNINGS,
  getPublicTraceMethodLabel,
  getPublicTracePathLabel,
  getPublicTraceWarning,
  getVisiblePublicTraceWarnings,
} = presentation;

assert.equal(getPublicTraceMethodLabel("vtracer"), "Detailed color trace");
assert.equal(getPublicTraceMethodLabel("centerline"), "Centerline stroke trace");
assert.equal(getPublicTraceMethodLabel("potrace"), "Clean shape trace");
for (const value of [undefined, null, "", "future-engine", {}, 42]) {
  assert.equal(
    getPublicTraceMethodLabel(value),
    "Trace method unavailable",
    `unknown engine ${String(value)} must stay neutral`,
  );
}

const knownPathLabels = new Map([
  ["SVG cleanup", "SVG cleanup"],
  ["Centerline stroke trace", "Centerline stroke trace"],
  ["Hybrid layered trace", "Detailed color trace"],
  ["Server Potrace", "Clean shape trace"],
  ["Hybrid trace", "Automatic trace"],
]);
for (const [internal, expected] of knownPathLabels) {
  assert.equal(getPublicTracePathLabel(internal), expected);
}
for (const value of [undefined, null, "", "future trace path", {}, 42]) {
  assert.equal(
    getPublicTracePathLabel(value),
    "Trace method unavailable",
    `unknown path ${String(value)} must not claim a known trace method`,
  );
}

const originalActionableWarning =
  "VTracer kept 24 colors but lost fine detail at 1800x1200. Try a smaller palette and retry.";
const originalActionableSnapshot = originalActionableWarning;
const publicActionableWarning = getPublicTraceWarning(
  originalActionableWarning,
);
assert.equal(
  originalActionableWarning,
  originalActionableSnapshot,
  "translation must not mutate the internal warning",
);
assert.match(publicActionableWarning, /kept 24 colors/);
assert.match(publicActionableWarning, /lost fine detail at 1800x1200/);
assert.match(publicActionableWarning, /Try a smaller palette and retry/);
assert.match(publicActionableWarning, /detailed color tracing/i);

assert.equal(
  getPublicTraceWarning("VTracer"),
  "detailed color tracing",
  "identifier-only warnings should translate without a generic replacement",
);
assert.match(
  getPublicTraceWarning(
    "The Potrace backend pipeline preserved dimensions but reduced quality. Retry with more detail.",
  ),
  /clean shape tracing conversion service conversion workflow preserved dimensions but reduced quality\. Retry with more detail\./i,
);
assert.match(
  getPublicTraceWarning(
    "VTracer and Potrace parity changed color detail; retry at 2048x2048.",
  ),
  /detailed color tracing and clean shape tracing output consistency changed color detail; retry at 2048x2048/i,
);
assert.match(
  getPublicTraceWarning(
    "Compact VTracer produced only 3 editable groups; falling back to per-color layered trace.",
  ),
  /produced only 3 editable groups; falling back to per-color layered trace/i,
);
assert.match(
  getPublicTraceWarning(
    "The pipeline reached its quality limit. Try a simpler image.",
  ),
  /conversion workflow reached its quality limit\. Try a simpler image\./i,
);
assert.match(
  getPublicTraceWarning(
    "wasm_vtracer, raw-vtracer, serverVTracerFlatColor, compactVTracerCore, shared-potrace, and @kcaitech/potrace-ts were considered.",
  ),
  /were considered\./,
);

const warnings = getVisiblePublicTraceWarnings([
  "VTracer retained detail. Retry with fewer colors.",
  "VTracer retained detail. Retry with fewer colors.",
  "Potrace preserved dimensions.",
  "The backend pipeline reduced quality.",
  "A fourth public warning should not be visible.",
]);
assert.equal(MAX_VISIBLE_PUBLIC_TRACE_WARNINGS, 3);
assert.equal(warnings.length, 3, "visible warnings remain capped at three");
assert.equal(
  warnings.filter((warning) => /retained detail/.test(warning)).length,
  1,
  "duplicates are removed after public translation",
);

const allPublicOutput = [
  ...warnings,
  publicActionableWarning,
  getPublicTraceMethodLabel("vtracer"),
  getPublicTracePathLabel("Server Potrace"),
].join(" | ");
assert.doesNotMatch(
  allPublicOutput,
  /\b(?:vtracer|potrace|backend|pipeline|parity)\b|wasm_vtracer|raw-vtracer|serverVTracerFlatColor|compactVTracerCore|shared-potrace|@kcaitech\/potrace-ts/i,
  "public trace labels and warnings must not expose prohibited implementation terms",
);

const integrationSources = await Promise.all(
  [
    [
      "app/client/components/converter/TraceOutputPanel.tsx",
      "getVisiblePublicTraceWarnings",
    ],
    [
      "app/client/components/converter/BespokeTraceOutputPanel.tsx",
      "getVisiblePublicTraceWarnings",
    ],
    ["app/routes/home.tsx", "getVisiblePublicTraceWarnings"],
    [
      "app/routes/png-to-layered-svg-for-cricut.tsx",
      "getVisiblePublicTraceWarnings",
    ],
    [
      "app/client/lib/tracing/useHybridTraceFetcher.ts",
      "getPublicTraceWarning",
    ],
  ].map(async ([relativePath, expectedHelper]) => [
    relativePath,
    await readFile(path.join(root, relativePath), "utf8"),
    expectedHelper,
  ]),
);
for (const [
  relativePath,
  integrationSource,
  expectedHelper,
] of integrationSources) {
  assert.match(
    integrationSource,
    new RegExp(expectedHelper),
    `${relativePath} must translate warning output instead of exposing raw warnings`,
  );
}
assert.doesNotMatch(
  integrationSources[0][1],
  /compatible tracing method was used[\s\S]{0,120}\b(?:vtracer|potrace|backend|parity)\b/i,
  "the shared output panel must not replace whole warnings with the old generic message",
);
assert.match(
  integrationSources[4][1],
  /getPublicTraceWarning\(fallbackReason\)/,
  "hybrid server fallback metadata must preserve and translate its reason",
);
assert.doesNotMatch(
  integrationSources[4][1],
  /A compatible tracing method was used to complete this conversion/,
  "hybrid server fallback metadata must not discard its reason for a generic sentence",
);

console.log(
  "public trace presentation audit passed: finite labels, neutral unknowns, actionable warning preservation, dedupe, visible cap, and prohibited-term removal",
);
