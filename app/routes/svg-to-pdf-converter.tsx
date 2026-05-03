import * as React from "react";
import type { Route } from "./+types/svg-to-pdf-converter";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { jsPDF } from "jspdf";
import { Canvg } from "canvg";
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
  const title = "SVG to PDF Converter - Save SVG as PDF Online | iLoveSVG";
  const description =
    "Convert SVG to PDF in your browser with paper size, orientation, margin, DPI, preview, and download controls for print, documents, and design handoff.";
  const canonical = "https://www.ilovesvg.com/svg-to-pdf-converter";

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
type PaperSize = "A4" | "Letter" | "Legal" | "A3" | "A5" | "Tabloid";
type Orientation = "portrait" | "landscape";
type FitMode = "contain" | "cover" | "actual";
type Unit = "pt" | "mm" | "in";

type Settings = {
  paper: PaperSize;
  orientation: Orientation;
  unit: Unit;

  margin: number; // in chosen unit
  dpi: number; // rasterization DPI
  background: "transparent" | "white";
  fit: FitMode;

  jpegQuality: number; // 0.1..1
  imageFormat: "png" | "jpeg";

  sanitize: boolean;
  stripScripts: boolean;
  stripForeignObject: boolean;
  stripEventHandlers: boolean;
  stripJavascriptHrefs: boolean;

  fileName: string;

  showPdfPreview: boolean;
};

type SvgInfo = {
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  approxW?: number; // px
  approxH?: number; // px
  bytes?: number;

  hasScripts?: boolean;
  hasForeignObject?: boolean;
};

const DEFAULTS: Settings = {
  paper: "A4",
  orientation: "portrait",
  unit: "mm",

  margin: 10,
  dpi: 300,
  background: "transparent",
  fit: "contain",

  jpegQuality: 0.92,
  imageFormat: "png",

  sanitize: true,
  stripScripts: true,
  stripForeignObject: false,
  stripEventHandlers: true,
  stripJavascriptHrefs: true,

  fileName: "converted",

  showPdfPreview: true,
};

/* ========================
   Page
======================== */
export default function SvgToPdf(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [pdfBytes, setPdfBytes] = React.useState<Uint8Array | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [previewUrl, pdfUrl]);

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
    setPdfBytes(null);
    setPdfUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    if (
      !(f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
    ) {
      setErr("Please choose an SVG file.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(f);

    const text = await f.text();
    const coerced = ensureSvgHasXmlns(text);
    setSvgText(coerced);

    const parsed = parseSvgInfo(coerced);
    setInfo(parsed);

    const baseName = stripExt(f.name) || "converted";
    setSettings((s) => ({
      ...s,
      fileName: baseName,
    }));

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml" }),
    );
    setPreviewUrl(url);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setFile(null);
    setSvgText("");
    setInfo(null);
    setPreviewUrl(null);
    setPdfBytes(null);
    setPdfUrl(null);
    setErr(null);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <rect x="0" y="0" width="600" height="400" fill="#ffffff"/>
  <circle cx="300" cy="200" r="140" fill="#0b2dff" opacity="0.12"/>
  <circle cx="300" cy="200" r="110" fill="#0b2dff" opacity="0.20"/>
  <circle cx="300" cy="200" r="80" fill="#0b2dff" opacity="0.35"/>
  <text x="300" y="212" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="42" text-anchor="middle" fill="#0b2dff">SVG → PDF</text>
  <text x="300" y="252" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="16" text-anchor="middle" fill="#334155">Client-side conversion</text>
</svg>`;
    setFile(null);
    setErr(null);
    setSvgText(example);
    setInfo(parseSvgInfo(example));
    setPdfBytes(null);
    setPdfUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml" }),
      );
    });

    showToast("Example loaded");
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG to PDF", href: "/svg-to-pdf-converter" },
  ];

  async function convertNow() {
    setErr(null);
    setIsWorking(true);
    try {
      if (!svgText.trim()) throw new Error("Upload or paste an SVG first.");

      const cleaned = postprocessSvg(svgText, settings);

      const { bytes } = await renderSvgToPdf(cleaned, settings);
      setPdfBytes(bytes);

      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        const blob = new Blob([new Uint8Array(bytes)], {
          type: "application/pdf",
        });
        return URL.createObjectURL(blob);
      });

      showToast("PDF ready");
    } catch (e: any) {
      setErr(e?.message || "Conversion failed.");
      setPdfBytes(null);
      setPdfUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    } finally {
      setIsWorking(false);
    }
  }

  function downloadPdf() {
    if (!pdfBytes) return;
    const name = (settings.fileName || "converted").trim() || "converted";
    const filename = `${safeFileName(name)}.pdf`;
    downloadBytes(pdfBytes, filename, "application/pdf");
    showToast("Downloaded");
  }

  const lastKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!svgText.trim()) return;

    const key = JSON.stringify({
      svg: svgText, // yes, big, but deterministic and prevents spam
      s: {
        paper: settings.paper,
        orientation: settings.orientation,
        unit: settings.unit,
        margin: settings.margin,
        dpi: settings.dpi,
        background: settings.background,
        fit: settings.fit,
        imageFormat: settings.imageFormat,
        jpegQuality: settings.jpegQuality,
        sanitize: settings.sanitize,
        stripScripts: settings.stripScripts,
        stripForeignObject: settings.stripForeignObject,
        stripEventHandlers: settings.stripEventHandlers,
        stripJavascriptHrefs: settings.stripJavascriptHrefs,
      },
    });

    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    // no await inside effect
    void convertNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    svgText,
    settings.paper,
    settings.orientation,
    settings.unit,
    settings.margin,
    settings.dpi,
    settings.background,
    settings.fit,
    settings.imageFormat,
    settings.jpegQuality,
    settings.sanitize,
    settings.stripScripts,
    settings.stripForeignObject,
    settings.stripEventHandlers,
    settings.stripJavascriptHrefs,
  ]);
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

          <section className="lg:pt-0 lg:pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="inline-flex mb-1 text-sky-800 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                  SVG to PDF Converter
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadExample}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900"
                  >
                    <Icons name="example" size={16} className="mr-1" />
                    Load example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                  >
                    <Icons name="trash" size={16} className="mr-1" />
                    Clear
                  </button>
                </div>
              </div>

              {!file && !svgText.trim() ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
              ) : (
                <>
                  {file ? (
                    <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#f7faff] border border-[#dae6ff] text-slate-900">
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
                  ) : null}

                  {info && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected:{" "}
                      <b>
                        {info.widthRaw || "?"} {" × "}
                        {info.heightRaw || "?"}
                      </b>
                      {info.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          • viewBox {info.viewBox}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <details className="mt-3 rounded-2xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      Advanced: Edit SVG source
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-[13px] text-slate-600 mt-2">
                        Optional. Changes apply instantly.
                      </p>
                      <textarea
                        value={svgText}
                        onChange={(e) => {
                          const v = ensureSvgHasXmlns(e.target.value);
                          setSvgText(v);
                          setInfo(parseSvgInfo(v));
                        }}
                        className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {/* Preview */}
              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    SVG preview
                  </div>
                  <div className="p-3">
                    <img
                      src={previewUrl}
                      alt="SVG preview"
                      className="w-full h-auto block transparent-checkerboard"
                    />
                  </div>
                </div>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              <h2 className="m-0 font-bold mb-3 text-lg text-white">
                PDF Settings
              </h2>

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
                    <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                      <div className="grid gap-2 min-w-0">
                        <Field label="Paper">
                          <select
                            value={settings.paper}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                paper: e.target.value as PaperSize,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                          >
                            <option value="A4">A4</option>
                            <option value="Letter">Letter</option>
                            <option value="Legal">Legal</option>
                            <option value="A3">A3</option>
                            <option value="A5">A5</option>
                            <option value="Tabloid">Tabloid</option>
                          </select>
                        </Field>

                        <Field label="Orientation">
                          <select
                            value={settings.orientation}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                orientation: e.target.value as Orientation,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                          >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                          </select>
                        </Field>

                        <Field label="Units">
                          <select
                            value={settings.unit}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                unit: e.target.value as Unit,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                          >
                            <option value="mm">mm</option>
                            <option value="in">in</option>
                            <option value="pt">pt</option>
                          </select>
                        </Field>

                        <Field label="Margin">
                          <Num
                            value={settings.margin}
                            min={0}
                            max={200}
                            step={1}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, margin: v }))
                            }
                          />
                          <span className="text-[13px] text-slate-600 shrink-0">
                            {settings.unit}
                          </span>
                        </Field>

                        <Field label="Fit">
                          <select
                            value={settings.fit}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                fit: e.target.value as FitMode,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                          >
                            <option value="contain">Fit (contain)</option>
                            <option value="cover">Fill (cover)</option>
                            <option value="actual">Actual size</option>
                          </select>
                        </Field>

                        <Field label="Raster DPI">
                          <Num
                            value={settings.dpi}
                            min={72}
                            max={1200}
                            step={1}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, dpi: v }))
                            }
                          />
                          <span className="text-[12px] text-slate-500 shrink-0">
                            Higher is sharper, larger PDF
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
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                          >
                            <option value="transparent">Transparent</option>
                            <option value="white">White</option>
                          </select>
                        </Field>

                        <Field label="Image format">
                          <select
                            value={settings.imageFormat}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                imageFormat: e.target.value as any,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                          >
                            <option value="png">PNG (lossless)</option>
                            <option value="jpeg">JPEG (smaller)</option>
                          </select>
                          {settings.imageFormat === "jpeg" ? (
                            <span className="text-[12px] text-slate-500 shrink-0">
                              Quality {Math.round(settings.jpegQuality * 100)}%
                            </span>
                          ) : null}
                        </Field>

                        {settings.imageFormat === "jpeg" && (
                          <Field label="JPEG quality">
                            <input
                              type="range"
                              min={0.5}
                              max={1}
                              step={0.01}
                              value={settings.jpegQuality}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  jpegQuality: Number(e.target.value),
                                }))
                              }
                              className="w-full"
                            />
                          </Field>
                        )}

                        <Field label="Sanitize">
                          <input
                            type="checkbox"
                            checked={settings.sanitize}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                sanitize: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] shrink-0"
                          />
                          <span className="text-[13px] text-slate-700 min-w-0">
                            Strip risky SVG content
                          </span>
                        </Field>

                        {settings.sanitize && (
                          <Field label="Sanitize options">
                            <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                              <ToggleRow
                                checked={settings.stripScripts}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripScripts: v,
                                  }))
                                }
                                label="Strip <script> blocks"
                              />
                              <ToggleRow
                                checked={settings.stripForeignObject}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripForeignObject: v,
                                  }))
                                }
                                label="Strip <foreignObject>"
                              />
                              <ToggleRow
                                checked={settings.stripEventHandlers}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripEventHandlers: v,
                                  }))
                                }
                                label="Strip on* event handlers"
                              />
                              <ToggleRow
                                checked={settings.stripJavascriptHrefs}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripJavascriptHrefs: v,
                                  }))
                                }
                                label="Strip javascript: links"
                              />
                            </div>
                          </Field>
                        )}

                        <Field label="PDF preview">
                          <input
                            type="checkbox"
                            checked={settings.showPdfPreview}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                showPdfPreview: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] shrink-0"
                          />
                          <span className="text-[13px] text-slate-700 min-w-0">
                            Show inline PDF preview
                          </span>
                        </Field>

                        <Field label="Output filename">
                          <input
                            value={settings.fileName}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                fileName: e.target.value,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                            placeholder="converted"
                          />
                        </Field>
                      </div>

                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <button
                          type="button"
                          onClick={convertNow}
                          disabled={!hydrated || !svgText.trim() || isWorking}
                          className={[
                            "inline-flex items-center justify-center px-3.5 py-2 rounded-xl font-bold border transition-colors",
                            "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                            "disabled:opacity-70 disabled:cursor-not-allowed",
                          ].join(" ")}
                        >
                          <Icons name="convert" size={20} className="mr-1" />
                          {isWorking ? "Converting..." : "Convert to PDF"}
                        </button>

                        <button
                          type="button"
                          onClick={downloadPdf}
                          disabled={!hydrated || !pdfBytes || isWorking}
                          className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          <Icons name="download" size={20} className="mr-1" />
                          Download PDF
                        </button>

                        {!err && pdfBytes ? (
                          <span className="text-[13px] text-slate-600">
                            PDF size: <b>{formatBytes(pdfBytes.byteLength)}</b>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 text-[13px] text-slate-600">
                        Notes: This converter rasterizes the SVG at your chosen
                        DPI and embeds it into a PDF page.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PDF PREVIEW */}
              {settings.showPdfPreview && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    PDF preview
                  </div>
                  <div className="p-3">
                    {pdfUrl ? (
                      <iframe
                        title="PDF preview"
                        src={pdfUrl}
                        className="w-full h-[520px] rounded-xl border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="text-slate-600 text-sm">
                        Upload or paste an SVG to generate a PDF preview.
                      </div>
                    )}

                    {info && (info.hasScripts || info.hasForeignObject) ? (
                      <div className="mt-3 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        Detected potentially risky content in the SVG. Keep
                        sanitization enabled if you did not create this SVG.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
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
   SVG -> PDF core
======================== */
async function renderSvgToPdf(
  svgText: string,
  settings: Settings,
): Promise<{ bytes: Uint8Array }> {
  const svg = ensureSvgHasXmlns(svgText);

  const { pageW, pageH } = getPaperSize(
    settings.paper,
    settings.orientation,
    settings.unit,
  );
  const margin = clampNum(settings.margin, 0, 9999);
  const contentW = Math.max(1, pageW - margin * 2);
  const contentH = Math.max(1, pageH - margin * 2);

  const dims = getSvgPixelSize(svg);
  const svgWpx = Math.max(1, dims.w);
  const svgHpx = Math.max(1, dims.h);

  const targetDpi = clampNum(settings.dpi, 72, 1200);
  const pxPerIn = targetDpi;
  const pxPerUnit = unitToIn(settings.unit) * pxPerIn;

  const contentWpx = contentW * pxPerUnit;
  const contentHpx = contentH * pxPerUnit;

  let drawWpx = svgWpx;
  let drawHpx = svgHpx;

  if (settings.fit === "contain") {
    const s = Math.min(contentWpx / svgWpx, contentHpx / svgHpx);
    drawWpx = Math.max(1, Math.floor(svgWpx * s));
    drawHpx = Math.max(1, Math.floor(svgHpx * s));
  } else if (settings.fit === "cover") {
    const s = Math.max(contentWpx / svgWpx, contentHpx / svgHpx);
    drawWpx = Math.max(1, Math.floor(svgWpx * s));
    drawHpx = Math.max(1, Math.floor(svgHpx * s));
  } else {
    // actual size, still cap to something reasonable
    const cap = 20000;
    const s = Math.min(1, Math.min(cap / svgWpx, cap / svgHpx));
    drawWpx = Math.max(1, Math.floor(svgWpx * s));
    drawHpx = Math.max(1, Math.floor(svgHpx * s));
  }

  const canvas = document.createElement("canvas");
  const MAX_CANVAS_PIXELS = 80_000_000; // same cap you used elsewhere

  // inside renderSvgToPdf, after drawWpx/drawHpx computed:
  const safeDrawW = clampNum(drawWpx, 1, 100000);
  const safeDrawH = clampNum(drawHpx, 1, 100000);

  if (safeDrawW * safeDrawH > MAX_CANVAS_PIXELS) {
    throw new Error(
      "Output is too large. Lower DPI, margin, or use Fit (contain).",
    );
  }

  canvas.width = safeDrawW;
  canvas.height = safeDrawH;

  const ctx = canvas.getContext("2d", {
    alpha: settings.background === "transparent",
  });
  if (!ctx) throw new Error("Canvas not available.");

  if (settings.background === "white") {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  const v = await Canvg.fromString(ctx as any, svg as any, {
    ignoreAnimation: true,
    ignoreMouse: true,
    // IMPORTANT: define viewport so the SVG scales exactly to canvas
    // (Canvg reads canvas size, but explicit viewport avoids edge cases)
    // @ts-ignore
    viewport: { width: canvas.width, height: canvas.height },
  });

  await v.render();

  const imgFormat =
    settings.imageFormat === "jpeg" ? "image/jpeg" : "image/png";
  const dataUrl =
    settings.imageFormat === "jpeg"
      ? canvas.toDataURL(imgFormat, clampNum(settings.jpegQuality, 0.5, 1))
      : canvas.toDataURL(imgFormat);

  const doc = new jsPDF({
    orientation: settings.orientation,
    unit: settings.unit,
    format: normalizePaperFormat(settings.paper, settings.unit),
    compress: true,
  });

  const imgWUnits = drawWpx / pxPerUnit;
  const imgHUnits = drawHpx / pxPerUnit;

  const x = margin + (contentW - imgWUnits) / 2;
  const y = margin + (contentH - imgHUnits) / 2;

  const safeX = Number.isFinite(x) ? x : margin;
  const safeY = Number.isFinite(y) ? y : margin;

  const addType = settings.imageFormat === "jpeg" ? "JPEG" : "PNG";
  doc.addImage(
    dataUrl,
    addType as any,
    safeX,
    safeY,
    imgWUnits,
    imgHUnits,
    undefined,
    "FAST",
  );

  const bytes = doc.output("arraybuffer");
  return { bytes: new Uint8Array(bytes) };
}

function normalizePaperFormat(paper: PaperSize, unit: Unit) {
  if (paper === "Letter") return "letter";
  if (paper === "Legal") return "legal";

  if (paper === "Tabloid") {
    // 11x17 in
    if (unit === "in") return [11, 17] as any;
    if (unit === "mm") return [279.4, 431.8] as any;
    return [792, 1224] as any; // pt
  }

  // jsPDF supports "a3/a4/a5" directly
  return paper.toLowerCase() as any;
}

function getPaperSize(paper: PaperSize, orientation: Orientation, unit: Unit) {
  const mm = (w: number, h: number) => ({ w, h, unit: "mm" as const });

  let base = mm(210, 297); // A4
  if (paper === "Letter") base = mm(215.9, 279.4);
  if (paper === "Legal") base = mm(215.9, 355.6);
  if (paper === "A3") base = mm(297, 420);
  if (paper === "A5") base = mm(148, 210);
  if (paper === "Tabloid") base = mm(279.4, 431.8);

  let wmm = base.w;
  let hmm = base.h;
  if (orientation === "landscape") {
    const t = wmm;
    wmm = hmm;
    hmm = t;
  }

  const toUnit = (mmVal: number) => {
    if (unit === "mm") return mmVal;
    if (unit === "in") return mmVal / 25.4;
    return (mmVal / 25.4) * 72;
  };

  return { pageW: toUnit(wmm), pageH: toUnit(hmm) };
}

function unitToIn(unit: Unit) {
  if (unit === "in") return 1;
  if (unit === "mm") return 1 / 25.4;
  return 1 / 72;
}

function getSvgPixelSize(svg: string): { w: number; h: number } {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width");
  const heightRaw = matchAttr(open, "height");
  const viewBox = matchAttr(open, "viewBox");

  const vb = parseViewBox(viewBox);
  const wLen = widthRaw ? parseCssLengthToPx(widthRaw) : null;
  const hLen = heightRaw ? parseCssLengthToPx(heightRaw) : null;

  if (wLen && hLen && wLen > 0 && hLen > 0) return { w: wLen, h: hLen };

  if (vb && vb.w > 0 && vb.h > 0) {
    // If only one dimension is present, preserve aspect
    if (wLen && wLen > 0)
      return { w: wLen, h: Math.max(1, Math.round(wLen * (vb.h / vb.w))) };
    if (hLen && hLen > 0)
      return { w: Math.max(1, Math.round(hLen * (vb.w / vb.h))), h: hLen };
    return { w: Math.round(vb.w), h: Math.round(vb.h) };
  }

  // fallback
  return { w: 1024, h: 1024 };
}

/* ========================
   Postprocess SVG
======================== */
function postprocessSvg(svgText: string, settings: Settings) {
  let svg = String(svgText || "");

  svg = svg.replace(/\r\n?/g, "\n").trim();

  if (settings.sanitize) {
    if (settings.stripScripts) {
      svg = svg
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
        .replace(/<script\b[^>]*\/\s*>/gi, "");
    }
    if (settings.stripForeignObject) {
      svg = svg
        .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, "")
        .replace(/<foreignObject\b[^>]*\/\s*>/gi, "");
    }
    if (settings.stripEventHandlers) {
      svg = svg.replace(
        /\s(on[a-zA-Z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g,
        "",
      );
    }
    if (settings.stripJavascriptHrefs) {
      svg = svg.replace(
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
    }
  }

  svg = ensureSvgHasXmlns(svg);

  if (!/<svg\b/i.test(svg))
    throw new Error("Input does not contain an <svg> root tag.");

  return svg;
}

/* ========================
   SVG parsing helpers
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const bytes = new Blob([svg]).size;
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";

  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const dims = getSvgPixelSize(svg);

  const hasScripts = /<script\b/i.test(svg) || /\son[a-z]+\s*=\s*/i.test(svg);
  const hasForeignObject = /<foreignObject\b/i.test(svg);

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    approxW: dims.w,
    approxH: dims.h,
    hasScripts,
    hasForeignObject,
  };
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
  const [minX, minY, w, h] = parts;
  if (w === 0 || h === 0) return null;
  return { minX, minY, w, h };
}

function parseCssLengthToPx(raw: string): number | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(-?\d+(\.\d+)?)([a-z%]*)$/i);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;

  const unit = (m[3] || "px").toLowerCase();
  const v = Math.abs(n);

  // SVG/CSS: treat unitless as px-ish
  if (!unit || unit === "px") return v;

  // Convert some common absolute units to px assuming 96 dpi
  if (unit === "in") return v * 96;
  if (unit === "cm") return (v * 96) / 2.54;
  if (unit === "mm") return (v * 96) / 25.4;
  if (unit === "pt") return (v * 96) / 72;
  if (unit === "pc") return (v * 96) / 6;

  // Relative units are ambiguous without context, approximate using 16px base
  if (unit === "em" || unit === "rem") return v * 16;

  // Percent depends on viewport, ignore
  if (unit === "%") return null;

  return null;
}

/* ========================
   Attribute helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

/* ========================
   Download helpers
======================== */
function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes as any], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function clampNum(v: number, lo: number, hi: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
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
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-xl px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 min-w-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#0b2dff] shrink-0"
      />
      <span className="text-[13px] text-slate-700 min-w-0">{label}</span>
    </label>
  );
}

function Num({
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
        name: "SVG to PDF",
        item: `${baseUrl}/svg-to-pdf-converter`,
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
        name: "How do I convert SVG to PDF?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Upload an SVG file or paste SVG code, choose paper size and DPI, then download the generated PDF. Everything runs in your browser.",
        },
      },
      {
        "@type": "Question",
        name: "Does this SVG to PDF tool upload my file?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The conversion runs entirely client-side in your browser. Nothing is uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "Why does my PDF look blurry?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Increase the DPI setting to rasterize the SVG at a higher resolution. Higher DPI makes a sharper PDF but increases file size.",
        },
      },
      {
        "@type": "Question",
        name: "Can SVG contain unsafe content?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. SVG can include scripts and event handlers. Keep sanitization enabled if you did not create the SVG yourself.",
        },
      },
      {
        "@type": "Question",
        name: "Can I keep transparency?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Set Background to Transparent. If you need a white page background, choose White.",
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
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG to PDF Converter (Free, Client-Side)
          </h2>

          <p className="mt-3">
            Convert <strong>SVG to PDF</strong> instantly in your browser and
            download a print-ready file with predictable sizing. This converter
            is designed for real output control: choose paper size, orientation,
            margins, DPI, background, and fit mode, then export a PDF that
            prints the way you expect. Everything runs on-device with{" "}
            <strong>no uploads</strong>, so your SVG stays on your computer.
          </p>
          <p className="mt-2 text-slate-600">
            Convert an SVG into a downloadable PDF. Upload or paste SVG source
            and choose paper size, DPI, margins, and fit. Runs fully
            client-side.
          </p>
          <div className="mt-6 not-prose grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Page layout
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Paper size, orientation, and margins so the PDF matches your
                target print format.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Fit mode
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Contain, cover, or actual-size output depending on whether you
                want zero cropping, full bleed, or true scale.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">DPI</div>
              <div className="mt-1 text-sm text-slate-700">
                Control sharpness and file size by choosing an appropriate
                render resolution.
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
                An SVG is a scalable vector format. A PDF is a page-based
                document format meant for printing and sharing. Converting SVG
                to PDF is about mapping your artwork to a page rectangle with
                the right scale, margins, and background. If you have ever
                exported a PDF that looked cropped, tiny, blurry, or oddly
                positioned, the cause is almost always a mismatch between page
                size, fit rules, and render DPI.
              </p>
              <p>
                This tool gives you those controls explicitly. You choose the
                paper size and orientation first (the physical page). Then you
                pick margins (safe area). Then you choose how the artwork is
                placed into that printable region: contain to guarantee nothing
                is cut off, cover to fill the page area (with possible
                cropping), or actual to keep a true scale relationship when you
                want measurements to stay consistent. DPI controls how sharp the
                output is when rasterization is involved and is the main lever
                for balancing clarity against file size.
              </p>
              <p>
                Because this runs client-side, you can test different settings
                quickly, preview the result, and export again without uploading
                files to a server or waiting on round trips. That is especially
                useful when you are dialing in print output for logos,
                illustrations, diagrams, stickers, or presentation handoffs.
              </p>
            </div>
          </section>

          <section className="mt-8 not-prose">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Practical presets
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Print-ready (safe)
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    <strong>300 DPI</strong>, <strong>Contain</strong>, modest
                    margins, and a <strong>white</strong> background for classic
                    paper output with no cropping surprises.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Fast sharing (small file)
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    <strong>150 DPI</strong>, <strong>Contain</strong>, and a
                    simple background. Reduce page size or margins before
                    pushing quality too low.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Full-bleed look
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    <strong>Cover</strong> with minimal margins. Expect edge
                    cropping if your SVG does not match the page aspect ratio.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Transparent background
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Choose <strong>Transparent</strong> when you want the SVG’s
                    alpha preserved. Choose <strong>White</strong> when you want
                    a paper-like page background.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="m-0 font-bold">
              How the key settings affect output
            </h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">
                  Paper size, orientation, margins
                </h4>
                <p className="mt-1">
                  Paper size and orientation define the page box. Margins shrink
                  the usable area so content does not sit against the edge. If
                  you are printing, margins also reduce the risk of printer
                  clipping. If you are exporting for digital use (emailing a
                  proof, attaching to a ticket), you can often reduce margins to
                  make the artwork fill more of the page.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">Fit modes</h4>
                <p className="mt-1">
                  <strong>Contain</strong> scales the SVG so the entire artwork
                  fits inside the printable area with no cropping.{" "}
                  <strong>Cover</strong> fills the printable area completely,
                  which can crop edges when aspect ratios differ.{" "}
                  <strong>Actual</strong> aims to keep scale consistent rather
                  than maximizing fill, which is useful when you care about
                  true-size output relative to the chosen DPI and page.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">DPI (sharpness vs file size)</h4>
                <p className="mt-1">
                  Higher DPI increases the render resolution and typically
                  increases PDF size. For most print workflows,{" "}
                  <strong>300 DPI</strong> is the baseline. If you have very
                  small text or fine strokes, <strong>600 DPI</strong> can help,
                  but it will usually increase file size significantly. If you
                  are just sharing a preview or a quick proof,{" "}
                  <strong>150 DPI</strong> often looks fine and exports faster
                  with smaller files.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">Background choice</h4>
                <p className="mt-1">
                  If your SVG has transparency, a PDF can either preserve it or
                  flatten it onto a solid page background. Choose{" "}
                  <strong>Transparent</strong> when the output will be layered
                  elsewhere, and choose <strong>White</strong> when you want a
                  paper-like result that prints consistently.
                </p>
              </div>
            </div>
          </section>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Convert SVG to PDF
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload an SVG (or paste SVG code).</li>
              <li itemProp="step">Pick paper size and orientation.</li>
              <li itemProp="step">
                Set margins and fit (contain, cover, or actual).
              </li>
              <li itemProp="step">
                Choose DPI for sharpness and file size balance.
              </li>
              <li itemProp="step">Convert, preview, then download the PDF.</li>
            </ol>
          </section>

          <section>
            <h3 className="m-0 font-bold">Best Settings</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                <strong>300 DPI</strong> for print-quality logos and
                illustrations.
              </li>
              <li>
                <strong>150 DPI</strong> for smaller files and quick sharing.
              </li>
              <li>
                <strong>Contain</strong> to ensure nothing is cropped.
              </li>
              <li>
                <strong>Cover</strong> to fill the page (may crop edges).
              </li>
              <li>
                <strong>Transparent</strong> background if your SVG has alpha;
                use <strong>White</strong> for classic paper.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="m-0 font-bold">Troubleshooting</h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">PDF looks blurry</h4>
                <p className="mt-1">
                  Increase DPI. If text is small, 300 to 600 DPI usually helps.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">PDF is huge</h4>
                <p className="mt-1">
                  Lower DPI, switch to JPEG, or use contain so the raster isn’t
                  oversized.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">Some SVGs won’t render</h4>
                <p className="mt-1">
                  SVGs with external fonts, images, or advanced filters can
                  fail. Embed assets inside the SVG or simplify filters.
                </p>
              </div>
            </div>
          </section>

          <CurrentRouteGuide />

          <section>
            <h3 className="m-0 font-bold">FAQ</h3>

            <div className="not-prose mt-3 grid gap-3">
              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Does this SVG to PDF tool upload my file?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  No. Everything runs client-side in your browser. Your SVG
                  never leaves your device.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>What DPI should I use?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Use 300 DPI for print, 150 DPI for smaller files. Higher DPI
                  increases sharpness and PDF size.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Can I keep transparency?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Yes. Set Background to Transparent. If you want a white page
                  background, choose White.
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
                  Some SVGs reference external assets or use unsupported
                  features. Embed fonts/images or simplify filters for best
                  compatibility.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Is sanitizing the SVG necessary?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Keep it on for files you didn’t create. It strips scripts,
                  event handlers, and javascript: links before rendering.
                </div>
              </details>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
