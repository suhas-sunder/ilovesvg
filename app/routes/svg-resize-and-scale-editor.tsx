import * as React from "react";
import type { Route } from "./+types/svg-resize-and-scale-editor";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
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
  const title = "iLoveSVG | SVG Resize & Scale Tool (Width, Height, viewBox)";
  const description =
    "Resize and scale SVG files instantly with iLoveSVG. Change width and height, preserve aspect ratio, scale by percentage, update the viewBox, and download the resized SVG. Free, fully client-side, no uploads.";
  const canonical = "https://www.ilovesvg.com/svg-resize-and-scale-editor";

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
type Units = "px" | "em" | "rem" | "pt" | "pc" | "cm" | "mm" | "in" | "%";

type Settings = {
  width: number;
  height: number;
  unit: Units;

  lockAspect: boolean;

  // scale input (percentage)
  scalePct: number;

  // how to scale viewBox
  viewBoxMode: "keep" | "match-output" | "scale-vb";

  // remove hard-coded width/height instead (responsive)
  makeResponsive: boolean; // removes width/height, keeps viewBox
  setPreserveAspectRatio: "none" | "xMidYMid meet" | "xMidYMid slice";
  stripSizeStyle: boolean; // remove width/height from style=""
  stripXmlDecl: boolean; // remove <?xml ...?>
  stripDoctype: boolean; // remove <!DOCTYPE ...>
  optimizeWhitespace: boolean;

  fileName: string;
};

type SvgInfo = {
  width?: number;
  height?: number;
  widthRaw?: string;
  heightRaw?: string;
  unit?: Units | null;
  viewBox?: string;
  vb?: { minX: number; minY: number; w: number; h: number } | null;
  aspect?: number | null;
};

const DEFAULTS: Settings = {
  width: 1024,
  height: 1024,
  unit: "px",
  lockAspect: true,
  scalePct: 100,

  viewBoxMode: "keep",
  makeResponsive: false,
  setPreserveAspectRatio: "xMidYMid meet",
  stripSizeStyle: true,
  stripXmlDecl: false,
  stripDoctype: false,
  optimizeWhitespace: false,

  fileName: "resized",
};

/* ========================
   Page
======================== */
export default function SvgResizeScale(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  // Input preview
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Output
  const [outSvg, setOutSvg] = React.useState<string>("");
  const [outPreviewUrl, setOutPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (outPreviewUrl) URL.revokeObjectURL(outPreviewUrl);
    };
  }, [previewUrl, outPreviewUrl]);

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

  function setPreviewFromSvg(nextSvg: string) {
    const svg = ensureSvgHasXmlns(nextSvg);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    });
  }

  function clearOutput() {
    setOutSvg("");
    setOutPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
  }

  async function handleNewFile(f: File) {
    setErr(null);
    clearOutput();

    if (
      !(f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
    ) {
      setErr("Please choose an SVG file.");
      return;
    }

    setFile(f);

    const text = await f.text();
    const coerced = ensureSvgHasXmlns(text);
    setSvgText(coerced);

    const parsed = parseSvgInfo(coerced);
    setInfo(parsed);

    // Defaults from SVG
    const baseName = stripExt(f.name) || "resized";
    const derivedUnit = (parsed.unit || "px") as Units;

    const baseW = parsed.width ?? parsed.vb?.w ?? 1024;
    const baseH = parsed.height ?? parsed.vb?.h ?? 1024;

    setSettings((s) => ({
      ...s,
      fileName: baseName,
      unit: derivedUnit,
      width: clampInt(Math.round(baseW), 1, 100000),
      height: clampInt(Math.round(baseH), 1, 100000),
      lockAspect: true,
      scalePct: 100,
      setPreserveAspectRatio: "xMidYMid meet",
    }));

    setPreviewFromSvg(coerced);

    // Initial output
    tryConvert(coerced, parsed);
  }

  function clearAll() {
    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setOutPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    setFile(null);
    setSvgText("");
    setInfo(null);
    setOutSvg("");
    setErr(null);
  }

  function tryConvert(currentSvgText = svgText, currentInfo = info) {
    setErr(null);
    try {
      const { svg } = resizeSvg(currentSvgText, currentInfo, settings);
      setOutSvg(svg);

      setOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      });
    } catch (e: any) {
      setErr(e?.message || "Resize failed.");
    }
  }

  // Convert whenever settings or svgText changes
  React.useEffect(() => {
    if (!svgText) return;
    tryConvert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, svgText]);

  function onWidthChange(v: number) {
    setSettings((s) => {
      const width = clampInt(v, 1, 100000);
      if (!s.lockAspect) return { ...s, width };
      const aspect = info?.aspect || deriveAspect(info) || 1;
      const height = clampInt(Math.round(width / aspect), 1, 100000);
      return { ...s, width, height };
    });
  }

  function onHeightChange(v: number) {
    setSettings((s) => {
      const height = clampInt(v, 1, 100000);
      if (!s.lockAspect) return { ...s, height };
      const aspect = info?.aspect || deriveAspect(info) || 1;
      const width = clampInt(Math.round(height * aspect), 1, 100000);
      return { ...s, width, height };
    });
  }

  function applyScalePct(pct: number) {
    setSettings((s) => {
      const scale = Math.max(1, Math.min(1000, Math.round(pct)));
      const baseW = info?.width ?? info?.vb?.w ?? s.width;
      const baseH = info?.height ?? info?.vb?.h ?? s.height;

      const w = clampInt(Math.round((baseW * scale) / 100), 1, 100000);
      const h = clampInt(Math.round((baseH * scale) / 100), 1, 100000);
      return { ...s, scalePct: scale, width: w, height: h };
    });
  }

  function downloadResized() {
    if (!outSvg) return;
    const name = (settings.fileName || "resized").trim() || "resized";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(outSvg, filename);
    showToast("Downloaded");
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Resize & Scale", href: "/svg-resize-and-scale-editor" },
  ];

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
              <h1 className="inline-flex text-sky-800 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                SVG Resize & Scale
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

                  {info && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected:{" "}
                      <b>
                        {info.width ? Math.round(info.width) : "?"}
                        {info.unit || ""}
                        {" × "}
                        {info.height ? Math.round(info.height) : "?"}
                        {info.unit || ""}
                      </b>
                      {info.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          • viewBox {info.viewBox}
                        </span>
                      ) : null}
                    </div>
                  )}
                </>
              )}

              {/* Input preview */}
              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Input SVG preview
                  </div>
                  <div className="p-3">
                    <img
                      src={previewUrl}
                      alt="Input SVG"
                      className="w-full h-auto block transparent-checkerboard"
                    />
                  </div>
                </div>
              )}

              {/* Source editor */}
              {file && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white">
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
                        const next = ensureSvgHasXmlns(e.target.value);
                        setSvgText(next);
                        const parsed = parseSvgInfo(next);
                        setInfo(parsed);
                        setPreviewFromSvg(next);
                      }}
                      className="mt-2 w-full h-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  </div>
                </details>
              )}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start">
              <h2 className="m-0 font-bold mb-3 text-lg text-white">
                Resize Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
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
                      <Field label="Units">
                        <select
                          value={settings.unit}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              unit: e.target.value as Units,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                        >
                          <option value="px">px</option>
                          <option value="em">em</option>
                          <option value="rem">rem</option>
                          <option value="pt">pt</option>
                          <option value="pc">pc</option>
                          <option value="cm">cm</option>
                          <option value="mm">mm</option>
                          <option value="in">in</option>
                          <option value="%">%</option>
                        </select>
                        <span className="text-[12px] text-slate-500 shrink-0">
                          Most web SVGs use px
                        </span>
                      </Field>

                      <Field label="Width">
                        <NumInt
                          value={settings.width}
                          min={1}
                          max={100000}
                          step={1}
                          onChange={onWidthChange}
                        />
                        <span className="text-[13px] text-slate-600 shrink-0">
                          {settings.unit}
                        </span>
                      </Field>

                      <Field label="Height">
                        <NumInt
                          value={settings.height}
                          min={1}
                          max={100000}
                          step={1}
                          onChange={onHeightChange}
                        />
                        <span className="text-[13px] text-slate-600 shrink-0">
                          {settings.unit}
                        </span>
                      </Field>

                      <Field label="Lock aspect ratio">
                        <input
                          type="checkbox"
                          checked={settings.lockAspect}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              lockAspect: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Keep proportions when changing width/height
                        </span>
                      </Field>

                      <Field label="Scale (%)">
                        <NumInt
                          value={settings.scalePct}
                          min={1}
                          max={1000}
                          step={1}
                          onChange={applyScalePct}
                        />
                        <button
                          type="button"
                          onClick={() => applyScalePct(100)}
                          className="px-2 py-1 rounded-md border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 shrink-0 cursor-pointer transition-colors"
                        >
                          Reset
                        </button>
                      </Field>

                      <Field label="viewBox handling">
                        <select
                          value={settings.viewBoxMode}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              viewBoxMode: e.target.value as any,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                        >
                          <option value="keep">Keep existing viewBox</option>
                          <option value="match-output">
                            Set viewBox to 0 0 width height
                          </option>
                          <option value="scale-vb">
                            Scale viewBox dimensions proportionally
                          </option>
                        </select>
                      </Field>

                      <Field label="Responsive SVG">
                        <input
                          type="checkbox"
                          checked={settings.makeResponsive}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              makeResponsive: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove width/height attributes (keeps viewBox)
                        </span>
                      </Field>

                      <Field label="preserveAspectRatio">
                        <select
                          value={settings.setPreserveAspectRatio}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              setPreserveAspectRatio: e.target.value as any,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                        >
                          <option value="xMidYMid meet">
                            xMidYMid meet (default)
                          </option>
                          <option value="xMidYMid slice">xMidYMid slice</option>
                          <option value="none">none</option>
                        </select>
                      </Field>

                      <Field label="Cleanup">
                        <div className="flex flex-col gap-2 min-w-0 overflow-hidden">
                          <label className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={settings.stripSizeStyle}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  stripSizeStyle: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700 min-w-0">
                              Remove width/height from style=""
                            </span>
                          </label>

                          <label className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={settings.stripXmlDecl}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  stripXmlDecl: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700 min-w-0">
                              Remove XML declaration
                            </span>
                          </label>

                          <label className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={settings.stripDoctype}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  stripDoctype: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700 min-w-0">
                              Remove DOCTYPE
                            </span>
                          </label>

                          <label className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={settings.optimizeWhitespace}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  optimizeWhitespace: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700 min-w-0">
                              Minify whitespace (light)
                            </span>
                          </label>
                        </div>
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
                          placeholder="resized"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadResized}
                    disabled={!hydrated || !outSvg}
                    className={[
                      "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="download" size={16} className="mr-1" />
                    Download Resized SVG
                  </button>

                  {err && <span className="text-red-700 text-sm">{err}</span>}

                  {!err && outSvg && (
                    <span className="text-[13px] text-slate-600">
                      Updated <b>&lt;svg&gt;</b> attributes and optionally
                      viewBox.
                    </span>
                  )}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Notes: Changing <b>width/height</b> affects display size.
                  Updating <b>viewBox</b> changes the internal coordinate
                  system. Use Match output when you want the coordinate system
                  to match your new size.
                </div>
              </div>

              {/* OUTPUT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-slate-200">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output preview
                </div>
                <div className="p-3 ">
                  {outPreviewUrl ? (
                    <img
                      src={outPreviewUrl}
                      alt="Resized SVG preview"
                      className="w-full h-auto block transparent-checkerboard"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Upload an SVG to see the resized output preview.
                    </div>
                  )}
                </div>
              </div>

              {/* OUTPUT SOURCE */}
              {outSvg && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                    Output SVG code
                  </summary>
                  <div className="px-4 pb-4">
                    <textarea
                      value={outSvg}
                      readOnly
                      className="mt-2 w-full h-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(outSvg)
                          .then(() => showToast("Copied"));
                      }}
                      className="flex items-center justify-center mt-2 px-3 py-2 rounded-lg font-medium border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                    >
                      <Icons name="copy" size={16} className="mr-1" />
                      Copy SVG
                    </button>
                  </div>
                </details>
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

      {/* IMPORTANT: removed JsonLdFaq to prevent duplicated FAQ schema */}
      <Breadcrumbs crumbs={crumbs} />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Core resize logic (string-based)
======================== */
function resizeSvg(
  svgText: string,
  info: SvgInfo | null,
  settings: Settings,
): { svg: string } {
  let svg = ensureSvgHasXmlns(svgText);

  if (settings.stripXmlDecl) svg = svg.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  if (settings.stripDoctype)
    svg = svg.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");

  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) throw new Error("Could not find <svg> tag.");
  const openTag = openMatch[0];

  const outW = clampInt(settings.width, 1, 100000);
  const outH = clampInt(settings.height, 1, 100000);
  const unit = settings.unit || "px";

  let newOpen = openTag;

  newOpen = setOrReplaceAttr(
    newOpen,
    "preserveAspectRatio",
    settings.setPreserveAspectRatio,
  );

  if (settings.makeResponsive) {
    newOpen = removeAttr(newOpen, "width");
    newOpen = removeAttr(newOpen, "height");
  } else {
    newOpen = setOrReplaceAttr(newOpen, "width", `${outW}${unit}`);
    newOpen = setOrReplaceAttr(newOpen, "height", `${outH}${unit}`);
  }

  if (settings.stripSizeStyle) {
    newOpen = newOpen.replace(/\sstyle\s*=\s*["']([^"']*)["']/i, (m, style) => {
      const cleaned = String(style)
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((decl) => !/^width\s*:/.test(decl) && !/^height\s*:/.test(decl))
        .join("; ");
      return cleaned ? ` style="${cleaned}"` : "";
    });
  }

  const vb = info?.vb || parseViewBox(matchAttr(openTag, "viewBox"));
  const mode = settings.viewBoxMode;

  if (mode === "match-output") {
    newOpen = setOrReplaceAttr(newOpen, "viewBox", `0 0 ${outW} ${outH}`);
  } else if (mode === "scale-vb") {
    const baseW = info?.width ?? vb?.w ?? outW;
    const baseH = info?.height ?? vb?.h ?? outH;

    const sx = baseW > 0 ? outW / baseW : 1;
    const sy = baseH > 0 ? outH / baseH : 1;

    const baseVB = vb || {
      minX: 0,
      minY: 0,
      w: baseW || outW,
      h: baseH || outH,
    };

    const newVBW = roundNice(baseVB.w * sx);
    const newVBH = roundNice(baseVB.h * sy);
    newOpen = setOrReplaceAttr(
      newOpen,
      "viewBox",
      `${baseVB.minX} ${baseVB.minY} ${newVBW} ${newVBH}`,
    );
  } else {
    if (settings.makeResponsive) {
      const hasVB = /viewBox\s*=\s*["'][^"']*["']/i.test(newOpen);
      if (!hasVB) {
        newOpen = setOrReplaceAttr(newOpen, "viewBox", `0 0 ${outW} ${outH}`);
      }
    }
  }

  svg = svg.replace(openTag, newOpen);

  if (settings.optimizeWhitespace) {
    svg = svg
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return { svg };
}

function roundNice(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 1000) / 1000;
}

/* ========================
   SVG parsing helpers
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const w = widthRaw ? parseLen(widthRaw) : null;
  const h = heightRaw ? parseLen(heightRaw) : null;
  const unit = widthRaw ? parseUnit(widthRaw) : null;

  const vb = parseViewBox(viewBox);
  const aspect =
    (w && h && h > 0 ? w / h : vb && vb.h > 0 ? vb.w / vb.h : null) || null;

  return {
    width: w ?? undefined,
    height: h ?? undefined,
    widthRaw,
    heightRaw,
    unit,
    viewBox,
    vb,
    aspect,
  };
}

function deriveAspect(info: SvgInfo | null): number | null {
  if (!info) return null;
  if (info.aspect && info.aspect > 0) return info.aspect;
  if (info.width && info.height && info.height > 0)
    return info.width / info.height;
  if (info.vb && info.vb.h > 0) return info.vb.w / info.vb.h;
  return null;
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

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseLen(raw: string): number | null {
  const m = String(raw)
    .trim()
    .match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseUnit(raw: string): Units | null {
  const s = String(raw).trim();
  const m = s.match(/[a-z%]+$/i);
  const u = (m?.[0] || "px").toLowerCase();
  const allowed: Units[] = [
    "px",
    "em",
    "rem",
    "pt",
    "pc",
    "cm",
    "mm",
    "in",
    "%",
  ];
  return (allowed.includes(u as Units) ? (u as Units) : null) || null;
}

/* ========================
   Attribute editing helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function setOrReplaceAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/<svg\b/i, (m) => `${m} ${name}="${escapeAttr(value)}"`);
}

function removeAttr(tag: string, name: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "ig");
  return tag.replace(re, "");
}

function escapeAttr(v: string) {
  return String(v).replace(/"/g, "&quot;");
}

/* ========================
   Download
======================== */
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
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
      .slice(0, 80) || "resized"
  );
}

function clampInt(v: number, lo: number, hi: number) {
  const n = Math.round(Number(v));
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
        name: "SVG Resize & Scale",
        item: `${baseUrl}/svg-resize-and-scale-editor`,
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
   SEO sections
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold text-2xl">
            SVG Resize / Scale Tool (Client-Side)
          </h2>

          <p className="mt-3">
            This tool updates an SVG’s <strong>rendered size</strong> and, when
            you choose, its <strong>internal coordinate system</strong>. Use it
            to set exact <strong>width</strong>/<strong>height</strong>, scale
            by a <strong>percentage</strong>, and control{" "}
            <strong>viewBox</strong> plus <strong>preserveAspectRatio</strong>{" "}
            so the output behaves predictably across browsers, design apps, and
            responsive layouts. Processing happens{" "}
            <strong>entirely in your browser</strong>, so the SVG never needs to
            leave your device.
          </p>

          <p className="mt-2 text-slate-600">
            Resize an SVG by changing <b>width</b>/<b>height</b>, scaling by
            percentage, and optionally updating <b>viewBox</b> and{" "}
            <b>preserveAspectRatio</b>. This runs fully client-side.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3 not-prose">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">Resize</div>
              <div className="mt-1 text-sm text-slate-700">
                Set exact width/height and optionally lock the aspect ratio.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">Scale</div>
              <div className="mt-1 text-sm text-slate-700">
                Apply a percentage scale using detected size or the viewBox as
                the baseline.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Fix viewBox
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Keep it, match it to the new output, or scale the coordinate
                system on purpose.
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
            <h3 className="m-0 font-bold">What this tool actually changes</h3>
            <div className="mt-3 grid gap-3 text-slate-700">
              <p>
                SVG sizing is split into two layers: the{" "}
                <strong>viewport</strong> (rendered size) and the{" "}
                <strong>viewBox</strong> (internal coordinate space). Many
                resizing problems happen when one changes while the other stays
                the same, or when size metadata is missing.
              </p>
              <p>
                Editing <code>width</code> and <code>height</code> changes the
                viewport. Editing <code>viewBox</code> changes how internal
                units map to the viewport, which can affect scaling and fitting
                if the drawing does not match the viewBox bounds.
              </p>
              <p>
                This tool detects the best sizing reference (explicit
                width/height first, then viewBox), applies your rules, and
                outputs a clean SVG you can download.
              </p>
            </div>
          </section>

          <section className="mt-10 not-prose">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Related SVG tools
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-to-png-converter"
                >
                  SVG to PNG Converter
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-to-jpg-converter"
                >
                  SVG to JPG Converter
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-to-webp-converter"
                >
                  SVG to WebP Converter
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-recolor"
                >
                  SVG Recolor Tool
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-background-editor"
                >
                  SVG Background Editor
                </a>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mt-8 font-bold">FAQ</h3>

            <div className="not-prose mt-3 grid gap-3">
              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Does this tool upload my SVG?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  No. Everything runs locally in your browser. Your SVG is not
                  sent to a server.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>
                    What is the difference between width/height and viewBox?
                  </span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Width and height control how large the SVG displays. The
                  viewBox controls the internal coordinate system. Changing
                  viewBox can change how content scales inside the SVG.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Should I update viewBox when resizing?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  If you only want the SVG to display larger or smaller, keep
                  the viewBox. If you want the coordinate system to match the
                  new size, set viewBox to 0 0 width height (Match output).
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>How do I make an SVG responsive?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Enable Responsive SVG to remove width and height while keeping
                  a viewBox. Then the SVG scales to its container using CSS.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Can I scale an SVG by percentage?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Yes. Use Scale (%) to resize proportionally based on detected
                  width/height or viewBox.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Why does my SVG crop when I resize it?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Cropping usually means the viewBox does not match the artwork
                  bounds or the SVG is being fit using preserveAspectRatio
                  settings. Try Match output for viewBox and keep
                  preserveAspectRatio on meet.
                </div>
              </details>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
