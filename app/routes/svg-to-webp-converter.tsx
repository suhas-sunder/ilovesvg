import * as React from "react";
import type { Route } from "./+types/svg-to-webp-converter";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | SVG to WebP Converter (Resize & Quality)";
  const description =
    "Convert SVG to WebP instantly with iLoveSVG. Resize by width or height, preserve aspect ratio, choose solid or transparent backgrounds, set WebP quality, and download the result. Free, fully client-side, no uploads.";
  const canonical = "https://www.ilovesvg.com/svg-to-webp-converter";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    { rel: "canonical", href: canonical },

    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

/* ========================
   Types
======================== */
type Settings = {
  width: number;
  height: number;
  lockAspect: boolean;

  // render scale for sharper output
  dpiScale: number; // 1..4

  // WebP can be transparent OR solid background
  background: "transparent" | "solid";
  bgColor: string;

  antiAlias: boolean;

  // 0.1..1
  webpQuality: number;

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
  mime: string;
};

const DEFAULTS: Settings = {
  width: 1024,
  height: 1024,
  lockAspect: true,
  dpiScale: 1,
  background: "transparent",
  bgColor: "#ffffff",
  antiAlias: true,
  webpQuality: 0.9,
  fileName: "converted",
};

const MAX_CANVAS_PIXELS = 80_000_000;

export default function SvgToWebpConverter(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  const [webpSupported, setWebpSupported] = React.useState(true);

  React.useEffect(() => {
    setHydrated(true);
    setWebpSupported(supportsWebpExport());
  }, []);

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
      webpQuality: clamp01(s.webpQuality),
      background: s.background,
      bgColor: s.bgColor,
      antiAlias: s.antiAlias,
    }));

    // Blob URL preview (reliable)
    const url = svgToObjectUrl(ensureSvgHasXmlns(safeText));
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
      const r = await svgToWebpDataUrl(svgText, svgInfo, settings);
      setResult(r);
      showToast("Converted");
    } catch (e: any) {
      setErr(e?.message || "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadWebp() {
    if (!result) return;
    const name = (settings.fileName || "converted").trim() || "converted";
    const filename = `${safeFileName(name)}.webp`;
    downloadDataUrl(result.dataUrl, filename);
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG → WebP", href: "/svg-to-webp-converter" },
  ];

  const buttonDisabled = !hydrated || busy || !svgText;

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]" onPaste={onPaste}>
        <div className="max-w-[1180px] mx-auto px-4">
          <div className="hidden lg:block py-6">
            <AdSenseDelayed
              slot="2090332782"
              delayMs={1500}
              minHeight={90}
              maxHeight={120}
              format="horizontal"
              fullWidth={true}
              className="mx-auto w-full max-w-[970px]"
            />
          </div>

          <section className="grid grid-cols-1 gap-4 items-start sm:pt-5 md:grid-cols-2 lg:pt-0 lg:pb-8">
            {/* INPUT */}
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="inline-flex text-center text-sky-800 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                SVG to WebP Converter
              </h1>

              {!file ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
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
                      className="w-full h-auto block transparent-checkerboard"
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
                        setSvgText(sanitizeSvgForRaster(e.target.value));
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
            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start">
              <h2 className="m-0 font-bold mb-3 text-lg text-white flex items-center gap-2">
                Convert Settings
                {busy && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                )}
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="mt-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="mb-2 w-full inline-flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                    aria-expanded={showAdvanced}
                    aria-controls="advanced-settings"
                  >
                    <span className="inline-flex items-center justify-center">
                      <Icons name="settings" size={16} className="mr-1" />
                      Advanced settings
                    </span>
                    <svg
                      className={[
                        "h-4 w-4 text-slate-500 transition-transform",
                        showAdvanced ? "rotate-180" : "rotate-0",
                      ].join(" ")}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {showAdvanced && (
                    <div
                      id="advanced-settings"
                      className="flex flex-col gap-2 min-w-0"
                    >
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
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
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
                            className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value={1}>1x (smallest)</option>
                            <option value={2}>2x (sharper)</option>
                            <option value={3}>3x</option>
                            <option value={4}>4x (largest)</option>
                          </select>
                          <span className="text-[12px] text-slate-500">
                            Renders higher-res WebP
                          </span>
                        </Field>

                        <Field label="Background">
                          <select
                            value={settings.background}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                background: e.target
                                  .value as Settings["background"],
                              }))
                            }
                            className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="transparent">Transparent</option>
                            <option value="solid">Solid color</option>
                          </select>

                          <input
                            type="color"
                            value={settings.bgColor}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                bgColor: e.target.value,
                              }))
                            }
                            aria-disabled={
                              settings.background === "transparent"
                            }
                            className={[
                              "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
                              settings.background === "transparent"
                                ? "opacity-50 pointer-events-none"
                                : "",
                            ].join(" ")}
                            title={
                              settings.background === "transparent"
                                ? "Switch to Solid to pick a background color"
                                : "Pick background color"
                            }
                          />
                        </Field>

                        <Field label="WebP quality">
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={settings.webpQuality}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                webpQuality: clamp01(Number(e.target.value)),
                              }))
                            }
                            className="w-full accent-[#0b2dff] cursor-pointer"
                          />
                          <span className="text-[12px] text-slate-700 w-[64px] text-right">
                            {(settings.webpQuality * 100).toFixed(0)}%
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
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                          <span className="text-[13px] text-slate-700">
                            Smoother edges
                          </span>
                        </Field>

                        <Field label="WebP filename">
                          <input
                            value={settings.fileName}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                fileName: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                            placeholder="converted"
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions stay outside advanced panel */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={convert}
                    disabled={buttonDisabled}
                    className={[
                      "inline-flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
                      "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="convert" size={20} className="mr-1" />
                    {busy ? "Converting…" : "Convert to WebP"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadWebp}
                    disabled={!result || busy}
                    className={[
                      "inline-flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="download" size={20} className="mr-1" />
                    Download WebP
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
                  browser and exported as WebP. WebP can be transparent or
                  solid-background depending on your selection.
                </div>

                {hydrated && !webpSupported && (
                  <div className="mt-3 text-[13px] text-amber-700">
                    Your browser may not support WebP export via canvas. Try a
                    modern Chromium-based browser.
                  </div>
                )}
              </div>

              {/* RESULT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  WebP preview
                </div>
                <div className="p-3">
                  {result ? (
                    <img
                      src={result.dataUrl}
                      alt="WebP result"
                      className="w-full h-auto block transparent-checkerboard"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Convert to see your WebP preview here.
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

      <div className="block lg:hidden py-6">
        <AdSenseDelayed
          slot="6632213024"
          delayMs={1500}
          minHeight={90}
          maxHeight={100}
          format="horizontal"
          fullWidth={true}
          className="mx-auto w-full max-w-[360px]"
        />
      </div>
      <ContextualAffiliateCard />

      <SeoSections />

      {/* Keep JSON-LD only, visible FAQ is inside SeoSections. Avoid duplicate FAQ on-page + JSON-LD mismatch issues by keeping content aligned. */}
      <JsonLdBreadcrumbs />
      <JsonLdFaq />

      <Breadcrumbs crumbs={crumbs} />
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
async function svgToWebpDataUrl(
  svgText: string,
  svgInfo: SvgInfo | null,
  settings: Settings,
): Promise<Result> {
  if (!supportsWebpExport()) {
    throw new Error("WebP export is not supported in this browser.");
  }

  const info = svgInfo ||
    parseSvgSize(svgText) || {
      width: 1024,
      height: 1024,
      aspect: 1,
    };

  const outW = clampInt(settings.width, 16, 16384);
  const outH = clampInt(settings.height, 16, 16384);

  const dpi = clampDpiScale(settings.dpiScale);
  const pxW = Math.max(1, Math.round(outW * dpi));
  const pxH = Math.max(1, Math.round(outH * dpi));

  if (pxW * pxH > MAX_CANVAS_PIXELS) {
    throw new Error("Output is too large. Lower width/height or quality.");
  }

  const sanitized = sanitizeSvgForRaster(svgText);
  const sizedSvg = withRasterViewport(sanitized, outW, outH, info);

  const img = await loadSvgImage(sizedSvg);

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available.");

  ctx.imageSmoothingEnabled = !!settings.antiAlias;
  ctx.imageSmoothingQuality = settings.antiAlias ? "high" : "low";

  if (settings.background === "solid") {
    ctx.fillStyle = settings.bgColor || "#ffffff";
    ctx.fillRect(0, 0, pxW, pxH);
  } else {
    ctx.clearRect(0, 0, pxW, pxH);
  }

  ctx.drawImage(img, 0, 0, pxW, pxH);

  const q = clamp01(settings.webpQuality);
  const dataUrl = canvas.toDataURL("image/webp", q);

  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  if (mime !== "image/webp") {
    throw new Error(
      "WebP export failed (browser returned a different format).",
    );
  }

  return { dataUrl, width: pxW, height: pxH, mime };
}

function supportsWebpExport() {
  try {
    const c = document.createElement("canvas");
    const d = c.toDataURL("image/webp");
    return d.startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function clamp01(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.9;
  return Math.max(0.1, Math.min(1, n));
}

function clampDpiScale(v: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4, n));
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
   SVG size parsing (unit-aware)
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

  if (/%$/.test(s)) return null;

  const m = s.match(/^(-?\d+(\.\d+)?)([a-z]+)?/);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n) || n === 0) return null;

  const unit = (m[3] || "px").toLowerCase();

  const abs = Math.abs(n);
  if (unit === "px") return abs;
  if (unit === "in") return abs * 96;
  if (unit === "cm") return (abs * 96) / 2.54;
  if (unit === "mm") return (abs * 96) / 25.4;
  if (unit === "pt") return (abs * 96) / 72;
  if (unit === "pc") return (abs * 96) / 6;

  return null;
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
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
   SVG sanitization + predictable raster viewport
======================== */
function sanitizeSvgForRaster(svg: string) {
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

  s = s
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s;
}

function svgToObjectUrl(svg: string) {
  const s = ensureSvgHasXmlns(svg);
  const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = svgToObjectUrl(svg);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Could not render this SVG. Try embedding fonts/images, removing external references, or simplifying filters.",
        ),
      );
    };

    img.src = url;
  });
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

  const hasVB = /viewBox\s*=\s*["'][^"']*["']/i.test(next);
  if (!hasVB) {
    const vbW = Math.max(1, Math.round(info?.width || outW));
    const vbH = Math.max(1, Math.round(info?.height || outH));
    next = setOrReplaceAttr(next, "viewBox", `0 0 ${vbW} ${vbH}`);
  }

  next = setOrReplaceAttr(next, "width", `${outW}`);
  next = setOrReplaceAttr(next, "height", `${outH}`);

  if (!/preserveAspectRatio\s*=/.test(next)) {
    next = setOrReplaceAttr(next, "preserveAspectRatio", "xMidYMid meet");
  }

  return s.replace(open, next);
}

function setOrReplaceAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag)) {
    return tag.replace(
      re,
      ` ${name}="${String(value).replace(/"/g, "&quot;")}"`,
    );
  }
  return tag.replace(
    /<svg\b/i,
    (m) => `${m} ${name}="${String(value).replace(/"/g, "&quot;")}"`,
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
   Breadcrumbs UI + JSON-LD
======================== */
function Breadcrumbs({
  crumbs,
}: {
  crumbs: Array<{ name: string; href: string }>;
}) {
  return (
    <div className="mb-4">
      <nav
        aria-label="Breadcrumb"
        className="text-[13px] text-slate-600 max-w-[1180px] mx-auto px-4"
      >
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
  const baseUrl = "https://www.ilovesvg.com";

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "SVG to WebP",
        item: `${baseUrl}/svg-to-webp-converter`,
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
   FAQ JSON-LD (deduped + aligned with visible FAQ)
======================== */
function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does this SVG to WebP converter upload my file?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. This converter runs entirely in your browser using HTML canvas. Your SVG is not uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "Can WebP be transparent?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. WebP supports transparency. Choose Transparent background to keep the alpha channel, or Solid color to flatten onto a background.",
        },
      },
      {
        "@type": "Question",
        name: "Can I set a custom width and height?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Set output width and height in pixels. Enable Lock aspect ratio to keep the original proportions.",
        },
      },
      {
        "@type": "Question",
        name: "How do I reduce WebP file size?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lower the WebP quality slider or export at a smaller width and height. Lower quality and smaller dimensions produce smaller files.",
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
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/* ========================
   SEO sections (includes visible FAQ)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG to WebP Converter (Free, Instant, Client-Side)
          </h2>

          <p className="mt-3">
            Use this <strong>SVG to WebP converter</strong> to export vector
            artwork to a modern, high-compression <strong>WebP</strong> image
            without uploading anything. Conversion happens{" "}
            <strong>fully in your browser</strong> by rendering the SVG onto an
            HTML canvas and exporting it as WebP. You can set a custom{" "}
            <strong>width and height</strong>, lock aspect ratio, choose a{" "}
            <strong>transparent</strong> or <strong>solid</strong> background,
            and control <strong>WebP quality</strong> so the output matches your
            exact use case.
          </p>

          <p className="mt-2 text-slate-600">
            Instant <b>SVG to WebP</b> conversion in your browser. Resize
            width/height, keep aspect ratio, choose a <b>transparent</b> or{" "}
            <b>solid</b> background, set WebP quality, and download.{" "}
            <b>No uploads</b>, no server processing.
          </p>

          <div className="mt-6 not-prose grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Smaller images
              </div>
              <div className="mt-1 text-sm text-slate-700">
                WebP usually compresses better than PNG and JPG for typical web
                assets, while still looking clean.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Transparency support
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Export transparent WebP for icons, overlays, and UI assets, or
                flatten onto a solid background.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Output control
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Set pixel dimensions, lock aspect ratio, and adjust WebP quality
                to hit a size target.
              </div>
            </div>
          </div>
          <ExampleSvgConversion />
          <div className="block py-6">
            <AdSenseDelayed
              slot="7336722354"
              delayMs={2500}
              afterInteraction={true}
              className="my-3"
              format="rectangle"
              fullWidth={false}
              minHeight={250}
              maxHeight={300}
            />
          </div>

          <section>
            <h3 className="m-0 font-bold">What the converter does</h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <p>
                SVG is vector, meaning it can scale cleanly at any size. WebP is
                a raster image format, meaning the output is a fixed pixel grid.
                Converting SVG to WebP is a rendering step: the browser draws
                the SVG at your chosen dimensions (and pixel ratio), then
                encodes the result as a WebP file.
              </p>
              <p>
                This tool is useful when you want a modern, web-friendly asset
                from an SVG without setting up an image pipeline. Because the
                conversion runs client-side, you can iterate quickly: adjust
                width/height, test different quality levels, switch between
                transparent and solid backgrounds, preview the result, and
                export again.
              </p>
            </div>
          </section>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Convert SVG to WebP
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload (or paste) an SVG file.</li>
              <li itemProp="step">
                Set output width and height (enable Lock aspect ratio if
                needed).
              </li>
              <li itemProp="step">Pick Transparent or Solid background.</li>
              <li itemProp="step">
                Adjust Quality (pixel ratio) and WebP quality to hit your
                target.
              </li>
              <li itemProp="step">
                Click Convert to WebP, then Download WebP.
              </li>
            </ol>
          </section>

          <section className="mt-8">
            <h3 className="m-0 font-bold">Tips for Best Results</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                For sharper output, raise <strong>Quality (pixel ratio)</strong>{" "}
                or export larger dimensions.
              </li>
              <li>
                Use <strong>Transparent</strong> background for icons and
                overlays; use <strong>Solid</strong> background when you need a
                predictable backdrop.
              </li>
              <li>
                If your SVG uses external fonts or images, embed them for better
                compatibility.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="m-0 font-bold">FAQ</h3>

            <div className="not-prose mt-3 grid gap-3">
              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Does this SVG to WebP converter upload my file?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  No. The conversion runs in your browser and your SVG never
                  leaves your device.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Can WebP be transparent?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Yes. Choose Transparent background to keep transparency, or
                  Solid color to flatten onto a background.
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
                  Yes. Set width and height in pixels. Turn on Lock aspect ratio
                  to keep the original proportions.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>How do I reduce WebP file size?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Lower WebP quality or export smaller dimensions. Smaller
                  dimensions often reduce size more than aggressive quality
                  loss.
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
                  Some SVGs depend on external fonts or images, or use features
                  the browser cannot rasterize reliably. Embed assets when
                  possible or simplify the SVG.
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
                  href="/svg-to-jpg-converter"
                >
                  SVG to JPG
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
