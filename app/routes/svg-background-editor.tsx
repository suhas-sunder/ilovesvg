import * as React from "react";
import type { Route } from "./+types/svg-background-editor";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | SVG Background Remover & Editor";
  const description =
    "Remove or add an SVG background instantly with iLoveSVG. Automatically detects full-canvas background rectangles, lets you set solid or transparent backgrounds, preserves viewBox sizing, and exports a clean SVG. Free, client-side only, no server.";
  const canonical = "https://www.ilovesvg.com/svg-background-editor";

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
      q: "Why doesn’t “remove background” change anything?",
      a: "Most SVGs are transparent by default. If the original file doesn’t contain a full-canvas shape (usually a <rect>) then there is nothing to remove. Turn on Checkerboard or set a dark preview background to confirm transparency.",
    },
    {
      q: "Will this touch my artwork colors or strokes?",
      a: "No. The tool only targets a likely full-canvas background element (when detected) and/or inserts a new background <rect>. Your existing fills, strokes, gradients, patterns, and filters remain unchanged.",
    },
    {
      q: "What if my SVG uses CSS, <style>, or classes?",
      a: 'That’s fine. The inserted background uses explicit attributes (fill and fill-opacity) and pointer-events="none" so it won’t interfere with interactivity. We do not rewrite your CSS.',
    },
    {
      q: "Can this remove a background that is not a single <rect>?",
      a: "Sometimes. If the background is a full-canvas <path> or a <rect> wrapped in a group, it may be harder to reliably identify without risking false positives. In those cases, use Replace mode (add your own background) or edit the SVG manually.",
    },
    {
      q: "Does adding a background affect printing or PDF export?",
      a: "Usually it helps. Many print and PDF pipelines expect an explicit background if you want solid white (or any color). A real background <rect> ensures the color travels with the file instead of relying on viewer defaults.",
    },
    {
      q: "Where is the background inserted?",
      a: "By default, it is inserted right after <defs> when present (safe and predictable). If there is no <defs>, it becomes the first child of the root <svg> so it sits behind everything.",
    },
  ];

  return (
    <>
      <main className=" bg-slate-50 text-slate-900" onPaste={onPasteAny}>
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

          <section className="lg:pt-0 lg:pb-8 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm overflow-visible min-w-0">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h1 className="mb-1 text-sky-800 inline-flex items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                  SVG Background Editor
                </h1>
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
                          makeSvgDataUrl(bestEffortSvgForPreview(t)),
                        );
                        setErr(er?.message || "Invalid SVG markup.");
                      }
                    }}
                    className="flex cursor-pointer items-center justify-center px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-slate-50 text-slate-900"
                  >
                    <Icons name="example" size={16} className="mr-1" />
                    Paste SVG Example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center justify-center px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900"
                  >
                    <Icons name="trash" size={16} className="mr-1" />
                    Clear
                  </button>
                </div>
              </div>

              {/* Optional paste box */}
              <details className="my-3 rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900 bg-sky-50">
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
                        makeSvgDataUrl(bestEffortSvgForPreview(next)),
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
                    Tip: If your SVG includes XML/DOCTYPE headers, that is fine.
                    We strip them on export if you enable cleanup.
                  </div>
                </div>
              </details>
              {!inputText ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
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
                </>
              )}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50 sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm min-w-0 overflow-auto">
              <h2 className="m-0 mb-3 text-lg text-slate-900 font-semibold">
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
                                Number(e.target.value || 0),
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
                      "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="download" size={16} className="mr-1" />
                    Download SVG
                  </button>

                  <button
                    type="button"
                    onClick={copySvg}
                    disabled={buttonDisabled}
                    className={[
                      "flex items-center justify-center px-3.5 py-2 rounded-lg font-semibold border transition-colors",
                      "text-slate-900 bg-white border-slate-200 hover:bg-slate-50",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="copy" size={16} className="mr-1" />
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
        </div>
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
        <OtherToolsLinks />
        <RelatedSites />
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="text-[13px] text-slate-600 mb-3 max-w-[1180px] mx-auto px-4"
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
            __html: safeJsonLd(makeFaqJsonLd(faq)),
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
  const faq = [
    {
      q: "Why doesn’t “remove background” change anything?",
      a: "Most SVGs are transparent by default. If the original file doesn’t contain a full-canvas shape (usually a <rect>) then there is nothing to remove. Turn on Checkerboard or set a dark preview background to confirm transparency.",
    },
    {
      q: "Will this touch my artwork colors or strokes?",
      a: "No. The tool only targets a likely full-canvas background element (when detected) and/or inserts a new background <rect>. Your existing fills, strokes, gradients, patterns, and filters remain unchanged.",
    },
    {
      q: "What if my SVG uses CSS, <style>, or classes?",
      a: 'That’s fine. The inserted background uses explicit attributes (fill and fill-opacity) and pointer-events="none" so it won’t interfere with interactivity. We do not rewrite your CSS.',
    },
    {
      q: "Can this remove a background that is not a single <rect>?",
      a: "Sometimes. If the background is a full-canvas <path> or a <rect> wrapped in a group, it may be harder to reliably identify without risking false positives. In those cases, use Replace mode (add your own background) or edit the SVG manually.",
    },
    {
      q: "Does adding a background affect printing or PDF export?",
      a: "Usually it helps. Many print and PDF pipelines expect an explicit background if you want solid white (or any color). A real background <rect> ensures the color travels with the file instead of relying on viewer defaults.",
    },
    {
      q: "Where is the background inserted?",
      a: "By default, it is inserted right after <defs> when present (safe and predictable). If there is no <defs>, it becomes the first child of the root <svg> so it sits behind everything.",
    },
  ];

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-900">
        <article>
          {/* Title */}
          <header>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight m-0">
              How SVG Background Add/Remove Works
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              SVGs are often transparent. When you see a “white background” in
              an editor, it is frequently the editor canvas, not real SVG
              content. A true SVG background is usually an early, full-canvas
              shape (most commonly a first-child{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;rect&gt;
              </code>
              ) that covers the entire drawing area. This tool parses your SVG,
              tries to identify that kind of element, and then removes it,
              replaces it, or inserts a new background behind your artwork.
            </p>
            <p className="mt-2 text-slate-600  mx-auto">
              Add, remove, or replace an SVG background without a server. We
              parse your SVG, detect full-canvas background elements (when they
              exist), and export a cleaned SVG. Upload a file or paste SVG
              markup.
            </p>

            {typeof document !== "undefined" && (
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
                  placeholderLabel="Sponsored"
                />
              </div>
            )}
            {/* Quick workflow */}
            <div className=" rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="m-0 text-base font-extrabold text-slate-900">
                    Quick workflow
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                    Use this when you just want the result without thinking
                    about SVG internals.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Upload or paste SVG
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Pick Mode
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Preview
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Download or Copy
                  </span>
                </div>
              </div>

              <ol className="mt-4 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    1) Confirm transparency
                  </span>
                  <div className="mt-1 leading-relaxed">
                    Toggle <span className="font-semibold">Checkerboard</span>{" "}
                    or set a dark preview background. This avoids the “looks the
                    same” trap when your SVG is already transparent.
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    2) Remove or Replace
                  </span>
                  <div className="mt-1 leading-relaxed">
                    Use <span className="font-semibold">Remove</span> to strip
                    an existing full-canvas background. Use{" "}
                    <span className="font-semibold">Add/Replace</span> to
                    guarantee a background for print, PDF, or stickers.
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    3) Set color and opacity
                  </span>
                  <div className="mt-1 leading-relaxed">
                    Pick the exact background color you want. Opacity is useful
                    for watermark-style backdrops, but for print you usually
                    want 100%.
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    4) Export cleanly
                  </span>
                  <div className="mt-1 leading-relaxed">
                    Optional cleanup can remove XML/DOCTYPE and lightly minify
                    whitespace. The output stays an SVG and remains editable.
                  </div>
                </li>
              </ol>
            </div>
          </header>

          {/* Main grid */}
          <div className="mt-2 grid gap-6 md:grid-cols-2">
            {/* Detection */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800">
                      1
                    </span>
                    Detection
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900 m-0">
                    What we consider a background
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    The goal is to remove only the “obvious” background, without
                    risking deleting real artwork. That means we prefer
                    high-confidence signals over aggressive guessing.
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-3 text-[13px] text-slate-700">
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Early full-canvas element, usually a{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;rect&gt;
                    </code>{" "}
                    near the top of the SVG content.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Starts at{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      x=0
                    </code>{" "}
                    and{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      y=0
                    </code>{" "}
                    (or equivalent defaults).
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
                    If nothing is detected, that usually means the SVG is meant
                    to be transparent or the background is not a simple
                    full-canvas shape.
                  </span>
                </li>
              </ul>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
                <div className="font-semibold text-slate-900">
                  Common “miss” cases
                </div>
                <ul className="mt-2 space-y-2">
                  <li>
                    Background is a <span className="font-semibold">path</span>{" "}
                    (not a rect) that happens to cover the canvas.
                  </li>
                  <li>
                    Background lives inside a{" "}
                    <span className="font-semibold">group with transforms</span>
                    , making coverage ambiguous.
                  </li>
                  <li>
                    Background is created by a{" "}
                    <span className="font-semibold">
                      pattern, mask, or filter
                    </span>{" "}
                    rather than a single shape.
                  </li>
                </ul>
                <div className="mt-3">
                  In those cases, use{" "}
                  <span className="font-semibold">Add/Replace</span> to
                  guarantee a background without deleting anything.
                </div>
              </div>
            </section>

            {/* Insertion */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800">
                      2
                    </span>
                    Insertion
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900 m-0">
                    What we add (and where it goes)
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    When you add or replace a background, the tool inserts one
                    full-canvas{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;rect&gt;
                    </code>{" "}
                    behind your artwork. This is the most widely supported way
                    to create a “real” SVG background.
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
                    when present. Otherwise it falls back to root{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      width/height
                    </code>{" "}
                    and finally{" "}
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
                    . The inserted rect uses{" "}
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
                    Insert position is{" "}
                    <span className="font-semibold text-slate-900">after</span>{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;defs&gt;
                    </code>{" "}
                    when present. This avoids interfering with definitions and
                    keeps the background clearly “behind” the visible layers.
                  </span>
                </li>
              </ol>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
                <div className="font-semibold text-slate-900">
                  Why a rect is the safest choice
                </div>
                <ul className="mt-2 space-y-2">
                  <li>
                    Works across browsers, editors, and print pipelines with
                    minimal surprises.
                  </li>
                  <li>
                    Does not depend on viewer defaults (no “white in one app,
                    transparent in another”).
                  </li>
                  <li>
                    Easy to remove later without damaging the rest of the SVG.
                  </li>
                </ul>
              </div>

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
            </section>
          </div>

          {/* Cleanup + privacy */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Cleanup options and what they actually do
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              These switches are about output hygiene, not “optimizing” your
              art. Use them when you need compatibility, smaller files, or
              cleaner diffs.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900 text-[13px]">
                  Remove XML declaration
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                  Removes the{" "}
                  <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200">
                    {"<?xml ...?>"}
                  </code>{" "}
                  header. Often unnecessary on the web, and some pipelines
                  prefer it absent.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900 text-[13px]">
                  Remove DOCTYPE
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                  Removes the DOCTYPE line. This can reduce warnings in strict
                  parsers and is usually safe for modern SVG.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900 text-[13px]">
                  Minify whitespace (light)
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                  Trims excess whitespace without aggressive rewriting. This
                  keeps the SVG readable while shrinking size a bit.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
              <span className="font-semibold text-slate-900">
                On-device processing:
              </span>{" "}
              your SVG is parsed and modified in the browser. Files are not
              uploaded to a server for conversion.
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-8">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <h3 className="m-0 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                <span className="text-base">❓</span>
                FAQ
              </h3>
            </div>

            <div className="mt-4 grid gap-3">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">{item.q}</span>
                    <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 group-hover:bg-slate-100 group-open:rotate-45 transition-transform cursor-pointer">
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

          {/* Final utility note */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Troubleshooting checklist
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Output preview looks identical
                </div>
                <p className="mt-2 leading-relaxed">
                  Toggle Checkerboard, switch preview background, and compare
                  with a dark color. If there is no detected background, Remove
                  mode will not change the file.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Background appears in the wrong layer
                </div>
                <p className="mt-2 leading-relaxed">
                  Use Add/Replace, then ensure the rect is inserted as the first
                  visible layer (typically after{" "}
                  <code className="px-1 py-0.5 rounded bg-white border border-slate-200">
                    &lt;defs&gt;
                  </code>
                  ). The tool aims for “behind everything” behavior by default.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  SVG has no viewBox
                </div>
                <p className="mt-2 leading-relaxed">
                  The tool falls back to width/height. If neither is present, it
                  uses 100% sizing. For predictable results, adding a viewBox in
                  the source SVG is best.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Large files feel slow
                </div>
                <p className="mt-2 leading-relaxed">
                  Parsing big SVGs is CPU-heavy. Use the built-in throttling and
                  keep other tabs light. If the SVG is extremely large, consider
                  simplifying paths in an editor first.
                </p>
              </div>
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

  const dims = getSvgCanvasDims(svg as any);

  const children = Array.from(svg.children);
  const interesting = children.filter(
    (el) =>
      !["defs", "title", "desc", "metadata"].includes(el.tagName.toLowerCase()),
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

  const dims = getSvgCanvasDims(svg as any);

  if (s.mode === "remove") {
    removeDetectedBackground(svg as any, dims);
  } else if (s.mode === "add") {
    insertBackground(svg as any, dims, s);
  } else if (s.mode === "replace") {
    removeDetectedBackground(svg as any, dims);
    insertBackground(svg as any, dims, s);
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
      !["defs", "title", "desc", "metadata"].includes(el.tagName.toLowerCase()),
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
    "rect",
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
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i,
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
  const clean = faq
    .filter((x) => x?.q && x?.a)
    .map((x) => ({
      "@type": "Question",
      name: String(x.q).trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: String(x.a).trim(),
      },
    }));

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: clean,
  };
}

function safeJsonLd(obj: unknown) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
