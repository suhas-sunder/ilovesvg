# Reproduce the SVG conversion examples

The six examples were captured from the PNG to SVG browser interface on application foundation `78dda78994ea90e7b3a839725021bc316463434e`. The original synthetic SVG artwork is defined in [generate.mjs](generate.mjs) and rasterized before upload. The lettering uses constructed shapes. The photographic example starts with [The Blue Marble From Apollo 17](https://svs.gsfc.nasa.gov/30613/), courtesy of the Earth Science and Remote Sensing Unit, NASA Johnson Space Center. Its source JPEG is reduced from 1024 × 1024 to 384 × 384. This is an editorial comparison of source and trace. [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

Run the pinned foundation as a local production build and point the generator at it. Provide a local Playwright installation with Chromium available. Set `PLAYWRIGHT_MODULE` to the absolute path to its `index.mjs` if it is installed outside this repository.

```powershell
$env:BASE_URL = "http://127.0.0.1:5280"
node ai-issues/releases/weekly/phase2-examples/generate.mjs
```

The generator selects a preset in a fresh browser context, uploads one image, waits for conversion and saves the actual **Download SVG** result. It records the converter's submitted form settings with the original file and transient run ID omitted. It uses the downloaded SVG to render a PNG preview with Sharp. The output goes to `public/examples/output-inspection`, with browser screenshots in `tmp/phase2/example-capture`. The [manifest](../../../../public/examples/output-inspection/manifest.json) includes dimensions, bytes, hashes, preset identifiers, source attribution, SVG element counts and observed limitations. Subpaths are counted from move commands inside path data.

Two captures using Chromium 147.0.7727.15 and Sharp 0.34.3 produced identical hashes for all six sources, SVGs and previews. The generator checks SVG parsing, output dimensions, path presence and absence of embedded images in every download. It also checks the hole, bridge and disk in the cut example and the ring and margins in the camera icon. The previews were visually compared with the sources. Palette shifts, smoothed outlines and loss of fine detail remain visible. Output size and contour counts vary with the artwork and preset. The examples were inspected as SVG geometry and rendered images. Design Space import and physical cuts need their own verification.
