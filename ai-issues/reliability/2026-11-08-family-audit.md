# Independent broad-family and gate review

Run November 8, 2026 against the fetched `f53292e` baseline plus the current reliability candidate. This review made no application edits. Local logs are retained intentionally under ignored `tmp/weekly-family-audit/`; no uploaded source images or filenames were recorded.

## Existing suite results

| Suite | Result | Interpretation |
| --- | --- | --- |
| `test:raster-to-svg-family` | PASS | 29 retained routes, shared route implementations and four direct redirects verified by existing audit |
| `test:svg-compression` | PASS | Existing optimization preservation assertions passed |
| `test:docs` | PASS | Existing documentation audit passed |
| `test:links` | PASS | Existing link audit passed |
| `test:non-tracing-svg-utilities` | FAIL, historical pinned baseline | `OtherToolsLinks.tsx` differs from the suite's old approved starting SHA; this file is unchanged versus fetched `origin/main` in this pass |
| `test:svg-to-png-preservation` | FAIL, historical pinned baseline | Same unchanged navigation file versus an old preservation reference; no baseline was silently reset |
| `test:cricut-output-family` | FAIL, historical pinned baseline | `routeManifest.ts` differs from the suite's old approved SHA; manifest unchanged versus fetched `origin/main` |
| `test:specialized-trace-family` | FAIL, historical pinned manifest after narrow correction | Its public-string gate originally rejected the intentional manual-BUSY-recovery message. The test now permits only that exact phrase replacement on the four known routes, asserts old phrase absent/new phrase present, and preserves every other historical string. It then reaches the unchanged routeManifest historical-baseline failure |

These historical reference failures are not evidence of new product failures, but the affected suites are **not green**. They remain reported rather than rebaselined. Output/functional acceptance still needs the focused runtime tests recorded by the main pass.

## Browser family check

`CDP_PORT=9264 npm run test:non-tracing-svg-utilities-browser` passed against the local production-build server on port 3000. The initial attempt during a server restart failed with `ECONNREFUSED`; after the candidate server was ready, the full rerun passed.

The existing suite inspected 29 retained non-tracing routes at 390x844 and 1280x720, plus ten representative routes at 320, 412, 768 and 1440 pixels: **98 measurements, zero failures**, and ten direct redirect checks with successful destinations. Representatives cover favicon/ICO, resize, dimensions, file size, Base64, embed/JSX and cleaner workflows. Checks include rendered H1, input/control surface, overflow and console/runtime error conditions. It does not execute every export/download operation, inspect bitmap fidelity, or retain screenshots; it is browser-render/DOM evidence, not a substitute for visual screenshot or physical-device QA. The temporary browser profile was removed by the existing suite.

## Independent optional-AbortSignal gate review

The queue cancellation code was reviewed and `node scripts/conversion-gate-cancellation.mjs` passed. An already-aborted request never enters the queue; a canceled waiter is removed without releasing active native work; the listener is removed on acquisition/cancellation; release remains idempotent. The parent subsequently strengthened the test for middle-waiter removal and abort after acquisition. No correctness defect was found in this focused change.

The optional signal affects only callers that supply it (the current milestone's home and PNG server actions); other routes remain unchanged. A passing gate test does not independently prove that every deployment proxy propagates a physical client's disconnection into React Router's request signal. Production connection/cancellation verification remains an operational limitation.
