import * as React from "react";
import type { Route } from "./+types/svg-to-jpg-converter";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG → JPG Converter (client-side, resize, background, quality)";
  const description =
    "Convert SVG to JPG instantly in your browser. Resize by width/height, keep aspect ratio, choose a background color, set JPEG quality, and download. No uploads, no server processing.";
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
   Types
======================== */
type Settings = {
  width: number;
  height: number;
  lockAspect: boolean;
  dpiScale: number; // 1..4
  background: "solid"; // JPG can’t be transparent
  bgColor: string;
  antiAlias: boolean;
  jpegQuality: number; // 0.1..1.0
  fileName: string;
};

type SvgInfo = {
  width: number;
  height: number;
  viewBox?: string;
  aspect: number;
};

type Result = {
  dataUrl: string;
  width: number;
  height: number;
};

const DEFAULTS: Settings = {
  width: 1024,
  height: 1024,
  lockAspect: true,
  dpiScale: 1,
  background: "solid",
  bgColor: "#ffffff",
  antiAlias: true,
  jpegQuality: 0.9,
  fileName: "converted",
};

const MAX_CANVAS_PIXELS = 80_000_000;

export default function SvgToJpgConverter(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [svgInfo, setSvgInfo] = React.useState<SvgInfo | null>(null);

  // Live upload preview only
  const [previewSvgUrl, setPreviewSvgUrl] = React.useState<string | null>(null);

  // Convert on demand
  const [result, setResult] = React.useState<Result | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewSvgUrl) URL.revokeObjectURL(previewSvgUrl);
    };
  }, [previewSvgUrl]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleNewFile(f);
    e.currentTarget.value = "";
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await handleNewFile(f);
  }

  async function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (
          f &&
          (f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
        ) {
          e.preventDefault();
          await handleNewFile(f);
          return;
        }
      }
    }
  }

  async function handleNewFile(f: File) {
    setErr(null);
    setResult(null);

    if (
      !(f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
    ) {
      setErr("Please choose an SVG file.");
      return;
    }

    if (previewSvgUrl) URL.revokeObjectURL(previewSvgUrl);

    setFile(f);

    const text = await f.text();
    const safeText = sanitizeSvgForRaster(text);
    setSvgText(safeText);

    const info = parseSvgSize(safeText) || {
      width: 1024,
      height: 1024,
      aspect: 1,
    };
    setSvgInfo(info);

    const baseName = stripExt(f.name) || "converted";
    setSettings((s) => ({
      ...s,
      fileName: baseName,
      width: clampInt(Math.round(info.width), 16, 16384),
      height: clampInt(Math.round(info.height), 16, 16384),
      lockAspect: true,
      dpiScale: clampDpiScale(s.dpiScale),
      jpegQuality: clampJpegQuality(s.jpegQuality),
      background: "solid",
    }));

    // Use data URL for preview (more predictable than Blob URL)
    setPreviewSvgUrl(svgToDataUrl(ensureSvgHasXmlns(safeText)));
  }

  function clearAll() {
    if (previewSvgUrl) URL.revokeObjectURL(previewSvgUrl);
    setFile(null);
    setSvgText("");
    setSvgInfo(null);
    setPreviewSvgUrl(null);
    setResult(null);
    setErr(null);
  }

  function onWidthChange(v: number) {
    setSettings((s) => {
      const width = clampInt(v, 16, 16384);
      if (!svgInfo || !s.lockAspect) return { ...s, width };
      const height = clampInt(Math.round(width / svgInfo.aspect), 16, 16384);
      return { ...s, width, height };
    });
  }

  function onHeightChange(v: number) {
    setSettings((s) => {
      const height = clampInt(v, 16, 16384);
      if (!svgInfo || !s.lockAspect) return { ...s, height };
      const width = clampInt(Math.round(height * svgInfo.aspect), 16, 16384);
      return { ...s, width, height };
    });
  }

  async function convert() {
    if (!svgText) {
      setErr("Paste or upload an SVG first.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await svgToJpgDataUrl(svgText, svgInfo, settings);
      setResult(r);
      showToast("Converted");
    } catch (e: any) {
      setErr(e?.message || "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadJpg() {
    if (!result) return;
    const name = (settings.fileName || "converted").trim() || "converted";
    const filename = `${safeFileName(name)}.jpg`;
    downloadDataUrl(result.dataUrl, filename);
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG to JPG", href: "/svg-to-jpg-converter" },
  ];

  const buttonDisabled = !hydrated || busy || !svgText;

  return (
    <>
      <SiteHeader />

      <main
        className="min-h-[100dvh] bg-slate-50 text-slate-900"
        onPaste={onPaste}
      >
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <Breadcrumbs crumbs={crumbs} />

          <header className="text-center mb-3">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>SVG</span>
              <span className="text-slate-400">→</span>
              <span className="text-[#0b2dff]">JPG</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Instant <b>SVG to JPG</b> conversion in your browser. Resize
              width/height, pick a background color, set JPEG quality, and
              download. <b>No uploads</b>, no server processing.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Upload SVG
              </h2>

              {!file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => document.getElementById("svg-inp")?.click()}
                  className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <div className="text-sm text-slate-600">
                    Click, drag & drop, or paste an SVG file
                  </div>
                  <input
                    id="svg-inp"
                    type="file"
                    accept="image/svg+xml,.svg"
                    onChange={onPick}
                    className="hidden"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
                    <div className="flex items-center min-w-0 gap-2">
                      <span className="truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                    >
                      ×
                    </button>
                  </div>

                  {svgInfo && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected:{" "}
                      <b>
                        {Math.round(svgInfo.width)}×{Math.round(svgInfo.height)}
                      </b>
                      {svgInfo.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          • viewBox {svgInfo.viewBox}
                        </span>
                      ) : null}
                    </div>
                  )}
                </>
              )}

              {/* Live upload preview only */}
              {previewSvgUrl && (
                <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    SVG preview (client-side)
                  </div>
                  <div className="p-3">
                    <img
                      src={previewSvgUrl}
                      alt="SVG preview"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}

              {file && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                    Advanced: Edit SVG source
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-slate-600 mt-2">
                      Editing is optional. Most users can just upload and
                      convert.
                    </p>
                    <textarea
                      value={svgText}
                      onChange={(e) => {
                        setSvgText(ensureSvgHasXmlns(e.target.value));
                        setResult(null);
                        setErr(null);
                      }}
                      className="mt-2 w-full h-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  </div>
                </details>
              )}
            </div>

            {/* SETTINGS + RESULT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 shadow-sm min-w-0">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900 flex items-center gap-2">
                Convert & Download
                {busy && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                )}
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="grid gap-2">
                  <Field label="Output width (px)">
                    <NumInt
                      value={settings.width}
                      min={16}
                      max={16384}
                      step={1}
                      onChange={onWidthChange}
                    />
                  </Field>

                  <Field label="Output height (px)">
                    <NumInt
                      value={settings.height}
                      min={16}
                      max={16384}
                      step={1}
                      onChange={onHeightChange}
                    />
                  </Field>

                  <Field label="Lock aspect ratio">
                    <input
                      type="checkbox"
                      checked={settings.lockAspect}
                      onChange={(e) =>
                        setSettings((s) => {
                          const lockAspect = e.target.checked;
                          if (!lockAspect) return { ...s, lockAspect };
                          if (!svgInfo) return { ...s, lockAspect };
                          const height = clampInt(
                            Math.round(s.width / svgInfo.aspect),
                            16,
                            16384,
                          );
                          return { ...s, lockAspect, height };
                        })
                      }
                      className="h-4 w-4 accent-[#0b2dff]"
                    />
                    <span className="text-[13px] text-slate-700">
                      Keep original proportions
                    </span>
                  </Field>

                  <Field label="Quality (pixel ratio)">
                    <select
                      value={settings.dpiScale}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          dpiScale: clampDpiScale(Number(e.target.value)),
                        }))
                      }
                      className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value={1}>1x (smallest)</option>
                      <option value={2}>2x (sharper)</option>
                      <option value={3}>3x</option>
                      <option value={4}>4x (largest)</option>
                    </select>
                    <span className="text-[12px] text-slate-500">
                      Renders higher-res JPG
                    </span>
                  </Field>

                  <Field label="Background color">
                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, bgColor: e.target.value }))
                      }
                      className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                      title="Pick background color"
                    />
                    <span className="text-[12px] text-slate-500">
                      JPG does not support transparency
                    </span>
                  </Field>

                  <Field label="JPEG quality">
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={settings.jpegQuality}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          jpegQuality: clampJpegQuality(Number(e.target.value)),
                        }))
                      }
                      className="w-full accent-[#0b2dff]"
                    />
                    <span className="text-[12px] text-slate-700 w-[64px] text-right">
                      {(settings.jpegQuality * 100).toFixed(0)}%
                    </span>
                  </Field>

                  <Field label="Anti-aliasing">
                    <input
                      type="checkbox"
                      checked={settings.antiAlias}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          antiAlias: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff]"
                    />
                    <span className="text-[13px] text-slate-700">
                      Smoother edges
                    </span>
                  </Field>

                  <Field label="JPG filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="converted"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={convert}
                    disabled={!hydrated || busy || !svgText}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {busy ? "Converting…" : "Convert to JPG"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadJpg}
                    disabled={!result || busy}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Download JPG
                  </button>

                  {err && <span className="text-red-700 text-sm">{err}</span>}
                  {!err && result && (
                    <span className="text-[13px] text-slate-600">
                      Output:{" "}
                      <b>
                        {result.width}×{result.height}
                      </b>{" "}
                      px
                    </span>
                  )}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  How it works: your SVG is rendered to an HTML canvas in your
                  browser, filled with a background color, then exported as a
                  JPG. JPG cannot be transparent.
                </div>
              </div>

              {/* RESULT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  JPG preview
                </div>
                <div className="p-3">
                  {result ? (
                    <img
                      src={result.dataUrl}
                      alt="JPG result"
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Convert to see your JPG preview here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>

      <SeoSections />
      <JsonLdBreadcrumbs />
      <JsonLdFaq />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Conversion
======================== */
/* ========================
   Replace svgToJpgDataUrl with this (predictable raster + less failures)
======================== */
async function svgToJpgDataUrl(
  svgText: string,
  svgInfo: SvgInfo | null,
  settings: Settings,
): Promise<Result> {
  const info = svgInfo ||
    parseSvgSize(svgText) || { width: 1024, height: 1024, aspect: 1 };

  const outW = clampInt(settings.width, 16, 16384);
  const outH = clampInt(settings.height, 16, 16384);

  const dpi = clampDpiScale(settings.dpiScale);
  const q = clampJpegQuality(settings.jpegQuality);

  const pxW = Math.max(1, Math.round(outW * dpi));
  const pxH = Math.max(1, Math.round(outH * dpi));

  if (pxW * pxH > MAX_CANVAS_PIXELS) {
    throw new Error("Output is too large. Lower width/height or quality.");
  }

  const sanitized = sanitizeSvgForRaster(svgText);
  const sizedSvg = withRasterViewport(sanitized, outW, outH, info);

  // Load via data URL (avoids object URL + some cross-origin edge cases)
  const img = await loadImage(svgToDataUrl(sizedSvg));

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available.");

  ctx.imageSmoothingEnabled = !!settings.antiAlias;
  ctx.imageSmoothingQuality = settings.antiAlias ? "high" : "low";

  // background fill (JPG)
  ctx.fillStyle = settings.bgColor || "#ffffff";
  ctx.fillRect(0, 0, pxW, pxH);

  // draw into scaled pixel canvas
  ctx.drawImage(img, 0, 0, pxW, pxH);

  const dataUrl = canvas.toDataURL("image/jpeg", q);
  return { dataUrl, width: pxW, height: pxH };
}

function clamp01(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.9;
  return Math.max(0.1, Math.min(1, n));
}

function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ========================
   SVG size parsing
======================== */
/* ========================
   Replace parseSvgSize with unit-aware version (px/in/cm/mm/pt/pc)
======================== */
function parseSvgSize(svg: string): SvgInfo | null {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!open) return null;

  const wAttr = matchAttr(open, "width");
  const hAttr = matchAttr(open, "height");
  const vb = matchAttr(open, "viewBox");

  const w = wAttr ? parseLengthToPx(wAttr) : null;
  const h = hAttr ? parseLengthToPx(hAttr) : null;

  if (w && h)
    return { width: w, height: h, viewBox: vb || undefined, aspect: w / h };

  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map((x) => Number(x));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const vbW = Math.abs(parts[2]);
      const vbH = Math.abs(parts[3]);
      if (vbW > 0 && vbH > 0)
        return { width: vbW, height: vbH, viewBox: vb, aspect: vbW / vbH };
    }
  }
  return null;
}

function parseLengthToPx(raw: string): number | null {
  const s = String(raw).trim().toLowerCase();

  // percentages are not absolute, treat as unknown
  if (/%$/.test(s)) return null;

  const m = s.match(/^(-?\d+(\.\d+)?)([a-z]+)?/);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n) || n === 0) return null;

  const unit = (m[3] || "px").toLowerCase();

  // 96dpi baseline per CSS px
  const abs = Math.abs(n);
  if (unit === "px") return abs;
  if (unit === "in") return abs * 96;
  if (unit === "cm") return (abs * 96) / 2.54;
  if (unit === "mm") return (abs * 96) / 25.4;
  if (unit === "pt") return (abs * 96) / 72;
  if (unit === "pc") return (abs * 96) / 6;

  // em/rem/etc are not absolute without context
  return null;
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseNumber(s: string): number | null {
  const m = String(s)
    .trim()
    .match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n !== 0 ? Math.abs(n) : null;
}

function clampInt(v: number, lo: number, hi: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function stripExt(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "converted"
  );
}

/* ========================
   UI helpers
======================== */
function sanitizeSvgForRaster(svg: string) {
  // light but effective: remove scripts, foreignObject, event handlers, javascript: hrefs
  let s = ensureSvgHasXmlns(svg);
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  s = s.replace(/<script\b[^>]*\/\s*>/gi, "");
  s = s.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, "");
  s = s.replace(/<foreignObject\b[^>]*\/\s*>/gi, "");
  s = s.replace(/\s(on[a-zA-Z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g, "");
  s = s.replace(
    /\s(?:href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    (m) => {
      const valMatch = m.match(/=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const raw = (valMatch?.[1] || valMatch?.[2] || valMatch?.[3] || "")
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase()
        .replace(/\s+/g, "");
      return raw.startsWith("javascript:") ? "" : m;
    },
  );

  // collapse whitespace a bit (helps data URL size)
  s = s
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s;
}

function clampDpiScale(v: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4, n));
}

function clampJpegQuality(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.9;
  return Math.max(0.1, Math.min(1, n));
}

function svgToDataUrl(svg: string) {
  // safest way to load SVG into <img> without CORS taint from Blob URL edge cases
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/*
Inject output sizing into SVG so rasterization is predictable.
- If SVG has viewBox, keep it.
- If missing viewBox, create one from detected size.
- Always set width/height to requested output px (not dpiScale px).
*/
function withRasterViewport(
  svg: string,
  outW: number,
  outH: number,
  info: SvgInfo | null,
) {
  let s = ensureSvgHasXmlns(svg);

  const openMatch = s.match(/<svg\b[^>]*>/i);
  if (!openMatch) return s;
  const open = openMatch[0];

  let next = open;

  // Ensure a viewBox exists (critical for consistent scaling)
  const hasVB = /viewBox\s*=\s*["'][^"']*["']/i.test(next);
  if (!hasVB) {
    const vbW = Math.max(1, Math.round(info?.width || outW));
    const vbH = Math.max(1, Math.round(info?.height || outH));
    next = setOrReplaceAttr(next, "viewBox", `0 0 ${vbW} ${vbH}`);
  }

  next = setOrReplaceAttr(next, "width", `${outW}`);
  next = setOrReplaceAttr(next, "height", `${outH}`);

  // keep aspect behavior reasonable
  if (!/preserveAspectRatio\s*=/.test(next)) {
    next = setOrReplaceAttr(next, "preserveAspectRatio", "xMidYMid meet");
  }

  return s.replace(open, next);
}

function setOrReplaceAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag))
    return tag.replace(
      re,
      ` ${name}="${String(value).replace(/"/g, "&quot;")}"`,
    );
  return tag.replace(
    /<svg\b/i,
    (m) => `${m} ${name}="${String(value).replace(/"/g, "&quot;")}"`,
  );
}

/* ========================
   Replace loadImage with this (better SVG handling)
======================== */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Could not render this SVG. Try embedding fonts/images, removing external references, or simplifying filters.",
        ),
      );
    img.src = url;
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </label>
  );
}

function NumInt({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-[130px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}

/* ========================
   Header / Footer
======================== */
function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo (unchanged) */}
        <a href="/" className="font-extrabold tracking-tight text-slate-900">
          i<span className="text-sky-600">🩵</span>SVG
        </a>

        {/* Right-side nav */}
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
            <span className="text-slate-500">
              Simple SVG tools, no accounts.
            </span>
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
                  to="/svg-to-png-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  SVG to PNG
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-to-jpg-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  SVG to JPG
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-to-webp-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  SVG to WebP
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-background-editor"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Background
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-resize-and-scale-editor"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Resize / Scale
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-recolor"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Recolor
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
   Breadcrumbs UI + JSON-LD
======================== */
function Breadcrumbs({
  crumbs,
}: {
  crumbs: Array<{ name: string; href: string }>;
}) {
  return (
    <div className="mb-4">
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-600">
        <ol className="flex flex-wrap items-center gap-2">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex items-center gap-2">
              <a href={c.href} className="hover:text-slate-900">
                {c.name}
              </a>
              {i < crumbs.length - 1 ? (
                <span className="text-slate-300">/</span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

function JsonLdBreadcrumbs() {
  const baseUrl = "https://ilovesvg.com";

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "SVG to JPG",
        item: `${baseUrl}/svg-to-jpg`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/* ========================
   FAQ JSON-LD
======================== */
function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does this SVG to JPG converter upload my file?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. This converter runs entirely in your browser using HTML canvas. Your SVG is not uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "Can I set a custom width and height?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. You can set output width and height in pixels. Enable “Lock aspect ratio” to keep the original proportions.",
        },
      },
      {
        "@type": "Question",
        name: "Why do I need a background color for JPG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "JPG does not support transparency. The converter fills the canvas with your chosen background color before exporting to JPG.",
        },
      },
      {
        "@type": "Question",
        name: "How do I reduce JPG file size?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lower the JPEG quality slider or export at a smaller width/height. Lower quality and smaller dimensions produce smaller files.",
        },
      },
      {
        "@type": "Question",
        name: "Why won’t some SVGs convert?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Some SVGs reference external images, fonts, or unsupported features that the browser can’t render to canvas. Try embedding assets directly inside the SVG.",
        },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/* ========================
   SEO sections
======================== */
/* ========================
   HIGH-ROI SEO + VISIBLE FAQ (replace SeoSections entirely)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">SVG to JPG Converter (Client-Side)</h2>

          <p className="mt-3">
            Convert <strong>SVG to JPG</strong> instantly in your browser. Set
            an exact pixel size, lock aspect ratio, choose a background color,
            and control JPEG compression. Files stay on your device with{" "}
            <strong>no uploads</strong>.
          </p>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Convert SVG to JPG
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload (or paste) an SVG.</li>
              <li itemProp="step">Pick output width and height in pixels.</li>
              <li itemProp="step">
                Choose a background color (JPG has no transparency).
              </li>
              <li itemProp="step">Adjust pixel ratio and JPEG quality.</li>
              <li itemProp="step">Convert, preview, then download the JPG.</li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Best Uses</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Exporting SVG logos for platforms that only accept JPG</li>
              <li>
                Creating thumbnails and previews for blog posts and marketplaces
              </li>
              <li>Batch-like workflows: convert one SVG at multiple sizes</li>
              <li>Reducing file size using JPEG compression</li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Quality Tips</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                Increase <strong>pixel ratio</strong> (2x or 3x) for sharper
                edges, especially for text and thin strokes.
              </li>
              <li>
                Lower <strong>JPEG quality</strong> to shrink the file size. For
                logos, avoid very low quality because JPG can introduce
                artifacts.
              </li>
              <li>
                Need transparency? Use{" "}
                <a href="/svg-to-png-converter">SVG to PNG</a> instead.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Troubleshooting</h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">The JPG preview is blank</h4>
                <p className="mt-1">
                  The SVG may reference external fonts or images, or use
                  advanced filters that the browser cannot rasterize reliably.
                  Embed assets into the SVG, or simplify filters and fonts.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">The output looks blurry</h4>
                <p className="mt-1">
                  Raise pixel ratio or export larger dimensions. If the SVG
                  contains small text, 2x or 3x usually improves clarity.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">File size is too large</h4>
                <p className="mt-1">
                  Reduce width and height first, then lower JPEG quality.
                  Dimension changes usually save more than quality changes.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">FAQ</h3>

            <div className="not-prose mt-3 grid gap-3">
              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Does this SVG to JPG converter upload my file?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  No. Conversion runs entirely in your browser using HTML
                  canvas. Your SVG does not get uploaded to any server.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Can I set a custom width and height?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Yes. Set output width and height in pixels. Turn on Lock
                  aspect ratio to keep the original proportions.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Why do I need a background color?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  JPG does not support transparency. The converter fills the
                  canvas with your chosen background color before exporting.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>How do I reduce JPG file size?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Lower JPEG quality or export at a smaller width and height.
                  Smaller dimensions usually reduce size more than quality
                  changes.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Why won’t some SVGs convert?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Some SVGs reference external fonts/images or use unsupported
                  features that the browser can’t render to canvas. Embed assets
                  directly in the SVG or simplify filters.
                </div>
              </details>
            </div>
          </section>

          <section className="mt-10 not-prose">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Related tools
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-to-png-converter"
                >
                  SVG to PNG
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-to-webp-converter"
                >
                  SVG to WebP
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-resize-and-scale-editor"
                >
                  SVG Resize / Scale
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-recolor"
                >
                  SVG Recolor
                </a>
              </div>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
