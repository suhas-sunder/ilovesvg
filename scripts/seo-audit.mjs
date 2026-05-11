import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const timeoutMs = Number(process.env.SEO_AUDIT_TIMEOUT_MS || 10_000);
const maxDescriptionLength = 170;
const maxTitleLength = 70;

const selectedRoutes = [
  {
    path: "/",
    label: "home",
    mustNotIncludeTitle: ["PNG to SVG Converter"],
    bodyTerms: ["image to svg", "editable svg"],
  },
  {
    path: "/png-to-svg-converter",
    label: "png-to-svg",
    bodyTerms: ["png", "transparent", "svg"],
  },
  {
    path: "/jpg-to-svg-converter",
    label: "jpg-to-svg",
    bodyTerms: ["jpg", "photo", "svg"],
  },
  {
    path: "/jpeg-to-svg-converter",
    label: "jpeg-to-svg",
    bodyTerms: ["jpeg", "svg"],
  },
  {
    path: "/webp-to-svg-converter",
    label: "webp-to-svg",
    bodyTerms: ["webp", "svg"],
  },
  {
    path: "/svg-to-png-converter",
    label: "svg-to-png",
    bodyTerms: ["svg", "png", "transparent"],
  },
  {
    path: "/svg-to-jpg-converter",
    label: "svg-to-jpg",
    bodyTerms: ["svg", "jpg", "background"],
  },
  {
    path: "/svg-to-pdf-converter",
    label: "svg-to-pdf",
    bodyTerms: ["svg", "pdf", "print"],
  },
  {
    path: "/svg-to-favicon-generator",
    label: "svg-to-favicon",
    bodyTerms: ["favicon.ico", "png icon"],
  },
  {
    path: "/svg-to-ico-converter",
    label: "svg-to-ico",
    bodyTerms: ["favicon.ico", "svg"],
  },
  {
    path: "/png-to-favicon-generator",
    label: "png-to-favicon",
    bodyTerms: ["favicon.ico", "png"],
  },
  {
    path: "/png-to-ico-converter",
    label: "png-to-ico",
    bodyTerms: ["favicon.ico", "png"],
  },
  {
    path: "/jpg-to-favicon-generator",
    label: "jpg-to-favicon",
    bodyTerms: ["favicon.ico", "jpg"],
  },
  {
    path: "/image-to-favicon-generator",
    label: "image-to-favicon",
    bodyTerms: ["favicon.ico", "image"],
  },
  {
    path: "/logo-to-favicon-generator",
    label: "logo-to-favicon",
    bodyTerms: ["favicon.ico", "logo"],
  },
];

const results = [];
const failures = [];

for (const route of selectedRoutes) {
  const result = await fetchRoute(route);
  results.push(result);
  failures.push(...result.errors);
}

checkUnique("title");
checkUnique("description");
checkHomepageIntentSeparation();

console.log(
  JSON.stringify(
    {
      baseUrl,
      checkedAt: new Date().toISOString(),
      routeCount: selectedRoutes.length,
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

async function fetchRoute(route) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(route.path, baseUrl);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    const html = await response.text();
    const title = decodeHtml(firstMatch(html, /<title>([^<]+)<\/title>/i) || "");
    const description = decodeHtml(firstMetaContent(html, "description") || "");
    const canonical = firstLinkHref(html, "canonical") || "";
    const h1Count = [...html.matchAll(/<h1\b/gi)].length;
    const bodyText = visibleText(html);
    const errors = [];

    if (response.status !== 200) {
      errors.push(`${route.path} returned ${response.status}`);
    }

    if (!title) {
      errors.push(`${route.path} is missing a title`);
    } else if (title.length > maxTitleLength) {
      errors.push(`${route.path} title is ${title.length} chars, expected <= ${maxTitleLength}`);
    }

    if (!description) {
      errors.push(`${route.path} is missing a meta description`);
    } else if (description.length > maxDescriptionLength) {
      errors.push(
        `${route.path} description is ${description.length} chars, expected <= ${maxDescriptionLength}`,
      );
    }

    const expectedCanonical =
      route.path === "/" ? "https://www.ilovesvg.com" : `https://www.ilovesvg.com${route.path}`;
    if (canonical !== expectedCanonical) {
      errors.push(`${route.path} canonical ${canonical || "(missing)"} does not match ${expectedCanonical}`);
    }

    if (h1Count !== 1) {
      errors.push(`${route.path} expected one H1, found ${h1Count}`);
    }

    for (const forbidden of route.mustNotIncludeTitle || []) {
      if (title.toLowerCase().includes(forbidden.toLowerCase())) {
        errors.push(`${route.path} title should not include "${forbidden}"`);
      }
    }

    for (const term of route.bodyTerms || []) {
      if (!bodyText.includes(term.toLowerCase())) {
        errors.push(`${route.path} body text should include "${term}"`);
      }
    }

    return {
      path: route.path,
      label: route.label,
      status: response.status,
      title,
      titleLength: title.length,
      description,
      descriptionLength: description.length,
      canonical,
      h1Count,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      path: route.path,
      label: route.label,
      status: null,
      title: "",
      titleLength: 0,
      description: "",
      descriptionLength: 0,
      canonical: "",
      h1Count: 0,
      errors: [`${route.path} failed to fetch: ${message}`],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function checkUnique(field) {
  const seen = new Map();
  for (const result of results) {
    const value = result[field]?.trim();
    if (!value) continue;
    if (seen.has(value)) {
      failures.push(`${result.path} and ${seen.get(value)} share the same ${field}`);
    } else {
      seen.set(value, result.path);
    }
  }
}

function checkHomepageIntentSeparation() {
  const home = results.find((result) => result.path === "/");
  const png = results.find((result) => result.path === "/png-to-svg-converter");
  if (!home || !png) return;

  if (home.title === png.title) {
    failures.push("Homepage and PNG to SVG route have identical titles");
  }

  if (home.description === png.description) {
    failures.push("Homepage and PNG to SVG route have identical descriptions");
  }
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
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

function visibleText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).toLowerCase();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
