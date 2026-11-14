> Historical planning record retained. Current implementation, decisions and measured evidence are in [Phase 2](../PHASE2-STATUS.md) and [the current decision record](phase2/content-decisions.md). These historical observations are not new defect claims.

# Weekly SEO draft workflow setup

This setup isolates the two workflows, three scripts and queue/history JSON from historical commit `712a6ae`. The three draft bodies stay on the historical planning branch. The queue carries their existing identifiers and target paths for boundary checks. Every candidate remains unapproved and unscheduled. The earliest eligible week is November 16, 2026.

The scheduled and manual workflows plan from the event SHA on `main` with read-only permissions. The planning job tests the boundary and reports eligibility. The validation and draft jobs require the repository variable `SEO_DRAFT_PREPARATION_ENABLED` to be set to `true`. Candidate validation uses the trusted scripts and queue, checks the exact reviewed SHA and allowed diff, and retains read-only permissions. The only write-capable job uses a fresh runner, rechecks both refs and can open a draft pull request. The separate pull request boundary verifies staged URL exposure with the base's code when installed. [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) · [GitHub configuration variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)

The setup diff is limited to workflow, review tooling and administrative records. Before merging any workflow onto `main`, confirm what a merge triggers in the established production deployment system. Before enabling candidate validation, verify the technical reliability release and the Node 20 test prerequisite on `main`. On the current main base, Node 20 `npm test` stops in `test:trace-quality` when it imports `centerlineTrace.ts` directly. The reliability release supplies the TypeScript test loader. Review the repository's Actions pull request permission separately. At preparation time the opt-in variable was absent and Actions pull request creation was disabled. Neither setting has been changed.

When activation is authorized, keep the reviewed queue empty of approvals until a candidate meets the existing evidence, rollback, output, mobile and ad-safety gates. Check the workflow on `main` with the variable unset and confirm that only the read-only planner runs. Later set the variable only for draft preparation. Any publication is a separate decision with final review of exact refs and the production rollout mechanism. Clearing the variable disables candidate jobs on future runs.

Local validation uses Node 20 and no external data or credentials.

```text
node scripts/weekly-seo-pipeline-test.mjs
node scripts/content-release-boundary.mjs
node scripts/weekly-seo-plan.mjs
```
