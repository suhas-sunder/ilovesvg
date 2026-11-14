# Weekly SEO draft workflow setup

This setup isolates the two workflows, three scripts and queue/history JSON from historical commit `712a6ae`. The three draft bodies stay on the historical planning branch. The queue carries their existing identifiers and target paths for boundary checks. Every candidate remains unapproved and unscheduled. The earliest eligible week is November 16, 2026.

The scheduled and manual workflows plan from the event SHA on `main` with read-only permissions. The planning job tests the boundary and reports eligibility. Candidates require both `ownerApproved` and `approvedForSchedule`. Content and deployed technical dependencies use the existing history records by `id`, with `productionVerified: true` and the exact `finalDeployedCommit`. Test-only prerequisites use exact commit SHAs under `technicalPrerequisites` in the existing queue. Each dependency revision must be an ancestor of the candidate's reviewed base. Release history is recorded after actual deployment and verification.

The validation and draft jobs require `SEO_DRAFT_PREPARATION_ENABLED` to be `true`. Candidate validation uses the trusted scripts and queue, checks the exact reviewed SHA and allowed diff, and retains read-only permissions. Only the draft job can write pull requests. It runs on a fresh runner, checks both refs immediately before creation and closes the newly created draft if GitHub returns a different head or base. A draft can still move after creation. Recheck exact refs and CI at publication review. [GitHub configuration variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)

The content boundary for pull requests targeting `main` runs the base's `pull_request_target` workflow and exact base scripts with read-only content access. Candidate files are inspected as data, with symlinks in production directories rejected. The initial installation requires exact-head review and the local boundary tests below because the base workflow only exists after installation. Use merge commits for approved draft releases so that the exact reviewed SHA remains in main ancestry. This lets the boundary recognize already inherited URLs while the operator records publication details. Deployment verification still comes from the release history. [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)

The setup diff is limited to workflow, review tooling and administrative records. Before merging any workflow onto `main`, confirm what a merge triggers in the established production deployment system. Before enabling candidate validation, verify the technical reliability release and the Node 20 test prerequisite on `main`. On the current main base, Node 20 `npm test` stops in `test:trace-quality` when it imports `centerlineTrace.ts` directly. The reliability release supplies the TypeScript test loader. Review the repository's Actions pull request permission separately. At preparation time the opt-in variable was absent and Actions pull request creation was disabled. Neither setting has been changed.

When activation is authorized, keep the reviewed queue empty of approvals until a candidate meets the existing evidence, rollback, output, mobile and ad-safety gates. Check the workflow on `main` with the variable unset and confirm that only the read-only planner runs. Later set the variable only for draft preparation. Any publication is a separate decision with final review of exact refs and the production rollout mechanism. Clearing the variable disables candidate jobs on future runs.

Local validation uses Node 20 and no external data or credentials.

```text
node scripts/weekly-seo-pipeline-test.mjs
node scripts/content-release-boundary.mjs
node scripts/weekly-seo-plan.mjs
```
