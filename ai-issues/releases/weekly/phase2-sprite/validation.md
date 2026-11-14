# SVG Sprite Generator validation

Independent acceptance on November 13, 2026 against the local production-mode F2 build of tree `047770ff48767177974374052839f8e371beb58c`. The served app includes the synchronous ownership cleanup and explicitly associated Symbol label. No publication or production verification was performed.

| Check | Chromium | WebKit |
| --- | --- | --- |
| Parser, chooser, keyboard, examples, removal, copy controls, errors and recovery | Pass, 59 rejection and boundary cases | Pass, 59 rejection and boundary cases |
| Actual downloaded SVG embedded with the tool's HTML snippet | Pass, geometry and sampled gradient/solid pixels | Pass, geometry and sampled gradient/solid pixels |
| Preview compared with three original icons | Worst mean channel delta 0.5042 of 255 | Worst mean channel delta 0.5357 of 255 |
| Drop, stale file and copy ownership, blob URL cleanup, request marker check | Pass | Pass |
| Installed PostHog replay recorder with live route mutations | 15 local events, outside positive control present, private marker absent | 17 local events, outside positive control present, private marker absent |
| Isolated near-budget resource cases | Five pass, slowest accepted preview 148 ms | Five pass, slowest accepted preview 136 ms |
| Empty/ready layout widths | 320, 375, 390, 430, 768, 1024, 1440, 2560 px pass | 320, 375, 390, 430, 768, 1024, 1440 px pass |
| Scoped axe WCAG 2/2.1 A and AA | Zero violations in empty and ready at 320/1440 px and error at 320 px | Zero violations in empty and ready at 320/1440 px and error at 320 px |

The Chrome 2560 px whole-page scan reported `aria-prohibited-attr` on two global ad wrappers and the contextual wrapper. The neighboring SVG Embed Code Generator reported the same rule on shared wrappers. The contextual slot was below the editor. Tests intercepted third-party HTTP requests, including ads and analytics. No genuine ad-network behavior, production analytics settings, native clipboard integration, physical device or Safari app was verified.

[Security and architecture findings](../../../seo/phase2/sprite-independent-review.md). [320 px WebKit error](screenshots/webkit-320-error.png) · [390 px WebKit ready](screenshots/webkit-390-ready.png) · [1440 px Chromium ready](screenshots/chromium-1440-ready.png) · [2560 px Chromium viewport](screenshots/chromium-2560-viewport.png).

## Reproduce

Use Node 20.11 or newer and installed Playwright Chromium/WebKit. Set `PLAYWRIGHT_MODULE` to the Playwright entry point if Playwright is installed outside the repository. Set `AXE_SOURCE` to the installed `axe-core/axe.min.js` when axe-core is outside normal resolution. With a locally served production build, run these commands from the repository root.

```powershell
$env:BASE_URL = 'http://127.0.0.1:5292'
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-browser.mjs
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-ownership.mjs chromium
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-ownership.mjs webkit
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-replay.mjs
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-resources.mjs
node ai-issues/releases/weekly/phase2-sprite/svg-sprite-responsive.mjs
```

`SPRITE_OUT_DIR` optionally overrides the screenshot and download directory. The resource harness starts an isolated loopback server and uses a subprocess watchdog for each input.

## Technical integration

Node 20 typecheck, build, npm test, server syntax and diff checks passed on F2. The primary reviewer separately ran the full parser/UI/download suite against F2 in both engines and inspected screenshots; 59 rejection cases per engine and actual inline pixels passed. The prior integrated snapshot also passed all 12 suites listed in integrated-suite-results.json, native-memory retention, public-content and monetization browser checks. F2 changes were limited to synchronous unmount ownership and the explicit Symbol label. No protected conversion/ad lifecycle code changed. Exact application-source diff between the final worktree and F2 tree was empty before committing.
