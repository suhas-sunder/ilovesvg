# Run 3 audit prerequisite

This branch transplants the audit-only commit from PR #5 with cherry-pick provenance. Its prerequisite is PR #4 at f67c008898957b827260489707563acdb777eed2. The original PR #5 remains based on PR #3, which also contains unrelated SEO and guidance commits. This branch diff against PR #4 contains only audit scripts and evidence.

Three old audits compared server.js with historical startup code. The reconciled contract accepts either the original source or the exact reviewed server.js from 88e1942c12e8b968d7b7d393d778bf3cc3f91d30. That revision contains production error redaction and the bind failure fix. The test rejects any further startup source change. The narrow exception preserves the remaining historical checks and keeps the actual startup collision test in the prerequisite release.

The SVG-to-PNG audit also uncovered a checkout-dependent hash. The archived ContextualAdCard hash matched the original mixed-line-ending worktree. The new worktree uses CRLF, and both normalize to the same source as historical Git object 0fe1179. The audit retains its original raw digest and additionally accepts the pinned LF digest of that historical object. The application ad source is unchanged. Other source hashes and all historical SVG-to-PNG byte/pixel goldens remain pinned.

All four audits passed against the prerequisite build. SVG-to-PNG verified seven fixtures across nine route variants, clear/reupload, invalid format rejection, and the existing responsive browser checks. The semantic contract covers 157 routes, 229 navigation links and six adversarial cases. Node 20 typecheck, build, npm test, server syntax and whitespace checks passed on this branch.
