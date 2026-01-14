import * as React from "react";
import type { Route } from "./+types/svg-to-png-converter";
import { OtherToolsLinks } from "~/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/components/navigation/RelatedSites";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG → PNG Converter (client-side, resize, background, transparency)";
  const description =
    "Convert SVG to PNG instantly in your browser. Resize by width/height, keep aspect ratio, choose transparent or colored background, and download a PNG. No uploads, no server processing.";
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
  dpiScale: number; // 1..4 (simple "quality" knob)
  background: "transparent" | "solid";
  bgColor: string;
  antiAlias: boolean;
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
  bytesEstimate?: number;
};

const DEFAULTS: Settings = {
  width: 1024,
  height: 1024,
  lockAspect: true,
  dpiScale: 1,
  background: "transparent",
  bgColor: "#ffffff",
  antiAlias: true,
  fileName: "converted",
};

const MAX_CANVAS_PIXELS = 80_000_000; // avoids tab-death on huge renders

export default function SvgToPngConverter(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [svgInfo, setSvgInfo] = React.useState<SvgInfo | null>(null);

  // Live preview only for upload/input
  const [previewSvgUrl, setPreviewSvgUrl] = React.useState<string | null>(null);

  // Only convert on demand (no live conversion on settings changes)
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
    const safeText = ensureSvgHasXmlns(text);

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
    }));

    const url = URL.createObjectURL(
      new Blob([safeText], { type: "image/svg+xml" })
    );
    setPreviewSvgUrl(url);
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
      const r = await svgToPngDataUrl(svgText, svgInfo, settings);
      setResult(r);
      showToast("Converted");
    } catch (e: any) {
      setErr(e?.message || "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPng() {
    if (!result) return;
    const name = (settings.fileName || "converted").trim() || "converted";
    const filename = `${safeFileName(name)}.png`;
    downloadDataUrl(result.dataUrl, filename);
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG → PNG", href: "/svg-to-png" },
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
              <span className="text-[#0b2dff]">PNG</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Instant <b>SVG to PNG</b> conversion in your browser. Resize
              width/height, keep transparency, or add a background.{" "}
              <b>No uploads</b>, no server processing.
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

              {/* Optional: show SVG text but collapsed (people search for “edit svg”, “fix svg”, etc.) */}
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
                          // snap height to width when turning on
                          const height = clampInt(
                            Math.round(s.width / svgInfo.aspect),
                            16,
                            16384
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
                          dpiScale: Number(e.target.value),
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
                      Renders higher-res PNG
                    </span>
                  </Field>

                  <Field label="Background">
                    <select
                      value={settings.background}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          background: e.target.value as any,
                        }))
                      }
                      className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="transparent">Transparent</option>
                      <option value="solid">Solid color</option>
                    </select>

                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, bgColor: e.target.value }))
                      }
                      aria-disabled={settings.background !== "solid"}
                      className={[
                        "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
                        settings.background !== "solid"
                          ? "opacity-50 pointer-events-none"
                          : "",
                      ].join(" ")}
                      title={
                        settings.background !== "solid"
                          ? "Switch to Solid color to pick a background"
                          : "Pick background color"
                      }
                    />
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

                  <Field label="PNG filename">
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
                    disabled={buttonDisabled}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {busy ? "Converting…" : "Convert to PNG"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadPng}
                    disabled={!result || busy}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Download PNG
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
                  browser, then exported as a PNG. Transparent background stays
                  transparent unless you choose a solid background color.
                </div>
              </div>

              {/* RESULT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  PNG preview
                </div>
                <div className="p-3">
                  {result ? (
                    <img
                      src={result.dataUrl}
                      alt="PNG result"
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Convert to see your PNG preview here.
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
      <OtherToolsLinks />
      <RelatedSites />
      <JsonLdBreadcrumbs />
      <JsonLdFaq />
      <SiteFooter />
    </>
  );
}

/* ========================
   Conversion
======================== */
async function svgToPngDataUrl(
  svgText: string,
  svgInfo: SvgInfo | null,
  settings: Settings
): Promise<Result> {
  const info = svgInfo ||
    parseSvgSize(svgText) || { width: 1024, height: 1024, aspect: 1 };

  const outW = clampInt(settings.width, 16, 16384);
  const outH = clampInt(settings.height, 16, 16384);

  const pxW = Math.max(1, Math.round(outW * settings.dpiScale));
  const pxH = Math.max(1, Math.round(outH * settings.dpiScale));

  const totalPx = pxW * pxH;
  if (totalPx > MAX_CANVAS_PIXELS) {
    throw new Error("Output is too large. Lower width/height or quality.");
  }

  const svgBlob = new Blob([ensureSvgHasXmlns(svgText)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = pxW;
    canvas.height = pxH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available.");

    ctx.imageSmoothingEnabled = settings.antiAlias;
    ctx.imageSmoothingQuality = "high";

    if (settings.background === "solid") {
      ctx.fillStyle = settings.bgColor;
      ctx.fillRect(0, 0, pxW, pxH);
    } else {
      ctx.clearRect(0, 0, pxW, pxH);
    }

    ctx.drawImage(img, 0, 0, pxW, pxH);

    const dataUrl = canvas.toDataURL("image/png");
    return {
      dataUrl,
      width: pxW,
      height: pxH,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Could not render this SVG. (Some SVGs reference external assets or unsupported features.)"
        )
      );
    img.src = url;
  });
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
function parseSvgSize(svg: string): SvgInfo | null {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!open) return null;

  const wAttr = matchAttr(open, "width");
  const hAttr = matchAttr(open, "height");
  const vb = matchAttr(open, "viewBox");

  const w = wAttr ? parseNumber(wAttr) : null;
  const h = hAttr ? parseNumber(hAttr) : null;

  if (w && h) {
    return { width: w, height: h, viewBox: vb || undefined, aspect: w / h };
  }

  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map((x) => Number(x));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const vbW = Math.abs(parts[2]);
      const vbH = Math.abs(parts[3]);
      if (vbW > 0 && vbH > 0) {
        return { width: vbW, height: vbH, viewBox: vb, aspect: vbW / vbH };
      }
    }
  }

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
      <div className="max-w-[1180px] mx-auto px-4 py-6 text-sm text-slate-600 flex items-center justify-between">
        <span>© {new Date().getFullYear()} i🩵SVG</span>
        <span className="space-x-3">
          <a href="#" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="#" className="hover:text-slate-900">
            Terms
          </a>
        </span>
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
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "SVG → PNG",
        item: "/svg-to-png",
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
   FAQ JSON-LD
======================== */
function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does this SVG to PNG converter upload my file?",
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
        name: "How do I keep the PNG background transparent?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Choose Transparent background. The PNG will keep alpha transparency unless you switch to a solid background color.",
        },
      },
      {
        "@type": "Question",
        name: "Why does my PNG look blurry?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Increase the Quality (pixel ratio) or export at a larger width/height. Higher pixel ratio renders a sharper PNG at the cost of file size.",
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
   SEO sections (on-page + HowTo + FAQ UI)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG to PNG Converter (Free, Instant, Client-Side)
          </h2>
          <p className="mt-3">
            Use this <strong>SVG to PNG converter</strong> to export icons,
            logos, and vector art to a PNG image without uploading anything.
            Conversion happens <strong>fully in your browser</strong> by
            rendering the SVG onto an HTML canvas and exporting it as PNG. You
            can set a custom <strong>width and height</strong>, lock aspect
            ratio, keep transparency, or add a solid background color.
          </p>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Convert SVG to PNG
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload (or paste) an SVG file.</li>
              <li itemProp="step">
                Set output width and height (enable Lock aspect ratio if
                needed).
              </li>
              <li itemProp="step">
                Choose Transparent background or a Solid background color.
              </li>
              <li itemProp="step">Click Convert to PNG, then Download PNG.</li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Common Uses</h3>
            <ul className="mt-3">
              <li>
                Export an SVG logo to PNG for social media or email signatures
              </li>
              <li>Create PNG icons from SVGs for apps or favicons</li>
              <li>Generate transparent PNG stickers from vector art</li>
              <li>Resize SVG artwork to a specific pixel size</li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Tips for Best Quality</h3>
            <ul className="mt-3">
              <li>
                If the output looks soft, raise{" "}
                <strong>Quality (pixel ratio)</strong> or export larger
                dimensions.
              </li>
              <li>
                For crisp edges on icons, keep <strong>Anti-aliasing</strong>{" "}
                enabled (or disable it for pixel-art-like sharp edges).
              </li>
              <li>
                If your SVG uses external fonts/images, embed them to improve
                compatibility.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">FAQ</h3>
            <div className="mt-3 grid gap-4">
              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold">
                  Does this upload my SVG?
                </summary>
                <p className="mt-2 text-slate-700">
                  No. The conversion runs in your browser and your file never
                  leaves your device.
                </p>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold">
                  Can I set a custom width and height?
                </summary>
                <p className="mt-2 text-slate-700">
                  Yes. Set width and height in pixels. Turn on Lock aspect ratio
                  to keep the original proportions.
                </p>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold">
                  How do I keep the PNG background transparent?
                </summary>
                <p className="mt-2 text-slate-700">
                  Choose Transparent background. Your PNG will preserve alpha
                  transparency.
                </p>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold">
                  Why does my PNG look blurry?
                </summary>
                <p className="mt-2 text-slate-700">
                  Increase Quality (pixel ratio) or export at a larger size.
                  Higher pixel ratio produces a sharper PNG.
                </p>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold">
                  Why won’t some SVGs convert?
                </summary>
                <p className="mt-2 text-slate-700">
                  Some SVGs depend on external fonts/images or unsupported
                  features that can’t be rendered to canvas. Embed assets
                  directly in the SVG when possible.
                </p>
              </details>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
