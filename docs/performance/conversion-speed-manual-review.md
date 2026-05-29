# Conversion Speed Manual Review

Branch: `may-28-2026-speed-fix`

Baseline commit: `2b0a30c5fd1971e80a7a3cdcb10cd76090599ce5`

Local preview URL: `http://localhost:3000`

This branch is frozen for manual testing. Do not merge until the checks below pass with user visual approval.

## What Improved

- Large default layered conversions now skip the browser worker path when that work would only fall back to the same server-generated output.
- Focused output-equivalence checks preserved dimensions, preset IDs, group counts, file sizes, hashes, editability, and copy/download parity for the covered `IMG_8846` and `IMG_9404` cases.
- JPG/PNG layered Cricut route behavior was tightened so stale pending jobs should not mask the newest selected preset result.
- Full preset smoke passed with 8,969 checks and 0 failures.

Expected rough timings from the speed branch:

| Image | Preset | Expected Time |
| --- | --- | ---: |
| `IMG_8846.JPEG` | Layered - Flat Color | about 34s |
| `IMG_9404.JPEG` | Layered - Flat Color | about 33s |
| `IMG_8846.JPEG` | Layered - Detail | about 25s |
| `IMG_9404.JPEG` | Layered - Detail | about 43s |

Amazing Quality remains compute-heavy. It should not hang, but it may still be slower than the default layered presets.

## Test Images

Use these local files:

- `C:\Users\Suhas\Downloads\IMG_8846.JPEG`
- `C:\Users\Suhas\Downloads\IMG_9404.JPEG`
- `C:\Users\Suhas\Downloads\IMG_9288.JPEG`
- `C:\Users\Suhas\Downloads\IMG_9448.JPEG`
- `C:\Users\Suhas\Downloads\charming-tomato-512x512.png` if available

## Presets To Test First

- Layered - Flat Color
- Layered - Detail
- Layered - Flat Color (Amazing Quality)
- Layered - Amazing Quality
- Photo Many Colors (Amazing Quality)

For each image and preset, record:

- Conversion starts correctly.
- No duplicate pending outputs appear.
- No stale/default output masks the selected preset.
- Time to completed output.
- Output title matches the selected preset.
- Settings/Edit opens.
- Layer colors opens where applicable.
- Copy SVG works.
- Download SVG works.
- Output dimensions are preserved.
- Output quality looks unchanged from before the speed pass.
- Amazing Quality still looks like the same Amazing output.
- The route does not get stuck.
- The browser does not freeze.

## Route Pages To Test

Test the same core behavior on:

- `/`
- `/png-to-layered-svg-for-cricut`
- `/jpg-to-layered-svg-for-cricut`
- `/png-to-svg-for-silhouette`
- `/png-to-svg-converter`

For route-specific pages, pay extra attention to:

- Selected preset matches the completed output title.
- Switching presets does not leave an old pending card active.
- Uploading a second file does not reuse the previous file result.
- Settings/Edit remains responsive after conversion.
- Layer colors remains responsive on layered outputs.

## Merge Approval Checklist

Merge only if:

- Speed improves without visible quality regression.
- Output dimensions, groups, and file sizes remain equivalent.
- No duplicate jobs or stale pending behavior appears.
- Route pages behave consistently.
- Copy, download, Settings/Edit, and Layer colors still work.
- Amazing Quality output still visually matches the pre-speed branch output.

Reject or revise if:

- Output quality changed.
- Amazing Quality looks worse.
- The selected preset does not match the completed output.
- Pending cards duplicate, stick, or hide newer results.
- Route pages regress.
- Default Layered - Flat Color still takes 2 to 3 minutes on `IMG_8846` or `IMG_9404`.
- Settings/Edit or Layer colors becomes slow or broken.

## Known Concerns

- Amazing Quality is still dominated by real server/VTracer compute and may exceed preferred timing targets.
- Manual visual comparison is still required because the automated checks can prove structural equivalence for focused cases, but they do not replace user quality approval.
- Route-specific duplicate and stale pending behavior should be checked by hand on the listed JPG/PNG layered and Silhouette/converter pages before merge.
