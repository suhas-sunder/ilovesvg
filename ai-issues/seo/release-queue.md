# Weekly content queue

Prepared November 8, 2026. **Nothing is approved, scheduled for publication, or published.** Earliest permitted publication week is November 16, 2026. A week may have zero releases. The machine-readable authority is [release-queue.json](release-queue.json); [release-history.json](release-history.json) records actual releases, not planned ones.

| Candidate | Existing intent overlap | Current state | Next acceptance step |
| --- | --- | --- | --- |
| SVG-SEO-MAINTAINER | Original owner request in ../README.md; how-it-works | Draft only; no route or implementation branch | Confirm minimal factual bio, implement profile off main, inspect visible Person/ProfilePage claims and mobile footer link |
| SVG-SEO-MOBILE-HELP | Existing troubleshooting and conversion-workflow documentation | Draft only; technical evidence incomplete | Reconcile with the implemented, tested input/fallback behavior; do not claim physical iPhone verification from emulation |
| SVG-SEO-PATH-INSPECTION | Existing output guide, code viewer and preview viewer | Draft only; worked example still needed | Produce original deterministic fixture and actual traced/downloaded output; inspect path geometry and embedded images |

Each record carries audience, evidence, unique utility, target URL, overlap, review states, week, branch, exact reviewed/base SHA, exact changed-file allowlist, schedule approval, publication date, deployed SHA, metrics and rollback. Null means not established, not implicitly approved. Dates must not be advanced merely to fill a quota.

The drafts under `drafts/` are repository planning artifacts. They are outside `app` and `public`, excluded from route registration, navigation, sitemap, SSR and the production Docker image. Do not import them into application code or copy them into public assets. Prefer a `codex/seo/...` branch when turning a draft into a complete candidate.

See [quality-criteria.md](quality-criteria.md) for preparation, scheduling and final publication gates.
