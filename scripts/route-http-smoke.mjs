import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const timeoutMs = Number(process.env.ROUTE_SMOKE_TIMEOUT_MS || 10_000);

const routeFiles = (await fs.readdir(path.join(rootDir, "app", "routes")))
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => !file.startsWith("api."))
  .sort((a, b) => a.localeCompare(b));

const results = [];
const failures = [];
const redirectRouteIds = new Set([
  "black-and-white-png-to-svg-converter",
  "image-to-svg-converter",
  "svg-code-cleaner",
  "svg-inline-code-generator",
  "svg-to-css-background",
  "svg-to-data-uri-converter",
  "svg-to-react-component",
  "svg-transparent-background-tool",
  "svg-viewbox-editor",
  "tif-to-svg-converter",
]);

for (const file of routeFiles) {
  const routeId = file.replace(/\.tsx$/, "");
  const candidates = routeCandidates(routeId);
  let result = null;

  for (const routePath of candidates) {
    result = await fetchRoute(routeId, routePath);
    if (result.ok) break;
  }

  results.push({
    routeId,
    path: result.path,
    status: result.status,
    bytes: result.bytes,
    ok: result.ok,
    error: result.error,
  });

  if (!result.ok) {
    failures.push(`${routeId} (${candidates.join(" or ")}): ${result.error || result.status}`);
  }
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      checkedAt: new Date().toISOString(),
      results,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exitCode = 1;
}

function routeCandidates(routeId) {
  if (routeId === "home") return ["/"];
  if (routeId === "sitemap") return ["/sitemap.xml", "/sitemap"];
  if (routeId.startsWith("how-it-works.")) {
    return [`/how-it-works/${routeId.replace("how-it-works.", "")}`];
  }
  return [`/${routeId}`];
}

async function fetchRoute(routeId, routePath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${routePath}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "ilovesvg-route-smoke/1.0" },
    });
    const text = await response.text();
    const isExpectedRedirect =
      redirectRouteIds.has(routeId) &&
      response.status >= 300 &&
      response.status < 400 &&
      Boolean(response.headers.get("location"));
    const ok =
      isExpectedRedirect ||
      (response.status >= 200 && response.status < 300 && text.length > 128);
    return {
      path: routePath,
      status: response.status,
      bytes: Buffer.byteLength(text),
      ok,
      error: ok ? null : `Unexpected status/body (${response.status}, ${text.length} chars)`,
    };
  } catch (error) {
    return {
      path: routePath,
      status: null,
      bytes: 0,
      ok: false,
      error: error instanceof Error ? error.message : "request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
