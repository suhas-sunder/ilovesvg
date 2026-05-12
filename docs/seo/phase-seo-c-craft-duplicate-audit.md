# Phase SEO-C-A Craft Duplicate and Thin-Page Audit

Date: 2026-05-10

Scope: report-only audit of Cricut, craft, sticker, vinyl, laser, Silhouette, Glowforge, Etsy, Shopify, Printify, Printful, Canva, Figma, sticker print, and transparent PNG route clusters. No code, route URL, metadata, page copy, sitemap, navigation, conversion, preset, upload validation, or deployment changes were made.

Baseline reviewed:

- Branch: `final-refactor-and-polish-may-10-v2`
- Current HEAD during baseline: `ef665f5 fix: prioritize high-intent tools in main nav`
- Prior SEO-A audit: `f1998b5 docs: add SEO audit report`
- Prior SEO-B implementation: `2141473 seo: improve core converter metadata and content`
- Tracked diffs before audit: none
- Existing untracked directories left untouched: `docs/qa-robustness-review/`, `test-artifacts/`

Files inspected:

- `app/data/routeManifest.ts`
- `app/data/routeMeta/marketplaceCraft.ts`
- `app/data/routeMeta/marketplaceExport.ts`
- `app/data/routeMeta/svgPlatformTools.ts`
- `app/data/routeMeta/canvaFigma.ts`
- `app/data/routeMeta/faviconExport.ts`
- `app/routes/`
- `app/client/components/navigation/toolNavSections.ts`
- `docs/seo/phase-seo-a-audit.md`
- `package.json`

Rendered evidence source:

- Canonical local origin: `http://localhost:3000`
- Checked current title, meta description, canonical, H1, H2/H3 lower-page sections, FAQ JSON-LD, FAQ microdata, Breadcrumb JSON-LD, route manifest indexability, sitemap classification, source file, route family, and navigation grouping for the audited routes.

## 1. Executive Summary

The craft and marketplace surface is valuable, but it needs differentiated SEO work before broad implementation. Exact duplicate titles, meta descriptions, and H1s were not found in the audited set. The real duplicate risk is page-body and FAQ repetition:

- Several platform wrapper pages inherit generic converter copy and only change the platform name in title, H1, and metadata.
- Some rendered sections mismatch the route intent, for example `Image to SVG for Silhouette`, `Image to SVG for Glowforge`, and `Image to SVG for Etsy` currently render Cricut-oriented lower-page headings.
- `PNG to SVG for Shopify` currently renders Etsy-oriented H2/H3 copy, which is the clearest marketplace mismatch.
- Sticker variants for generic, Cricut, Silhouette, and Etsy share the same core sticker page structure; the Silhouette and Etsy pages need platform-specific workflow guidance before further FAQ/schema expansion.
- SVG cleaner and resizer platform routes are useful utilities, but they are the highest thin-page and doorway-like risk because current page value is mostly the shared tool plus a short platform framing layer.
- Printify and Printful pages are not bad pages, but they are currently very close to each other and need print-on-demand specific differentiation if expanded.

No deletion is recommended in this phase. No noindex or canonical change is recommended without Search Console/Bing data. The safest first implementation batch is still the high-intent Cricut/sticker subset because those routes already have the strongest route-specific utility and the clearest user need.

## 2. Route Clusters Audited

All routes below are public, indexable, self-canonical, and included in the XML/HTML sitemap unless a row says otherwise. Every audited route renders Breadcrumb JSON-LD.

### Cricut Routes

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/cricut-svg-converter` | Source: `app/routes/cricut-svg-converter.tsx`<br>Family: `cricut-craft`<br>Title: `Cricut SVG Converter \| Free PNG JPG to SVG for Cricut - iLoveSVG`<br>Description: `Convert PNG, JPG, and image artwork into SVG files for Cricut Design Space workflows, vinyl decals, stickers, labels, stencils, and craft projects.`<br>H1: `Cricut SVG Converter` | Sections: Cricut-ready SVG cut files, vinyl/stickers/labels/stencils, best projects, settings, common problems, All SVG tools.<br>FAQ/schema: visible FAQ-style questions, no FAQ JSON-LD or FAQ microdata detected, Breadcrumb JSON-LD.<br>Related links: Craft & Cut Files nav, sibling Cricut and generic converter links. | Intent: broad Cricut SVG conversion hub.<br>Primary keyword: cricut svg converter.<br>Secondary: image to SVG for Cricut, Cricut cut file converter, PNG JPG to SVG for Cricut.<br>Risk: acceptable duplicate risk, hub can overlap children.<br>User value: 5/5.<br>Action: keep as hub; avoid stuffing every child keyword into this page. |
| `/image-to-svg-for-cricut` | Source: `app/routes/image-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Image to SVG for Cricut \| Free Cricut Cut File Converter - iLoveSVG`<br>Description: `Convert PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, and SVG images into clean SVG files for Cricut Design Space. Free image to SVG converter for Cricut cut files, decals, labels, stencils, and stickers.`<br>H1: `Image to SVG for Cricut` | Sections: common image formats, practical workflow notes, format guidance, settings that matter for Cricut cuts, before-cut sanity check.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Craft & Cut Files, format-specific Cricut routes, All SVG tools. | Intent: broad file-format intake for Cricut.<br>Primary keyword: image to SVG for Cricut.<br>Secondary: Cricut cut file converter, convert image to SVG for Cricut.<br>Risk: duplicate-risk with `/cricut-svg-converter` and format-specific pages.<br>User value: 4/5.<br>Action: clarify this as broad input-format route; keep hub/page distinction tight. |
| `/png-to-svg-for-cricut` | Source: `app/routes/png-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Cricut - Cut File Converter \| iLoveSVG`<br>Description: `Convert PNG artwork into SVG files for Cricut Design Space, vinyl decals, stickers, labels, stencils, and maker projects with cut-friendly presets.`<br>H1: `PNG to SVG for Cricut` | Sections: single-color SVG cut files, Cricut Design Space/vinyl/stickers/labels, best Cricut uses, preset choice, advanced settings, import tips.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: `/cricut-svg-converter`, vinyl, stickers, layered Cricut, generic PNG to SVG. | Intent: highest-intent PNG to Cricut cut file route.<br>Primary keyword: PNG to SVG for Cricut.<br>Secondary: Cricut PNG to SVG, Cricut cut file converter, SVG for Design Space.<br>Risk: low to moderate, strong route-specific value.<br>User value: 5/5.<br>Action: first SEO-C-B candidate; improve without changing behavior. |
| `/jpg-to-svg-for-cricut` | Source: `app/routes/jpg-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `JPG to SVG for Cricut - Free Cricut SVG Converter \| iLoveSVG`<br>Description: `Convert JPG images to clean SVG files for Cricut projects. Make cut-friendly SVGs for vinyl decals, stickers, logos, handwriting, and simple craft designs.`<br>H1: `JPG to SVG for Cricut` | Sections: JPG to cleaner SVG, practical workflow notes, best uses, preset choice, cleanup, troubleshooting.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Craft & Cut Files, format routes, All SVG tools. | Intent: JPG-specific Cricut input.<br>Primary keyword: JPG to SVG for Cricut.<br>Secondary: JPEG to SVG for Cricut, photo to SVG for Cricut.<br>Risk: duplicate-risk with `/jpeg-to-svg-for-cricut`.<br>User value: 4/5.<br>Action: keep both only if JPG/JPEG search data supports it; otherwise future canonical/noindex review. |
| `/jpeg-to-svg-for-cricut` | Source: `app/routes/jpeg-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `JPEG to SVG for Cricut - Free Cricut SVG Converter \| iLoveSVG`<br>Description: `Convert JPEG images to clean SVG files for Cricut projects. Make cut-friendly SVGs for vinyl decals, stickers, logos, handwriting, and simple craft designs.`<br>H1: `JPEG to SVG for Cricut` | Sections mirror JPG page with JPEG wording.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Craft & Cut Files, JPG/JPEG siblings, All SVG tools. | Intent: JPEG spelling variant.<br>Primary keyword: JPEG to SVG for Cricut.<br>Secondary: JPG to SVG for Cricut.<br>Risk: high cannibalization with `/jpg-to-svg-for-cricut` because description and body are near-identical except term swap.<br>User value: 3/5.<br>Action: defer implementation; review search data before investing. |
| `/webp-to-svg-for-cricut` | Source: `app/routes/webp-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `WebP to SVG for Cricut - Free Cricut SVG Converter \| iLoveSVG`<br>Description: `Convert WebP images to clean SVG files for Cricut projects. Make cut-friendly SVGs for vinyl decals, stickers, logos, handwriting, and simple craft designs.`<br>H1: `WebP to SVG for Cricut` | Sections mirror format-specific Cricut pages with WebP wording.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Craft & Cut Files, format siblings, All SVG tools. | Intent: WebP input for Cricut users.<br>Primary keyword: WebP to SVG for Cricut.<br>Secondary: convert WebP to SVG for Cricut.<br>Risk: acceptable but lower demand.<br>User value: 3/5.<br>Action: defer until after core Cricut/sticker routes. |
| `/photo-to-svg-for-cricut` | Source: `app/routes/photo-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Photo to SVG for Cricut - Free Cricut Photo Converter \| iLoveSVG`<br>Description: `Convert photos to clean SVG files for Cricut projects. Make photo outlines, silhouettes, sticker-style SVGs, and simple Cricut cut files from pictures.`<br>H1: `Photo to SVG for Cricut` | Sections: photo SVG workflow, presets, cleanup, troubleshooting.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: photo/outline/Cricut siblings. | Intent: photo-to-outline/silhouette SVG for Cricut.<br>Primary keyword: photo to SVG for Cricut.<br>Secondary: picture to SVG for Cricut, photo outline Cricut.<br>Risk: moderate, can overlap with image/JPG routes.<br>User value: 4/5.<br>Action: later route-specific photo limitations and examples. |
| `/black-and-white-image-to-svg-for-cricut` | Source: `app/routes/black-and-white-image-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Black and White Image to SVG for Cricut - Free Converter \| iLoveSVG`<br>Description: `Convert black and white images to clean SVG files for Cricut. Make cut-friendly SVGs, colored cut files, vinyl decals, sticker outlines, labels, and craft designs.`<br>H1: `Black and White Image to SVG for Cricut` | Sections: black and white artwork, presets, cleaner Cricut SVGs, troubleshooting.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Cricut and monochrome routes. | Intent: monochrome art to cut file.<br>Primary keyword: black and white image to SVG for Cricut.<br>Secondary: stencil SVG for Cricut, B&W to SVG Cricut.<br>Risk: acceptable, more specific than broad routes.<br>User value: 4/5.<br>Action: keep, later add examples around stencils and single-color vinyl. |
| `/line-art-to-svg-for-cricut` | Source: `app/routes/line-art-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Line Art to SVG for Cricut - Free Line Art SVG Converter \| iLoveSVG`<br>Description: `Convert line art to clean SVG files for Cricut. Make cut-friendly SVGs for drawings, coloring pages, handwriting, decals, stickers, labels, and craft outlines.`<br>H1: `Line Art to SVG for Cricut` | Sections: line art workflow, presets, cleaner results, troubleshooting.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: drawing/sketch/black-and-white routes. | Intent: line drawing to Cricut SVG.<br>Primary keyword: line art to SVG for Cricut.<br>Secondary: drawing SVG Cricut, coloring page SVG Cricut.<br>Risk: acceptable but overlaps drawing/sketch.<br>User value: 4/5.<br>Action: defer until drawing/sketch cluster can be differentiated together. |
| `/drawing-to-svg-for-cricut` | Source: `app/routes/drawing-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Drawing to SVG for Cricut - Free Hand Drawing to SVG Converter`<br>Description: `Convert drawings, sketches, doodles, kids' artwork, and hand lettering into Cricut-ready SVG files. Clean lines, remove speckles, smooth curves, and download SVG cut files online.`<br>H1: `Drawing to SVG for Cricut` | Sections: drawings, hand lettering, cleanup settings, common problems, backend limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: sketch, line art, Cricut siblings. | Intent: hand-drawn art cleanup for Cricut.<br>Primary keyword: drawing to SVG for Cricut.<br>Secondary: hand drawing to SVG, doodle to SVG Cricut.<br>Risk: acceptable, but overlaps sketch and line art.<br>User value: 4/5.<br>Action: defer, then differentiate by hand-drawn cleanup examples. |
| `/sketch-to-svg-for-cricut` | Source: `app/routes/sketch-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Sketch to SVG for Cricut - Free Layered Sketch SVG Converter`<br>Description: `Convert hand sketches, pencil sketches, scanned sketches, signatures, handwriting, and simple sketch-style artwork into layered SVG files for Cricut Design Space. Remove white backgrounds, adjust layers, recolor SVG groups, preview results, and download a Cricut-ready SVG.`<br>H1: `Sketch to SVG for Cricut` | Sections: sketch/scanned artwork, presets, settings, server limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: drawing/line art/layered Cricut. | Intent: scanned sketch to SVG, sometimes layered.<br>Primary keyword: sketch to SVG for Cricut.<br>Secondary: pencil sketch to SVG Cricut, signature to SVG Cricut.<br>Risk: moderate, long metadata and overlap with drawing/line art/layered routes.<br>User value: 4/5.<br>Action: rewrite later with honest sketch-specific examples and shorter metadata. |
| `/logo-to-svg-for-cricut` | Source: `app/routes/logo-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Logo to SVG for Cricut - Free Cricut Logo Converter \| iLoveSVG`<br>Description: `Convert logos to clean SVG files for Cricut projects. Make cut-friendly logo SVGs for vinyl decals, stickers, labels, signs, shirts, and craft designs.`<br>H1: `Logo to SVG for Cricut` | Sections: logo vectorization, presets, cleanup, troubleshooting.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: logo, Cricut, marketplace logo routes. | Intent: logo to cut-friendly SVG.<br>Primary keyword: logo to SVG for Cricut.<br>Secondary: Cricut logo converter, logo cut file.<br>Risk: acceptable; can overlap with general logo and Shopify/Etsy logo routes.<br>User value: 4/5.<br>Action: later differentiate logo cleanup and trademark/ownership limitations. |
| `/sticker-to-svg-for-cricut` | Source: `app/routes/sticker-to-svg-for-cricut.tsx`<br>Family: `cricut-craft`<br>Title: `Sticker to SVG for Cricut - Free Sticker Image to SVG Converter`<br>Description: `Convert sticker images, decals, labels, sticker sheets, and simple artwork into Cricut-ready SVG files. Clean edges, remove speckles, smooth curves, and download SVG cut files online.`<br>H1: `Sticker to SVG for Cricut` | Sections: sticker images, cleanup settings, common problems, practical workflow notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: sticker, Cricut sticker, Print Then Cut, All SVG tools. | Intent: sticker image to Cricut SVG.<br>Primary keyword: sticker to SVG for Cricut.<br>Secondary: sticker image to SVG Cricut, Cricut sticker cut file.<br>Risk: low to moderate, overlaps `/png-to-svg-for-cricut-stickers`.<br>User value: 5/5.<br>Action: first SEO-C-B candidate; distinguish from PNG sticker route by source type and use case. |
| `/layered-svg-for-cricut` | Source: `app/routes/layered-svg-for-cricut.tsx`<br>Family: `layered-svg`<br>Title: `Layered SVG for Cricut - Editable Color Layers \| iLoveSVG`<br>Description: `Create layered SVG files for Cricut workflows from PNG, JPG, JPEG, or WebP artwork. Separate colors, edit layers, preview, and download.`<br>H1: `Layered SVG for Cricut` | Sections: editable layered SVGs, presets, settings, server limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: layered route siblings. | Intent: broad layered SVG Cricut route.<br>Primary keyword: layered SVG for Cricut.<br>Secondary: create layered SVG for Cricut, color layers SVG.<br>Risk: hub overlaps format-specific layered routes.<br>User value: 5/5.<br>Action: keep as layered hub; defer until layered cluster plan. |
| `/image-to-layered-svg-for-cricut` | Source: `app/routes/image-to-layered-svg-for-cricut.tsx`<br>Family: `layered-svg`<br>Title: `Image to Layered SVG for Cricut - Free Online Layered SVG Converter`<br>Description: `Convert PNG and JPG images into layered SVG files for Cricut Design Space. Split artwork by color, adjust layer count, recolor individual layers, preview, and download a Cricut-ready layered SVG.`<br>H1: `Image to Layered SVG for Cricut` | Sections: color layers, layer count, recolor, backend limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: layered hub and PNG/JPG layered siblings. | Intent: broad image to layered SVG.<br>Primary keyword: image to layered SVG for Cricut.<br>Secondary: layered SVG converter for Cricut.<br>Risk: moderate overlap with layered hub and PNG/JPG layered pages.<br>User value: 4/5.<br>Action: defer; use as broad intake page only if search data supports. |
| `/png-to-layered-svg-for-cricut` | Source: `app/routes/png-to-layered-svg-for-cricut.tsx`<br>Family: `layered-svg`<br>Title: `PNG to Layered SVG for Cricut - Free Layered PNG SVG Converter`<br>Description: `Convert PNG artwork into editable layered SVG files for Cricut Design Space. Split colors into groups, recolor layers, preview, and download.`<br>H1: `PNG to Layered SVG for Cricut` | Sections: tracing detail, color cleanup, input/output colors, background/size/export, examples.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: layered and Cricut siblings. | Intent: high-intent PNG to layered SVG.<br>Primary keyword: PNG to layered SVG for Cricut.<br>Secondary: layered PNG SVG Cricut, split colors SVG Cricut.<br>Risk: low to moderate, strong value.<br>User value: 5/5.<br>Action: strong candidate after SEO-C-B or in layered-focused pass. |
| `/jpg-to-layered-svg-for-cricut` | Source: `app/routes/jpg-to-layered-svg-for-cricut.tsx`<br>Family: `layered-svg`<br>Title: `JPG to Layered SVG for Cricut - Free JPEG Layered SVG Converter`<br>Description: `Convert JPG and JPEG images into layered SVG files for Cricut Design Space. Split photos, decals, logos, and artwork into color layers, edit each layer, preview results, and download a Cricut-ready layered SVG.`<br>H1: `JPG to Layered SVG for Cricut` | Sections: JPG layered workflow, settings, tips, server limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: layered siblings. | Intent: JPG/JPEG to layered SVG.<br>Primary keyword: JPG to layered SVG for Cricut.<br>Secondary: JPEG layered SVG Cricut.<br>Risk: moderate, lower demand than PNG and broad image layered route.<br>User value: 4/5.<br>Action: defer. |
| `/logo-to-layered-svg-for-cricut` | Source: `app/routes/logo-to-layered-svg-for-cricut.tsx`<br>Family: `layered-svg`<br>Title: `Logo to Layered SVG for Cricut - Free Logo Layered SVG Converter`<br>Description: `Convert logos into layered SVG files for Cricut Design Space. Upload PNG, JPG, JPEG, or WebP logos, remove white backgrounds, split colors into editable SVG layers, recolor layers, preview results, and download a Cricut-ready SVG.`<br>H1: `Logo to Layered SVG for Cricut` | Sections: logo layers, presets, settings, tips.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: logo and layered siblings. | Intent: logo color separation for Cricut.<br>Primary keyword: logo to layered SVG for Cricut.<br>Secondary: layered logo SVG Cricut.<br>Risk: moderate, long metadata and overlap with logo-to-SVG.<br>User value: 4/5.<br>Action: defer; later clarify when layered output is better than single-trace output. |
| `/png-to-svg-for-cricut-print-then-cut` | Source: `app/routes/png-to-svg-for-cricut-print-then-cut.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Cricut Print Then Cut \| Free Print Then Cut SVG Maker`<br>Description: `Prepare PNG or JPG artwork for Cricut Print Then Cut workflows with printable color preservation, SVG cut outline output, preview, and download controls.`<br>H1: `PNG to SVG for Cricut Print Then Cut` | Sections: printable stickers/labels, color preservation, cut outline, offset control, limitations.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: stickers, Cricut PNG, sticker converter. | Intent: Print Then Cut preparation.<br>Primary keyword: PNG to SVG for Cricut Print Then Cut.<br>Secondary: print then cut SVG maker, Cricut sticker cut outline.<br>Risk: low, clearly differentiated.<br>User value: 5/5.<br>Action: first SEO-C-B candidate. |
| `/png-to-svg-for-cricut-stickers` | Source: `app/routes/png-to-svg-for-cricut-stickers.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Cricut Stickers \| Free Sticker Cut Outline Tool`<br>Description: `Turn PNG or JPG sticker artwork into Cricut-ready SVG output with smooth cut outlines, transparent-area checks, preview, and download controls.`<br>H1: `PNG to SVG for Cricut Stickers` | Sections: printable sticker SVG, cut outline, transparent-area checks, settings, expectations.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: sticker to SVG, Print Then Cut, Cricut PNG. | Intent: sticker cut outline from PNG/JPG.<br>Primary keyword: PNG to SVG for Cricut stickers.<br>Secondary: sticker cut outline tool, Cricut sticker SVG.<br>Risk: low to moderate, overlaps Print Then Cut and sticker-to-SVG.<br>User value: 5/5.<br>Action: first SEO-C-B candidate; keep focus on cut outline and transparent art. |
| `/png-to-svg-for-cricut-vinyl` | Source: `app/routes/png-to-svg-for-cricut-vinyl.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Cricut Vinyl \| Free Vinyl Cut File Converter`<br>Description: `Convert PNG or JPG artwork into single-color SVG cut files for Cricut vinyl decals, HTV shirts, labels, signs, stencils, and easier weeding.`<br>H1: `PNG to SVG for Cricut Vinyl` | Sections: vinyl cut files, decals/labels/signs/stencils, preset choice, weeding expectations.<br>FAQ/schema: no FAQ schema detected, Breadcrumb JSON-LD.<br>Related links: Cricut, vinyl, stickers, All SVG tools. | Intent: single-color vinyl/HTV cut files.<br>Primary keyword: PNG to SVG for Cricut vinyl.<br>Secondary: vinyl cut file converter, HTV SVG Cricut.<br>Risk: low, strongly differentiated from stickers.<br>User value: 5/5.<br>Action: include in SEO-C-D machine/material pass or add to SEO-C-B if capacity allows. |
| `/base64-to-svg-for-cricut` | Source: `app/routes/base64-to-svg-for-cricut.tsx`<br>Family: `text-base64-code`<br>Title: `Base64 to SVG for Cricut - Decode Base64 SVG Online`<br>Description: `Convert Base64 SVG code, SVG data URLs, and encoded SVG strings into downloadable Cricut-ready SVG files. Decode, clean, preview, copy, and export SVG files online.`<br>H1: `Base64 to SVG for Cricut` | Sections: decode Base64 SVG, settings, common problems, limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: developer/code nav and Cricut routes. | Intent: developer/code asset extraction for Cricut.<br>Primary keyword: Base64 to SVG for Cricut.<br>Secondary: data URL to SVG Cricut.<br>Risk: thin/cannibalization risk if treated like craft page; narrower technical route.<br>User value: 3/5.<br>Action: defer until code utilities pass. |
| `/code-to-svg-for-cricut` | Source: `app/routes/code-to-svg-for-cricut.tsx`<br>Family: `text-base64-code`<br>Title: `Code to SVG for Cricut - Convert Base64, Data URI, CSS, Markdown`<br>Description: `Extract images and SVG code from Base64, data URI strings, CSS url(...) values, Markdown image links, HTML snippets, JSON fields, and raw SVG markup. Convert raster data to SVG and style SVG output for Cricut.`<br>H1: `Code to SVG for Cricut` | Sections: supported inputs, settings, best for, limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: developer/code nav and Cricut routes. | Intent: extract code-embedded images/SVGs for Cricut use.<br>Primary keyword: code to SVG for Cricut.<br>Secondary: data URI to SVG Cricut, CSS image to SVG.<br>Risk: thin/cannibalization if optimized as craft route; real but niche.<br>User value: 3/5.<br>Action: defer until search data. |

### Sticker and Transparent PNG Routes

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/sticker-to-svg-converter` | Source: `app/routes/sticker-to-svg-converter.tsx`<br>Family: `raster-to-svg`<br>Title: `Sticker to SVG Converter - Clean Sticker Vectors \| iLoveSVG`<br>Description: `Convert sticker PNG or JPG artwork into SVG vectors for decals, labels, printable stickers, and cut-style graphics with cleanup presets and preview.`<br>H1: `Sticker to SVG Converter` | Sections: clean cut-friendly vectors, best for, how to convert, sticker settings, performance/limits, troubleshooting.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: generic image-to-SVG, sticker/Cricut/Silhouette/Etsy, All SVG tools. | Intent: generic sticker artwork to SVG.<br>Primary keyword: sticker to SVG converter.<br>Secondary: sticker PNG to SVG, decal to SVG, label to SVG.<br>Risk: low, strong generic sticker route.<br>User value: 5/5.<br>Action: first SEO-C-B candidate. |
| `/sticker-to-svg-for-cricut` | See Cricut cluster above. | See Cricut cluster above. | Intent: Cricut sticker cut-file workflow.<br>Risk: overlaps sticker generic and Cricut sticker PNG route.<br>User value: 5/5.<br>Action: first SEO-C-B candidate. |
| `/png-to-svg-for-cricut-stickers` | See Cricut cluster above. | See Cricut cluster above. | Intent: PNG/JPG sticker art to Cricut cut outline.<br>Risk: overlaps Print Then Cut and sticker-to-SVG.<br>User value: 5/5.<br>Action: first SEO-C-B candidate. |
| `/sticker-to-svg-for-silhouette` | Source: `app/routes/sticker-to-svg-for-silhouette.tsx`<br>Family: `cricut-craft`<br>Title: `Sticker to SVG for Silhouette \| iLoveSVG`<br>Description: `Convert sticker artwork into SVG for Silhouette-style sticker, decal, label, and vinyl workflows.`<br>H1: `Sticker to SVG for Silhouette` | Sections: currently shares generic sticker-to-SVG lower-page headings, then route-specific practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: Silhouette/sticker siblings, All SVG tools. | Intent: Silhouette sticker/vector prep.<br>Primary keyword: sticker to SVG for Silhouette.<br>Secondary: Silhouette sticker cut file, decal SVG Silhouette.<br>Risk: duplicate-risk because FAQ/body mostly matches generic sticker and Etsy sticker pages.<br>User value: 3/5.<br>Action: defer to machine-specific batch; add Silhouette Studio specific import/cut-line guidance before more schema. |
| `/sticker-to-svg-for-etsy` | Source: `app/routes/sticker-to-svg-for-etsy.tsx`<br>Family: `cricut-craft`<br>Title: `Sticker to SVG for Etsy \| iLoveSVG`<br>Description: `Convert sticker artwork into SVG for Etsy digital downloads, sticker previews, decals, and product artwork prep.`<br>H1: `Sticker to SVG for Etsy` | Sections: currently shares generic sticker-to-SVG lower-page headings, then Etsy practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: Etsy/sticker/export siblings, All SVG tools. | Intent: sticker assets for Etsy listings and downloads.<br>Primary keyword: sticker to SVG for Etsy.<br>Secondary: Etsy sticker SVG, digital sticker SVG prep.<br>Risk: duplicate-risk with generic and Silhouette sticker routes; marketplace intent needs more seller workflow detail.<br>User value: 3/5.<br>Action: include in SEO-C-C, not first batch. |
| `/sticker-to-png-for-printing` | Source: `app/routes/sticker-to-png-for-printing.tsx`<br>Family: `svg-export`<br>Title: `Sticker SVG to PNG for Printing \| iLoveSVG`<br>Description: `Export sticker SVG artwork to transparent PNG for printing previews, labels, decals, and product mockups.`<br>H1: `Sticker SVG to PNG for Printing` | Sections: generic SVG to PNG export sections plus sticker practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG export routes, sticker and transparent PNG routes. | Intent: export sticker SVG to transparent PNG for print preview/mockups.<br>Primary keyword: sticker SVG to PNG for printing.<br>Secondary: sticker PNG export, transparent sticker PNG.<br>Risk: moderate with `/svg-to-transparent-png-for-printing`.<br>User value: 4/5.<br>Action: improve in print/export batch, differentiate by sticker-specific output expectations. |
| `/transparent-png-to-svg-converter` | Source: `app/routes/transparent-png-to-svg-converter.tsx`<br>Family: `raster-to-svg`<br>Title: `Transparent PNG to SVG Converter \| iLoveSVG`<br>Description: `Convert transparent PNG logos, stickers, icons, and product artwork into SVG with background-aware tracing guidance.`<br>H1: `Transparent PNG to SVG Converter` | Sections: PNG to SVG for transparent backgrounds, background-aware tracing, best for, settings, limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: PNG-to-SVG, sticker, logo/icon routes. | Intent: transparent PNG tracing.<br>Primary keyword: transparent PNG to SVG.<br>Secondary: transparent logo to SVG, sticker PNG to SVG.<br>Risk: acceptable, but overlaps sticker/logo/icon routes.<br>User value: 4/5.<br>Action: keep, later clarify alpha/background limitations. |
| `/svg-to-transparent-png-for-printing` | Source: `app/routes/svg-to-transparent-png-for-printing.tsx`<br>Family: `svg-export`<br>Title: `SVG to Transparent PNG for Printing \| iLoveSVG`<br>Description: `Export SVG artwork as a transparent PNG for print previews, product mockups, stickers, and clean handoff files.`<br>H1: `SVG to Transparent PNG for Printing` | Sections: generic SVG to PNG export sections plus print practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG export, sticker print, POD routes. | Intent: transparent PNG export for print/mockups.<br>Primary keyword: SVG to transparent PNG for printing.<br>Secondary: SVG to transparent PNG, PNG for print preview.<br>Risk: moderate with `/sticker-to-png-for-printing`, Printify, Printful.<br>User value: 4/5.<br>Action: improve in print/export batch. |

### Vinyl, Laser Cutting, Silhouette, and Glowforge Routes

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/png-to-svg-for-cricut-vinyl` | See Cricut cluster above. | See Cricut cluster above. | Intent: single-color vinyl cut files.<br>Risk: low.<br>User value: 5/5.<br>Action: likely SEO-C-D, or SEO-C-B stretch route. |
| `/png-to-svg-for-laser-cutting` | Source: `app/routes/png-to-svg-for-laser-cutting.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Laser Cutting - Vector Cut Paths \| iLoveSVG`<br>Description: `Convert PNG or JPG artwork into SVG vector paths for laser cutting, scoring, engraving, wood, acrylic, cardstock, stencils, and maker projects.`<br>H1: `PNG to SVG for Laser Cutting` | Sections: vector paths for cut/score/engrave, laser uses, settings, limitations.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Glowforge, Cricut, SVG cleaner/resizer routes. | Intent: laser-cut vector path prep.<br>Primary keyword: PNG to SVG for laser cutting.<br>Secondary: laser cut SVG converter, image to vector for laser cutting.<br>Risk: low to moderate; must not overclaim machine compatibility.<br>User value: 5/5.<br>Action: SEO-C-D candidate; add machine-neutral laser limitations and examples. |
| `/png-to-svg-for-silhouette` | Source: `app/routes/png-to-svg-for-silhouette.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Silhouette \| Free Silhouette SVG Converter - iLoveSVG`<br>Description: `Convert PNG or JPG artwork into SVG files for Silhouette Studio, Cameo projects, vinyl decals, stickers, labels, and cut-file cleanup.`<br>H1: `PNG to SVG for Silhouette` | Sections: Silhouette Cameo/vinyl/stickers/cut files, converter workflow, settings, limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Silhouette and craft siblings. | Intent: main Silhouette PNG/JPG to SVG route.<br>Primary keyword: PNG to SVG for Silhouette.<br>Secondary: Silhouette SVG converter, Silhouette Studio cut file.<br>Risk: acceptable; best Silhouette entry point.<br>User value: 5/5.<br>Action: SEO-C-D candidate. |
| `/jpg-to-svg-for-silhouette` | Source: `app/routes/jpg-to-svg-for-silhouette.tsx`<br>Family: `cricut-craft`<br>Title: `JPG to SVG for Silhouette \| iLoveSVG`<br>Description: `Convert JPG artwork into SVG for Silhouette-style cutting, sticker prep, vinyl designs, and import testing.`<br>H1: `JPG to SVG for Silhouette` | Sections: generic JPG tips, best for, settings, limits, related tools.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Silhouette siblings. | Intent: JPG-specific Silhouette input.<br>Primary keyword: JPG to SVG for Silhouette.<br>Secondary: JPEG to SVG for Silhouette.<br>Risk: thin-risk if left generic.<br>User value: 3/5.<br>Action: defer; improve only after PNG Silhouette page. |
| `/image-to-svg-for-silhouette` | Source: `app/routes/image-to-svg-for-silhouette.tsx`<br>Family: `cricut-craft`<br>Title: `Image to SVG for Silhouette \| iLoveSVG`<br>Description: `Convert images into SVG for Silhouette-style vinyl, sticker, decal, label, and cutting software workflows.`<br>H1: `Image to SVG for Silhouette` | Sections currently include Cricut-oriented H2/H3 copy: `Convert common image formats into Cricut-ready SVG files`, `What this Cricut image converter is best for`, `How to convert an image to SVG for Cricut`.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Silhouette siblings, All SVG tools. | Intent: broad image-to-SVG for Silhouette.<br>Primary keyword: image to SVG for Silhouette.<br>Secondary: Silhouette image to SVG.<br>Risk: high duplicate/mismatch risk because body says Cricut.<br>User value: 2/5 until copy is corrected.<br>Action: SEO-C-D fix candidate; do not expand schema until body is corrected. |
| `/logo-to-svg-for-silhouette` | Source: `app/routes/logo-to-svg-for-silhouette.tsx`<br>Family: `cricut-craft`<br>Title: `Logo to SVG for Silhouette \| iLoveSVG`<br>Description: `Convert logo artwork into SVG for Silhouette-style vinyl, decals, labels, and clean resizing.`<br>H1: `Logo to SVG for Silhouette` | Sections: generic logo-to-SVG template plus Silhouette practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: logo/Silhouette/craft siblings. | Intent: logo vectorization for Silhouette projects.<br>Primary keyword: logo to SVG for Silhouette.<br>Secondary: logo cut file Silhouette.<br>Risk: moderate, shared logo template.<br>User value: 3/5.<br>Action: defer; add Silhouette-specific import/cut advice later. |
| `/sticker-to-svg-for-silhouette` | See sticker cluster above. | See sticker cluster above. | Intent: Silhouette sticker prep.<br>Risk: duplicate-risk.<br>User value: 3/5.<br>Action: SEO-C-D with Silhouette-specific rewrite. |
| `/svg-cleaner-for-silhouette` | Source: `app/routes/svg-cleaner-for-silhouette.tsx`<br>Family: `svg-editor`<br>Title: `SVG Cleaner for Silhouette \| iLoveSVG`<br>Description: `Clean SVG markup before Silhouette-style import, cutting software prep, sizing checks, and path review.`<br>H1: `SVG Cleaner for Silhouette` | Sections: generic SVG cleaner tool, what gets removed/kept, mode behavior, troubleshooting, Silhouette practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: SVG editing, Silhouette siblings. | Intent: clean SVG markup before Silhouette import.<br>Primary keyword: SVG cleaner for Silhouette.<br>Secondary: clean SVG for Silhouette Studio.<br>Risk: thin/doorway risk; useful tool but platform layer is shallow.<br>User value: 3/5.<br>Action: defer; consider noindex/canonical review only after search data. |
| `/svg-resizer-for-silhouette` | Source: `app/routes/svg-resizer-for-silhouette.tsx`<br>Family: `svg-editor`<br>Title: `SVG Resizer for Silhouette \| iLoveSVG`<br>Description: `Resize SVG artwork for Silhouette-style vinyl, sticker, decal, and cutting software projects.`<br>H1: `SVG Resizer for Silhouette` | Sections: generic SVG resize tool, best for, settings, limits, related tools.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG editing, Silhouette siblings. | Intent: SVG sizing for Silhouette projects.<br>Primary keyword: SVG resizer for Silhouette.<br>Secondary: resize SVG for Silhouette Studio.<br>Risk: high thin-page risk.<br>User value: 3/5.<br>Action: defer and review with search data. |
| `/png-to-svg-for-glowforge` | Source: `app/routes/png-to-svg-for-glowforge.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Glowforge \| iLoveSVG`<br>Description: `Convert PNG art into SVG for Glowforge-style laser prep, simplified outlines, engraving tests, and sizing cleanup.`<br>H1: `PNG to SVG for Glowforge` | Sections: laser cut/score/engrave paths, best laser uses, settings, important expectations.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: laser, Glowforge, SVG cleaner/resizer. | Intent: PNG art to SVG for Glowforge-style workflows.<br>Primary keyword: PNG to SVG for Glowforge.<br>Secondary: Glowforge SVG converter, image to SVG for Glowforge.<br>Risk: acceptable if wording stays honest about "Glowforge-style" prep.<br>User value: 5/5.<br>Action: SEO-C-D candidate. |
| `/jpg-to-svg-for-glowforge` | Source: `app/routes/jpg-to-svg-for-glowforge.tsx`<br>Family: `cricut-craft`<br>Title: `JPG to SVG for Glowforge \| iLoveSVG`<br>Description: `Convert JPG artwork into SVG for Glowforge-style laser prep, outline cleanup, engraving references, and test cuts.`<br>H1: `JPG to SVG for Glowforge` | Sections: generic JPG tips plus Glowforge practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Glowforge siblings. | Intent: JPG to laser-prep SVG.<br>Primary keyword: JPG to SVG for Glowforge.<br>Secondary: JPEG to SVG for Glowforge.<br>Risk: moderate thin/template risk.<br>User value: 3/5.<br>Action: defer until PNG Glowforge is improved. |
| `/image-to-svg-for-glowforge` | Source: `app/routes/image-to-svg-for-glowforge.tsx`<br>Family: `cricut-craft`<br>Title: `Image to SVG for Glowforge \| iLoveSVG`<br>Description: `Convert images into SVG for Glowforge-style laser prep, simplified outlines, engraving tests, and cleanup workflows.`<br>H1: `Image to SVG for Glowforge` | Sections currently include Cricut-oriented H2/H3 copy: `Convert common image formats into Cricut-ready SVG files`, `What this Cricut image converter is best for`, `How to convert an image to SVG for Cricut`.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Glowforge and laser siblings. | Intent: broad image-to-SVG for Glowforge-style workflows.<br>Primary keyword: image to SVG for Glowforge.<br>Secondary: Glowforge image to SVG.<br>Risk: high duplicate/mismatch risk because body says Cricut.<br>User value: 2/5 until corrected.<br>Action: SEO-C-D fix candidate; correct body before metadata/schema expansion. |
| `/logo-to-svg-for-glowforge` | Source: `app/routes/logo-to-svg-for-glowforge.tsx`<br>Family: `cricut-craft`<br>Title: `Logo to SVG for Glowforge \| iLoveSVG`<br>Description: `Convert logo artwork into SVG for Glowforge-style engraving, cutting prep, cleanup, and sizing checks.`<br>H1: `Logo to SVG for Glowforge` | Sections: generic logo-to-SVG template plus Glowforge practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Glowforge/logo siblings. | Intent: logo prep for engraving/cutting workflows.<br>Primary keyword: logo to SVG for Glowforge.<br>Secondary: Glowforge logo SVG.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: defer; add engraving/cutting-specific examples later. |
| `/svg-cleaner-for-glowforge` | Source: `app/routes/svg-cleaner-for-glowforge.tsx`<br>Family: `svg-editor`<br>Title: `SVG Cleaner for Glowforge \| iLoveSVG`<br>Description: `Clean SVG markup before Glowforge-style laser workflows, import testing, sizing checks, and path review.`<br>H1: `SVG Cleaner for Glowforge` | Sections: generic cleaner sections plus Glowforge practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: SVG editing, Glowforge siblings. | Intent: clean SVG before laser workflow/import checks.<br>Primary keyword: SVG cleaner for Glowforge.<br>Secondary: clean SVG for Glowforge.<br>Risk: high thin-page risk.<br>User value: 3/5.<br>Action: defer and review with search data. |
| `/svg-resizer-for-glowforge` | Source: `app/routes/svg-resizer-for-glowforge.tsx`<br>Family: `svg-editor`<br>Title: `SVG Resizer for Glowforge \| iLoveSVG`<br>Description: `Resize SVG artwork for Glowforge-style laser prep while keeping viewBox and dimensions predictable.`<br>H1: `SVG Resizer for Glowforge` | Sections: generic resize sections plus Glowforge practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG editing, Glowforge siblings. | Intent: size SVG for laser-prep workflows.<br>Primary keyword: SVG resizer for Glowforge.<br>Secondary: resize SVG for Glowforge.<br>Risk: high thin-page risk.<br>User value: 3/5.<br>Action: defer and review with search data. |

### Etsy Routes

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/png-to-svg-for-etsy` | Source: `app/routes/png-to-svg-for-etsy.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Etsy - Digital Download SVG Prep \| iLoveSVG`<br>Description: `Convert PNG or JPG designs into SVG files for Etsy digital downloads, craft bundles, stickers, decals, labels, and small-business product graphics.`<br>H1: `PNG to SVG for Etsy` | Sections: Etsy listings/digital downloads/shop assets, Etsy SVG workflow, settings, limits.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Marketplace & Design, Etsy siblings. | Intent: seller asset conversion for Etsy downloads/listings.<br>Primary keyword: PNG to SVG for Etsy.<br>Secondary: Etsy SVG digital download prep, Etsy seller SVG.<br>Risk: acceptable, strongest Etsy SVG page.<br>User value: 4/5.<br>Action: SEO-C-C candidate. |
| `/image-to-svg-for-etsy` | Source: `app/routes/image-to-svg-for-etsy.tsx`<br>Family: `cricut-craft`<br>Title: `Image to SVG for Etsy \| iLoveSVG`<br>Description: `Convert images into SVG for Etsy seller workflows, listing assets, digital downloads, mockup prep, and reusable graphics.`<br>H1: `Image to SVG for Etsy` | Sections currently include Cricut-oriented H2/H3 copy, then Etsy practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Etsy siblings. | Intent: broad image asset conversion for Etsy sellers.<br>Primary keyword: image to SVG for Etsy.<br>Secondary: Etsy image to SVG, listing asset SVG.<br>Risk: high mismatch risk because body says Cricut.<br>User value: 2/5 until corrected.<br>Action: defer; correct body before expansion. |
| `/jpg-to-svg-for-etsy` | Source: `app/routes/jpg-to-svg-for-etsy.tsx`<br>Family: `cricut-craft`<br>Title: `JPG to SVG for Etsy \| iLoveSVG`<br>Description: `Convert JPG artwork into SVG for Etsy shop assets, listing graphics, digital downloads, and simplified seller artwork.`<br>H1: `JPG to SVG for Etsy` | Sections: generic JPG tips plus Etsy practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Etsy siblings. | Intent: JPG listing art to SVG.<br>Primary keyword: JPG to SVG for Etsy.<br>Secondary: JPEG to SVG for Etsy.<br>Risk: moderate thin/template risk.<br>User value: 3/5.<br>Action: defer. |
| `/logo-to-svg-for-etsy` | Source: `app/routes/logo-to-svg-for-etsy.tsx`<br>Family: `cricut-craft`<br>Title: `Logo to SVG for Etsy \| iLoveSVG`<br>Description: `Convert Etsy shop logos and brand marks into SVG for scalable listing graphics, watermarks, and seller assets.`<br>H1: `Logo to SVG for Etsy` | Sections: generic logo conversion sections plus Etsy practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Etsy/logo/marketplace siblings. | Intent: shop logo and brand asset SVG prep.<br>Primary keyword: logo to SVG for Etsy.<br>Secondary: Etsy shop logo SVG, watermark SVG.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: SEO-C-C secondary candidate. |
| `/sticker-to-svg-for-etsy` | See sticker cluster above. | See sticker cluster above. | Intent: Etsy sticker/download artwork.<br>Risk: duplicate-risk with sticker siblings.<br>User value: 3/5.<br>Action: SEO-C-C candidate after generic/Cricut sticker pages. |
| `/svg-to-png-for-etsy` | Source: `app/routes/svg-to-png-for-etsy.tsx`<br>Family: `svg-export`<br>Title: `SVG to PNG for Etsy \| iLoveSVG`<br>Description: `Export Etsy listing preview images and digital product visuals from SVG with transparent or solid backgrounds.`<br>H1: `SVG to PNG for Etsy` | Sections: generic SVG to PNG output and export guidance, plus Etsy practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Etsy export, marketplace and SVG export routes. | Intent: listing preview/product image export from SVG.<br>Primary keyword: SVG to PNG for Etsy.<br>Secondary: Etsy listing PNG, digital product preview PNG.<br>Risk: moderate with general SVG to PNG and Printify/Printful PNG pages.<br>User value: 4/5.<br>Action: SEO-C-C candidate. |
| `/svg-to-jpg-for-etsy` | Source: `app/routes/svg-to-jpg-for-etsy.tsx`<br>Family: `svg-export`<br>Title: `SVG to JPG for Etsy \| iLoveSVG`<br>Description: `Export flattened JPG listing previews from SVG artwork for Etsy product images, mockups, and shop visuals.`<br>H1: `SVG to JPG for Etsy` | Sections: generic SVG to JPG export guidance plus Etsy practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: Etsy export, SVG export routes. | Intent: flattened JPG listing preview export.<br>Primary keyword: SVG to JPG for Etsy.<br>Secondary: Etsy product image JPG, SVG mockup JPG.<br>Risk: acceptable but lower demand than PNG.<br>User value: 3/5.<br>Action: SEO-C-C secondary candidate. |
| `/svg-resizer-for-etsy` | Source: `app/routes/svg-resizer-for-etsy.tsx`<br>Family: `svg-editor`<br>Title: `SVG Resizer for Etsy \| iLoveSVG`<br>Description: `Resize SVG assets for Etsy listing visuals, digital download previews, product graphics, and seller files.`<br>H1: `SVG Resizer for Etsy` | Sections: generic resizer sections plus Etsy practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG editing, Etsy siblings. | Intent: resize SVG previews/product graphics for Etsy.<br>Primary keyword: SVG resizer for Etsy.<br>Secondary: resize SVG for Etsy listing.<br>Risk: high thin-page risk.<br>User value: 2/5 until differentiated.<br>Action: defer and review search data before implementation. |

### Shopify Routes

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/png-to-svg-for-shopify` | Source: `app/routes/png-to-svg-for-shopify.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Shopify \| iLoveSVG`<br>Description: `Convert PNG store graphics into SVG for scalable Shopify brand assets, theme graphics, badges, logos, and cleanup before export.`<br>H1: `PNG to SVG for Shopify` | Sections currently include Etsy-specific lower-page headings: `PNG to SVG for Etsy listings, digital downloads, and shop assets`, `Best for Etsy sellers`, `How this Etsy SVG converter works`.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Marketplace & Design, Shopify siblings. | Intent: store graphics and brand assets to SVG.<br>Primary keyword: PNG to SVG for Shopify.<br>Secondary: Shopify SVG logo, Shopify theme SVG asset.<br>Risk: high mismatch risk because body says Etsy.<br>User value: 2/5 until corrected.<br>Action: SEO-C-C fix candidate; correct Shopify-specific body before expansion. |
| `/logo-to-svg-for-shopify` | Source: `app/routes/logo-to-svg-for-shopify.tsx`<br>Family: `cricut-craft`<br>Title: `Logo to SVG for Shopify \| iLoveSVG`<br>Description: `Convert a store logo into SVG for scalable Shopify theme assets, brand marks, favicon prep, and cleaner web graphics.`<br>H1: `Logo to SVG for Shopify` | Sections: generic logo-to-SVG sections plus Shopify practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Shopify, favicon, logo siblings. | Intent: Shopify logo/theme brand SVG prep.<br>Primary keyword: logo to SVG for Shopify.<br>Secondary: Shopify logo SVG, store logo SVG.<br>Risk: moderate template risk.<br>User value: 4/5.<br>Action: SEO-C-C candidate after PNG Shopify body is corrected. |
| `/svg-to-png-for-shopify` | Source: `app/routes/svg-to-png-for-shopify.tsx`<br>Family: `svg-export`<br>Title: `SVG to PNG for Shopify \| iLoveSVG`<br>Description: `Export Shopify-ready PNG copies from SVG assets with transparent backgrounds, exact sizing, and browser-side previews.`<br>H1: `SVG to PNG for Shopify` | Sections: generic SVG to PNG export sections plus Shopify practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Shopify export/favicon routes. | Intent: PNG copies for store assets/previews.<br>Primary keyword: SVG to PNG for Shopify.<br>Secondary: Shopify PNG asset export, transparent PNG Shopify.<br>Risk: moderate with generic SVG to PNG.<br>User value: 4/5.<br>Action: SEO-C-C candidate. |
| `/svg-to-favicon-for-shopify` | Source: `app/routes/svg-to-favicon-for-shopify.tsx`<br>Family: `svg-export`<br>Title: `SVG to Favicon for Shopify \| iLoveSVG`<br>Description: `Generate favicon and app icon assets from a Shopify store SVG logo or brand mark.`<br>H1: `SVG to Favicon for Shopify` | Sections: favicon generator, output settings, app icons, production use, troubleshooting, Shopify practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: favicon, Shopify, SVG export siblings. | Intent: favicon/app icon generation for Shopify stores.<br>Primary keyword: SVG to favicon for Shopify.<br>Secondary: Shopify favicon generator, Shopify app icon.<br>Risk: low to moderate, strong functional utility.<br>User value: 4/5.<br>Action: SEO-C-C candidate if favicon cluster is included. |
| `/logo-to-favicon-for-shopify` | Source: `app/routes/logo-to-favicon-for-shopify.tsx`<br>Family: `svg-export`<br>Title: `Logo to Favicon for Shopify \| iLoveSVG`<br>Description: `Generate Shopify favicon assets from a logo image or SVG using the existing favicon workflow.`<br>H1: `Logo to Favicon for Shopify` | Sections: favicon generator, output settings, app icons, production use, troubleshooting, Shopify practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: favicon, Shopify, logo routes. | Intent: logo image to favicon assets.<br>Primary keyword: logo to favicon for Shopify.<br>Secondary: Shopify favicon from logo.<br>Risk: moderate overlap with SVG-to-favicon Shopify route.<br>User value: 4/5.<br>Action: SEO-C-C secondary candidate; distinguish source image vs SVG input. |
| `/svg-resizer-for-shopify` | Source: `app/routes/svg-resizer-for-shopify.tsx`<br>Family: `svg-editor`<br>Title: `SVG Resizer for Shopify \| iLoveSVG`<br>Description: `Resize Shopify SVG logos, theme graphics, badges, and brand assets while keeping the SVG editable.`<br>H1: `SVG Resizer for Shopify` | Sections: generic SVG resizer sections plus Shopify practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG editing, Shopify siblings. | Intent: resize store SVG assets.<br>Primary keyword: SVG resizer for Shopify.<br>Secondary: resize Shopify logo SVG.<br>Risk: high thin-page risk.<br>User value: 3/5.<br>Action: defer and review search data. |

### Printify and Printful Routes

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/svg-to-png-for-printify` | Source: `app/routes/svg-to-png-for-printify.tsx`<br>Family: `svg-export`<br>Title: `SVG to PNG for Printify \| iLoveSVG`<br>Description: `Export transparent PNG product artwork from SVG for Printify mockups, product previews, and seller workflows.`<br>H1: `SVG to PNG for Printify` | Sections: generic SVG to PNG output/export sections plus Printify practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG export, marketplace export, transparent PNG routes. | Intent: transparent product artwork export for Printify listings/mockups.<br>Primary keyword: SVG to PNG for Printify.<br>Secondary: Printify transparent PNG, product mockup PNG.<br>Risk: duplicate-risk with Printful and transparent PNG printing routes.<br>User value: 4/5.<br>Action: SEO-C-C candidate only if POD content is route-specific. |
| `/svg-to-png-for-printful` | Source: `app/routes/svg-to-png-for-printful.tsx`<br>Family: `svg-export`<br>Title: `SVG to PNG for Printful \| iLoveSVG`<br>Description: `Export SVG artwork to PNG for Printful-style product mockups, print previews, and seller asset preparation.`<br>H1: `SVG to PNG for Printful` | Sections: generic SVG to PNG output/export sections plus Printful practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: SVG export, marketplace export, transparent PNG routes. | Intent: POD product artwork export for Printful-style workflows.<br>Primary keyword: SVG to PNG for Printful.<br>Secondary: Printful transparent PNG, print-on-demand artwork PNG.<br>Risk: duplicate-risk with Printify and transparent PNG routes.<br>User value: 4/5.<br>Action: SEO-C-C candidate; avoid claiming platform upload validation. |

### Canva and Figma Design Workflow Routes

These overlap with design/export and marketplace intent, but they are not craft-machine routes. They should be treated as design-handoff pages, not cut-file pages.

| Route | Current metadata and source | Current content signals | Intent, keywords, risk, action |
| --- | --- | --- | --- |
| `/png-to-svg-for-canva` | Source: `app/routes/png-to-svg-for-canva.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Canva \| iLoveSVG`<br>Description: `Convert PNG artwork into SVG for cleaner Canva design reuse, scalable logos, icons, and simple graphics.`<br>H1: `PNG to SVG for Canva` | Sections: generic PNG-to-SVG transparent/background guidance plus Canva practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Marketplace & Design, Canva export/resizer. | Intent: Canva design reuse/handoff.<br>Primary keyword: PNG to SVG for Canva.<br>Secondary: Canva SVG converter, PNG asset to SVG Canva.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: defer; do not mix with craft content. |
| `/jpg-to-svg-for-canva` | Source: `app/routes/jpg-to-svg-for-canva.tsx`<br>Family: `cricut-craft`<br>Title: `JPG to SVG for Canva \| iLoveSVG`<br>Description: `Convert JPG graphics into SVG for Canva design reuse, simplified line art, logos, and scalable layout assets.`<br>H1: `JPG to SVG for Canva` | Sections: generic JPG-to-SVG guidance plus Canva practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Canva siblings. | Intent: JPG graphics to Canva SVG assets.<br>Primary keyword: JPG to SVG for Canva.<br>Secondary: Canva JPG to SVG.<br>Risk: moderate thin/template risk.<br>User value: 3/5.<br>Action: defer. |
| `/logo-to-svg-for-canva` | Source: `app/routes/logo-to-svg-for-canva.tsx`<br>Family: `cricut-craft`<br>Title: `Logo to SVG for Canva \| iLoveSVG`<br>Description: `Convert logo images into SVG for Canva brand graphics, scalable marks, and reusable design assets.`<br>H1: `Logo to SVG for Canva` | Sections: generic logo-to-SVG sections plus Canva practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Canva/logo siblings. | Intent: brand mark SVG for Canva designs.<br>Primary keyword: logo to SVG for Canva.<br>Secondary: Canva logo SVG.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: defer. |
| `/svg-to-png-for-canva` | Source: `app/routes/svg-to-png-for-canva.tsx`<br>Family: `svg-export`<br>Title: `SVG to PNG for Canva \| iLoveSVG`<br>Description: `Export SVG artwork to PNG for Canva uploads, transparent graphics, predictable sizing, and design handoff.`<br>H1: `SVG to PNG for Canva` | Sections: generic SVG-to-PNG export plus Canva practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Canva/design export. | Intent: SVG export for Canva upload/handoff.<br>Primary keyword: SVG to PNG for Canva.<br>Secondary: Canva PNG export, transparent PNG Canva.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: defer. |
| `/svg-resizer-for-canva` | Source: `app/routes/svg-resizer-for-canva.tsx`<br>Family: `svg-editor`<br>Title: `SVG Resizer for Canva \| iLoveSVG`<br>Description: `Resize SVG logos and design assets before Canva handoff while keeping dimensions and viewBox predictable.`<br>H1: `SVG Resizer for Canva` | Sections: generic resizer sections plus Canva practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Canva/design editing. | Intent: resize SVG before Canva handoff.<br>Primary keyword: SVG resizer for Canva.<br>Secondary: resize SVG for Canva.<br>Risk: high thin-page risk.<br>User value: 2/5.<br>Action: defer and review search data. |
| `/png-to-svg-for-figma` | Source: `app/routes/png-to-svg-for-figma.tsx`<br>Family: `cricut-craft`<br>Title: `PNG to SVG for Figma \| iLoveSVG`<br>Description: `Convert PNG assets into SVG for Figma handoff, scalable graphics, icon prep, and cleanup workflows.`<br>H1: `PNG to SVG for Figma` | Sections: generic PNG-to-SVG transparent/background guidance plus Figma practical notes.<br>FAQ/schema: FAQ microdata, Breadcrumb JSON-LD.<br>Related links: Marketplace & Design, Figma export/cleaner/resizer. | Intent: design handoff/icon prep for Figma.<br>Primary keyword: PNG to SVG for Figma.<br>Secondary: Figma SVG converter, PNG icon to SVG Figma.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: defer. |
| `/svg-to-png-for-figma` | Source: `app/routes/svg-to-png-for-figma.tsx`<br>Family: `svg-export`<br>Title: `SVG to PNG for Figma \| iLoveSVG`<br>Description: `Export SVG assets to PNG for Figma handoff, previews, thumbnails, and flattened sharing files.`<br>H1: `SVG to PNG for Figma` | Sections: generic SVG-to-PNG export plus Figma practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Figma/design export. | Intent: flattened preview/handoff PNGs.<br>Primary keyword: SVG to PNG for Figma.<br>Secondary: export SVG to PNG for Figma.<br>Risk: moderate template risk.<br>User value: 3/5.<br>Action: defer. |
| `/svg-cleaner-for-figma` | Source: `app/routes/svg-cleaner-for-figma.tsx`<br>Family: `svg-editor`<br>Title: `SVG Cleaner for Figma \| iLoveSVG`<br>Description: `Clean SVG markup for Figma handoff, removing editor clutter while preserving practical SVG structure.`<br>H1: `SVG Cleaner for Figma` | Sections: generic cleaner sections plus Figma practical notes.<br>FAQ/schema: FAQ JSON-LD, Breadcrumb JSON-LD.<br>Related links: Figma/design editing. | Intent: clean SVG before design handoff/import.<br>Primary keyword: SVG cleaner for Figma.<br>Secondary: clean SVG for Figma import.<br>Risk: high thin-page risk.<br>User value: 3/5.<br>Action: defer and review search data. |
| `/svg-resizer-for-figma` | Source: `app/routes/svg-resizer-for-figma.tsx`<br>Family: `svg-editor`<br>Title: `SVG Resizer for Figma \| iLoveSVG`<br>Description: `Resize SVG assets for Figma handoff, viewBox checks, component sizing, and predictable exports.`<br>H1: `SVG Resizer for Figma` | Sections: generic resizer sections plus Figma practical notes.<br>FAQ/schema: no FAQ schema, Breadcrumb JSON-LD.<br>Related links: Figma/design editing. | Intent: resize SVG before Figma handoff.<br>Primary keyword: SVG resizer for Figma.<br>Secondary: resize SVG for Figma.<br>Risk: high thin-page risk.<br>User value: 2/5.<br>Action: defer and review search data. |

## 3. Duplicate Title and Description Risks

Findings:

- No exact duplicate titles, descriptions, or H1s were found in the audited set.
- Several titles follow near-identical formulas:
  - `{format} to SVG for Cricut - Free Cricut SVG Converter`
  - `{format} to SVG for {platform} | iLoveSVG`
  - `SVG Cleaner for {platform} | iLoveSVG`
  - `SVG Resizer for {platform} | iLoveSVG`
  - `SVG to PNG for {marketplace/platform} | iLoveSVG`
- Near-duplicate meta description patterns are present in:
  - JPG/JPEG/WebP to SVG for Cricut.
  - JPG/Image/Logo to SVG for Silhouette and Glowforge.
  - SVG cleaner/resizer platform wrappers.
  - SVG to PNG for Etsy/Shopify/Printify/Printful/Canva/Figma.
- The highest title/description cannibalization risk is `/jpg-to-svg-for-cricut` vs `/jpeg-to-svg-for-cricut`. These target the same query family with nearly identical body structure and very similar metadata.
- Marketplace export pages have unique enough descriptions, but they need stronger page-body differentiation to avoid looking like platform-name substitutions.

Recommended later metadata approach:

- Keep direct, exact-match titles on the strongest pages.
- Avoid making every platform page include every downstream use case.
- Let hub pages target broad "converter" queries and child pages target a narrow workflow.
- Shorten overlong descriptions where SEO-A already flagged length risk.
- Do not add or remove canonical/noindex in SEO-C-B without search data.

## 4. Thin Content Risks

Highest thin-page risks:

| Risk group | Routes | Why it matters | Recommendation |
| --- | --- | --- | --- |
| SVG resizer platform wrappers | `/svg-resizer-for-canva`, `/svg-resizer-for-etsy`, `/svg-resizer-for-figma`, `/svg-resizer-for-glowforge`, `/svg-resizer-for-shopify`, `/svg-resizer-for-silhouette` | The tool is useful, but page differentiation is mostly platform label plus generic resize sections. | Defer. Consider search-data review before investing, and do not add FAQ schema until answers are platform-specific. |
| SVG cleaner platform wrappers | `/svg-cleaner-for-figma`, `/svg-cleaner-for-glowforge`, `/svg-cleaner-for-silhouette` | They inherit the same cleaner explanation and FAQ pattern. Platform-specific needs are plausible but currently shallow. | Defer. If kept indexable, add concrete import/workflow limitations for each platform. |
| Broad platform image wrappers with mismatched body copy | `/image-to-svg-for-silhouette`, `/image-to-svg-for-glowforge`, `/image-to-svg-for-etsy`, `/png-to-svg-for-shopify` | Rendered lower-page content references the wrong platform in places. This is both duplicate-risk and quality-risk. | Correct body copy in later implementation before metadata/schema expansion. |
| Marketplace export wrappers | `/svg-to-png-for-etsy`, `/svg-to-png-for-shopify`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful`, `/svg-to-png-for-canva`, `/svg-to-png-for-figma` | Useful export utility, but generic SVG-to-PNG body sections repeat across platforms. | Improve only with distinct output-size, transparency, preview, or workflow examples. |
| Sticker marketplace/machine wrappers | `/sticker-to-svg-for-silhouette`, `/sticker-to-svg-for-etsy` | Share generic sticker FAQ/body pattern. | Defer until generic and Cricut sticker pages are improved first. |

Strong or acceptable pages:

- Strong: `/png-to-svg-for-cricut`, `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-cricut-stickers`, `/sticker-to-svg-converter`, `/sticker-to-svg-for-cricut`, `/png-to-svg-for-cricut-vinyl`, `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-silhouette`, `/png-to-svg-for-glowforge`, `/png-to-layered-svg-for-cricut`.
- Acceptable but later: `/cricut-svg-converter`, `/image-to-svg-for-cricut`, `/photo-to-svg-for-cricut`, `/black-and-white-image-to-svg-for-cricut`, `/line-art-to-svg-for-cricut`, `/drawing-to-svg-for-cricut`, `/logo-to-svg-for-cricut`, `/layered-svg-for-cricut`.
- Needs route-specific content before priority implementation: most Etsy, Shopify, Printify, Printful, Canva, Figma, cleaner, resizer, and broad platform image wrappers.

## 5. Cannibalization Risks

| Risk | Routes | Current issue | Recommended direction |
| --- | --- | --- | --- |
| Cricut hub vs broad image route | `/cricut-svg-converter`, `/image-to-svg-for-cricut` | Both target broad Cricut conversion. | Hub should target "Cricut SVG converter"; broad image route should target multi-format import and "image to SVG for Cricut". |
| JPG vs JPEG Cricut | `/jpg-to-svg-for-cricut`, `/jpeg-to-svg-for-cricut` | Same intent and very similar metadata/body. | Defer. Keep until search data indicates whether both have value. |
| Generic sticker vs Cricut sticker vs PNG sticker | `/sticker-to-svg-converter`, `/sticker-to-svg-for-cricut`, `/png-to-svg-for-cricut-stickers` | All target sticker-to-SVG behavior. | Generic page: any sticker/decal SVG. Cricut sticker page: Cricut cut-file workflow. PNG sticker page: transparent PNG/JPG cut outline and Print Then Cut prep. |
| Print Then Cut vs Cricut sticker | `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-cricut-stickers` | Both serve printable sticker users. | Print Then Cut: printable color plus cut outline workflow. Cricut stickers: sticker art cleanup and transparent-area checks. |
| Vinyl vs broad Cricut PNG | `/png-to-svg-for-cricut`, `/png-to-svg-for-cricut-vinyl` | Both can mention vinyl. | Broad page: general cut files. Vinyl page: single-color/HTV/weeding/material workflow. |
| Laser vs Glowforge | `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-glowforge` | Similar laser path intent. | Laser page: machine-neutral cut/score/engrave. Glowforge page: Glowforge-style workflow without overclaiming compatibility. |
| SVG to transparent PNG vs POD pages | `/svg-to-transparent-png-for-printing`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful` | Same export engine and transparent PNG output. | Printing page: generic print/mockup handoff. POD pages: product-art preparation and marketplace mockup workflow, no upload compatibility claims. |
| Shopify favicon pair | `/svg-to-favicon-for-shopify`, `/logo-to-favicon-for-shopify` | Same favicon workflow with different input framing. | SVG route: SVG source. Logo route: image or SVG logo source. Keep distinction explicit. |

## 6. Search Intent Differentiation Plan

Cricut:

- Focus on cut files, Design Space import expectations, Print Then Cut, vinyl, layered SVGs, clean outlines, simpler shapes, and avoiding tiny islands.
- Do not claim guaranteed Cricut acceptance or perfect cut readiness.
- Keep `/png-to-svg-for-cricut` as the strongest exact-match page.
- Keep `/cricut-svg-converter` as a hub, not a keyword dump.

Sticker:

- Generic sticker page should cover sticker/decal/label vectorization and transparent PNG source cleanup.
- Cricut sticker pages should cover cut outlines, Print Then Cut, transparent-area checks, and practical expectations.
- Etsy sticker route should focus on listing assets, digital downloads, previews, and seller workflow, not cutting-machine claims.

Vinyl:

- Focus on single-color output, HTV/decals, easier weeding, cleaner outlines, fewer tiny islands, and material expectations.
- Keep it distinct from sticker and layered SVG pages.

Silhouette:

- Focus on Silhouette Studio-style workflow, Cameo/cut file prep, vinyl/decal/sticker use cases, and import testing.
- Correct current Cricut body references before expanding.
- Avoid claiming official Silhouette compatibility beyond generic SVG workflow preparation.

Glowforge and Laser:

- Laser cutting route should be machine-neutral: vector paths, cut/score/engrave, material examples, clean outlines, simplified SVGs.
- Glowforge route can mention Glowforge-style laser prep but should avoid official compatibility guarantees.
- Cleaner/resizer pages need concrete laser import and sizing examples if kept indexable.

Etsy:

- Focus on seller assets, listing previews, digital downloads, product mockups, transparent previews, and shop workflow.
- Avoid turning every Etsy page into generic "convert image to SVG" copy with the word Etsy swapped in.
- Distinguish SVG downloads from PNG/JPG preview exports.

Shopify:

- Focus on ecommerce images, store branding, theme assets, logos, favicons, transparent PNG export, and brand consistency.
- Correct current Etsy body copy on `/png-to-svg-for-shopify` before any metadata work.
- Favicon routes are stronger than generic Shopify resizer.

Printify and Printful:

- Focus on print-on-demand images, transparent PNG product art, mockups, previews, and seller prep.
- Do not imply validation against platform upload rules unless the app actually validates those rules.
- Keep Printify and Printful distinct only if examples and search data support separate pages.

Canva and Figma:

- Treat these as design handoff pages, not craft/cut-file pages.
- Focus on reusable design assets, logos, icons, transparent PNGs, viewBox/dimension checks, and cleanup.
- Defer thin resizer/cleaner pages until data justifies them.

Print/export sticker and transparent PNG:

- Focus on transparent output, print previews, product mockups, sticker sheets, labels, and handoff files.
- Distinguish sticker-specific export from generic transparent PNG export and POD marketplace pages.

## 7. FAQ and Schema Review

Current state:

- Every audited route renders Breadcrumb JSON-LD.
- FAQ schema exists through two patterns:
  - FAQ microdata on many bespoke converter pages.
  - FAQ JSON-LD on shared or editor/export routes such as sticker, cleaner, JPG export, and favicon pages.
- Some routes have visible FAQ-style question headings without FAQ schema.
- No route in this audit showed both FAQ JSON-LD and FAQ microdata for the same page in the rendered check.

FAQ/schema concerns:

- Sticker pages use repeated FAQ patterns. `/sticker-to-svg-converter`, `/sticker-to-svg-for-silhouette`, and `/sticker-to-svg-for-etsy` need more distinct answers before expanding schema.
- SVG cleaner pages for Figma, Glowforge, and Silhouette use the same FAQ/schema framework. Keep schema only if answers become meaningfully platform-specific.
- Shopify favicon pair uses the same favicon FAQ workflow. This can be acceptable if the source/input distinction is clear.
- Cricut format pages have FAQ microdata, but many questions follow repeated "How to convert", "Which preset", and "Troubleshooting" patterns. Later rewrites should make answers route-specific instead of swapping input format names.
- Do not add FAQ schema in SEO-C-B unless the visible FAQ block is route-specific and useful.

Later FAQ actions:

- Keep FAQ schema only where the visible FAQ is genuinely helpful for that route.
- Remove or consolidate schema later if platform wrappers cannot support route-specific answers.
- Avoid repeated question templates across many pages.
- Include honest limitations, especially for Cricut, Silhouette, Glowforge, Printify, Printful, and Shopify workflows.

## 8. Thin Content and AdSense Quality Review

Quality criteria applied:

- Practical user value.
- Clear route-specific next action.
- Honest limitations and non-overpromising compatibility.
- Enough examples to justify indexing.
- Not just generic converter copy with a platform name inserted.
- Not overloaded with repeated keywords.

Classification:

| Classification | Routes |
| --- | --- |
| Strong | `/png-to-svg-for-cricut`, `/png-to-svg-for-cricut-print-then-cut`, `/png-to-svg-for-cricut-stickers`, `/sticker-to-svg-converter`, `/sticker-to-svg-for-cricut`, `/png-to-svg-for-cricut-vinyl`, `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-silhouette`, `/png-to-svg-for-glowforge`, `/png-to-layered-svg-for-cricut` |
| Acceptable | `/cricut-svg-converter`, `/image-to-svg-for-cricut`, `/jpg-to-svg-for-cricut`, `/webp-to-svg-for-cricut`, `/photo-to-svg-for-cricut`, `/black-and-white-image-to-svg-for-cricut`, `/line-art-to-svg-for-cricut`, `/drawing-to-svg-for-cricut`, `/logo-to-svg-for-cricut`, `/layered-svg-for-cricut`, `/image-to-layered-svg-for-cricut`, `/jpg-to-layered-svg-for-cricut`, `/logo-to-layered-svg-for-cricut`, `/transparent-png-to-svg-converter`, `/svg-to-transparent-png-for-printing`, `/sticker-to-png-for-printing`, `/logo-to-svg-for-shopify`, `/svg-to-png-for-shopify`, `/svg-to-favicon-for-shopify`, `/logo-to-favicon-for-shopify`, `/svg-to-png-for-etsy`, `/svg-to-jpg-for-etsy`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful` |
| Needs route-specific content | `/sketch-to-svg-for-cricut`, `/sticker-to-svg-for-silhouette`, `/sticker-to-svg-for-etsy`, `/jpg-to-svg-for-silhouette`, `/logo-to-svg-for-silhouette`, `/jpg-to-svg-for-glowforge`, `/logo-to-svg-for-glowforge`, `/png-to-svg-for-etsy`, `/jpg-to-svg-for-etsy`, `/logo-to-svg-for-etsy`, `/png-to-svg-for-canva`, `/jpg-to-svg-for-canva`, `/logo-to-svg-for-canva`, `/png-to-svg-for-figma`, `/svg-to-png-for-canva`, `/svg-to-png-for-figma` |
| Duplicate-risk | `/jpeg-to-svg-for-cricut`, `/image-to-svg-for-silhouette`, `/image-to-svg-for-glowforge`, `/image-to-svg-for-etsy`, `/png-to-svg-for-shopify`, `/sticker-to-svg-for-silhouette`, `/sticker-to-svg-for-etsy`, `/svg-to-png-for-printify`, `/svg-to-png-for-printful` |
| Thin-risk | `/svg-resizer-for-canva`, `/svg-resizer-for-etsy`, `/svg-resizer-for-figma`, `/svg-resizer-for-glowforge`, `/svg-resizer-for-shopify`, `/svg-resizer-for-silhouette`, `/svg-cleaner-for-figma`, `/svg-cleaner-for-glowforge`, `/svg-cleaner-for-silhouette` |
| Noindex/canonical review needed later | `/jpeg-to-svg-for-cricut`, SVG cleaner/resizer platform wrappers, broad platform image wrappers with wrong-platform body copy, Printify/Printful split if no search data supports both |
| Defer until search data | Canva/Figma platform wrappers, most resizer/cleaner wrappers, JPG/JPEG variants, code/Base64 Cricut pages, lower-demand marketplace variants |

## 9. Prioritized Implementation Batches

### SEO-C-B: First Safe Implementation Batch

Recommended routes:

- `/png-to-svg-for-cricut`
- `/png-to-svg-for-cricut-print-then-cut`
- `/png-to-svg-for-cricut-stickers`
- `/sticker-to-svg-converter`
- `/sticker-to-svg-for-cricut`

Why first:

- Strongest user intent.
- Clear commercial/craft utility without needing platform overclaims.
- Existing content is already route-specific enough to improve safely.
- These pages can be differentiated from each other with honest workflow examples.

Risk level: low to moderate.

Needed changes later:

- Metadata: refine without changing route URLs or canonical paths.
- Content: add concise, route-specific workflow examples and limitations.
- FAQ/schema: keep only visible, useful, route-specific FAQ answers.
- Related links: keep routes distinct and link only to genuinely adjacent workflows.

Tests to run for SEO-C-B implementation:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:route-coverage`
- `npm.cmd run test:navigation`
- `npm.cmd run test:nav`
- `npm.cmd run test:links`
- `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
- `npm.cmd run test:seo` if still present
- `npm.cmd run build`
- `npm.cmd audit`
- `git diff --check`

Stretch candidate only if batch remains small:

- `/png-to-svg-for-cricut-vinyl`

### SEO-C-C: Marketplace and Craft Expansion

Recommended routes:

- Etsy: `/png-to-svg-for-etsy`, `/sticker-to-svg-for-etsy`, `/svg-to-png-for-etsy`, `/svg-to-jpg-for-etsy`, `/logo-to-svg-for-etsy`
- Shopify: `/png-to-svg-for-shopify`, `/logo-to-svg-for-shopify`, `/svg-to-png-for-shopify`, `/svg-to-favicon-for-shopify`, `/logo-to-favicon-for-shopify`
- Printify/Printful: `/svg-to-png-for-printify`, `/svg-to-png-for-printful`

Why second:

- Marketplace intent can be valuable, but the pages need seller-workflow detail to avoid platform-name doorway risk.
- Shopify PNG route currently has Etsy body copy and must be corrected before broader metadata work.
- Printify/Printful routes need transparent PNG and print-on-demand examples without platform validation overclaims.

Risk level: moderate.

Needed changes later:

- Metadata: route-specific, less formulaic, avoid excessive keyword lists.
- Content: seller workflow, listing previews, transparent PNG needs, product art examples, favicon/store-brand examples.
- FAQ/schema: use only where answers are platform-specific.
- Related links: avoid circular marketplace link blocks that look auto-generated.

### SEO-C-D: Machine-Specific Routes

Recommended routes:

- Silhouette: `/png-to-svg-for-silhouette`, `/image-to-svg-for-silhouette`, `/jpg-to-svg-for-silhouette`, `/logo-to-svg-for-silhouette`, `/sticker-to-svg-for-silhouette`
- Glowforge: `/png-to-svg-for-glowforge`, `/image-to-svg-for-glowforge`, `/jpg-to-svg-for-glowforge`, `/logo-to-svg-for-glowforge`
- Laser/vinyl: `/png-to-svg-for-laser-cutting`, `/png-to-svg-for-cricut-vinyl`
- Later review: `/svg-cleaner-for-silhouette`, `/svg-resizer-for-silhouette`, `/svg-cleaner-for-glowforge`, `/svg-resizer-for-glowforge`

Why third:

- Machine-specific pages need careful compatibility wording.
- Several current wrappers use wrong-platform or generic body copy.
- Cleaner/resizer pages may be useful, but need either richer examples or search-data-based defer/noindex review.

Risk level: moderate to high.

Needed changes later:

- Metadata: avoid official compatibility claims.
- Content: import workflow, cut/score/engrave or Studio/Cameo expectations, material examples, limitations.
- FAQ/schema: avoid repeating generic SVG cleaner/resizer answers.
- Related links: emphasize machine-specific siblings and generic core converters.

## 10. Routes to Defer

Defer until search data or a focused platform-wrapper pass:

- `/jpeg-to-svg-for-cricut`
- `/webp-to-svg-for-cricut`
- `/line-art-to-svg-for-cricut`
- `/drawing-to-svg-for-cricut`
- `/sketch-to-svg-for-cricut`
- `/base64-to-svg-for-cricut`
- `/code-to-svg-for-cricut`
- `/jpg-to-svg-for-silhouette`
- `/logo-to-svg-for-silhouette`
- `/svg-cleaner-for-silhouette`
- `/svg-resizer-for-silhouette`
- `/jpg-to-svg-for-glowforge`
- `/logo-to-svg-for-glowforge`
- `/svg-cleaner-for-glowforge`
- `/svg-resizer-for-glowforge`
- `/image-to-svg-for-etsy`
- `/jpg-to-svg-for-etsy`
- `/svg-resizer-for-etsy`
- `/svg-resizer-for-shopify`
- Canva and Figma wrapper routes

Do not delete these routes now. They may still be useful, but they should not be part of the first SEO-C implementation until the body-copy mismatch, thin wrapper risk, or search demand question is resolved.

## 11. Regression Gates for Implementation

Any later implementation batch should pass these gates:

- No route URLs changed.
- No canonical path changes unless explicitly approved from data.
- No sitemap behavior changes unless explicitly approved.
- No conversion, preset, upload validation, or route behavior changes.
- No navigation changes unless the implementation scope explicitly includes navigation.
- No exact duplicate titles, descriptions, or H1s introduced.
- No wrong-platform body copy remains on implemented routes.
- FAQ schema appears only when the visible FAQ is route-specific and useful.
- Existing Breadcrumb JSON-LD remains valid.
- Related links remain relevant and do not introduce duplicate hrefs in the same menu/context.
- Implementation routes remain indexable only when their content is strong enough to justify indexing.
- Required checks pass:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
  - `npm.cmd run test:route-coverage`
  - `npm.cmd run test:navigation`
  - `npm.cmd run test:nav`
  - `npm.cmd run test:links`
  - `$env:BASE_URL='http://localhost:3000'; npm.cmd run test:routes`
  - `npm.cmd run test:seo` if available
  - `npm.cmd run build`
  - `npm.cmd audit`
  - `git diff --check`

## 12. Main Risks to Carry Forward

- The first implementation batch should be narrow. The moment SEO-C starts touching platform wrappers, there is a real risk of making repetitive pages look more repetitive.
- Correct wrong-platform rendered content before metadata changes on affected pages.
- Use route-specific examples instead of adding more generic FAQ or keyword-heavy sections.
- Do not overclaim Cricut, Silhouette, Glowforge, Printify, Printful, Shopify, Canva, or Figma compatibility.
- Treat noindex/canonical decisions as a later data-driven step, not a first implementation step.
