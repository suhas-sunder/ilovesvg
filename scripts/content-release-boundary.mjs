import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectWeeklyCandidate } from "./weekly-seo-plan.mjs";

export function assertNoStagedExposure(files, queue, allowedCandidateId = null) {
  const unpublished = queue.candidates.filter((candidate) => !candidate.actualPublicationDate && candidate.id !== allowedCandidateId);
  for (const [file, source] of files) {
    if (/ai-issues[\\/]seo[\\/]drafts|@staged-seo-content/.test(source)) throw new Error(`Staged content referenced by production file: ${file}`);
    for (const candidate of unpublished) {
      for (const change of candidate.changes || []) {
        if (change.kind === "new-page" && source.includes(change.url)) {
          throw new Error(`Unpublished ${candidate.id} URL exposed in ${file}`);
        }
      }
    }
  }
}

export function assertCandidateDiff(candidate, changedFiles) {
  const allowed = new Set(candidate.allowedFiles);
  if (!changedFiles.length || changedFiles.some((file) => !allowed.has(file)) ||
      candidate.allowedFiles.some((file) => !changedFiles.includes(file))) {
    throw new Error("Candidate diff differs from exact reviewed file allowlist");
  }
}

export function assertAdministrativeBaseDrift(changedFiles) {
  if (changedFiles.some((file) => !/^ai-issues\/(?:seo\/|releases\/weekly\/)/.test(file))) {
    throw new Error("Application or release tooling changed since review; rebase and re-review the candidate");
  }
}

export function assertIndexableBudget(candidate, beforeManifest, afterManifest) {
  const paths = (source) => new Set([...source.matchAll(/\{\s*path:\s*"([^"]+)"[^}]*indexable:\s*true/g)].map((match) => match[1]));
  const before = paths(beforeManifest);
  const after = paths(afterManifest);
  if (!before.size || !after.size) throw new Error("Cannot establish indexable route inventory");
  const added = [...after].filter((url) => !before.has(url));
  const removed = [...before].filter((url) => !after.has(url));
  const declared = candidate.changes.filter((change) => change.kind === "new-page").map((change) => change.url);
  if (removed.length || added.length > 1 || added.length !== declared.length || added.some((url) => !declared.includes(url))) {
    throw new Error("Actual indexable route changes differ from the approved weekly budget; removals require separate authority");
  }
}

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (/\.(tsx?|jsx?|json|xml|html|css|md|txt)$/.test(file)) result.push([file, await readFile(file, "utf8")]);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // In scheduled CI this script and queue come from the trusted base checkout,
  // while ROOT identifies the separately checked-out candidate.
  const root = process.env.CONTENT_ROOT || process.cwd();
  const queue = JSON.parse(await readFile("ai-issues/seo/release-queue.json", "utf8"));
  const history = JSON.parse(await readFile("ai-issues/seo/release-history.json", "utf8"));
  const eligible = selectWeeklyCandidate(queue, history);
  const candidate = process.env.SEO_CANDIDATE_ID ? queue.candidates.find((item) => item.id === process.env.SEO_CANDIDATE_ID) :
    eligible?.branch === process.env.CONTENT_CANDIDATE_BRANCH ? eligible : null;
  if (process.env.SEO_CANDIDATE_ID && !candidate) throw new Error("Unknown candidate");
  if (candidate && candidate.id !== eligible?.id) throw new Error("Candidate is not eligible in the current week");
  const files = [...await walk(path.join(root, "app")), ...await walk(path.join(root, "public"))];
  assertNoStagedExposure(files, queue, candidate?.id);
  if (candidate) {
    const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
    if (git("rev-parse", "HEAD") !== candidate.reviewedSha || git("merge-base", "HEAD", candidate.baseSha) !== candidate.baseSha) {
      throw new Error("Candidate SHA/ancestry differs from review");
    }
    assertCandidateDiff(candidate, git("diff", "--name-only", candidate.baseSha, "HEAD").split("\n").filter(Boolean));
    assertIndexableBudget(candidate,
      git("show", `${candidate.baseSha}:app/data/routeManifest.ts`),
      await readFile(path.join(root, "app/data/routeManifest.ts"), "utf8"));
    // Approval metadata is necessarily committed after the candidate's base.
    // Permit only queue/release records to drift; never application or CI code.
    const trustedGit = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
    if (trustedGit("merge-base", "HEAD", candidate.baseSha) !== candidate.baseSha) throw new Error("Trusted main is not descended from reviewed base");
    assertAdministrativeBaseDrift(trustedGit("diff", "--name-only", candidate.baseSha, "HEAD").split("\n").filter(Boolean));
  }
  console.log("Content release boundary passed: staged drafts are outside production sources.");
}
