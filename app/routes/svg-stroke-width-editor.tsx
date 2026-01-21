import * as React from "react";
import type { Route } from "./+types/svg-stroke-width-editor";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG Stroke Width Editor (Multiply, Set, Clamp, Live Preview)";
  const description =
    "Adjust stroke width in an SVG instantly in your browser. Multiply stroke widths, set an exact value, add missing stroke-width, clamp min/max, target paths/shapes, and preview the result live. No uploads, no server processing.";
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
type Mode = "multiply" | "set" | "add-missing";
type Target = "stroked-only" | "all" | "paths-only" | "shapes-only";
type ApplyWhere = "attr" | "style" | "both";

type Settings = {
  mode: Mode;
  target: Target;

  multiplier: number; // for multiply
  setWidth: number; // for set / add-missing

  minClamp: number; // 0..inf
  maxClamp: number; // 0..inf

  decimals: number; // rounding
  applyWhere: ApplyWhere;

  // best-effort: attempt to read computed strokeWidth (handles CSS/inheritance)
  cssAware: boolean;

  includeSelector: string;
  excludeSelector: string;

  // Make "just works" behavior robust for class/CSS SVGs
  rewriteStyleTags: boolean; // rewrite <style> blocks that include stroke-width:
  forceInlineOverride: boolean; // always set inline style stroke-width on matched elements (overrides classes)
  removeNonScalingStroke: boolean; // remove vector-effect="non-scaling-stroke" for matched elements

  // If SVG is fill-only (no stroke), users still want "thicker lines".
  // Provide an option to add stroke when missing.
  forceStrokeIfMissing: boolean;
  forceStrokeColor: string; // e.g. "#000000" or "currentColor"

  fileName: string;
  copyMinify: boolean;
};

type SvgInfo = {
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  approxW?: number;
  approxH?: number;
  bytes?: number;
};

type Result = {
  svgText: string;
  changedCount: number;
  scannedCount: number;
  notes: string[];
};

const DEFAULTS: Settings = {
  mode: "multiply",
  target: "stroked-only",

  multiplier: 1.5,
  setWidth: 2,

  minClamp: 0,
  maxClamp: 9999,

  decimals: 3,

  // Default to the option that works for CSS/class/inheritance most reliably
  applyWhere: "style",

  cssAware: true,

  includeSelector: "",
  excludeSelector: "",

  rewriteStyleTags: true,
  forceInlineOverride: true,
  removeNonScalingStroke: false,

  forceStrokeIfMissing: false,
  forceStrokeColor: "#000000",

  fileName: "stroke-adjusted",
  copyMinify: false,
};

/* ========================
   Page
======================== */
export default function SvgStrokeWidthAdjust(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  // input preview
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // output SVG text + preview
  const [result, setResult] = React.useState<Result | null>(null);
  const [outPreviewUrl, setOutPreviewUrl] = React.useState<string | null>(null);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);

  // hidden DOM mount for computed styles (optional)
  const hiddenMountRef = React.useRef<HTMLDivElement | null>(null);

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

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(f);

    const text = await f.text();
    const coerced = ensureSvgHasXmlns(text);
    setSvgText(coerced);

    const parsed = parseSvgInfo(coerced);
    setInfo(parsed);

    const baseName = stripExt(f.name) || "stroke-adjusted";
    setSettings((s) => ({ ...s, fileName: baseName }));

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml" }),
    );
    setPreviewUrl(url);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (outPreviewUrl) URL.revokeObjectURL(outPreviewUrl);
    setFile(null);
    setSvgText("");
    setInfo(null);
    setPreviewUrl(null);
    setResult(null);
    setOutPreviewUrl(null);
    setErr(null);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 420">
  <rect x="0" y="0" width="620" height="420" fill="#ffffff"/>
  <g fill="none" stroke="#0b2dff" stroke-width="3">
    <path d="M80 110 C 160 40, 260 40, 340 110 S 520 180, 560 110" />
    <circle cx="170" cy="250" r="70"/>
    <rect x="290" y="200" width="190" height="120" rx="18"/>
  </g>
  <text x="310" y="365" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="18"
    text-anchor="middle" fill="#334155">Stroke Width Adjuster (live)</text>
</svg>`;
    setFile(null);
    setErr(null);
    setSvgText(example);
    setInfo(parseSvgInfo(example));
    setResult(null);

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml" }),
      );
    });

    setOutPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    showToast("Example loaded");
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Stroke Width", href: "/svg-stroke-width-adjust" },
  ];

  async function convertNow() {
    setErr(null);
    setIsWorking(true);

    try {
      if (!svgText.trim()) throw new Error("Upload or paste an SVG first.");

      const cleaned = ensureSvgHasXmlns(svgText);
      const out = adjustStrokeWidths(cleaned, settings, hiddenMountRef);

      setResult(out);

      setOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        const blob = new Blob([out.svgText], {
          type: "image/svg+xml;charset=utf-8",
        });
        return URL.createObjectURL(blob);
      });

      showToast("Updated");
    } catch (e: any) {
      setErr(e?.message || "Update failed.");
      setResult(null);
      setOutPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    } finally {
      setIsWorking(false);
    }
  }

  function downloadSvg() {
    if (!result?.svgText) return;
    const name =
      (settings.fileName || "stroke-adjusted").trim() || "stroke-adjusted";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(result.svgText, filename, "image/svg+xml;charset=utf-8");
    showToast("Downloaded");
  }

  function copySvg() {
    if (!result?.svgText) return;
    const text = settings.copyMinify
      ? minifySvg(result.svgText)
      : result.svgText;

    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Copied"))
      .catch(() => setErr("Clipboard copy failed (browser blocked it)."));
  }

  // Instant apply on changes
  const lastKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!svgText.trim()) return;

    const key = JSON.stringify({
      svg: svgText,
      s: {
        mode: settings.mode,
        target: settings.target,
        multiplier: settings.multiplier,
        setWidth: settings.setWidth,
        minClamp: settings.minClamp,
        maxClamp: settings.maxClamp,
        decimals: settings.decimals,
        applyWhere: settings.applyWhere,
        cssAware: settings.cssAware,
        includeSelector: settings.includeSelector,
        excludeSelector: settings.excludeSelector,
        rewriteStyleTags: settings.rewriteStyleTags,
        forceInlineOverride: settings.forceInlineOverride,
        removeNonScalingStroke: settings.removeNonScalingStroke,
        forceStrokeIfMissing: settings.forceStrokeIfMissing,
        forceStrokeColor: settings.forceStrokeColor,
      },
    });

    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    void convertNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    svgText,
    settings.mode,
    settings.target,
    settings.multiplier,
    settings.setWidth,
    settings.minClamp,
    settings.maxClamp,
    settings.decimals,
    settings.applyWhere,
    settings.cssAware,
    settings.includeSelector,
    settings.excludeSelector,
    settings.rewriteStyleTags,
    settings.forceInlineOverride,
    settings.removeNonScalingStroke,
    settings.forceStrokeIfMissing,
    settings.forceStrokeColor,
  ]);

  return (
    <>
      <SiteHeader />

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
              <span className="text-[#0b2dff]">Stroke Width</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Make SVG lines thicker or thinner. Updates happen client-side with
              live preview.
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

                  {info && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected:{" "}
                      <b>
                        {info.widthRaw || "?"} {" × "} {info.heightRaw || "?"}
                      </b>
                      {info.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          • viewBox {info.viewBox}
                        </span>
                      ) : null}
                      {typeof info.bytes === "number" ? (
                        <span className="text-slate-500">
                          {" "}
                          • {formatBytes(info.bytes)}
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

              {/* Before / After */}
              {previewUrl && (
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
                            src={previewUrl}
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
                          {outPreviewUrl ? (
                            <img
                              src={outPreviewUrl}
                              alt="After SVG preview"
                              className="w-full h-auto block"
                            />
                          ) : (
                            <div className="text-slate-600 text-sm">
                              Adjust settings to generate an output preview.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

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

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Stroke Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Mode">
                    <select
                      value={settings.mode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          mode: e.target.value as Mode,
                        }))
                      }
                      className="w-full max-w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="multiply">Multiply thickness</option>
                      <option value="set">Set thickness to a value</option>
                      <option value="add-missing">
                        Add thickness only if missing
                      </option>
                    </select>
                  </Field>

                  <Field label="Targets">
                    <select
                      value={settings.target}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          target: e.target.value as Target,
                        }))
                      }
                      className="w-full max-w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="stroked-only">
                        Only stroked elements
                      </option>
                      <option value="all">All common drawable elements</option>
                      <option value="paths-only">Paths only</option>
                      <option value="shapes-only">
                        Shapes only (rect/circle/etc.)
                      </option>
                    </select>
                  </Field>

                  {settings.mode === "multiply" ? (
                    <Field label="Multiplier">
                      <Num
                        value={settings.multiplier}
                        min={0}
                        max={100}
                        step={0.1}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, multiplier: v }))
                        }
                      />
                      <span className="text-[12px] text-slate-500 shrink-0">
                        2 = double
                      </span>
                    </Field>
                  ) : (
                    <Field label="Thickness">
                      <Num
                        value={settings.setWidth}
                        min={0}
                        max={9999}
                        step={0.25}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, setWidth: v }))
                        }
                      />
                      <span className="text-[12px] text-slate-500 shrink-0">
                        unitless (SVG)
                      </span>
                    </Field>
                  )}

                  <Field label="Clamp min">
                    <Num
                      value={settings.minClamp}
                      min={0}
                      max={9999}
                      step={0.25}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, minClamp: v }))
                      }
                    />
                  </Field>

                  <Field label="Clamp max">
                    <Num
                      value={settings.maxClamp}
                      min={0}
                      max={9999}
                      step={0.25}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, maxClamp: v }))
                      }
                    />
                  </Field>

                  <Field label="Apply to">
                    <select
                      value={settings.applyWhere}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          applyWhere: e.target.value as ApplyWhere,
                        }))
                      }
                      className="w-full max-w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="style">
                        Inline style (most reliable)
                      </option>
                      <option value="both">Attribute + inline style</option>
                      <option value="attr">Attribute only</option>
                    </select>
                  </Field>

                  <Field label="CSS-aware base">
                    <input
                      type="checkbox"
                      checked={settings.cssAware}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          cssAware: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Reads computed strokes for multiply (best-effort)
                    </span>
                  </Field>

                  <Field label="Rewrite <style> rules">
                    <input
                      type="checkbox"
                      checked={settings.rewriteStyleTags}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          rewriteStyleTags: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Updates stroke-width in embedded CSS
                    </span>
                  </Field>

                  <Field label="Force override">
                    <input
                      type="checkbox"
                      checked={settings.forceInlineOverride}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          forceInlineOverride: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Writes inline style so output always changes visually
                    </span>
                  </Field>

                  <Field label="Remove non-scaling stroke">
                    <input
                      type="checkbox"
                      checked={settings.removeNonScalingStroke}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          removeNonScalingStroke: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Removes vector-effect=&quot;non-scaling-stroke&quot;
                    </span>
                  </Field>

                  <Field label="Force stroke if missing">
                    <input
                      type="checkbox"
                      checked={settings.forceStrokeIfMissing}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          forceStrokeIfMissing: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Adds stroke color when elements have no stroke
                    </span>
                  </Field>

                  {settings.forceStrokeIfMissing ? (
                    <Field label="Stroke color">
                      <input
                        value={settings.forceStrokeColor}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            forceStrokeColor: e.target.value,
                          }))
                        }
                        className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                        placeholder="#000000 or currentColor"
                      />
                    </Field>
                  ) : null}

                  <Field label="Include selector">
                    <input
                      value={settings.includeSelector}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          includeSelector: e.target.value,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder='Optional, e.g. "#logo *"'
                    />
                  </Field>

                  <Field label="Exclude selector">
                    <input
                      value={settings.excludeSelector}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          excludeSelector: e.target.value,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder='Optional, e.g. ".keep"'
                    />
                  </Field>

                  <Field label="Rounding">
                    <NumInt
                      value={settings.decimals}
                      min={0}
                      max={6}
                      step={1}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, decimals: v }))
                      }
                    />
                    <span className="text-[12px] text-slate-500 shrink-0">
                      decimals
                    </span>
                  </Field>

                  <Field label="Copy minify">
                    <input
                      type="checkbox"
                      checked={settings.copyMinify}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          copyMinify: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Minify when copying output
                    </span>
                  </Field>

                  <Field label="Output filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="stroke-adjusted"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={convertNow}
                    disabled={!hydrated || !svgText.trim() || isWorking}
                    className={[
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {isWorking ? "Updating..." : "Adjust stroke width"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadSvg}
                    disabled={!hydrated || !result?.svgText || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download SVG
                  </button>

                  <button
                    type="button"
                    onClick={copySvg}
                    disabled={!hydrated || !result?.svgText || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Copy SVG
                  </button>

                  {!err && result ? (
                    <span className="text-[13px] text-slate-600">
                      Changed <b>{result.changedCount}</b> of{" "}
                      <b>{result.scannedCount}</b>
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Updates apply instantly when you change settings.
                </div>
              </div>

              {/* OUTPUT SVG TEXT */}
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
                          const blob = new Blob([v], {
                            type: "image/svg+xml;charset=utf-8",
                          });
                          return URL.createObjectURL(blob);
                        });
                      }}
                      className="w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Output SVG will appear here after processing.
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

        {/* Hidden mount for CSS-aware computed style reading */}
        <div
          ref={hiddenMountRef}
          aria-hidden
          className="absolute left-[-99999px] top-0 w-[1px] h-[1px] overflow-hidden"
        />
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
   Core: stroke width adjust
======================== */
function adjustStrokeWidths(
  svgText: string,
  settings: Settings,
  hiddenMountRef: React.RefObject<HTMLDivElement>,
): Result {
  const notes: string[] = [];

  const safe = ensureSvgHasXmlns(String(svgText || "").trim());

  const parser = new DOMParser();
  const doc = parser.parseFromString(safe, "image/svg+xml");
  const parserError = doc.getElementsByTagName("parsererror")?.[0];
  if (parserError)
    throw new Error("Invalid SVG. Please upload a valid SVG file.");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG. Root <svg> element not found.");
  }

  if (!svg.getAttribute("xmlns"))
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!svg.getAttribute("xmlns:xlink"))
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const drawableTags = new Set([
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "use",
    "g",
  ]);

  const shapeTags = new Set([
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
  ]);

  function isDrawable(el: Element) {
    return drawableTags.has(el.tagName.toLowerCase());
  }

  function isShape(el: Element) {
    return shapeTags.has(el.tagName.toLowerCase());
  }

  function shouldSkip(el: Element) {
    const tag = el.tagName.toLowerCase();
    return (
      tag === "defs" || tag === "metadata" || tag === "title" || tag === "desc"
    );
  }

  function gateByTarget(el: Element) {
    const tag = el.tagName.toLowerCase();
    if (!isDrawable(el)) return false;

    if (settings.target === "paths-only") return tag === "path";
    if (settings.target === "shapes-only") return isShape(el);
    return true;
  }

  function safeMatches(el: Element, selector: string) {
    try {
      return el.matches(selector);
    } catch {
      return null;
    }
  }

  const includeSel = settings.includeSelector.trim();
  const excludeSel = settings.excludeSelector.trim();

  // Optional computed style map for stroke/strokeWidth
  let computedMap: Map<
    string,
    { stroke: string; strokeWidth: number | null }
  > | null = null;

  if (settings.cssAware) {
    const mount = hiddenMountRef.current;
    if (mount) {
      try {
        mount.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.innerHTML = safe;
        const liveSvg = wrapper.querySelector("svg");
        if (liveSvg) {
          mount.appendChild(liveSvg);
          const all = Array.from(liveSvg.querySelectorAll("*"));
          all.forEach((el, i) =>
            (el as Element).setAttribute("data-sw-id", String(i)),
          );

          computedMap = new Map();
          for (const el of all) {
            const e = el as Element;
            const id = e.getAttribute("data-sw-id");
            if (!id) continue;

            const cs = window.getComputedStyle(e as any);
            const stroke = String(cs.stroke || "").toLowerCase();
            const sw = parseStrokeWidthNumber(String(cs.strokeWidth || ""));
            computedMap.set(id, { stroke, strokeWidth: sw });
          }

          mount.innerHTML = "";
        } else {
          notes.push(
            "Could not mount SVG for CSS-aware base. Using attributes/styles only.",
          );
        }
      } catch {
        notes.push(
          "CSS-aware base failed in this browser. Using attributes/styles only.",
        );
        computedMap = null;
        if (mount) mount.innerHTML = "";
      }
    } else {
      notes.push("CSS-aware base unavailable. Using attributes/styles only.");
    }
  }

  // Align ids between parsed doc and computed clone
  const allEls = Array.from(svg.querySelectorAll("*"));
  allEls.forEach((el, i) => el.setAttribute("data-sw-id", String(i)));

  function parseStyleProp(style: string, prop: string): string | null {
    const m = String(style || "").match(
      new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i"),
    );
    return m ? m[1].trim() : null;
  }

  function removeStyleProp(style: string, prop: string): string {
    const s = String(style || "").trim();
    if (!s) return "";
    const propLower = prop.toLowerCase();
    const parts = s
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean);

    const kept = parts.filter((p) => {
      const idx = p.indexOf(":");
      if (idx < 0) return true;
      const key = p.slice(0, idx).trim().toLowerCase();
      return key !== propLower;
    });

    return kept.length ? kept.join("; ") + ";" : "";
  }

  function upsertStyleProp(style: string, prop: string, value: string): string {
    const s = String(style || "").trim();
    const parts = s
      ? s
          .split(";")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];
    const propLower = prop.toLowerCase();

    let found = false;
    const nextParts = parts.map((p) => {
      const idx = p.indexOf(":");
      if (idx < 0) return p;
      const key = p.slice(0, idx).trim().toLowerCase();
      if (key !== propLower) return p;
      found = true;
      return `${prop}: ${value}`;
    });

    if (!found) nextParts.push(`${prop}: ${value}`);
    return nextParts.join("; ") + (nextParts.length ? ";" : "");
  }

  function readExplicitStrokeWidth(el: Element): {
    attr: number | null;
    style: number | null;
  } {
    const a = parseStrokeWidthNumber(el.getAttribute("stroke-width") || "");
    const style = el.getAttribute("style") || "";
    const st = parseStyleProp(style, "stroke-width");
    const s = parseStrokeWidthNumber(st || "");
    return { attr: a, style: s };
  }

  function readExistingStrokeWidth(el: Element): number | null {
    // Prefer computed if available
    if (computedMap) {
      const id = el.getAttribute("data-sw-id") || "";
      const c = computedMap.get(id);
      if (c?.strokeWidth != null) return c.strokeWidth;
    }

    const exp = readExplicitStrokeWidth(el);
    if (exp.attr != null) return exp.attr;
    if (exp.style != null) return exp.style;

    return null;
  }

  function hasAnyStrokeSpecified(el: Element): boolean {
    const strokeAttr = (el.getAttribute("stroke") || "").trim().toLowerCase();
    if (strokeAttr && strokeAttr !== "none" && strokeAttr !== "transparent")
      return true;

    const style = (el.getAttribute("style") || "").toLowerCase();
    const styleStroke = (parseStyleProp(style, "stroke") || "").toLowerCase();
    if (styleStroke && styleStroke !== "none" && styleStroke !== "transparent")
      return true;

    // computed fallback
    if (computedMap) {
      const id = el.getAttribute("data-sw-id") || "";
      const c = computedMap.get(id);
      if (c?.stroke && c.stroke !== "none" && c.stroke !== "transparent")
        return true;
    }

    // inheritance fallback (common: <g stroke="...">)
    let p: Element | null = el.parentElement;
    let hops = 0;
    while (p && hops < 12) {
      const ps = (p.getAttribute("stroke") || "").trim().toLowerCase();
      if (ps === "none") return false;
      if (ps && ps !== "transparent") return true;

      const pstyle = (p.getAttribute("style") || "").toLowerCase();
      const pStrokeStyle = (
        parseStyleProp(pstyle, "stroke") || ""
      ).toLowerCase();
      if (pStrokeStyle === "none") return false;
      if (pStrokeStyle && pStrokeStyle !== "transparent") return true;

      p = p.parentElement;
      hops++;
    }

    return false;
  }

  function looksStroked(el: Element): boolean {
    if (computedMap) {
      const id = el.getAttribute("data-sw-id") || "";
      const c = computedMap.get(id);
      if (c) {
        if (c.stroke === "none" || c.stroke === "transparent") return false;
        if (c.stroke && c.stroke !== "none" && c.stroke !== "transparent")
          return true;
      }
    }
    return hasAnyStrokeSpecified(el);
  }

  function clampAndRound(n: number) {
    const d = clampNum(settings.decimals, 0, 10);
    const p = Math.pow(10, d);
    const rounded = Math.round(n * p) / p;
    const clamped = clampNum(rounded, settings.minClamp, settings.maxClamp);
    return clamped;
  }

  function maybeRemoveNonScaling(el: Element) {
    if (!settings.removeNonScalingStroke) return;
    const ve = (el.getAttribute("vector-effect") || "").trim().toLowerCase();
    if (ve === "non-scaling-stroke") {
      el.removeAttribute("vector-effect");
    }
    const style = el.getAttribute("style") || "";
    const veStyle = (parseStyleProp(style, "vector-effect") || "")
      .trim()
      .toLowerCase();
    if (veStyle === "non-scaling-stroke") {
      const cleaned = removeStyleProp(style, "vector-effect");
      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
    }
  }

  function maybeForceStroke(el: Element) {
    if (!settings.forceStrokeIfMissing) return;
    if (hasAnyStrokeSpecified(el)) return;

    const color = (settings.forceStrokeColor || "").trim() || "#000000";

    // If they are trying to add outlines, also ensure fill is not forcibly none unless user wants it.
    // We keep fill as-is. If fill-only SVG has no stroke, adding stroke makes width visible.
    if (!el.getAttribute("stroke")) el.setAttribute("stroke", color);

    // If stroke exists via style/class, we would have detected it already.
    // For robustness, also allow setting via inline style if applyWhere is style/both or if forceInlineOverride is on.
    const style = el.getAttribute("style") || "";
    if (settings.applyWhere !== "attr" || settings.forceInlineOverride) {
      el.setAttribute("style", upsertStyleProp(style, "stroke", color));
    }
  }

  function writeStrokeWidth(el: Element, value: number) {
    const out = String(clampAndRound(value));

    // Always remove non-scaling stroke if requested
    maybeRemoveNonScaling(el);

    // If user wants robust behavior, set inline style no matter what
    // This is what makes the UI feel "it just works" for class-based SVGs.
    const forceInline = settings.forceInlineOverride;

    if (settings.applyWhere === "attr" && !forceInline) {
      // Attribute should be source of truth: remove inline style stroke-width that would override it
      el.setAttribute("stroke-width", out);

      const style = el.getAttribute("style") || "";
      const cleaned = removeStyleProp(style, "stroke-width");
      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
      return;
    }

    if (settings.applyWhere === "style" || forceInline) {
      // Inline style is the source of truth: remove attribute so the output is consistent
      el.removeAttribute("stroke-width");
      const style = el.getAttribute("style") || "";
      el.setAttribute("style", upsertStyleProp(style, "stroke-width", out));
      return;
    }

    // both
    el.setAttribute("stroke-width", out);
    const style = el.getAttribute("style") || "";
    el.setAttribute("style", upsertStyleProp(style, "stroke-width", out));
  }

  function isMissingForApplyWhere(
    el: Element,
    applyWhere: ApplyWhere,
  ): boolean {
    const exp = readExplicitStrokeWidth(el);
    if (applyWhere === "attr") return exp.attr == null;
    if (applyWhere === "style") return exp.style == null;
    return exp.attr == null && exp.style == null;
  }

  // Optionally rewrite <style> blocks for class-based stroke-width
  function rewriteEmbeddedStyles(outWidthForSetOrAdd: number, mul: number) {
    if (!settings.rewriteStyleTags) return;

    const styleEls = Array.from(svg.querySelectorAll("style"));
    if (!styleEls.length) return;

    let changedRules = 0;

    for (const st of styleEls) {
      const text = st.textContent || "";
      if (!text.trim()) continue;

      // If Set/Add: set any "stroke-width: <num>" to the value
      // If Multiply: multiply numeric stroke-width values
      let next = text;

      if (settings.mode === "multiply") {
        // Replace stroke-width: <number><optional unit> with multiplied number
        next = next.replace(
          /(stroke-width\s*:\s*)(-?\d+(\.\d+)?)([a-z%]*)/gi,
          (_m, p1, num, _d, unit) => {
            const n = Number(num);
            if (!Number.isFinite(n)) return _m;
            const out = clampAndRound(Math.abs(n) * mul);
            changedRules++;
            return `${p1}${out}${unit || ""}`;
          },
        );
      } else {
        const out = clampAndRound(outWidthForSetOrAdd);
        next = next.replace(
          /(stroke-width\s*:\s*)(-?\d+(\.\d+)?)([a-z%]*)/gi,
          (_m, p1, _num, _d, unit) => {
            changedRules++;
            return `${p1}${out}${unit || ""}`;
          },
        );
      }

      if (next !== text) st.textContent = next;
    }

    if (changedRules > 0) {
      notes.push(
        `Updated stroke-width in embedded <style> rules (${changedRules} rule match${changedRules === 1 ? "" : "es"}).`,
      );
    }
  }

  let scanned = 0;
  let changed = 0;

  // Precompute values
  const mul = clampNum(settings.multiplier, 0, 100);
  const setVal = clampNum(settings.setWidth, 0, 9999);

  // Rewrite style tags first so preview also changes even when elements are class-based only
  rewriteEmbeddedStyles(setVal, mul);

  for (const el of allEls) {
    if (shouldSkip(el)) continue;
    if (!gateByTarget(el)) continue;

    if (includeSel) {
      const m = safeMatches(el, includeSel);
      if (m === false) continue;
      if (m === null)
        notes.push("Include selector looks invalid. Ignoring it.");
    }
    if (excludeSel) {
      const m = safeMatches(el, excludeSel);
      if (m === true) continue;
      if (m === null)
        notes.push("Exclude selector looks invalid. Ignoring it.");
    }

    // For stroked-only target, respect current stroking, unless user wants to force stroke
    if (
      settings.target === "stroked-only" &&
      !looksStroked(el) &&
      !settings.forceStrokeIfMissing
    ) {
      continue;
    }

    scanned++;

    // If user requests "force stroke", add it before writing width so width has effect visually
    if (settings.forceStrokeIfMissing) {
      maybeForceStroke(el);
    }

    const existing = readExistingStrokeWidth(el);

    if (settings.mode === "multiply") {
      // If we can read a value (attr/style/computed), use it.
      // If none, treat as 1 for stroked content so multiply still does something.
      let base = existing;
      if (base == null) {
        // If it is stroked (or forced), default to 1
        base = 1;
      }
      writeStrokeWidth(el, base * mul);
      changed++;
      continue;
    }

    if (settings.mode === "set") {
      writeStrokeWidth(el, setVal);
      changed++;
      continue;
    }

    // add-missing depends on where you are applying
    const missing = isMissingForApplyWhere(el, settings.applyWhere);
    if (!missing) continue;

    writeStrokeWidth(el, setVal);
    changed++;
  }

  // Cleanup helper attribute
  for (const el of allEls) el.removeAttribute("data-sw-id");

  if (scanned === 0) {
    notes.push("No matching elements found for your target settings.");
  } else if (changed === 0) {
    if (settings.mode === "add-missing") {
      notes.push("No missing stroke-width found for the chosen Apply target.");
      if (settings.applyWhere === "attr") {
        notes.push("Try Apply to: Inline style (most reliable) or Both.");
      }
    } else {
      notes.push(
        "No visible change detected. Enable Force override and/or Rewrite <style> rules.",
      );
      if (!settings.forceInlineOverride)
        notes.push(
          "Turn on Force override to override class-based stroke widths.",
        );
      if (!settings.rewriteStyleTags)
        notes.push("Turn on Rewrite <style> rules for embedded CSS.");
    }
  } else {
    // If we changed things but user might still see no visual difference, nudge the common case.
    if (settings.applyWhere === "attr") {
      notes.push(
        "Tip: If your SVG uses inline style or classes for stroke-width, attribute-only can appear unchanged. Use Inline style or Both.",
      );
    }
  }

  const serializer = new XMLSerializer();
  const outSvg = serializer.serializeToString(doc).replace(/\u00a0/g, " ");

  return {
    svgText: ensureSvgHasXmlns(outSvg),
    changedCount: changed,
    scannedCount: scanned,
    notes,
  };
}

function parseStrokeWidthNumber(raw: string): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n);
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

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    approxW: dims.w,
    approxH: dims.h,
  };
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
    if (wLen && wLen > 0)
      return { w: wLen, h: Math.max(1, Math.round(wLen * (vb.h / vb.w))) };
    if (hLen && hLen > 0)
      return { w: Math.max(1, Math.round(hLen * (vb.w / vb.h))), h: hLen };
    return { w: Math.round(vb.w), h: Math.round(vb.h) };
  }

  return { w: 1024, h: 1024 };
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
  return { minX, minY, w: Math.abs(w), h: Math.abs(h) };
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

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "stroke-adjusted"
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

function minifySvg(svg: string) {
  return String(svg || "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
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
      <span className="min-w-[140px] sm:min-w-[180px] text-[13px] text-slate-700 shrink-0">
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
      className="w-[130px] max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
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
      className="w-[130px] max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                href="/svg-to-pdf"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PDF
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
                href="/svg-recolor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Recolor
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
        name: "SVG Stroke Width Adjuster",
        item: `${baseUrl}/svg-stroke-width-adjust`,
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
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Why didn’t my SVG stroke width change?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Many SVGs do not store stroke width as a simple stroke-width attribute on each path. Instead, stroke width may be coming from a CSS class in a <style> tag, a shared group (<g>) that sets stroke and stroke-width for its children, or an inline style that overrides attributes. If you use Attribute only, but the SVG is controlled by CSS or inline styles, your change may be overridden and the preview can look unchanged. Switch Apply to: Inline style (most reliable) or Both, and enable Rewrite <style> rules / Force override if available.",
        },
      },
      {
        "@type": "Question",
        name: "What does “Apply to” mean, and which option should I use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: 'Apply to controls where the tool writes the new stroke width. Attribute writes stroke-width="…" on elements. Inline style writes style="stroke-width: …" which overrides classes and many inherited rules, so it is the most reliable. Both writes both forms. If your SVG uses CSS classes or embedded styles, choose Inline style (most reliable) or Both.',
        },
      },
      {
        "@type": "Question",
        name: "Why does Add-missing say nothing changed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Add-missing only adds stroke width where it is missing. If your SVG already has stroke-width (either as an attribute or inline style), Add-missing will skip it. Use Set mode to force a uniform width, or Multiply to scale existing widths.",
        },
      },
      {
        "@type": "Question",
        name: "Why does Multiply sometimes appear to do nothing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Multiply depends on a base stroke width. If the SVG’s stroke width comes from CSS or inheritance and you are not using CSS-aware base, the tool may not be able to read the effective value correctly. Enable CSS-aware base and/or use Inline style output so the result is not overridden by CSS.",
        },
      },
      {
        "@type": "Question",
        name: "My SVG is fill-only and has no stroke. How can I make outlines thicker?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If elements have no stroke at all, changing stroke width won’t be visible. Enable Force stroke if missing (if available) to add a stroke color so width changes produce visible outlines.",
        },
      },
    ],
  };

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG Stroke Width Adjuster (Client-Side, Instant Preview)
          </h2>

          <p className="mt-3">
            This <strong>SVG stroke width adjuster</strong> makes outlines
            thicker or thinner in seconds, directly in your browser. It can{" "}
            <strong>multiply</strong> existing stroke widths,{" "}
            <strong>set</strong> a single uniform width, or{" "}
            <strong>add missing stroke-width</strong> values. Everything runs{" "}
            <strong>client-side</strong> with a live before/after preview, so
            your SVG never uploads to a server.
          </p>

          <h3 className="mt-8 m-0 font-bold">What’s actually happening</h3>
          <p className="mt-3">
            SVGs can store line thickness in a few different places. This tool
            edits the SVG source by writing new values to one (or more) of these
            locations:
          </p>
          <ul className="mt-3">
            <li>
              <strong>stroke-width attribute</strong> (example:{" "}
              <code>stroke-width="3"</code>)
            </li>
            <li>
              <strong>inline style</strong> (example:{" "}
              <code>style="stroke-width: 3;"</code>)
            </li>
            <li>
              <strong>embedded CSS rules</strong> inside{" "}
              <code>&lt;style&gt;</code> (example:{" "}
              <code>.cls-1&#123;stroke-width:3;&#125;</code>)
            </li>
            <li>
              <strong>inheritance from groups</strong> (example: a parent{" "}
              <code>&lt;g&gt;</code> sets stroke properties that apply to
              children)
            </li>
          </ul>

          <p className="mt-3">
            The preview looks unchanged when the tool writes stroke width to one
            place, but the SVG is actually being controlled by a different place
            that still overrides it.
          </p>

          <h3 className="mt-8 m-0 font-bold">
            Why width might not change until the right settings
          </h3>
          <ul className="mt-3">
            <li>
              <strong>Apply to: Attribute only</strong> can appear to do nothing
              if the SVG uses <strong>inline styles</strong> or{" "}
              <strong>CSS classes</strong> that override attributes. Fix: choose{" "}
              <strong>Inline style (most reliable)</strong> or{" "}
              <strong>Both</strong>.
            </li>
            <li>
              <strong>Add-missing</strong> won’t change anything if matching
              elements already have a stroke width somewhere. Fix: use{" "}
              <strong>Set</strong> to force a value, or{" "}
              <strong>Multiply</strong> to scale what exists.
            </li>
            <li>
              <strong>Targets</strong> can exclude the elements you expect. Fix:
              try <strong>All common drawable elements</strong> or remove
              include/exclude selectors to confirm something is being targeted.
            </li>
            <li>
              <strong>Multiply</strong> needs a base width. If the effective
              width is coming from CSS/inheritance and you’re not reading
              computed styles, you may not get the correct base. Fix: enable{" "}
              <strong>CSS-aware base</strong> (best-effort) and output to{" "}
              <strong>Inline style</strong> so it cannot be overridden.
            </li>
            <li>
              Some SVGs are <strong>fill-only</strong> (no stroke at all).
              Stroke width changes won’t show because there’s no stroke. Fix:
              enable <strong>Force stroke if missing</strong> (if available).
            </li>
          </ul>

          <h3 className="mt-8 m-0 font-bold">
            Best settings for “make it work no matter what”
          </h3>
          <ul className="mt-3">
            <li>
              <strong>Apply to:</strong> Inline style (most reliable)
            </li>
            <li>
              <strong>Rewrite embedded CSS:</strong> On (if your tool supports
              it)
            </li>
            <li>
              <strong>Force override:</strong> On (writes inline stroke-width
              even when classes exist)
            </li>
          </ul>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Common Uses</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                Thicken icon outlines for better readability at small sizes
              </li>
              <li>Normalize stroke widths across mixed SVG assets and packs</li>
              <li>
                Prepare SVGs for print, cutting, plotting, Cricut, or laser
                workflows
              </li>
              <li>
                Fix SVGs that render with strokes too thin in specific apps or
                browsers
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">FAQ</h3>
            <div className="not-prose mt-3 grid gap-3">
              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Why didn’t my SVG stroke width change?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  If your SVG uses CSS classes, embedded{" "}
                  <code>&lt;style&gt;</code> rules, or inline styles, they can
                  override <code>stroke-width="…"</code>. Use{" "}
                  <strong>Apply to: Inline style</strong> (or{" "}
                  <strong>Both</strong>) and enable rewriting/override options
                  so the new width takes precedence.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>
                    What’s the difference between Multiply, Set, and
                    Add-missing?
                  </span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  <strong>Multiply</strong> scales the current thickness (good
                  for “make everything 2×”). <strong>Set</strong> forces one
                  thickness everywhere. <strong>Add-missing</strong> only writes
                  a thickness where none exists, so it may do nothing if your
                  SVG already defines stroke width.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Why does Add-missing say nothing changed?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Add-missing skips any element that already has a stroke width
                  (attribute or style). If you want a visible change, use{" "}
                  <strong>Set</strong> or <strong>Multiply</strong>.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>
                    My SVG has no strokes, only fills. Can this still help?
                  </span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  Yes, but stroke width won’t be visible unless a stroke exists.
                  Enable <strong>Force stroke if missing</strong> (if available)
                  to add a stroke color, then adjust thickness.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                  <span>Does this upload my SVG?</span>
                  <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                    +
                  </span>
                </summary>
                <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                  No. The SVG is processed locally in your browser. Nothing is
                  uploaded.
                </div>
              </details>
            </div>
          </section>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        </article>
      </div>
    </section>
  );
}
