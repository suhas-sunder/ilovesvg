# Phase 3 conversion acceptance

Local, independent acceptance against the PR #11 technical foundation
`c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4`, the PR #12 Phase 1 head
`78dda78994ea90e7b3a839725021bc316463434e`, and the repaired integrated
tracked tree `7bc288cb5b4076101de77d8c1c042be901020417`. The untouched PR #21
application `40856446cf75a0a58070b72bf218002789bad48d` served as a reproduction
control. Local Node 20.20.2, Playwright Chromium 147.0.7727.15 and WebKit 26.4.
Both engines ran on Windows. WebKit mobile layouts used emulation. Clipboard
coverage dispatched scoped paste events with synthetic raster Files and checked
the native text-field event remained uncanceled. The original phone and artwork
were unavailable. [Machine-readable results](conversion-results.json)

## Two confirmed ownership defects

- **Delayed PNG upload validation.** The upload generation guarded only the
  initial format and size read. A delayed second header read resumed after the
  user cleared or replaced the upload. Removal yielded a real POST and a
  completed history card. Same-name replacement yielded two POSTs and cards
  even when the correct replacement had already finished. Route exit during
  the second read prevented the POST but allocated an abandoned source snapshot.
  Chromium reproduced the same three failures on PR #12. The repair checks
  selection generation and exact File identity before and after validation,
  including its error path. Both engines now pass remove, replace, navigation
  during each of the two reads, and canceled hybrid work blocked on fingerprint.
  Replacement exports exactly one 96 × 72 circle, verified by dimensions,
  positive/negative pixel probes and SHA-256. [Upload regression](conversion-png-ownership.mjs)
- **History retrace could use the wrong artwork.** Home and PNG matched history
  sources by display filename. Replacing the source with different artwork
  under the same name then updating the older result replaced the saved
  160 × 120 rectangle with the new 96 × 72 circle. A response-cache hit produced
  no additional POST, so request counts alone missed the corruption. The
  repair compares the actual selected source before retrace or retry and
  checks selection and history ownership again after the await. It reuses
  the existing per-File fingerprint promise, takes a fast path for the same
  File, and compares in 64 KiB chunks if the fingerprint API is unavailable.
  The fallback stops after the current chunk if its source or card has
  changed. File references live with existing bounded history (10 cards per
  route) and its active jobs. The equal-length, same-name fixture now preserves
  the old download on both routes in both engines. Reselecting the original
  bytes in a new File permits retrace and re-enables previous-version navigation.
  [History regression](conversion-history-identity.mjs)

Implementation commit `226c7233551326f1fbc248bc5d64f1bbacead6a2` changes the
two routes and the source snapshot utility. Already submitted history jobs
retain their established lifecycle. Source comparison stays in the browser.
The correction has no tracing engine, preset, default, metadata or analytics
changes.

## Browser workflows

- Clipboard confirmation/discard, rejection of empty or unsupported clipboard
  input, text input exemption, same-name picker replacement, saved output
  download and focus exclusion all passed on Home at desktop width and PNG at
  390 CSS pixels in both engines. The pasted rectangle download matches the
  PR #11 picker download byte for byte.
- Home delayed measurement, pre-submit validation and fingerprint replacement
  probes passed six scenarios per engine. The PNG probes above compare actual
  downloads and correlate work with the owning selection.
- Delayed browser worker failure, shared-job cancellation, and same-name
  replacement during a server request passed two scenarios per engine. Each
  shared run triggered one real fallback. Same-name replacement produced the
  identical SVG SHA-256 across engines. The WebKit synthetic-worker branch
  supplied a capability stub because this runner lacks OffscreenCanvas.
- A separate fault injection held the browser worker or the fallback POST, then
  navigated to the documentation via the footer. Both stages passed on both
  routes in both engines. Pending workers terminated, canceled browser work
  produced zero POSTs, and exiting during fallback produced no second POST or
  visible stale result. [In-flight navigation probe](conversion-navigation.mjs)
- Fullscreen arrow navigation, forward/backward focus wrapping, 44 px close
  target, focus restoration and first/second Escape passed on Home 320 and PNG
  390 in both engines. Rendered mobile measurements confirmed input → output →
  original on all four route/engine pairs, with zero horizontal overflow.
  The responsive navigation audit passed five mobile and five desktop widths
  and focus transfers across the breakpoint. Preset keyboard interactions
  passed on both routes in both engines. [Mobile order probe](conversion-mobile-order.mjs)
- The Node 20 conversion action smoke passed 51 scenarios, including real file
  conversion and malformed-header, empty-file and format-mismatch rejection.

## Output preservation

Eleven independent synthetic cases and the existing public Blue Marble raster
derivative were uploaded through the real UI on each baseline and on the exact
repaired snapshot. The assets include a logo, silhouette with cutout, color
illustration, translucent icon, photograph, fine lettering, thin lines,
pale text, patterned background, overlapping layers, a 4,800 × 3,400 input
and an 8 × 8 input. The suite selected supported layered/photo presets where
appropriate and left both default presets alone. Actual browser downloads
yielded 24 complete candidate cases, each with exact same-browser input,
download, preview markup and browser preview pixel hashes compared with both
baselines. DOM inspection and independent rasterization verify geometry,
subpaths, fill and opacity data, grouping, alpha, bounded ink probes and
preview/download equivalence. All candidate workers, measured bitmaps and
tracked URL allocations had been released after route exit. [Corpus harness](conversion-corpus.mjs)

Chromium used browser VTracer with zero upload POSTs in the five color cases.
The local WebKit runner used the existing compatible server Potrace path once
per case. The engines produced the same downloads for the seven single-color
cases and different, stable output for the five color cases. For the large
image, both exported the established 3,000 × 2,125 SVG. WebKit reported a
density-adjusted 684 × 484 intrinsic image size for its preview, with matching
aspect and unchanged preview markup across builds. Candidate downloads ranged
from 280 to 89,461 bytes in Chromium and 280 to 159,951 bytes in WebKit.
Observed upload-to-download-ready intervals ranged from 0.25 to 6.53 s in
Chromium and 0.33 to 2.10 s in WebKit, with per-case baseline/candidate times
recorded separately. Local samples included concurrent browser activity and
are descriptive timing observations.

The visual comparison shows unchanged limitations. Compact dark lettering
gains ink and loses readability as glyphs shrink. All six test line bands
remain visible, with thickness changes at their ends. The default preset
loses the pale glyphs entirely while retaining the dark calibration mark.
Chromium's translucent input icon loses its half-alpha fill, the photo
posterizes, and overlapping layers simplify. These differences from the
input were present on both baselines. [Reviewed source and preview contact sheet](screenshots/conversion-corpus-contact.png)
