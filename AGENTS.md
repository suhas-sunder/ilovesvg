# iLoveSVG agent guidance

## Product and source of truth

iLoveSVG is a React Router SSR website for SVG conversion, raster vectorization, editing, inspection and export. Inspect actual routes, shared components and utilities before changing behavior. Preserve its existing design identity; timer-specific rules from other repositories do not apply.

Start with package.json, app/routes.ts, app/data/routeManifest.ts, app/client/lib/tracing/useHybridTraceFetcher.ts, app/client/lib/tracing/vtracerWorkerClient.ts, app/utils/backendSecurity.server.ts, app/utils/conversionGate.server.ts and relevant docs/audits. Historical audits are evidence to investigate, not proof a defect still exists.

Read ai-issues/README.md and ai-issues/2026-10-14-independent-seo-and-release-backlog.md. Preserve original owner requests. Record work, validation, release state and limitations under ai-issues.

## Protected behavior

Read ai-issues/AD-PLACEHOLDER-SAFETY.md in full before work touching advertising. Preserve global placeholder suppression after the first genuine ad renders. Do not change ad lifecycle, restore placeholders or overlay creatives as incidental cleanup. Replacement requires explicit owner authorization and actual ad-network verification.

Preserve conversion quality, presets, defaults, supported formats, existing features, downloads, history, local storage and keyboard accessibility. Do not substitute incompatible tracing engines to claim successful fallback. Keep browser/server work bounded, prevent duplicate expensive requests, release resources and guard cancellation/result ownership. Never send uploaded artwork, filenames, raw SVG or private content to analytics.

Keep existing routes, metadata, canonicals, redirects, schema, indexability and sitemaps stable unless the specific task authorizes changes. Structured data must match visible claims. No invented credentials, reviews, traffic or quality claims. No new third-party scripts, paid costs or infrastructure upgrades without authorization.

## Work and releases

Inspect git status, diff, HEAD, upstream and active work before editing. Preserve unrelated changes. Use isolated branches/worktrees as appropriate. Do not commit, push, merge or deploy without explicit owner authorization; authorization already supplied in the active task does not require repeated confirmation. Never force-push shared branches or perform destructive production operations under general maintenance authority.

Keep technical fixes and substantive SEO/content publication separate. Initial November 8, 2026 reliability work must not publish staged SEO content. Weekly content eligibility begins November 16, 2026, with at most one distinct new indexable page and one justified existing-page improvement per week. Zero releases is acceptable. Follow the queue and quality gates in ai-issues/seo; never automatically publish arbitrary generated content.

For every meaningful code batch run npm run typecheck, npm run build, node --check server.js, git diff --check and relevant existing tests. npm test covers cache, trace engine and quality. Use focused conversion actions, browser, queue, memory, SEO, schema, routes and monetization suites where affected. Record baseline failures separately. Verify frontend changes in actual rendered browser screenshots and workflows. An emulated browser is not a physical iPhone test. SVG validity alone is not quality proof.

Before production release, verify output/behavior regressions, resource bounds, unrelated families, SEO invariants and ad safety. Capture rollback and actual production version. A push is not a deployment; local success is not production verification. If access or a critical gate is unavailable, keep that release blocked and continue independent safe work.

Report changed files, behavior, tests, browser coverage, pre-existing work, release SHA/state, remaining risks and exact blockers. Do not claim unsupported certainty.

## Documentation correction

The previous root AGENTS.md described iLoveTimers and was confirmed misplaced on November 8, 2026. Its complete historical text is preserved at ai-issues/history/misplaced-ilovetimers-agent-guidance.txt. It is historical reference, not active iLoveSVG policy.
