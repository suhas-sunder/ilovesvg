import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const root = path.resolve(import.meta.dirname, "..");
const routeDirectory = path.join(root, "app", "routes");
const baseUrl = getSmokeBaseUrl();
const correlationQueryKey = "__ilovesvg_trace_client_run_id";

const routePaths = [];
for (const entry of await readdir(routeDirectory)) {
  if (!entry.endsWith(".tsx")) continue;
  const source = await readFile(path.join(routeDirectory, entry), "utf8");
  if (!source.includes("useHybridTraceFetcher")) continue;
  routePaths.push(`/${entry.slice(0, -4)}`);
}
routePaths.sort();
assert.equal(routePaths.length, 38, "expected 38 hybrid fallback routes");

for (const [index, routePath] of routePaths.entries()) {
  const clientRunId = `correlation-${index + 1}`;
  const dataPath = `${routePath}.data`;
  const url = new URL(dataPath, baseUrl);
  url.searchParams.set(correlationQueryKey, clientRunId);
  const response = await fetch(url, {
    method: "POST",
    headers: { Origin: baseUrl, Referer: `${baseUrl}${routePath}` },
    body: new FormData(),
  });
  const contentType = response.headers.get("content-type") || "";
  assert.match(
    contentType,
    /\btext\/x-script\b/i,
    `${routePath} must return a structured React Router data response`,
  );
  const payloadTable = JSON.parse(await response.text());
  assert.ok(
    payloadTable.includes("clientRunId") &&
      payloadTable.includes(clientRunId),
    `${routePath} must return the exact submitted clientRunId`,
  );
  assert.ok(
    payloadTable.includes("traceResponseCorrelated") &&
      payloadTable.includes(true),
    `${routePath} must mark its internal correlated fallback response`,
  );
  assert.ok(
    payloadTable.includes("error"),
    `${routePath} must preserve its validation error`,
  );
}

const uncorrelatedResponse = await fetch(
  new URL("/png-to-svg-converter.data", baseUrl),
  {
    method: "POST",
    headers: {
      Origin: baseUrl,
      Referer: `${baseUrl}/png-to-svg-converter`,
    },
    body: new FormData(),
  },
);
const uncorrelatedPayload = await uncorrelatedResponse.text();
assert.equal(
  uncorrelatedPayload.includes("traceResponseCorrelated"),
  false,
  "ordinary action responses must not claim server-fallback correlation",
);

console.log(
  `server fallback response correlation passed: ${routePaths.length} production route actions returned exact IDs on structured validation failures`,
);
