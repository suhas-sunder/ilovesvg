import * as React from "react";
import type { Route } from "./+types/inline-svg-vs-img";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "i🩵SVG  -  Inline SVG vs <img> (Comparison + Generator)";
  const description =
    "Compare inline SVG vs <img> and generate the right embed code. Paste an SVG, preview both methods side by side, test CSS styling (currentColor), accessibility options, caching tradeoffs, and copy ready-to-use snippets. Client-side only.";
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
type SizeUnit = "px" | "em" | "rem" | "%" | "vh" | "vw";
type QuoteMode = "double" | "single";

type Settings = {
  width: number;
  height: number;
  unit: SizeUnit;
  useWidth: boolean;
  useHeight: boolean;
  responsiveMode: "fixed" | "responsive";
  fitMode: "contain" | "cover" | "none";

  // Accessibility
  altText: string;
  titleText: string;
  decorative: boolean; // aria-hidden for inline, empty alt for img
  roleImgInline: boolean;
  focusableFalse: boolean;

  // Safety / cleanup
  sanitize: boolean;
  stripScripts: boolean;
  stripEventHandlers: boolean;
  stripForeignObject: boolean;
  stripJavascriptHrefs: boolean;
  removeComments: boolean;
  removeMetadata: boolean;

  // Normalization
  ensureXmlns: boolean;
  addViewBoxIfMissing: boolean;
  removeWidthHeightFromSvg: boolean;
  setCurrentColor: boolean;

  // Styling demo
  demoColor: string;
  demoBg: string;
  demoBorder: boolean;
  demoClassName: string;

  // Output formatting
  quoteMode: QuoteMode;
  indent: "2" | "4" | "tab";

  // <img> source options
  imgSrcMode: "file-url" | "data-uri-utf8" | "data-uri-base64" | "blob-url";
  assetUrl: string;
  includeUtf8Charset: boolean;

  // Copy helpers
  wrapInHtmlDoc: boolean;
};

type SvgInfo = {
  bytes: number;
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  hasScripts?: boolean;
  hasForeignObject?: boolean;
  hasEvents?: boolean;
  hasComments?: boolean;
  hasMetadata?: boolean;
};

const DEFAULTS: Settings = {
  width: 128,
  height: 128,
  unit: "px",
  useWidth: true,
  useHeight: true,
  responsiveMode: "fixed",
  fitMode: "contain",

  altText: "Icon",
  titleText: "",
  decorative: false,
  roleImgInline: true,
  focusableFalse: true,

  sanitize: true,
  stripScripts: true,
  stripEventHandlers: true,
  stripForeignObject: false,
  stripJavascriptHrefs: true,
  removeComments: true,
  removeMetadata: true,

  ensureXmlns: true,
  addViewBoxIfMissing: true,
  removeWidthHeightFromSvg: false,
  setCurrentColor: false,

  demoColor: "#0b2dff",
  demoBg: "#ffffff",
  demoBorder: true,
  demoClassName: "icon",

  quoteMode: "double",
  indent: "2",

  imgSrcMode: "file-url",
  assetUrl: "/icons/icon.svg",
  includeUtf8Charset: true,

  wrapInHtmlDoc: false,
};

/* ========================
   Page
======================== */
export default function InlineSvgVsImg(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [preparedSvg, setPreparedSvg] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  const [inlineCode, setInlineCode] = React.useState<string>("");
  const [imgCode, setImgCode] = React.useState<string>("");

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

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
    if (
      !(f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
    ) {
      setErr("Please choose an SVG file.");
      return;
    }

    const text = await f.text();
    setFile(f);
    setSvgText(text);

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(
      new Blob([text], { type: "image/svg+xml" }),
    );
    setBlobUrl(url);
  }

  function clearAll() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setFile(null);
    setSvgText("");
    setPreparedSvg("");
    setInfo(null);
    setBlobUrl(null);
    setInlineCode("");
    setImgCode("");
    setErr(null);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path fill="#0b2dff" d="M64 10c29.8 0 54 24.2 54 54s-24.2 54-54 54S10 93.8 10 64 34.2 10 64 10Zm0 18a36 36 0 1 0 0 72 36 36 0 0 0 0-72Z"/><path fill="#0b2dff" d="M60 36h8v36h-8z"/><path fill="#0b2dff" d="M36 60h56v8H36z"/></svg>`;
    setErr(null);
    setFile(null);
    setSvgText(example);

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(
      new Blob([example], { type: "image/svg+xml" }),
    );
    setBlobUrl(url);

    showToast("Example loaded");
  }

  React.useEffect(() => {
    if (!svgText.trim()) {
      setPreparedSvg("");
      setInfo(null);
      setInlineCode("");
      setImgCode("");
      setErr(null);
      return;
    }

    try {
      setErr(null);

      const normalized = normalizeSvg(svgText, settings);
      setPreparedSvg(normalized);
      setInfo(parseSvgInfo(normalized));

      const inline = generateInlineSnippet(normalized, settings);
      const img = generateImgSnippet(normalized, blobUrl, settings);

      setInlineCode(settings.wrapInHtmlDoc ? wrapInDoc(inline) : inline);
      setImgCode(settings.wrapInHtmlDoc ? wrapInDoc(img) : img);
    } catch (e: any) {
      setErr(e?.message || "Failed to process SVG.");
      setPreparedSvg("");
      setInfo(null);
      setInlineCode("");
      setImgCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, settings, blobUrl]);

  function copyText(t: string) {
    if (!t || !hydrated) return;
    navigator.clipboard.writeText(t).then(() => showToast("Copied"));
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Inline SVG vs <img>", href: "/inline-svg-vs-img" },
  ];

  const inlinePreview = React.useMemo(() => {
    if (!preparedSvg) return "";
    return applyInlinePreviewAttrs(preparedSvg, settings);
  }, [preparedSvg, settings]);

  const imgPreviewSrc = React.useMemo(() => {
    if (!preparedSvg) return "";
    if (settings.imgSrcMode === "file-url")
      return settings.assetUrl || "/icons/icon.svg";
    if (settings.imgSrcMode === "blob-url") return blobUrl || "";
    if (settings.imgSrcMode === "data-uri-base64")
      return toDataUriBase64(preparedSvg);
    return toDataUriUtf8(preparedSvg, settings.includeUtf8Charset);
  }, [
    preparedSvg,
    settings.imgSrcMode,
    settings.assetUrl,
    settings.includeUtf8Charset,
    blobUrl,
  ]);

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
              <span className="text-[#0b2dff]">Inline SVG</span>
              <span className="text-slate-400">vs</span>
              <span>{"<img>"}</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Paste an SVG and compare both embed methods side by side. Generate
              code that matches what you actually need.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 font-bold text-lg text-slate-900">
                  Input SVG
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

                  <details
                    className="mt-3 rounded-2xl border border-slate-200 bg-white"
                    open
                  >
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      Edit SVG source (optional)
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-[13px] text-slate-600 mt-2">
                        Paste raw SVG markup here. Changes apply instantly.
                      </p>
                      <textarea
                        value={svgText}
                        onChange={(e) => setSvgText(e.target.value)}
                        className="mt-2 w-full h-[320px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}

              {info && (
                <div className="mt-3 grid gap-2">
                  <div className="text-[13px] text-slate-700">
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

                  {(info.hasScripts ||
                    info.hasForeignObject ||
                    info.hasEvents) && (
                    <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      This SVG includes potentially risky content (scripts,
                      event handlers, or foreignObject). Keep sanitization
                      enabled if this is untrusted.
                    </div>
                  )}

                  {(info.hasComments || info.hasMetadata) && (
                    <div className="text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      This SVG contains {info.hasComments ? "comments" : ""}
                      {info.hasComments && info.hasMetadata ? " and " : ""}
                      {info.hasMetadata ? "metadata" : ""}. You can remove them
                      in settings.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SETTINGS */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Comparison Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Sizing mode">
                    <select
                      value={settings.responsiveMode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          responsiveMode: e.target.value as any,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="fixed">
                        Fixed (width/height attributes)
                      </option>
                      <option value="responsive">
                        Responsive (CSS width:100%)
                      </option>
                    </select>
                  </Field>

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
                      onChange={(u) => setSettings((s) => ({ ...s, unit: u }))}
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
                      onChange={(u) => setSettings((s) => ({ ...s, unit: u }))}
                    />
                    <TogglePill
                      checked={settings.useHeight}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, useHeight: v }))
                      }
                      label="Use"
                    />
                  </Field>

                  <Field label="Object fit">
                    <select
                      value={settings.fitMode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          fitMode: e.target.value as any,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="contain">contain</option>
                      <option value="cover">cover</option>
                      <option value="none">none</option>
                    </select>
                  </Field>

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
                        checked={settings.decorative}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, decorative: v }))
                        }
                        label="Decorative (aria-hidden for inline, empty alt for <img>)"
                      />
                      <ToggleRow
                        checked={settings.roleImgInline}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, roleImgInline: v }))
                        }
                        label='Inline: role="img"'
                      />
                      <ToggleRow
                        checked={settings.focusableFalse}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, focusableFalse: v }))
                        }
                        label='Inline: focusable="false"'
                      />
                    </div>
                  </Field>

                  <Field label="Safety / cleanup">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.sanitize}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, sanitize: v }))
                        }
                        label="Sanitize (recommended)"
                      />
                      {settings.sanitize && (
                        <div className="pl-6 flex flex-col gap-2">
                          <ToggleRow
                            checked={settings.stripScripts}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, stripScripts: v }))
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
                        checked={settings.removeComments}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeComments: v }))
                        }
                        label="Remove comments"
                      />
                      <ToggleRow
                        checked={settings.removeMetadata}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeMetadata: v }))
                        }
                        label="Remove <metadata> blocks"
                      />
                    </div>
                  </Field>

                  <Field label="Normalize">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.ensureXmlns}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, ensureXmlns: v }))
                        }
                        label="Ensure xmlns on <svg>"
                      />
                      <ToggleRow
                        checked={settings.addViewBoxIfMissing}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, addViewBoxIfMissing: v }))
                        }
                        label="Add viewBox if missing"
                      />
                      <ToggleRow
                        checked={settings.removeWidthHeightFromSvg}
                        onChange={(v) =>
                          setSettings((s) => ({
                            ...s,
                            removeWidthHeightFromSvg: v,
                          }))
                        }
                        label="Remove width/height from SVG source"
                      />
                      <ToggleRow
                        checked={settings.setCurrentColor}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, setCurrentColor: v }))
                        }
                        label="Replace fill/stroke with currentColor (best-effort)"
                      />
                    </div>
                  </Field>

                  <Field label="Styling demo">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] text-slate-600 min-w-[90px]">
                          Color
                        </span>
                        <input
                          type="color"
                          value={settings.demoColor}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              demoColor: e.target.value,
                            }))
                          }
                          className="h-8 w-12 border border-slate-200 rounded-md bg-white"
                        />
                        <input
                          value={settings.demoColor}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              demoColor: e.target.value,
                            }))
                          }
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          placeholder="#0b2dff"
                        />
                      </label>

                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] text-slate-600 min-w-[90px]">
                          Background
                        </span>
                        <input
                          type="color"
                          value={settings.demoBg}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              demoBg: e.target.value,
                            }))
                          }
                          className="h-8 w-12 border border-slate-200 rounded-md bg-white"
                        />
                        <input
                          value={settings.demoBg}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              demoBg: e.target.value,
                            }))
                          }
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          placeholder="#ffffff"
                        />
                      </label>

                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] text-slate-600 min-w-[90px]">
                          Class
                        </span>
                        <input
                          value={settings.demoClassName}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              demoClassName: sanitizeClassName(e.target.value),
                            }))
                          }
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          placeholder="icon"
                        />
                      </label>

                      <ToggleRow
                        checked={settings.demoBorder}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, demoBorder: v }))
                        }
                        label="Show border around preview"
                      />
                    </div>
                  </Field>

                  <Field label="<img> src type">
                    <select
                      value={settings.imgSrcMode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          imgSrcMode: e.target.value as any,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="file-url">
                        File URL (best for caching)
                      </option>
                      <option value="blob-url">Blob URL (local preview)</option>
                      <option value="data-uri-utf8">Data URI (UTF-8)</option>
                      <option value="data-uri-base64">Data URI (Base64)</option>
                    </select>
                  </Field>

                  {settings.imgSrcMode === "file-url" && (
                    <Field label="File URL">
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

                  {settings.imgSrcMode === "data-uri-utf8" && (
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
                        className="h-4 w-4 accent-[#0b2dff] shrink-0"
                      />
                      <span className="text-[13px] text-slate-700 min-w-0">
                        Include charset=utf-8
                      </span>
                    </Field>
                  )}

                  <Field label="Format">
                    <select
                      value={settings.indent}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          indent: e.target.value as any,
                        }))
                      }
                      className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                      className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="double">"</option>
                      <option value="single">'</option>
                    </select>
                    <TogglePill
                      checked={settings.wrapInHtmlDoc}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, wrapInHtmlDoc: v }))
                      }
                      label="Wrap in HTML doc"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>

          {/* PREVIEWS */}
          <section className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CompareCard
              title="Inline SVG"
              badge="Styleable, best control"
              code={inlineCode}
              onCopy={() => copyText(inlineCode)}
              preview={
                preparedSvg ? (
                  <InlinePreview svg={inlinePreview} settings={settings} />
                ) : (
                  <EmptyState />
                )
              }
            />
            <CompareCard
              title="<img>"
              badge="Simple, cache-friendly"
              code={imgCode}
              onCopy={() => copyText(imgCode)}
              preview={
                preparedSvg ? (
                  <ImgPreview
                    src={imgPreviewSrc}
                    settings={settings}
                    alt={settings.decorative ? "" : settings.altText}
                    title={settings.titleText}
                  />
                ) : (
                  <EmptyState />
                )
              }
            />
          </section>

          {/* COMPARISON */}
          <section className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="m-0 font-bold text-lg text-slate-900">
                Inline SVG vs {"<img>"} comparison
              </h2>
              {info ? (
                <span className="text-[13px] text-slate-600">
                  SVG size: <b>{formatBytes(info.bytes)}</b>
                </span>
              ) : null}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[13px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="sticky left-0 bg-white z-10 border-b border-slate-200 py-2 pr-3 w-[240px]">
                      Topic
                    </th>
                    <th className="border-b border-slate-200 py-2 px-3 w-[45%]">
                      Inline SVG
                    </th>
                    <th className="border-b border-slate-200 py-2 pl-3 w-[45%]">
                      {"<img>"} with SVG
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <Row
                    topic="CSS styling (fill, stroke)"
                    inline="Best. Can target internal shapes, use currentColor, hover states, animations, and CSS variables."
                    img="Limited. You can size the element and apply filters, but you cannot style paths inside the SVG."
                  />
                  <Row
                    topic="Accessibility"
                    inline="Excellent when done right. Use role, aria-label or <title>, or aria-hidden for decorative icons."
                    img="Straightforward. Use alt text. Decorative icons should use empty alt."
                  />
                  <Row
                    topic="Caching"
                    inline="No caching per icon instance. Repeated inline markup increases HTML size."
                    img="Best. Browser caches the SVG file URL across pages. Good for repeated icons."
                  />
                  <Row
                    topic="Security / sanitization"
                    inline="Higher risk if you inline untrusted SVG. You must sanitize scripts, handlers, and foreignObject."
                    img="Still can be risky depending on context, but you are not injecting markup into DOM as HTML. Prefer file URL with proper headers and CSP."
                  />
                  <Row
                    topic="Performance"
                    inline="Good for small icons and when you need styling. Can bloat HTML for large SVGs."
                    img="Good for large SVGs reused many times. Keeps HTML smaller."
                  />
                  <Row
                    topic="Interactivity"
                    inline="Best. You can attach events, animate, and manipulate with JS."
                    img="Not possible inside the SVG. Only events on the <img> element itself."
                  />
                  <Row
                    topic="CSP compatibility"
                    inline="Inline markup may be fine, but inline scripts are blocked. Sanitization recommended."
                    img="Usually easier. File URL is clean. Data URIs may be blocked by CSP in some setups."
                  />
                  <Row
                    topic="SEO"
                    inline="Inline can be indexed as markup, but icons are usually not SEO content."
                    img="Alt text can help for meaningful images. For icons, usually decorative."
                  />
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h3 className="m-0 font-bold text-slate-900">
                  Pick Inline SVG when
                </h3>
                <ul className="mt-3 list-disc pl-5 text-[13px] text-slate-700 grid gap-1">
                  <li>
                    You need CSS styling of paths (currentColor icons, hover
                    effects).
                  </li>
                  <li>You need animations or per-shape manipulation.</li>
                  <li>
                    You are building a component library or design system.
                  </li>
                  <li>
                    You want maximum accessibility control for meaningful icons.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h3 className="m-0 font-bold text-slate-900">
                  Pick {"<img>"} when
                </h3>
                <ul className="mt-3 list-disc pl-5 text-[13px] text-slate-700 grid gap-1">
                  <li>
                    You want simple embedding and strong caching across pages.
                  </li>
                  <li>The SVG is large and reused many times.</li>
                  <li>You do not need to style internal shapes.</li>
                  <li>
                    You prefer file URLs over inline markup for maintainability.
                  </li>
                </ul>
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
      <JsonLdFaq />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Compare Cards
======================== */
function CompareCard({
  title,
  badge,
  code,
  onCopy,
  preview,
}: {
  title: string;
  badge: string;
  code: string;
  onCopy: () => void;
  preview: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="m-0 font-bold text-slate-900">{title}</h2>
          <span className="text-[12px] px-2 py-1 rounded-full bg-[#eff4ff] border border-[#d6e4ff] text-slate-700">
            {badge}
          </span>
        </div>

        <button
          type="button"
          onClick={onCopy}
          disabled={!code}
          className={[
            "px-3 py-2 rounded-xl font-bold border transition-colors",
            "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
            "disabled:opacity-70 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          Copy snippet
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
            Preview
          </div>
          <div className="p-3">{preview}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
            Generated code
          </div>
          <div className="p-3">
            <textarea
              value={code}
              readOnly
              className="w-full h-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-slate-600 text-sm">
      Upload or paste an SVG to see previews and snippets.
    </div>
  );
}

function InlinePreview({ svg, settings }: { svg: string; settings: Settings }) {
  const sizeStyle = previewSizeStyle(settings);
  const borderStyle = settings.demoBorder
    ? "1px solid rgb(226 232 240)"
    : "none";

  const style = {
    ...sizeStyle,
    background: settings.demoBg,
    color: settings.demoColor,
    border: borderStyle,
    borderRadius: "16px",
    padding: "12px",
    overflow: "hidden",
  } as React.CSSProperties;

  return (
    <div style={style} className="min-w-0">
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function ImgPreview({
  src,
  settings,
  alt,
  title,
}: {
  src: string;
  settings: Settings;
  alt: string;
  title: string;
}) {
  const sizeStyle = previewSizeStyle(settings);
  const borderStyle = settings.demoBorder
    ? "1px solid rgb(226 232 240)"
    : "none";

  const wrapStyle = {
    ...sizeStyle,
    background: settings.demoBg,
    border: borderStyle,
    borderRadius: "16px",
    padding: "12px",
    overflow: "hidden",
  } as React.CSSProperties;

  const imgStyle = {
    display: "block",
    width: settings.responsiveMode === "responsive" ? "100%" : undefined,
    height: settings.responsiveMode === "responsive" ? "auto" : undefined,
    objectFit: settings.fitMode === "none" ? undefined : settings.fitMode,
    maxWidth: "100%",
  } as React.CSSProperties;

  return (
    <div style={wrapStyle} className="min-w-0">
      {src ? (
        <img src={src} alt={alt} title={title || undefined} style={imgStyle} />
      ) : (
        <div className="text-slate-600 text-sm">
          Blob URL is not available. Use File URL or Data URI mode, or load an
          SVG.
        </div>
      )}
      {settings.setCurrentColor ? (
        <div className="mt-2 text-[12px] text-slate-600">
          Note: currentColor only affects inline SVG. {"<img>"} cannot inherit
          text color into SVG paths.
        </div>
      ) : null}
    </div>
  );
}

function Row({
  topic,
  inline,
  img,
}: {
  topic: string;
  inline: string;
  img: string;
}) {
  return (
    <tr>
      <td className="sticky left-0 bg-white z-10 border-b border-slate-200 py-3 pr-3 font-semibold text-slate-900 w-[240px]">
        {topic}
      </td>
      <td className="border-b border-slate-200 py-3 px-3 text-slate-700">
        {inline}
      </td>
      <td className="border-b border-slate-200 py-3 pl-3 text-slate-700">
        {img}
      </td>
    </tr>
  );
}

/* ========================
   Snippet generation
======================== */
function generateInlineSnippet(svg: string, settings: Settings) {
  const q = settings.quoteMode === "single" ? "'" : '"';
  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  let s = svg;

  // Inline accessibility
  if (settings.decorative) {
    s = setOrReplaceAttrOnSvg(s, "aria-hidden", "true");
    s = removeAttrOnSvg(s, "aria-label");
    s = removeInlineTitle(s);
  } else {
    s = removeAttrOnSvg(s, "aria-hidden");
    const label = (settings.altText || "").trim();
    if (label) s = setOrReplaceAttrOnSvg(s, "aria-label", label);
    else s = removeAttrOnSvg(s, "aria-label");

    const title = (settings.titleText || "").trim();
    if (title) s = ensureInlineTitle(s, title);
    else s = removeInlineTitle(s);
  }

  if (settings.roleImgInline && !settings.decorative)
    s = setOrReplaceAttrOnSvg(s, "role", "img");
  else s = removeAttrOnSvg(s, "role");

  if (settings.focusableFalse)
    s = setOrReplaceAttrOnSvg(s, "focusable", "false");
  else s = removeAttrOnSvg(s, "focusable");

  // Sizing
  if (settings.responsiveMode === "responsive") {
    s = removeAttrOnSvg(s, "width");
    s = removeAttrOnSvg(s, "height");
    s = setOrReplaceAttrOnSvg(
      s,
      "style",
      mergeStyleAttr(
        getAttrFromSvg(s, "style"),
        "width:100%;height:auto;display:block;",
      ),
    );
  } else {
    if (settings.useWidth) s = setOrReplaceAttrOnSvg(s, "width", w);
    else s = removeAttrOnSvg(s, "width");

    if (settings.useHeight) s = setOrReplaceAttrOnSvg(s, "height", h);
    else s = removeAttrOnSvg(s, "height");
  }

  // Demo className for people who want to style it
  const cls = (settings.demoClassName || "").trim();
  if (cls) s = setOrReplaceAttrOnSvg(s, "class", cls);
  else s = removeAttrOnSvg(s, "class");

  // Ensure no XML/doctype junk
  s = stripXmlProlog(s);

  // Optionally pretty format (best effort)
  const indentStr =
    settings.indent === "tab" ? "\t" : " ".repeat(Number(settings.indent));
  s = prettyXmlLike(s, indentStr);

  // Use selected quote mode (convert double quotes to single if requested)
  if (q === "'") s = swapQuotesToSingle(s);

  return s.trim();
}

function generateImgSnippet(
  svg: string,
  blobUrl: string | null,
  settings: Settings,
) {
  const q = settings.quoteMode === "single" ? "'" : '"';
  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  let src = "";
  if (settings.imgSrcMode === "file-url")
    src = settings.assetUrl || "/icons/icon.svg";
  else if (settings.imgSrcMode === "blob-url") src = blobUrl || "";
  else if (settings.imgSrcMode === "data-uri-base64")
    src = toDataUriBase64(svg);
  else src = toDataUriUtf8(svg, settings.includeUtf8Charset);

  const alt = settings.decorative ? "" : settings.altText || "";
  const title = (settings.titleText || "").trim();

  const attrs: string[] = [];
  attrs.push(`src=${q}${escapeAttr(src)}${q}`);
  attrs.push(`alt=${q}${escapeAttr(alt)}${q}`);
  if (title) attrs.push(`title=${q}${escapeAttr(title)}${q}`);

  if (settings.responsiveMode === "responsive") {
    const style = `display:block;width:100%;height:auto;object-fit:${settings.fitMode === "none" ? "initial" : settings.fitMode};`;
    attrs.push(`style=${q}${escapeAttr(style)}${q}`);
  } else {
    if (settings.useWidth) attrs.push(`width=${q}${escapeAttr(w)}${q}`);
    if (settings.useHeight) attrs.push(`height=${q}${escapeAttr(h)}${q}`);
    if (settings.fitMode !== "none") {
      attrs.push(
        `style=${q}${escapeAttr(`object-fit:${settings.fitMode};`)}${q}`,
      );
    }
  }

  const code = `<img ${attrs.filter(Boolean).join(" ")} />`;
  return code;
}

function applyInlinePreviewAttrs(svg: string, settings: Settings) {
  let s = svg;

  // demo: if currentColor mode on, set wrapper color and replace fills/strokes already done in normalization
  // ensure preview has a single root <svg> and is safe to inject
  s = stripXmlProlog(s);
  s = ensureSvgHasXmlns(s);

  // Ensure focusable in preview for consistency
  if (settings.focusableFalse)
    s = setOrReplaceAttrOnSvg(s, "focusable", "false");

  // Ensure class for demo styling
  const cls = (settings.demoClassName || "").trim();
  if (cls) s = setOrReplaceAttrOnSvg(s, "class", cls);

  // Remove width/height if responsive mode
  if (settings.responsiveMode === "responsive") {
    s = removeAttrOnSvg(s, "width");
    s = removeAttrOnSvg(s, "height");
    s = setOrReplaceAttrOnSvg(
      s,
      "style",
      mergeStyleAttr(
        getAttrFromSvg(s, "style"),
        "max-width:100%;height:auto;display:block;",
      ),
    );
  }

  return s;
}

function previewSizeStyle(settings: Settings) {
  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  if (settings.responsiveMode === "responsive") {
    return { width: "100%" } as React.CSSProperties;
  }

  const style: React.CSSProperties = {};
  if (settings.useWidth) style.width = w;
  if (settings.useHeight) style.height = h;
  return style;
}

function wrapInDoc(snippet: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SVG Embed</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; }
</style>
</head>
<body>
${snippet}
</body>
</html>`;
  return html;
}

/* ========================
   SVG normalization / sanitization
======================== */
function normalizeSvg(svgText: string, settings: Settings) {
  let svg = String(svgText || "").trim();
  if (!svg) throw new Error("Paste an SVG first.");

  // Users might paste an <img ...> or a data URI. Try to recover the SVG.
  svg = coerceToSvgMarkup(svg);

  // Basic sanity
  if (!/<svg\b/i.test(svg))
    throw new Error("Could not find an <svg> root tag.");

  if (settings.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  }

  if (settings.removeMetadata) {
    svg = svg.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
  }

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
      svg = svg.replace(/\s(?:href|xlink:href)\s*=\s*javascript:[^>\s]+/gi, "");
    }
  }

  if (settings.ensureXmlns) svg = ensureSvgHasXmlns(svg);

  // Optional: remove width/height from source
  if (settings.removeWidthHeightFromSvg) {
    svg = removeAttrOnSvg(svg, "width");
    svg = removeAttrOnSvg(svg, "height");
  }

  // Ensure viewBox if missing
  if (settings.addViewBoxIfMissing) {
    svg = ensureViewBox(svg, settings.width, settings.height);
  }

  // currentColor best-effort
  if (settings.setCurrentColor) {
    svg = replaceSvgColorsWithCurrentColor(svg);
  }

  svg = svg.trim();

  return svg;
}

function coerceToSvgMarkup(input: string) {
  let t = String(input || "").trim();

  // If it's an <img src="data:image/svg+xml...">
  const imgSrc = t.match(/<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/i)?.[1];
  if (imgSrc) t = imgSrc.trim();

  // If it's a data URI
  if (/^data:image\/svg\+xml/i.test(t)) {
    return decodeSvgDataUriToSvg(t);
  }

  // If it's a quoted SVG
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  // If they pasted HTML wrapper
  const svgMatch = t.match(/<svg\b[\s\S]*<\/svg>/i);
  if (svgMatch) return svgMatch[0];

  return t;
}

function decodeSvgDataUriToSvg(dataUri: string) {
  const m = dataUri.match(/^data:([^,]*),(.*)$/is);
  if (!m) throw new Error("Invalid SVG data URI.");
  const meta = (m[1] || "").trim();
  const payload = (m[2] || "").trim();
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    const b64 = extractBase64(payload);
    return decodeBase64ToString(b64);
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    try {
      return decodeURIComponent(payload.replace(/\s+/g, ""));
    } catch {
      throw new Error("Could not decode UTF-8 SVG data URI.");
    }
  }
}

function extractBase64(s: string) {
  let t = String(s || "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/\s+/g, "");

  if (/[-_]/.test(t) && !/[+/]/.test(t)) {
    t = t.replace(/-/g, "+").replace(/_/g, "/");
    const pad = t.length % 4;
    if (pad) t += "=".repeat(4 - pad);
  }

  if (!t) throw new Error("Missing Base64 payload.");
  if (!/^[a-z0-9+/=]+$/i.test(t))
    throw new Error("Input does not look like Base64.");
  return t;
}

function decodeBase64ToString(b64: string) {
  let bin = "";
  try {
    bin = atob(b64);
  } catch {
    throw new Error("Base64 decode failed.");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;

  // Try UTF-8, fall back to Latin-1
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return s;
  }
}

function toDataUriBase64(svg: string) {
  const clean = stripXmlProlog(svg);
  const bytes = new TextEncoder().encode(clean);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(bin);
  return `data:image/svg+xml;base64,${b64}`;
}

function toDataUriUtf8(svg: string, includeCharset: boolean) {
  const clean = stripXmlProlog(svg);
  const payload = encodeSvgForUtf8DataUri(clean);
  const charset = includeCharset ? ";charset=utf-8" : "";
  return `data:image/svg+xml${charset},${payload}`;
}

function encodeSvgForUtf8DataUri(svg: string) {
  return encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%22/g, "'");
}

function stripXmlProlog(svg: string) {
  let s = String(svg || "");
  s = s.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  s = s.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");
  return s;
}

function replaceSvgColorsWithCurrentColor(svg: string) {
  let s = svg;

  const repl = (m0: string, attr: string, val: string) => {
    const v = String(val || "").trim();
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
   SVG parsing
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const bytes = new Blob([svg]).size;
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const hasScripts = /<script\b/i.test(svg);
  const hasForeignObject = /<foreignObject\b/i.test(svg);
  const hasEvents = /\son[a-z]+\s*=\s*/i.test(svg);
  const hasComments = /<!--[\s\S]*?-->/.test(svg);
  const hasMetadata = /<metadata\b/i.test(svg);

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    hasScripts,
    hasForeignObject,
    hasEvents,
    hasComments,
    hasMetadata,
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

function getAttrFromSvg(svg: string, name: string) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return "";
  return matchAttr(openMatch[0], name) || "";
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

function mergeStyleAttr(existing: string, addition: string) {
  const a = String(addition || "").trim();
  if (!a) return existing || "";
  const e = String(existing || "").trim();
  if (!e) return a;
  const eNorm = e.endsWith(";") ? e : `${e};`;
  return `${eNorm}${a}`;
}

function ensureInlineTitle(svg: string, title: string) {
  const t = String(title || "").trim();
  if (!t) return svg;

  let s = removeInlineTitle(svg);
  const openMatch = s.match(/<svg\b[^>]*>/i);
  if (!openMatch) return s;

  const open = openMatch[0];
  const titleTag = `<title>${escapeXmlText(t)}</title>`;
  return s.replace(open, `${open}${titleTag}`);
}

function removeInlineTitle(svg: string) {
  return svg.replace(/<title\b[\s\S]*?<\/title>/gi, "");
}

function swapQuotesToSingle(markup: string) {
  // Best-effort, avoids breaking already-escaped quotes
  return markup.replace(
    /="([^"]*)"/g,
    (_m, v) => `='${String(v).replace(/'/g, "&#39;")}'`,
  );
}

/* ========================
   Text helpers
======================== */
function escapeAttr(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlText(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLen(raw: string): number | null {
  const m = String(raw || "")
    .trim()
    .match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function clampInt(v: number, lo: number, hi: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeClassName(s: string) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t
    .split(/\s+/g)
    .map((x) => x.replace(/[^\w\-:]/g, ""))
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ========================
   Formatting helpers
======================== */
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
        "px-2 py-1 rounded-lg border text-[12px] font-semibold",
        checked
          ? "bg-[#eff4ff] border-[#d6e4ff] text-slate-900"
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
  value: SizeUnit;
  onChange: (v: SizeUnit) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as any)}
      className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
        name: "Inline SVG vs img",
        item: `${baseUrl}/inline-svg-vs-img`,
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
        name: "What is the difference between inline SVG and <img>?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Inline SVG inserts the <svg> markup directly into the page, which allows styling internal shapes with CSS and manipulating elements with JavaScript. Using <img> links to an SVG file or data URI, which is simpler and cache-friendly but does not allow styling the SVG’s internal paths with CSS.",
        },
      },
      {
        "@type": "Question",
        name: "Which is better for icons: inline SVG or <img>?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Inline SVG is better when you need currentColor, hover states, or per-path styling. <img> is better when you want simple embedding, strong caching, and you do not need to style internal shapes.",
        },
      },
      {
        "@type": "Question",
        name: "Can I change the color of an SVG used in an <img> tag?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Not reliably. You can style the <img> element itself, but you cannot directly target the SVG’s internal paths with CSS. For currentColor icons, inline SVG is the usual solution.",
        },
      },
      {
        "@type": "Question",
        name: "Is it safe to inline SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Untrusted SVG can include scripts, event handlers, or foreignObject content. If you inline SVG you should sanitize it first by removing risky elements and attributes.",
        },
      },
      {
        "@type": "Question",
        name: "Do you upload my SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Everything runs client-side in your browser. Nothing is uploaded to a server.",
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
            Inline SVG vs {"<img>"}: Which should you use?
          </h2>
          <p className="mt-3">
            People searching for <strong>inline SVG vs img</strong> usually want
            one thing: the right embed method for icons, logos, and UI graphics.
            Inline SVG gives you full control over styling and accessibility
            because the SVG markup lives in the DOM. The {"<img>"} tag is simple
            and cache-friendly because it references a file URL (or a data URI)
            but you cannot style the internal SVG paths with CSS.
          </p>
          <p>
            This page lets you <strong>preview both methods</strong>, test{" "}
            <strong>currentColor</strong> behavior, generate clean snippets, and
            apply safe sanitization options before you ship.
          </p>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to choose between inline SVG and {"<img>"}
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Paste or upload an SVG.</li>
              <li itemProp="step">
                Enable currentColor if you want themeable icons.
              </li>
              <li itemProp="step">
                Compare previews and copy the snippet that matches your needs.
              </li>
              <li itemProp="step">
                Keep sanitization enabled for any untrusted SVG.
              </li>
            </ol>
          </section>
        </article>
      </div>

      <JsonLdBreadcrumbs />
      <JsonLdFaq />
    </section>
  );
}
