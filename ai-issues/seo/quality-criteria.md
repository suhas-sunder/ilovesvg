# Reviewed weekly content preparation

## Release mechanism and limits

`.github/workflows/weekly-seo-preparation.yml` runs on Mondays at 14:20 UTC, and can be dispatched manually. It prepares **one draft pull request**, never merges or deploys. This is the conservative alternative authorized in the November 8 request: actual production identity, rollback automation and independent output/mobile review cannot be guaranteed by a calendar job. Merging this workflow into the default branch is necessary for scheduled execution. No API generation or paid service is invoked; ordinary GitHub Actions usage remains subject to the account's existing included quota.

The planner uses the America/New_York week. Nothing can be selected before November 16, 2026 or the candidate's valid `notBefore` date, whichever is later. A midweek `notBefore` conservatively defers to a later Monday. It selects only an exact current-week, already completed, explicitly approved candidate batch; it never catches up missed weeks. A batch permits at most one new page and one existing-page improvement at distinct URLs. Multiple approved batches for the week fail closed. No eligible candidate means a successful no-op. A history entry for the week or candidate blocks replay. Draft creation also checks all historical PRs for the week marker or candidate branch, preventing duplicates after closure. A failed gate creates no PR and retains the candidate for a future explicit re-review/reschedule.

## Prepare a candidate

1. Check live route inventory and query/page evidence where accessible. Prefer enriching an existing entrypoint when intent overlaps. Record unavailable metrics rather than guessing volume, RPM or traffic. Do not automatically rewrite established metadata.
2. Implement on a separate `codex/seo/...` branch off a known current `main` SHA. Keep drafts off live routes until this isolated candidate branch. Do not include technical engine, ad lifecycle or unrelated work in a content candidate.
3. Review output, original examples, mobile screenshots, accessible controls, factual capability claims and utility-first ordering. Match visible FAQ with schema; include only honest dates and credentials. Confirm no canonical/redirect migration. Compare existing SEO before/after.
4. Run existing typecheck/build/tests and route/SEO/schema/route-coverage/monetization gates against a production server. Capture screenshot/output evidence in a durable release note. A valid SVG alone is not quality evidence.
5. Record exact implementation branch, full 40-character reviewed SHA and base SHA, exact changed-file allowlist, review evidence path, rollback reference and passed validation/SEO/output/mobile/ad safety states. Only then set `approvedForSchedule: true` and one current or future Monday `plannedWeek`. A calendar date does not constitute review.
6. Update this queue on main separately from candidate content. Only queue/release documentation under `ai-issues/seo/` or `ai-issues/releases/weekly/` may change on main after the reviewed base. Application, dependency or CI changes require rebase, re-test and re-review, followed by updated approval SHA/base. Allowing administrative metadata avoids an impossible self-referential queue/base SHA while preserving the reviewed application environment.

## Automated gates and trust boundary

The scheduler loads scripts and approval metadata from `main`; candidate code is checked out into a separate directory at the exact reviewed SHA with no persisted Git credentials. The candidate diff must exactly match the approved allowlist, be descended from its base, and contain no staged URL from any other candidate. Main may differ from the reviewed base only in queue/release documentation. The exact main SHA used for validation is checked again before PR creation. Existing repository checks run with read-only token permissions. Only the separate final job has pull-request write permission, and that job executes no candidate code. Branch and validated main SHAs are checked again immediately before creating the draft.

`content-release-boundary.yml` checks PR application/public sources against approval data and scripts from the **base** commit. Technical PRs cannot change their own queue to bypass that check. A content PR can expose its own staged URL only during its eligible week, on the exact approved branch/SHA and with the exact approved file diff. Staged draft imports and other candidates' new URLs remain forbidden. This detects registered URLs, links, sitemap inclusion and imported draft artifacts; it is not a semantic detector for every possible prose rewrite. Human diff review remains required for substantive changes to existing text.

The first tooling PR bootstraps using its own boundary checks because its base predates these tools; subsequent PRs use the trusted base. Configure the boundary check as a required repository status after installation if branch protection is desired; this file cannot configure repository settings. Do not claim an unenforced CI check prevents a direct push.

The actual before/after indexable manifest is checked against the declared new-page budget, so a candidate cannot claim one page while registering several. Removing an indexable page fails this track. GitHub's repository setting must permit Actions to create pull requests; if it does not, the final job fails without publishing anything. Enable that existing repository capability only within the owner's authorization; no paid scheduler is needed.

## Final publication and observation

The draft remains unpublished until final review confirms the validated SHA and base, screenshots, real output/downloads, ad invariants and production rollback. No automatic promotion is enabled. Publish no earlier than the eligible week and within the weekly budget. If base/head changes, stop and revalidate. The owner has authorized validated low-risk releases; routine permission prompts are unnecessary, but missing proof is a stop condition for that release.

After an actual deployment, record ID, week, actual date, deployed SHA, rollback SHA, production verification, baseline and post-release query/country/device/conversion metrics in `release-history.json` and the candidate. Do not fill publication fields after a push or PR alone. Review 7/28-day observations where available; a slow cadence does not guarantee rankings or protection against algorithm updates.

Local deterministic checks:

```
node scripts/weekly-seo-pipeline-test.mjs
node scripts/content-release-boundary.mjs
node scripts/weekly-seo-plan.mjs
```
