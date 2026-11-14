# Maintainer profile validation

The package targets the PR #12 foundation at `78dda78994ea90e7b3a839725021bc316463434e`. Validation used a local production build from the isolated package snapshot. The owner-provided attribution is recorded in `ai-issues/README.md`. The profile describes only the maintainer's role and responsibilities relevant to iLoveSVG, plus his verified project links. [iLoveTimers author profile](https://www.ilovetimers.com/author/suhas-sunder/), [MorseWords about page](https://www.morsewords.com/about)

## Browser and HTTP review

- The revised profile passed 14 cases in Chromium and WebKit at 320, 375, 390, 430, 768, 1024, and 1440 CSS pixels. All cases had one H1, no horizontal overflow, zero axe violations, and zero page errors. The 390 and 1440 full-page screenshots were visually reviewed.
- Server-rendered checks confirmed HTTP 200, a self-canonical profile, matching visible name and role in `ProfilePage.mainEntity`, the XML and HTML sitemap entries, and no `noindex`. A document request with a trailing slash redirected with HTTP 308. The profile schema represents a single person affiliated with the site. [Google ProfilePage structured data documentation](https://developers.google.com/search/docs/appearance/structured-data/profile-page)
- Keyboard focus and Enter navigated from the profile to the documentation hub and back through the footer attribution at 390 and 2560 pixels in both engines. A cold profile load had no AdSense script or slots. After client navigation from the documentation hub, the previously inserted global script element remained in the DOM and the profile had no ad slots, placeholders, or sidebar wrappers. Third-party requests were blocked for this test. Live ad fill and production verification remain pending.
- The initial profile reused the docs shell's social block and triggered the existing `region` axe finding. The same issue reproduced on the PR #12 documentation hub. The profile now omits the social block using a route-specific option. The profile rerun had no `region` finding. The PR #12 documentation hub also showed the pre-existing generic ad wrapper `aria-prohibited-attr` finding.

## Existing release checks

The package's Node 20 typecheck, production build, and `npm test` passed. The existing SEO, schema, route coverage, docs, navigation, navigation browser, accessibility, and monetization browser audits passed on the revised profile build. The schema and monetization browser audits sample existing routes, while the direct profile browser assertions validate the new JSON-LD and ad exclusion. Route coverage reported 126 XML sitemap entries and zero missing metadata, canonical, route registration, sitemap, or navigation targets.

Two audit integrations initially failed on the revised profile build. The HTTP smoke derived a dotted URL from the new route filename. The monetization audit classified the profile as ad-supported documentation even though the package deliberately excludes ads from the trust page. Both suites passed against PR #12 without the profile. These findings belong to the package's new route integration.

## Evidence

- `tmp/phase2/maintainer-review-a2/report.json` and `tmp/phase2/maintainer-review-a2/{chromium,webkit}-<width>.png` contain the 14 independent browser cases and screenshots. `tmp/phase2/review-maintainer-browser.mjs` is the local harness.
- `tmp/phase2/package-a2-*.log` contains existing audit output. Baseline comparisons are in `tmp/phase2/package-a-baseline-routes.log` and `tmp/phase2/package-a-baseline-monetization.log`.

## Final integration corrections

A3 classifies the new profile in the existing legal/trust route family; ad lifecycle is unchanged. The separate technical prerequisite registers its nested URL in the HTTP smoke map. A3 Node 20 typecheck, build, npm test, server syntax check, HTTP routes and monetization audits passed. A2 visual content is unchanged in A3. Exact package SHA is recorded in the Phase 2 release queue. Exact foundation commit 78dda78994ea90e7b3a839725021bc316463434e passed GitHub Linux/Node 20 CI run 43440813136; this is foundation CI, not package-head CI. Owner approval and production verification remain pending.
