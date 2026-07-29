import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");

const expectedViewportKeys = new Set([
  "320x800",
  "360x800",
  "375x812",
  "390x844",
  "412x915",
  "768x1024",
  "1280x720",
]);

async function main() {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      [path.join(rootDir, "scripts/converter-parity-audit.mjs")],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          CONVERTER_PARITY_SECTIONS: "svg-png-responsive",
        },
        timeout: 12 * 60_000,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      },
    ));
  } catch (error) {
    if (!error?.stdout) throw error;
    stdout = error.stdout;
  }
  const report = JSON.parse(stdout);
  assert(report.failures.length === 0, report.failures.join("; "));
  const rows = report.svgToPngResponsive;
  assert(Array.isArray(rows), "Responsive report is missing.");
  assert(rows.length === 63, `Expected 63 route/viewport rows, found ${rows.length}.`);

  const routePaths = [...new Set(rows.map((row) => row.route))].sort();
  assert(routePaths.length === 9, "Expected nine SVG-to-PNG routes.");
  for (const route of routePaths) {
    const routeRows = rows.filter((row) => row.route === route);
    const viewportKeys = new Set(
      routeRows.map(
        (row) =>
          `${row.requestedViewport.width}x${row.requestedViewport.height}`,
      ),
    );
    assert(
      routeRows.length === expectedViewportKeys.size &&
        [...expectedViewportKeys].every((key) => viewportKeys.has(key)),
      `${route} does not cover the exact seven required viewports.`,
    );
  }

  for (const row of rows) {
    assert(
      row.states.every(
        (state) =>
          !state.pageOverflow &&
          state.document.scrollWidth <= state.document.clientWidth + 1 &&
          state.body.scrollWidth <= state.body.clientWidth + 1 &&
          state.maximumVisibleRightEdge <= state.document.clientWidth + 1 &&
          state.horizontalScrollContainers.every(
            (container) => container.intentional,
          ) &&
          state.clippedFocusable.length === 0,
      ),
      `${row.route} failed responsive containment at ${row.requestedViewport.width}x${row.requestedViewport.height}.`,
    );
  }

  const measurements = rows.map((row) => ({
    route: row.route,
    requestedViewport: row.requestedViewport,
    measuredViewport: row.measuredViewport,
    stateCount: row.stateCount,
    maxDocumentScrollWidth: row.maxDocumentScrollWidth,
    maxBodyScrollWidth: row.maxBodyScrollWidth,
    maximumVisibleRightEdge: Math.max(
      ...row.states.map((state) => state.maximumVisibleRightEdge),
    ),
    horizontalScrollContainers: [
      ...new Map(
        row.states
          .flatMap((state) => state.horizontalScrollContainers)
          .map((container) => [
            `${container.selector}|${container.scrollWidth}|${container.clientWidth}`,
            container,
          ]),
      ).values(),
    ],
    widestRenderedElements: [
      ...new Map(
        row.states
          .map((state) => state.widestRenderedElement)
          .filter(Boolean)
          .map((element) => [
            `${element.selector}|${element.owner}|${element.computedWidth}|${element.scrollWidth}`,
            element,
          ]),
      ).values(),
    ],
    downloadedFilename: row.downloadedFilename,
    resetAndSecondUpload: row.resetAndSecondUpload,
  }));

  console.log(
    JSON.stringify(
      {
        routes: routePaths,
        routeCount: routePaths.length,
        viewportCount: expectedViewportKeys.size,
        routeViewportCount: rows.length,
        stateCount: rows.reduce((sum, row) => sum + row.stateCount, 0),
        maximumDocumentScrollWidth: Math.max(
          ...rows.map((row) => row.maxDocumentScrollWidth),
        ),
        measurements,
        screenshotsRetained: false,
        downloadsRetained: false,
        temporaryRoot: "removed by converter parity audit",
        ok: true,
      },
      null,
      2,
    ),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
