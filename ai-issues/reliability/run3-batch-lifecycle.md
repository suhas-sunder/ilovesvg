# Run 3 homepage batch request lifetime

On the PR #4 production build, a batch sent its first fallback POST without a cancellation signal. In a browser test that paused the request before sending it, the user could navigate to the guide and the upload still reached the server afterward. The server returned 200 for work the user could no longer retrieve.

The homepage now captures its route lifetime signal once for the batch. Both the client tracer and the fallback request use it. Unmount aborts an outstanding fetch, prevents the next file from starting, and skips cancellation-related error reporting and ZIP publication. The existing server gate controls native work that has already started.

The changed path is the homepage batch and its fallback through /api/batch-svg, which delegates to the homepage action. A two-file ZIP with identical source names still has two numbered entries. The test verifies the downloaded SVG dimensions and samples distinct opaque and transparent pixels in each entry. For a mixed batch the invalid PNG returns HTTP 415, the UI reports one failed file, and the ZIP contains the successful file only.

Chromium desktop and WebKit with iPhone viewport and touch emulation passed all three cases on the Node 20 production build. WebKit uses the visible picker with disk files in the final test. Early programmatic upload and hidden-input click attempts were harness limitations. The rendered mobile partial-batch result and the desktop result were inspected. No physical iPhone was used. Typecheck, build, npm test, server syntax, whitespace and conversion actions passed.

Run scripts/batch-navigation-browser.mjs against a local production build. Set BASE_URL, PLAYWRIGHT_MODULE and optional RASTER_CHROMIUM_EXECUTABLE for a local browser installation. Set BATCH_BROWSER=webkit and BATCH_MOBILE=1 to repeat the mobile emulation. Reports and screenshots go to the ignored BATCH_BROWSER_OUT directory.
