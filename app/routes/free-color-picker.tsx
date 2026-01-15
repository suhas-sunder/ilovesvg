// app/routes/free-color-picker.tsx
import * as React from "react";
import type { Route } from "./+types/free-color-picker";
import { Link } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "Free Color Picker + Palette Extractor (SVG & Images) - i🩵SVG";
  const description =
    "Pick colors, preview fills/strokes, copy HEX/RGB/HSL, and extract palettes from SVG/PNG/JPG/WebP. Free, fast, no accounts.";
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

/* ========================
   FAQ JSON-LD
======================== */
function faqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What formats can I copy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can copy HEX, RGB, and HSL values. Alpha is supported using RGBA and HSLA.",
        },
      },
      {
        "@type": "Question",
        name: "Can I extract a color palette from an SVG or image?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Upload an SVG or an image (PNG/JPG/WebP) to extract a palette, then click a swatch to preview and copy it.",
        },
      },
      {
        "@type": "Question",
        name: "Does this tool upload anything?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The picker and palette extraction run entirely in your browser and do not upload your files.",
        },
      },
      {
        "@type": "Question",
        name: "How is this useful for SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Use it to choose fill and stroke colors quickly, preview them on shapes, and copy values directly into your SVG or CSS.",
        },
      },
    ],
  };

  return JSON.stringify(data);
}

/* ========================
   Color helpers
======================== */
function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function isHexColor(s: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.trim());
}

function normalizeHex(hex: string) {
  let h = hex.trim().toLowerCase();
  if (!h.startsWith("#")) h = `#${h}`;

  if (!isHexColor(h)) return null;

  // Expand 3-digit
  if (h.length === 4) {
    const r = h[1],
      g = h[2],
      b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // If 8-digit (#rrggbbaa), keep as-is for parsing but we typically display rgb+alpha
  return h;
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const raw = h.replace("#", "");

  if (raw.length === 6) {
    const n = Number.parseInt(raw, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  if (raw.length === 8) {
    const n = Number.parseInt(raw, 16);
    if (Number.isNaN(n)) return null;
    const r = (n >> 24) & 255;
    const g = (n >> 16) & 255;
    const b = (n >> 8) & 255;
    const a = (n & 255) / 255;
    return { r, g, b, a };
  }

  return null;
}

function rgbToHex(r: number, g: number, b: number) {
  const to2 = (x: number) =>
    clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toLowerCase();
}

// r,g,b in [0..255] -> h,s,l where h [0..360), s,l [0..100]
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbaToCss(r: number, g: number, b: number, a: number) {
  const aa = clamp(a, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${aa.toFixed(2)})`;
}

/* ========================
   Palette extraction
======================== */
type PaletteSwatch = {
  hex: string; // #rrggbb
  weight: number; // rough weight
};

function distSq(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

// Simple k-means quantization on sampled pixels (fast enough for a utility)
async function extractPaletteFromImageFile(
  file: File,
  k = 8
): Promise<PaletteSwatch[]> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    // Downscale hard to keep it fast
    const MAX_W = 420;
    const scale = Math.min(1, MAX_W / Math.max(img.naturalWidth || 1, 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Sample pixels
    const samples: Array<{ r: number; g: number; b: number }> = [];
    const step = Math.max(4, Math.floor((w * h) / 12000)) * 4; // target ~12k samples
    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // skip fully transparent
      if (a < 20) continue;

      // skip near-white / near-black bias if it dominates; we still allow some
      samples.push({ r, g, b });
    }
    if (samples.length === 0) return [];

    // Initialize centroids (pick evenly spaced samples)
    const centroids: Array<{ r: number; g: number; b: number }> = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor((i / k) * (samples.length - 1));
      centroids.push({ ...samples[idx] });
    }

    const ITER = 8;
    const assignments = new Array<number>(samples.length).fill(0);

    for (let it = 0; it < ITER; it++) {
      // assign
      for (let i = 0; i < samples.length; i++) {
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const d = distSq(samples[i], centroids[c]);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        assignments[i] = best;
      }

      // recompute
      const sum = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
      for (let i = 0; i < samples.length; i++) {
        const c = assignments[i];
        const s = samples[i];
        sum[c].r += s.r;
        sum[c].g += s.g;
        sum[c].b += s.b;
        sum[c].n += 1;
      }
      for (let c = 0; c < centroids.length; c++) {
        if (sum[c].n === 0) continue;
        centroids[c] = {
          r: Math.round(sum[c].r / sum[c].n),
          g: Math.round(sum[c].g / sum[c].n),
          b: Math.round(sum[c].b / sum[c].n),
        };
      }
    }

    // Build swatches with weights
    const counts = new Array<number>(centroids.length).fill(0);
    for (const a of assignments) counts[a]++;

    const swatches: PaletteSwatch[] = centroids
      .map((c, idx) => ({
        hex: rgbToHex(c.r, c.g, c.b),
        weight: counts[idx],
      }))
      .filter((s) => s.weight > 0);

    // Deduplicate near-identical colors (coarse)
    const deduped: PaletteSwatch[] = [];
    for (const s of swatches.sort((a, b) => b.weight - a.weight)) {
      const rgba = hexToRgba(s.hex);
      if (!rgba) continue;
      const ok = !deduped.some((d) => {
        const drgba = hexToRgba(d.hex)!;
        return distSq(rgba, drgba) < 18 * 18; // threshold
      });
      if (ok) deduped.push(s);
    }

    return deduped.slice(0, k);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function extractHexColorsFromSvgText(svgText: string): string[] {
  const out = new Set<string>();

  // Direct hex tokens
  const hexMatches = svgText.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g);
  if (hexMatches) {
    for (const h of hexMatches) {
      const n = normalizeHex(h);
      if (!n) continue;
      // For 8-digit, drop alpha into picker alpha later; keep rgb for palette chip
      const rgba = hexToRgba(n);
      if (rgba) out.add(rgbToHex(rgba.r, rgba.g, rgba.b));
    }
  }

  // rgb()/rgba() tokens (extract and convert)
  const rgbMatches = svgText.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)/g);
  if (rgbMatches) {
    for (const token of rgbMatches) {
      const m = token.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (!m) continue;
      const r = clamp(Number(m[1]), 0, 255);
      const g = clamp(Number(m[2]), 0, 255);
      const b = clamp(Number(m[3]), 0, 255);
      out.add(rgbToHex(r, g, b));
    }
  }

  // named colors: ignore most (too messy), but catch common SVG named colors
  // If you want more later, add a small lookup table. Keeping it simple.
  const commonNamed: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    orange: "#ffa500",
    purple: "#800080",
    pink: "#ffc0cb",
    brown: "#a52a2a",
  };
  const namedMatches = svgText.match(/\b(black|white|red|green|blue|yellow|cyan|magenta|gray|grey|orange|purple|pink|brown)\b/gi);
  if (namedMatches) {
    for (const n of namedMatches) {
      const key = n.toLowerCase();
      if (commonNamed[key]) out.add(commonNamed[key]);
    }
  }

  return Array.from(out);
}

/* ========================
   Page
======================== */
type UploadedPreview =
  | { kind: "none" }
  | { kind: "image"; url: string; name: string }
  | { kind: "svg"; text: string; name: string };

export default function FreeColorPicker() {
  const [hex, setHex] = React.useState("#0b2dff");
  const [alpha, setAlpha] = React.useState(1);
  const [toast, setToast] = React.useState<string | null>(null);

  const [palette, setPalette] = React.useState<PaletteSwatch[]>([]);
  const [extracting, setExtracting] = React.useState(false);
  const [extractErr, setExtractErr] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<UploadedPreview>({ kind: "none" });

  const rgba = React.useMemo(() => hexToRgba(hex) ?? { r: 11, g: 45, b: 255, a: 1 }, [hex]);
  const rgb = { r: rgba.r, g: rgba.g, b: rgba.b };
  const hsl = React.useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);

  const hexOut = rgbToHex(rgb.r, rgb.g, rgb.b);
  const rgbOut = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const rgbaOut = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
  const hslOut = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const hslaOut = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha.toFixed(2)})`;

  React.useEffect(() => {
    // If user entered an 8-digit hex previously and we normalized to rgb, keep alpha at 1.
    // alpha is user-controlled via slider.
  }, [hex]);

  React.useEffect(() => {
    // cleanup object URLs
    return () => {
      if (preview.kind === "image") URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  async function copy(text: string, msg: string) {
    await navigator.clipboard.writeText(text);
    showToast(msg);
  }

  function onHexInput(v: string) {
    const cleaned = v.trim();
    if (!cleaned.startsWith("#")) {
      setHex(`#${cleaned}`);
      return;
    }
    setHex(cleaned);
  }

  function applySwatch(sw: string) {
    const n = normalizeHex(sw);
    if (!n) return;
    const parsed = hexToRgba(n);
    if (!parsed) return;
    setHex(rgbToHex(parsed.r, parsed.g, parsed.b));
    // keep current alpha slider; do not override user's alpha
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;

    setExtractErr(null);
    setExtracting(true);
    setPalette([]);

    // cleanup any previous image url
    if (preview.kind === "image") URL.revokeObjectURL(preview.url);
    setPreview({ kind: "none" });

    try {
      const name = f.name || "upload";
      const lower = name.toLowerCase();

      const isSvg =
        f.type === "image/svg+xml" ||
        lower.endsWith(".svg") ||
        lower.endsWith(".svgz"); // svgz won't parse as text, but let it fall through

      if (isSvg && !lower.endsWith(".svgz")) {
        const text = await f.text();
        setPreview({ kind: "svg", text, name });

        const colors = extractHexColorsFromSvgText(text);
        const swatches: PaletteSwatch[] = colors.map((c, i) => ({
          hex: c,
          weight: colors.length - i,
        }));
        setPalette(swatches.slice(0, 12));

        // pick first automatically
        if (swatches.length > 0) applySwatch(swatches[0].hex);
        return;
      }

      // images: png/jpg/webp/gif etc (we’ll handle common)
      if (!f.type.startsWith("image/")) {
        throw new Error("Please upload an SVG or an image file.");
      }

      const url = URL.createObjectURL(f);
      setPreview({ kind: "image", url, name });

      const sw = await extractPaletteFromImageFile(f, 8);
      if (!sw.length) {
        throw new Error("Could not extract colors from this file.");
      }
      setPalette(sw);

      // pick first automatically
      applySwatch(sw[0].hex);
    } catch (err: any) {
      setExtractErr(err?.message || "Failed to extract palette.");
    } finally {
      setExtracting(false);
    }
  }

  function clearUpload() {
    setPalette([]);
    setExtractErr(null);
    setExtracting(false);
    if (preview.kind === "image") URL.revokeObjectURL(preview.url);
    setPreview({ kind: "none" });
  }

  const previewFill = rgbaToCss(rgb.r, rgb.g, rgb.b, alpha);

  return (
    <>
      <SiteHeader />

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="text-sm text-slate-600 mb-3">
            <ol className="flex items-center gap-2">
              <li>
                <Link
                  to="/"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Home
                </Link>
              </li>
              <li className="text-slate-300" aria-hidden>
                /
              </li>
              <li className="text-slate-900 font-semibold">Free Color Picker</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-4">
            <h1 className="text-2xl md:text-3xl font-extrabold leading-tight m-0">
              Free Color Picker{" "}
              <span className="text-slate-500 font-semibold">
                + Palette Extractor (SVG & Images)
              </span>
            </h1>
            <p className="mt-2 text-slate-600 max-w-[80ch]">
              Pick a color, preview fills and strokes, copy HEX/RGB/HSL, and extract
              palettes from SVG or images. Runs in your browser.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* LEFT: Controls */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900">Picker</h2>

              {/* Upload palette extractor */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 mb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-semibold">
                    Extract palette from file
                  </div>
                  {preview.kind !== "none" && (
                    <button
                      type="button"
                      onClick={clearUpload}
                      className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Upload an <b>SVG</b> (reads fill/stroke colors) or an <b>image</b>{" "}
                  (PNG/JPG/WebP) to generate a palette. Click a swatch to preview.
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <label className="px-3.5 py-2 rounded-lg font-bold border transition-colors text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0] cursor-pointer">
                    {extracting ? "Extracting…" : "Upload SVG/Image"}
                    <input
                      type="file"
                      accept="image/svg+xml,image/png,image/jpeg,image/webp"
                      onChange={onPickFile}
                      className="hidden"
                    />
                  </label>

                  {preview.kind !== "none" && (
                    <span className="text-[13px] text-slate-700 truncate max-w-[520px]">
                      {preview.kind === "image" ? "Image" : "SVG"}:{" "}
                      <b>{preview.name}</b>
                    </span>
                  )}

                  {extractErr && (
                    <span className="text-sm text-red-700">{extractErr}</span>
                  )}
                </div>

                {palette.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[13px] text-slate-600 mb-2">
                      Extracted palette
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {palette.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => applySwatch(p.hex)}
                          title={p.hex}
                          className={[
                            "h-9 w-9 rounded-lg border border-slate-200 shadow-sm cursor-pointer",
                            p.hex === hexOut ? "ring-2 ring-blue-300" : "",
                          ].join(" ")}
                          style={{ background: p.hex }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Main picker row */}
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
                  <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
                    Choose color
                  </span>

                  <input
                    type="color"
                    value={hexOut}
                    onChange={(e) => setHex(e.target.value)}
                    className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                    aria-label="Color picker"
                  />

                  <input
                    value={hex}
                    onChange={(e) => onHexInput(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    spellCheck={false}
                    inputMode="text"
                    aria-label="Hex color"
                  />
                </label>

                <label className="flex items-center gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
                  <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
                    Alpha ({alpha.toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={alpha}
                    onChange={(e) => setAlpha(Number(e.target.value))}
                    className="w-full accent-[#0b2dff]"
                    aria-label="Alpha"
                  />
                </label>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold">Copy values</div>

                  <div className="mt-3 grid gap-2">
                    <CopyRow label="HEX" value={hexOut} onCopy={() => copy(hexOut, "HEX copied")} />
                    <CopyRow label="RGB" value={rgbOut} onCopy={() => copy(rgbOut, "RGB copied")} />
                    <CopyRow label="RGBA" value={rgbaOut} onCopy={() => copy(rgbaOut, "RGBA copied")} />
                    <CopyRow label="HSL" value={hslOut} onCopy={() => copy(hslOut, "HSL copied")} />
                    <CopyRow label="HSLA" value={hslaOut} onCopy={() => copy(hslaOut, "HSLA copied")} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold">Quick SVG snippet</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Use these directly as <code>fill</code> or <code>stroke</code>.
                  </p>
                  <pre className="mt-2 text-[12px] bg-white border border-slate-200 rounded-lg p-3 overflow-auto">
{`<rect width="120" height="120" fill="${hexOut}" />
<path d="..." stroke="${hexOut}" stroke-width="2" fill="none" />`}
                  </pre>
                </div>
              </div>
            </div>

            {/* RIGHT: Preview */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900">Preview</h2>

              {/* File preview (if uploaded) */}
              {preview.kind !== "none" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
                  <div className="text-sm font-semibold">Uploaded file</div>
                  <div className="mt-2 text-sm text-slate-600">
                    Click a palette swatch to apply it to the preview shapes below.
                  </div>

                  {preview.kind === "image" ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-hidden">
                      <img
                        src={preview.url}
                        alt="Uploaded preview"
                        className="max-w-full h-auto block rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-hidden">
                      <div
                        className="bg-white rounded-lg border border-slate-200 p-3 overflow-auto"
                        dangerouslySetInnerHTML={{ __html: sanitizeInlineSvg(preview.text) }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Shape preview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm text-slate-600 mb-3">
                  Preview fill and stroke on simple SVG shapes.
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 overflow-hidden">
                  <svg viewBox="0 0 600 240" width="100%" height="auto" role="img" aria-label="Color preview">
                    <defs>
                      <pattern id="checker" width="20" height="20" patternUnits="userSpaceOnUse">
                        <rect width="20" height="20" fill="#ffffff" />
                        <rect width="10" height="10" fill="#e5e7eb" />
                        <rect x="10" y="10" width="10" height="10" fill="#e5e7eb" />
                      </pattern>
                    </defs>

                    <rect x="0" y="0" width="600" height="240" fill="url(#checker)" />

                    {/* Fill */}
                    <rect
                      x="40"
                      y="40"
                      width="160"
                      height="160"
                      rx="18"
                      fill={previewFill}
                      stroke="#0f172a"
                      strokeOpacity="0.08"
                    />

                    {/* Stroke */}
                    <circle
                      cx="360"
                      cy="120"
                      r="72"
                      fill="transparent"
                      stroke={previewFill}
                      strokeWidth="16"
                    />

                    <path
                      d="M 470 160 C 520 40, 580 60, 560 150"
                      fill="none"
                      stroke={previewFill}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      RGB
                    </div>
                    <div className="mt-1 font-semibold">
                      {rgb.r}, {rgb.g}, {rgb.b}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      HSL
                    </div>
                    <div className="mt-1 font-semibold">
                      {hsl.h}°, {hsl.s}%, {hsl.l}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* SEO section below tool + visible FAQ */}
        <SeoSections />

        {/* FAQ JSON-LD (once) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
          {toast}
        </div>
      )}

      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   UI helpers
======================== */
function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[64px] text-[12px] font-semibold text-slate-500">
        {label}
      </div>
      <input
        value={value}
        readOnly
        className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-900 text-[13px]"
      />
      <button
        type="button"
        onClick={onCopy}
        className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer"
      >
        Copy
      </button>
    </div>
  );
}

/* ========================
   SVG safety (lightweight)
   - This is not a full sanitizer.
   - It removes scripts and event handlers so inline preview is less risky.
======================== */
function sanitizeInlineSvg(svgText: string) {
  let s = String(svgText || "");

  // remove <script>...</script>
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // remove on* handlers (onclick, onload, etc)
  s = s.replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");

  // remove javascript: urls
  s = s.replace(/xlink:href\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
  s = s.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, "");

  return s;
}

/* ========================
   Header/Footer (copied style)
======================== */
function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
        <a href="/" className="font-extrabold tracking-tight text-slate-900">
          i<span className="text-sky-600">🩵</span>SVG
        </a>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-4 text-[14px] font-semibold">
            <li>
              <a
                href="/#other-tools"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                All Tools
              </a>
            </li>

            <li>
              <a
                href="/svg-recolor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Recolor
              </a>
            </li>

            <li>
              <a
                href="/svg-resize-and-scale-editor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Resize/Scale
              </a>
            </li>

            <li>
              <a
                href="/svg-to-png-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PNG
              </a>
            </li>

            <li>
              <a
                href="/svg-to-jpg-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to JPG
              </a>
            </li>

            <li>
              <a
                href="/svg-to-webp-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to WEBP
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            <span>© {new Date().getFullYear()} i🩵SVG</span>
            <span className="mx-2 text-slate-300">•</span>
            <span className="text-slate-500">Simple SVG tools, no accounts.</span>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600">
              <li>
                <Link
                  to="/"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Home
                </Link>
              </li>

              <li className="text-slate-300" aria-hidden>
                |
              </li>

              <li>
                <Link
                  to="/privacy-policy"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Cookies
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/* ========================
   SEO sections (below tool)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-12 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Color picker + palette extractor
            </p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Pick colors fast, extract palettes from SVG and images
            </h2>
            <p className="text-slate-600 max-w-[75ch] mt-2">
              Use this free tool to choose a color, preview it as SVG fill/stroke,
              and copy HEX/RGB/HSL. You can also upload an SVG or image to extract
              a palette and click swatches to apply them instantly.
            </p>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "Copy instantly", v: "HEX, RGB, HSL (+ alpha variants)" },
                { k: "Palette extraction", v: "From SVG or PNG/JPG/WebP" },
                { k: "Preview included", v: "Fill + stroke on shapes" },
                { k: "Private", v: "Runs in your browser" },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold">{x.k}</div>
                  <div className="mt-1 text-sm text-slate-600">{x.v}</div>
                </div>
              ))}
            </div>
          </header>

          <section className="mt-12">
            <h3 className="text-lg font-bold">How to use</h3>
            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Pick a color or upload a file",
                  body: "Use the color input or upload an SVG/image to extract a palette.",
                },
                {
                  title: "Click a swatch",
                  body: "When a palette appears, click any swatch to apply it to the preview shapes.",
                },
                {
                  title: "Adjust alpha",
                  body: "Use the alpha slider to preview transparency and copy RGBA/HSLA.",
                },
                {
                  title: "Copy values",
                  body: "Copy HEX/RGB/HSL (and alpha variants) for your SVG, CSS, or design work.",
                },
              ].map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-slate-900 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{s.body}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Visible FAQ section (for users + SEO) */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Frequently asked questions</h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "What formats can I copy?",
                  a: "HEX, RGB, and HSL are available. Alpha is supported with RGBA and HSLA.",
                },
                {
                  q: "Can I extract a palette from an SVG or image?",
                  a: "Yes. Upload an SVG (reads fill/stroke/style colors) or an image (PNG/JPG/WebP) to generate swatches.",
                },
                {
                  q: "Does this upload my file?",
                  a: "No. Palette extraction runs locally in your browser.",
                },
                {
                  q: "Why do SVG colors sometimes look incomplete?",
                  a: "If an SVG uses external CSS, injected filters, or unusual color expressions, extraction may miss some. For most normal SVGs, it works well.",
                },
              ].map((x) => (
                <article key={x.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h4 className="m-0 font-semibold">{x.q}</h4>
                  <p className="mt-2 text-sm text-slate-600">{x.a}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold">Tips</h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                ["SVG fill vs stroke", "Use the same value for both, or keep stroke darker for readability."],
                ["Alpha in SVG", "SVG supports opacity. If you want transparency, use opacity or RGBA in CSS."],
                ["Palettes from photos", "Photo palettes depend on sampling. Cropping to the subject improves results."],
                ["Copying into CSS", "HEX is common, but HSL makes it easier to create consistent tints/shades."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
