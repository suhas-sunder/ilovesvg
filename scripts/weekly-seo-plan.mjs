import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const EARLIEST_WEEK = "2026-11-16";
const SHA = /^[a-f0-9]{40}$/;
const BRANCH = /^codex\/seo\/[a-z0-9][a-z0-9._/-]*$/;

export function dependencyRevisions(candidate, queue, history) {
  const dependencies = candidate.dependencies || [];
  if (!Array.isArray(dependencies) || new Set(dependencies).size !== dependencies.length ||
      dependencies.some((id) => typeof id !== "string" || id === candidate.id || !/^(?:PR[0-9]+|SVG-[A-Z0-9-]+)$/.test(id))) {
    throw new Error("Eligible candidate has invalid release dependencies");
  }
  return dependencies.map((id) => {
    const prerequisite = Object.hasOwn(queue.technicalPrerequisites || {}, id) && queue.technicalPrerequisites[id];
    if (prerequisite) {
      if (!SHA.test(prerequisite)) throw new Error(`Technical prerequisite ${id} needs an exact commit`);
      return prerequisite;
    }
    const records = history.releases.filter((record) => record.id === id);
    if (records.length > 1) throw new Error(`Release dependency ${id} has multiple history records`);
    const release = records[0]?.productionVerified === true ? records[0] : null;
    return SHA.test(release?.finalDeployedCommit || "") ? release.finalDeployedCommit : null;
  });
}

export function releaseWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type).value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export function selectWeeklyCandidate(queue, history, now = new Date()) {
  if (queue.version !== 1 || history.version !== 1 || !Array.isArray(queue.candidates) || !Array.isArray(history.releases)) {
    throw new Error("Invalid queue/history format");
  }
  const week = releaseWeek(now);
  if (week < EARLIEST_WEEK || history.releases.some((release) => release.week === week)) return null;
  const eligible = queue.candidates.filter((candidate) =>
    candidate.ownerApproved === true && candidate.approvedForSchedule === true && candidate.plannedWeek === week &&
    !candidate.actualPublicationDate && !history.releases.some((release) => release.id === candidate.id));
  if (eligible.length > 1) throw new Error("More than one candidate batch approved this week; skip rather than choose arbitrarily");
  const candidate = eligible[0];
  if (!candidate) return null;
  if (candidate.notBefore != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.notBefore) ||
        Number.isNaN(Date.parse(`${candidate.notBefore}T12:00:00Z`)) ||
        new Date(`${candidate.notBefore}T12:00:00Z`).toISOString().slice(0, 10) !== candidate.notBefore) {
      throw new Error("Candidate notBefore must be a valid ISO calendar date");
    }
    if (week < candidate.notBefore) return null;
  }
  if (!/^SVG-[A-Z0-9-]+$/.test(candidate.id) || !BRANCH.test(candidate.branch || "") ||
      candidate.branch.includes("..") || !SHA.test(candidate.reviewedSha || "") || !SHA.test(candidate.baseSha || "")) {
    throw new Error("Eligible candidate must identify a safe branch and exact reviewed/base commits");
  }
  if (!Array.isArray(candidate.changes) || candidate.changes.length === 0 ||
      candidate.changes.some((change) => !["new-page", "existing-improvement"].includes(change.kind)) ||
      candidate.changes.some((change) => !/^\/(?:[a-z0-9]+(?:[/-][a-z0-9]+)*)?$/.test(change.url || "")) ||
      new Set(candidate.changes.map((change) => change.url)).size !== candidate.changes.length ||
      candidate.changes.filter((change) => change.kind === "new-page").length > 1 ||
      candidate.changes.filter((change) => change.kind === "existing-improvement").length > 1) {
    throw new Error("Weekly budget exceeded or empty/unknown change kind");
  }
  if (!["validation", "seoReview", "outputReview", "mobileReview", "adSafetyReview"].every((field) => candidate[field] === "passed")) {
    throw new Error("Eligible candidate has incomplete review gates");
  }
  if (!candidate.reviewEvidence || !candidate.rollbackReference || !Array.isArray(candidate.allowedFiles) || !candidate.allowedFiles.length ||
      candidate.allowedFiles.some((file) => !/^(app\/|public\/|ai-issues\/releases\/weekly\/)/.test(file) || file.includes("..") || /[\r\n]/.test(file))) {
    throw new Error("Eligible candidate needs evidence, rollback and an explicit application/content file allowlist");
  }
  if (dependencyRevisions(candidate, queue, history).includes(null)) return null;
  return { ...candidate, week };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const queue = JSON.parse(await readFile("ai-issues/seo/release-queue.json", "utf8"));
  const history = JSON.parse(await readFile("ai-issues/seo/release-history.json", "utf8"));
  const candidate = selectWeeklyCandidate(queue, history);
  console.log(candidate ? `Prepare draft only: ${candidate.id} for ${candidate.week}` : "No eligible release this week; publish nothing.");
  if (process.env.GITHUB_OUTPUT) {
    const lines = candidate ? {
      eligible: "true", id: candidate.id, week: candidate.week, branch: candidate.branch,
      sha: candidate.reviewedSha, base: candidate.baseSha,
      main: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    } : { eligible: "false" };
    await writeFile(process.env.GITHUB_OUTPUT, Object.entries(lines).map(([key, value]) => `${key}=${value}\n`).join(""), { flag: "a" });
  }
}
