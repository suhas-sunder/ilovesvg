# Draft: inspect vector output — unpublished

Target: existing `/how-it-works/exporting-and-downloads`. Intended audience: designers, frontend developers and craft creators. Qualitative task hypothesis, not measured keyword demand.

## Proposed visible copy

### Check what is inside an SVG

SVG is a document format. It can contain vector paths, text and embedded raster images. A `.svg` extension alone does not establish that all artwork is vector geometry.

Download the result and open a copy in a text editor. Path elements such as `<path d="…">` describe geometry. An `<image>` element can reference or embed bitmap artwork. A document can contain both. A path count is useful for understanding complexity, but a larger count does not guarantee a better result.

Inspect the preview at the size you intend to use. Check thin lines, small lettering, separate colored regions and transparent edges. For cutting artwork, inspect the actual paths in your cutting application before committing material. A browser preview does not certify a machine-ready cutting file.

## Original worked example still required

Create a deterministic transparent logo with two colors and thin curves; convert it with a named existing preset; retain source, exact settings and the actual downloaded result on an unpublished branch. Show what the SVG contains and where simplification changes detail. Compare a deliberately embedded bitmap document to the traced result without pretending the embedded document was converter output. Check that any recommended code/preview tool preserves the file. No image, path-count, cutting compatibility or quality claim may be invented to complete the example.
