import * as React from "react";
import type { Route } from "./+types/svg-background-editor";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import { ThrottledColorInput } from "~/client/components/ui/ThrottledColorInput";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

const isServer = typeof document === "undefined";
const SITE_URL = "https://www.ilovesvg.com";

const FAQ_ITEMS = [
  {
    q: "Why doesn’t “remove background” change anything?",
    a: "Most SVGs are transparent by default. If the original file doesn’t contain a full-canvas shape (usually a <rect>) then there is nothing to remove. Turn on the checkerboard preview to confirm transparency.",
  },
  {
    q: "Will this change my artwork colors or strokes?",
    a: "No. The tool only targets a likely full-canvas background element (when detected) or inserts a new background <rect>. Your existing fills, strokes, gradients, patterns, and filters remain unchanged.",
  },
  {
    q: "What does Replace background do now?",
    a: "Replace mode removes a detected background from your main SVG, then places an uploaded SVG underlay behind your artwork (still exports as SVG). This is useful when you want a patterned or illustrated backdrop instead of a solid color.",
  },
  {
    q: "Does Replace mode keep the output as SVG?",
    a: "Yes. The underlay must be an SVG. We embed it as a nested SVG layer behind your artwork so the exported file remains SVG.",
  },
  {
    q: "What if my SVG uses CSS, <style>, or classes?",
    a: 'That’s fine. The inserted background uses explicit attributes (fill and fill-opacity) and pointer-events="none" so it won’t interfere with clicks. We do not rewrite your CSS.',
  },
  {
    q: "Can this remove a background that is not a single <rect>?",
    a: "Sometimes, but not reliably without risking false positives. If the background is a full-canvas path or produced via masks, patterns, or filters, use manual selection or edit the SVG in an editor.",
  },
  {
    q: "Does adding a background affect printing or PDF export?",
    a: "Usually it helps. Many print and PDF pipelines expect an explicit background if you want solid white (or any color). A real background <rect> ensures the color travels with the file instead of relying on viewer defaults.",
  },
  {
    q: "Where is the background inserted?",
    a: "By default, it is inserted right after <defs> when present. If there is no <defs>, it becomes the first child of the root <svg> so it sits behind everything.",
  },
];

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "SVG Background Editor - Change or Remove SVG Backgrounds | iLoveSVG";
  const description =
    "Edit SVG background fills in your browser. Remove full-canvas backgrounds, add transparent or solid fills, preview contrast, copy, and download.";
  const canonical = "https://www.ilovesvg.com/svg-background-editor";

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

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Types
======================== */
type Mode = "remove" | "add" | "replace";

type Settings = {
  mode: Mode;

  // Add background properties
  transparent: boolean;
  color: string; // hex
  opacityPct: number; // 0..100
  cornerRadius: number; // px in SVG user units (viewBox units)

  // Replace (SVG underlay)
  underlaySvg: string; // normalized svg markup ("" = none)
  underlayName: string; // filename for display

  // insertion behavior
  insertPosition: "as-first-child" | "after-defs";
  setShapeRendering: boolean;

  // cleanup
  stripXmlDecl: boolean;
  stripDoctype: boolean;
  optimizeWhitespace: boolean;

  // preview
  showChecker: boolean;

  // output
  fileName: string;

  // manual target (fallback)
  manualRemoveKey: string; // "" | "bg-<idx>"
};

type BgCandidate = {
  key: string; // "bg-<idx>"
  label: string;
  score: number;
};

type BgDetection = {
  found: boolean;
  reason: string;
  countCandidates: number;
  candidates: BgCandidate[];
};

const DEFAULTS: Settings = {
  mode: "remove",

  transparent: false,
  color: "#ffffff",
  opacityPct: 100,
  cornerRadius: 0,

  underlaySvg: "",
  underlayName: "",

  insertPosition: "after-defs",
  setShapeRendering: false,

  stripXmlDecl: true,
  stripDoctype: true,
  optimizeWhitespace: false,

  showChecker: true,

  fileName: "svg-background",

  manualRemoveKey: "",
};

const TOOL_BG_ATTR = "data-ilovesvg-bg";
const TOOL_UNDERLAY_ATTR = "data-ilovesvg-underlay";

/* ========================
   Page
======================== */
export default function SvgBackgroundPage({}: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const [inputText, setInputText] = React.useState<string>("");
  const [inputSvgValid, setInputSvgValid] = React.useState<string>("");
  const [outSvg, setOutSvg] = React.useState<string>("");

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const deferredSettings = React.useDeferredValue(settings);

  const [detect, setDetect] = React.useState<BgDetection>({
    found: false,
    reason: "Upload an SVG to detect background.",
    countCandidates: 0,
    candidates: [],
  });

  const [inPreviewSrc, setInPreviewSrc] = React.useState<string | null>(null);
  const [outPreviewSrc, setOutPreviewSrc] = React.useState<string | null>(null);

  const underlayInputRef = React.useRef<HTMLInputElement | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
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

  function onPasteAny(e: React.ClipboardEvent) {
    const txt = e.clipboardData.getData("text/plain");
    if (!txt) return;
    const trimmed = txt.trim();

    if (/^<svg[\s>]/i.test(trimmed)) {
      e.preventDefault();
      setErr(null);
      setFileName("pasted.svg");

      try {
        const normalized = normalizeAndValidateSvg(trimmed);
        setInputText(normalized);
        setInputSvgValid(normalized);
        setInPreviewSrc(makeSvgDataUrl(normalized));
      } catch (er: any) {
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

      setInputText(normalized);
      setInputSvgValid(normalized);
      setInPreviewSrc(makeSvgDataUrl(normalized));
    } catch (e: any) {
      setErr(e?.message || "That file does not look like a valid SVG.");
      setInputText(trimmed);
      setInputSvgValid("");
      setInPreviewSrc(makeSvgDataUrl(bestEffortSvgForPreview(trimmed)));
    }
  }

  async function onPickUnderlay(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.currentTarget.value = "";

    const isSvg =
      f.type === "image/svg+xml" ||
      f.name.toLowerCase().endsWith(".svg") ||
      f.type === "";

    if (!isSvg) {
      setErr("Underlay must be an SVG file.");
      return;
    }

    try {
      const raw = (await f.text()).trim();
      const normalized = normalizeAndValidateSvg(raw);
      setSettings((s) => ({
        ...s,
        underlaySvg: normalized,
        underlayName: f.name,
      }));
      showToast("Underlay added");
    } catch (e: any) {
      setErr(e?.message || "Invalid underlay SVG.");
    }
  }

  function clearUnderlay() {
    setSettings((s) => ({ ...s, underlaySvg: "", underlayName: "" }));
    showToast("Underlay cleared");
  }

  function clearAll() {
    setErr(null);
    setToast(null);
    setFileName(null);
    setInputText("");
    setInputSvgValid("");
    setOutSvg("");
    setInPreviewSrc(null);
    setOutPreviewSrc(null);
    setSettings(DEFAULTS);
    setDetect({
      found: false,
      reason: "Upload an SVG to detect background.",
      countCandidates: 0,
      candidates: [],
    });
  }

  // Detect background whenever VALID input changes (not when settings change)
  React.useEffect(() => {
    if (!hydrated || !inputSvgValid) {
      setDetect({
        found: false,
        reason: "Upload an SVG to detect background.",
        countCandidates: 0,
        candidates: [],
      });
      return;
    }
    try {
      const d = detectBackground(inputSvgValid);
      setDetect(d);
      setErr(null);

      setSettings((s) => {
        if (!s.manualRemoveKey) return s;
        const stillThere = d.candidates.some(
          (c) => c.key === s.manualRemoveKey,
        );
        return stillThere ? s : { ...s, manualRemoveKey: "" };
      });
    } catch (e: any) {
      setDetect({
        found: false,
        reason: "Could not analyze background (SVG parse failed).",
        countCandidates: 0,
        candidates: [],
      });
      setErr(e?.message || "Invalid SVG.");
    }
  }, [hydrated, inputSvgValid]);

  // Apply edits whenever settings or VALID input changes
  React.useEffect(() => {
    if (!hydrated || !inputSvgValid) {
      setOutSvg("");
      setOutPreviewSrc(null);
      return;
    }

    try {
      const result = applyBackgroundEdits(inputSvgValid, deferredSettings);
      React.startTransition(() => {
        setOutSvg(result);
        setOutPreviewSrc(makeSvgDataUrl(result));
      });
      setErr(null);
    } catch (e: any) {
      React.startTransition(() => {
        setOutSvg("");
        setOutPreviewSrc(null);
        setErr(e?.message || "Could not update this SVG.");
      });
    }
  }, [hydrated, inputSvgValid, deferredSettings]);

  function downloadSvg() {
    if (!inputSvgValid) return;
    let exportSvg = "";
    try {
      exportSvg = applyBackgroundEdits(inputSvgValid, settings);
    } catch (e: any) {
      setErr(e?.message || "Could not update this SVG.");
      return;
    }
    if (!exportSvg) return;
    const nameBase = safeBaseName(settings.fileName || "svg-background");
    const blob = new Blob([exportSvg], { type: "image/svg+xml;charset=utf-8" });
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
    if (!inputSvgValid) return;
    try {
      const exportSvg = applyBackgroundEdits(inputSvgValid, settings);
      navigator.clipboard.writeText(exportSvg).then(() => showToast("Copied"));
    } catch (e: any) {
      setErr(e?.message || "Could not update this SVG.");
    }
  }

  const buttonDisabled = isServer || !hydrated || !outSvg;

  const breadcrumbs = [
    { name: "Home", url: `${SITE_URL}/` },
    { name: "SVG Background Editor", url: `${SITE_URL}/svg-background-editor` },
  ];

  const showManualPicker = !!inputSvgValid && detect.candidates.length > 0;

  const showAddControls = settings.mode === "add";
  const showReplaceControls = settings.mode === "replace";

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]" onPaste={onPasteAny}>
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
                    className="flex cursor-pointer items-center justify-center px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-sky-100 text-slate-900"
                  >
                    <Icons name="trash" size={16} className="mr-1" />
                    Clear
                  </button>
                </div>
              </div>

              <details className="my-3 rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900 bg-sky-50">
                  Paste or edit input SVG code
                </summary>
                <div className="px-4 pb-4">
                  <textarea
                    aria-label="Input SVG code"
                    value={inputText}
                    onChange={(e) => {
                      const next = e.target.value;
                      setInputText(next);

                      setInPreviewSrc(
                        makeSvgDataUrl(bestEffortSvgForPreview(next)),
                      );

                      try {
                        const normalized = normalizeAndValidateSvg(next);
                        setInputSvgValid(normalized);
                        setInPreviewSrc(makeSvgDataUrl(normalized));
                        setErr(null);
                      } catch (er: any) {
                        setErr(er?.message || "Invalid SVG markup.");
                      }
                    }}
                    className="mt-2 w-full h-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                    spellCheck={false}
                  />
                  <div className="mt-2 text-[12px] text-slate-600">
                    Tip: If your SVG includes XML or DOCTYPE headers, that is
                    fine. Cleanup options can strip them on export.
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

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[13px] text-slate-600 mb-1">
                      Background detection:
                    </div>
                    <div className="text-slate-900">
                      {inputSvgValid
                        ? detect.reason
                        : "Fix the SVG to detect background."}
                      <div className="text-[12px] text-slate-500 mt-1">
                        Candidates found:{" "}
                        {inputSvgValid ? detect.countCandidates : 0}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                      Input preview
                    </div>
                    <div className="p-3">
                      {inPreviewSrc ? (
                        <PreviewFrame
                          src={inPreviewSrc}
                          checker={true}
                          alt="Input SVG preview (checkerboard)"
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
                          // keep add settings intact, but remove confusion
                          manualRemoveKey:
                            e.target.value === "remove"
                              ? s.manualRemoveKey
                              : "",
                        }))
                      }
                      className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer"
                    >
                      <option value="remove">Remove background</option>
                      <option value="add">Add background</option>
                      <option value="replace">
                        Replace background (SVG underlay)
                      </option>
                    </select>
                  </Field>

                  {showManualPicker && settings.mode === "remove" && (
                    <Field label="Manual remove">
                      <select
                        value={settings.manualRemoveKey}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            manualRemoveKey: e.target.value,
                          }))
                        }
                        className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer"
                      >
                        <option value="">Auto (best match)</option>
                        {detect.candidates.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {showAddControls && (
                    <>
                      <Field label="Transparent background">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.transparent}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                transparent: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                          <span className="text-[13px] text-slate-700">
                            Insert no background fill (keeps SVG transparent)
                          </span>
                        </label>
                      </Field>

                      {!settings.transparent && (
                        <>
                          <Field label="Background color">
                            <ThrottledColorInput
                              value={settings.color}
                              onCommit={(value) =>
                                setSettings((s) => ({
                                  ...s,
                                  color: value,
                                }))
                              }
                              className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-600">
                              Added as a full-canvas &lt;rect&gt;
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
                              className="w-full accent-[#0b2dff] cursor-pointer"
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
                              className="w-full accent-[#0b2dff] cursor-pointer"
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

                          <Field label="Rendering hint">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.setShapeRendering}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    setShapeRendering: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                              />
                              <span className="text-[13px] text-slate-700">
                                Set <code>shape-rendering="crispEdges"</code> on
                                background rect
                              </span>
                            </label>
                          </Field>
                        </>
                      )}
                    </>
                  )}

                  {showReplaceControls && (
                    <>
                      <Field label="Underlay SVG">
                        <input
                          ref={underlayInputRef}
                          type="file"
                          accept="image/svg+xml,.svg"
                          onChange={onPickUnderlay}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => underlayInputRef.current?.click()}
                          className="flex cursor-pointer items-center justify-center px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-slate-50 text-slate-900"
                        >
                          <Icons name="upload" size={16} className="mr-1" />
                          Upload underlay SVG
                        </button>

                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-[13px] text-slate-700 truncate"
                            title={settings.underlayName}
                          >
                            {settings.underlayName
                              ? settings.underlayName
                              : "None selected"}
                          </span>
                          {settings.underlaySvg ? (
                            <button
                              type="button"
                              onClick={clearUnderlay}
                              className="px-2 py-1 rounded-md border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 text-slate-900"
                              title="Clear underlay"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>

                        <span className="text-[13px] text-slate-600">
                          Replace mode removes the main SVG background, then
                          inserts the underlay behind it.
                        </span>
                      </Field>
                    </>
                  )}

                  {(settings.mode === "add" || settings.mode === "replace") && (
                    <Field label="Insert position">
                      <select
                        value={settings.insertPosition}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            insertPosition: e.target.value as any,
                          }))
                        }
                        className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer"
                      >
                        <option value="after-defs">
                          After &lt;defs&gt; (recommended)
                        </option>
                        <option value="as-first-child">
                          As first child of &lt;svg&gt;
                        </option>
                      </select>
                    </Field>
                  )}

                  <Field label="Preview">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showChecker}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            showChecker: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                      />
                      <span className="text-[13px] text-slate-700">
                        Checkerboard
                      </span>
                    </label>
                  </Field>

                  <Field label="Cleanup">
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.stripXmlDecl}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              stripXmlDecl: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700">
                          Remove XML declaration
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.stripDoctype}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              stripDoctype: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700">
                          Remove DOCTYPE
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.optimizeWhitespace}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              optimizeWhitespace: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
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
                      "flex cursor-pointer items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
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
                      "flex cursor-pointer items-center justify-center px-3.5 py-2 rounded-lg font-semibold border transition-colors",
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

              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output preview
                </div>
                <div className="p-3">
                  {outPreviewSrc ? (
                    <PreviewFrame
                      src={outPreviewSrc}
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

              {outSvg && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                    Output SVG code
                  </summary>
                  <div className="px-4 pb-4">
                    <textarea
                      aria-label="Output SVG code"
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

          <SeoSections faq={FAQ_ITEMS} />
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
        <ContextualAffiliateCard />

        <OtherToolsLinks />
        <RelatedSites />

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

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(makeBreadcrumbJsonLd(breadcrumbs)),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(makeFaqJsonLd(FAQ_ITEMS)),
          }}
        />
      </main>
    </>
  );
}

/* ========================
   SEO sections (800 to 1200 words)
======================== */
function SeoSections({ faq }: { faq: Array<{ q: string; a: string }> }) {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-900">
        <article>
          <header>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight m-0">
              SVG Background Editor: Remove, Add, and Replace with an SVG
              Underlay
            </h2>

            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              SVG background issues are usually caused by a mismatch between
              what the file actually contains and what a viewer chooses to
              display behind it. Many editors show a white canvas even when the
              SVG is fully transparent. Web pages show the page background
              behind your artwork. Some export pipelines introduce a white page
              when converting to PDF. If you are trying to control what users
              see and what gets exported, you need the background to be a real
              element in the SVG, not a viewer default.
            </p>

            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              This tool focuses on the most common, lowest-risk background
              pattern: a full-canvas shape near the top of the SVG that exists
              only to paint a background. In practice this is usually a{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;rect&gt;
              </code>{" "}
              that starts at the origin and covers the canvas. Sometimes it
              matches the{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                viewBox
              </code>
              , sometimes it uses{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                width="100%"
              </code>{" "}
              and{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                height="100%"
              </code>
              . This page detects likely candidates and removes them when you
              choose Remove mode. If detection is unsure, you can manually
              select a candidate so you stay in control.
            </p>

            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              The editor is intentionally narrow. It works with SVG background
              fill elements and SVG underlays. It does not remove raster photo
              backgrounds, rewrite your artwork, expand CSS, merge groups,
              flatten filters, or convert paths. Backgrounds can be intertwined
              with real artwork in complex SVGs, and aggressive heuristics can
              delete meaningful shapes. Instead, the tool uses conservative
              detection, a manual fallback, and a predictable insertion strategy
              when you add new background layers.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="m-0 text-lg font-extrabold text-slate-900">
                What each mode does
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">
                    Remove background
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                    Removes one likely full-canvas background rectangle. This is
                    ideal when the SVG already contains a background shape you
                    do not want. If the tool is not confident, you can manually
                    pick a candidate. The result is a transparent SVG, assuming
                    nothing else is painting the full canvas.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">
                    Add background
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                    Inserts a full-canvas background rectangle behind the
                    artwork. Use this when the SVG is transparent and you need a
                    predictable solid background for print, PDF export,
                    thumbnails, sticker mockups, or editor previews. The
                    inserted rect is tagged so it can be removed cleanly later.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">
                    Replace background (SVG underlay)
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                    Removes a detected background from your main SVG, then
                    places an uploaded SVG underlay behind your artwork. This
                    keeps the output as SVG while giving you an illustrated or
                    patterned backdrop instead of a flat color. It is also
                    useful when you want a reusable background asset across
                    multiple SVGs.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-slate-700">
                Replace mode is intentionally SVG-only. If you need to place a
                JPG or PNG behind your artwork, that is still an SVG file, but
                it is no longer purely vector. For iLoveSVG, keeping this
                workflow SVG-only avoids surprises and preserves editability
                across vector tools.
              </p>
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

            <h3 className="mt-6 text-lg font-extrabold text-slate-900 m-0">
              How background detection works
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
              Detection is based on safe signals: position, size coverage, and
              typical ordering. The tool scans early children of the root{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;svg&gt;
              </code>{" "}
              while ignoring non-visual tags like{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;defs&gt;
              </code>
              ,{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;metadata&gt;
              </code>
              , and{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;title&gt;
              </code>
              . It then scores rectangles that appear to cover the full canvas
              using viewBox sizing, root width and height, or common percentage
              sizing. Rectangles with fill set to none, transparent, or zero
              opacity are not treated as backgrounds. If the tool cannot find a
              strong match, it still lists candidates so you can select one
              manually.
            </p>

            <h3 className="mt-6 text-lg font-extrabold text-slate-900 m-0">
              How Replace mode inserts an SVG underlay
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
              Replace mode always starts by removing the detected background
              from your main SVG, plus any background shapes that were
              previously inserted by this tool. Then it embeds your uploaded
              underlay as a nested SVG positioned behind the artwork. The nested
              SVG is sized to match the main SVG canvas so it fills the same
              drawing area. This approach keeps the output as SVG and preserves
              the underlay’s vector content, including its own fills, gradients,
              and shapes.
            </p>

            <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
              When you combine two SVGs, ID collisions can happen if both files
              use the same IDs for gradients, clips, or masks. To reduce that
              risk, the tool prefixes IDs inside the underlay and updates common
              references (like url(#id) and href="#id") before inserting it.
              This keeps the underlay self-contained and makes it less likely to
              interfere with your original artwork.
            </p>

            <h3 className="mt-6 text-lg font-extrabold text-slate-900 m-0">
              Why the inserted background is a rectangle
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
              A single full-canvas rectangle is the most compatible way to
              represent a solid background across browsers and editors. It does
              not depend on viewer defaults. It remains easy to remove later.
              When inserted, the rectangle is marked with a tool attribute so it
              can be removed cleanly if you switch modes. It also uses
              pointer-events="none" so it does not block clicks in interactive
              SVG usage.
            </p>

            <h3 className="mt-6 text-lg font-extrabold text-slate-900 m-0">
              Output cleanup and compatibility
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
              Cleanup options are output hygiene features. Removing the XML
              declaration and DOCTYPE can reduce warnings in strict parsers and
              make the SVG easier to embed inline in HTML. Light whitespace
              minification reduces file size without heavily rewriting your
              markup. These switches do not optimize paths or alter visual
              fidelity. The tool preserves your original structure and only
              touches the minimum elements needed to achieve background removal,
              solid background insertion, or underlay embedding.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-[13px] leading-relaxed text-slate-700">
              <div className="font-semibold text-slate-900">
                On-device processing
              </div>
              <div className="mt-2">
                Your SVG is parsed and modified in your browser. Files are not
                uploaded to a server for conversion. Download and copy actions
                export the locally generated SVG text.
              </div>
            </div>
          </header>

          <CurrentRouteGuide />

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
        </article>
      </div>
    </section>
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
  checker,
  alt,
}: {
  src: string;
  checker: boolean;
  alt: string;
}) {
  const [currentSrc, setCurrentSrc] = React.useState(src);
  React.useEffect(() => setCurrentSrc(src), [src]);

  return (
    <div
      className="rounded-xl border border-slate-200 overflow-hidden"
      style={{
        backgroundColor: "#ffffff",
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
        className="w-full h-auto block transparent-checkerboard"
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
  const svg = doc.documentElement as any as SVGSVGElement;
  const dims = getSvgCanvasDims(svg);

  const candidates = findBackgroundRectCandidates(svg, dims);
  const best = candidates[0];

  if (best && best.score >= 6) {
    return {
      found: true,
      reason: "Detected a likely full-canvas background rectangle.",
      countCandidates: candidates.length,
      candidates: candidates.map((c, idx) => ({ ...c, key: `bg-${idx}` })),
    };
  }

  return {
    found: false,
    reason: candidates.length
      ? "No obvious background detected. If this SVG has a background layer, use Manual remove."
      : "No obvious background detected.",
    countCandidates: candidates.length,
    candidates: candidates.map((c, idx) => ({ ...c, key: `bg-${idx}` })),
  };
}

function applyBackgroundEdits(inputSvgText: string, s: Settings): string {
  const doc = parseSvg(inputSvgText);
  const svg = doc.documentElement as any as SVGSVGElement;
  const dims = getSvgCanvasDims(svg);

  if (s.mode === "remove") {
    removeDetectedOrManualBackground(svg, dims, s.manualRemoveKey);
    removeInsertedBackgroundByTool(svg);
    removeInsertedUnderlayByTool(svg);
  } else if (s.mode === "add") {
    removeInsertedBackgroundByTool(svg);
    removeInsertedUnderlayByTool(svg);
    if (!s.transparent) {
      insertBackground(svg, s);
    }
  } else if (s.mode === "replace") {
    // Replace mode now means: remove background from main svg, then add SVG underlay behind.
    removeInsertedBackgroundByTool(svg);
    removeInsertedUnderlayByTool(svg);
    removeDetectedOrManualBackground(svg, dims, "");
    if (s.underlaySvg) {
      insertUnderlaySvg(svg, dims, s.underlaySvg, s.insertPosition);
    }
  }

  let out = new XMLSerializer().serializeToString(svg);

  if (s.stripXmlDecl) out = out.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  if (s.stripDoctype) out = out.replace(/^\s*<!doctype[\s\S]*?>\s*/i, "");
  out = out.trim();

  if (s.optimizeWhitespace) out = lightMinify(out);
  return out;
}

function removeDetectedOrManualBackground(
  svg: SVGSVGElement,
  dims: CanvasDims,
  manualKey: string,
) {
  if (manualKey && manualKey.startsWith("bg-")) {
    const candidates = findBackgroundRectCandidates(svg, dims);
    const idx = Number(manualKey.slice("bg-".length));
    const picked = Number.isFinite(idx) ? candidates[idx] : undefined;
    if (picked?.element) {
      picked.element.remove();
      return;
    }
  }

  const candidates = findBackgroundRectCandidates(svg, dims);
  const best = candidates[0];
  if (best?.element && best.score >= 6) {
    best.element.remove();
  }
}

function removeInsertedBackgroundByTool(svg: SVGSVGElement) {
  const rects = Array.from(svg.querySelectorAll(`rect[${TOOL_BG_ATTR}="1"]`));
  rects.forEach((r) => r.remove());
}

function removeInsertedUnderlayByTool(svg: SVGSVGElement) {
  const nodes = Array.from(
    svg.querySelectorAll(`svg[${TOOL_UNDERLAY_ATTR}="1"]`),
  );
  nodes.forEach((n) => n.remove());
}

function insertBackground(svg: SVGSVGElement, s: Settings) {
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

  rect.setAttribute(TOOL_BG_ATTR, "1");

  insertNodeAtPosition(svg, rect, s.insertPosition);
}

function insertUnderlaySvg(
  svg: SVGSVGElement,
  dims: CanvasDims,
  underlaySvgText: string,
  pos: "as-first-child" | "after-defs",
) {
  // Parse and prefix IDs in underlay to reduce collisions, then embed as nested <svg>.
  const underlayDoc = parseSvg(underlaySvgText);
  const underlayRoot = underlayDoc.documentElement as any as SVGSVGElement;

  const prefix = `ilovesvg-ul-${Math.random().toString(16).slice(2, 10)}`;
  prefixSvgIdsInPlace(underlayRoot, prefix);

  const targetBox = getTargetBox(svg, dims);
  const underlayVb = parseViewBox(underlayRoot.getAttribute("viewBox"));
  const underlayW = parseNumericLen(underlayRoot.getAttribute("width"));
  const underlayH = parseNumericLen(underlayRoot.getAttribute("height"));

  const embedded = svg.ownerDocument!.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  embedded.setAttribute(TOOL_UNDERLAY_ATTR, "1");
  embedded.setAttribute("pointer-events", "none");
  embedded.setAttribute("x", String(targetBox.minX));
  embedded.setAttribute("y", String(targetBox.minY));
  embedded.setAttribute("width", String(targetBox.width));
  embedded.setAttribute("height", String(targetBox.height));
  embedded.setAttribute("preserveAspectRatio", "none");

  if (underlayVb) {
    embedded.setAttribute(
      "viewBox",
      `${underlayVb.minX} ${underlayVb.minY} ${underlayVb.width} ${underlayVb.height}`,
    );
  } else if (
    underlayW != null &&
    underlayH != null &&
    underlayW > 0 &&
    underlayH > 0
  ) {
    embedded.setAttribute("viewBox", `0 0 ${underlayW} ${underlayH}`);
  } else {
    // Fallback: match target viewBox so content that uses percentages has a predictable viewport
    embedded.setAttribute(
      "viewBox",
      `${targetBox.minX} ${targetBox.minY} ${targetBox.width} ${targetBox.height}`,
    );
  }

  // Import underlay children into embedded svg
  const importedChildren = Array.from(underlayRoot.childNodes).map((n) =>
    svg.ownerDocument!.importNode(n, true),
  );
  importedChildren.forEach((n) => embedded.appendChild(n));

  insertNodeAtPosition(svg, embedded, pos);
}

function insertNodeAtPosition(
  svg: SVGSVGElement,
  node: Element,
  pos: "as-first-child" | "after-defs",
) {
  const children = Array.from(svg.children);
  if (pos === "after-defs") {
    const defs = children.find((c) => c.tagName.toLowerCase() === "defs");
    if (defs && defs.nextSibling) {
      svg.insertBefore(node, defs.nextSibling);
    } else if (defs) {
      svg.appendChild(node);
    } else if (svg.firstChild) {
      svg.insertBefore(node, svg.firstChild);
    } else {
      svg.appendChild(node);
    }
  } else {
    if (svg.firstChild) svg.insertBefore(node, svg.firstChild);
    else svg.appendChild(node);
  }
}

/* ========================
   Candidate scoring
======================== */
function findBackgroundRectCandidates(
  svg: SVGSVGElement,
  dims: CanvasDims,
): Array<{ element: SVGRectElement; label: string; score: number }> {
  const children = Array.from(svg.children);
  const interesting = children.filter(
    (el) =>
      !["defs", "title", "desc", "metadata"].includes(el.tagName.toLowerCase()),
  );

  const scanN = Math.min(18, interesting.length);
  const rects: SVGRectElement[] = [];

  for (let i = 0; i < scanN; i++) {
    const el = interesting[i];
    if (el.tagName.toLowerCase() === "rect")
      rects.push(el as any as SVGRectElement);
  }

  const scored = rects
    .map((r, idx) => {
      const score = scoreRectAsBackground(r, dims, idx);
      const w = (r.getAttribute("width") ?? "").trim() || "?";
      const h = (r.getAttribute("height") ?? "").trim() || "?";
      const fill = (r.getAttribute("fill") ?? "").trim() || "(none)";
      const fo = (r.getAttribute("fill-opacity") ?? "").trim();
      const label = `Rect ${idx + 1} (score:${score}, w:${w}, h:${h}, fill:${fill}${fo ? `, op:${fo}` : ""})`;
      return { element: r, label, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

function scoreRectAsBackground(
  rect: SVGRectElement,
  dims: CanvasDims,
  orderIndex: number,
): number {
  let score = 0;

  const fillRaw = (rect.getAttribute("fill") ?? "").trim().toLowerCase();
  const opacityRaw = (rect.getAttribute("fill-opacity") ?? "").trim();
  const style = (rect.getAttribute("style") ?? "").toLowerCase();

  if (fillRaw === "none" || fillRaw === "transparent") return 0;
  if (opacityRaw && Number(opacityRaw) === 0) return 0;
  if (style.includes("fill:none")) return 0;

  const x = (rect.getAttribute("x") ?? "0").trim();
  const y = (rect.getAttribute("y") ?? "0").trim();

  if (x === "" || x === "0" || x === "0%") score += 2;
  if (y === "" || y === "0" || y === "0%") score += 2;

  const w = (rect.getAttribute("width") ?? "").trim();
  const h = (rect.getAttribute("height") ?? "").trim();

  const covers = rectCoversCanvas(w, h, dims);
  if (covers) score += 4;

  if (orderIndex === 0) score += 2;
  if (orderIndex === 1) score += 1;

  const pe = (rect.getAttribute("pointer-events") ?? "").trim().toLowerCase();
  if (pe === "none") score += 1;

  const id = (rect.getAttribute("id") ?? "").toLowerCase();
  const cls = (rect.getAttribute("class") ?? "").toLowerCase();
  if (
    id.includes("bg") ||
    id.includes("background") ||
    cls.includes("bg") ||
    cls.includes("background")
  ) {
    score += 1;
  }

  return score;
}

function rectCoversCanvas(w: string, h: string, dims: CanvasDims): boolean {
  if (!w || !h) return false;

  const wNorm = w.trim();
  const hNorm = h.trim();

  if (wNorm === "100%" && hNorm === "100%") return true;

  if (
    (wNorm === "100%" || wNorm === "100") &&
    (hNorm === "100%" || hNorm === "100")
  )
    return true;

  if (dims.viewBox) {
    const vb = dims.viewBox;
    const wOk = approxLenEquals(wNorm, vb.width) || wNorm === String(vb.width);
    const hOk =
      approxLenEquals(hNorm, vb.height) || hNorm === String(vb.height);
    if (wOk && hOk) return true;
  }

  const rootW = parseNumericLen(dims.widthAttr);
  const rootH = parseNumericLen(dims.heightAttr);
  const rectW = parseNumericLen(wNorm);
  const rectH = parseNumericLen(hNorm);

  if (rootW != null && rootH != null && rectW != null && rectH != null) {
    if (approx(rectW, rootW) && approx(rectH, rootH)) return true;
  }

  if (
    wNorm === "100%" &&
    rectH != null &&
    rootH != null &&
    approx(rectH, rootH)
  )
    return true;
  if (
    hNorm === "100%" &&
    rectW != null &&
    rootW != null &&
    approx(rectW, rootW)
  )
    return true;

  return false;
}

/* ========================
   Underlay ID prefixing
======================== */
function prefixSvgIdsInPlace(svgRoot: SVGSVGElement, prefix: string) {
  const idMap = new Map<string, string>();
  const all = Array.from(svgRoot.querySelectorAll("*"));

  // collect ids
  for (const el of all) {
    const id = el.getAttribute("id");
    if (id) {
      const next = `${prefix}-${id}`;
      idMap.set(id, next);
      el.setAttribute("id", next);
    }
  }

  if (idMap.size === 0) return;

  const replaceInValue = (v: string) => {
    let out = v;
    for (const [oldId, newId] of idMap.entries()) {
      out = out
        .replaceAll(`url(#${oldId})`, `url(#${newId})`)
        .replaceAll(`href="#${oldId}"`, `href="#${newId}"`)
        .replaceAll(`xlink:href="#${oldId}"`, `xlink:href="#${newId}"`);
    }
    return out;
  };

  // attributes
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      const val = attr.value;
      if (!val) continue;
      const next = replaceInValue(val);
      if (next !== val) el.setAttribute(attr.name, next);
    }
  }

  // style blocks (best effort)
  const styleEls = Array.from(svgRoot.querySelectorAll("style"));
  for (const st of styleEls) {
    const txt = st.textContent || "";
    if (!txt) continue;
    let next = txt;
    for (const [oldId, newId] of idMap.entries()) {
      next = next.replaceAll(`url(#${oldId})`, `url(#${newId})`);
    }
    if (next !== txt) st.textContent = next;
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

function getTargetBox(svg: SVGSVGElement, dims: CanvasDims): ViewBox {
  if (dims.viewBox) return dims.viewBox;

  const w = parseNumericLen(dims.widthAttr);
  const h = parseNumericLen(dims.heightAttr);
  if (w != null && h != null && w > 0 && h > 0) {
    return { minX: 0, minY: 0, width: w, height: h };
  }

  // last resort
  return { minX: 0, minY: 0, width: 100, height: 100 };
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
