import * as React from "react";
import type { Route } from "./+types/svg-background-editor";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "SVG Background Add/Remove - Detect Full-Canvas Rect, Transparent Export (Client-side)";
  const description =
    "Add or remove an SVG background in your browser. Detects full-canvas background rectangles, lets you insert a new background color (with opacity), preserves viewBox sizing, and exports a clean updated SVG. Upload or paste SVG markup. No server.";
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

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Types
======================== */
type Mode = "remove" | "add" | "replace";

type Settings = {
  mode: Mode;

  // add/replace
  color: string; // hex
  opacityPct: number; // 0..100
  cornerRadius: number; // px in SVG user units (viewBox units)

  // insertion behavior
  insertPosition: "as-first-child" | "after-defs";
  setShapeRendering: boolean;

  // cleanup
  stripXmlDecl: boolean;
  stripDoctype: boolean;
  optimizeWhitespace: boolean;

  // preview
  previewBg: string;
  showChecker: boolean;

  // output
  fileName: string;
};

type BgDetection = {
  found: boolean;
  reason: string;
  kind: "rect" | "path" | "none";
  countCandidates: number;
};

const DEFAULTS: Settings = {
  mode: "remove",
  color: "#ffffff",
  opacityPct: 100,
  cornerRadius: 0,

  insertPosition: "after-defs",
  setShapeRendering: false,

  stripXmlDecl: true,
  stripDoctype: true,
  optimizeWhitespace: false,

  previewBg: "#ffffff",
  showChecker: true,

  fileName: "svg-background",
};

/* ========================
   Page
======================== */
export default function SvgBackgroundPage({
  loaderData,
}: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [fileName, setFileName] = React.useState<string | null>(null);

  /**
   * IMPORTANT FIX:
   * Keep "what user typed / uploaded" separate from "what we process for output".
   *
   * - inputText: what the textarea shows (can be invalid while editing)
   * - inputSvgValid: last valid normalized SVG used for detection/output (never mutated by output)
   * - inPreviewSrc: ALWAYS derived from inputText (or best-effort wrapper), so it never changes
   *   when settings change.
   */
  const [inputText, setInputText] = React.useState<string>("");
  const [inputSvgValid, setInputSvgValid] = React.useState<string>("");
  const [outSvg, setOutSvg] = React.useState<string>("");

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [detect, setDetect] = React.useState<BgDetection>({
    found: false,
    reason: "Upload an SVG to detect background.",
    kind: "none",
    countCandidates: 0,
  });

  // Previews
  const [inPreviewSrc, setInPreviewSrc] = React.useState<string | null>(null);
  const [outPreviewSrc, setOutPreviewSrc] = React.useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
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

  function onPasteAny(e: React.ClipboardEvent) {
    const txt = e.clipboardData.getData("text/plain");
    if (!txt) return;
    const trimmed = txt.trim();

    if (/^<svg[\s>]/i.test(trimmed)) {
      e.preventDefault();
      setErr(null);
      setFileName("pasted.svg");

      // Validate/normalize once, then store into BOTH inputText and inputSvgValid
      try {
        const normalized = normalizeAndValidateSvg(trimmed);
        setInputText(normalized);
        setInputSvgValid(normalized);
        setInPreviewSrc(makeSvgDataUrl(normalized));
      } catch (er: any) {
        // Keep raw text visible, but processing stays empty
        setInputText(trimmed);
        setInputSvgValid("");
        setInPreviewSrc(makeSvgDataUrl(bestEffortSvgForPreview(trimmed)));
        setErr(er?.message || "Invalid SVG markup.");
      }
    }
  }

  async function handleNewFile(f: File) {
    setErr(null);

    const isSvg =
      f.type === "image/svg+xml" ||
      f.name.toLowerCase().endsWith(".svg") ||
      f.type === "";

    if (!isSvg) {
      setErr("Please upload an SVG file.");
      return;
    }

    const text = await f.text();
    const trimmed = text.trim();

    try {
      const normalized = normalizeAndValidateSvg(trimmed);
      setFileName(f.name);

      // Store input separately from output pipeline
      setInputText(normalized);
      setInputSvgValid(normalized);
      setInPreviewSrc(makeSvgDataUrl(normalized));
    } catch (e: any) {
      setErr(e?.message || "That file does not look like a valid SVG.");
      // show something in preview anyway
      setInputText(trimmed);
      setInputSvgValid("");
      setInPreviewSrc(makeSvgDataUrl(bestEffortSvgForPreview(trimmed)));
      return;
    }
  }

  function clearAll() {
    setErr(null);
    setFileName(null);
    setInputText("");
    setInputSvgValid("");
    setOutSvg("");
    setInPreviewSrc(null);
    setOutPreviewSrc(null);
    setDetect({
      found: false,
      reason: "Upload an SVG to detect background.",
      kind: "none",
      countCandidates: 0,
    });
  }

  // Detect background whenever VALID input changes (not when settings change)
  React.useEffect(() => {
    if (!hydrated || !inputSvgValid) {
      setDetect({
        found: false,
        reason: "Upload an SVG to detect background.",
        kind: "none",
        countCandidates: 0,
      });
      return;
    }
    try {
      const d = detectBackground(inputSvgValid);
      setDetect(d);
      setErr(null);
    } catch (e: any) {
      setDetect({
        found: false,
        reason: "Could not analyze background (SVG parse failed).",
        kind: "none",
        countCandidates: 0,
      });
      setErr(e?.message || "Invalid SVG.");
    }
  }, [hydrated, inputSvgValid]);

  // Apply background edit whenever settings or VALID input changes
  React.useEffect(() => {
    if (!hydrated || !inputSvgValid) {
      setOutSvg("");
      setOutPreviewSrc(null);
      return;
    }

    try {
      const result = applyBackgroundEdits(inputSvgValid, settings);
      setOutSvg(result);
      setOutPreviewSrc(makeSvgDataUrl(result));
      setErr(null);
    } catch (e: any) {
      setOutSvg("");
      setOutPreviewSrc(null);
      setErr(e?.message || "Could not update this SVG.");
    }
  }, [hydrated, inputSvgValid, settings]);

  function downloadSvg() {
    if (!outSvg) return;
    const nameBase = safeBaseName(settings.fileName || "svg-background");
    const blob = new Blob([outSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nameBase}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copySvg() {
    if (!outSvg) return;
    navigator.clipboard.writeText(outSvg).then(() => showToast("Copied"));
  }

  const buttonDisabled = isServer || !hydrated || !outSvg;

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "SVG Background Editor", url: "/svg-background-editor" },
  ];

  const faq = [
    {
      q: "Does this upload my SVG to a server?",
      a: "No. Everything runs in your browser. The SVG is parsed and edited locally, and you download the updated file.",
    },
    {
      q: "Why does background detection sometimes say “none”?",
      a: "Many SVGs are transparent by design and do not include a full-canvas background element. That is normal, and the preview should still render.",
    },
    {
      q: "What counts as a “background” in this tool?",
      a: "We look for early elements (usually a <rect>) that cover the viewBox or the width/height canvas. If found, you can remove it, or replace it with a new color/opacity.",
    },
    {
      q: "Can I paste SVG code instead of uploading?",
      a: "Yes. Paste SVG markup on the page and it will load as input.",
    },
  ];

  return (
    <>
      <SiteHeader />

      <main
        className="min-h-[100dvh] bg-slate-50 text-slate-900"
        onPaste={onPasteAny}
      >
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="text-[13px] text-slate-600 mb-3"
          >
            <ol className="flex flex-wrap items-center gap-2">
              {breadcrumbs.map((b, i) => (
                <li key={b.url} className="flex items-center gap-2">
                  <a
                    href={b.url}
                    className="hover:text-slate-900 underline-offset-2 hover:underline"
                  >
                    {b.name}
                  </a>
                  {i < breadcrumbs.length - 1 && (
                    <span className="text-slate-400">/</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <header className="text-center mb-3">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>SVG</span>
              <span className="text-[#0b2dff]">Background</span>
            </h1>
            <p className="mt-2 text-slate-600 max-w-[900px] mx-auto">
              Add, remove, or replace an SVG background without a server. We
              parse your SVG, detect full-canvas background elements (when they
              exist), and export a cleaned SVG. Upload a file or paste SVG
              markup.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-visible min-w-0">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="m-0 text-lg text-slate-900">Input SVG</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const t =
                        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
                        `<rect x="0" y="0" width="120" height="120" fill="#ffffff"/>` +
                        `<circle cx="60" cy="60" r="42" fill="#0b2dff"/></svg>`;
                      setErr(null);
                      setFileName("pasted.svg");
                      try {
                        const normalized = normalizeAndValidateSvg(t);
                        setInputText(normalized);
                        setInputSvgValid(normalized);
                        setInPreviewSrc(makeSvgDataUrl(normalized));
                        showToast("Paste box filled");
                      } catch (er: any) {
                        setInputText(t);
                        setInputSvgValid("");
                        setInPreviewSrc(
                          makeSvgDataUrl(bestEffortSvgForPreview(t))
                        );
                        setErr(er?.message || "Invalid SVG markup.");
                      }
                    }}
                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                  >
                    Paste SVG
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!inputText ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => document.getElementById("svg-inp")?.click()}
                  className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <div className="text-sm text-slate-600">
                    Click, drag and drop, or paste SVG markup
                    <div className="text-[12px] text-slate-500 mt-1">
                      Accepted: .svg
                    </div>
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
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900">
                    <div className="flex items-center min-w-0 gap-2">
                      <span className="truncate" title={fileName || ""}>
                        {fileName || "input.svg"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                      title="Clear"
                    >
                      ×
                    </button>
                  </div>

                  {/* Detection status */}
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[13px] text-slate-600 mb-1">
                      Background detection:
                    </div>
                    <div className="text-slate-900">
                      {inputSvgValid
                        ? detect.reason
                        : "Fix the SVG to detect background."}
                      <div className="text-[12px] text-slate-500 mt-1">
                        Candidates scanned:{" "}
                        {inputSvgValid ? detect.countCandidates : 0}
                      </div>
                    </div>
                  </div>

                  {/* Input preview (never depends on settings.output) */}
                  <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                      Input preview
                    </div>
                    <div className="p-3">
                      {inPreviewSrc ? (
                        <PreviewFrame
                          src={inPreviewSrc}
                          bg="#ffffff"
                          checker={true}
                          alt="Input SVG preview (always checkerboard)"
                        />
                      ) : (
                        <div className="text-slate-600 text-sm">
                          Preview unavailable.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Optional paste box */}
                  <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      Paste or edit input SVG code
                    </summary>
                    <div className="px-4 pb-4">
                      <textarea
                        value={inputText}
                        onChange={(e) => {
                          const next = e.target.value;
                          setInputText(next);

                          // Update input preview from what user typed (best-effort),
                          // but DO NOT let settings changes affect this.
                          setInPreviewSrc(
                            makeSvgDataUrl(bestEffortSvgForPreview(next))
                          );

                          // Only update processing pipeline when valid
                          try {
                            const normalized = normalizeAndValidateSvg(next);
                            setInputSvgValid(normalized);
                            setInPreviewSrc(makeSvgDataUrl(normalized));
                            setErr(null);
                          } catch (er: any) {
                            // Keep last valid inputSvgValid so output stays stable while editing
                            setErr(er?.message || "Invalid SVG markup.");
                          }
                        }}
                        className="mt-2 w-full h-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                      />
                      <div className="mt-2 text-[12px] text-slate-600">
                        Tip: If your SVG includes XML/DOCTYPE headers, that is
                        fine. We strip them on export if you enable cleanup.
                      </div>
                    </div>
                  </details>
                </>
              )}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 shadow-sm min-w-0 overflow-visible">
              <h2 className="m-0 mb-3 text-lg text-slate-900">
                Background Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-visible">
                <div className="grid gap-2">
                  <Field label="Mode">
                    <select
                      value={settings.mode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          mode: e.target.value as Mode,
                        }))
                      }
                      className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="remove">
                        Remove background (if detected)
                      </option>
                      <option value="add">Add background (insert rect)</option>
                      <option value="replace">
                        Replace background (remove then add)
                      </option>
                    </select>
                  </Field>

                  {(settings.mode === "add" || settings.mode === "replace") && (
                    <>
                      <Field label="Background color">
                        <input
                          type="color"
                          value={settings.color}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              color: e.target.value,
                            }))
                          }
                          className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                        />
                        <span className="text-[13px] text-slate-600">
                          Inserted as a full-canvas &lt;rect&gt;
                        </span>
                      </Field>

                      <Field label={`Opacity (${settings.opacityPct}%)`}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={settings.opacityPct}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              opacityPct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#0b2dff]"
                        />
                      </Field>
                      <Field
                        label={`Corner radius (${settings.cornerRadius}px)`}
                      >
                        <input
                          type="range"
                          min={0}
                          max={60}
                          step={1}
                          value={settings.cornerRadius}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              cornerRadius: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#0b2dff]"
                        />
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          value={settings.cornerRadius}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              cornerRadius: Math.max(
                                0,
                                Number(e.target.value || 0)
                              ),
                            }))
                          }
                          className="w-24 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                        />
                        <span className="text-[13px] text-slate-600">
                          Sets <code>rx</code> and <code>ry</code> on the
                          background rect
                        </span>
                      </Field>

                      <Field label="Insert position">
                        <select
                          value={settings.insertPosition}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              insertPosition: e.target.value as any,
                            }))
                          }
                          className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                        >
                          <option value="after-defs">
                            After &lt;defs&gt; (recommended)
                          </option>
                          <option value="as-first-child">
                            As first child of &lt;svg&gt;
                          </option>
                        </select>
                      </Field>

                      <Field label="Rendering hint">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={settings.setShapeRendering}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                setShapeRendering: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff]"
                          />
                          <span className="text-[13px] text-slate-700">
                            Set <code>shape-rendering="crispEdges"</code> on
                            background rect
                          </span>
                        </label>
                      </Field>
                    </>
                  )}

                  <Field label="Preview background">
                    <input
                      type="color"
                      value={settings.previewBg}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          previewBg: e.target.value,
                        }))
                      }
                      className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.showChecker}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            showChecker: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff]"
                      />
                      <span className="text-[13px] text-slate-700">
                        Checkerboard
                      </span>
                    </label>
                  </Field>

                  <Field label="Cleanup">
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.stripXmlDecl}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              stripXmlDecl: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff]"
                        />
                        <span className="text-[13px] text-slate-700">
                          Remove XML declaration
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.stripDoctype}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              stripDoctype: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff]"
                        />
                        <span className="text-[13px] text-slate-700">
                          Remove DOCTYPE
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.optimizeWhitespace}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              optimizeWhitespace: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff]"
                        />
                        <span className="text-[13px] text-slate-700">
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
                      placeholder="svg-background"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadSvg}
                    disabled={buttonDisabled}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Download SVG
                  </button>

                  <button
                    type="button"
                    onClick={copySvg}
                    disabled={buttonDisabled}
                    className={[
                      "px-3.5 py-2 rounded-lg font-semibold border transition-colors",
                      "text-slate-900 bg-white border-slate-200 hover:bg-slate-50",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Copy SVG
                  </button>

                  {err && <span className="text-red-700 text-sm">{err}</span>}
                  {!err && outSvg && (
                    <span className="text-[13px] text-slate-600">
                      Output updates automatically as you change settings.
                    </span>
                  )}
                </div>
              </div>

              {/* OUTPUT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output preview
                </div>
                <div className="p-3">
                  {outPreviewSrc ? (
                    <PreviewFrame
                      src={outPreviewSrc}
                      bg={settings.previewBg}
                      checker={settings.showChecker}
                      alt="Output SVG preview"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Upload an SVG to see the output preview.
                    </div>
                  )}
                </div>
              </div>

              {/* OUTPUT SOURCE */}
              {outSvg && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white">
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
                  </div>
                </details>
              )}
            </div>
          </section>

          <SeoSections />
          <OtherToolsLinks />
        </div>
        <RelatedSites />
        <SocialLinks />
        <SiteFooter />

        {/* Toast */}
        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}

        {/* JSON-LD: Breadcrumbs + FAQ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(makeBreadcrumbJsonLd(breadcrumbs)),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(makeFaqJsonLd(faq)),
          }}
        />
      </main>
    </>
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
          <h2 className="m-0">How SVG Background Add/Remove Works</h2>
          <p className="mt-3">
            SVGs are often transparent. When you see a “white background” in an
            editor, it is frequently just the editor canvas, not real SVG
            content. A true SVG background is usually a first-child{" "}
            <code>&lt;rect&gt;</code> (or similar shape) that spans the entire
            canvas. This tool parses your SVG, tries to detect that kind of
            full-canvas element, and then either removes it or inserts a new
            one.
          </p>

          <div className="mt-7 grid md:grid-cols-2 gap-6">
            {/* Detection */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                    <span className="text-base">🔎</span>
                    Detection
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900 m-0">
                    What we consider a background
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    We scan early shapes and look for an element that clearly
                    covers the whole canvas. If we find it, you can remove or
                    replace it.
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-3 text-[13px] text-slate-700">
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    A{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;rect&gt;
                    </code>{" "}
                    starting at{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      x=0
                    </code>{" "}
                    and{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      y=0
                    </code>
                    .
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Covers the canvas via{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      viewBox
                    </code>{" "}
                    or root{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      width/height
                    </code>
                    .
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Accepts common cover values like{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      width="100%"
                    </code>{" "}
                    and{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      height="100%"
                    </code>
                    .
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                    i
                  </span>
                  <span>
                    If we don’t detect anything, that usually means the SVG is
                    meant to be transparent.
                  </span>
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
                <span className="font-semibold text-slate-900">Tip:</span> If
                the output “looks the same,” try a non-white preview background
                or enable checkerboard to reveal transparency.
              </div>
            </div>

            {/* Insertion */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                    <span className="text-base">🧱</span>
                    Insertion
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900 m-0">
                    What we add (and where it goes)
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    We add a single full-canvas{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;rect&gt;
                    </code>{" "}
                    behind your artwork, sized safely based on your SVG.
                  </p>
                </div>
              </div>

              <ol className="mt-4 space-y-3 text-[13px] text-slate-700">
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-[12px] font-bold">
                    1
                  </span>
                  <span>
                    Size uses{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      viewBox
                    </code>{" "}
                    when present. Otherwise we fall back to root{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      width/height
                    </code>
                    , then{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      100%
                    </code>
                    .
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-[12px] font-bold">
                    2
                  </span>
                  <span>
                    You control{" "}
                    <span className="font-semibold text-slate-900">color</span>{" "}
                    and{" "}
                    <span className="font-semibold text-slate-900">
                      opacity
                    </span>
                    . We set{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      pointer-events="none"
                    </code>{" "}
                    so it won’t block clicks in browsers.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-[12px] font-bold">
                    3
                  </span>
                  <span>
                    Insert position is either{" "}
                    <span className="font-semibold text-slate-900">after</span>{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;defs&gt;
                    </code>{" "}
                    (recommended) or as the first child for maximum “behind
                    everything” behavior.
                  </span>
                </li>
              </ol>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-700">
                  Preserves artwork
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-700">
                  Safer for print/PDF
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-700">
                  Clean export
                </span>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <section className="mt-10">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h3 className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                  <span className="text-base">❓</span>
                  FAQ
                </h3>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Why would I remove a background?",
                  a: "For UI icons and overlays you usually want transparency. Removing a full-canvas rect makes the SVG truly transparent when placed over other backgrounds.",
                },
                {
                  q: "Why add a background at all?",
                  a: "Some export pipelines (PDF, certain editors, sticker/print workflows) need an explicit background. Adding a rect guarantees the background travels with the SVG.",
                },
                {
                  q: "Will this break gradients or patterns?",
                  a: "No. Background edits only target a likely full-canvas background element and/or insert a new one. Gradients/patterns inside your art stay untouched.",
                },
                {
                  q: "Can I paste SVG code instead of uploading?",
                  a: "Yes. Paste SVG markup on the page (or use the code box) and it will load.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">{item.q}</span>
                    <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <article
      itemScope
      itemType="https://schema.org/Question"
      itemProp="mainEntity"
    >
      <h4 itemProp="name" className="m-0">
        {q}
      </h4>
      <p
        itemScope
        itemType="https://schema.org/Answer"
        itemProp="acceptedAnswer"
        className="mt-2"
      >
        <span itemProp="text">{a}</span>
      </p>
    </article>
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
    <label className="flex items-start gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0 overflow-visible">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0 pt-[2px]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 overflow-visible">
        {children}
      </div>
    </label>
  );
}

function PreviewFrame({
  src,
  bg,
  checker,
  alt,
}: {
  src: string;
  bg: string;
  checker: boolean;
  alt: string;
}) {
  const [currentSrc, setCurrentSrc] = React.useState(src);
  React.useEffect(() => setCurrentSrc(src), [src]);

  return (
    <div
      className="rounded-xl border border-slate-200 overflow-hidden"
      style={{
        backgroundColor: bg,
        backgroundImage: checker
          ? `linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%),
             linear-gradient(-45deg, rgba(0,0,0,0.05) 25%, transparent 25%),
             linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.05) 75%),
             linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.05) 75%)`
          : undefined,
        backgroundSize: checker ? "20px 20px" : undefined,
        backgroundPosition: checker
          ? "0 0, 0 10px, 10px -10px, -10px 0px"
          : undefined,
      }}
    >
      <img
        src={currentSrc}
        alt={alt}
        className="w-full h-auto block"
        onError={() => {
          try {
            const svgText =
              decodeSvgDataUrl(currentSrc) || decodeSvgDataUrl(src);
            if (!svgText) return;
            const blob = new Blob([svgText], {
              type: "image/svg+xml;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            setCurrentSrc(url);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          } catch {}
        }}
      />
    </div>
  );
}

/* ===== Simple site header & footer ===== */
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
   SVG validation + normalization
======================== */
function normalizeAndValidateSvg(svgTextRaw: string): string {
  const raw = String(svgTextRaw ?? "").trim();
  if (!raw) throw new Error("Empty SVG.");

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "image/svg+xml");

  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("Not a valid SVG (parse error).");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Not a valid SVG (missing <svg> root).");
  }

  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const out = new XMLSerializer().serializeToString(svg);
  if (!/^<svg[\s>]/i.test(out.trim())) throw new Error("Not a valid SVG.");
  return out.trim();
}

function bestEffortSvgForPreview(maybeSvg: string): string {
  const s = String(maybeSvg ?? "").trim();
  if (/^<svg[\s>]/i.test(s)) return s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><rect x="0" y="0" width="300" height="120" fill="#fff"/><text x="12" y="64" font-size="14" fill="#111">Invalid SVG markup</text></svg>`;
}

/* ========================
   Background detection + edit engine
======================== */
function detectBackground(svgText: string): BgDetection {
  const doc = parseSvg(svgText);
  const svg = doc.documentElement;

  const dims = getSvgCanvasDims(svg);

  const children = Array.from(svg.children);
  const interesting = children.filter(
    (el) =>
      !["defs", "title", "desc", "metadata"].includes(el.tagName.toLowerCase())
  );

  const N = Math.min(8, interesting.length);
  let candidates = 0;

  for (let i = 0; i < N; i++) {
    const el = interesting[i];
    const tag = el.tagName.toLowerCase();

    if (tag === "rect") {
      candidates++;
      if (isFullCanvasRect(el as any, dims)) {
        return {
          found: true,
          kind: "rect",
          countCandidates: candidates,
          reason: "Detected a full-canvas <rect> that looks like a background.",
        };
      }
    } else if (tag === "path") {
      candidates++;
    }
  }

  return {
    found: false,
    kind: "none",
    countCandidates: candidates,
    reason: "No obvious full-canvas background rect detected.",
  };
}

function applyBackgroundEdits(inputSvgText: string, s: Settings): string {
  const doc = parseSvg(inputSvgText);
  const svg = doc.documentElement;

  const dims = getSvgCanvasDims(svg);

  if (s.mode === "remove") {
    removeDetectedBackground(svg, dims);
  } else if (s.mode === "add") {
    insertBackground(svg, dims, s);
  } else if (s.mode === "replace") {
    removeDetectedBackground(svg, dims);
    insertBackground(svg, dims, s);
  }

  let out = new XMLSerializer().serializeToString(svg);

  if (s.stripXmlDecl) out = out.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  if (s.stripDoctype) out = out.replace(/^\s*<!doctype[\s\S]*?>\s*/i, "");
  out = out.trim();

  if (s.optimizeWhitespace) out = lightMinify(out);
  return out;
}

function removeDetectedBackground(svg: SVGSVGElement, dims: CanvasDims) {
  const children = Array.from(svg.children);

  const interesting = children.filter(
    (el) =>
      !["defs", "title", "desc", "metadata"].includes(el.tagName.toLowerCase())
  );

  const N = Math.min(12, interesting.length);
  for (let i = 0; i < N; i++) {
    const el = interesting[i];
    if (el.tagName.toLowerCase() !== "rect") continue;

    if (isFullCanvasRect(el as any, dims)) {
      el.remove();
      break;
    }
  }
}

function insertBackground(svg: SVGSVGElement, dims: CanvasDims, s: Settings) {
  const rect = svg.ownerDocument!.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );

  const vb = parseViewBox(svg.getAttribute("viewBox"));
  const opacity = Math.max(0, Math.min(100, Math.round(s.opacityPct))) / 100;

  if (vb) {
    rect.setAttribute("x", String(vb.minX));
    rect.setAttribute("y", String(vb.minY));
    rect.setAttribute("width", String(vb.width));
    rect.setAttribute("height", String(vb.height));
  } else {
    const w = svg.getAttribute("width");
    const h = svg.getAttribute("height");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", w ? String(w) : "100%");
    rect.setAttribute("height", h ? String(h) : "100%");
  }

  const r = Math.max(0, Math.round(s.cornerRadius || 0));
  if (r > 0) {
    rect.setAttribute("rx", String(r));
    rect.setAttribute("ry", String(r));
  } else {
    rect.removeAttribute("rx");
    rect.removeAttribute("ry");
  }

  rect.setAttribute("fill", normalizeHexOrFallback(s.color, "#ffffff"));
  if (opacity < 1) rect.setAttribute("fill-opacity", String(opacity));

  rect.setAttribute("pointer-events", "none");
  if (s.setShapeRendering) rect.setAttribute("shape-rendering", "crispEdges");

  const children = Array.from(svg.children);
  if (s.insertPosition === "after-defs") {
    const defs = children.find((c) => c.tagName.toLowerCase() === "defs");
    if (defs && defs.nextSibling) {
      svg.insertBefore(rect, defs.nextSibling);
    } else if (defs) {
      svg.appendChild(rect);
    } else if (svg.firstChild) {
      svg.insertBefore(rect, svg.firstChild);
    } else {
      svg.appendChild(rect);
    }
  } else {
    if (svg.firstChild) svg.insertBefore(rect, svg.firstChild);
    else svg.appendChild(rect);
  }
}

/* ========================
   Core SVG parsing
======================== */
function parseSvg(svgText: string): XMLDocument {
  const normalized = normalizeAndValidateSvg(svgText);
  const parser = new DOMParser();
  const doc = parser.parseFromString(normalized, "image/svg+xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("Not a valid SVG (parse error).");
  return doc;
}

/* ========================
   Canvas dims helpers
======================== */
type ViewBox = { minX: number; minY: number; width: number; height: number };
type CanvasDims = {
  viewBox: ViewBox | null;
  widthAttr: string | null;
  heightAttr: string | null;
};

function getSvgCanvasDims(svg: SVGSVGElement): CanvasDims {
  return {
    viewBox: parseViewBox(svg.getAttribute("viewBox")),
    widthAttr: svg.getAttribute("width"),
    heightAttr: svg.getAttribute("height"),
  };
}

function parseViewBox(v: string | null): ViewBox | null {
  if (!v) return null;
  const parts = v.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length !== 4) return null;
  const nums = parts.map((x) => Number(x));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [minX, minY, width, height] = nums;
  if (width <= 0 || height <= 0) return null;
  return { minX, minY, width, height };
}

/* ========================
   Full-canvas rect heuristics
======================== */
function isFullCanvasRect(rect: SVGRectElement, dims: CanvasDims): boolean {
  const x = (rect.getAttribute("x") ?? "0").trim();
  const y = (rect.getAttribute("y") ?? "0").trim();
  const w = (rect.getAttribute("width") ?? "").trim();
  const h = (rect.getAttribute("height") ?? "").trim();

  const xOk = x === "0" || x === "0%" || x === "";
  const yOk = y === "0" || y === "0%" || y === "";
  if (!xOk || !yOk) return false;

  const fill = (rect.getAttribute("fill") ?? "").trim().toLowerCase();
  const opacity = (rect.getAttribute("fill-opacity") ?? "").trim();
  if (fill === "none") return false;
  if (fill === "transparent") return false;
  if (opacity && Number(opacity) === 0) return false;

  if ((w === "100%" || w === "100") && (h === "100%" || h === "100"))
    return true;
  if (w === "100%" && h === "100%") return true;

  if (dims.viewBox) {
    const vb = dims.viewBox;
    const wOk = approxLenEquals(w, vb.width) || w === String(vb.width);
    const hOk = approxLenEquals(h, vb.height) || h === String(vb.height);
    if (wOk && hOk) return true;
  }

  const rootW = parseNumericLen(dims.widthAttr);
  const rootH = parseNumericLen(dims.heightAttr);
  const rectW = parseNumericLen(w);
  const rectH = parseNumericLen(h);
  if (rootW != null && rootH != null && rectW != null && rectH != null) {
    if (approx(rectW, rootW) && approx(rectH, rootH)) return true;
  }

  if ((w === "100%" && h) || (h === "100%" && w)) {
    if (w === "100%") {
      if (dims.viewBox && approxLenEquals(h, dims.viewBox.height)) return true;
      if (rootH != null && rectH != null && approx(rectH, rootH)) return true;
    }
    if (h === "100%") {
      if (dims.viewBox && approxLenEquals(w, dims.viewBox.width)) return true;
      if (rootW != null && rectW != null && approx(rectW, rootW)) return true;
    }
  }

  return false;
}

function parseNumericLen(v: string | null): number | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  if (s.endsWith("%")) return null;
  const m = s.match(/^([0-9]+(\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function approx(a: number, b: number) {
  const diff = Math.abs(a - b);
  return diff <= 0.5 || diff <= Math.max(1, Math.abs(b) * 0.002);
}

function approxLenEquals(len: string, target: number) {
  const n = parseNumericLen(len);
  if (n == null) return false;
  return approx(n, target);
}

/* ========================
   Preview URL helpers
======================== */
function makeSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function decodeSvgDataUrl(dataUrl: string): string | null {
  if (!dataUrl.startsWith("data:image/svg+xml")) return null;
  const idx = dataUrl.indexOf(",");
  if (idx < 0) return null;
  const payload = dataUrl.slice(idx + 1);
  try {
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

/* ========================
   Output helpers
======================== */
function lightMinify(svg: string) {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function safeBaseName(name: string) {
  const n = (name || "").trim();
  const base = n || "output";
  return (
    base
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "output"
  );
}

/* ========================
   Color normalization
======================== */
function normalizeHexOrFallback(v: string, fallback: string) {
  const n = normalizeColorToken(v);
  if (n && /^#[0-9a-f]{6}$/.test(n)) return n;
  return fallback;
}

function normalizeColorToken(token: string): string | null {
  const v = String(token ?? "")
    .trim()
    .toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(v)) return normalizeHex(v);
  const rgb = v.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i
  );
  if (rgb) {
    const r = clamp255(Number(rgb[1]));
    const g = clamp255(Number(rgb[2]));
    const b = clamp255(Number(rgb[3]));
    return toHex(r, g, b);
  }
  if (v === "white") return "#ffffff";
  if (v === "black") return "#000000";
  return null;
}

function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length === 4) {
    const r = h[1],
      g = h[2],
      b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (h.length === 7) return h;
  if (h.length === 9) return `#${h.slice(1, 7)}`;
  return h;
}

function clamp255(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}
function hex2(n: number) {
  const s = clamp255(n).toString(16);
  return s.length === 1 ? `0${s}` : s;
}

/* ========================
   JSON-LD helpers
======================== */
function makeBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

function makeFaqJsonLd(faq: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };
}
