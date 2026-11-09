import assert from "node:assert/strict";
import { releaseWeek, selectWeeklyCandidate } from "./weekly-seo-plan.mjs";
import { assertAdministrativeBaseDrift, assertCandidateDiff, assertIndexableBudget, assertNoStagedExposure } from "./content-release-boundary.mjs";

const candidate = {
  id: "SVG-SEO-TEST", branch: "codex/seo/test", reviewedSha: "a".repeat(40), baseSha: "b".repeat(40),
  plannedWeek: "2026-11-16", approvedForSchedule: true,
  changes: [{ kind: "new-page", url: "/unpublished-test" }],
  validation: "passed", seoReview: "passed", outputReview: "passed", mobileReview: "passed", adSafetyReview: "passed",
  reviewEvidence: "ai-issues/releases/weekly/test.md", rollbackReference: "b".repeat(40), allowedFiles: ["app/routes/test.tsx"],
};
const queue = (item = candidate) => ({ version: 1, candidates: [item] });
const history = { releases: [] };
const date = new Date("2026-11-16T15:00:00Z");
assert.equal(selectWeeklyCandidate(queue(), history, new Date("2026-11-08T15:00:00Z")), null);
assert.equal(selectWeeklyCandidate(queue(), history, date)?.id, candidate.id);
assert.equal(selectWeeklyCandidate(queue({ ...candidate, approvedForSchedule: false }), history, date), null);
assert.equal(selectWeeklyCandidate(queue({ ...candidate, notBefore: "2026-11-23" }), history, date), null);
assert.equal(selectWeeklyCandidate(queue({ ...candidate, notBefore: "2026-11-18" }), history, date), null, "midweek notBefore conservatively skips that week");
assert.equal(selectWeeklyCandidate(queue({ ...candidate, notBefore: "2026-11-16" }), history, date)?.id, candidate.id);
assert.equal(selectWeeklyCandidate(queue(), history, new Date("2026-11-23T15:00:00Z")), null, "no catch-up");
assert.equal(selectWeeklyCandidate(queue(), { releases: [{ id: candidate.id, week: "2026-11-16" }] }, date), null);
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
console.log("Weekly SEO pipeline: date, eligibility, budget, replay, SHA, diff and exposure tests passed.");
