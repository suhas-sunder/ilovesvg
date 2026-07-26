import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ownershipPath = path.join(
  rootDir,
  "app/client/lib/converter/traceResultOwnership.ts",
);

const bundled = await build({
  entryPoints: [ownershipPath],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent",
});
const production = await import(
  `data:text/javascript;base64,${Buffer.from(
    bundled.outputFiles[0].contents,
  ).toString("base64")}`
);

const jpegSource = await fs.readFile(
  path.join(rootDir, "app/routes/jpeg-to-svg-converter.tsx"),
  "utf8",
);
const jpgSource = await fs.readFile(
  path.join(rootDir, "app/routes/jpg-to-svg-converter.tsx"),
  "utf8",
);
const outputPanelSource = await fs.readFile(
  path.join(rootDir, "app/client/components/converter/TraceOutputPanel.tsx"),
  "utf8",
);

const checks = [];
const failures = [];
function check(condition, label) {
  const pass = Boolean(condition);
  checks.push({ label, pass });
  if (!pass) failures.push(label);
}

const ownershipA = production.createTraceResultOwnership({
  routeId: "jpeg-to-svg-converter",
  generation: 1,
  sequence: 1,
  stamp: 1001,
});
const ownershipB = production.createTraceResultOwnership({
  routeId: "jpeg-to-svg-converter",
  generation: 1,
  sequence: 2,
  stamp: 1002,
});
const svgA = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>';
const svgB =
  '<svg viewBox="0 0 10 10"><path d="M1 1h8v8z" fill="#123456"/></svg>';
const itemA = {
  stamp: ownershipA.stamp,
  jobId: ownershipA.resultId,
  svg: svgA,
  presetId: "scan-clean",
  presetLabel: "JPG Scan - Clean (remove speckles)",
  engineUsed: "potrace",
  filename: "jpeg-to-svg-converter.svg",
};
const itemB = {
  stamp: ownershipB.stamp,
  jobId: ownershipB.resultId,
  svg: svgB,
  presetId: "layered-color-svg",
  presetLabel: "Layered color SVG",
  engineUsed: "vtracer",
  filename: "jpeg-to-svg-converter.svg",
};

let history = production.commitTraceResult({ history: [], item: itemA });
let activeStamp = production.shouldActivateTraceResult({
  ownership: ownershipA,
  currentGeneration: 1,
  latestSubmittedSequence: 1,
})
  ? ownershipA.stamp
  : null;
check(activeStamp === itemA.stamp, "Potrace result A becomes active");

history = production.commitTraceResult({ history, item: itemB });
if (
  production.shouldActivateTraceResult({
    ownership: ownershipB,
    currentGeneration: 1,
    latestSubmittedSequence: 2,
  })
) {
  activeStamp = ownershipB.stamp;
}
check(activeStamp === itemB.stamp, "VTracer result B becomes active");
check(
  history.length === 2 &&
    history.some((item) => item.jobId === ownershipA.resultId) &&
    history.some((item) => item.jobId === ownershipB.resultId),
  "History retains completed Potrace and VTracer results",
);

const activeB = production.resolveActiveTraceResult(history, activeStamp);
const activeBHash = sha256(activeB?.svg || "");
check(activeB?.jobId === ownershipB.resultId, "Preview resolves to VTracer B");
check(activeBHash === sha256(svgB), "Copy target resolves by VTracer SVG hash");
check(activeBHash === sha256(svgB), "Download target resolves by VTracer SVG hash");
check(activeB?.jobId === ownershipB.resultId, "Editor resolves to VTracer B");
check(activeB?.filename === "jpeg-to-svg-converter.svg", "Output filename is unchanged");

const selectedA = production.resolveActiveTraceResult(history, itemA.stamp);
check(selectedA?.svg === svgA, "Selecting A redirects output actions to A");
const selectedB = production.resolveActiveTraceResult(history, itemB.stamp);
check(selectedB?.svg === svgB, "Selecting B redirects output actions to B");

const priorUpload = production.createTraceResultOwnership({
  routeId: "jpeg-to-svg-converter",
  generation: 1,
  sequence: 3,
  stamp: 1003,
});
check(
  !production.shouldActivateTraceResult({
    ownership: priorUpload,
    currentGeneration: 2,
    latestSubmittedSequence: 1,
  }),
  "Obsolete prior-upload completion cannot activate",
);
check(
  !production.shouldActivateTraceResult({
    ownership: priorUpload,
    currentGeneration: 2,
    latestSubmittedSequence: 0,
  }),
  "Completion after reset cannot reactivate cleared ownership",
);
const secondUpload = production.createTraceResultOwnership({
  routeId: "jpeg-to-svg-converter",
  generation: 2,
  sequence: 4,
  stamp: 1004,
});
check(
  secondUpload.generation !== ownershipB.generation,
  "Second upload has a separate result generation",
);
check(
  !production.shouldActivateTraceResult({
    ownership: ownershipA,
    currentGeneration: 1,
    latestSubmittedSequence: 2,
  }),
  "Older completion cannot replace newer active result",
);

const lateOlderHistory = production.commitTraceResult({
  history: [itemB],
  item: itemA,
});
check(
  lateOlderHistory.length === 2,
  "Intentional concurrent completed results both remain in history",
);
check(
  lateOlderHistory[0].jobId === ownershipB.resultId,
  "History keeps submission order when an older job finishes late",
);
const duplicateHistory = production.commitTraceResult({
  history: lateOlderHistory,
  item: itemB,
});
check(
  duplicateHistory.length === lateOlderHistory.length &&
    duplicateHistory.filter((item) => item.jobId === ownershipB.resultId)
      .length === 1,
  "Duplicate completion is idempotent",
);
check(
  ownershipA.resultId !== ownershipB.resultId &&
    ownershipB.resultId !== secondUpload.resultId,
  "Result IDs remain unique",
);
check(
  itemA.presetLabel.includes("JPG Scan") &&
    itemB.presetLabel === "Layered color SVG",
  "Preset labels remain attached to their submitted results",
);
check(
  itemA.engineUsed === "potrace" && itemB.engineUsed === "vtracer",
  "Engine metadata remains attached to its result",
);

check(
  jpegSource.includes('fd.append("clientRunId", ownership.resultId)') &&
    jpegSource.includes("submittedByRunIdRef"),
  "JPEG production submission carries stable per-run ownership",
);
check(
  jpegSource.includes(
    "submitted.ownership.generation !== sourceGenerationRef.current",
  ) && jpegSource.includes("invalidatePendingTraces()"),
  "JPEG production path guards stale upload/reset generations",
);
check(
  jpegSource.includes("commitTraceResult({") &&
    jpegSource.includes("shouldActivateTraceResult({"),
  "JPEG production completion uses the tested commit and activation helpers",
);
check(
  jpegSource.includes("retrySubmission?.ownership") &&
    jpegSource.includes("retrySubmission?.ownership.sequence") &&
    /submitted\.replaceStamp,\s+submitted,\s+\)/s.test(jpegSource),
  "BUSY retry retains the original submission ownership and ordering",
);
check(
  outputPanelSource.includes("data-active-output") &&
    outputPanelSource.includes("activeOutputStamp"),
  "Shared output panel binds focused actions to explicit active result identity",
);
check(
  !jpgSource.includes("traceResultOwnership") &&
    !jpgSource.includes("activeOutputStamp"),
  "JPG control route did not receive the JPEG state-ownership change",
);

console.log(
  JSON.stringify(
    {
      scenario: {
        historyOrder: history.map((item) => item.jobId),
        activeResultId: activeB?.jobId ?? null,
        activeSvgSha256: activeBHash,
        copyDownloadSvgSha256: sha256(svgB),
      },
      checks,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length > 0) process.exitCode = 1;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
