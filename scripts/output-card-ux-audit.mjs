import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    return `${label}: missing ${JSON.stringify(needle)}`;
  }
  return null;
}

const checks = [];
const outputPanel = await read("app/client/components/converter/TraceOutputPanel.tsx");
const home = await read("app/routes/home.tsx");
const pngLayered = await read("app/routes/png-to-layered-svg-for-cricut.tsx");
const browserSmoke = await read("scripts/hybrid-browser-smoke.mjs");
const packageJson = await read("package.json");

let appearance = "";
try {
  appearance = await read("app/client/lib/converter/outputAppearance.ts");
} catch {
  checks.push("output appearance helper exists: missing app/client/lib/converter/outputAppearance.ts");
}

checks.push(
  assertIncludes(outputPanel, "focusedOutputStamp", "shared output panel tracks focused editor target"),
  assertIncludes(outputPanel, "collapsedOutputStamps", "shared output panel tracks collapsed cards"),
  assertIncludes(outputPanel, "data-focused-editor", "shared output panel exposes focused editor state"),
  assertIncludes(outputPanel, "data-collapse-state", "shared output panel exposes collapse state"),
  assertIncludes(outputPanel, "OutputAppearanceControls", "shared output panel renders line/fill controls"),
  assertIncludes(outputPanel, "Line weight", "line weight control is visible in output settings"),
  assertIncludes(outputPanel, "Fill spread", "fill spread control is visible where supported"),
  assertIncludes(outputPanel, "getTraceOutputSvg(item)", "shared finalized SVG helper remains the copy/download source"),
  assertIncludes(home, "focusedOutputStamp", "home bespoke card tracks focused editor target"),
  assertIncludes(home, "collapsedOutputStamps", "home bespoke card tracks collapsed cards"),
  assertIncludes(home, "data-focused-editor", "home bespoke card exposes focused editor state"),
  assertIncludes(home, "data-collapse-state", "home bespoke card exposes collapse state"),
  assertIncludes(pngLayered, "focusedOutputStamp", "PNG layered bespoke card tracks focused editor target"),
  assertIncludes(pngLayered, "collapsedOutputStamps", "PNG layered bespoke card tracks collapsed cards"),
  assertIncludes(pngLayered, "data-focused-editor", "PNG layered bespoke card exposes focused editor state"),
  assertIncludes(browserSmoke, "OUTPUT_UX_SMOKE", "browser smoke has focused-editor/collapse/appearance mode"),
  assertIncludes(packageJson, "test:output-ux", "package exposes output UX audit"),
);

if (appearance) {
  checks.push(
    assertIncludes(appearance, "detectOutputAppearanceSupport", "appearance helper detects stroke/fill support"),
    assertIncludes(appearance, "applyOutputAppearanceToSvg", "appearance helper finalizes SVG adjustments"),
    assertIncludes(appearance, "lineWeight", "appearance helper supports line weight"),
    assertIncludes(appearance, "fillSpread", "appearance helper supports fill spread"),
  );
}

const failures = checks.filter(Boolean);

if (failures.length) {
  console.error("[output-card-ux-audit] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[output-card-ux-audit] ok");
