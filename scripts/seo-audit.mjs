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
    path: "/svg-cleaner",
    label: "svg-cleaner",
    bodyTerms: ["svg cleaner", "metadata", "comments", "when to use this instead of the minifier"],
    headingTerms: ["svg cleaner"],
  },
  {
    path: "/svg-cleaner-for-figma",
    label: "svg-cleaner-for-figma",
    bodyTerms: ["figma import", "editing workflow", "design handoff", "not guarantee editable layers"],
    headingTerms: ["figma"],
    forbiddenHeadingTerms: ["glowforge", "silhouette", "laser", "cutting", "engraving"],
  },
  {
    path: "/svg-cleaner-for-glowforge",
    label: "svg-cleaner-for-glowforge",
    bodyTerms: ["glowforge", "laser", "cutting", "engraving", "path review", "not laser-ready"],
    headingTerms: ["glowforge"],
    forbiddenHeadingTerms: ["figma", "silhouette", "vinyl", "design handoff"],
  },
  {
    path: "/svg-cleaner-for-silhouette",
    label: "svg-cleaner-for-silhouette",
    bodyTerms: ["silhouette studio", "cut path", "review before cutting", "not automatically cut-ready"],
    headingTerms: ["silhouette"],
    forbiddenHeadingTerms: ["figma", "glowforge", "laser", "engraving"],
  },
  {
    path: "/svg-resize-and-scale-editor",
    label: "svg-resize-and-scale-editor",
    bodyTerms: ["resize", "scale", "viewbox", "width", "height", "not a cleaner"],
    headingTerms: ["resize"],
  },
  {
    path: "/svg-minifier",
    label: "svg-minifier",
    bodyTerms: ["svg minifier", "file size", "markup", "not a resizer"],
    headingTerms: ["minify"],
  },
  {
    path: "/svg-file-size-inspector",
    label: "svg-file-size-inspector",
    bodyTerms: ["file size", "inspect", "cleanup opportunities", "inspection only"],
    headingTerms: ["size"],
  },
  {
    path: "/svg-dimensions-inspector",
    label: "svg-dimensions-inspector",
    bodyTerms: ["dimensions", "viewbox", "inspect", "apply fixes", "does not rewrite paths"],
    headingTerms: ["dimensions"],
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
  {
    path: "/png-to-svg-for-cricut",
    label: "png-to-svg-for-cricut",
    bodyTerms: ["cricut", "design space", "single-color", "inspect"],
    headingTerms: ["cricut"],
    forbiddenHeadingTerms: ["etsy", "shopify", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-cricut-print-then-cut",
    label: "png-to-svg-for-cricut-print-then-cut",
    bodyTerms: ["print then cut", "transparent png", "cut outline", "cut preview"],
    headingTerms: ["print then cut"],
    forbiddenHeadingTerms: ["etsy", "shopify", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-cricut-stickers",
    label: "png-to-svg-for-cricut-stickers",
    bodyTerms: ["sticker", "transparent png", "cut outline", "sticker sheets"],
    headingTerms: ["sticker"],
    forbiddenHeadingTerms: ["etsy", "shopify", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/sticker-to-svg-converter",
    label: "sticker-to-svg-converter",
    bodyTerms: ["sticker", "transparent png", "cuttable", "not cricut-only"],
    headingTerms: ["sticker"],
    forbiddenHeadingTerms: ["cricut", "etsy", "shopify", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/sticker-to-svg-for-cricut",
    label: "sticker-to-svg-for-cricut",
    bodyTerms: ["cricut design space", "sticker image", "print then cut", "review before cutting"],
    headingTerms: ["cricut", "sticker"],
    forbiddenHeadingTerms: ["etsy", "shopify", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/image-to-svg-for-silhouette",
    label: "image-to-svg-for-silhouette",
    bodyTerms: ["silhouette studio", "cut path", "review before cutting", "simple artwork"],
    headingTerms: ["silhouette"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/logo-to-svg-for-silhouette",
    label: "logo-to-svg-for-silhouette",
    bodyTerms: ["silhouette studio", "cut-friendly", "vinyl", "review before cutting"],
    headingTerms: ["silhouette", "logo"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "laser", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/sticker-to-svg-for-silhouette",
    label: "sticker-to-svg-for-silhouette",
    bodyTerms: ["silhouette studio", "sticker", "cut lines", "review before cutting"],
    headingTerms: ["silhouette", "sticker"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-silhouette",
    label: "png-to-svg-for-silhouette",
    bodyTerms: ["silhouette studio", "starting point", "cut lines", "review before cutting"],
    headingTerms: ["silhouette"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "laser", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/jpg-to-svg-for-silhouette",
    label: "jpg-to-svg-for-silhouette",
    bodyTerms: ["silhouette studio", "jpg compression", "cut paths", "review before cutting"],
    headingTerms: ["silhouette"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "laser", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/image-to-svg-for-glowforge",
    label: "image-to-svg-for-glowforge",
    bodyTerms: ["glowforge", "laser cutting", "engraving", "path complexity", "review before laser use"],
    headingTerms: ["glowforge"],
    forbiddenHeadingTerms: ["cricut", "silhouette", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/logo-to-svg-for-glowforge",
    label: "logo-to-svg-for-glowforge",
    bodyTerms: ["glowforge", "laser", "engraving", "inspect complexity"],
    headingTerms: ["glowforge", "logo"],
    forbiddenHeadingTerms: ["cricut", "silhouette", "vinyl", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-glowforge",
    label: "png-to-svg-for-glowforge",
    bodyTerms: ["glowforge", "laser cutting", "engraving", "path complexity", "not every png"],
    headingTerms: ["glowforge"],
    forbiddenHeadingTerms: ["cricut", "silhouette", "vinyl", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/jpg-to-svg-for-glowforge",
    label: "jpg-to-svg-for-glowforge",
    bodyTerms: ["glowforge", "jpg compression", "laser", "engraving", "path complexity"],
    headingTerms: ["glowforge"],
    forbiddenHeadingTerms: ["cricut", "silhouette", "vinyl", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-laser-cutting",
    label: "png-to-svg-for-laser-cutting",
    bodyTerms: ["laser cutting", "engraving", "path review", "not every png"],
    headingTerms: ["laser"],
    forbiddenHeadingTerms: ["cricut", "silhouette", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-cricut-vinyl",
    label: "png-to-svg-for-cricut-vinyl",
    bodyTerms: ["cricut design space", "vinyl decal", "weed", "single-color"],
    headingTerms: ["cricut", "vinyl"],
    forbiddenHeadingTerms: ["glowforge", "silhouette", "laser", "etsy", "shopify", "printify", "printful"],
  },
  {
    path: "/image-to-svg-for-etsy",
    label: "image-to-svg-for-etsy",
    bodyTerms: ["etsy", "seller", "listing", "review before publishing"],
    headingTerms: ["etsy"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "silhouette", "shopify", "printify", "printful"],
  },
  {
    path: "/logo-to-svg-for-etsy",
    label: "logo-to-svg-for-etsy",
    bodyTerms: ["etsy", "seller", "listing", "shop branding"],
    headingTerms: ["etsy", "logo"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "silhouette", "shopify", "printify", "printful"],
  },
  {
    path: "/sticker-to-svg-for-etsy",
    label: "sticker-to-svg-for-etsy",
    bodyTerms: ["etsy", "seller", "sticker", "review before publishing"],
    headingTerms: ["etsy", "sticker"],
    forbiddenHeadingTerms: ["cricut", "glowforge", "silhouette", "shopify", "printify", "printful"],
  },
  {
    path: "/png-to-svg-for-shopify",
    label: "png-to-svg-for-shopify",
    bodyTerms: ["shopify", "storefront", "theme", "transparent png"],
    headingTerms: ["shopify"],
    forbiddenHeadingTerms: ["etsy", "cricut", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/logo-to-svg-for-shopify",
    label: "logo-to-svg-for-shopify",
    bodyTerms: ["shopify", "storefront", "theme", "logo", "icon"],
    headingTerms: ["shopify", "logo"],
    forbiddenHeadingTerms: ["etsy", "cricut", "glowforge", "silhouette", "printify", "printful"],
  },
  {
    path: "/svg-to-png-for-printify",
    label: "svg-to-png-for-printify",
    bodyTerms: ["printify", "print-on-demand", "transparent png", "product artwork"],
    headingTerms: ["printify", "print-on-demand"],
    forbiddenHeadingTerms: ["etsy", "shopify", "cricut", "glowforge", "silhouette", "printful"],
  },
  {
    path: "/svg-to-png-for-printful",
    label: "svg-to-png-for-printful",
    bodyTerms: ["printful", "print-on-demand", "transparent png", "product artwork"],
    headingTerms: ["printful", "print-on-demand"],
    forbiddenHeadingTerms: ["etsy", "shopify", "cricut", "glowforge", "silhouette", "printify"],
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
checkDistinctH1("/sticker-to-svg-converter", "/sticker-to-svg-for-cricut");
checkNoDuplicateFaqPageJsonLd([
  "/svg-cleaner-for-figma",
  "/svg-cleaner-for-glowforge",
  "/svg-cleaner-for-silhouette",
]);

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
    const h1 = firstHeading(html, 1) || "";
    const h1Count = [...html.matchAll(/<h1\b/gi)].length;
    const bodyText = visibleText(html);
    const headings = headingText(html);
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

    for (const term of route.headingTerms || []) {
      if (!headings.includes(term.toLowerCase())) {
        errors.push(`${route.path} headings should include "${term}"`);
      }
    }

    for (const forbidden of route.forbiddenHeadingTerms || []) {
      if (headings.includes(forbidden.toLowerCase())) {
        errors.push(`${route.path} headings should not include wrong-platform term "${forbidden}"`);
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
      h1,
      h1Count,
      faqPageJsonLdSignatures: faqPageJsonLdSignatures(html),
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
      h1: "",
      h1Count: 0,
      faqPageJsonLdSignatures: [],
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

function checkDistinctH1(firstPath, secondPath) {
  const first = results.find((result) => result.path === firstPath);
  const second = results.find((result) => result.path === secondPath);
  if (!first || !second || !first.h1 || !second.h1) return;

  if (first.h1.trim().toLowerCase() === second.h1.trim().toLowerCase()) {
    failures.push(`${firstPath} and ${secondPath} share the same H1`);
  }
}

function checkNoDuplicateFaqPageJsonLd(paths) {
  const signatures = new Map();
  for (const path of paths) {
    const result = results.find((item) => item.path === path);
    if (!result) continue;

    for (const signature of result.faqPageJsonLdSignatures || []) {
      if (signatures.has(signature)) {
        failures.push(`${path} and ${signatures.get(signature)} share duplicate FAQPage JSON-LD`);
      } else {
        signatures.set(signature, path);
      }
    }
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

function firstHeading(html, level) {
  const match = html.match(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "i"));
  if (!match) return null;

  return decodeHtml(
    match[1]
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
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

function headingText(html) {
  const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((match) =>
    decodeHtml(
      match[1]
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );
  const relatedIndex = headings.findIndex((heading) => heading.toLowerCase() === "related tools");
  const primaryHeadings = relatedIndex >= 0 ? headings.slice(0, relatedIndex) : headings;

  return decodeHtml(
    primaryHeadings.join(" "),
  ).toLowerCase();
}

function faqPageJsonLdSignatures(html) {
  const scripts = Array.from(
    html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  );

  return scripts.flatMap((match) => {
    const raw = decodeHtml(match[1] || "");
    try {
      const parsed = JSON.parse(raw);
      return collectFaqPageJsonLd(parsed).map((item) => stableJsonStringify(item));
    } catch {
      return [];
    }
  });
}

function collectFaqPageJsonLd(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectFaqPageJsonLd(item));
  }

  const type = value["@type"];
  if (type === "FAQPage" || (Array.isArray(type) && type.includes("FAQPage"))) {
    return [value];
  }

  return Object.values(value).flatMap((item) => collectFaqPageJsonLd(item));
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
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
