import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dependencyRevisions, releaseWeek, selectWeeklyCandidate } from "./weekly-seo-plan.mjs";
import {
  assertAdministrativeBaseDrift, assertCandidateDiff, assertDependencyAncestry, assertIndexableBudget,
  assertNoStagedExposure, inheritedCandidateIds, selectBoundaryCandidate, walkProductionSources,
} from "./content-release-boundary.mjs";

const candidate = {
  id: "SVG-SEO-TEST", branch: "codex/seo/test", reviewedSha: "a".repeat(40), baseSha: "b".repeat(40),
  plannedWeek: "2026-11-16", ownerApproved: true, approvedForSchedule: true, dependencies: [],
  changes: [{ kind: "new-page", url: "/unpublished-test" }],
  validation: "passed", seoReview: "passed", outputReview: "passed", mobileReview: "passed", adSafetyReview: "passed",
  reviewEvidence: "ai-issues/releases/weekly/test.md", rollbackReference: "b".repeat(40), allowedFiles: ["app/routes/test.tsx"],
};
const queue = (item = candidate) => ({ version: 1, candidates: [item] });
const history = { version: 1, releases: [] };
const date = new Date("2026-11-16T15:00:00Z");
// Operator records below are in-memory fixtures and never written to the queue or history.
assert.equal(selectWeeklyCandidate(queue({ ...candidate, ownerApproved: false }), history, date), null);
const dependent = { ...candidate, dependencies: ["SVG-SEO-PREDECESSOR", "PR14"] };
assert.equal(selectWeeklyCandidate(queue(dependent), history, date), null);
const priorDeployment = { id: "SVG-SEO-PREDECESSOR", week: "2026-11-09", finalDeployedCommit: "c".repeat(40) };
const dependentQueue = { ...queue(dependent), technicalPrerequisites: { PR14: "d".repeat(40) } };
assert.equal(selectWeeklyCandidate(dependentQueue, { ...history, releases: [priorDeployment] }, date), null);
const verifiedHistory = { ...history, releases: [{ ...priorDeployment, productionVerified: true }] };
assert.equal(selectWeeklyCandidate(dependentQueue, verifiedHistory, date)?.id, candidate.id);
assert.throws(() => selectWeeklyCandidate(dependentQueue, {
  ...verifiedHistory, releases: [...verifiedHistory.releases, priorDeployment],
}, date), /multiple history records/);
const revisions = dependencyRevisions(dependent, dependentQueue, verifiedHistory);
assert.deepEqual(revisions, [priorDeployment.finalDeployedCommit, "d".repeat(40)]);
assert.throws(() => assertDependencyAncestry(dependent, revisions, (sha) => sha === "d".repeat(40)), /verified release dependency/);
assert.doesNotThrow(() => assertDependencyAncestry(dependent, revisions, (sha, descendant) => revisions.includes(sha) && descendant === dependent.baseSha));
assert.equal(selectWeeklyCandidate(queue(), history, new Date("2026-11-08T15:00:00Z")), null);
assert.equal(selectWeeklyCandidate(queue(), history, date)?.id, candidate.id);
assert.equal(selectWeeklyCandidate(queue({ ...candidate, approvedForSchedule: false }), history, date), null);
assert.equal(selectWeeklyCandidate(queue({ ...candidate, notBefore: "2026-11-23" }), history, date), null);
assert.equal(selectWeeklyCandidate(queue({ ...candidate, notBefore: "2026-11-18" }), history, date), null, "midweek notBefore conservatively skips that week");
assert.equal(selectWeeklyCandidate(queue({ ...candidate, notBefore: "2026-11-16" }), history, date)?.id, candidate.id);
assert.equal(selectWeeklyCandidate(queue(), history, new Date("2026-11-23T15:00:00Z")), null, "no catch-up");
assert.equal(selectWeeklyCandidate(queue(), { ...history, releases: [{ id: candidate.id, week: "2026-11-16" }] }, date), null);
assert.equal(releaseWeek(new Date("2026-11-16T03:00:00Z")), "2026-11-09", "Sunday in New York");
assert.equal(releaseWeek(new Date("2026-11-16T06:00:00Z")), "2026-11-16");
for (const change of [
  { reviewedSha: "main" }, { branch: "main" }, { baseSha: "" }, { validation: "pending" },
  { allowedFiles: [".github/workflows/injected.yml"] }, { changes: [] },
  { notBefore: "2026-02-30" }, { notBefore: "2026-13-99" }, { notBefore: "tomorrow" },
  { changes: [...candidate.changes, { kind: "existing-improvement", url: "/unpublished-test" }] },
  { changes: [{ kind: "new-page" }, { kind: "new-page" }] }, { changes: [{ kind: "unknown" }] },
]) assert.throws(() => selectWeeklyCandidate(queue({ ...candidate, ...change }), history, date));
assert.throws(() => selectWeeklyCandidate({ version: 1, candidates: [candidate, { ...candidate, id: "SVG-SEO-OTHER" }] }, history, date));
assert.doesNotThrow(() => selectWeeklyCandidate(queue({ ...candidate, changes: [...candidate.changes, { kind: "existing-improvement", url: "/existing" }] }), history, date));
assert.throws(() => assertNoStagedExposure([["public/sitemap.xml", "/unpublished-test"]], queue()));
assert.throws(() => assertNoStagedExposure([["app/routes/test.tsx", 'import "../../ai-issues/seo/drafts/test.md"']], queue()));
assert.doesNotThrow(() => assertNoStagedExposure([["app/routes/test.tsx", "/unpublished-test"]], queue(), candidate.id));
const exposure = [["public/sitemap.xml", "/unpublished-test"]];
const isExactPublishedHead = (sha, ref) => sha === candidate.reviewedSha && ref === "HEAD";
assert.doesNotThrow(() => assertNoStagedExposure(exposure, queue(), null, inheritedCandidateIds(queue(), isExactPublishedHead)));
assert.throws(() => assertNoStagedExposure(exposure, queue(), null, inheritedCandidateIds(queue(), () => false)));
const unapprovedQueue = queue({ ...candidate, ownerApproved: false });
assert.throws(() => assertNoStagedExposure(exposure, unapprovedQueue, null, inheritedCandidateIds(unapprovedQueue, isExactPublishedHead)));
const existingPageCandidate = {
  ...candidate, id: "SVG-SEO-EXISTING", branch: "codex/seo/existing", approvedForSchedule: false,
  changes: [{ kind: "existing-improvement", url: "/existing" }],
};
const stagedQueue = { version: 1, candidates: [candidate, existingPageCandidate] };
assert.throws(() => selectBoundaryCandidate(stagedQueue, candidate, null, existingPageCandidate.branch), /not eligible/);
assert.throws(() => selectBoundaryCandidate(stagedQueue, null, null, "codex/seo/unregistered"), /missing from the trusted queue/);
assert.equal(selectBoundaryCandidate(stagedQueue, null, null, "codex/editorial-history"), null);
assert.equal(selectBoundaryCandidate(stagedQueue, candidate, null, candidate.branch), candidate);
assert.doesNotThrow(() => assertCandidateDiff(candidate, ["app/routes/test.tsx"]));
assert.throws(() => assertCandidateDiff(candidate, ["app/routes/test.tsx", "server.js"]));
assert.throws(() => assertCandidateDiff(candidate, []));
assert.doesNotThrow(() => assertAdministrativeBaseDrift(["ai-issues/seo/release-queue.json"]));
assert.throws(() => assertAdministrativeBaseDrift(["app/routes/home.tsx"]));
assert.throws(() => assertAdministrativeBaseDrift(["scripts/weekly-seo-plan.mjs"]));
const manifest = '{ path: "/", sourceFile: "app/routes/home.tsx", indexable: true }';
const newRoute = '{ path: "/unpublished-test", indexable: true }';
assert.doesNotThrow(() => assertIndexableBudget(candidate, manifest, manifest + newRoute));
assert.throws(() => assertIndexableBudget(candidate, manifest, manifest));
assert.throws(() => assertIndexableBudget(candidate, manifest, manifest + newRoute + '{ path: "/second", indexable: true }'));
assert.throws(() => assertIndexableBudget(candidate, manifest, newRoute));
assert.throws(() => assertIndexableBudget(candidate, "invalid inventory", newRoute));

const tmp = await mkdtemp(path.join(os.tmpdir(), "ilovesvg-seo-boundary-"));
try {
  const publicDir = path.join(tmp, "public");
  const outsideDir = path.join(tmp, "outside");
  const linkType = process.platform === "win32" ? "junction" : "dir";
  await mkdir(publicDir);
  await mkdir(outsideDir);
  await writeFile(path.join(publicDir, "sitemap.xml"), "/");
  assert.deepEqual((await walkProductionSources(publicDir)).map(([, source]) => source), ["/"]);
  await writeFile(path.join(publicDir, "fixture.SVG"), '<svg><a href="/unpublished-test"/></svg>');
  const inspectedSvg = await walkProductionSources(publicDir);
  assert.throws(() => assertNoStagedExposure(inspectedSvg, queue()), /Unpublished/);
  await symlink(outsideDir, path.join(publicDir, "linked"), linkType);
  await symlink(outsideDir, path.join(tmp, "linked-root"), linkType);
  await assert.rejects(walkProductionSources(publicDir), /must not be a symlink/);
  await assert.rejects(walkProductionSources(path.join(tmp, "linked-root")), /must not be a symlink/);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

// Run the isolated GitHub Script with fixture API responses, without calling GitHub.
const workflow = await readFile(new URL("../.github/workflows/weekly-seo-preparation.yml", import.meta.url), "utf8");
const script = workflow.split(/^ {10}script: \|\r?\n/m)[1];
assert.ok(script, "Draft GitHub Script is present");
const simulateDraft = new (Object.getPrototypeOf(async function () {}).constructor)("github", "context", "core", "process", script);
const env = {
  CANDIDATE_BRANCH: candidate.branch, CANDIDATE_SHA: candidate.reviewedSha, CANDIDATE_BASE: candidate.baseSha,
  VALIDATED_MAIN: candidate.baseSha, RELEASE_WEEK: date.toISOString().slice(0, 10), CANDIDATE_ID: candidate.id,
};
for (const scenario of [
  { steps: ["paginate", "read-head", "read-base", "create"] },
  { headBeforeCreate: "e".repeat(40), steps: ["paginate", "read-head", "read-base"], failure: /moved after validation/ },
  { baseAtCreate: "e".repeat(40), steps: ["paginate", "read-head", "read-base", "create", "close"], failure: /Closed the draft/ },
  { headAtCreate: "e".repeat(40), steps: ["paginate", "read-head", "read-base", "create", "close"], failure: /Closed the draft/ },
  { duplicate: true, steps: ["paginate"] },
]) {
  const observed = [];
  const mockGithub = {
    paginate: { async *iterator() {
      observed.push("paginate");
      yield { data: scenario.duplicate ? [{ title: "[SEO 2026-11-16] Example", head: { ref: candidate.branch } }] : [] };
    } },
    rest: {
      git: { async getRef({ ref }) {
        const main = ref === "heads/main";
        observed.push(main ? "read-base" : "read-head");
        return { data: { object: { sha: main ? env.VALIDATED_MAIN : scenario.headBeforeCreate || env.CANDIDATE_SHA } } };
      } },
      pulls: {
        list() {},
        async create(request) {
          observed.push("create");
          assert.equal(request.draft, true);
          assert.equal(request.base, "main");
          return { data: {
            number: 100, head: { sha: scenario.headAtCreate || env.CANDIDATE_SHA },
            base: { sha: scenario.baseAtCreate || env.VALIDATED_MAIN },
          } };
        },
        async update(request) {
          observed.push("close");
          assert.equal(request.pull_number, 100);
          assert.equal(request.state, "closed");
        },
      },
    },
  };
  const operation = simulateDraft(mockGithub, { repo: {} }, { info() {} }, { env });
  if (scenario.failure) await assert.rejects(operation, scenario.failure);
  else await operation;
  assert.deepEqual(observed, scenario.steps);
}
console.log("Weekly SEO pipeline: date, approval, dependencies, budget, SHA, diff, exposure and draft-race tests passed.");
