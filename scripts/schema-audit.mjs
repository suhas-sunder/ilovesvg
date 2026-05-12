const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const TARGET_ROUTES = [
  "/svg-preview-viewer",
  "/svg-accessibility-and-contrast-checker",
  "/emoji-to-svg-converter",
  "/free-color-picker",
];

const failures = [];
const results = [];

for (const path of TARGET_ROUTES) {
  const url = new URL(path, BASE_URL);
  const response = await fetch(url, { redirect: "manual" });
  const html = await response.text();
  const visibleText = normalizeVisibleText(html);
  const jsonLdBlocks = collectJsonLdBlocks(html);
  const faqPages = jsonLdBlocks.flatMap((block) => block.faqPages);
  const parseErrors = jsonLdBlocks.flatMap((block) => block.parseErrors);
  const faqPageMicrodataCount = countFaqPageMicrodata(html);
  const faqQuestions = faqPages.flatMap((faqPage) => collectFaqQuestions(faqPage));
  const duplicateQuestions = duplicateValues(faqQuestions.map((item) => item.name));
  const missingQuestions = faqQuestions
    .map((item) => item.name)
    .filter((question) => !visibleText.includes(normalizeText(question)));

  results.push({
    path,
    status: response.status,
    jsonLdScriptCount: jsonLdBlocks.length,
    faqPageJsonLdCount: faqPages.length,
    faqPageMicrodataCount,
    faqPageStructuredDataCount: faqPages.length + faqPageMicrodataCount,
    faqQuestionCount: faqQuestions.length,
    duplicateQuestions,
    missingQuestions,
    parseErrorCount: parseErrors.length,
  });

  if (response.status !== 200) {
    failures.push(`${path} expected HTTP 200, received ${response.status}`);
  }

  for (const error of parseErrors) {
    failures.push(`${path} has invalid JSON-LD: ${error}`);
  }

  if (faqPages.length !== 1) {
    failures.push(`${path} expected exactly one FAQPage JSON-LD object, found ${faqPages.length}`);
  }

  if (faqPages.length + faqPageMicrodataCount > 1) {
    failures.push(
      `${path} renders duplicate FAQPage structured data sources: ${faqPages.length} JSON-LD and ${faqPageMicrodataCount} microdata`,
    );
  }

  for (const faqPage of faqPages) {
    const mainEntity = Array.isArray(faqPage.mainEntity) ? faqPage.mainEntity : [];
    if (!mainEntity.length) {
      failures.push(`${path} FAQPage JSON-LD is missing mainEntity questions`);
    }

    for (const question of mainEntity) {
      const name = typeof question?.name === "string" ? question.name.trim() : "";
      const answer = extractAnswerText(question);
      if (!name) {
        failures.push(`${path} FAQPage question is missing name`);
      }
      if (!answer) {
        failures.push(`${path} FAQPage question "${name || "(missing name)"}" is missing acceptedAnswer.text`);
      }
    }
  }

  for (const question of duplicateQuestions) {
    failures.push(`${path} repeats FAQPage question "${question}"`);
  }

  for (const question of missingQuestions) {
    failures.push(`${path} FAQPage question is not visible on the page: "${question}"`);
  }

  if (path === "/free-color-picker") {
    const visibleQuestions = visibleFaqQuestions(html);
    const schemaQuestions = faqQuestions.map((item) => item.name);
    if (!sameStringList(schemaQuestions, visibleQuestions)) {
      failures.push(
        `${path} FAQPage questions do not match visible FAQ questions. schema=${JSON.stringify(schemaQuestions)} visible=${JSON.stringify(visibleQuestions)}`,
      );
    }
  }
}

console.log(
  JSON.stringify(
    {
      baseUrl: BASE_URL,
      checkedAt: new Date().toISOString(),
      routeCount: TARGET_ROUTES.length,
      results,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length) {
  process.exit(1);
}

function collectJsonLdBlocks(html) {
  return Array.from(
    html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ).map((match) => {
    const raw = decodeHtml(match[1] || "");
    const parseErrors = [];
    let faqPages = [];
    try {
      faqPages = collectFaqPages(JSON.parse(raw));
    } catch (error) {
      parseErrors.push(error instanceof Error ? error.message : String(error));
    }
    return { faqPages, parseErrors };
  });
}

function collectFaqPages(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectFaqPages(item));
  }

  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  const current = types.includes("FAQPage") ? [value] : [];
  return current.concat(Object.values(value).flatMap((item) => collectFaqPages(item)));
}

function collectFaqQuestions(faqPage) {
  const mainEntity = Array.isArray(faqPage.mainEntity) ? faqPage.mainEntity : [];
  return mainEntity
    .map((item) => ({
      name: typeof item?.name === "string" ? item.name.trim() : "",
      answer: extractAnswerText(item),
    }))
    .filter((item) => item.name);
}

function extractAnswerText(question) {
  const acceptedAnswer = question?.acceptedAnswer;
  const answer = Array.isArray(acceptedAnswer) ? acceptedAnswer[0] : acceptedAnswer;
  return typeof answer?.text === "string" ? answer.text.trim() : "";
}

function countFaqPageMicrodata(html) {
  return (html.match(/itemtype=["']https:\/\/schema\.org\/FAQPage["']/gi) || []).length;
}

function visibleFaqQuestions(html) {
  const sectionMatch = html.match(
    /<section\b[^>]*>[\s\S]*?<h3\b[^>]*>\s*Frequently asked questions\s*<\/h3>([\s\S]*?)<\/section>/i,
  );
  const source = sectionMatch?.[1] || html;
  return Array.from(source.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi))
    .map((match) => htmlToText(match[1]))
    .filter(Boolean);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const key = normalizeText(value);
    if (seen.has(key)) duplicates.add(value);
    seen.add(key);
  }
  return Array.from(duplicates);
}

function sameStringList(first, second) {
  if (first.length !== second.length) return false;
  return first.every((value, index) => normalizeText(value) === normalizeText(second[index]));
}

function normalizeVisibleText(html) {
  return normalizeText(
    decodeHtml(
      html
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function htmlToText(value) {
  return decodeHtml(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
