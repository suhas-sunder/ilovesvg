import * as React from "react";
import type { Route } from "./+types/svg-dimensions-inspector";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG Dimensions Inspector (Width, Height, viewBox, px)";
  const description =
    "Inspect SVG dimensions instantly in your browser. Upload or paste SVG, read width/height/viewBox, compute pixel size, detect sizing issues, and apply fixes like adding viewBox or setting width/height. Live preview. No uploads.";
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
type Unit =
  | "px"
  | "mm"
  | "cm"
  | "in"
  | "pt"
  | "pc"
  | "%"
  | "em"
  | "rem"
  | "none"
  | "unknown";

type Settings = {
  dpi: number;
  defaultPxIfMissing: number;

  fixStrategy: "none" | "add-viewbox" | "set-width-height" | "normalize";

  normalizeRemovePxSuffix: boolean;
  normalizeAddMissingXmlns: boolean;

  widthOut: string;
  heightOut: string;
  viewBoxOut: string;

  fileName: string;
};

type SvgParsed = {
  bytes: number;
  widthRaw: string | null;
  heightRaw: string | null;
  viewBoxRaw: string | null;
  preserveAspectRatio: string | null;

  width: { n: number | null; unit: Unit; raw: string | null };
  height: { n: number | null; unit: Unit; raw: string | null };

  viewBox: { minX: number; minY: number; w: number; h: number } | null;

  inferredPx: { w: number; h: number; source: string } | null;
  aspectRatio: number | null;
  warnings: string[];
};

type Result = {
  svgText: string;
  notes: string[];
};

const DEFAULTS: Settings = {
  dpi: 96,
  defaultPxIfMissing: 1024,

  fixStrategy: "none",

  normalizeRemovePxSuffix: false,
  normalizeAddMissingXmlns: true,

  widthOut: "1024",
  heightOut: "1024",
  viewBoxOut: "0 0 1024 1024",

  fileName: "svg-dimensions",
};

/* ========================
   Page
======================== */
export default function SvgDimensionsInspector(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");

  const [parsed, setParsed] = React.useState<SvgParsed | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [outPreviewUrl, setOutPreviewUrl] = React.useState<string | null>(null);

  const [result, setResult] = React.useState<Result | null>(null);

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
    setResult(null);

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

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    setFile(f);

    const text = await f.text();
    const coerced = ensureSvgHasXmlns(text);
    setSvgText(coerced);

    const p = inspectSvg(coerced, settings.dpi, settings.defaultPxIfMissing);
    setParsed(p);

    // Better basename: handles weird names like "something.svg.svg"
    const baseName = stripSvgSuffix(stripExt(f.name)) || "svg-dimensions";
    setSettings((s) => ({ ...s, fileName: baseName }));

    // Seed fix fields
    const seed = seedFixFields(p, settings.defaultPxIfMissing);
    setSettings((s) => ({
      ...s,
      widthOut: seed.widthOut,
      heightOut: seed.heightOut,
      viewBoxOut: seed.viewBoxOut,
    }));

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml;charset=utf-8" }),
    );
    setPreviewUrl(url);
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
    setParsed(null);
    setResult(null);
    setErr(null);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 420">
  <rect x="0" y="0" width="620" height="420" fill="#ffffff"/>
  <g fill="none" stroke="#0b2dff" stroke-width="6">
    <path d="M80 110 C 160 40, 260 40, 340 110 S 520 180, 560 110" />
    <circle cx="170" cy="250" r="70"/>
    <rect x="290" y="200" width="190" height="120" rx="18"/>
  </g>
  <text x="310" y="365" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="18"
    text-anchor="middle" fill="#334155">SVG Dimensions Inspector</text>
</svg>`;

    setFile(null);
    setErr(null);
    setSvgText(example);

    const p = inspectSvg(example, settings.dpi, settings.defaultPxIfMissing);
    setParsed(p);
    setResult(null);

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml;charset=utf-8" }),
      );
    });

    setOutPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    const seed = seedFixFields(p, settings.defaultPxIfMissing);
    setSettings((s) => ({
      ...s,
      widthOut: seed.widthOut,
      heightOut: seed.heightOut,
      viewBoxOut: seed.viewBoxOut,
      fileName: "svg-dimensions",
      fixStrategy: "none",
    }));

    showToast("Example loaded");
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Dimensions", href: "/svg-dimensions-inspector" },
  ];

  function recompute() {
    setErr(null);
    try {
      if (!svgText.trim()) {
        setParsed(null);
        return;
      }
      const coerced = ensureSvgHasXmlns(svgText);
      const p = inspectSvg(coerced, settings.dpi, settings.defaultPxIfMissing);
      setParsed(p);

      // Keep the before preview synced with source edits
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(
          new Blob([coerced], { type: "image/svg+xml;charset=utf-8" }),
        );
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to parse SVG.");
      setParsed(null);
    }
  }

  function applyFixNow() {
    setErr(null);
    try {
      if (!svgText.trim()) throw new Error("Upload or paste an SVG first.");

      const out = applyFix(svgText, settings, parsed);
      setResult(out);

      setOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(
          new Blob([out.svgText], { type: "image/svg+xml;charset=utf-8" }),
        );
      });

      // Re-inspect output so the stats reflect the fixed SVG
      const p2 = inspectSvg(
        out.svgText,
        settings.dpi,
        settings.defaultPxIfMissing,
      );
      setParsed(p2);

      showToast("Updated");
    } catch (e: any) {
      setErr(e?.message || "Fix failed.");
      setResult(null);
      setOutPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    }
  }

  function downloadSvg() {
    const text = (result?.svgText || svgText || "").trim();
    if (!text) return;
    const name =
      (settings.fileName || "svg-dimensions").trim() || "svg-dimensions";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(text, filename, "image/svg+xml;charset=utf-8");
    showToast("Downloaded");
  }

  function copySvg() {
    const text = (result?.svgText || svgText || "").trim();
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Copied"))
      .catch(() => setErr("Clipboard copy failed (browser blocked it)."));
  }

  // Instant compute on changes
  const lastKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    const key = JSON.stringify({
      svg: svgText,
      dpi: settings.dpi,
      fallback: settings.defaultPxIfMissing,
    });
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, settings.dpi, settings.defaultPxIfMissing]);

  const beforeImgSrc = previewUrl || null;

  // Key change: never show a broken/empty "After" area.
  // If we have an output preview, use it. Otherwise, show the input preview in the "After" slot too.
  const afterImgSrc = outPreviewUrl || previewUrl || null;

  return (
    <>

      <main
        className="min-h-[100dvh] bg-slate-50 text-slate-900"
        onPaste={onPaste}
      >
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <Breadcrumbs crumbs={crumbs} />

          <header className="text-center mb-4">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>SVG</span>
              <span className="text-slate-400">•</span>
              <span className="text-[#0b2dff]">Dimensions</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Inspect <b>width</b>, <b>height</b>, <b>viewBox</b>, and the
              computed pixel size. Apply common fixes and preview instantly.
              Runs fully client-side.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 font-bold text-lg text-slate-900">
                  SVG Input
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadExample}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                  >
                    Load example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!file && !svgText.trim() ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => document.getElementById("svg-inp")?.click()}
                  className="mt-3 border border-dashed border-[#c8d3ea] rounded-2xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
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

                  <details className="mt-3 rounded-2xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      Advanced: Edit SVG source
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-[13px] text-slate-600 mt-2">
                        Optional. Stats update instantly.
                      </p>
                      <textarea
                        value={svgText}
                        onChange={(e) =>
                          setSvgText(ensureSvgHasXmlns(e.target.value))
                        }
                        className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {/* Before / After */}
              {beforeImgSrc && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Before / After
                  </div>

                  <div className="p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        <div className="px-3 py-2 text-[12px] text-slate-600 border-b border-slate-200 bg-slate-50">
                          Before (input)
                        </div>
                        <div className="p-3">
                          <img
                            src={beforeImgSrc}
                            alt="Before SVG preview"
                            className="w-full h-auto block"
                          />
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        <div className="px-3 py-2 text-[12px] text-slate-600 border-b border-slate-200 bg-slate-50">
                          After (output)
                        </div>
                        <div className="p-3">
                          {afterImgSrc ? (
                            <>
                              <img
                                src={afterImgSrc}
                                alt="After SVG preview"
                                className="w-full h-auto block"
                              />
                              {!outPreviewUrl ? (
                                <div className="mt-2 text-[12px] text-slate-500">
                                  No output yet. Showing input preview here too.
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="text-slate-600 text-sm">
                              Upload an SVG to see preview.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {parsed?.warnings?.length ? (
                      <div className="mt-3 text-[13px] text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <ul className="list-disc pl-5 grid gap-1">
                          {parsed.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {result?.notes?.length ? (
                      <div className="mt-3 text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <ul className="list-disc pl-5 grid gap-1">
                          {result.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* INSPECT + FIX */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Dimensions
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="DPI for unit conversion">
                    <Num
                      value={settings.dpi}
                      min={24}
                      max={2400}
                      step={1}
                      onChange={(v) => setSettings((s) => ({ ...s, dpi: v }))}
                    />
                    <span className="text-[12px] text-slate-500 shrink-0">
                      Used for mm/in/pt to px
                    </span>
                  </Field>

                  <Field label="Fallback px if missing">
                    <Num
                      value={settings.defaultPxIfMissing}
                      min={16}
                      max={20000}
                      step={1}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, defaultPxIfMissing: v }))
                      }
                    />
                    <span className="text-[12px] text-slate-500 shrink-0">
                      Only if width/height and viewBox missing
                    </span>
                  </Field>

                  <div className="rounded-xl border border-slate-200 bg-[#fafcff] px-3 py-2">
                    <div className="text-[13px] font-semibold text-slate-900">
                      Detected
                    </div>
                    <div className="mt-2 grid gap-1 text-[13px] text-slate-700">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          width: <b>{parsed?.widthRaw ?? "?"}</b>
                        </span>
                        <span>
                          height: <b>{parsed?.heightRaw ?? "?"}</b>
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          viewBox: <b>{parsed?.viewBoxRaw ?? "?"}</b>
                        </span>
                        <span className="text-slate-500">
                          preserveAspectRatio:{" "}
                          <b>{parsed?.preserveAspectRatio ?? "default"}</b>
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-slate-500">
                          file size:{" "}
                          <b>{parsed ? formatBytes(parsed.bytes) : "?"}</b>
                        </span>
                        <span className="text-slate-500">
                          aspect ratio:{" "}
                          <b>
                            {parsed?.aspectRatio
                              ? roundN(parsed.aspectRatio, 4)
                              : "?"}
                          </b>
                        </span>
                      </div>

                      <div className="mt-1">
                        computed px:{" "}
                        <b>
                          {parsed?.inferredPx
                            ? `${parsed.inferredPx.w} × ${parsed.inferredPx.h}`
                            : "?"}
                        </b>{" "}
                        {parsed?.inferredPx ? (
                          <span className="text-slate-500">
                            ({parsed.inferredPx.source})
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <Field label="Fix strategy">
                    <select
                      value={settings.fixStrategy}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          fixStrategy: e.target
                            .value as Settings["fixStrategy"],
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="none">None (inspect only)</option>
                      <option value="add-viewbox">
                        Add viewBox (best for scaling)
                      </option>
                      <option value="set-width-height">
                        Set width and height attributes
                      </option>
                      <option value="normalize">
                        Normalize (safe defaults)
                      </option>
                    </select>
                  </Field>

                  {(settings.fixStrategy === "add-viewbox" ||
                    settings.fixStrategy === "normalize") && (
                    <Field label="viewBox output">
                      <input
                        value={settings.viewBoxOut}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            viewBoxOut: e.target.value,
                          }))
                        }
                        className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                        placeholder="e.g. 0 0 512 512"
                      />
                    </Field>
                  )}

                  {(settings.fixStrategy === "set-width-height" ||
                    settings.fixStrategy === "normalize") && (
                    <>
                      <Field label="Width output">
                        <input
                          value={settings.widthOut}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              widthOut: e.target.value,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          placeholder="e.g. 512 or 512px or 100%"
                        />
                      </Field>
                      <Field label="Height output">
                        <input
                          value={settings.heightOut}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              heightOut: e.target.value,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          placeholder="e.g. 512 or 512px or 100%"
                        />
                      </Field>
                    </>
                  )}

                  {settings.fixStrategy === "normalize" && (
                    <>
                      <Field label="Normalize: remove px suffix">
                        <input
                          type="checkbox"
                          checked={settings.normalizeRemovePxSuffix}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              normalizeRemovePxSuffix: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Turn 512px into 512
                        </span>
                      </Field>

                      <Field label="Normalize: ensure xmlns">
                        <input
                          type="checkbox"
                          checked={settings.normalizeAddMissingXmlns}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              normalizeAddMissingXmlns: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Adds xmlns if missing
                        </span>
                      </Field>
                    </>
                  )}

                  <Field label="Output filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="svg-dimensions"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={applyFixNow}
                    disabled={
                      !hydrated ||
                      !svgText.trim() ||
                      settings.fixStrategy === "none"
                    }
                    className={[
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Apply fix
                  </button>

                  <button
                    type="button"
                    onClick={downloadSvg}
                    disabled={!hydrated || !svgText.trim()}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download SVG
                  </button>

                  <button
                    type="button"
                    onClick={copySvg}
                    disabled={!hydrated || !svgText.trim()}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Copy SVG
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = result?.svgText;
                      if (!next) return;
                      setSvgText(next);
                      setResult(null);
                      setOutPreviewUrl((u) => {
                        if (u) URL.revokeObjectURL(u);
                        return null;
                      });
                      showToast("Output moved to input");
                    }}
                    disabled={!hydrated || !result?.svgText}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Use output as input
                  </button>
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Tip: for most SVG workflows, <b>viewBox</b> is what makes
                  scaling behave correctly. Width and height are often just
                  display hints.
                </div>
              </div>

              {/* Output SVG */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output SVG (editable)
                </div>
                <div className="p-3">
                  {result ? (
                    <textarea
                      value={result.svgText}
                      onChange={(e) => {
                        const v = ensureSvgHasXmlns(e.target.value);
                        setResult((r) => (r ? { ...r, svgText: v } : r));
                        setOutPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return URL.createObjectURL(
                            new Blob([v], {
                              type: "image/svg+xml;charset=utf-8",
                            }),
                          );
                        });
                      }}
                      className="w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Output SVG will appear here after you apply a fix.
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
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Core: inspect + fix
======================== */
function inspectSvg(
  svgText: string,
  dpi: number,
  defaultPxIfMissing: number,
): SvgParsed {
  const safe = ensureSvgHasXmlns(String(svgText || "").trim());
  const bytes = new Blob([safe]).size;

  const parser = new DOMParser();
  const doc = parser.parseFromString(safe, "image/svg+xml");
  const parserError = doc.getElementsByTagName("parsererror")?.[0];
  if (parserError)
    throw new Error("Invalid SVG. Please upload a valid SVG file.");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG. Root <svg> element not found.");
  }

  const widthRaw = svg.getAttribute("width");
  const heightRaw = svg.getAttribute("height");
  const viewBoxRaw = svg.getAttribute("viewBox");
  const preserveAspectRatio = svg.getAttribute("preserveAspectRatio");

  const width = parseLength(widthRaw);
  const height = parseLength(heightRaw);
  const viewBox = parseViewBox(viewBoxRaw);

  const warnings: string[] = [];
  if (!widthRaw)
    warnings.push(
      "No width attribute found. Some apps will rely on viewBox or CSS sizing.",
    );
  if (!heightRaw)
    warnings.push(
      "No height attribute found. Some apps will rely on viewBox or CSS sizing.",
    );
  if (!viewBoxRaw)
    warnings.push(
      "No viewBox found. This is a top reason SVG scaling behaves weird or gets clipped.",
    );
  if (width.unit === "%" || height.unit === "%")
    warnings.push(
      "Width or height uses %. Pixel size depends on the container.",
    );
  if (
    width.unit === "em" ||
    width.unit === "rem" ||
    height.unit === "em" ||
    height.unit === "rem"
  ) {
    warnings.push(
      "Width or height uses em/rem. Pixel size depends on font-size in the container.",
    );
  }

  const inferredPx = computeEffectivePx(
    width,
    height,
    viewBox,
    dpi,
    defaultPxIfMissing,
    warnings,
  );

  const aspectRatio =
    inferredPx && inferredPx.h > 0
      ? inferredPx.w / inferredPx.h
      : viewBox
        ? viewBox.w / viewBox.h
        : null;

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBoxRaw,
    preserveAspectRatio,
    width,
    height,
    viewBox,
    inferredPx,
    aspectRatio:
      aspectRatio && Number.isFinite(aspectRatio) ? aspectRatio : null,
    warnings,
  };
}

function applyFix(
  svgText: string,
  settings: Settings,
  parsed: SvgParsed | null,
): Result {
  const notes: string[] = [];
  let safe = String(svgText || "").trim();

  if (settings.fixStrategy === "none") {
    return {
      svgText: ensureSvgHasXmlns(safe),
      notes: ["No fix applied (inspect only)."],
    };
  }

  if (settings.fixStrategy === "normalize") {
    if (settings.normalizeAddMissingXmlns) safe = ensureSvgHasXmlns(safe);
  } else {
    safe = ensureSvgHasXmlns(safe);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(safe, "image/svg+xml");
  const parserError = doc.getElementsByTagName("parsererror")?.[0];
  if (parserError)
    throw new Error("Invalid SVG. Please upload a valid SVG file.");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg")
    throw new Error("Invalid SVG. Root <svg> element not found.");

  // Always ensure namespaces (some SVGs render weird in <img> without xmlns)
  if (!svg.getAttribute("xmlns"))
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!svg.getAttribute("xmlns:xlink"))
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // Fix strategy handling
  if (settings.fixStrategy === "add-viewbox") {
    const vb = settings.viewBoxOut.trim();
    const parsedVb = parseViewBox(vb);
    if (!parsedVb)
      throw new Error("viewBox output is invalid. Example: 0 0 512 512");

    const current = (svg.getAttribute("viewBox") || "").trim();
    const next =
      `${parsedVb.minX} ${parsedVb.minY} ${parsedVb.w} ${parsedVb.h}`.trim();

    svg.setAttribute("viewBox", next);

    if (current && current === next)
      notes.push(
        "viewBox was already set to the same value. Output still generated.",
      );
    else notes.push(current ? "Replaced viewBox." : "Added viewBox.");
  }

  if (settings.fixStrategy === "set-width-height") {
    const w = settings.widthOut.trim();
    const h = settings.heightOut.trim();
    if (!w || !h) throw new Error("Width and height output must not be empty.");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    notes.push("Set width and height attributes.");
  }

  if (settings.fixStrategy === "normalize") {
    const vb = settings.viewBoxOut.trim();
    if (vb) {
      const parsedVb = parseViewBox(vb);
      if (!parsedVb)
        throw new Error("viewBox output is invalid. Example: 0 0 512 512");
      svg.setAttribute(
        "viewBox",
        `${parsedVb.minX} ${parsedVb.minY} ${parsedVb.w} ${parsedVb.h}`,
      );
      notes.push("Normalized viewBox.");
    } else if (!svg.getAttribute("viewBox")) {
      // If user left it blank, still try to infer a reasonable viewBox rather than producing a no-op
      const vb2 = inferViewBoxFallback(parsed, settings.defaultPxIfMissing);
      svg.setAttribute("viewBox", vb2);
      notes.push("Normalized viewBox (auto inferred).");
    }

    const w = settings.widthOut.trim();
    const h = settings.heightOut.trim();
    if (w && h) {
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);
      notes.push("Normalized width and height.");
    }

    if (settings.normalizeRemovePxSuffix) {
      const wRaw = svg.getAttribute("width") || "";
      const hRaw = svg.getAttribute("height") || "";
      const w2 = wRaw.endsWith("px") ? wRaw.slice(0, -2) : wRaw;
      const h2 = hRaw.endsWith("px") ? hRaw.slice(0, -2) : hRaw;
      if (w2 !== wRaw) svg.setAttribute("width", w2);
      if (h2 !== hRaw) svg.setAttribute("height", h2);
      if (w2 !== wRaw || h2 !== hRaw)
        notes.push("Removed px suffix from width/height.");
    }
  }

  // If the "fix" didn't actually modify anything, still generate output so the After preview never errors out.
  if (!notes.length)
    notes.push("No changes were needed. Output still generated.");

  const serializer = new XMLSerializer();
  const out = serializer.serializeToString(doc).replace(/\u00a0/g, " ");
  return { svgText: ensureSvgHasXmlns(out), notes };
}

function inferViewBoxFallback(
  parsed: SvgParsed | null,
  defaultPxIfMissing: number,
) {
  const w = parsed?.inferredPx?.w || defaultPxIfMissing;
  const h = parsed?.inferredPx?.h || defaultPxIfMissing;
  return `0 0 ${Math.max(1, Math.round(w))} ${Math.max(1, Math.round(h))}`;
}

/* ========================
   Sizing helpers
======================== */
function parseLength(raw: string | null): {
  n: number | null;
  unit: Unit;
  raw: string | null;
} {
  if (!raw) return { n: null, unit: "none", raw: null };
  const s = String(raw).trim();
  if (!s) return { n: null, unit: "none", raw };

  const m = s.match(/^(-?\d+(\.\d+)?)([a-z%]*)$/i);
  if (!m) return { n: null, unit: "unknown", raw };

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return { n: null, unit: "unknown", raw };

  const u = (m[3] || "").toLowerCase();

  const unit: Unit =
    u === ""
      ? "px"
      : u === "px"
        ? "px"
        : u === "mm"
          ? "mm"
          : u === "cm"
            ? "cm"
            : u === "in"
              ? "in"
              : u === "pt"
                ? "pt"
                : u === "pc"
                  ? "pc"
                  : u === "%"
                    ? "%"
                    : u === "em"
                      ? "em"
                      : u === "rem"
                        ? "rem"
                        : "unknown";

  return { n: Math.abs(n), unit, raw };
}

function parseViewBox(vb: string | null | undefined) {
  if (!vb) return null;
  const parts = String(vb)
    .trim()
    .split(/[\s,]+/)
    .map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minX, minY, w, h] = parts;
  if (!w || !h) return null;
  return { minX, minY, w: Math.abs(w), h: Math.abs(h) };
}

function computeEffectivePx(
  width: { n: number | null; unit: Unit },
  height: { n: number | null; unit: Unit },
  viewBox: { w: number; h: number } | null,
  dpi: number,
  defaultPxIfMissing: number,
  warnings: string[],
): { w: number; h: number; source: string } | null {
  const safeDpi = clampNum(dpi, 24, 2400);
  const pxPerIn = safeDpi;

  const toPx = (n: number, unit: Unit): number | null => {
    if (!Number.isFinite(n) || n <= 0) return null;
    if (unit === "px") return n;
    if (unit === "in") return n * pxPerIn;
    if (unit === "cm") return (n / 2.54) * pxPerIn;
    if (unit === "mm") return (n / 25.4) * pxPerIn;
    if (unit === "pt") return (n / 72) * pxPerIn;
    if (unit === "pc") return (n / 6) * pxPerIn;
    return null;
  };

  const wPx = width.n != null ? toPx(width.n, width.unit) : null;
  const hPx = height.n != null ? toPx(height.n, height.unit) : null;

  if (wPx != null && hPx != null) {
    return {
      w: Math.max(1, Math.round(wPx)),
      h: Math.max(1, Math.round(hPx)),
      source: `from width/height (${width.unit}, ${height.unit})`,
    };
  }

  if ((width.unit === "%" || height.unit === "%") && viewBox) {
    warnings.push(
      "Percent sizing found. Using viewBox to estimate pixel size (estimate only).",
    );
  }

  if (viewBox) {
    if (wPx != null && hPx == null) {
      const h = Math.max(1, Math.round(wPx * (viewBox.h / viewBox.w)));
      return {
        w: Math.max(1, Math.round(wPx)),
        h,
        source: "width + viewBox aspect ratio",
      };
    }
    if (hPx != null && wPx == null) {
      const w = Math.max(1, Math.round(hPx * (viewBox.w / viewBox.h)));
      return {
        w,
        h: Math.max(1, Math.round(hPx)),
        source: "height + viewBox aspect ratio",
      };
    }
    return {
      w: Math.max(1, Math.round(viewBox.w)),
      h: Math.max(1, Math.round(viewBox.h)),
      source: "from viewBox (unitless)",
    };
  }

  return {
    w: Math.max(1, Math.round(defaultPxIfMissing)),
    h: Math.max(1, Math.round(defaultPxIfMissing)),
    source: "fallback default (missing width/height and viewBox)",
  };
}

function seedFixFields(parsed: SvgParsed, defaultPxIfMissing: number) {
  const vb = parsed.viewBox
    ? `0 0 ${Math.round(parsed.viewBox.w)} ${Math.round(parsed.viewBox.h)}`
    : parsed.inferredPx
      ? `0 0 ${parsed.inferredPx.w} ${parsed.inferredPx.h}`
      : `0 0 ${defaultPxIfMissing} ${defaultPxIfMissing}`;

  const wOut =
    (parsed.widthRaw && parsed.widthRaw.trim()) ||
    (parsed.inferredPx
      ? String(parsed.inferredPx.w)
      : String(defaultPxIfMissing));

  const hOut =
    (parsed.heightRaw && parsed.heightRaw.trim()) ||
    (parsed.inferredPx
      ? String(parsed.inferredPx.h)
      : String(defaultPxIfMissing));

  return { viewBoxOut: vb, widthOut: wOut, heightOut: hOut };
}

/* ========================
   Utilities
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
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

function stripSvgSuffix(name: string) {
  let out = String(name || "");
  // handle "something.svg.svg" or ".svg" left behind by stripExt
  for (let i = 0; i < 3; i++) {
    if (out.toLowerCase().endsWith(".svg")) out = out.slice(0, -4);
  }
  return out;
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "svg-dimensions"
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

function roundN(v: number, d: number) {
  const p = Math.pow(10, clampNum(d, 0, 10));
  return Math.round(v * p) / p;
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
      <span className="min-w-[200px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
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
      className="w-[140px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}

/* =

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <a href="/" className="font-extrabold tracking-tight text-slate-900">
            i<span className="text-sky-600">🩵</span>SVG
          </a>

          <nav aria-label="Footer" className="text-sm">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600">
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
        name: "SVG Dimensions Inspector",
        item: `${baseUrl}/svg-dimensions-inspector`,
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
   SEO sections + FAQ JSON-LD
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "Does this SVG dimensions inspector upload my file?",
      a: "No. Everything runs locally in your browser. Your SVG never leaves your device.",
    },
    {
      q: "What is the difference between width/height and viewBox?",
      a: "Width and height are the displayed size. viewBox is the internal coordinate system (the drawing space). viewBox is what makes SVG scale correctly without cropping or distortion.",
    },
    {
      q: "Why does my SVG show the wrong size in different apps?",
      a: "Different tools prioritize different signals. Some prefer width/height, others rely on viewBox, and web rendering can be controlled by CSS. Percent, em, and rem units depend on the container, so the same SVG can appear “different sizes” in different places.",
    },
    {
      q: "Why does the tool show a pixel size if SVG is “resolution independent”?",
      a: "SVG is vector, but it still renders into pixels on screens and when exported. The “computed pixel size” is an estimate of how the SVG will render based on width/height units and/or viewBox.",
    },
    {
      q: "What fix should I use?",
      a: "If scaling is broken or clipping happens, add/normalize viewBox first. If you need a fixed display size, set width and height. Normalize is the safest option when you want consistent behavior across apps.",
    },
    {
      q: "Does applying fixes rewrite paths or reduce quality?",
      a: "No. This tool edits only SVG sizing attributes (viewBox, width, height). It does not rasterize, flatten, or rewrite your vector paths.",
    },
  ];

  function JsonLdFaq() {
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    );
  }

  return (
    <section className="bg-white border-t border-slate-200">
      <JsonLdFaq />

      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG Dimensions Inspector (Check Width, Height, viewBox, and Pixel
            Size)
          </h2>

          <p className="mt-3">
            This <strong>SVG dimensions inspector</strong> helps you quickly
            understand how an SVG is sized and why it may render differently
            across browsers, design tools, and export pipelines. Upload an SVG
            or paste the code to instantly read the <strong>width</strong>,{" "}
            <strong>height</strong>, <strong>viewBox</strong>, and an estimated{" "}
            <strong>rendered pixel size</strong>. Then apply common fixes like
            adding a missing viewBox or normalizing width/height for consistent
            results. Everything runs <strong>client-side</strong>.
          </p>

          <section className="mt-10">
            <h3 className="m-0 font-bold">What this tool checks</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                <strong>Width / Height</strong> (including units like px, in,
                mm, pt, %, em/rem)
              </li>
              <li>
                <strong>viewBox</strong> values (min-x, min-y, width, height)
                that define the SVG coordinate system
              </li>
              <li>
                <strong>preserveAspectRatio</strong> behavior that affects
                stretching/cropping
              </li>
              <li>
                A practical <strong>pixel-size estimate</strong> for how the SVG
                may render on screens or in exports
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">
              Why your SVG “size” can be confusing
            </h3>
            <p className="mt-3">
              SVG is vector, but rendering still happens into pixels. The “real”
              size depends on which sizing signals exist and who is interpreting
              them:
            </p>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                If <strong>width/height</strong> are present, many tools use
                them as the display size.
              </li>
              <li>
                If <strong>viewBox</strong> is missing, scaling often breaks or
                becomes unpredictable.
              </li>
              <li>
                If sizing uses <strong>%</strong>, <strong>em</strong>, or{" "}
                <strong>rem</strong>, the result depends on the container and
                CSS.
              </li>
              <li>
                Different apps make different choices, so the same SVG can look
                “wrong” between Figma, Illustrator, Inkscape, browsers, and icon
                pipelines.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Why viewBox matters (the #1 fix)</h3>
            <p className="mt-3">
              The <strong>viewBox</strong> defines the internal drawing space.
              Without it, the browser or editor has to guess how to map your
              vector coordinates to a display size, which leads to clipping,
              weird scaling, or inconsistent behavior. If you want one fix that
              usually makes SVG behave properly, it’s adding (or normalizing) a{" "}
              <strong>viewBox</strong>.
            </p>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">How to use the fixes</h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2 text-slate-700">
              <li>Upload or paste your SVG.</li>
              <li>
                Check the detected <strong>width/height</strong> and{" "}
                <strong>viewBox</strong>.
              </li>
              <li>
                If viewBox is missing or scaling is broken, choose{" "}
                <strong>Add viewBox</strong> (best for scaling).
              </li>
              <li>
                If you need a fixed display size, choose{" "}
                <strong>Set width and height</strong>.
              </li>
              <li>
                If you want consistent behavior across tools, choose{" "}
                <strong>Normalize</strong>.
              </li>
              <li>Preview the output and download the updated SVG.</li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Common use cases</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Fix SVGs that scale incorrectly in browsers</li>
              <li>Stop clipping when rotating, exporting, or embedding</li>
              <li>Normalize icons for a design system or UI library</li>
              <li>Prepare SVGs for favicon/app icon pipelines</li>
              <li>
                Debug why the same SVG looks different in different editors
              </li>
            </ul>
          </section>

          <section className="mt-12">
            <h3 className="m-0 font-bold">FAQ</h3>
            <div className="not-prose mt-4 grid gap-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                    <span>{f.q}</span>
                    <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                      +
                    </span>
                  </summary>
                  <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
