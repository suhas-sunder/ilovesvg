import * as React from "react";
import type { Route } from "./+types/svg-to-base64";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "i🩵SVG  -  SVG to Base64 (data URI) Converter";
  const description =
    "Convert SVG to Base64 instantly in your browser. Generate data:image/svg+xml;base64, URLs, choose encoding options, sanitize scripts, minify, and copy or download. No uploads, no server.";
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
type OutputFormat = "data-uri-base64" | "base64-only" | "data-uri-utf8";
type QuoteMode = "double" | "single" | "none";

type Settings = {
  output: OutputFormat;

  // Preprocess
  sanitize: boolean;
  stripScripts: boolean;
  stripForeignObject: boolean;
  stripEventHandlers: boolean;
  stripJavascriptHrefs: boolean;

  // Minify
  minifyWhitespace: boolean;
  collapseStyle: boolean;

  // Encoding
  lineWrap: boolean;
  wrapAt: number;
  urlSafe: boolean; // base64url (replace +/ with -_ and strip =)
  includePrefix: boolean; // for base64-only output, optionally prepend "data:..." anyway
  mime: "image/svg+xml" | "image/svg+xml;charset=utf-8";

  // Data URI (utf8) options
  utf8EncodeMode: "minimal" | "css-safe";

  // Friendly
  fileName: string;
  showPreview: boolean;
  copyWithQuotes: boolean;
  quoteMode: QuoteMode;
};

type SvgInfo = {
  bytes: number;
  viewBox?: string;
  widthRaw?: string;
  heightRaw?: string;
  hasScripts?: boolean;
  hasForeignObject?: boolean;
};

const DEFAULTS: Settings = {
  output: "data-uri-base64",

  sanitize: true,
  stripScripts: true,
  stripForeignObject: false,
  stripEventHandlers: true,
  stripJavascriptHrefs: true,

  minifyWhitespace: true,
  collapseStyle: true,

  lineWrap: false,
  wrapAt: 76,
  urlSafe: false,
  includePrefix: true,
  mime: "image/svg+xml",

  utf8EncodeMode: "minimal",

  fileName: "svg-base64",
  showPreview: true,
  copyWithQuotes: false,
  quoteMode: "double",
};

/* ========================
   Page
======================== */
export default function SvgToBase64(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [outText, setOutText] = React.useState<string>("");
  const [outLen, setOutLen] = React.useState<number>(0);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    setOutText("");
    setOutLen(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

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

    const baseName = stripExt(f.name) || "svg-base64";
    setSettings((s) => ({ ...s, fileName: baseName }));

    // initial convert
    tryConvert(coerced);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setSvgText("");
    setInfo(null);
    setOutText("");
    setOutLen(0);
    setErr(null);
    setPreviewUrl(null);
  }

  function tryConvert(currentSvg = svgText) {
    setErr(null);
    try {
      const processed = preprocessSvg(currentSvg, settings);
      const result = toOutput(processed, settings);

      setOutText(result);
      setOutLen(result.length);

      if (settings.showPreview) {
        const safeForPreview =
          settings.output === "data-uri-base64"
            ? result
            : settings.output === "data-uri-utf8"
              ? result
              : settings.includePrefix
                ? `data:${settings.mime};base64,${result}`
                : "";

        if (!safeForPreview) {
          setPreviewUrl((u) => {
            if (u) URL.revokeObjectURL(u);
            return null;
          });
        } else {
          setPreviewUrl((u) => {
            if (u) URL.revokeObjectURL(u);
            return URL.createObjectURL(
              new Blob([safeForPreview], { type: "text/plain;charset=utf-8" }),
            );
          });
        }
      } else {
        setPreviewUrl((u) => {
          if (u) URL.revokeObjectURL(u);
          return null;
        });
      }
    } catch (e: any) {
      setErr(e?.message || "Conversion failed.");
      setOutText("");
      setOutLen(0);
    }
  }

  React.useEffect(() => {
    if (!svgText) return;
    tryConvert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, svgText]);

  function copyOutput() {
    if (!outText) return;
    const t = settings.copyWithQuotes
      ? wrapQuotes(outText, settings.quoteMode)
      : outText;
    navigator.clipboard.writeText(t).then(() => showToast("Copied"));
  }

  function downloadOutput() {
    if (!outText) return;
    const name = (settings.fileName || "svg-base64").trim() || "svg-base64";

    const ext =
      settings.output === "base64-only"
        ? "txt"
        : settings.output === "data-uri-utf8"
          ? "txt"
          : "txt";

    const filename = `${safeFileName(name)}.${ext}`;
    downloadText(outText, filename);
    showToast("Downloaded");
  }

  function copyCssSnippet() {
    if (!outText) return;
    const uri =
      settings.output === "base64-only"
        ? settings.includePrefix
          ? `data:${settings.mime};base64,${outText}`
          : outText
        : outText;

    const snippet = `background-image: url("${escapeQuotes(uri)}");`;
    navigator.clipboard.writeText(snippet).then(() => showToast("Copied CSS"));
  }

  function copyHtmlSnippet() {
    if (!outText) return;
    const uri =
      settings.output === "base64-only"
        ? settings.includePrefix
          ? `data:${settings.mime};base64,${outText}`
          : outText
        : outText;

    const snippet = `<img src="${escapeQuotes(uri)}" alt="SVG" />`;
    navigator.clipboard.writeText(snippet).then(() => showToast("Copied HTML"));
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG to Base64", href: "/svg-to-base64" },
  ];

  const inputBytes = info?.bytes ?? (svgText ? new Blob([svgText]).size : 0);

  const previewDataUri =
    settings.output === "data-uri-base64"
      ? outText
      : settings.output === "data-uri-utf8"
        ? outText
        : settings.includePrefix
          ? `data:${settings.mime};base64,${outText}`
          : "";

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
              <span className="text-slate-400">to</span>
              <span className="text-[#0b2dff]">Base64</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Convert SVG files into Base64 or Data URI strings instantly. Runs
              fully client-side, no uploads.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
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
                  className="border border-dashed border-[#c8d3ea] rounded-2xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
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
                      Detected: <b>{formatBytes(inputBytes)}</b>
                      {info.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          • viewBox {info.viewBox}
                        </span>
                      ) : null}
                      {info.widthRaw || info.heightRaw ? (
                        <span className="text-slate-500">
                          {" "}
                          • {info.widthRaw || "?"} × {info.heightRaw || "?"}
                        </span>
                      ) : null}
                    </div>
                  )}
                </>
              )}

              {file && (
                <details className="mt-3 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                    Advanced: Edit SVG source
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-slate-600 mt-2">
                      Optional. Output updates instantly.
                    </p>
                    <textarea
                      value={svgText}
                      onChange={(e) => {
                        const next = e.target.value as OutputFormat;
                        setSettings((s) => ({
                          ...s,
                          output: next,
                          mime:
                            next === "data-uri-utf8"
                              ? "image/svg+xml;charset=utf-8"
                              : s.mime,
                        }));
                      }}
                      className="mt-2 w-full h-[280px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  </div>
                </details>
              )}

              {/* Quick tips */}
              <div className="mt-3 text-[13px] text-slate-600">
                Tips: Use <b>Data URI (Base64)</b> for HTML <code>img src</code>
                , CSS <code>url()</code>, and inline assets. Use{" "}
                <b>Data URI (UTF-8)</b> if you want a readable URI for small
                SVGs.
              </div>
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Output Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Output format">
                    <select
                      value={settings.output}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          output: e.target.value as OutputFormat,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="data-uri-base64">
                        Data URI (Base64): data:image/svg+xml;base64,...
                      </option>
                      <option value="base64-only">Base64 only</option>
                      <option value="data-uri-utf8">
                        Data URI (UTF-8): data:image/svg+xml,...
                      </option>
                    </select>
                  </Field>

                  <Field label="MIME type">
                    <select
                      value={settings.mime}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          mime: e.target.value as any,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="image/svg+xml">image/svg+xml</option>
                      <option value="image/svg+xml;charset=utf-8">
                        image/svg+xml;charset=utf-8
                      </option>
                    </select>
                    <span className="text-[12px] text-slate-500 shrink-0">
                      Common default
                    </span>
                  </Field>

                  {settings.output === "base64-only" && (
                    <Field label="Include prefix">
                      <input
                        type="checkbox"
                        checked={settings.includePrefix}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            includePrefix: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] shrink-0"
                      />
                      <span className="text-[13px] text-slate-700 min-w-0">
                        Also generate data:...;base64, for previews/snippets
                      </span>
                    </Field>
                  )}

                  {settings.output === "data-uri-utf8" && (
                    <Field label="UTF-8 encode mode">
                      <select
                        value={settings.utf8EncodeMode}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            utf8EncodeMode: e.target.value as any,
                          }))
                        }
                        className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                      >
                        <option value="minimal">Minimal (safe in HTML)</option>
                        <option value="css-safe">CSS-safe (escape more)</option>
                      </select>
                    </Field>
                  )}

                  <Field label="Sanitize">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={settings.sanitize}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            sanitize: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] shrink-0"
                      />
                      <span className="text-[13px] text-slate-700 min-w-0">
                        Remove risky content (recommended)
                      </span>
                    </div>
                  </Field>

                  {settings.sanitize && (
                    <Field label="Sanitize options">
                      <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                        <ToggleRow
                          checked={settings.stripScripts}
                          onChange={(v) =>
                            setSettings((s) => ({ ...s, stripScripts: v }))
                          }
                          label="Strip <script> blocks"
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
                        <ToggleRow
                          checked={settings.stripEventHandlers}
                          onChange={(v) =>
                            setSettings((s) => ({
                              ...s,
                              stripEventHandlers: v,
                            }))
                          }
                          label="Strip on* event handlers"
                        />
                        <ToggleRow
                          checked={settings.stripJavascriptHrefs}
                          onChange={(v) =>
                            setSettings((s) => ({
                              ...s,
                              stripJavascriptHrefs: v,
                            }))
                          }
                          label="Strip javascript: links"
                        />
                      </div>
                    </Field>
                  )}

                  <Field label="Minify">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.minifyWhitespace}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, minifyWhitespace: v }))
                        }
                        label="Minify whitespace (light)"
                      />
                      <ToggleRow
                        checked={settings.collapseStyle}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, collapseStyle: v }))
                        }
                        label='Clean style="" spacing'
                      />
                    </div>
                  </Field>

                  <Field label="Base64 options">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.urlSafe}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, urlSafe: v }))
                        }
                        label="URL-safe Base64 (base64url)"
                      />
                      <ToggleRow
                        checked={settings.lineWrap}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, lineWrap: v }))
                        }
                        label="Wrap lines"
                      />
                      {settings.lineWrap && (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-slate-600">
                            Wrap at
                          </span>
                          <input
                            type="number"
                            min={20}
                            max={200}
                            value={settings.wrapAt}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                wrapAt: clampInt(
                                  Number(e.target.value),
                                  20,
                                  200,
                                ),
                              }))
                            }
                            className="w-[92px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          />
                          <span className="text-[12px] text-slate-600">
                            chars
                          </span>
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label="Preview">
                    <input
                      type="checkbox"
                      checked={settings.showPreview}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          showPreview: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Show rendered preview
                    </span>
                  </Field>

                  <Field label="Copy wrapping">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.copyWithQuotes}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, copyWithQuotes: v }))
                        }
                        label="Copy with quotes"
                      />
                      {settings.copyWithQuotes && (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-slate-600">
                            Quote style
                          </span>
                          <select
                            value={settings.quoteMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                quoteMode: e.target.value as QuoteMode,
                              }))
                            }
                            className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          >
                            <option value="double">"</option>
                            <option value="single">'</option>
                            <option value="none">(none)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label="Output filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="svg-base64"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={copyOutput}
                    disabled={!hydrated || !outText}
                    className={[
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Copy Output
                  </button>

                  <button
                    type="button"
                    onClick={downloadOutput}
                    disabled={!hydrated || !outText}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download Output
                  </button>

                  <button
                    type="button"
                    onClick={copyCssSnippet}
                    disabled={!hydrated || !outText}
                    className="px-3.5 py-2 rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                    title="Copy background-image: url(...)"
                  >
                    Copy CSS
                  </button>

                  <button
                    type="button"
                    onClick={copyHtmlSnippet}
                    disabled={!hydrated || !outText}
                    className="px-3.5 py-2 rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                    title="Copy <img src=...>"
                  >
                    Copy HTML
                  </button>

                  {err && <span className="text-red-700 text-sm">{err}</span>}

                  {!err && outText && (
                    <span className="text-[13px] text-slate-600">
                      Output length: <b>{formatNumber(outLen)}</b> chars
                    </span>
                  )}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Notes: Base64 increases size by about 33%. If you are using
                  CSS
                  <code> url()</code>, consider <b>Data URI (UTF-8)</b> for
                  small SVGs.
                </div>
              </div>

              {/* OUTPUT TEXT */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <span>Output</span>
                  {outText ? (
                    <span className="text-[12px] text-slate-500 truncate">
                      {settings.output === "base64-only"
                        ? "Base64 string"
                        : settings.output === "data-uri-utf8"
                          ? "Data URI (UTF-8)"
                          : "Data URI (Base64)"}
                    </span>
                  ) : null}
                </div>
                <div className="p-3">
                  <textarea
                    value={outText}
                    readOnly
                    className="w-full h-[240px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* PREVIEW */}
              {settings.showPreview && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Preview
                  </div>
                  <div className="p-3">
                    {previewDataUri ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <img
                          src={previewDataUri}
                          alt="SVG preview"
                          className="w-full h-auto block"
                        />
                      </div>
                    ) : (
                      <div className="text-slate-600 text-sm">
                        Preview is unavailable for this output mode without a
                        data URI prefix.
                      </div>
                    )}
                  </div>
                </div>
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
   Core conversion
======================== */
function preprocessSvg(svgText: string, settings: Settings) {
  let svg = ensureSvgHasXmlns(svgText);

  // Normalize newlines
  svg = svg.replace(/\r\n?/g, "\n");

  if (settings.sanitize) {
    if (settings.stripScripts) {
      // Remove any <script> blocks (case-insensitive, multiline)
      svg = svg.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
      // Remove any self-closing script tags just in case
      svg = svg.replace(/<script\b[^>]*\/\s*>/gi, "");
    }

    if (settings.stripForeignObject) {
      svg = svg.replace(
        /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi,
        "",
      );
      svg = svg.replace(/<foreignObject\b[^>]*\/\s*>/gi, "");
    }

    if (settings.stripEventHandlers) {
      // Remove on* handlers with "double", 'single', or unquoted values
      // Example: onload="..."  onclick='...'  onfocus=something()
      svg = svg.replace(
        /\s(on[a-zA-Z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g,
        "",
      );
    }

    if (settings.stripJavascriptHrefs) {
      // Remove href/xlink:href that begin with javascript: (allow whitespace + entities)
      // Also strips encoded "javascript:" via common obfuscation patterns
      svg = svg.replace(
        /\s(?:href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
        (m) => {
          const valMatch = m.match(/=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
          const raw = (valMatch?.[1] || valMatch?.[2] || valMatch?.[3] || "")
            .trim()
            .replace(/^['"]|['"]$/g, "");

          const decodedLite = raw
            .replace(/&#x3a;|&#58;|:/gi, ":")
            .replace(/&#x6a;|&#106;|j/gi, (x) => x)
            .toLowerCase()
            .replace(/\s+/g, "");

          if (decodedLite.startsWith("javascript:")) return "";
          return m;
        },
      );

      // Also remove javascript: inside url(...) in inline styles
      svg = svg.replace(
        /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi,
        (full, wrap, d, s) => {
          const style = (d ?? s ?? "").replace(
            /url\(\s*(['"])?\s*javascript:[\s\S]*?\1\s*\)/gi,
            "url()",
          );
          return style.trim() ? ` style="${style}"` : "";
        },
      );
    }
  }

  if (settings.collapseStyle) {
    svg = svg.replace(/\sstyle\s*=\s*["']([^"']*)["']/gi, (m, style) => {
      const cleaned = String(style)
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .join("; ");
      return cleaned ? ` style="${cleaned}"` : "";
    });
  }

  if (settings.minifyWhitespace) {
    svg = svg
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return svg;
}

function toOutput(svg: string, settings: Settings) {
  if (settings.output === "data-uri-utf8") {
    const encoded = encodeSvgForDataUri(svg, settings.utf8EncodeMode);
    return `data:${settings.mime},${encoded}`;
  }

  const b64 = base64EncodeUtf8(svg);

  const allowUrlSafe = settings.output === "base64-only" && settings.urlSafe;

  const finalB64 = allowUrlSafe ? toBase64Url(b64) : b64;
  const wrapped = settings.lineWrap
    ? wrapLines(finalB64, settings.wrapAt)
    : finalB64;

  if (settings.output === "base64-only") return wrapped;

  // data-uri-base64
  return `data:${settings.mime};base64,${wrapped}`;
}

/* ========================
   Encoding helpers
======================== */
function base64EncodeUtf8(s: string) {
  // Correct UTF-8 base64 encoding in browser
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function toBase64Url(b64: string) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function wrapLines(s: string, at: number) {
  const n = clampInt(at, 20, 200);
  if (s.length <= n) return s;
  let out = "";
  for (let i = 0; i < s.length; i += n) out += s.slice(i, i + n) + "\n";
  return out.trimEnd();
}

function encodeSvgForDataUri(svg: string, mode: "minimal" | "css-safe") {
  // Minimal is safe for HTML attributes and most JS usage.
  // CSS-safe escapes more characters commonly problematic in url()
  let out = svg;

  // Ensure no unescaped # (can be treated as fragment)
  // Also escape % first to avoid double encoding
  out = out.replace(/%/g, "%25");

  if (mode === "css-safe") {
    // Aggressive set for CSS url()
    out = out
      .replace(/</g, "%3C")
      .replace(/>/g, "%3E")
      .replace(/"/g, "%22")
      .replace(/'/g, "%27")
      .replace(/\s+/g, " ")
      .replace(/#/g, "%23")
      .replace(/{/g, "%7B")
      .replace(/}/g, "%7D")
      .replace(/\|/g, "%7C")
      .replace(/\\/g, "%5C")
      .replace(/\^/g, "%5E")
      .replace(/`/g, "%60")
      .replace(/\[/g, "%5B")
      .replace(/\]/g, "%5D");
  } else {
    // Minimal set
    out = out
      .replace(/</g, "%3C")
      .replace(/>/g, "%3E")
      .replace(/"/g, "%22")
      .replace(/#/g, "%23");
  }

  // keep commas, slashes, colons etc readable
  return out.trim();
}

/* ========================
   SVG parsing helpers
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const coerced = ensureSvgHasXmlns(svg);
  const bytes = new Blob([coerced]).size;

  const open = coerced.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const hasScripts =
    /<script\b/i.test(coerced) || /\son[a-z]+\s*=\s*/i.test(coerced);
  const hasForeignObject = /<foreignObject\b/i.test(coerced);

  return { bytes, viewBox, widthRaw, heightRaw, hasScripts, hasForeignObject };
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
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
    name
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "svg-base64"
  );
}

function clampInt(v: number, lo: number, hi: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString();
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeQuotes(s: string) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function wrapQuotes(s: string, mode: QuoteMode) {
  if (mode === "none") return s;
  if (mode === "single") return `'${s.replace(/'/g, "\\'")}'`;
  return `"${s.replace(/"/g, '\\"')}"`;
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
                href="/svg-to-base64"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to Base64
              </a>
            </li>
            <li>
              <a
                href="/svg-minify"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Minify
              </a>
            </li>
            <li>
              <a
                href="/svg-preview-viewer"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Viewer
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
        name: "SVG to Base64",
        item: `${baseUrl}/svg-to-base64`,
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
        name: "How do I convert SVG to Base64?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Upload an SVG and the tool generates a Base64 string or a full data:image/svg+xml;base64, data URI instantly in your browser. You can copy or download the output.",
        },
      },
      {
        "@type": "Question",
        name: "What is an SVG Base64 data URI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A data URI embeds the SVG content directly in HTML or CSS. It usually starts with data:image/svg+xml;base64, followed by the Base64-encoded SVG.",
        },
      },
      {
        "@type": "Question",
        name: "Should I use Base64 or UTF-8 data URIs for SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Base64 is widely compatible but increases size. UTF-8 data URIs can be smaller and readable for simple SVGs, especially for CSS usage.",
        },
      },
      {
        "@type": "Question",
        name: "Does this tool upload my SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Everything runs client-side in your browser. Your SVG is not uploaded to any server.",
        },
      },
      {
        "@type": "Question",
        name: "Can I use the output in CSS background-image?",
        acceptedAnswer: {
          "@type": "Answer",
          text: 'Yes. Use the Copy CSS button to get a ready-to-paste background-image: url("...") snippet.',
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
          <h2 className="m-0 font-bold">SVG to Base64 Converter (Data URI)</h2>

          <p className="mt-3">
            Convert an <strong>SVG to Base64</strong> or generate a full{" "}
            <strong>SVG data URI</strong> for HTML, CSS, and JavaScript. The
            most common output format starts with{" "}
            <code>data:image/svg+xml;base64,</code> followed by the
            Base64-encoded SVG. Everything runs locally in your browser, so your
            SVG is not uploaded.
          </p>

          <div className="mt-6 not-prose grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">HTML</div>
              <div className="mt-1 text-sm text-slate-700">
                Use in <code>&lt;img src="..." /&gt;</code> or inline demos.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">CSS</div>
              <div className="mt-1 text-sm text-slate-700">
                Use in <code>background-image: url(...)</code>.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">JS</div>
              <div className="mt-1 text-sm text-slate-700">
                Store in JSON, configs, or UI theme assets.
              </div>
            </div>
          </div>

          <section
            className="mt-10"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Convert SVG to Base64
            </h3>
            <p className="mt-2" itemProp="description">
              Generate a Base64 string or a data URI for your SVG in seconds.
            </p>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload, paste, or edit your SVG source.</li>
              <li itemProp="step">
                Choose an output format: <strong>Data URI (Base64)</strong>,{" "}
                <strong>Base64 only</strong>, or{" "}
                <strong>Data URI (UTF-8)</strong>.
              </li>
              <li itemProp="step">
                (Recommended) Enable sanitizing and light minification.
              </li>
              <li itemProp="step">
                Copy the result or download it as a text file.
              </li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Base64 vs UTF-8 Data URI</h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">Base64 data URIs</h4>
                <p className="mt-1">
                  Base64 is the most compatible option across browsers and
                  tooling, but it increases output size (often about one third
                  bigger than the original). Use it when you want fewer
                  surprises.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">UTF-8 data URIs</h4>
                <p className="mt-1">
                  UTF-8 data URIs can be smaller for simple SVG icons and remain
                  readable. For CSS usage, the CSS-safe mode escapes extra
                  characters that may break <code>url()</code>.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Common Use Cases</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Embedding icons into CSS themes without separate files</li>
              <li>Shipping a single-file HTML demo with no asset requests</li>
              <li>Storing small SVGs inside JSON, configs, or localStorage</li>
              <li>
                Generating quick <code>&lt;img&gt;</code> snippets for docs
              </li>
              <li>
                Inlining assets for email templates or limited environments
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Security Notes</h3>
            <p className="mt-3">
              SVG can contain scripts, event handlers, and risky links. If you
              plan to embed untrusted SVG content, keep sanitizing enabled to
              remove <code>&lt;script&gt;</code>, inline <code>on*</code>{" "}
              handlers, and <code>javascript:</code> URLs before encoding.
            </p>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Troubleshooting</h3>
            <div className="mt-3 grid gap-4 text-slate-700">
              <div>
                <h4 className="m-0 font-bold">
                  My CSS background-image does not render
                </h4>
                <p className="mt-1">
                  Try <strong>Data URI (UTF-8)</strong> with{" "}
                  <strong>CSS-safe</strong> encoding. Also confirm the URI is
                  wrapped in quotes inside <code>url("...")</code>.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">The output is huge</h4>
                <p className="mt-1">
                  Enable whitespace minification and style cleanup. For simple
                  icons, UTF-8 mode may reduce size compared to Base64.
                </p>
              </div>
              <div>
                <h4 className="m-0 font-bold">Preview is blank</h4>
                <p className="mt-1">
                  Preview requires a full data URI. If you selected Base64-only,
                  enable “Include prefix” or switch to a data URI output mode.
                </p>
              </div>
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
                  href="/svg-minify"
                >
                  SVG Minifier
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-preview-viewer"
                >
                  SVG Viewer
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-resize-and-scale-editor"
                >
                  SVG Resize / Scale
                </a>
                <a
                  className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  href="/svg-recolor"
                >
                  SVG Recolor
                </a>
              </div>
            </div>
          </section>
        </article>

        <section className="mt-10">
          <h3 className="m-0 font-bold">FAQ</h3>

          <div className="not-prose mt-3 grid gap-3">
            <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                <span>How do I convert SVG to Base64?</span>
                <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                  +
                </span>
              </summary>
              <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                Upload an SVG and the tool generates a Base64 string or a full{" "}
                <code>data:image/svg+xml;base64,...</code> data URI instantly.
                Then copy or download the output.
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                <span>What is an SVG Base64 data URI?</span>
                <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                  +
                </span>
              </summary>
              <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                A data URI embeds the SVG content directly in HTML or CSS. It
                usually starts with <code>data:image/svg+xml;base64,</code>{" "}
                followed by the Base64-encoded SVG.
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                <span>Should I use Base64 or UTF-8 data URIs for SVG?</span>
                <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                  +
                </span>
              </summary>
              <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                Base64 is widely compatible but increases size. UTF-8 data URIs
                can be smaller and readable for simple SVGs, especially for CSS
                usage. If you use CSS <code>url()</code>, pick the CSS-safe
                UTF-8 mode.
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                <span>Does this tool upload my SVG?</span>
                <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                  +
                </span>
              </summary>
              <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                No. Everything runs client-side in your browser. Your SVG is not
                uploaded to any server.
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                <span>Can I use the output in CSS background-image?</span>
                <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                  +
                </span>
              </summary>
              <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                Yes. Use the Copy CSS button to get a ready-to-paste{" "}
                <code>background-image: url("...");</code> snippet.
              </div>
            </details>
          </div>
        </section>
      </div>
    </section>
  );
}
