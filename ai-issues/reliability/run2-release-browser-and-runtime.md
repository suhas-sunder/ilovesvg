# Run 2 release browser and runtime evidence

This is a local and CI validation record for draft [PR #4](https://github.com/suhas-sunder/ilovesvg/pull/4). Its application source was built from release commit 88e1942; subsequent changes in this branch only update tests, CI, build-context exclusions and evidence. No production service was changed.

## End-to-end output preservation

The full Edge browser smoke passed all 65 conversion scenarios and the batch ZIP workflow on the isolated Node 20 production build. It exercises actual upload, preview, copy, download and preview updates. Fifty-nine rows have identical copy and download SHA-256 values against the immutable previous full main report. The other six have exact copy and download parity in controlled same-preset, same-job comparisons against the built current-main source at f53292e:

| Route | Preset ID in both verified jobs |
| --- | --- |
| /icon-to-svg-converter | layered-color-svg-smoother |
| /jpeg-to-svg-converter | line-clean |
| /jpg-to-svg-converter | line-clean |
| /png-to-svg-for-etsy | line-accurate |
| /png-to-svg-for-shopify | line-accurate |
| /sticker-to-svg-converter | line-accurate |

Those six rows must use the focused comparison because the archived smoke did not reliably associate the SVG with a completed requested preset; the icon test now selects a distinct preset. The automatically converted icon default still has exact archival parity. The older main build ran from a separate copy of its compiled server and assets, leaving the protected baseline worktree untouched. For the six focused rows, the expected and completed client run IDs match within each build, the preset IDs match across builds, and both copy and download hashes match. No golden output was replaced.

The initial fresh broad run recorded two harness timeouts. A rendered diagnostic reproduced both on the prior PR #3 build and the release build. The icon route returns the existing identical SVG when the already active layered preset is selected; it does not create a distinct card. The new smoke selects the visible Smoother variant and checks its own completed output. The layered Cricut PNG route stamps the pending card at submission, before worker completion. The smoke binds that route's stamp to the submission-to-worker-start window for the actual completed run, instead of requiring a later completion timestamp. The focus case confirms the original archived hash there too. No application behavior changed for either timeout.

The 25-row raster route matrix passed across desktop Chromium, Firefox and WebKit, and mobile Chromium/WebKit emulation. Ordinary and oversized transparent PNG results preserve the expected dimensions and meaningful downloaded paths. Synthetic DNG and hostile pixel headers produce actionable errors, zero decodes and zero POSTs; a replacement during preparation is the only file to submit. A separate [30-case lifecycle matrix](run2-review.md) covered forced compatible server fallback, response ownership, shared jobs and exact replacement downloads.

## Server and release boundaries

- Node 20.20.2: typecheck, build, server syntax, unit/reliability, actions, compatibility, queue, SEO, schema, routes, monetization static audit and port collision all passed locally. No staged maintainer URL exists on the candidate. Current route registration, manifest, sitemap, robots, ad lifecycle and tracing/preset definitions stay stable.
- The native-memory audit passed on the local Node 20 build with output parity: 74 completed jobs, 22 failures deliberately exercised by the suite, one canceled client. Late-idle process RSS was about 186 MiB, active conversions and waiters returned to zero, and the configured one-job gate and Sharp concurrency of one remained in effect. This measures one test process on Windows; it does not measure the production host, proxy or arbitrary peak uploads.
- The initial exact-SHA [Node 20 Alpine CI run](https://github.com/suhas-sunder/ilovesvg/actions/runs/42535082476) passed: Docker build, isolated source context, tests, built runtime startup/memory, HTTP conversion and input suites, SEO/schema/routes, and image revision label. Its local CI image is not an identified production image.
- Existing gaps remain: pre-admission multipart parsing on some routes, centerline full-source decode, unknown effective proxy limits, and no physical iPhone memory measurement. No ceilings or native concurrency were raised.
- Reproduction evidence is intentionally ignored: in the release worktree, tmp/run2-logs/release-hybrid-report.json, release-hybrid-corrected.json, main-focused-*.json, release-native-memory.log and release-raster-route.log. See the [operator runbook](run2-operator-runbook.md) for the conditions that must be met before deployment.
