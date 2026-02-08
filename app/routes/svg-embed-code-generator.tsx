import * as React from "react";
import type { Route } from "./+types/svg-embed-code-generator";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | SVG Embed Code Generator (IMG, Inline, CSS, React)";
  const description =
    "Generate SVG embed code instantly in your browser with iLoveSVG. Create HTML <img>, inline SVG, CSS background or mask, Data URI (UTF-8 or Base64), React/JSX, and <object> or <iframe> snippets. Control sizing and accessibility. Free, client-side only, no uploads.";
  const canonical = "https://www.ilovesvg.com/svg-embed-code-generator";

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
type EmbedKind =
  | "img"
  | "inline"
  | "object"
  | "iframe"
  | "css-bg"
  | "css-mask"
  | "data-uri-base64"
  | "data-uri-utf8"
  | "react-jsx"
  | "react-component";

type EmbedSourceMode = "file-url" | "data-uri";
type QuoteMode = "double" | "single";
type CssProp = "background-image" | "mask-image";
type DataUriCharset = "utf8" | "base64";

type Settings = {
  embedKind: EmbedKind;

  // NEW: controls whether file-based embeds use URL or embed as data URI
  embedSource: EmbedSourceMode;

  // sizing
  width: number;
  height: number;
  unit: "px" | "em" | "rem" | "%" | "vh" | "vw";
  useWidth: boolean;
  useHeight: boolean;
  preserveAspectRatio: "xMidYMid meet" | "xMidYMid slice" | "none";
  addViewBoxIfMissing: boolean;

  // accessibility
  altText: string;
  titleText: string;
  addTitleTagInline: boolean;
  ariaHidden: boolean;
  roleImg: boolean;
  focusableFalse: boolean;

  // output formatting
  quoteMode: QuoteMode;
  indent: "2" | "4" | "tab";
  minifySvg: boolean;
  prettySvg: boolean;

  // sanitization
  sanitize: boolean;
  stripScripts: boolean;
  stripEventHandlers: boolean;
  stripForeignObject: boolean;
  stripJavascriptHrefs: boolean;

  // file / urls
  fileName: string;
  assetUrl: string; // for <img>/<object>/<iframe> snippet
  objectType: "image/svg+xml" | "";
  iframeSandbox: boolean;
  iframeSandboxValue: string;

  // css options
  cssProp: CssProp; // kept for compatibility/future use
  cssSelector: string;
  cssSizeMode: "contain" | "cover" | "auto";
  cssRepeat: "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
  cssPosition: "center" | "top" | "bottom" | "left" | "right" | "custom";
  cssPositionCustom: string;
  cssIncludeDisplayBlock: boolean;

  // data uri options
  dataUriCharset: DataUriCharset;
  includeUtf8Charset: boolean;

  // react options
  reactComponentName: string;
  reactUseCurrentColor: boolean;
  reactForwardProps: boolean;
  reactJsxWrap: boolean;

  // preview behavior (kept and now applies to INPUT preview)
  previewUseLocalBlobForFileEmbeds: boolean;
  previewBackground: "grid" | "plain";
};

type SvgInfo = {
  bytes: number;
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  hasScripts?: boolean;
  hasForeignObject?: boolean;
  width?: number;
  height?: number;
};

const DEFAULTS: Settings = {
  embedKind: "img",
  embedSource: "file-url",

  width: 128,
  height: 128,
  unit: "px",
  useWidth: true,
  useHeight: true,
  preserveAspectRatio: "xMidYMid meet",
  addViewBoxIfMissing: true,

  altText: "Icon",
  titleText: "",
  addTitleTagInline: false,
  ariaHidden: false,
  roleImg: false,
  focusableFalse: true,

  quoteMode: "double",
  indent: "2",
  minifySvg: false,
  prettySvg: true,

  sanitize: true,
  stripScripts: true,
  stripEventHandlers: true,
  stripForeignObject: false,
  stripJavascriptHrefs: true,

  fileName: "icon",
  assetUrl: "/icons/icon.svg",
  objectType: "image/svg+xml",
  iframeSandbox: true,
  iframeSandboxValue: "allow-scripts allow-same-origin",

  cssProp: "background-image",
  cssSelector: ".icon",
  cssSizeMode: "contain",
  cssRepeat: "no-repeat",
  cssPosition: "center",
  cssPositionCustom: "center center",
  cssIncludeDisplayBlock: true,

  dataUriCharset: "utf8",
  includeUtf8Charset: true,

  reactComponentName: "Icon",
  reactUseCurrentColor: false,
  reactForwardProps: true,
  reactJsxWrap: true,

  previewUseLocalBlobForFileEmbeds: true,
  previewBackground: "grid",
};

/* ========================
   Page
======================== */
export default function SvgEmbedCodeGenerator(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [outCode, setOutCode] = React.useState<string>("");

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
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

    const baseName = stripExt(f.name) || "icon";
    setSettings((s) => ({
      ...s,
      fileName: baseName,
      assetUrl: `/icons/${safeFileName(baseName)}.svg`,
      width: clampInt(Math.round(parsed.width ?? 128), 1, 100000),
      height: clampInt(Math.round(parsed.height ?? 128), 1, 100000),
    }));

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml" }),
    );
    setPreviewUrl(url);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setSvgText("");
    setInfo(null);
    setPreviewUrl(null);
    setErr(null);
    setOutCode("");
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="48" fill="#0b2dff"/><path d="M42 66h44" stroke="#fff" stroke-width="12" stroke-linecap="round"/></svg>`;
    setFile(null);
    setErr(null);
    setSvgText(example);
    setInfo(parseSvgInfo(example));
    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml" }),
      );
    });
    setSettings((s) => ({
      ...s,
      fileName: "icon",
      assetUrl: "/icons/icon.svg",
      width: 128,
      height: 128,
    }));
    showToast("Example loaded");
  }

  function copyCode() {
    if (!outCode) return;
    navigator.clipboard.writeText(outCode).then(() => showToast("Copied"));
  }

  function downloadSnippet() {
    if (!outCode) return;
    const name = (settings.fileName || "snippet").trim() || "snippet";
    const ext = guessSnippetExt(settings.embedKind);
    const filename = `${safeFileName(name)}.${ext}`;
    downloadText(outCode, filename);
    showToast("Downloaded");
  }

  React.useEffect(() => {
    if (!svgText.trim()) {
      setOutCode("");
      setErr(null);
      return;
    }

    setErr(null);
    try {
      const prepared = prepareSvg(svgText, settings);
      const { code } = generateEmbed(prepared, settings);
      setOutCode(code);
      setInfo(parseSvgInfo(prepared));
    } catch (e: any) {
      setErr(e?.message || "Generate failed.");
      setOutCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, settings]);

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Embed Code Generator", href: "/svg-embed-code-generator" },
  ];

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const inputPreviewBgClass =
    settings.previewBackground === "grid"
      ? "bg-[linear-gradient(0deg,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:16px_16px]"
      : "bg-white";

  const inputPreviewSrc =
    previewUrl && settings.previewUseLocalBlobForFileEmbeds
      ? previewUrl
      : (settings.assetUrl || "").trim()
        ? settings.assetUrl.trim()
        : previewUrl;

  const embedKindPills: Array<{ kind: EmbedKind; label: string }> = [
    { kind: "img", label: "HTML img" },
    { kind: "inline", label: "Inline SVG" },
    { kind: "css-bg", label: "CSS bg" },
    { kind: "css-mask", label: "CSS mask" },
    { kind: "data-uri-utf8", label: "Data URI" },
    { kind: "react-jsx", label: "React/JSX" },
  ];

  return (
    <>
      <main className="bg-slate-50 text-slate-900" onPaste={onPaste}>
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
                <h1 className="inline-flex mb-1 text-sky-800 text-center items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                  SVG Embed Code Generator
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadExample}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                  >
                    <Icons name="example" size={16} className="mr-1" />
                    Load example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer"
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
                        aria-label="Clear"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </>
              )}

              {inputPreviewSrc && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Input preview
                  </div>
                  <div className={`p-3 ${inputPreviewBgClass}`}>
                    <img
                      src={inputPreviewSrc}
                      alt="Input SVG"
                      className="w-full h-auto block"
                    />
                  </div>
                  {!settings.previewUseLocalBlobForFileEmbeds && (
                    <div className="px-3 pb-3 text-[12px] text-slate-600">
                      Showing File URL (snippet). If this path is not served,
                      the preview can be broken even though your SVG is valid.
                    </div>
                  )}
                </div>
              )}

              {info && (
                <div className="mt-3 text-[13px] text-slate-700">
                  Detected:{" "}
                  <b>
                    {info.widthRaw || "?"} × {info.heightRaw || "?"}
                  </b>
                  {info.viewBox ? (
                    <span className="text-slate-500">
                      {" "}
                      • viewBox {info.viewBox}
                    </span>
                  ) : null}
                </div>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-slate-800 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-auto">
              <h2 className="m-0 font-bold mb-3 text-lg text-white">
                Embed Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                {/* Quick embed type pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {embedKindPills.map((p) => (
                    <button
                      key={p.kind}
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          embedKind: p.kind,
                        }))
                      }
                      className={[
                        "px-3 py-1 rounded-full border text-[12px] font-semibold cursor-pointer transition-colors",
                        settings.embedKind === p.kind
                          ? "bg-[#eff4ff] border-[#d6e4ff] text-slate-900 hover:bg-[#e5eeff]"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                      aria-pressed={settings.embedKind === p.kind}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Advanced settings disclosure */}
                <div className="mt-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="mb-2 w-full inline-flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                    aria-expanded={showAdvanced}
                    aria-controls="advanced-settings"
                  >
                    <span className="inline-flex items-center justify-center">
                      <Icons
                        name="settings"
                        size={16}
                        className="mr-1 text-slate-500"
                      />
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
                      <Field label="Embed type">
                        <select
                          value={settings.embedKind}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              embedKind: e.target.value as EmbedKind,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                        >
                          <option value="img">
                            HTML &lt;img&gt; (file URL or data URI)
                          </option>
                          <option value="inline">
                            Inline SVG (paste &lt;svg&gt;)
                          </option>
                          <option value="object">
                            &lt;object&gt; (file URL or data URI)
                          </option>
                          <option value="iframe">
                            &lt;iframe&gt; (file URL or data URI)
                          </option>
                          <option value="css-bg">
                            CSS background-image (Data URI)
                          </option>
                          <option value="css-mask">
                            CSS mask-image (Data URI)
                          </option>
                          <option value="data-uri-utf8">
                            Data URI (UTF-8)
                          </option>
                          <option value="data-uri-base64">
                            Data URI (Base64)
                          </option>
                          <option value="react-jsx">React/JSX</option>
                          <option value="react-component">
                            React component (TSX)
                          </option>
                        </select>
                      </Field>

                      {(settings.embedKind === "img" ||
                        settings.embedKind === "object" ||
                        settings.embedKind === "iframe") && (
                        <Field label="Embed source">
                          <select
                            value={settings.embedSource}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                embedSource: e.target.value as EmbedSourceMode,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                          >
                            <option value="file-url">File URL</option>
                            <option value="data-uri">
                              Data URI (embed SVG)
                            </option>
                          </select>
                        </Field>
                      )}

                      {(settings.embedKind === "img" ||
                        settings.embedKind === "object" ||
                        settings.embedKind === "iframe") &&
                        settings.embedSource === "file-url" && (
                          <Field label="File URL (snippet)">
                            <input
                              value={settings.assetUrl}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  assetUrl: e.target.value,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                              placeholder="/icons/icon.svg"
                            />
                          </Field>
                        )}

                      {(settings.embedKind === "img" ||
                        settings.embedKind === "inline" ||
                        settings.embedKind === "react-jsx" ||
                        settings.embedKind === "react-component" ||
                        settings.embedKind === "object" ||
                        settings.embedKind === "iframe") && (
                        <>
                          <Field label="Width">
                            <NumInt
                              value={settings.width}
                              min={1}
                              max={100000}
                              step={1}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  width: clampInt(v, 1, 100000),
                                }))
                              }
                            />
                            <UnitSelect
                              value={settings.unit}
                              onChange={(u) =>
                                setSettings((s) => ({ ...s, unit: u }))
                              }
                            />
                            <TogglePill
                              checked={settings.useWidth}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, useWidth: v }))
                              }
                              label="Use"
                            />
                          </Field>

                          <Field label="Height">
                            <NumInt
                              value={settings.height}
                              min={1}
                              max={100000}
                              step={1}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  height: clampInt(v, 1, 100000),
                                }))
                              }
                            />
                            <UnitSelect
                              value={settings.unit}
                              onChange={(u) =>
                                setSettings((s) => ({ ...s, unit: u }))
                              }
                            />
                            <TogglePill
                              checked={settings.useHeight}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, useHeight: v }))
                              }
                              label="Use"
                            />
                          </Field>

                          <Field label="preserveAspectRatio">
                            <select
                              value={settings.preserveAspectRatio}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  preserveAspectRatio: e.target.value as any,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                            >
                              <option value="xMidYMid meet">
                                xMidYMid meet
                              </option>
                              <option value="xMidYMid slice">
                                xMidYMid slice
                              </option>
                              <option value="none">none</option>
                            </select>
                          </Field>

                          <Field label="Add viewBox">
                            <input
                              type="checkbox"
                              checked={settings.addViewBoxIfMissing}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  addViewBoxIfMissing: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700 min-w-0">
                              If missing, set viewBox to 0 0 width height
                            </span>
                          </Field>
                        </>
                      )}

                      <Field label="Accessibility">
                        <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                          <label className="flex items-center gap-2 min-w-0">
                            <span className="text-[12px] text-slate-600 min-w-[70px]">
                              Alt
                            </span>
                            <input
                              value={settings.altText}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  altText: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                              placeholder="Icon"
                            />
                          </label>

                          <label className="flex items-center gap-2 min-w-0">
                            <span className="text-[12px] text-slate-600 min-w-[70px]">
                              Title
                            </span>
                            <input
                              value={settings.titleText}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  titleText: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                              placeholder="Optional"
                            />
                          </label>

                          <ToggleRow
                            checked={settings.addTitleTagInline}
                            onChange={(v) =>
                              setSettings((s) => ({
                                ...s,
                                addTitleTagInline: v,
                              }))
                            }
                            label="Add <title> inside inline SVG/JSX"
                          />
                          <ToggleRow
                            checked={settings.ariaHidden}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, ariaHidden: v }))
                            }
                            label='aria-hidden="true" (decorative)'
                          />
                        </div>
                      </Field>

                      {shouldShowDataUriControls(settings) && (
                        <>
                          <Field label="Data URI encoding">
                            <select
                              value={settings.dataUriCharset}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  dataUriCharset: e.target
                                    .value as DataUriCharset,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                            >
                              <option value="utf8">
                                UTF-8 (percent-encoded)
                              </option>
                              <option value="base64">Base64</option>
                            </select>
                          </Field>

                          {settings.dataUriCharset === "utf8" && (
                            <Field label="UTF-8 header">
                              <input
                                type="checkbox"
                                checked={settings.includeUtf8Charset}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    includeUtf8Charset: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                              />
                              <span className="text-[13px] text-slate-700 min-w-0">
                                Include charset=utf-8
                              </span>
                            </Field>
                          )}
                        </>
                      )}

                      {(settings.embedKind === "css-bg" ||
                        settings.embedKind === "css-mask") && (
                        <>
                          <Field label="CSS selector">
                            <input
                              value={settings.cssSelector}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  cssSelector: e.target.value,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                              placeholder=".icon"
                            />
                          </Field>

                          <Field label="CSS sizing">
                            <select
                              value={settings.cssSizeMode}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  cssSizeMode: e.target.value as any,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                            >
                              <option value="contain">contain</option>
                              <option value="cover">cover</option>
                              <option value="auto">auto</option>
                            </select>

                            <select
                              value={settings.cssRepeat}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  cssRepeat: e.target.value as any,
                                }))
                              }
                              className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                            >
                              <option value="no-repeat">no-repeat</option>
                              <option value="repeat">repeat</option>
                              <option value="repeat-x">repeat-x</option>
                              <option value="repeat-y">repeat-y</option>
                            </select>
                          </Field>

                          <Field label="CSS position">
                            <select
                              value={settings.cssPosition}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  cssPosition: e.target.value as any,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                            >
                              <option value="center">center</option>
                              <option value="top">top</option>
                              <option value="bottom">bottom</option>
                              <option value="left">left</option>
                              <option value="right">right</option>
                              <option value="custom">custom</option>
                            </select>

                            {settings.cssPosition === "custom" && (
                              <input
                                value={settings.cssPositionCustom}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    cssPositionCustom: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                placeholder="center center"
                              />
                            )}
                          </Field>

                          <Field label="CSS extras">
                            <div className="flex flex-col gap-2 w-full min-w-0">
                              <ToggleRow
                                checked={settings.cssIncludeDisplayBlock}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    cssIncludeDisplayBlock: v,
                                  }))
                                }
                                label="Include display:block for predictable sizing"
                              />
                            </div>
                          </Field>
                        </>
                      )}

                      {(settings.embedKind === "iframe" ||
                        settings.embedKind === "object") && (
                        <>
                          {settings.embedKind === "object" && (
                            <Field label="object type">
                              <select
                                value={settings.objectType}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    objectType: e.target.value as any,
                                  }))
                                }
                                className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 truncate"
                              >
                                <option value="image/svg+xml">
                                  image/svg+xml
                                </option>
                                <option value="">(omit)</option>
                              </select>
                            </Field>
                          )}

                          {settings.embedKind === "iframe" && (
                            <>
                              <Field label="iframe sandbox">
                                <input
                                  type="checkbox"
                                  checked={settings.iframeSandbox}
                                  onChange={(e) =>
                                    setSettings((s) => ({
                                      ...s,
                                      iframeSandbox: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                                />
                                <span className="text-[13px] text-slate-700 min-w-0">
                                  Include sandbox attribute
                                </span>
                              </Field>

                              {settings.iframeSandbox && (
                                <Field label="sandbox value">
                                  <input
                                    value={settings.iframeSandboxValue}
                                    onChange={(e) =>
                                      setSettings((s) => ({
                                        ...s,
                                        iframeSandboxValue: e.target.value,
                                      }))
                                    }
                                    className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                  />
                                </Field>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {(settings.embedKind === "react-jsx" ||
                        settings.embedKind === "react-component") && (
                        <>
                          <Field label="Component name">
                            <input
                              value={settings.reactComponentName}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  reactComponentName: sanitizeJsIdentifier(
                                    e.target.value,
                                  ),
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                              placeholder="Icon"
                            />
                          </Field>

                          <Field label="React options">
                            <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                              <ToggleRow
                                checked={settings.reactForwardProps}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    reactForwardProps: v,
                                  }))
                                }
                                label="Forward props (className, style, etc.)"
                              />
                              <ToggleRow
                                checked={settings.reactUseCurrentColor}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    reactUseCurrentColor: v,
                                  }))
                                }
                                label="Replace fills/strokes with currentColor (best-effort)"
                              />
                              {settings.embedKind === "react-jsx" && (
                                <ToggleRow
                                  checked={settings.reactJsxWrap}
                                  onChange={(v) =>
                                    setSettings((s) => ({
                                      ...s,
                                      reactJsxWrap: v,
                                    }))
                                  }
                                  label="Wrap as a component snippet"
                                />
                              )}
                            </div>
                          </Field>
                        </>
                      )}

                      <Field label="Cleanup">
                        <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                          <ToggleRow
                            checked={settings.sanitize}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, sanitize: v }))
                            }
                            label="Sanitize SVG (recommended)"
                          />
                          {settings.sanitize && (
                            <div className="pl-6 flex flex-col gap-2">
                              <ToggleRow
                                checked={settings.stripScripts}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripScripts: v,
                                  }))
                                }
                                label="Strip <script>"
                              />
                              <ToggleRow
                                checked={settings.stripEventHandlers}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripEventHandlers: v,
                                  }))
                                }
                                label="Strip on* handlers"
                              />
                              <ToggleRow
                                checked={settings.stripJavascriptHrefs}
                                onChange={(v) =>
                                  setSettings((s) => ({
                                    ...s,
                                    stripJavascriptHrefs: v,
                                  }))
                                }
                                label="Strip javascript: hrefs"
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
                            </div>
                          )}

                          <ToggleRow
                            checked={settings.minifySvg}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, minifySvg: v }))
                            }
                            label="Minify SVG output (light)"
                          />
                          <ToggleRow
                            checked={settings.prettySvg}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, prettySvg: v }))
                            }
                            label="Pretty format SVG (best-effort)"
                          />
                        </div>
                      </Field>

                      <Field label="Indent / quotes">
                        <select
                          value={settings.indent}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              indent: e.target.value as any,
                            }))
                          }
                          className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                        >
                          <option value="2">2 spaces</option>
                          <option value="4">4 spaces</option>
                          <option value="tab">Tabs</option>
                        </select>
                        <select
                          value={settings.quoteMode}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              quoteMode: e.target.value as any,
                            }))
                          }
                          className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                        >
                          <option value="double">"</option>
                          <option value="single">'</option>
                        </select>
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
                          placeholder="icon"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                {/* Actions stay outside advanced panel */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={copyCode}
                    disabled={!hydrated || !outCode}
                    className={[
                      "inline-flex items-center justify-center px-3.5 py-2 rounded-xl font-bold border transition-colors cursor-pointer",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="copy" size={16} className="mr-1" />
                    Copy Embed Code
                  </button>

                  <button
                    type="button"
                    onClick={downloadSnippet}
                    disabled={!hydrated || !outCode}
                    className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <Icons name="download" size={16} className="mr-1" />
                    Download Snippet
                  </button>

                  {info && (
                    <span className="text-[13px] text-slate-600">
                      SVG size: <b>{formatBytes(info.bytes)}</b>
                    </span>
                  )}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Tip: If you want styling control, choose Inline SVG or React.
                  If you want the simplest embed, choose HTML img.
                </div>
              </div>

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
                    onChange={(e) =>
                      setSvgText(ensureSvgHasXmlns(e.target.value))
                    }
                    className="mt-2 w-full h-[300px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                    spellCheck={false}
                    placeholder="<svg ...>...</svg>"
                  />
                </div>
              </details>

              {/* OUTPUT CODE */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Generated embed code
                </div>
                <div className="p-3">
                  <textarea
                    value={outCode}
                    readOnly
                    className="w-full h-[280px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                    spellCheck={false}
                  />
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

      {/* SEO + FAQ (single instances; no duplicates) */}
      <SeoSections />
      <FaqSection />

      {/* Single JSON-LD instances */}
      <JsonLdBreadcrumbs />
      <JsonLdFaq />

      <OtherToolsLinks />
      <RelatedSites />
      <Breadcrumbs crumbs={crumbs} />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Generate
======================== */
function prepareSvg(svgText: string, settings: Settings) {
  let svg = String(svgText || "");

  svg = svg.replace(/^\uFEFF/, "");

  if (settings.sanitize) {
    if (settings.stripScripts)
      svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    if (settings.stripForeignObject)
      svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");
    if (settings.stripEventHandlers) {
      svg = svg.replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");
      svg = svg.replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, "");
    }
    if (settings.stripJavascriptHrefs) {
      svg = svg.replace(
        /\s(?:href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi,
        "",
      );
    }
  }

  svg = ensureSvgHasXmlns(svg);

  if (settings.addViewBoxIfMissing) {
    svg = ensureViewBox(svg, settings.width, settings.height);
  }

  svg = setOrReplaceAttrOnSvg(
    svg,
    "preserveAspectRatio",
    settings.preserveAspectRatio,
  );

  if (settings.focusableFalse) {
    svg = setOrReplaceAttrOnSvg(svg, "focusable", "false");
  } else {
    svg = removeAttrOnSvg(svg, "focusable");
  }

  if (settings.minifySvg) {
    svg = svg
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    svg = svg.trim();
  }

  if (settings.prettySvg && !settings.minifySvg) {
    svg = prettySvg(svg, getIndentStr(settings));
  }

  if (!/<svg\b/i.test(svg)) {
    throw new Error("Input does not contain an <svg> tag.");
  }

  return svg;
}

function generateEmbed(
  svg: string,
  settings: Settings,
): { code: string; htmlPreview: string } {
  const q = settings.quoteMode === "single" ? "'" : '"';
  const indentStr = getIndentStr(settings);

  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  const alt = settings.altText.trim();
  const title = settings.titleText.trim();
  const kind = settings.embedKind;

  const makeDataUri = (forced?: DataUriCharset) => {
    const normalized = svg;
    const mode = forced ?? settings.dataUriCharset;
    if (mode === "base64") {
      const b64 = base64EncodeUtf8(normalized);
      return `data:image/svg+xml;base64,${b64}`;
    }
    const payload = encodeSvgForUtf8DataUri(normalized);
    const charset = settings.includeUtf8Charset ? ";charset=utf-8" : "";
    return `data:image/svg+xml${charset},${payload}`;
  };

  const isFileBasedKind =
    kind === "img" || kind === "object" || kind === "iframe";

  const fileBasedSrc =
    settings.embedSource === "data-uri"
      ? makeDataUri()
      : escapeAttr((settings.assetUrl || "/icon.svg").trim() || "/icon.svg");

  const sizeForHtmlAttrs = () => {
    if (!settings.useWidth && !settings.useHeight)
      return { attrs: "", style: "" };

    if (settings.unit === "px") {
      const parts: string[] = [];
      if (settings.useWidth)
        parts.push(`width=${q}${String(settings.width)}${q}`);
      if (settings.useHeight)
        parts.push(`height=${q}${String(settings.height)}${q}`);
      return { attrs: parts.join(" "), style: "" };
    }

    const styles: string[] = [];
    if (settings.useWidth) styles.push(`width:${escapeAttr(w)}`);
    if (settings.useHeight) styles.push(`height:${escapeAttr(h)}`);
    return {
      attrs: "",
      style: styles.length ? `style=${q}${styles.join(";")}${q}` : "",
    };
  };

  if (kind === "img") {
    const attrs: string[] = [];
    const srcVal =
      settings.embedSource === "data-uri" ? makeDataUri() : fileBasedSrc;
    attrs.push(`src=${q}${srcVal}${q}`);

    if (settings.ariaHidden) {
      attrs.push(`alt=${q}${q}`);
      attrs.push(`aria-hidden=${q}true${q}`);
    } else {
      attrs.push(`alt=${q}${escapeAttr(alt || "")}${q}`);
      if (title) attrs.push(`title=${q}${escapeAttr(title)}${q}`);
    }

    const sz = sizeForHtmlAttrs();
    if (sz.attrs) attrs.push(sz.attrs);
    if (sz.style) attrs.push(sz.style);

    const code = `<img ${attrs.join(" ")} />`;
    return { code, htmlPreview: "" };
  }

  if (kind === "object") {
    const attrs: string[] = [];
    const dataVal =
      settings.embedSource === "data-uri" ? makeDataUri() : fileBasedSrc;
    attrs.push(`data=${q}${dataVal}${q}`);
    if (settings.objectType)
      attrs.push(`type=${q}${escapeAttr(settings.objectType)}${q}`);

    const sz = sizeForHtmlAttrs();
    if (settings.unit === "px") {
      if (_toggleOn(settings.useWidth))
        attrs.push(`width=${q}${String(settings.width)}${q}`);
      if (toggleOn(settings.useHeight))
        attrs.push(`height=${q}${String(settings.height)}${q}`);
    } else if (sz.style) {
      attrs.push(sz.style);
    }

    if (settings.ariaHidden) attrs.push(`aria-hidden=${q}true${q}`);
    if (!settings.ariaHidden && title)
      attrs.push(`title=${q}${escapeAttr(title)}${q}`);

    const inner = settings.ariaHidden ? "" : alt ? escapeHtml(alt) : "SVG";
    const code = `<object ${attrs.join(" ")}>${inner}</object>`;
    return { code, htmlPreview: "" };
  }

  if (kind === "iframe") {
    const attrs: string[] = [];
    const srcVal =
      settings.embedSource === "data-uri" ? makeDataUri() : fileBasedSrc;
    attrs.push(`src=${q}${srcVal}${q}`);

    if (settings.iframeSandbox) {
      const s = (settings.iframeSandboxValue || "").trim();
      attrs.push(`sandbox=${q}${escapeAttr(s)}${q}`);
    }

    const sz = sizeForHtmlAttrs();
    if (settings.unit === "px") {
      if (settings.useWidth)
        attrs.push(`width=${q}${String(settings.width)}${q}`);
      if (settings.useHeight)
        attrs.push(`height=${q}${String(settings.height)}${q}`);
      attrs.push(`style=${q}border:0;${q}`);
    } else if (sz.style) {
      const st = sz.style.replace(/^style=/, "");
      attrs.push(`style=${q}border:0;${st.slice(1, -1)}${q}`);
    } else {
      attrs.push(`style=${q}border:0;${q}`);
    }

    if (settings.ariaHidden) attrs.push(`aria-hidden=${q}true${q}`);
    if (!settings.ariaHidden && title)
      attrs.push(`title=${q}${escapeAttr(title)}${q}`);

    const code = `<iframe ${attrs.join(" ")}></iframe>`;
    return { code, htmlPreview: "" };
  }

  if (kind === "inline") {
    let inlineSvg = svg;

    if (settings.ariaHidden) {
      inlineSvg = setOrReplaceAttrOnSvg(inlineSvg, "aria-hidden", "true");
      inlineSvg = removeAttrOnSvg(inlineSvg, "aria-label");
    } else {
      inlineSvg = removeAttrOnSvg(inlineSvg, "aria-hidden");
      if (alt) inlineSvg = setOrReplaceAttrOnSvg(inlineSvg, "aria-label", alt);
      else inlineSvg = removeAttrOnSvg(inlineSvg, "aria-label");
    }

    if (settings.roleImg) {
      inlineSvg = setOrReplaceAttrOnSvg(inlineSvg, "role", "img");
    } else {
      inlineSvg = removeAttrOnSvg(inlineSvg, "role");
    }

    if (settings.useWidth)
      inlineSvg = setOrReplaceAttrOnSvg(inlineSvg, "width", w);
    else inlineSvg = removeAttrOnSvg(inlineSvg, "width");

    if (settings.useHeight)
      inlineSvg = setOrReplaceAttrOnSvg(inlineSvg, "height", h);
    else inlineSvg = removeAttrOnSvg(inlineSvg, "height");

    inlineSvg = removeInlineTitle(inlineSvg);
    if (settings.addTitleTagInline && title) {
      inlineSvg = ensureInlineTitle(inlineSvg, title);
    }

    const code = inlineSvg;
    return { code, htmlPreview: "" };
  }

  if (kind === "data-uri-base64") {
    const dataUri = makeDataUri("base64");
    const code = dataUri;
    return { code, htmlPreview: "" };
  }

  if (kind === "data-uri-utf8") {
    const dataUri = makeDataUri("utf8");
    const code = dataUri;
    return { code, htmlPreview: "" };
  }

  if (kind === "css-bg" || kind === "css-mask") {
    const dataUri = makeDataUri();
    const prop = kind === "css-mask" ? "mask-image" : "background-image";
    const pos =
      settings.cssPosition === "custom"
        ? settings.cssPositionCustom || "center center"
        : settings.cssPosition;

    const codeLines: string[] = [];
    codeLines.push(`${settings.cssSelector} {`);
    if (settings.cssIncludeDisplayBlock)
      codeLines.push(`${indentStr}display: block;`);
    if (settings.useWidth) codeLines.push(`${indentStr}width: ${w};`);
    if (settings.useHeight) codeLines.push(`${indentStr}height: ${h};`);
    codeLines.push(`${indentStr}${prop}: url(${q}${dataUri}${q});`);
    codeLines.push(
      `${indentStr}${kind === "css-mask" ? "mask-repeat" : "background-repeat"}: ${settings.cssRepeat};`,
    );
    codeLines.push(
      `${indentStr}${kind === "css-mask" ? "mask-position" : "background-position"}: ${pos};`,
    );
    codeLines.push(
      `${indentStr}${kind === "css-mask" ? "mask-size" : "background-size"}: ${settings.cssSizeMode};`,
    );
    if (kind === "css-mask") {
      codeLines.push(`${indentStr}background-color: currentColor;`);
      codeLines.push(
        `${indentStr}-webkit-mask-image: url(${q}${dataUri}${q});`,
      );
      codeLines.push(`${indentStr}-webkit-mask-repeat: ${settings.cssRepeat};`);
      codeLines.push(`${indentStr}-webkit-mask-position: ${pos};`);
      codeLines.push(`${indentStr}-webkit-mask-size: ${settings.cssSizeMode};`);
    }
    codeLines.push(`}`);
    const code = codeLines.join("\n");
    return { code, htmlPreview: "" };
  }

  if (kind === "react-jsx") {
    const jsxSvg = svgToJsx(svg, {
      addTitle: settings.addTitleTagInline && Boolean(title),
      titleText: title,
      ariaHidden: settings.ariaHidden,
      roleImg: settings.roleImg,
      ariaLabel: settings.ariaHidden ? "" : alt,
      width: settings.useWidth ? w : "",
      height: settings.useHeight ? h : "",
      useCurrentColor: settings.reactUseCurrentColor,
      forwardProps: settings.reactForwardProps && settings.reactJsxWrap,
      indentStr,
    });

    const componentName =
      sanitizeJsIdentifier(settings.reactComponentName || "Icon") || "Icon";

    const code = settings.reactJsxWrap
      ? `import * as React from "react";

export const ${componentName} = (props: React.SVGProps<SVGSVGElement>) => (
${indentBlock(jsxSvg, indentStr)}
);
`
      : jsxSvg;

    return { code: code.trim() + "\n", htmlPreview: "" };
  }

  const component = svgToReactComponent(svg, {
    name: settings.reactComponentName || "Icon",
    addTitle: settings.addTitleTagInline && Boolean(title),
    titleText: title,
    ariaHidden: settings.ariaHidden,
    roleImg: settings.roleImg,
    ariaLabel: settings.ariaHidden ? "" : alt,
    width: settings.useWidth ? w : "",
    height: settings.useHeight ? h : "",
    useCurrentColor: settings.reactUseCurrentColor,
    forwardProps: settings.reactForwardProps,
    indentStr,
  });

  return { code: component, htmlPreview: "" };

  function _toggleOn(v: boolean) {
    return Boolean(v);
  }
  function toggleOn(v: boolean) {
    return Boolean(v);
  }
}

function shouldShowDataUriControls(settings: Settings) {
  if (
    settings.embedKind === "data-uri-utf8" ||
    settings.embedKind === "data-uri-base64" ||
    settings.embedKind === "css-bg" ||
    settings.embedKind === "css-mask"
  )
    return true;

  if (
    (settings.embedKind === "img" ||
      settings.embedKind === "object" ||
      settings.embedKind === "iframe") &&
    settings.embedSource === "data-uri"
  )
    return true;

  return false;
}

function getIndentStr(settings: Settings) {
  return settings.indent === "tab" ? "\t" : " ".repeat(Number(settings.indent));
}

/* ========================
   SVG parsing
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const bytes = new Blob([svg]).size;
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const width = widthRaw ? (parseLen(widthRaw) ?? undefined) : undefined;
  const height = heightRaw ? (parseLen(heightRaw) ?? undefined) : undefined;

  const hasScripts = /<script\b/i.test(svg) || /\son[a-z]+\s*=\s*/i.test(svg);
  const hasForeignObject = /<foreignObject\b/i.test(svg);

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    width,
    height,
    hasScripts,
    hasForeignObject,
  };
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

/* ========================
   SVG attribute helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function ensureViewBox(svg: string, w: number, h: number) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;
  const open = openMatch[0];
  const hasVB = /\sviewBox\s*=\s*["'][^"']*["']/i.test(open);
  if (hasVB) return svg;

  const widthRaw = matchAttr(open, "width");
  const heightRaw = matchAttr(open, "height");
  const ww = parseLen(widthRaw || "") ?? w;
  const hh = parseLen(heightRaw || "") ?? h;

  const newOpen = setOrReplaceAttr(
    open,
    "viewBox",
    `0 0 ${Math.max(1, ww)} ${Math.max(1, hh)}`,
  );
  return svg.replace(open, newOpen);
}

function setOrReplaceAttrOnSvg(svg: string, name: string, value: string) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;
  const open = openMatch[0];
  const newOpen = setOrReplaceAttr(open, name, value);
  return svg.replace(open, newOpen);
}

function removeAttrOnSvg(svg: string, name: string) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;
  const open = openMatch[0];
  const newOpen = removeAttr(open, name);
  return svg.replace(open, newOpen);
}

function setOrReplaceAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/<svg\b/i, (m) => `${m} ${name}="${escapeAttr(value)}"`);
}

function removeAttr(tag: string, name: string) {
  const re = new RegExp(
    `\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`,
    "ig",
  );
  return tag.replace(re, "");
}

function ensureInlineTitle(svg: string, title: string) {
  if (!title.trim()) return svg;
  let s = removeInlineTitle(svg);
  const openMatch = s.match(/<svg\b[^>]*>/i);
  if (!openMatch) return s;
  const open = openMatch[0];
  const titleTag = `<title>${escapeXmlText(title)}</title>`;
  return s.replace(open, `${open}${titleTag}`);
}

function removeInlineTitle(svg: string) {
  return svg.replace(/<title\b[\s\S]*?<\/title>/gi, "");
}

/* ========================
   JSX / React
======================== */
function svgToJsx(
  svg: string,
  opts: {
    addTitle: boolean;
    titleText: string;
    ariaHidden: boolean;
    roleImg: boolean;
    ariaLabel: string;
    width: string;
    height: string;
    useCurrentColor: boolean;
    forwardProps: boolean;
    indentStr: string;
  },
) {
  let s = svg.trim();

  s = s.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  s = s.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");

  s = s.replace(/\bxlink:href\b/gi, "xlinkHref");
  s = s.replace(/\bxml:space\b/gi, "xmlSpace");
  s = s.replace(/\bstroke-linecap\b/gi, "strokeLinecap");
  s = s.replace(/\bstroke-linejoin\b/gi, "strokeLinejoin");
  s = s.replace(/\bstroke-width\b/gi, "strokeWidth");
  s = s.replace(/\bfill-rule\b/gi, "fillRule");
  s = s.replace(/\bclip-rule\b/gi, "clipRule");
  s = s.replace(/\bstop-color\b/gi, "stopColor");
  s = s.replace(/\bstop-opacity\b/gi, "stopOpacity");
  s = s.replace(/\bfont-family\b/gi, "fontFamily");
  s = s.replace(/\bfont-size\b/gi, "fontSize");
  s = s.replace(/\btext-anchor\b/gi, "textAnchor");

  s = s.replace(/\sxmlns\s*=\s*["'][^"']*["']/i, "");

  const openMatch = s.match(/<svg\b[^>]*>/i);
  if (!openMatch) throw new Error("Could not find <svg> tag.");
  const open = openMatch[0];
  let newOpen = open;

  if (opts.width)
    newOpen = setOrReplaceGenericAttr(newOpen, "width", opts.width);
  else newOpen = removeGenericAttr(newOpen, "width");

  if (opts.height)
    newOpen = setOrReplaceGenericAttr(newOpen, "height", opts.height);
  else newOpen = removeGenericAttr(newOpen, "height");

  if (opts.ariaHidden) {
    newOpen = setOrReplaceGenericAttr(newOpen, "aria-hidden", "true");
    newOpen = removeGenericAttr(newOpen, "aria-label");
  } else if (opts.ariaLabel) {
    newOpen = setOrReplaceGenericAttr(newOpen, "aria-label", opts.ariaLabel);
    newOpen = removeGenericAttr(newOpen, "aria-hidden");
  }

  if (opts.roleImg) newOpen = setOrReplaceGenericAttr(newOpen, "role", "img");
  else newOpen = removeGenericAttr(newOpen, "role");

  newOpen = setOrReplaceGenericAttr(newOpen, "focusable", "false");

  if (opts.forwardProps) {
    if (!/\{\.\.\.props\}/.test(newOpen)) {
      newOpen = newOpen.replace(/<svg\b/i, "<svg {...props}");
    }
  }

  s = s.replace(open, newOpen);

  s = removeInlineTitle(s);
  if (opts.addTitle && opts.titleText.trim()) {
    s = ensureInlineTitle(s, opts.titleText.trim());
  }

  if (opts.useCurrentColor) {
    s = replaceSvgColorsWithCurrentColor(s);
  }

  s = prettyXmlLike(s, opts.indentStr);
  return s;
}

function svgToReactComponent(
  svg: string,
  opts: {
    name: string;
    addTitle: boolean;
    titleText: string;
    ariaHidden: boolean;
    roleImg: boolean;
    ariaLabel: string;
    width: string;
    height: string;
    useCurrentColor: boolean;
    forwardProps: boolean;
    indentStr: string;
  },
) {
  const name = sanitizeJsIdentifier(opts.name || "Icon") || "Icon";
  const jsx = svgToJsx(svg, {
    ...opts,
    forwardProps: opts.forwardProps,
  });

  const innerIndent = opts.indentStr;
  const code = `import * as React from "react";

export default function ${name}(props: React.SVGProps<SVGSVGElement>) {
  return (
${indentBlock(jsx, innerIndent)}
  );
}
`;
  return code.trim() + "\n";
}

function sanitizeJsIdentifier(s: string) {
  const t = String(s || "").trim();
  if (!t) return "Icon";
  const cleaned = t.replace(/[^a-zA-Z0-9_]/g, "");
  const startOk = /^[a-zA-Z_]/.test(cleaned);
  return (startOk ? cleaned : `Icon${cleaned}`).slice(0, 50);
}

function replaceSvgColorsWithCurrentColor(svg: string) {
  let s = svg;

  const repl = (m0: string, attr: string, val: string) => {
    const v = val.trim();
    if (!v) return m0;
    if (/^none$/i.test(v)) return m0;
    if (/^url\(/i.test(v)) return m0;
    if (/^currentColor$/i.test(v)) return m0;
    return ` ${attr}="currentColor"`;
  };

  s = s.replace(/\s(fill)\s*=\s*["']([^"']+)["']/gi, repl as any);
  s = s.replace(/\s(stroke)\s*=\s*["']([^"']+)["']/gi, repl as any);
  return s;
}

/* ========================
   Data URI encoding
======================== */
function base64EncodeUtf8(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function encodeSvgForUtf8DataUri(svg: string) {
  return encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%22/g, "'")
    .replace(/%2C/g, ",");
}

/* ========================
   HTML/text helpers
======================== */
function escapeAttr(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlText(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setOrReplaceGenericAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/<svg\b/i, (m) => `${m} ${name}="${escapeAttr(value)}"`);
}

function removeGenericAttr(tag: string, name: string) {
  const re = new RegExp(
    `\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`,
    "ig",
  );
  return tag.replace(re, "");
}

function escapeRegExp(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ========================
   SVG formatting helpers
======================== */
function prettySvg(svg: string, indentStr: string) {
  const s = svg.replace(/>\s*</g, ">\n<");
  const lines = s.split("\n");
  let indent = 0;
  const out: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const isClose = /^<\/[^>]+>/.test(line);
    const isOpen = /^<[^/!][^>]*>$/.test(line) && !/\/>$/.test(line);
    const isSelf = /\/>$/.test(line) || /^<\?/.test(line) || /^<!/.test(line);

    if (isClose) indent = Math.max(0, indent - 1);
    out.push(indentStr.repeat(indent) + line);
    if (isOpen && !isSelf) indent += 1;
  }

  return out.join("\n").trim();
}

function prettyXmlLike(xml: string, indentStr: string) {
  const s = xml.replace(/>\s*</g, ">\n<");
  const lines = s.split("\n");
  let indent = 0;
  const out: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const isClose = /^<\/[^>]+>/.test(line);
    const isOpen = /^<[^/!][^>]*>$/.test(line) && !/\/>$/.test(line);
    const isSelf = /\/>$/.test(line) || /^<\?/.test(line) || /^<!/.test(line);

    if (isClose) indent = Math.max(0, indent - 1);
    out.push(indentStr.repeat(indent) + line);
    if (isOpen && !isSelf) indent += 1;
  }

  return out.join("\n").trim();
}

function indentBlock(s: string, indent: string) {
  return s
    .split("\n")
    .map((l) => indent + l)
    .join("\n");
}

function parseLen(raw: string): number | null {
  const m = String(raw || "")
    .trim()
    .match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

/* ========================
   Download
======================== */
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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
    String(name || "snippet")
      .trim()
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "snippet"
  );
}

function clampInt(v: number, lo: number, hi: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function guessSnippetExt(kind: EmbedKind) {
  if (kind === "css-bg" || kind === "css-mask") return "css";
  if (kind === "react-component") return "tsx";
  return "txt";
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
    <label className="flex items-center gap-2 min-w-0 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
      />
      <span className="text-[13px] text-slate-700 min-w-0">{label}</span>
    </label>
  );
}

function TogglePill({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "px-2 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors",
        checked
          ? "bg-[#eff4ff] border-[#d6e4ff] text-slate-900 hover:bg-[#e5eeff]"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
      ].join(" ")}
      aria-pressed={checked}
    >
      {label}
    </button>
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

function UnitSelect({
  value,
  onChange,
}: {
  value: Settings["unit"];
  onChange: (v: Settings["unit"]) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as any)}
      className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
    >
      <option value="px">px</option>
      <option value="em">em</option>
      <option value="rem">rem</option>
      <option value="%">%</option>
      <option value="vh">vh</option>
      <option value="vw">vw</option>
    </select>
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
        className="text-[13px] text-slate-600 max-w-[1180px] py-4 mx-auto px-4"
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
        name: "SVG Embed Code Generator",
        item: `${baseUrl}/svg-embed-code-generator`,
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
        name: "What is the best way to embed an SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Inline SVG is best when you want full styling control and accessibility. Use <img> for the simplest file reference. Use Data URIs for CSS backgrounds or quick embeds without extra files. Use React when you want reusable components.",
        },
      },
      {
        "@type": "Question",
        name: "Should I use Base64 or UTF-8 for SVG data URIs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "UTF-8 (percent-encoded) is often smaller for SVG text. Base64 can be more compatible in some pipelines, but is usually larger for SVG.",
        },
      },
      {
        "@type": "Question",
        name: "Why does my file URL not load in preview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If the URL points to a path your site does not serve, the browser will show a broken image. Keep input preview set to use the uploaded SVG when you want reliable preview, and switch to File URL preview when you want to test production paths.",
        },
      },
      {
        "@type": "Question",
        name: "Can SVG contain unsafe scripts?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. SVG can contain scripts, event handlers, and foreignObject. Keep sanitization enabled before inlining or generating data URIs from untrusted SVG.",
        },
      },
      {
        "@type": "Question",
        name: "How do I make an embedded SVG responsive?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ensure the SVG has a viewBox, then avoid hard-coded width and height and control size with CSS. For <img>, use CSS like width:100% and height:auto while keeping the SVG viewBox.",
        },
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
   Visible FAQ
======================== */
function FaqSection() {
  const faqs = [
    {
      q: "How do I embed an SVG in HTML?",
      a: "Use <img> for a simple file reference. Use inline SVG when you need CSS styling, hover states, or accessibility tweaks. This tool generates both.",
    },
    {
      q: "Inline SVG vs img, which should I use?",
      a: "Use inline SVG when you need to target internal paths with CSS or add ARIA labels. Use <img> when you just need to display the asset and do not need internal styling.",
    },
    {
      q: "How do I embed SVG as a CSS background or mask?",
      a: "Use background-image for decorative SVGs. Use mask-image for monochrome icons that should inherit color (currentColor). This tool generates both, including -webkit-mask for better support.",
    },
    {
      q: "What is an SVG data URI?",
      a: "A data URI embeds the SVG content directly into a URL string. You can use UTF-8 percent-encoding or Base64. UTF-8 is often smaller for SVG text.",
    },
    {
      q: "Is it safe to inline SVG from the internet?",
      a: "Not by default. SVG can contain scripts and event handlers. Keep sanitization enabled unless you fully trust the SVG.",
    },
    {
      q: "Why is my SVG not scaling correctly?",
      a: "Most scaling issues come from missing viewBox or hard-coded width and height. This tool can add a viewBox if missing and lets you control preserveAspectRatio.",
    },
  ];

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <div className="max-w-[900px]">
          <h2 className="m-0 text-2xl font-extrabold text-slate-900">FAQ</h2>
          <div className="mt-4 grid gap-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                  {f.q}
                </summary>
                <div className="px-4 pb-4 text-[14px] text-slate-700">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================
   SEO Sections (no FAQ + no JSON-LD here to avoid duplicates)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-900">
        <article>
          <h2 className="m-0 text-2xl md:text-3xl font-extrabold tracking-tight">
            SVG Embed Code Generator
          </h2>

          <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
            Generate{" "}
            <span className="font-semibold text-slate-900">SVG embed code</span>{" "}
            for the most common ways to use SVG on the web. Upload or paste an
            SVG and get snippets for HTML{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
              &lt;img&gt;
            </code>
            , <span className="font-semibold text-slate-900">inline SVG</span>,{" "}
            <span className="font-semibold text-slate-900">
              CSS background-image
            </span>
            ,{" "}
            <span className="font-semibold text-slate-900">CSS mask-image</span>
            , <span className="font-semibold text-slate-900">data URIs</span>{" "}
            (UTF-8 or Base64), and{" "}
            <span className="font-semibold text-slate-900">React/JSX</span>.
            Everything runs{" "}
            <span className="font-semibold text-slate-900">client-side</span>.
          </p>

          <p className="mt-2 text-slate-600">
            Upload or paste an SVG and generate embed snippets for HTML, CSS,
            React/JSX, and Data URIs.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="m-0 text-base font-extrabold text-slate-900">
                  Which embed type should I choose?
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                  Pick based on how much styling control you need and where the
                  SVG will live.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  Simplest: img
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  Most control: inline/React
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  CSS: background/mask
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  Portable: data URI
                </span>
              </div>
            </div>

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

            <div className="mt-4 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  HTML &lt;img&gt;
                </div>
                <p className="mt-2 leading-relaxed">
                  Best when you want a simple embed and do not need to style
                  internal SVG parts. Good for caching and quick use in content.
                </p>
                <div className="mt-2 text-[12px] text-slate-600">
                  Use when: just render the SVG.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">Inline SVG</div>
                <p className="mt-2 leading-relaxed">
                  Best when you need styling control (CSS, hover states,
                  currentColor) or accessibility attributes directly on
                  elements.
                </p>
                <div className="mt-2 text-[12px] text-slate-600">
                  Use when: theming, animations, per-path styling.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  CSS background-image
                </div>
                <p className="mt-2 leading-relaxed">
                  Best for decorative graphics. Works well with sizing,
                  positioning, and repeating behavior, but you cannot style
                  internal SVG parts.
                </p>
                <div className="mt-2 text-[12px] text-slate-600">
                  Use when: backgrounds, badges, UI decoration.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  CSS mask-image
                </div>
                <p className="mt-2 leading-relaxed">
                  Best for single-color icons with{" "}
                  <span className="font-semibold text-slate-900">
                    currentColor
                  </span>
                  -style theming. The SVG becomes a mask; the element&apos;s
                  background sets the color.
                </p>
                <div className="mt-2 text-[12px] text-slate-600">
                  Use when: monochrome icons, easy theming.
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Data URI (UTF-8)
                </div>
                <p className="mt-2 leading-relaxed">
                  Smaller and readable, but requires proper escaping. Best for
                  CSS URLs when you want quick copy-paste without Base64.
                </p>
                <div className="mt-2 text-[12px] text-slate-600">
                  Use when: CSS embed and size matters.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Data URI (Base64)
                </div>
                <p className="mt-2 leading-relaxed">
                  More compatible across older pipelines because it avoids
                  escaping issues, but can be larger. Useful when UTF-8 encoding
                  breaks.
                </p>
                <div className="mt-2 text-[12px] text-slate-600">
                  Use when: strict tooling or copy/paste issues.
                </div>
              </div>
            </div>
          </div>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3
              itemProp="name"
              className="m-0 text-lg font-extrabold text-slate-900"
            >
              How to generate SVG embed code
            </h3>
            <ol className="mt-3 grid gap-2 list-decimal pl-5 text-[13px] leading-relaxed text-slate-700">
              <li itemProp="step">Upload an SVG file or paste SVG markup.</li>
              <li itemProp="step">
                Choose an embed type (img, inline, CSS, data URI, React).
              </li>
              <li itemProp="step">
                Adjust size, viewBox, and accessibility options.
              </li>
              <li itemProp="step">
                Copy the generated snippet into your project.
              </li>
            </ol>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
              <span className="font-semibold text-slate-900">Tip:</span> If you
              want styling control, choose Inline SVG or React. If you want the
              simplest embed, choose HTML img.
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
