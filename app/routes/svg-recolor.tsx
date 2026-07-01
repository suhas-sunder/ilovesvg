import * as React from "react";
import type { Route } from "./+types/svg-recolor";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import { ThrottledColorInput } from "~/client/components/ui/ThrottledColorInput";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAdCard } from "~/client/components/ads/ContextualAdCard";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    `SVG Recolor Tool - Replace Fill and Stroke Colors | iLoveSVG`;
  const description =
    `Recolor SVG files in your browser. Extract the color palette, replace fill and stroke colors, convert icons to currentColor, preview, and download the updated SVG.`;
  const canonical = "https://www.ilovesvg.com/svg-recolor";

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
type ApplyTo = "fill" | "stroke" | "both";
type RecolorMode = "replace" | "global" | "currentColor";

type Settings = {
  mode: RecolorMode;
  applyTo: ApplyTo;

  // Global mode
  globalColor: string;

  // Replace mode behavior
  keepNone: boolean; // do not recolor fill="none" or stroke="none"
  keepTransparent: boolean; // do not recolor transparent values
  affectPresentationAttrs: boolean; // fill="", stroke=""
  affectInlineStyle: boolean; // style="fill:...;stroke:..."
  affectStyleTags: boolean; // <style>... fill: #fff ...</style> (best-effort)
  optimizeWhitespace: boolean; // light minify

  // currentColor mode
  setRootColor: boolean; // set svg style color: ...
  rootColor: string;

  // Background (single option for output preview + export)
  backgroundColor: string; // used for output preview and baked export background
  includeBackground: boolean; // if true, bake background rect into output SVG

  // Preview helper
  showChecker: boolean;

  // Output
  fileName: string;
};

type ReplacePair = { id: string; from: string; to: string };

type PaletteItem = {
  value: string; // normalized color token
  count: number;
};

const faq = [
  {
    q: "Will this upload my SVG to a server?",
    a: "No. Recoloring runs in your browser. The SVG text is edited locally and you download the updated file.",
  },
  {
    q: "Do I have to guess the colors?",
    a: "No. The tool extracts the SVG palette automatically and lists each detected color with a count. Click a swatch to create or update a replacement rule.",
  },
  {
    q: "Why does part of my SVG not recolor?",
    a: "Some SVGs define colors in CSS (style tags) or inline style attributes. Enable those toggles under Replace mode. If it uses external CSS classes, currentColor mode is often the cleanest solution.",
  },
  {
    q: "What is currentColor mode used for?",
    a: "It converts icons to inherit CSS color from the parent element. This is ideal for UI icons, hover states, and dark mode.",
  },
  {
    q: "Can I paste SVG code instead of uploading a file?",
    a: "Yes. Paste SVG markup anywhere on the page, or open the paste box and click Apply.",
  },
];

const DEFAULTS: Settings = {
  mode: "replace",
  applyTo: "both",

  globalColor: "#0b2dff",

  keepNone: true,
  keepTransparent: true,
  affectPresentationAttrs: true,
  affectInlineStyle: true,
  affectStyleTags: true,
  optimizeWhitespace: false,

  setRootColor: false,
  rootColor: "#0b2dff",

  backgroundColor: "#ffffff",
  includeBackground: false,

  showChecker: true,

  fileName: "recolored",
};

/* ========================
   Page
======================== */
export default function SvgRecolorPage({}: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [fileName, setFileName] = React.useState<string | null>(null);
  const [inSvg, setInSvg] = React.useState<string>(""); // current input SVG text
  const [outSvg, setOutSvg] = React.useState<string>("");

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const deferredSettings = React.useDeferredValue(settings);

  const [pairs, setPairs] = React.useState<ReplacePair[]>([]);
  const deferredPairs = React.useDeferredValue(pairs);
  const [activePairId, setActivePairId] = React.useState<string | null>(null);

  const [palette, setPalette] = React.useState<PaletteItem[]>([]);

  // Optional paste box
  const [pasteBox, setPasteBox] = React.useState<string>("");
  const [showPasteBox, setShowPasteBox] = React.useState<boolean>(false);

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

  // paste-to-page (if user pastes markup anywhere)
  async function onPaste(e: React.ClipboardEvent) {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const isTypingTarget =
      tag === "textarea" ||
      tag === "input" ||
      (target && (target as any).isContentEditable);

    if (isTypingTarget) return;

    const txt = e.clipboardData.getData("text/plain");
    if (!txt) return;

    const maybe = coerceSvgText(txt);
    if (maybe) {
      e.preventDefault();
      applyInputSvg(maybe, "pasted.svg");
      showToast("SVG pasted");
    }
  }

  function applyInputSvg(svgText: string, name?: string | null) {
    setErr(null);
    setFileName(name || "input.svg");
    setInSvg(ensureSvgHasXmlns(svgText));
  }

  async function handleNewFile(f: File) {
    setErr(null);

    if (!isProbablySvg(f)) {
      setErr("Please upload an SVG file (.svg).");
      return;
    }

    const text = await f.text();
    const coerced = coerceSvgText(text);
    if (!coerced) {
      setErr("That file does not look like a valid SVG.");
      return;
    }

    applyInputSvg(coerced, f.name);
  }

  // ===== Palette extraction whenever input changes
  React.useEffect(() => {
    if (!hydrated || !inSvg) {
      setPalette([]);
      setPairs([]);
      setActivePairId(null);
      return;
    }

    try {
      const found = extractPalette(inSvg, { includeStyleTags: true });
      setPalette(found);

      // If no rules yet, create starter based on most common color
      setPairs((prev) => {
        if (prev.length > 0) return prev;
        if (found.length === 0) return prev;

        const starter: ReplacePair = {
          id: cryptoId(),
          from: found[0].value,
          to: "#0b2dff",
        };
        setActivePairId(starter.id);
        return [starter];
      });

      setErr(null);
    } catch (e: any) {
      setPalette([]);
      setErr(e?.message || "Could not parse SVG.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, inSvg]);

  // ===== Recolor whenever input/settings/pairs change
  React.useEffect(() => {
    if (!hydrated || !inSvg) {
      setOutSvg("");
      return;
    }

    try {
      const result = recolorSvg(inSvg, deferredSettings, deferredPairs);
      React.startTransition(() => {
        setOutSvg(result);
      });
      setErr(null);
    } catch (e: any) {
      React.startTransition(() => {
        setOutSvg("");
        setErr(e?.message || "Could not recolor this SVG.");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, inSvg, deferredSettings, deferredPairs]);

  function setPair(id: string, patch: Partial<ReplacePair>) {
    setPairs((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addPair(from?: string) {
    const p: ReplacePair = {
      id: cryptoId(),
      from: (from || "#000000").toLowerCase(),
      to: "#0b2dff",
    };
    setPairs((prev) => [...prev, p]);
    setActivePairId(p.id);
  }

  function removePair(id: string) {
    setPairs((p) => p.filter((x) => x.id !== id));
    setActivePairId((cur) => (cur === id ? null : cur));
  }

  function usePaletteColorAsFrom(color: string) {
    if (activePairId) setPair(activePairId, { from: color });
    else addPair(color);
  }

  function addRulesForAllPaletteColors() {
    const existingFrom = new Set(
      pairs.map((p) => normalizeColorToken(p.from)).filter(Boolean) as string[],
    );

    const newOnes: ReplacePair[] = [];
    for (const item of palette) {
      const n = normalizeColorToken(item.value);
      if (!n) continue;
      if (existingFrom.has(n)) continue;
      newOnes.push({ id: cryptoId(), from: n, to: "#0b2dff" });
    }

    if (newOnes.length === 0) {
      showToast("No new colors to add");
      return;
    }

    setPairs((p) => [...p, ...newOnes]);
    setActivePairId(newOnes[0].id);
  }

  function setAllToColor(color: string) {
    setPairs((p) => p.map((x) => ({ ...x, to: color })));
  }

  function downloadSvg() {
    if (!hydrated || isServer || !inSvg) return;

    // Regenerate at click time so export cannot be stale.
    let exportSvg = "";
    try {
      exportSvg = recolorSvg(inSvg, settings, pairs);
    } catch (e: any) {
      setErr(e?.message || "Could not recolor this SVG.");
      return;
    }

    if (!exportSvg) return;

    const nameBase = safeBaseName(settings.fileName || "recolored");
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
    if (!hydrated || !inSvg) return;
    try {
      const exportSvg = recolorSvg(inSvg, settings, pairs);
      navigator.clipboard.writeText(exportSvg).then(() => showToast("Copied"));
    } catch (e: any) {
      setErr(e?.message || "Could not recolor this SVG.");
    }
  }

  function copyInputSvg() {
    if (!inSvg) return;
    navigator.clipboard.writeText(inSvg).then(() => showToast("Input copied"));
  }

  function applyPasteBox() {
    const coerced = coerceSvgText(pasteBox);
    if (!coerced) {
      setErr("Paste valid SVG markup (must include an <svg> root).");
      return;
    }
    applyInputSvg(coerced, "pasted.svg");
    showToast("SVG applied");
  }

  const SITE_URL = "https://www.ilovesvg.com";

  const breadcrumbs = [
    { name: "Home", url: `${SITE_URL}/` },
    { name: "SVG Recolor", url: `${SITE_URL}/svg-recolor` },
  ];

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // INPUT preview must remain neutral (never mirror export background)
  const inputPreviewBg = "#ffffff";
  const inputPreviewChecker = settings.showChecker;

  // OUTPUT preview should reflect export background behavior
  const outputPreviewBg = settings.includeBackground
    ? settings.backgroundColor
    : settings.backgroundColor; // still useful as "canvas color" even if not baked
  const outputPreviewChecker =
    settings.showChecker && !settings.includeBackground;

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
            <div className="bg-white sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm overflow-visible min-w-0">
              <div className="flex flex-col items-center justify-between gap-2 mb-3">
                <h1 className="inline-flex mb-1 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                  SVG Recolor
                </h1>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPasteBox((v) => !v)}
                    className="cursor-pointer flex items-center justify-center px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900"
                  >
                    <Icons name="copy" size={16} className="mr-1" />
                    {showPasteBox ? "Hide paste box" : "Paste SVG"}
                  </button>

                  <button
                    type="button"
                    disabled={!inSvg || isServer || !hydrated}
                    onClick={copyInputSvg}
                    className={[
                      "cursor-pointer flex items-center justify-center px-3 py-2 rounded-lg font-semibold border transition-colors",
                      "text-slate-900 bg-white border-slate-200 hover:bg-slate-50",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="copy" size={16} className="mr-1" />
                    Copy input
                  </button>
                </div>
              </div>

              {showPasteBox && (
                <div className="mb-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Paste SVG markup
                  </div>
                  <div className="p-3">
                    <textarea
                      value={pasteBox}
                      onChange={(e) => setPasteBox(e.target.value)}
                      placeholder={`Paste full SVG markup here...\n<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>`}
                      className="w-full h-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={applyPasteBox}
                        className="px-3 py-2 rounded-lg font-bold border transition-colors text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] cursor-pointer"
                      >
                        Apply
                      </button>
                      <span className="text-[13px] text-slate-600">
                        Tip: you can also just paste anywhere on the page.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!inSvg ? (
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
                      onClick={() => {
                        setErr(null);
                        setFileName(null);
                        setInSvg("");
                        setOutSvg("");
                        setPalette([]);
                        setPairs([]);
                        setActivePairId(null);
                        setPasteBox("");
                      }}
                      className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                    >
                      ×
                    </button>
                  </div>

                  {/* Palette */}
                  <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                      Detected palette (click a swatch to set From)
                    </div>
                    <div className="p-3">
                      {palette.length === 0 ? (
                        <div className="text-slate-600 text-sm">
                          No solid colors detected. This SVG may rely on
                          external CSS, gradients, patterns, or filters. Try
                          enabling style-tag editing, or use currentColor mode
                          for icon sets.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            {palette.slice(0, 64).map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => usePaletteColorAsFrom(c.value)}
                                className="group inline-flex items-center gap-2 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                                title={`Use ${c.value} as From (seen ${c.count} times)`}
                              >
                                <span
                                  className="inline-block w-4 h-4 rounded border border-slate-200"
                                  style={{
                                    background: normalizeHexOrFallback(
                                      c.value,
                                      "#ffffff",
                                    ),
                                  }}
                                />
                                <span className="text-[12px] font-mono text-slate-900">
                                  {c.value}
                                </span>
                                <span className="text-[12px] text-slate-500">
                                  {c.count}
                                </span>
                              </button>
                            ))}
                          </div>

                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={addRulesForAllPaletteColors}
                              className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                            >
                              Add rules for all colors
                            </button>

                            <button
                              type="button"
                              onClick={() => setAllToColor("#0b2dff")}
                              className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer"
                            >
                              Set all To to #0b2dff
                            </button>

                            <div className="flex items-center gap-2">
                              <span className="text-[13px] text-slate-600">
                                Set all To:
                              </span>
                              <ThrottledColorInput
                                defaultValue={"#0b2dff"}
                                onCommit={setAllToColor}
                                className="w-12 h-8 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                                title="Set all To to color"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Input preview */}
                  <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                      Input preview
                    </div>
                    <div className="p-3">
                      {inSvg ? (
                        <PreviewFrame
                          svg={inSvg}
                          bg={inputPreviewBg}
                          checker={inputPreviewChecker}
                          alt="Input SVG preview"
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
            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              <h2 className="m-0 mb-3 text-lg text-white font-semibold">
                Recolor Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-visible">
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
                      Settings
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
                      <div className="grid gap-2 min-w-0">
                        <Field label="Mode">
                          <select
                            value={settings.mode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                mode: e.target.value as RecolorMode,
                              }))
                            }
                            className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="replace">
                              Replace specific colors
                            </option>
                            <option value="global">
                              Recolor everything to one color
                            </option>
                            <option value="currentColor">
                              Convert to currentColor (CSS-driven)
                            </option>
                          </select>
                        </Field>

                        <Field label="Apply to">
                          <select
                            value={settings.applyTo}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                applyTo: e.target.value as ApplyTo,
                              }))
                            }
                            className="w-full min-w-0 max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="fill">Fill only</option>
                            <option value="stroke">Stroke only</option>
                            <option value="both">Fill and stroke</option>
                          </select>
                        </Field>

                        {settings.mode === "global" && (
                          <Field label="Global color">
                            <ThrottledColorInput
                              value={settings.globalColor}
                              onCommit={(value) =>
                                setSettings((s) => ({
                                  ...s,
                                  globalColor: value,
                                }))
                              }
                              className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-600">
                              Sets all targeted colors to one value
                            </span>
                          </Field>
                        )}

                        {settings.mode === "replace" && (
                          <>
                            <Field label="Replace rules">
                              <div className="flex flex-col gap-2 w-full min-w-0">
                                {pairs.length === 0 ? (
                                  <div className="text-slate-600 text-sm">
                                    Add a rule by clicking a palette swatch, or
                                    press “Add rule”.
                                  </div>
                                ) : (
                                  pairs.map((p) => {
                                    const selected = p.id === activePairId;
                                    return (
                                      <div
                                        key={p.id}
                                        className={[
                                          "flex items-center gap-2 min-w-0 flex-wrap rounded-lg border p-2",
                                          selected
                                            ? "border-[#0b2dff] bg-[#f3f6ff]"
                                            : "border-slate-200 bg-white",
                                        ].join(" ")}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setActivePairId(p.id)}
                                          className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer transition-colors"
                                          title="Select rule"
                                        >
                                          {selected ? "Selected" : "Select"}
                                        </button>

                                        <span className="text-[12px] text-slate-600">
                                          From
                                        </span>
                                        <input
                                          value={p.from}
                                          onChange={(e) =>
                                            setPair(p.id, {
                                              from: e.target.value,
                                            })
                                          }
                                          className="w-[160px] max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 font-mono text-[12px]"
                                          placeholder="#000000"
                                        />
                                        <ThrottledColorInput
                                          value={normalizeHexOrFallback(
                                            p.from,
                                            "#000000",
                                          )}
                                          onCommit={(value) =>
                                            setPair(p.id, {
                                              from: value,
                                            })
                                          }
                                          className="w-10 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                                          title="Pick From color"
                                        />

                                        <span className="text-[12px] text-slate-600">
                                          To
                                        </span>
                                        <input
                                          value={p.to}
                                          onChange={(e) =>
                                            setPair(p.id, {
                                              to: e.target.value,
                                            })
                                          }
                                          className="w-[160px] max-w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 font-mono text-[12px]"
                                          placeholder="#0b2dff"
                                        />
                                        <ThrottledColorInput
                                          value={normalizeHexOrFallback(
                                            p.to,
                                            "#0b2dff",
                                          )}
                                          onCommit={(value) =>
                                            setPair(p.id, {
                                              to: value,
                                            })
                                          }
                                          className="w-10 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                                          title="Pick To color"
                                        />

                                        <button
                                          type="button"
                                          onClick={() => removePair(p.id)}
                                          className="flex items-center justify-center px-2 py-1 rounded-md border border-slate-200 bg-sky-50 hover:bg-sky-100 text-slate-900 cursor-pointer transition-colors"
                                          title="Remove rule"
                                        >
                                          <Icons
                                            name="trash"
                                            size={16}
                                            className="mr-1"
                                          />
                                          Remove
                                        </button>
                                      </div>
                                    );
                                  })
                                )}

                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => addPair()}
                                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer transition-colors"
                                  >
                                    Add rule
                                  </button>
                                  <span className="text-[13px] text-slate-600">
                                    Tip: click a palette swatch to set “From”.
                                  </span>
                                </div>
                              </div>
                            </Field>

                            <Field label="Safety">
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.keepNone}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        keepNone: e.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                                  />
                                  <span className="text-[13px] text-slate-700">
                                    Preserve none (do not recolor fill="none" or
                                    stroke="none")
                                  </span>
                                </label>

                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.keepTransparent}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        keepTransparent: e.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                                  />
                                  <span className="text-[13px] text-slate-700">
                                    Preserve transparent values
                                  </span>
                                </label>
                              </div>
                            </Field>

                            <Field label="Where to edit">
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.affectPresentationAttrs}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        affectPresentationAttrs:
                                          e.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                                  />
                                  <span className="text-[13px] text-slate-700">
                                    Attributes (fill="", stroke="")
                                  </span>
                                </label>

                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.affectInlineStyle}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        affectInlineStyle: e.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                                  />
                                  <span className="text-[13px] text-slate-700">
                                    Inline style (style="fill: ...")
                                  </span>
                                </label>

                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.affectStyleTags}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        affectStyleTags: e.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                                  />
                                  <span className="text-[13px] text-slate-700">
                                    Style tags (&lt;style&gt;) best-effort
                                  </span>
                                </label>
                              </div>
                            </Field>
                          </>
                        )}

                        {settings.mode === "currentColor" && (
                          <>
                            <Field label="currentColor options">
                              <div className="flex items-center gap-3 flex-wrap">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.setRootColor}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        setRootColor: e.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                                  />
                                  <span className="text-[13px] text-slate-700">
                                    Set root svg style color
                                  </span>
                                </label>

                                <ThrottledColorInput
                                  value={settings.rootColor}
                                  onCommit={(value) =>
                                    setSettings((s) => ({
                                      ...s,
                                      rootColor: value,
                                    }))
                                  }
                                  className={[
                                    "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
                                    settings.setRootColor
                                      ? ""
                                      : "opacity-50 pointer-events-none",
                                  ].join(" ")}
                                />
                              </div>
                            </Field>

                            <div className="text-[13px] text-slate-600">
                              currentColor makes your SVG inherit CSS color.
                              Example: set{" "}
                              <code className="px-1 py-0.5 bg-slate-100 rounded">
                                color: #0b2dff;
                              </code>{" "}
                              on a parent element.
                            </div>
                          </>
                        )}

                        {/* Background controls (single background for output preview + export) */}
                        <Field label="Background">
                          <ThrottledColorInput
                            value={settings.backgroundColor}
                            onCommit={(value) =>
                              setSettings((s) => ({
                                ...s,
                                backgroundColor: value,
                                includeBackground: true,
                              }))
                            }
                            className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                            title="Background color (output preview + export)"
                          />

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={settings.includeBackground}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  includeBackground: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700">
                              Bake into downloaded SVG
                            </span>
                          </label>

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
                              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700">
                              Checkerboard
                            </span>
                          </label>

                          <span className="text-[12px] text-slate-600">
                            Input preview stays neutral. Output preview matches
                            export.
                          </span>
                        </Field>

                        <Field label="Output">
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
                              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700">
                              Minify whitespace (light)
                            </span>
                          </label>
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
                            placeholder="recolored"
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
                    onClick={downloadSvg}
                    disabled={!outSvg || isServer || !hydrated}
                    className={[
                      "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
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
                    disabled={!outSvg || isServer || !hydrated}
                    className={[
                      "flex items-center justify-center px-3.5 py-2 rounded-lg font-semibold border transition-colors cursor-pointer",
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
                  {outSvg ? (
                    <PreviewFrame
                      svg={outSvg}
                      bg={outputPreviewBg}
                      checker={outputPreviewChecker}
                      alt="Recolored SVG preview"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Upload an SVG to see the recolored output preview.
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
          <ContextualAdCard />

          <SeoSections />
        </div>

        <nav
          aria-label="Breadcrumb"
          className="text-[13px] text-slate-600 mb-3"
        >
          <ol className="flex flex-wrap items-center gap-2 max-w-[1180px] mx-auto px-4">
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
    <section className="bg-white border-t mt-6 border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-4 text-slate-900">
        <div>
          <header className="mb-8">
            <h2 className="m-0 text-[26px] font-extrabold tracking-tight">
              SVG Recolor Guide
            </h2>
            <p className="mt-2 text-slate-600 leading-relaxed">
              This page edits the SVG <b>as text</b> in your browser. It
              extracts a palette, applies replacements, and outputs a cleaned
              SVG you can download. Nothing is uploaded to a server.
            </p>

            <p className="mt-2 text-slate-600  mx-auto">
              Upload an SVG or paste SVG markup. This tool extracts the{" "}
              <b>actual palette</b> (fill and stroke), lets you replace specific
              colors, recolor everything to one color, or convert icons to{" "}
              <b>currentColor</b> for CSS theming. Runs client-side.
            </p>
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

          {/* How it works */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="m-0 text-lg font-bold">What gets detected</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">
                The palette is built by parsing the SVG markup and counting
                colors found in common paint locations.
              </p>

              <ul className="mt-3 grid gap-2 text-[14px] text-slate-700">
                <li className="flex gap-2">
                  <span className="mt-[2px] inline-block h-4 w-4 rounded border border-slate-200 bg-white" />
                  <span>
                    Presentation attributes:{" "}
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                      fill=""
                    </code>{" "}
                    and{" "}
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                      stroke=""
                    </code>
                  </span>
                </li>

                <li className="flex gap-2">
                  <span className="mt-[2px] inline-block h-4 w-4 rounded border border-slate-200 bg-white" />
                  <span>
                    Inline style attributes:{" "}
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                      style="fill: …; stroke: …"
                    </code>
                  </span>
                </li>

                <li className="flex gap-2">
                  <span className="mt-[2px] inline-block h-4 w-4 rounded border border-slate-200 bg-white" />
                  <span>
                    Style tags (best effort):{" "}
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                      &lt;style&gt;
                    </code>{" "}
                    rules that set fill or stroke
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="m-0 text-lg font-bold">
                What is skipped (on purpose)
              </h3>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Some SVG paints are references or effects rather than literal
                colors. These don’t behave like solid fills, so the tool avoids
                rewriting them unless you build a dedicated feature for that.
              </p>

              <ul className="mt-3 grid gap-2 text-[14px] text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                  <span>
                    Paint servers like{" "}
                    <code className="px-1 py-0.5 bg-slate-50 border border-slate-200 rounded">
                      url(#gradient)
                    </code>{" "}
                    for gradients, patterns, masks
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                  <span>
                    External CSS (classes that rely on styles outside the SVG)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                  <span>
                    Special cases like filters and complex effects that aren’t
                    simple fill/stroke paints
                  </span>
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700 leading-relaxed">
                If your SVG is mostly CSS-driven, <b>currentColor mode</b> is
                usually the cleanest path.
              </div>
            </div>
          </div>

          {/* Modes */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="m-0 text-lg font-bold">Modes</h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">Replace</span>
                  <span className="text-[12px] text-slate-600">
                    Most common
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-slate-700 leading-relaxed">
                  Builds a mapping from <b>From</b> to <b>To</b> and only
                  rewrites colors that match (after normalization). Great for
                  multi-color SVGs and brand swaps.
                </p>
                <div className="mt-3 text-[13px] text-slate-600">
                  Works on attributes, inline style, and optionally{" "}
                  <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                    &lt;style&gt;
                  </code>
                  .
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">Global</span>
                  <span className="text-[12px] text-slate-600">One color</span>
                </div>
                <p className="mt-2 text-[14px] text-slate-700 leading-relaxed">
                  Forces everything (fill/stroke depending on “Apply to”) to one
                  color. Useful for turning a complex icon into a single-color
                  glyph.
                </p>
                <div className="mt-3 text-[13px] text-slate-600">
                  Respects “preserve none” and “preserve transparent” if
                  enabled.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">currentColor</span>
                  <span className="text-[12px] text-slate-600">
                    CSS theming
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-slate-700 leading-relaxed">
                  Sets targeted paints to{" "}
                  <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                    currentColor
                  </code>{" "}
                  so the icon inherits CSS <code>color</code> from its parent.
                  Ideal for hover states, dark mode, and UI systems.
                </p>
                <div className="mt-3 text-[13px] text-slate-600">
                  Optional: set root{" "}
                  <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">
                    style="color: …"
                  </code>
                  .
                </div>
              </div>
            </div>
          </div>

          <CurrentRouteGuide />

          <section className="mt-12" aria-label="Frequently asked questions">
            <h3 className="m-0 text-xl font-extrabold tracking-tight text-sky-800">
              FAQ
            </h3>
            <div className="mt-4 grid gap-3">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900">
                    <span>{item.q}</span>
                    <span className="select-none text-slate-400 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pt-2 text-[14px] leading-relaxed text-slate-700">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <OtherToolsLinks />
        </div>
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
  svg,
  bg,
  checker,
  alt,
}: {
  svg: string;
  bg: string;
  checker: boolean;
  alt: string;
}) {
  const html = React.useMemo(() => {
    if (!svg) return "";
    return sanitizeSvgForInlinePreview(svg);
  }, [svg]);

  return (
    <div
      className="rounded-xl border border-slate-200 overflow-hidden"
      aria-label={alt}
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
      <div className="w-full" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function sanitizeSvgForInlinePreview(svgText: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return "";

    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return "";

    // Remove scripts
    doc.querySelectorAll("script").forEach((n) => n.remove());

    // Remove event handler attrs and javascript: urls
    const all = Array.from(svg.querySelectorAll("*"));
    for (const el of all) {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = (attr.value || "").trim().toLowerCase();

        if (name.startsWith("on")) el.removeAttribute(attr.name);

        if (
          (name === "href" || name === "xlink:href") &&
          val.startsWith("javascript:")
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }

    // Ensure xmlns
    if (!svg.getAttribute("xmlns")) {
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    // Make it responsive in the preview
    const prevStyle = svg.getAttribute("style") || "";
    const style = `${prevStyle};width:100%;height:auto;display:block;`.trim();
    svg.setAttribute("style", style);

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
}

/* ========================
   Palette extraction
======================== */
function extractPalette(
  svgText: string,
  opts: { includeStyleTags: boolean },
): PaletteItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("Invalid SVG markup.");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG root element.");
  }

  const counts = new Map<string, number>();

  const all = Array.from(svg.querySelectorAll("*"));
  for (const el of all) {
    bump(el.getAttribute("fill"));
    bump(el.getAttribute("stroke"));

    const style = el.getAttribute("style");
    if (style) {
      bump(getCssProp(style, "fill"));
      bump(getCssProp(style, "stroke"));
    }
  }

  if (opts.includeStyleTags) {
    const styleTags = Array.from(doc.getElementsByTagName("style"));
    for (const tag of styleTags) {
      const css = tag.textContent || "";
      const tokens = extractColorTokensFromCss(css);
      for (const t of tokens) bump(t);
    }
  }

  function bump(v: string | null | undefined) {
    if (!v) return;
    const raw = v.trim();
    if (!raw) return;
    if (/^url\(/i.test(raw)) return;

    const n = normalizeColorToken(raw);
    if (!n) return;

    if (isNone(n) || isTransparent(n) || n === "currentcolor") return;

    counts.set(n, (counts.get(n) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

function extractColorTokensFromCss(css: string): string[] {
  const out: string[] = [];

  out.push(...(css.match(/#[0-9a-fA-F]{3,8}\b/g) || []));

  out.push(
    ...(css.match(
      /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)/gi,
    ) || []),
  );

  out.push(
    ...(css.match(
      /hsla?\(\s*[\d.]+\s*(?:deg|rad|turn)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\)/gi,
    ) || []),
  );

  out.push(...(css.match(/\b(black|white|transparent)\b/gi) || []));

  return out;
}

/* ========================
   Recolor engine
======================== */
function recolorSvg(input: string, s: Settings, pairs: ReplacePair[]): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "image/svg+xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("Invalid SVG markup.");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG root element.");
  }

  // Ensure xmlns (important for downstream rendering)
  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const replaceMap = new Map<string, string>();
  if (s.mode === "replace") {
    for (const p of pairs) {
      const from = normalizeColorToken(p.from);
      const to = normalizeColorToken(p.to);
      if (from && to) replaceMap.set(from, to);
    }
  }

  if (s.affectStyleTags && (s.mode === "replace" || s.mode === "global")) {
    const styleTags = Array.from(doc.getElementsByTagName("style"));
    for (const tag of styleTags) {
      const css = tag.textContent || "";
      const next = recolorCssText(css, s, replaceMap);
      if (next !== css) tag.textContent = next;
    }
  }

  const all = Array.from(svg.querySelectorAll("*"));

  for (const el of all) {
    if (s.mode === "currentColor") {
      applyCurrentColor(el, s);
      continue;
    }

    if (s.affectPresentationAttrs) {
      if (s.applyTo === "fill" || s.applyTo === "both") {
        const v = el.getAttribute("fill");
        if (v != null) {
          el.setAttribute("fill", recolorColorValue(v, s, replaceMap) ?? v);
        }
      }
      if (s.applyTo === "stroke" || s.applyTo === "both") {
        const v = el.getAttribute("stroke");
        if (v != null) {
          el.setAttribute("stroke", recolorColorValue(v, s, replaceMap) ?? v);
        }
      }
    }

    if (s.affectInlineStyle) {
      const style = el.getAttribute("style");
      if (style) {
        let next = style;
        if (s.applyTo === "fill" || s.applyTo === "both") {
          next = replaceCssColorProp(next, "fill", (val) =>
            recolorColorValue(val, s, replaceMap),
          );
        }
        if (s.applyTo === "stroke" || s.applyTo === "both") {
          next = replaceCssColorProp(next, "stroke", (val) =>
            recolorColorValue(val, s, replaceMap),
          );
        }
        next = next.trim();
        if (next) el.setAttribute("style", next);
        else el.removeAttribute("style");
      }
    }
  }

  if (s.mode === "currentColor" && s.setRootColor) {
    const prev = svg.getAttribute("style") || "";
    const withColor = setCssProp(prev, "color", s.rootColor);
    svg.setAttribute("style", withColor);
  }

  // Background bake
  if (s.includeBackground) {
    bakeBackgroundRect(svg, s.backgroundColor);
  } else {
    const existing = svg.querySelector(':scope > rect[data-ilovesvg-bg="1"]');
    if (existing) existing.remove();
  }

  const out = new XMLSerializer().serializeToString(doc);
  return s.optimizeWhitespace ? lightMinify(out) : out;
}

function bakeBackgroundRect(svg: Element, color: string) {
  const doc = svg.ownerDocument;
  if (!doc) return;

  const existing = svg.querySelector(':scope > rect[data-ilovesvg-bg="1"]');
  if (existing) existing.remove();

  const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("data-ilovesvg-bg", "1");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", normalizeHexOrFallback(color, "#ffffff"));

  const kids = Array.from(svg.childNodes);
  const insertBefore = kids.find((n) => {
    if (n.nodeType !== 1) return false;
    const name = (n as Element).nodeName.toLowerCase();
    return !["defs", "metadata", "title", "desc"].includes(name);
  }) as ChildNode | undefined;

  if (insertBefore) svg.insertBefore(rect, insertBefore);
  else svg.insertBefore(rect, svg.firstChild);
}

function applyCurrentColor(el: Element, s: Settings) {
  const keepNone = s.keepNone;

  if (s.applyTo === "fill" || s.applyTo === "both") {
    const fill = el.getAttribute("fill");
    if (fill != null) {
      if (!(keepNone && isNone(fill))) el.setAttribute("fill", "currentColor");
    }
  }
  if (s.applyTo === "stroke" || s.applyTo === "both") {
    const stroke = el.getAttribute("stroke");
    if (stroke != null) {
      if (!(keepNone && isNone(stroke)))
        el.setAttribute("stroke", "currentColor");
    }
  }

  const style = el.getAttribute("style");
  if (!style) return;

  let next = style;
  if (s.applyTo === "fill" || s.applyTo === "both") {
    next = setCssProp(next, "fill", "currentColor", { respectNone: keepNone });
  }
  if (s.applyTo === "stroke" || s.applyTo === "both") {
    next = setCssProp(next, "stroke", "currentColor", {
      respectNone: keepNone,
    });
  }

  next = next.trim();
  if (next) el.setAttribute("style", next);
  else el.removeAttribute("style");
}

function recolorCssText(css: string, s: Settings, map: Map<string, string>) {
  let out = css;
  if (s.applyTo === "fill" || s.applyTo === "both") {
    out = replaceCssColorProp(out, "fill", (val) =>
      recolorColorValue(val, s, map),
    );
  }
  if (s.applyTo === "stroke" || s.applyTo === "both") {
    out = replaceCssColorProp(out, "stroke", (val) =>
      recolorColorValue(val, s, map),
    );
  }
  return out;
}

function recolorColorValue(
  raw: string,
  s: Settings,
  map: Map<string, string>,
): string | null {
  const v = raw.trim();
  if (!v) return v;

  if (s.keepNone && isNone(v)) return v;
  if (s.keepTransparent && isTransparent(v)) return v;

  if (/^url\(/i.test(v)) return v;

  if (s.mode === "global") {
    return s.globalColor;
  }

  if (s.mode === "replace") {
    const n = normalizeColorToken(v);
    if (!n) return v;
    const hit = map.get(n);
    return hit ? hit : v;
  }

  return v;
}

/* ========================
   CSS utilities
======================== */
function replaceCssColorProp(
  cssText: string,
  prop: string,
  replacer: (val: string) => string | null,
) {
  const re = new RegExp(
    `(^|[;\\s])(${escapeReg(prop)})\\s*:\\s*([^;]+)(;|$)`,
    "gi",
  );
  return cssText.replace(re, (m, pre, p, val, post) => {
    const next = replacer(String(val).trim());
    if (next == null) return `${pre}${p}:${val}${post}`;
    return `${pre}${p}:${next}${post}`;
  });
}

function getCssProp(style: string, prop: string): string | null {
  const re = new RegExp(`(^|;)\\s*${escapeReg(prop)}\\s*:\\s*([^;]+)`, "i");
  const m = style.match(re);
  return m ? m[2].trim() : null;
}

function setCssProp(
  style: string,
  prop: string,
  value: string,
  opts?: { respectNone?: boolean },
): string {
  const cur = getCssProp(style, prop);
  if (opts?.respectNone && cur && isNone(cur)) return style;

  const re = new RegExp(`(^|;)\\s*${escapeReg(prop)}\\s*:\\s*([^;]+)`, "i");
  if (re.test(style)) {
    return style.replace(re, (_m, pre) => `${pre} ${prop}: ${value}`);
  }

  const trimmed = style.trim();
  const sep = trimmed && !trimmed.endsWith(";") ? ";" : "";
  return `${trimmed}${sep} ${prop}: ${value};`.trim();
}

/* ========================
   Color normalization
======================== */
function normalizeColorToken(token: string): string | null {
  const raw = token.trim();
  if (!raw) return null;

  const v = raw.toLowerCase();

  if (/^url\(/i.test(v)) return v;

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

  const hsl = v.match(
    /^hsla?\(\s*([0-9.]+)\s*(?:deg|rad|turn)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%(?:\s*,\s*([0-9.]+))?\s*\)$/i,
  );
  if (hsl) {
    const hh = Number(hsl[1]);
    const ss = Number(hsl[2]) / 100;
    const ll = Number(hsl[3]) / 100;
    const { r, g, b } = hslToRgb(hh, ss, ll);
    return toHex(r, g, b);
  }

  if (v === "white") return "#ffffff";
  if (v === "black") return "#000000";
  if (v === "transparent") return "transparent";
  if (v === "none") return "none";
  if (v === "currentcolor") return "currentcolor";

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

function normalizeHexOrFallback(v: string, fallback: string) {
  const n = normalizeColorToken(v);
  if (n && /^#[0-9a-f]{6}$/.test(n)) return n;
  return fallback;
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

function isNone(v: string) {
  return v.trim().toLowerCase() === "none";
}
function isTransparent(v: string) {
  const t = v.trim().toLowerCase();
  if (t === "transparent") return true;
  if (t === "#0000") return true;
  if (/^#[0-9a-f]{8}$/.test(t) && t.endsWith("00")) return true;
  return /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0+)?\s*\)$/i.test(t);
}

function hslToRgb(h: number, s: number, l: number) {
  let hh = ((h % 360) + 360) % 360;
  hh /= 360;

  if (s === 0) {
    const v = clamp255(l * 255);
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const tc = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  const r = clamp255(tc(hh + 1 / 3) * 255);
  const g = clamp255(tc(hh) * 255);
  const b = clamp255(tc(hh - 1 / 3) * 255);

  return { r, g, b };
}

/* ========================
   Input helpers
======================== */
function isProbablySvg(file: File) {
  const nameOk = /\.svg$/i.test(file.name || "");
  const type = (file.type || "").toLowerCase();

  const typeOk =
    type.includes("svg") ||
    type.includes("xml") ||
    type === "" ||
    type === "text/plain" ||
    type === "application/octet-stream";

  return nameOk || typeOk;
}

function ensureSvgHasXmlns(svgText: string) {
  const t = (svgText || "").trim();
  if (!t) return t;
  const idx = t.toLowerCase().indexOf("<svg");
  if (idx < 0) return t;

  const openTag = t.slice(idx).match(/<svg\b[^>]*>/i)?.[0];
  if (!openTag) return t;

  const hasXmlns = /\sxmlns\s*=\s*["'][^"']+["']/i.test(openTag);
  if (hasXmlns) return t;

  return t.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function coerceSvgText(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;

  const noBom = t.replace(/^\uFEFF/, "");
  const idx = noBom.toLowerCase().indexOf("<svg");
  if (idx < 0) return null;

  const sliced = noBom.slice(idx);

  if (!/<\/svg\s*>/i.test(sliced)) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sliced, "image/svg+xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) return null;
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") return null;
  } catch {
    return null;
  }

  return sliced.trim();
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

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cryptoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random();
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
