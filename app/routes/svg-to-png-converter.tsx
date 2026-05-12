import * as React from "react";
import type { Route } from "./+types/svg-to-png-converter";
import { useLocation } from "react-router";
import { CurrentRouteGuide, CurrentRouteTitle, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import { SvgRasterExportSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "SVG to PNG Converter - Export Transparent PNG Files | iLoveSVG";
  const description =
    "Export SVG files as PNG images in your browser with transparent or solid backgrounds, exact pixel size, scale controls, preview, and download.";
  const canonical = "https://www.ilovesvg.com/svg-to-png-converter";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    { tagName: "link", rel: "canonical", href: canonical },

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
  dpiScale: number; // 1..4
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
  blobUrl: string;
  width: number;
  height: number;
  bytes: number;
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

const MAX_CANVAS_PIXELS = 80_000_000;

export default function SvgToPngConverter(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [svgInfo, setSvgInfo] = React.useState<SvgInfo | null>(null);

  // Live SVG preview (upload/input)
  const [previewSvgUrl, setPreviewSvgUrl] = React.useState<string | null>(null);

  // Live PNG preview (auto-recomputed)
  const [liveResult, setLiveResult] = React.useState<Result | null>(null);

  // "Final" result (after Convert button) for download/toast, etc.
  const [result, setResult] = React.useState<Result | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [busy, setBusy] = React.useState(false);
  const [liveBusy, setLiveBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);

  React.useEffect(() => {
    return () => {
      if (previewSvgUrl) URL.revokeObjectURL(previewSvgUrl);
    };
  }, [previewSvgUrl]);

  React.useEffect(() => {
    return () => {
      if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl);
    };
  }, [result?.blobUrl]);

  React.useEffect(() => {
    return () => {
      if (liveResult?.blobUrl) URL.revokeObjectURL(liveResult.blobUrl);
    };
  }, [liveResult?.blobUrl]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    await handleNewFile(f);
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

  function revokeLiveAndFinal() {
    if (liveResult?.blobUrl) URL.revokeObjectURL(liveResult.blobUrl);
    if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl);
    setLiveResult(null);
    setResult(null);
  }

  function updatePreviewFromSvgText(nextText: string) {
    setErr(null);
    revokeLiveAndFinal();

    const safeText = ensureSvgHasXmlns(nextText);
    setSvgText(safeText);

    const info =
      parseSvgSize(safeText) ||
      ({ width: 1024, height: 1024, aspect: 1 } as SvgInfo);
    setSvgInfo(info);

    setSettings((s) => {
      if (!s.lockAspect) return s;
      const width = clampInt(s.width, 16, 16384);
      const height = clampInt(Math.round(width / info.aspect), 16, 16384);
      return { ...s, height };
    });

    if (previewSvgUrl) URL.revokeObjectURL(previewSvgUrl);
    const url = URL.createObjectURL(
      new Blob([safeText], { type: "image/svg+xml" }),
    );
    setPreviewSvgUrl(url);
  }

  async function handleNewFile(f: File) {
    setErr(null);
    revokeLiveAndFinal();

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

    const info =
      parseSvgSize(safeText) ||
      ({ width: 1024, height: 1024, aspect: 1 } as SvgInfo);
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
      new Blob([safeText], { type: "image/svg+xml" }),
    );
    setPreviewSvgUrl(url);
  }

  function clearAll() {
    if (previewSvgUrl) URL.revokeObjectURL(previewSvgUrl);
    revokeLiveAndFinal();
    setFile(null);
    setSvgText("");
    setSvgInfo(null);
    setPreviewSvgUrl(null);
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

  // ========================
  // LIVE PNG PREVIEW (auto)
  // ========================
  const liveTimer = React.useRef<number | null>(null);
  const liveJobId = React.useRef(0);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!svgText) {
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      setLiveBusy(false);
      return;
    }

    if (liveTimer.current) window.clearTimeout(liveTimer.current);
    const jobId = ++liveJobId.current;

    liveTimer.current = window.setTimeout(async () => {
      setLiveBusy(true);
      try {
        const r = await svgToPngBlobUrl(svgText, svgInfo, settings);
        if (jobId !== liveJobId.current) {
          URL.revokeObjectURL(r.blobUrl);
          return;
        }
        setLiveResult((prev) => {
          if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
          return r;
        });
      } catch {
        // keep last good preview; don't spam errors while typing/toggling
      } finally {
        if (jobId === liveJobId.current) setLiveBusy(false);
      }
    }, 250);

    return () => {
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
    };
  }, [hydrated, svgText, svgInfo, settings]);

  async function convert() {
    if (!svgText) {
      setErr("Paste or upload an SVG first.");
      return;
    }
    setBusy(true);
    setErr(null);

    if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl);

    try {
      const r = await svgToPngBlobUrl(svgText, svgInfo, settings);
      setResult(r);
      showToast("Converted");
    } catch (e: any) {
      setResult(null);
      setErr(e?.message || "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPng() {
    const src = result || liveResult;
    if (!src) return;
    const name = (settings.fileName || "converted").trim() || "converted";
    const filename = `${safeFileName(name)}.png`;
    downloadObjectUrl(src.blobUrl, filename);
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG to PNG", href: "/svg-to-png-converter" },
  ];

  const buttonDisabled = !hydrated || busy || !svgText;
  const previewSrc = liveResult?.blobUrl || result?.blobUrl || null;
  const previewMeta = liveResult || result;
  const fullscreenPreviewItems = React.useMemo(() => {
    const items: Array<Result & { id: string; label: string }> = [];
    if (liveResult) {
      items.push({ ...liveResult, id: "live", label: "Live PNG preview" });
    }
    if (result && result.blobUrl !== liveResult?.blobUrl) {
      items.push({ ...result, id: "converted", label: "Converted PNG" });
    }
    return items;
  }, [liveResult, result]);

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]" onPaste={onPaste}>
        <div className="max-w-[1180px] mx-auto px-4">
          <div className="hidden lg:block py-5">
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
              <h1 className="font-display m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-[28px] font-[800] leading-[1.05] tracking-[-0.035em] text-sky-950 sm:text-[34px]">
                <CurrentRouteTitle fallback="SVG to PNG Converter" />
              </h1>

              {!file ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
              ) : (
                <>
                  <div className="mt-0 flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-slate-900">
                    <div className="flex items-center min-w-0 gap-2">
                      <span className="truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAll}
                      aria-label="Remove selected file"
                      className="rounded-md border border-sky-200 bg-white px-2 py-1 text-slate-600 cursor-pointer transition-colors hover:bg-sky-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      x
                    </button>
                  </div>

                  {svgInfo && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected:{" "}
                      <b>
                        {Math.round(svgInfo.width)} x {Math.round(svgInfo.height)}
                      </b>
                      {svgInfo.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          - viewBox {svgInfo.viewBox}
                        </span>
                      ) : null}
                    </div>
                  )}
                </>
              )}

              {previewSvgUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-700">
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
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                    Advanced: Edit SVG source
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-slate-600 mt-2">
                      Editing is optional. Most users can just upload and
                      convert.
                    </p>
                    <textarea
                      aria-label="SVG source code"
                      value={svgText}
                      onChange={(e) => updatePreviewFromSvgText(e.target.value)}
                      className="mt-2 w-full h-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  </div>
                </details>
              )}

              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={convert}
                  disabled={buttonDisabled}
                  className={[
                    "inline-flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
                    "text-white bg-[#2563eb] border-[#1d4ed8] hover:bg-[#1d4ed8] hover:border-[#1e40af] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons name="convert" size={20} className="mr-1" />
                  {busy ? "Converting..." : "Convert to PNG"}
                </button>

                {err && <span className="text-red-700 text-sm">{err}</span>}
                {!err && previewMeta && (
                  <span className="text-[13px] text-slate-600">
                    Output:{" "}
                    <b>
                      {previewMeta.width} x {previewMeta.height}
                    </b>{" "}
                    px - <b>{formatBytes(previewMeta.bytes)}</b>
                    {liveBusy ? (
                      <span className="ml-2 text-slate-500">updating...</span>
                    ) : null}
                  </span>
                )}
              </div>

              <p className="m-0 mt-3 text-[13px] leading-5 text-slate-600">
                Your SVG renders to canvas in your browser, then exports as a
                PNG. Transparent backgrounds stay transparent unless you choose
                a solid background color.
              </p>
            </div>

            {/* OUTPUT */}
            <div
              data-layout-output-panel="true"
              className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start"
            >
              <h2 className="m-0 font-bold mb-3 text-lg text-white flex items-center gap-2">
                PNG output
                {(busy || liveBusy) && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-white animate-spin" />
                )}
              </h2>

              <div className="mb-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full inline-flex items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-sky-950 cursor-pointer transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-settings"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-600 text-white">
                      <Icons name="settings" size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold leading-5">
                        Settings
                      </span>
                      <span className="block truncate text-[12px] font-medium leading-4 text-sky-700">
                        Size, scale, transparency, and export
                      </span>
                    </span>
                  </span>
                  <svg
                    className={[
                      "h-4 w-4 shrink-0 text-sky-700 transition-transform",
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
                  <div className="mt-3">
                    <SvgRasterExportSettingsPanel
                      id="advanced-settings"
                      open={showAdvanced}
                      settings={settings}
                      setSettings={setSettings}
                      aspect={svgInfo?.aspect ?? null}
                    />
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-700">
                  PNG preview {liveBusy ? "(updating...)" : ""}
                </div>
                <div className="relative bg-slate-200 p-3">
                  {previewSrc ? (
                    <>
                      <FullscreenPreviewButton
                        onOpen={() => setFullscreenPreviewIndex(0)}
                      />
                      <img
                        src={previewSrc}
                        alt="PNG result"
                        className="w-full h-auto block transparent-checkerboard"
                      />
                    </>
                  ) : (
                    <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
                      Upload an SVG to see a live PNG preview here.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={downloadPng}
                disabled={(!liveResult && !result) || busy}
                className={[
                  "mt-3 inline-flex w-full items-center justify-center rounded-lg border px-3.5 py-2 font-bold transition-colors cursor-pointer",
                  "border-sky-600 bg-sky-500 text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                ].join(" ")}
              >
                <Icons name="download" size={20} className="mr-1" />
                Download PNG
              </button>

              {previewMeta && (
                <div className="mt-2 text-center text-[13px] leading-5 text-slate-100">
                  {previewMeta.width} x {previewMeta.height} px -{" "}
                  {formatBytes(previewMeta.bytes)}
                </div>
              )}
            </div>
          </section>
        </div>

        <FullscreenOutputPreview
          items={fullscreenPreviewItems}
          activeIndex={fullscreenPreviewIndex}
          setActiveIndex={setFullscreenPreviewIndex}
          getPreviewImage={(item, index) => ({
            id: item.id,
            label: item.label || `Output ${index + 1}`,
            src: item.blobUrl,
            width: item.width,
            height: item.height,
            kind: "PNG",
          })}
        />

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
      <JsonLdBreadcrumbs />
      {/* Removed JsonLdFaq to avoid duplicated FAQ schema if your app shell already injects it */}
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
async function svgToPngBlobUrl(
  svgText: string,
  svgInfo: SvgInfo | null,
  settings: Settings,
): Promise<Result> {
  const outW = clampInt(settings.width, 16, 16384);
  const outH = clampInt(settings.height, 16, 16384);

  const pxW = Math.max(1, Math.round(outW * settings.dpiScale));
  const pxH = Math.max(1, Math.round(outH * settings.dpiScale));

  const totalPx = pxW * pxH;
  if (totalPx > MAX_CANVAS_PIXELS) {
    throw new Error("Output is too large. Lower width/height or quality.");
  }
  if (pxW > 20000 || pxH > 20000) {
    throw new Error("Output is too large. Lower width/height or quality.");
  }

  function coerceSvgToExactPixelSize(src: string, w: number, h: number) {
    let svg = ensureSvgHasXmlns(src);

    if (!/xmlns:xlink\s*=/.test(svg)) {
      svg = svg.replace(
        /<svg\b/i,
        `<svg xmlns:xlink="http://www.w3.org/1999/xlink"`,
      );
    }

    svg = svg.replace(/<svg\b([^>]*)>/i, (full, attrs) => {
      const cleaned = attrs
        .replace(/\swidth\s*=\s*["'][^"']*["']/i, "")
        .replace(/\sheight\s*=\s*["'][^"']*["']/i, "");
      return `<svg${cleaned} width="${w}" height="${h}">`;
    });

    return svg;
  }

  const coercedSvg = coerceSvgToExactPixelSize(svgText, pxW, pxH);
  const svgBlob = new Blob([coercedSvg], {
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

    const blob = await canvasToBlob(canvas, "image/png");
    if (!blob) throw new Error("Could not export PNG.");
    const blobUrl = URL.createObjectURL(blob);

    return { blobUrl, width: pxW, height: pxH, bytes: blob.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type);
  });
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
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Could not render this SVG. If it uses external images or fonts, try embedding them in the SVG (data URIs) and try again.",
        ),
      );
    img.src = url;
  });
}

function downloadObjectUrl(objectUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = objectUrl;
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

  const widthRaw = matchAttr(open, "width");
  const heightRaw = matchAttr(open, "height");
  const vb = matchAttr(open, "viewBox");

  const wPx = widthRaw ? parseCssLengthToPx(widthRaw) : null;
  const hPx = heightRaw ? parseCssLengthToPx(heightRaw) : null;

  if (wPx && hPx && wPx > 0 && hPx > 0) {
    return {
      width: wPx,
      height: hPx,
      viewBox: vb || undefined,
      aspect: wPx / hPx,
    };
  }

  const vbParsed = parseViewBox(vb);
  if (vbParsed && vbParsed.w > 0 && vbParsed.h > 0) {
    if (wPx && wPx > 0) {
      const h = Math.max(1, Math.round(wPx * (vbParsed.h / vbParsed.w)));
      return {
        width: wPx,
        height: h,
        viewBox: vb || undefined,
        aspect: wPx / h,
      };
    }
    if (hPx && hPx > 0) {
      const w = Math.max(1, Math.round(hPx * (vbParsed.w / vbParsed.h)));
      return {
        width: w,
        height: hPx,
        viewBox: vb || undefined,
        aspect: w / hPx,
      };
    }
    return {
      width: vbParsed.w,
      height: vbParsed.h,
      viewBox: vb || undefined,
      aspect: vbParsed.w / vbParsed.h,
    };
  }

  return null;
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseViewBox(vb: string | null | undefined) {
  if (!vb) return null;
  const parts = vb
    .trim()
    .split(/[\s,]+/)
    .map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [, , w, h] = parts;
  if (w === 0 || h === 0) return null;
  return { w: Math.abs(w), h: Math.abs(h) };
}

function parseCssLengthToPx(raw: string): number | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(-?\d+(\.\d+)?)([a-z%]*)$/i);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;

  const unit = (m[3] || "px").toLowerCase();
  const v = Math.abs(n);

  if (!unit || unit === "px") return v;
  if (unit === "in") return v * 96;
  if (unit === "cm") return (v * 96) / 2.54;
  if (unit === "mm") return (v * 96) / 25.4;
  if (unit === "pt") return (v * 96) / 72;
  if (unit === "pc") return (v * 96) / 6;
  if (unit === "em" || unit === "rem") return v * 16;
  if (unit === "%") return null;
  return null;
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

function formatBytes(bytes: number) {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
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
        name: "SVG to PNG",
        item: `${baseUrl}/svg-to-png-converter`,
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
   SEO sections (RESTORED: original full version)
======================== */
const svgToPngPlatformSeoCopyByPath: Record<
  string,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    cards: Array<{ title: string; body: string }>;
  }
> = {
  "/svg-to-png-for-printify": {
    eyebrow: "Printify PNG export",
    heading: "Prepare Printify print-on-demand PNG artwork",
    intro:
      "Use this version when an SVG logo, illustration, or product design needs a transparent PNG for Printify product artwork, mockups, or preview files. This tool exports the PNG; it does not validate platform upload rules, so check dimensions, background, and product placement before uploading.",
    cards: [
      {
        title: "Transparent product artwork",
        body: "Keep transparency when the design needs to sit on different product colors or mockup backgrounds. Use a solid background only when the artwork intentionally needs one.",
      },
      {
        title: "Review size before upload",
        body: "Set the pixel size and quality ratio deliberately, then inspect the PNG for soft edges, unexpected backgrounds, or cropped artwork before using it in a Printify workflow.",
      },
    ],
  },
  "/svg-to-png-for-printful": {
    eyebrow: "Printful PNG export",
    heading: "Prepare Printful print-on-demand PNG artwork",
    intro:
      "Use this version when an SVG design needs a transparent PNG for Printful product artwork, mockups, or print preview files. Export here, then review the final pixel dimensions, transparency, and placement before using the PNG in a product workflow.",
    cards: [
      {
        title: "Product art prep",
        body: "SVG artwork can scale cleanly before export, but the final PNG is raster. Choose dimensions and quality settings that fit the product-art use case you plan to review.",
      },
      {
        title: "Transparent PNG handoff",
        body: "Transparent backgrounds are useful for apparel, sticker, and product mockup workflows. Add a solid background only when the artwork should include that rectangle.",
      },
    ],
  },
};

function SeoSections() {
  const { pathname } = useLocation();
  const platformCopy = svgToPngPlatformSeoCopyByPath[pathname];

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Browser SVG raster export
            </p>
            <h2 className="font-display text-2xl font-[800] leading-tight tracking-[-0.03em] text-sky-950 md:text-3xl">
              Export SVG to PNG with transparency and exact size
            </h2>

            <p className="mt-3 text-[15px] leading-6 text-slate-700">
              Use this <strong>SVG to PNG converter</strong> to export icons,
              logos, and vector art to a PNG image without uploading anything.
              Conversion happens <strong>fully in your browser</strong> by
              rendering the SVG onto an HTML canvas and exporting it as PNG.
            </p>
            <p className="mt-2 text-[15px] leading-6 text-slate-700">
              Resize width and height, preserve transparency, add a solid
              background when needed, and increase pixel ratio for sharper
              edges. <b>No uploads</b>, no server processing.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
              <div className="text-sm font-semibold text-slate-900">
                Exact pixel size
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Export a PNG at a specific width and height, with optional
                aspect lock.
              </div>
            </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
              <div className="text-sm font-semibold text-slate-900">
                Transparency
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Keep alpha for stickers, overlays, UI icons, and assets that sit
                on different backgrounds.
              </div>
            </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
              <div className="text-sm font-semibold text-slate-900">
                Sharpness control
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Increase pixel ratio (2x, 3x) to avoid soft edges and improve
                small text clarity.
              </div>
              </div>
            </div>
          </header>
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
          {platformCopy ? (
            <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {platformCopy.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-extrabold tracking-tight text-sky-950">
                {platformCopy.heading}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {platformCopy.intro}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {platformCopy.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {card.title}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h3 className="m-0 font-bold">What the converter does</h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <p>
                SVG is a vector format, meaning it can scale cleanly to any
                size. PNG is a raster image, meaning it is a fixed grid of
                pixels. Converting SVG to PNG is a rendering step: the browser
                draws the SVG at the size you choose, then exports the result as
                a PNG file. The output quality depends mostly on two things: the
                pixel dimensions you export and the pixel ratio you render at.
              </p>
              <p>
                This tool is meant for practical exports where you need a
                reliable PNG quickly. It avoids server round trips and keeps
                files on-device, which is useful for sensitive assets, internal
                logos, and fast iteration. It is also ideal when you need to
                produce multiple sizes from the same SVG, because you can change
                width/height and export again immediately.
              </p>
            </div>
          </section>

          <section className="mt-8 not-prose">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Quick presets (common workflows)
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Icons for UI
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Use transparency, export at the target pixel size, and set
                    pixel ratio to <strong>2x</strong> for crisp edges.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Logos for docs/email
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Add a solid background if the destination isn't guaranteed
                    to support transparency, then export slightly larger to
                    avoid softness.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Stickers and overlays
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Keep transparency, export larger than final display, and
                    downscale in your app for cleaner results.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Fast thumbnails
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Reduce output dimensions first. Smaller pixel size is the
                    most effective way to reduce PNG file size.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="not-prose mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3
              itemProp="name"
              className="m-0 text-xl font-extrabold tracking-tight text-sky-950 sm:text-2xl"
            >
              How to Convert SVG to PNG
            </h3>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              <li
                itemProp="step"
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-800">
                  1
                </span>
                <span>Upload (or paste) an SVG file.</span>
              </li>
              <li
                itemProp="step"
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-800">
                  2
                </span>
                <span>
                  Set output width and height (enable Lock aspect ratio if
                  needed).
                </span>
              </li>
              <li
                itemProp="step"
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-800">
                  3
                </span>
                <span>
                  Choose Transparent background or a Solid background color.
                </span>
              </li>
              <li
                itemProp="step"
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-extrabold text-sky-800">
                  4
                </span>
                <span>Click Convert to PNG, then Download PNG.</span>
              </li>
            </ol>
          </section>

          <section className="not-prose mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="m-0 text-lg font-extrabold tracking-tight text-sky-950">
                Common Uses
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>
                    Export an SVG logo to PNG for social media or email
                    signatures
                  </span>
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>Create PNG icons from SVGs for apps or favicons</span>
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>Generate transparent PNG stickers from vector art</span>
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>Resize SVG artwork to a specific pixel size</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="m-0 text-lg font-extrabold tracking-tight text-sky-950">
                Tips for Best Quality
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>
                    If the output looks soft, raise{" "}
                    <strong>Quality (pixel ratio)</strong> or export larger
                    dimensions.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>
                    For crisp edges on icons, keep{" "}
                    <strong>Anti-aliasing</strong> enabled (or disable it for
                    pixel-art-like sharp edges).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                  />
                  <span>
                    If your SVG uses external fonts/images, embed them to
                    improve compatibility.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <CurrentRouteGuide />

          <section>
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
                  Why won't some SVGs convert?
                </summary>
                <p className="mt-2 text-slate-700">
                  Some SVGs depend on external fonts/images or unsupported
                  features that can't be rendered to canvas. Embed assets
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
