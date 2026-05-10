import fs from "node:fs";

const serverSource = fs.readFileSync("server.js", "utf8");

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(
  serverSource.includes("ILOVESVG_ACCESS_LOGS"),
  "production access logging must be gated by ILOVESVG_ACCESS_LOGS",
);

assert(
  !/morgan\(\s*["']tiny["']\s*\)/.test(serverSource),
  "production server must not use morgan tiny because it logs full URLs",
);

assert(
  !/morgan\([^)]*["'].*:url/.test(serverSource),
  "morgan formats must not include :url because it can include query strings",
);

assert(
  /new URL\([^)]*\)\.pathname/.test(serverSource) ||
    /url\.pathname/.test(serverSource),
  "access logging must sanitize request URLs down to pathname only",
);

assert(
  /MAX_LOGGED_PATH_LENGTH|truncateLoggedPath|slice\(\s*0\s*,\s*\d+\s*\)/.test(
    serverSource,
  ),
  "access logging must truncate long paths",
);

assert(
  /statusCode\s*>=\s*500|res\.statusCode\s*>=\s*500/.test(serverSource),
  "unexpected 5xx responses must still have a safe logging path",
);

assert(
  /uncaughtException/.test(serverSource) && /unhandledRejection/.test(serverSource),
  "fatal process errors must still be logged",
);

const forbiddenRequestContentPatterns = [
  /req\.body/,
  /request\.body/,
  /req\.headers/,
  /request\.headers/,
  /req\.cookies/,
  /request\.cookies/,
];

for (const pattern of forbiddenRequestContentPatterns) {
  assert(
    !pattern.test(serverSource),
    `server logging must not read sensitive request content: ${pattern}`,
  );
}

if (failures.length) {
  console.error("[production-logging-audit] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[production-logging-audit] ok");
