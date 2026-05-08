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
      title: result.title,
      canonical: result.canonical,
      h1Count: result.h1Count,
      faqJsonLdCount: result.faqJsonLdCount,
      breadcrumbJsonLdCount: result.breadcrumbJsonLdCount,
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
    const contentType = response.headers.get("content-type") || "";
    const htmlQuality =
      response.status >= 200 && response.status < 300 && contentType.includes("text/html")
        ? analyzeHtml(routeId, routePath, text)
        : null;
    const isExpectedRedirect =
      redirectRouteIds.has(routeId) &&
      response.status >= 300 &&
      response.status < 400 &&
      Boolean(response.headers.get("location"));
    const ok =
      isExpectedRedirect ||
      (response.status >= 200 &&
        response.status < 300 &&
        text.length > 128 &&
        (!htmlQuality || htmlQuality.errors.length === 0));
    return {
      path: routePath,
      status: response.status,
      bytes: Buffer.byteLength(text),
      title: htmlQuality?.title || null,
      canonical: htmlQuality?.canonical || null,
      h1Count: htmlQuality?.h1Count ?? null,
      faqJsonLdCount: htmlQuality?.faqJsonLdCount ?? null,
      breadcrumbJsonLdCount: htmlQuality?.breadcrumbJsonLdCount ?? null,
      ok,
      error: ok
        ? null
        : htmlQuality?.errors.length
          ? htmlQuality.errors.join("; ")
          : `Unexpected status/body (${response.status}, ${text.length} chars)`,
    };
  } catch (error) {
    return {
      path: routePath,
      status: null,
      bytes: 0,
      title: null,
      canonical: null,
      h1Count: null,
      faqJsonLdCount: null,
      breadcrumbJsonLdCount: null,
      ok: false,
      error: error instanceof Error ? error.message : "request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeHtml(routeId, routePath, html) {
  const title = firstMatch(html, /<title>([^<]+)<\/title>/i);
  const description = firstMetaContent(html, "description");
  const canonical = firstLinkHref(html, "canonical");
  const h1Count = [...html.matchAll(/<h1\b/gi)].length;
  const faqJsonLdCount = countJsonLdType(html, "FAQPage");
  const breadcrumbJsonLdCount = countJsonLdType(html, "BreadcrumbList");
  const expectedCanonical =
    routePath === "/" ? "https://www.ilovesvg.com" : `https://www.ilovesvg.com${routePath}`;
  const errors = [];

  if (!title?.trim()) {
    errors.push(`${routeId} missing title`);
  }

  if (!description?.trim()) {
    errors.push(`${routeId} missing meta description`);
  }

  if (!canonical?.trim()) {
    errors.push(`${routeId} missing canonical`);
  } else if (canonical !== expectedCanonical) {
    errors.push(`${routeId} canonical ${canonical} does not match ${expectedCanonical}`);
  }

  if (h1Count !== 1) {
    errors.push(`${routeId} expected exactly one H1 but found ${h1Count}`);
  }

  if (faqJsonLdCount > 1) {
    errors.push(`${routeId} has ${faqJsonLdCount} FAQPage JSON-LD blocks`);
  }

  if (breadcrumbJsonLdCount > 1) {
    errors.push(`${routeId} has ${breadcrumbJsonLdCount} BreadcrumbList JSON-LD blocks`);
  }

  return {
    title,
    description,
    canonical,
    h1Count,
    faqJsonLdCount,
    breadcrumbJsonLdCount,
    errors,
  };
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1] || null;
}

function firstMetaContent(html, name) {
  const tag = firstTagWithAttribute(html, "meta", "name", name);
  return tag ? firstAttributeValue(tag, "content") : null;
}

function firstLinkHref(html, rel) {
  const tag = firstTagWithAttribute(html, "link", "rel", rel);
  return tag ? firstAttributeValue(tag, "href") : null;
}

function firstTagWithAttribute(html, tagName, attributeName, expectedValue) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) || [];
  return (
    tags.find((tag) => firstAttributeValue(tag, attributeName)?.toLowerCase() === expectedValue) ||
    null
  );
}

function firstAttributeValue(tag, attributeName) {
  const match = tag.match(new RegExp(`${attributeName}=["']([^"']+)["']`, "i"));
  return match?.[1] || null;
}

function countJsonLdType(html, type) {
  const scripts =
    html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ||
    [];
  return scripts.reduce((count, script) => {
    const needle = new RegExp(`"@type"\\s*:\\s*"${type}"`, "g");
    return count + [...script.matchAll(needle)].length;
  }, 0);
}
