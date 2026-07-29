import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const workflow = await readFile(
  path.join(root, ".github", "workflows", "repository-validation.yml"),
  "utf8",
);
const ciAudit = await readFile(path.join(root, "scripts", "ci-audit.mjs"), "utf8");

const requiredScripts = [
  "test:ci",
  "test:warning-translation",
  "test:server-fallback-lifecycle",
  "test:server-fallback-correlation",
  "test:client-lifecycle",
  "test:memory-diagnostics",
  "test:bounded-store",
  "test:public-content",
  "test:preset-identity",
  "test:route-coverage",
  "test:schema",
  "test:seo",
  "test:navigation",
  "test:svg-to-png-preservation",
  "typecheck",
  "build",
  "test",
];

for (const scriptName of requiredScripts) {
  assert.equal(
    typeof packageJson.scripts?.[scriptName],
    "string",
    `package.json must define ${scriptName}`,
  );
}

assert.equal(
  packageJson.scripts["test:ci"],
  "node scripts/ci-audit.mjs",
  "test:ci must remain the authoritative repository audit",
);

for (const expected of [
  "pull_request:",
  "push:",
  "branches: [main]",
  "permissions:",
  "contents: read",
  "concurrency:",
  "cancel-in-progress: true",
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "node-version: 20",
  "cache: npm",
  "npm ci",
  "npm run typecheck",
  "npm run build",
  "npm run test:ci",
]) {
  assert.ok(workflow.includes(expected), `workflow must include ${expected}`);
}
assert.equal(
  (workflow.match(/branches: \[main\]/g) || []).length,
  2,
  "workflow must target main for both pull requests and pushes",
);

for (const forbidden of [
  "continue-on-error",
  "secrets.",
  "deploy",
  "upload-artifact",
  "download-artifact",
  "pull_request_target",
]) {
  assert.ok(
    !workflow.toLowerCase().includes(forbidden.toLowerCase()),
    `workflow must not include ${forbidden}`,
  );
}

const actionReferences = [
  ...workflow.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gm),
].map((match) => match[1]);
assert.deepEqual(actionReferences, ["actions/checkout@v4", "actions/setup-node@v4"]);

assert.ok(
  workflow.includes("ILOVESVG_CI_TYPECHECKED: \"1\"") &&
    workflow.includes("ILOVESVG_CI_BUILT: \"1\""),
  "workflow must tell test:ci not to duplicate typecheck or build",
);
for (const expected of [
  '"Existing npm test suite"',
  '"Public trace presentation"',
  '"Server fallback lifecycle"',
  '"Server fallback response correlation"',
  '"Client lifecycle"',
  '"Public content and schema remediation"',
  '"Preset identity"',
  '"Route coverage"',
  '"Schema"',
  '"SEO"',
  '"Navigation source"',
  '"SVG-to-PNG preservation"',
  'SVG_TO_PNG_PRESERVATION_SKIP_BROWSER: "1"',
]) {
  assert.ok(ciAudit.includes(expected), `CI aggregate must include ${expected}`);
}

assert.ok(
  !/[A-Za-z]:[\\/](?:Users|Documents|Desktop)[\\/]/.test(workflow),
  "workflow must not contain a personal absolute path",
);

console.log(
  "CI configuration audit passed: required commands, main triggers, minimal permissions, official actions, deduplicated build gates, and no secrets or deployment",
);
