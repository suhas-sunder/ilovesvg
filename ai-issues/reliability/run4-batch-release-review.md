# Run 4 batch release review

The consolidated candidate descends directly from PR #9 at cb43f5c1ea373febd8784928b8c1f15cfacccf1d and retains PR #4 at f67c008898957b827260489707563acdb777eed2 as its prerequisite. Both original PRs retain their history. The candidate adds one separately reversible batch error fix, plus the independent browser evidence. Audit infrastructure, tracing experiments, and SEO setup have their own lanes.

The homepage batch captures its route lifetime signal, passes it to both browser tracing and server fallback, and checks ownership before it starts another file or publishes a result. The server-side route still uses the existing conversion gate. A native conversion that has already started may finish after the browser disconnects.

| Test | Result |
| --- | --- |
| Navigate while the browser trace is still pending | Chromium worker terminated and zero batch POSTs. |
| Navigate with a pending fetch before forwarding the POST | Chromium and WebKit aborted their single pending request. |
| Navigate while waiting for a completed upstream response | A loopback proxy forwarded the original multipart stream, held the real HTTP 200 response, and observed the browser disconnect in Chromium and WebKit. No second POST or late browser response. Back navigation restored the empty converter without progress or a stale ZIP. The PR #4 control delivered the held response after navigation and had no fetch signal. |
| Successful and partial ZIPs | Two same-name inputs produced two numbered SVGs with distinct verified 96×80 pixel geometry. A 200/415 batch retained only the valid SVG. |
| Retry after all files fail | A 415/415 batch exposed an error and returned to idle without a ZIP. Replacing the batch input produced a clean 200/200 ZIP. |
| ZIP asset cannot load | A synthetic HTTP 503 for the lazy archive module caused an unhandled rejection and no useful message on PR #9. The candidate displays reload guidance, clears running state and makes zero batch uploads. Main has the same uncaught outer ZIP error path as PR #9. |

Browser evidence comes from actual desktop Chromium and WebKit iPhone viewport and touch emulation. The pre-upload worker probe is Chromium-only, since the cached WebKit lacks OffscreenCanvas. The mobile and desktop failure/output screenshots are in ignored tmp/run4 directories. No physical device or production upload was used.

Local Node 20 typecheck, production build, npm test, server and browser script syntax, whitespace, conversion actions, and accessibility passed. The consolidated PR is configured to run the existing Node 20 Alpine release workflow against its exact head. Source application changes relative to PR #4 are confined to the homepage batch, including its existing delegation through /api/batch-svg. Review the exact candidate image and executable rollback on the actual deployment system before promoting the consolidated release.
