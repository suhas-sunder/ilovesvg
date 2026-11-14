import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [integrationPath, trustedInstallationPath, outputPath] = process.argv.slice(2);
assert.ok(integrationPath && trustedInstallationPath && outputPath,
  "Pass an empty disposable worktree, the exact committed administrative extraction worktree, and output JSON path.");
const integration = path.resolve(integrationPath);
const installation = path.resolve(trustedInstallationPath);
const git = (...args) => execFileSync("git", ["-C", integration, ...args], { encoding: "utf8" }).trim();
const trustedGit = (...args) => execFileSync("git", ["-C", installation, ...args], { encoding: "utf8" }).trim();
const foundation = "78dda78994ea90e7b3a839725021bc316463434e";
const pr17Amendments = ["fd59c8056d68933cd2ba5fd3ff3d5669ec8933ce", "2a3e9df4d83dd32014d14dd7a00337750e682568"];
const handoff = "71050b16805e9909171bcb0074d1209cf090df24";
const originalQueue = JSON.parse(git("show", `${handoff}:ai-issues/seo/release-queue.json`));
const queue = JSON.parse(await readFile(path.join(installation, "ai-issues/seo/release-queue.json"), "utf8"));
const history = JSON.parse(await readFile(path.join(installation, "ai-issues/seo/release-history.json"), "utf8"));
const boundary = await import(pathToFileURL(path.join(installation, "scripts/content-release-boundary.mjs")).href);
const planner = await import(pathToFileURL(path.join(installation, "scripts/weekly-seo-plan.mjs")).href);

const initialAllowlist = [
  ".github/workflows/content-release-boundary.yml", ".github/workflows/weekly-seo-preparation.yml",
  "ai-issues/seo/draft-workflow-setup.md", "ai-issues/seo/release-history.json", "ai-issues/seo/release-queue.json",
  "scripts/content-release-boundary.mjs", "scripts/weekly-seo-pipeline-test.mjs", "scripts/weekly-seo-plan.mjs",
].sort();
const filesBetween = (base, head) => git("diff", "--name-only", base, head).split("\n").filter(Boolean).sort();
const tree = (ref) => git("rev-parse", `${ref}^{tree}`);
const applicationTree = (ref) => git("rev-parse", `${ref}:app`, `${ref}:public`, `${ref}:package.json`, `${ref}:server.js`);
const show = (revision, file) => git("show", `${revision}:${file}`);
const initialHead = trustedGit("rev-parse", "HEAD");
assert.equal(trustedGit("status", "--porcelain"), "");
assert.equal(git("status", "--porcelain"), "");
assert.equal(git("merge-base", foundation, initialHead), foundation);
assert.equal(git("merge-base", handoff, initialHead), foundation);
assert.deepEqual(filesBetween(foundation, initialHead), initialAllowlist);
assert.equal(applicationTree(initialHead), applicationTree(foundation));
assert.deepEqual(history.releases, []);
assert.deepEqual(queue.candidates, originalQueue.candidates);
assert.ok(queue.candidates.every((candidate) => !candidate.ownerApproved && !candidate.approvedForSchedule &&
  candidate.plannedWeek === null && candidate.actualPublicationDate === null && candidate.finalDeployedCommit === null));
assert.equal(planner.selectWeeklyCandidate(queue, history, new Date("2026-11-16T15:00:00Z")), null);
await runBoundary(installation, installation, null, true);

async function runBoundary(trusted, candidate, branch, shouldPass, expectedError) {
  const result = spawnSync(process.execPath, ["scripts/content-release-boundary.mjs"], {
    cwd: trusted,
    env: { ...process.env, CONTENT_ROOT: candidate, CONTENT_CANDIDATE_BRANCH: branch || "", SEO_CANDIDATE_ID: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, shouldPass ? 0 : 1, result.stdout + result.stderr);
  if (expectedError) assert.match(result.stderr, expectedError);
}

git("switch", "--detach", initialHead);
const records = [];
for (const candidate of queue.candidates) {
  const predecessor = git("rev-parse", "HEAD");
  const prerequisites = candidate.package === "A" ? [candidate.baseSha] :
    candidate.package === "C" ? [candidate.baseSha, ...pr17Amendments] : [];
  if (prerequisites.length) git("cherry-pick", "-x", ...prerequisites);
  const candidateBase = git("rev-parse", "HEAD");
  git("cherry-pick", "-x", candidate.reviewedSha);
  const candidateHead = git("rev-parse", "HEAD");
  assert.notEqual(candidateBase, candidate.baseSha);
  assert.notEqual(candidateHead, candidate.reviewedSha);
  assert.equal(git("merge-base", candidateBase, candidateHead), candidateBase);
  assert.equal(applicationTree(candidate.reviewedSha), applicationTree(candidateHead));
  assert.deepEqual(filesBetween(candidateBase, candidateHead), [...candidate.allowedFiles].sort());
  assert.equal(git("merge-tree", "--write-tree", predecessor, candidateHead), tree(candidateHead));
  assert.throws(() => boundary.assertAdministrativeBaseDrift(initialAllowlist), /rebase and re-review/);
  boundary.assertIndexableBudget(candidate, show(candidateBase, "app/data/routeManifest.ts"), show(candidateHead, "app/data/routeManifest.ts"));
  await runBoundary(installation, integration, candidate.branch, false, /not eligible/);
  records.push({
    id: candidate.id, originalBase: candidate.baseSha, originalHead: candidate.reviewedSha,
    gitReplayReviewedBase: candidateBase, gitReplayHead: candidateHead, gitReplayPredecessor: predecessor,
    prerequisiteFiles: filesBetween(predecessor, candidateBase), sameApplicationTreeAsHistoricalPackage: true,
    exactOriginalAllowlist: true, originalRefsRequireRevalidation: true,
    unapprovedCandidateGateRejected: true,
  });
}
const staged = await readFile(path.join(installation, "ai-issues/seo/release-history.json"), "utf8");
const replayed = await readFile(path.join(integration, "ai-issues/seo/release-history.json"), "utf8");
assert.equal(staged, replayed);
assert.deepEqual(JSON.parse(replayed).releases, []);
await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  kind: "local proof of replay only; no approval, scheduling, publication or production history",
  installationBase: foundation, installationHead: initialHead, administrativeInstallationPaths: initialAllowlist,
  records,
}, null, 2) + "\n");
console.log(`Replayed ${records.length} package diffs and both test prerequisites. Every unapproved package was rejected by the trusted boundary.`);
