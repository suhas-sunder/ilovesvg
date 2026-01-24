import * as React from "react";
import type { Route } from "./+types/svg-resize-and-scale-editor";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG Resize / Scale (edit width, height, viewBox, preserve aspect)";
  const description =
    "Resize and scale SVG files instantly in your browser. Change width/height, preserve aspect ratio, scale by percentage, update viewBox, and download the resized SVG. No uploads, no server.";
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

  // Preview upload only
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

  async function handleNewFile(f: File) {
    setErr(null);
    setOutSvg("");
    setOutPreviewUrl((u) => {
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

    // Defaults from SVG
    const baseName = stripExt(f.name) || "resized";
    const derivedUnit = (parsed.unit || "px") as Units;

    const baseW = parsed.width ?? parsed.vb?.w ?? 1024;
    const baseH = parsed.height ?? parsed.vb?.h ?? 1024;

    const aspect =
      (parsed.aspect && Number.isFinite(parsed.aspect) && parsed.aspect > 0
        ? parsed.aspect
        : baseW > 0 && baseH > 0
          ? baseW / baseH
          : 1) || 1;

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

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml" })
    );
    setPreviewUrl(url);

    // Also generate an initial output that matches input settings
    tryConvert(coerced, parsed);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (outPreviewUrl) URL.revokeObjectURL(outPreviewUrl);
    setFile(null);
    setSvgText("");
    setInfo(null);
    setPreviewUrl(null);
    setOutSvg("");
    setOutPreviewUrl(null);
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

  // Convert whenever settings change (this is a text edit, cheap)
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
    { name: "SVG Resize & Scale", href: "/svg-resize" },
  ];

  return (
    <>

      <main
        className="min-h-[100dvh] bg-slate-50 text-slate-900"
        onPaste={onPaste}
      >
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <Breadcrumbs crumbs={crumbs} />

          <header className="text-center mb-3">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>SVG</span>
              <span className="text-slate-400">Resize</span>
              <span className="text-slate-400">/</span>
              <span className="text-[#0b2dff]">Scale</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Resize an SVG by changing <b>width</b>/<b>height</b>, scaling by
              percentage, and optionally updating <b>viewBox</b> and{" "}
              <b>preserveAspectRatio</b>. This runs fully client-side.
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
                      className="w-full h-auto block"
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
                        setSvgText(ensureSvgHasXmlns(e.target.value));
                        setInfo(
                          parseSvgInfo(ensureSvgHasXmlns(e.target.value))
                        );
                      }}
                      className="mt-2 w-full h-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  </div>
                </details>
              )}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Resize Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Units">
                    <select
                      value={settings.unit}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          unit: e.target.value as Units,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
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
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                      className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 shrink-0"
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
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
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
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="resized"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadResized}
                    disabled={!hydrated || !outSvg}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
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
                  system. Use “Match output” when you want the coordinate system
                  to match your new size.
                </div>
              </div>

              {/* OUTPUT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output preview
                </div>
                <div className="p-3">
                  {outPreviewUrl ? (
                    <img
                      src={outPreviewUrl}
                      alt="Resized SVG preview"
                      className="w-full h-auto block"
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
                      className="mt-2 px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                    >
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
   Core resize logic (string-based)
======================== */
function resizeSvg(
  svgText: string,
  info: SvgInfo | null,
  settings: Settings
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

  // Build new <svg ...> tag by editing attributes safely
  let newOpen = openTag;

  // Always set preserveAspectRatio (useful esp. when responsive)
  newOpen = setOrReplaceAttr(
    newOpen,
    "preserveAspectRatio",
    settings.setPreserveAspectRatio
  );

  // width/height or responsive mode
  if (settings.makeResponsive) {
    newOpen = removeAttr(newOpen, "width");
    newOpen = removeAttr(newOpen, "height");
  } else {
    newOpen = setOrReplaceAttr(newOpen, "width", `${outW}${unit}`);
    newOpen = setOrReplaceAttr(newOpen, "height", `${outH}${unit}`);
  }

  // Optional: remove width/height from style="" to avoid conflicts
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

  // viewBox handling
  const vb = info?.vb || parseViewBox(matchAttr(openTag, "viewBox"));
  const mode = settings.viewBoxMode;

  if (mode === "match-output") {
    newOpen = setOrReplaceAttr(newOpen, "viewBox", `0 0 ${outW} ${outH}`);
  } else if (mode === "scale-vb") {
    // If there is a viewBox, scale its w/h proportionally to output change.
    // If no viewBox, create one from detected size.
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
      `${baseVB.minX} ${baseVB.minY} ${newVBW} ${newVBH}`
    );
  } else {
    // keep as-is
    if (settings.makeResponsive) {
      // If responsive but missing viewBox, create one
      const hasVB = /viewBox\s*=\s*["'][^"']*["']/i.test(newOpen);
      if (!hasVB) {
        newOpen = setOrReplaceAttr(newOpen, "viewBox", `0 0 ${outW} ${outH}`);
      }
    }
  }

  // Replace the open tag
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
   FAQ JSON-LD
======================== */
function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does this SVG resize tool upload my file?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The SVG is edited directly in your browser. Nothing is uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between width/height and viewBox?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Width/height controls the display size of the SVG. The viewBox defines the internal coordinate system. Changing viewBox can change how content scales inside the SVG.",
        },
      },
      {
        "@type": "Question",
        name: "How do I make an SVG responsive?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Enable Responsive SVG to remove width/height attributes and keep a viewBox. The SVG will scale to its container in HTML/CSS.",
        },
      },
      {
        "@type": "Question",
        name: "Should I update the viewBox when resizing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If you only want a different display size, you can keep the existing viewBox. If you want the coordinate system to match the new size, set viewBox to 0 0 width height.",
        },
      },
      {
        "@type": "Question",
        name: "Can I scale an SVG by percentage?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Use the Scale (%) control to resize based on the original SVG dimensions or viewBox size.",
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
   SEO sections (expanded for SEO + Adsense)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG Resize / Scale Tool (Client-Side)
          </h2>

          <p className="mt-3">
            Use this tool to <strong>resize an SVG</strong> by editing{" "}
            <strong>width</strong> and <strong>height</strong>, or{" "}
            <strong>scale an SVG</strong> using a percentage. You can also
            control the <strong>viewBox</strong> and{" "}
            <strong>preserveAspectRatio</strong> so the SVG behaves correctly in
            browsers, design tools, and responsive layouts. Everything runs
            locally in your browser, so your SVG file stays on your device.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3 not-prose">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">Resize</div>
              <div className="mt-1 text-sm text-slate-700">
                Set exact width/height with optional aspect lock.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">Scale</div>
              <div className="mt-1 text-sm text-slate-700">
                Scale by percentage based on detected size or viewBox.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">
                Fix viewBox
              </div>
              <div className="mt-1 text-sm text-slate-700">
                Keep, match output, or scale the coordinate system.
              </div>
            </div>
          </div>

          {/* HowTo */}
          <section
            className="mt-10"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Resize an SVG
            </h3>
            <p className="mt-2" itemProp="description">
              Follow these steps to resize an SVG for web, apps, UI icons,
              presentations, or design exports.
            </p>

            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload or paste an SVG file.</li>
              <li itemProp="step">
                Set <strong>width</strong> and <strong>height</strong>, and
                enable <strong>Lock aspect ratio</strong> if needed.
              </li>
              <li itemProp="step">
                Choose <strong>viewBox handling</strong> based on your goal.
              </li>
              <li itemProp="step">
                (Optional) Enable <strong>Responsive SVG</strong> to remove
                width/height.
              </li>
              <li itemProp="step">Download the resized SVG.</li>
            </ol>
          </section>

          {/* Core concepts */}
          <section className="mt-10">
            <h3 className="m-0 font-bold">Resize vs Scale vs viewBox</h3>

            <div className="mt-3 grid gap-5 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">1) Changing width and height</h4>
                <p className="mt-1">
                  Updating <code>width</code> and <code>height</code> changes
                  the
                  <strong> display size</strong>. This is the safest option for
                  icons, UI graphics, and most web SVG usage.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">2) Scaling by percentage</h4>
                <p className="mt-1">
                  Scaling applies a proportional resize based on the original
                  dimensions (or viewBox when width/height are missing). It is
                  useful when you want quick consistent sizing like 50%, 200%,
                  or 300%.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">3) viewBox handling</h4>
                <p className="mt-1">
                  The <code>viewBox</code> defines the internal coordinate
                  system. Keeping it unchanged preserves the original drawing
                  space. Matching the viewBox to the output is helpful for
                  editing downstream in design tools, or when you want 1 unit to
                  equal 1 pixel in the new size.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">4) preserveAspectRatio</h4>
                <p className="mt-1">
                  <code>preserveAspectRatio</code> controls how the SVG fits its
                  viewport.
                  <code>xMidYMid meet</code> is the common default,{" "}
                  <code>slice</code>
                  crops to fill, and <code>none</code> allows stretching.
                </p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="mt-10">
            <h3 className="m-0 font-bold">
              Common Resize Problems (and Fixes)
            </h3>

            <div className="mt-3 grid gap-4 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">My SVG looks stretched</h4>
                <p className="mt-1">
                  Turn on <strong>Lock aspect ratio</strong>, and keep{" "}
                  <code>preserveAspectRatio</code> set to{" "}
                  <code>xMidYMid meet</code>.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">
                  Nothing changes when I edit width/height
                </h4>
                <p className="mt-1">
                  Some SVGs are styled by CSS or embedded in a layout that
                  overrides size. Try enabling <strong>Responsive SVG</strong>{" "}
                  and control size via CSS in your app or page.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">
                  The SVG crops or has extra whitespace
                </h4>
                <p className="mt-1">
                  If the artwork is not aligned with the viewBox, use{" "}
                  <strong>Match output</strong> for viewBox or keep the existing
                  viewBox if you only want display-size changes.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">The file has no width/height</h4>
                <p className="mt-1">
                  Many responsive SVGs rely on viewBox only. This tool detects
                  the viewBox and uses it as a sizing reference for scaling and
                  output preview.
                </p>
              </div>

              <div>
                <h4 className="m-0 font-bold">
                  Design tools show a different size than the browser
                </h4>
                <p className="mt-1">
                  Some tools interpret missing units differently. If you need
                  predictability, use <strong>px</strong> units and set both
                  width and height explicitly.
                </p>
              </div>
            </div>
          </section>

          {/* Quick reference table */}
          <section className="mt-10">
            <h3 className="m-0 font-bold">Quick Reference</h3>
            <p className="mt-2 text-slate-700">
              Use this chart to pick the right setting fast.
            </p>

            <div className="mt-3 overflow-x-auto not-prose">
              <table className="min-w-[760px] w-full border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-sm p-3 border-b border-slate-200">
                      Goal
                    </th>
                    <th className="text-left text-sm p-3 border-b border-slate-200">
                      Width/Height
                    </th>
                    <th className="text-left text-sm p-3 border-b border-slate-200">
                      viewBox
                    </th>
                    <th className="text-left text-sm p-3 border-b border-slate-200">
                      preserveAspectRatio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Just change display size
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Set exact values
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Keep existing
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      xMidYMid meet
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Make SVG responsive
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Remove (Responsive SVG)
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Must exist (create if missing)
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      meet (typical)
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Coordinate system matches new size
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Set exact values
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      Match output (0 0 W H)
                    </td>
                    <td className="p-3 border-b border-slate-200 text-sm">
                      meet
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-3 text-sm">
                      Scale everything proportionally
                    </td>
                    <td className="p-3 text-sm">Use Scale (%)</td>
                    <td className="p-3 text-sm">Keep or scale-vb</td>
                    <td className="p-3 text-sm">meet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Use cases */}
          <section className="mt-10">
            <h3 className="m-0 font-bold">When This Tool Is Useful</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Normalizing icon sizes across a design system</li>
              <li>Fixing missing or incorrect viewBox values</li>
              <li>Preparing SVGs for responsive web layouts</li>
              <li>Scaling exported SVG artwork for slides or documents</li>
              <li>
                Reducing layout bugs caused by style width/height overrides
              </li>
            </ul>
          </section>

          {/* Internal linking block */}
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

          {/* FAQ (expanded, visible content for SEO + UX) */}
          <section className="mt-10">
            <h3 className="m-0 font-bold">FAQ</h3>

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

          {/* Bottom filler paragraph for adsense-friendly length */}
          <section className="mt-10">
            <h3 className="m-0 font-bold">Tips for Best Results</h3>
            <div className="mt-3 grid gap-3 text-slate-700">
              <p>
                For most web use, keep the original viewBox and change
                width/height. If you are exporting SVGs for editing in another
                tool, matching the viewBox to output often prevents confusion
                and makes measurements line up with the new size. If your SVG is
                meant to be responsive, remove width and height and rely on the
                viewBox. In CSS, you can set a container width and let the SVG
                scale naturally.
              </p>
              <p>
                If an SVG behaves differently across environments, check for
                size rules in CSS, inline styles, or parent container
                constraints. For predictable behavior, use px units and set
                preserveAspectRatio to meet unless you explicitly want
                stretching or cropping.
              </p>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
