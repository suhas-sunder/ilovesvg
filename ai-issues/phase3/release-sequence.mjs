import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const [worktreeArgument, outputArgument, npmCli, portArgument = "3188", replayPlan] = process.argv.slice(2);
assert.ok(worktreeArgument && outputArgument, "Pass a disposable worktree and an output directory. Pass the npm CLI path to add build and SSR checks.");
const worktree = path.resolve(worktreeArgument);
const out = path.resolve(outputArgument);
assert.match(portArgument, /^\d+$/);
const baseUrl = `http://127.0.0.1:${portArgument}`;
const git = (...args) => execFileSync("git", ["-C", worktree, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
const source = (sha, file) => git("show", `${sha}:${file}`);
const filesBetween = (base, head) => git("diff", "--name-only", base, head).split("\n").filter(Boolean).sort();

const handoff = "71050b16805e9909171bcb0074d1209cf090df24";
const queue = JSON.parse(source(handoff, "ai-issues/seo/release-queue.json"));
const history = JSON.parse(source(handoff, "ai-issues/seo/release-history.json"));
assert.deepEqual(history.releases, []);
const { main, pr11, pr12 } = queue.foundation;
const prereqs = { A: 14, C: 17 };
const branches = ["release/2026-W46-ilovesvg-consolidated", "codex/ilovesvg-final-ui-ux-buildout"];
const verifiedCI = { 11: 42558626756, 12: 43440813136, 21: 43532158019 };
const originalDefinitions = [
  { id: "PR11", title: "Raster recovery and batch cancellation", pr: 11, branch: branches[0], base: main, head: pr11, dependencies: [] },
  { id: "PR12", title: "Conversion workflow and navigation polish", pr: 12, branch: branches[1], base: pr11, head: pr12, dependencies: ["PR11"] },
  ...queue.candidates.map((candidate) => ({
    id: candidate.id, title: candidate.intent, pr: Number(candidate.pullRequest.split("/").at(-1)), branch: candidate.branch,
    base: candidate.baseSha, head: candidate.reviewedSha, dependencies: candidate.dependencies,
    package: candidate.package, prerequisites: prereqs[candidate.package] ? [prereqs[candidate.package]] : [],
    rollback: candidate.rollbackReference, expectedFiles: candidate.allowedFiles, changes: candidate.changes,
  })),
];
const replacements = replayPlan ? JSON.parse(await readFile(replayPlan, "utf8")) : null;
function replayDefinition(definition) {
  const replacement = replacements[definition.id];
  assert.ok(replacement, `Missing replay transition ${definition.id}`);
  return { ...definition, base: replacement.base, head: replacement.head,
    explicitPrerequisiteFiles: replacement.prerequisiteFiles,
    expectedFiles: replacement.expectedFiles || definition.expectedFiles };
}
const definitions = replacements ? originalDefinitions.map(replayDefinition) : originalDefinitions;

const productChecks = {
  PR11: "Actual browser/server fallback, concurrent work limits, canceled batch, correct SVG and ZIP bytes",
  PR12: "Paste confirmation and discard, replacement ownership, keyboard and modal flow, mobile result and download",
  A: "Profile, country-independent identity, footer round-trip and cold ad exclusion",
  B: "Bad input, recovery fragment, corrected JPEG and actual SVG download in Chromium and WebKit",
  C: "Inspector workflow, six example pairs, file hashes and actual downloads in Chromium and WebKit",
  D: "Actual clean and recovered craft exports, with hole, island and bridge checks",
  E: "Background import, clear/replace, reopen and transparent/opaque export pixels",
  F: "Inline gradient/solid output, clipboard fallback, drag/drop, keyboard, and actual exports",
};

function indexable(sha) {
  const rows = [...source(sha, "app/data/routeManifest.ts").matchAll(/\{\s*path:\s*"([^"]+)"[^}]*?\bcanonicalPath:\s*"([^"]+)"[^}]*?\bindexable:\s*true\b[^}]*\}/g)];
  assert.ok(rows.length >= 125);
  return new Map(rows.map(([entry, url, canonical]) => [url, { canonical, source: entry }]));
}

function indexedSitemap(xml) {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname);
  assert.equal(new Set(urls).size, urls.length);
  return urls.sort();
}

function futureSourcePresent(head, text) {
  const result = spawnSync("git", ["-C", worktree, "grep", "-l", "-F", "-e", text, head, "--", "app", "public"], { encoding: "utf8" });
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  return result.status === 0;
}

function existingRouteModules(files, priorRoutes) {
  return files.filter((file) => file.startsWith("app/routes/") && file.endsWith(".tsx"))
    .map((file) => file === "app/routes/home.tsx" ? "/" : `/${file.slice(11, -4).replaceAll(".", "/")}`)
    .filter((url) => priorRoutes.has(url));
}

function command(file, args, log, env = process.env) {
  const result = spawnSync(file, args, { cwd: worktree, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  return writeFile(log, result.stdout + result.stderr).then(() => result.status);
}

async function ssr(definition, current, hasExamples, logDir) {
  assert.equal(git("status", "--porcelain"), "", "Disposable worktree must have a clean index and file tree");
  git("switch", "--detach", definition.head);
  const build = await command(process.execPath, [npmCli, "run", "build"], path.join(logDir, "build.log"));
  assert.equal(build, 0, `${definition.id} build failed`);
  const stream = createWriteStream(path.join(logDir, "server.log"));
  const listener = spawn(process.execPath, ["server.js"], {
    cwd: worktree, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, PORT: portArgument, NODE_ENV: "production" },
  });
  const exit = new Promise((resolve) => listener.once("close", resolve));
  listener.stdout.pipe(stream, { end: false });
  listener.stderr.pipe(stream, { end: false });
  try {
    const deadline = Date.now() + 15000;
    let ready = false;
    while (!ready && Date.now() < deadline && listener.exitCode === null) {
      ready = await fetch(baseUrl, { signal: AbortSignal.timeout(750) }).then((response) => response.ok, () => false);
      if (!ready) await delay(150);
    }
    assert.ok(ready && listener.exitCode === null, `${definition.id} server not ready`);
    const get = (url) => fetch(baseUrl + url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    const htmlSitemap = await (await get("/sitemap")).text();
    const xml = await (await get("/sitemap.xml")).text();
    assert.deepEqual(indexedSitemap(xml), [...current.keys()].sort());
    assert.equal(await (await get("/robots.txt")).text(), await readFile(path.join(worktree, "public/robots.txt"), "utf8"));
    for (const url of ["/author/suhas-sunder", "/svg-sprite-generator"]) {
      const response = await get(url);
      assert.equal(response.status, current.has(url) ? 200 : 404);
      assert.equal(htmlSitemap.includes(`href="${url}"`), current.has(url));
      if (current.has(url)) {
        assert.match(await response.text(), new RegExp(`<link[^>]+rel="canonical"[^>]+href="https://www.ilovesvg.com${url}"`));
      }
    }
    assert.equal((await get("/phase3-release-404-fixture")).status, 404);
    assert.equal((await get("/examples/output-inspection/manifest.json")).status, hasExamples ? 200 : 404);
    const checks = {};
    for (const test of ["test:routes", "test:seo", "test:schema", "test:docs", "test:route-coverage", "test:links"]) {
      checks[test] = await command(process.execPath, [npmCli, "run", test], path.join(logDir, test.replace(":", "-") + ".log"), { ...process.env, BASE_URL: baseUrl });
    }
    return checks;
  } finally {
    if (listener.exitCode === null) listener.kill();
    await exit;
    stream.end();
  }
}

await mkdir(out, { recursive: true });
const records = [];
let predecessor = main;
for (const [i, definition] of definitions.entries()) {
  const { id, base, head, pr, package: packageLetter } = definition;
  assert.equal(git("merge-base", predecessor, base), predecessor);
  assert.equal(git("merge-base", base, head), base);
  const prerequisiteFiles = filesBetween(predecessor, base);
  assert.deepEqual(prerequisiteFiles, definition.explicitPrerequisiteFiles ||
    (packageLetter === "A" ? ["scripts/route-http-smoke.mjs"] : packageLetter === "C" ? ["scripts/docs-audit.mjs"] : []));
  const files = filesBetween(base, head);
  if (definition.expectedFiles) assert.deepEqual(files, [...definition.expectedFiles].sort());
  assert.equal(git("merge-tree", "--write-tree", predecessor, head), git("rev-parse", `${head}^{tree}`));
  const before = indexable(predecessor);
  const after = indexable(head);
  const added = [...after.keys()].filter((url) => !before.has(url));
  assert.deepEqual(added, (definition.changes || []).filter((change) => change.kind === "new-page").map((change) => change.url));
  for (const [url, value] of before) assert.deepEqual(after.get(url), value, `Existing indexable manifest entry changed ${id} ${url}`);
  assert.deepEqual(indexedSitemap(source(head, "public/sitemap.xml")), [...after.keys()].sort());
  assert.equal(source(main, "public/robots.txt"), source(head, "public/robots.txt"));
  for (const url of ["/author/suhas-sunder", "/svg-sprite-generator"]) assert.equal(futureSourcePresent(head, url), after.has(url));
  const hasExamples = i >= 4;
  assert.equal(git("ls-tree", "-r", "--name-only", head, "public/examples/output-inspection").length > 0, hasExamples);
  const logDir = path.join(out, String(i + 1).padStart(2, "0"));
  await mkdir(logDir, { recursive: true });
  console.log(`${id} ${head} — ${before.size} → ${after.size} indexable, application review boundary ${files.length} paths`);
  const release = {
    releaseIdentifier: String(i + 1).padStart(2, "0"), queueId: id, packageTitle: definition.title, prNumber: pr,
    sourceBranch: definition.branch, reviewedHeadSha: head, expectedBaseSha: base, actualPredecessor: predecessor,
    dependencies: definition.dependencies, technicalPrerequisitePRs: definition.prerequisites || [], prerequisiteFiles,
    changedFileAllowlist: files, newIndexableUrls: added,
    modifiedExistingUrls: (definition.changes || []).filter((change) => change.kind === "existing-improvement").map((change) => change.url),
    changedExistingIndexableRouteModules: existingRouteModules(files, before),
    sourceIndexableCount: after.size, exactExistingManifest: true, sameRobots: true, futurePageOrAssetExposure: false,
    requiredCiChecks: ["Technical reliability release validation / node20-alpine", "Staged content boundary if installed"],
    originalHeadCiRun: verifiedCI[pr] || null,
    githubCiAppliesToSimulatedHead: Boolean(verifiedCI[pr]) && head === originalDefinitions[i].head,
    requiredBrowserChecks: productChecks[packageLetter || id],
    requiredSecurityChecks: packageLetter === "F" ? "SVG parser, output XML, references, replay privacy and render/resource budgets" : "Existing input, cancellation, native memory and conversion-action gates; scoped new surface review",
    requiredSeoChecks: "Exact reviewed diff, HTTP routes, metadata, schema, sitemap and robots, no later content",
    requiredAdChecks: "Mock lifecycle and ad overlap at release head; genuine-network evidence at production where relevant",
    rollbackSourceReference: predecessor, historicalReviewedRollbackReference: definition.rollback || predecessor,
    ownerApprovalState: packageLetter ? "NOT OWNER APPROVED" : "NO NEW PHASE 3 AUTHORIZATION", githubPublicationState: "DRAFT / UNMERGED",
    productionDeploymentState: "NOT DEPLOYED IN PHASE 3", productionVerificationState: "UNVERIFIED", nextEligibilityCondition: i === 0
      ? "Owner establishes main update behavior and verifies present runtime and rollback, separately resolves protected ad-policy handling and satisfies genuine ad-network verification before exact PR11 publication"
      : "Previous release verified in production, then exact replacement candidate reviewed and approved against that deployed source",
    localProductionBuildAndChecks: npmCli ? await ssr(definition, after, hasExamples, logDir) : null,
  };
  records.push(release);
  predecessor = head;
  await writeFile(path.join(out, "release-sequence-evidence.json"), JSON.stringify({
    kind: "proposal evidence only; operational queue stays in ai-issues/seo/release-queue.json and release-history.json",
    node: process.version, queueSnapshot: handoff, mainSnapshot: main, complete: records.length === definitions.length,
    originalHeadsOnly: !replacements, records,
  }, null, 2) + "\n");
}
