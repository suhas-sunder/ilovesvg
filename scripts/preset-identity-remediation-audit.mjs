import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharedPresetPath = path.join(
  rootDir,
  "app/client/lib/converter/presetAdditions.ts",
);
const selectorPath = path.join(
  rootDir,
  "app/client/components/converter/PresetSelector.tsx",
);

const cases = [
  {
    route: "/icon-to-svg-converter",
    file: "icon-to-svg-converter.tsx",
    previousId: "icon-bold",
    localId: "icon-bold-fill",
    sharedId: "icon-bold",
    localLabel: "Icon - Bold fill",
    sharedLabel: "Icon - Bold",
    defaultId: "layered-color-svg",
    nonCollisionId: "icon-thin",
  },
  {
    route: "/logo-to-svg-converter",
    file: "logo-to-svg-converter.tsx",
    previousId: "logo-smooth",
    localId: "logo-extra-smooth",
    sharedId: "logo-smooth",
    localLabel: "Logo - Extra smooth (fewer nodes)",
    sharedLabel: "Logo - Smooth",
    defaultId: "logo-clean",
    nonCollisionId: "logo-detail",
  },
  {
    route: "/webp-to-svg-for-cricut",
    file: "webp-to-svg-for-cricut.tsx",
    previousId: "cricut-clean-cut",
    localId: "webp-cricut-clean-cut",
    sharedId: "cricut-clean-cut",
    localLabel: "Cricut - Clean cut file",
    sharedLabel: "Cricut - Clean Cut",
    defaultId: "webp-cricut-clean-cut",
    nonCollisionId: "vinyl-decal-bold",
  },
  {
    route: "/jpeg-to-svg-for-cricut",
    file: "jpeg-to-svg-for-cricut.tsx",
    previousId: "cricut-clean-cut",
    localId: "jpeg-cricut-clean-cut",
    sharedId: "cricut-clean-cut",
    localLabel: "Cricut - Clean cut file",
    sharedLabel: "Cricut - Clean Cut",
    defaultId: "jpeg-cricut-clean-cut",
    nonCollisionId: "vinyl-decal-bold",
  },
  {
    route: "/jpg-to-svg-for-cricut",
    file: "jpg-to-svg-for-cricut.tsx",
    previousId: "cricut-clean-cut",
    localId: "jpg-cricut-clean-cut",
    sharedId: "cricut-clean-cut",
    localLabel: "Cricut - Clean cut file",
    sharedLabel: "Cricut - Clean Cut",
    defaultId: "jpg-cricut-clean-cut",
    nonCollisionId: "vinyl-decal-bold",
  },
  {
    route: "/png-to-svg-for-cricut",
    file: "png-to-svg-for-cricut.tsx",
    previousId: "cricut-clean-cut",
    localId: "png-cricut-clean-cut",
    sharedId: "cricut-clean-cut",
    localLabel: "Cricut  -  Clean Cut (default)",
    sharedLabel: "Cricut - Clean Cut",
    defaultId: "png-cricut-clean-cut",
    nonCollisionId: "vinyl-decal-bold",
  },
];

const checks = [];
const failures = [];

function check(condition, label) {
  checks.push({ label, pass: Boolean(condition) });
  if (!condition) failures.push(label);
}

function hasPresetDefinition(source, id, label) {
  const idToken = `id: "${id}"`;
  const labelToken = `label: "${label}"`;
  const start = source.indexOf(idToken);
  if (start < 0) return false;
  const nextDefinition = source.indexOf("\n  {", start + idToken.length);
  const block = source.slice(start, nextDefinition < 0 ? undefined : nextDefinition);
  return block.includes(labelToken);
}

async function loadProductionPinToggle() {
  const entry = `export { togglePinnedPresetId } from ${JSON.stringify(
    selectorPath.replaceAll("\\", "/"),
  )};`;
  const bundled = await build({
    stdin: { contents: entry, resolveDir: rootDir, sourcefile: "preset-toggle-entry.mjs" },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "app-alias",
        setup(esbuild) {
          esbuild.onResolve({ filter: /^~\// }, async (args) => {
            const basePath = path.join(rootDir, "app", args.path.slice(2));
            for (const candidate of [
              basePath,
              `${basePath}.ts`,
              `${basePath}.tsx`,
              `${basePath}.js`,
              path.join(basePath, "index.ts"),
              path.join(basePath, "index.tsx"),
            ]) {
              try {
                await fs.access(candidate);
                return { path: candidate };
              } catch {
                // Try the next supported source extension.
              }
            }
            return { errors: [{ text: `Could not resolve ${args.path}` }] };
          });
        },
      },
    ],
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(
    bundled.outputFiles[0].contents,
  ).toString("base64")}`;
  return (await import(dataUrl)).togglePinnedPresetId;
}

const sharedSource = await fs.readFile(sharedPresetPath, "utf8");
const selectorSource = await fs.readFile(selectorPath, "utf8");
const togglePinnedPresetId = await loadProductionPinToggle();

check(
  selectorSource.includes("activePreset === preset.id"),
  "Preset cards derive active state from the stable preset ID",
);
check(
  selectorSource.includes("pinnedPresetIdSet.has(preset.id)"),
  "Preset cards derive pinned state from the stable preset ID",
);
check(
  selectorSource.includes("togglePinnedPresetId(currentPresetIds, presetId)"),
  "Preset pin toggles use the production ID helper",
);
check(
  selectorSource.includes("stablePresetSettingsSignature(preset.settings || {})"),
  "Rendered-list deduplication preserves definitions that differ in settings",
);

const allReachableIds = new Set();
for (const item of cases) {
  const routePath = path.join(rootDir, "app/routes", item.file);
  const source = await fs.readFile(routePath, "utf8");
  const localKey = `${item.route}:${item.localId}`;
  const sharedKey = `${item.route}:${item.sharedId}`;

  check(item.localId !== item.sharedId, `${item.route} former collision IDs are distinct`);
  check(!allReachableIds.has(localKey), `${item.route} local ID is unique in the audit matrix`);
  check(!allReachableIds.has(sharedKey), `${item.route} shared ID is unique in the audit matrix`);
  allReachableIds.add(localKey);
  allReachableIds.add(sharedKey);

  check(
    hasPresetDefinition(source, item.localId, item.localLabel),
    `${item.route} retains its route-local label under ${item.localId}`,
  );
  check(
    hasPresetDefinition(sharedSource, item.sharedId, item.sharedLabel),
    `${item.route} retains the shared label under ${item.sharedId}`,
  );
  check(
    source.includes(`React.useState<string>("${item.defaultId}")`) ||
      source.includes(`React.useState<string>(\n    "${item.defaultId}",`),
    `${item.route} initializes the preserved default preset`,
  );
  check(
    source.includes(`id: "${item.nonCollisionId}"`),
    `${item.route} retains representative non-colliding preset ${item.nonCollisionId}`,
  );
  check(
    source.includes("pendingPresetIdentityRef") ||
      source.includes("submittedByRunIdRef"),
    `${item.route} binds result metadata to submitted preset identity`,
  );
  check(
    source.includes("presetId: presetIdentity.id") ||
      source.includes("presetId: submitted?.presetId ?? activePreset"),
    `${item.route} stores exact preset ID in history`,
  );
  check(
    source.includes("presetLabel: presetIdentity.label") ||
      source.includes("presetLabel,") && source.includes("presetIdForSubmit"),
    `${item.route} stores the submitted preset label in history`,
  );
  check(
    source.includes("targetPresetId: preset.id") ||
      source.includes("nextSettings, preset.id") ||
      source.includes("nextSettings, null, preset.id"),
    `${item.route} immediate submit passes the clicked ID directly`,
  );
  check(
    source.includes("function selectHistoryOutput(index: number | null)") &&
      source.includes("history[index]?.presetId"),
    `${item.route} history navigation restores the exact preset card`,
  );

  let pinned = togglePinnedPresetId([], item.localId);
  check(
    pinned.includes(item.localId) && !pinned.includes(item.sharedId),
    `${item.route} pinning the local preset does not pin the shared preset`,
  );
  pinned = togglePinnedPresetId(pinned, item.localId);
  check(
    !pinned.includes(item.localId) && !pinned.includes(item.sharedId),
    `${item.route} unpinning the local preset leaves the shared preset unchanged`,
  );
  pinned = togglePinnedPresetId([], item.sharedId);
  check(
    pinned.includes(item.sharedId) && !pinned.includes(item.localId),
    `${item.route} pinning the shared preset does not pin the local preset`,
  );
  check(
    togglePinnedPresetId([item.previousId], item.localId).includes(item.previousId),
    `${item.route} ambiguous legacy pinned ID remains on its canonical interpretation`,
  );
}

const timingFiles = [
  "jpg-to-svg-converter.tsx",
  "jpeg-to-svg-converter.tsx",
  "png-to-svg-for-cricut-print-then-cut.tsx",
  "png-to-svg-for-cricut-stickers.tsx",
];
for (const file of timingFiles) {
  const source = await fs.readFile(path.join(rootDir, "app/routes", file), "utf8");
  check(
    source.includes("presetIdForSubmit") &&
      (source.includes("pendingPresetIdentityRef") ||
        source.includes("lastSubmittedPresetIdentityRef") ||
        source.includes("submittedByRunIdRef")),
    `${file} passes immediate-submit identity into result metadata`,
  );
}

const report = {
  cases: cases.map(({ route, previousId, localId, sharedId, defaultId }) => ({
    route,
    previousId,
    localId,
    sharedId,
    defaultId,
  })),
  legacyCompatibility: {
    persistedSurface: "bounded pinned preset ID list only",
    ambiguousIdFallback: "retained canonical shared ID",
    migrationFrameworkAdded: false,
  },
  checks,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
