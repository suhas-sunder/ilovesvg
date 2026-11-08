# First-party evidence available in this pass

Observed November 8, 2026 via the parent pass's connected iLoveSVG PostHog project **289839**, one-off 28-day `tool_engagement` aggregation. These are event counts, not distinct people or sessions, and not a joined conversion funnel. The query's exact observation window and filtering are retained in the main reliability report; do not use the numbers as a permanent popularity ranking.

| Existing workflow | Observed events |
| --- | --- |
| Background editor | uploads 172; previews 153; downloads 109 |
| Resize | uploads 86; downloads 77 |
| SVG to PDF | started 30; completed 26 |
| Line art | started 18; completed 7 |

Selected reported country/device counts: US desktop background downloads 16, resize downloads 14 and Canva resizer downloads 11; Canada background downloads 9. These prove some observed use of established workflows in relevant cohorts. They do not establish SEO source, country revenue, true success rates or missing-page demand. The start/completion difference in line art is an investigation target; it is not a measured failure rate because cancellation, retries, event coverage and journey ownership have not been joined.

The recent event taxonomy had no `conversion_failed` event and exception autocapture was off. Consequently an absence of error events is not proof that conversions did not fail. This pass does not add artwork/filename telemetry or enable exception capture as an incidental SEO change.

GSC Wizard returned `subscription_required`. Query/page rankings, impressions, CTR, index coverage and search-driven cohorts therefore remain unavailable from that connector. AdSense revenue was not obtained. Do not claim there is no analytics: aggregate PostHog data exists, with the limitations above.

Decision: protect and verify established background/resize/PDF workflows before adding speculative URLs. The maintainer draft still has direct owner-request evidence. Mobile help has owner-reported failure evidence, and vector inspection is a qualitative documentation opportunity. None becomes schedule-approved solely from these event counts.
