import assert from "node:assert/strict";
import { File } from "node:buffer";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const serverEntry = path.join(root, "server.js");
const builtServer = path.join(root, "build", "server", "index.js");
const fixturePath = path.join(root, "tests", "fixtures", "IMG_8487.PNG");
const port = Number(process.env.MEMORY_DIAGNOSTICS_PORT || 3197);
const baseUrl = `http://localhost:${port}`;
const MAX_CAPTURED_EVENTS = 2_000;
const MAX_CAPTURED_LOG_LINES = 5_000;

await access(builtServer).catch(() => {
  throw new Error("Run `npm run build` before the memory diagnostics smoke test.");
});

const fixture = await readFile(fixturePath);
const onePixelFixture = await sharp(fixture).resize(1, 1).png().toBuffer();

const enabled = await withServer(true, async (server) => {
  const firstSingle = await postHome(fixture, "single", "line-accurate");
  await delay(250);
  await postHome(fixture, "layered", "layered-flat-color");
  await delay(250);
  await postBase64(fixture, "single");

  for (let index = 0; index < 2; index += 1) {
    await postHome(fixture, "single", "line-accurate");
    await delay(200);
  }

  await Promise.all([
    postHome(fixture, "single", "line-accurate"),
    postHome(fixture, "single", "line-accurate"),
  ]);

  const errorResponse = await postBase64(onePixelFixture, "single", false);
  assert.equal(errorResponse.response.ok, false);

  await delay(600);
  await postHome(fixture, "single", "line-accurate");
  await delay(200);

  assert.ok(server.events.length > 0, "enabled diagnostics should emit events");
  assert.ok(server.events.length < MAX_CAPTURED_EVENTS);
  assert.ok(
    server.events.some((event) => event.routeId === "home"),
    "home route diagnostics should be present",
  );
  assert.ok(
    server.events.some((event) => event.routeId === "base64-to-svg"),
    "Base64 route diagnostics should be present",
  );
  assert.ok(
    server.events.some((event) => event.routeId === "shared-potrace"),
    "shared Potrace diagnostics should be present",
  );
  assert.ok(
    server.events.some((event) => event.routeId === "shared-layered-trace"),
    "shared layered diagnostics should be present",
  );
  assert.ok(
    server.events.some((event) => event.checkpoint === "gate-acquired"),
    "gate acquisition should be measured",
  );
  assert.ok(
    server.events.some((event) => event.checkpoint === "gate-released"),
    "gate release should be measured",
  );
  assert.ok(
    server.events.some(
      (event) =>
        event.checkpoint === "conversion-error" &&
        event.routeId === "base64-to-svg",
    ),
    "the production error path should emit a safe classification",
  );
  assert.ok(
    server.events.every(
      (event) =>
        Number.isFinite(event.rssBytes) &&
        Number.isFinite(event.heapUsedBytes) &&
        Number.isFinite(event.externalBytes) &&
        Number.isFinite(event.arrayBufferBytes) &&
        event.unclassifiedProcessBytes >= 0,
    ),
  );
  const serializedEvents = JSON.stringify(server.events);
  assert.equal(serializedEvents.includes("IMG_8487"), false);
  assert.equal(serializedEvents.includes("data:image/"), false);
  assert.equal(serializedEvents.includes(fixture.toString("base64").slice(0, 80)), false);

  return {
    firstSingleSvg: firstSingle.svg,
    eventCount: server.events.length,
    correlationCount: new Set(
      server.events.map((event) => event.correlationId),
    ).size,
    checkpoints: [...new Set(server.events.map((event) => event.checkpoint))],
    routes: [...new Set(server.events.map((event) => event.routeId))],
    maxRssBytes: Math.max(...server.events.map((event) => event.rssBytes)),
    finalHomeEvent: [...server.events]
      .reverse()
      .find((event) => event.routeId === "home"),
  };
});

const disabled = await withServer(false, async (server) => {
  const result = await postHome(fixture, "single", "line-accurate");
  await delay(100);
  assert.equal(server.events.length, 0, "disabled diagnostics must emit no events");
  return result.svg;
});

assert.equal(
  enabled.firstSingleSvg,
  disabled,
  "diagnostics must not alter deterministic conversion output",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      fixture: "tests/fixtures/IMG_8487.PNG",
      enabled: {
        eventCount: enabled.eventCount,
        correlationCount: enabled.correlationCount,
        checkpoints: enabled.checkpoints,
        routes: enabled.routes,
        maxRssBytes: enabled.maxRssBytes,
        finalHomeMemory: enabled.finalHomeEvent
          ? {
              rssBytes: enabled.finalHomeEvent.rssBytes,
              heapUsedBytes: enabled.finalHomeEvent.heapUsedBytes,
              externalBytes: enabled.finalHomeEvent.externalBytes,
              arrayBufferBytes: enabled.finalHomeEvent.arrayBufferBytes,
              unclassifiedProcessBytes:
                enabled.finalHomeEvent.unclassifiedProcessBytes,
            }
          : null,
      },
      disabledEventCount: 0,
      outputParity: true,
      scenarios: [
        "single Potrace",
        "layered trace",
        "Base64 single trace",
        "two repeated sequential traces",
        "two concurrent traces",
        "Base64 dimension error",
        "post-idle trace",
      ],
    },
    null,
    2,
  ),
);

async function withServer(diagnosticsEnabled, run) {
  const events = [];
  const logLines = [];
  let captureError = null;
  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      ILOVESVG_MEMORY_DIAGNOSTICS: diagnosticsEnabled ? "1" : "0",
      ILOVESVG_MEMORY_DIAGNOSTICS_SAMPLE_RATE: "1",
      ILOVESVG_MEMORY_DIAGNOSTICS_ROUTES: [
        "home",
        "base64-to-svg",
        "shared-raster-normalize",
        "shared-potrace",
        "shared-layered-trace",
      ].join(","),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const consume = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (!line) continue;
      if (logLines.length < MAX_CAPTURED_LOG_LINES) logLines.push(line);
      try {
        const event = JSON.parse(line);
        if (event?.event !== "ilovesvg-memory-diagnostic") continue;
        if (events.length >= MAX_CAPTURED_EVENTS) {
          captureError ??= new Error(
            "Diagnostic event capture exceeded its safety bound.",
          );
          continue;
        }
        events.push(event);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        captureError ??= error;
      }
    }
  };
  child.stdout.on("data", consume);
  child.stderr.on("data", consume);

  try {
    await waitForServer(child, logLines);
    const result = await run({ child, events, logLines });
    if (captureError) throw captureError;
    return result;
  } finally {
    await stopChild(child);
  }
}

async function stopChild(child) {
  if (child.exitCode != null || child.signalCode != null) return;

  const gracefulExit = once(child, "exit");
  child.kill();
  const exitedGracefully = await Promise.race([
    gracefulExit.then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (exitedGracefully || child.exitCode != null || child.signalCode != null) {
    return;
  }

  const forcedExit = once(child, "exit");
  child.kill("SIGKILL");
  const exitedForcibly = await Promise.race([
    forcedExit.then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (
    !exitedForcibly &&
    child.exitCode == null &&
    child.signalCode == null
  ) {
    throw new Error("Diagnostic server did not exit after forced termination.");
  }
}

async function waitForServer(child, logLines) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(
        `Diagnostic server exited early (${child.exitCode}): ${logLines.slice(-8).join("\n")}`,
      );
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function postHome(buffer, traceMode, presetId) {
  const form = new FormData();
  form.append("file", new File([buffer], "fixture.png", { type: "image/png" }));
  form.append("traceMode", traceMode);
  form.append("presetId", presetId);
  form.append("threshold", "224");
  form.append("turdSize", "2");
  form.append("optTolerance", "0.28");
  form.append("turnPolicy", "minority");
  form.append("transparent", "true");
  form.append("preprocess", "none");
  form.append("colorLayerCount", "4");
  form.append("requestedPaletteCount", "4");
  form.append("layeredQualityTier", "default");
  form.append("clientRunId", `diagnostic-${traceMode}-${Date.now()}`);

  const routePath = "/_root.data?index";
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: { Origin: baseUrl, Referer: `${baseUrl}${routePath}` },
    body: form,
  });
  const text = await response.text();
  const svg = extractPayloadString(text, "svg");
  assert.equal(
    response.ok,
    true,
    JSON.stringify({ status: response.status, body: text.slice(0, 240) }),
  );
  assert.match(svg, /<svg\b/i, text.slice(0, 500));
  return { response, text, svg };
}

async function postBase64(buffer, rasterMode, expectSuccess = true) {
  const routePath = "/base64-to-svg.data";
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Referer: `${baseUrl}${routePath}`,
    },
    body: JSON.stringify({
      rasterDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      rasterMode,
      transparent: true,
      bgColor: "#ffffff",
      presetId: rasterMode === "single" ? "line-accurate" : "layered-flat-color",
      layerCount: 4,
      maxTraceSide: 900,
    }),
  });
  const text = await response.text();
  const svg = extractPayloadString(text, "svg");
  if (expectSuccess) {
    assert.equal(
      response.ok,
      true,
      JSON.stringify({ status: response.status, body: text.slice(0, 240) }),
    );
    assert.match(svg, /<svg\b/i, text.slice(0, 500));
  }
  return { response, text, svg };
}

function extractPayloadString(text, key) {
  const source = String(text || "");
  try {
    const table = JSON.parse(source);
    if (Array.isArray(table)) {
      const encodedKey = `_${table.findIndex((value) => value === key)}`;
      for (const value of table) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        if (!Object.hasOwn(value, encodedKey)) continue;
        const reference = value[encodedKey];
        if (typeof reference === "number" && typeof table[reference] === "string") {
          return table[reference];
        }
      }
      const decoded = decodeReactRouterPayload(table[0], table);
      const value = findPayloadValue(decoded, key);
      if (typeof value === "string") return value;
    }
  } catch {}
  try {
    const parsed = JSON.parse(source);
    const value = findPayloadValue(parsed, key);
    if (typeof value === "string") return value;
  } catch {}
  return "";
}

function decodeReactRouterPayload(value, table) {
  if (typeof value === "number") return decodeReactRouterPayload(table[value], table);
  if (Array.isArray(value)) {
    return value.map((item) => decodeReactRouterPayload(item, table));
  }
  if (!value || typeof value !== "object") return value;
  const decoded = {};
  for (const [encodedKey, encodedValue] of Object.entries(value)) {
    const key = encodedKey.startsWith("_")
      ? table[Number(encodedKey.slice(1))]
      : encodedKey;
    decoded[key] = decodeReactRouterPayload(encodedValue, table);
  }
  return decoded;
}

function findPayloadValue(value, key) {
  if (!value || typeof value !== "object") return "";
  if (Object.hasOwn(value, key)) return value[key];
  for (const child of Object.values(value)) {
    const found = findPayloadValue(child, key);
    if (found !== "") return found;
  }
  return "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
