import * as React from "react";
import type { Route } from "./+types/base64-to-svg";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | Base64 to SVG Decoder (Data URI to SVG)";
  const description =
    "Decode Base64 or Data URI SVG instantly in your browser with ilovesvg. Paste a Base64 string, <img src>, CSS url(...), or data:image/svg+xml;base64 value. Preview safely, sanitize the SVG, and download the file. Free, client-side only, no uploads.";
  const canonical = "https://www.ilovesvg.com/base64-to-svg";

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
type SourceMode = "auto" | "data-uri" | "base64-only";
type DecodeMode = "auto" | "utf8" | "latin1";
type QuoteMode = "double" | "single" | "none";

type RasterImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

type Settings = {
  sourceMode: SourceMode;
  decodeMode: DecodeMode;

  sanitize: boolean;
  stripScripts: boolean;
  stripForeignObject: boolean;
  stripEventHandlers: boolean;
  stripJavascriptHrefs: boolean;

  normalizeNewlines: boolean;
  minifyWhitespace: boolean;

  ensureXmlns: boolean;
  pretty: boolean;
  showPreview: boolean;

  fileName: string;

  copyWithQuotes: boolean;
  quoteMode: QuoteMode;
};

type SvgInfo = {
  bytes: number;
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;

  hasScripts?: boolean;
  hasForeignObject?: boolean;
};

type DecodeResult =
  | {
      kind: "svg";
      mime: "image/svg+xml";
      text: string;
      dataUrl: string;
      extension: "svg";
      bytes: number;
    }
  | {
      kind: "image";
      mime: RasterImageMime;
      text: string;
      dataUrl: string;
      extension: "png" | "jpg" | "gif" | "webp";
      bytes: number;
    };

const DEFAULTS: Settings = {
  sourceMode: "auto",
  decodeMode: "auto",

  sanitize: true,
  stripScripts: true,
  stripForeignObject: false,
  stripEventHandlers: true,
  stripJavascriptHrefs: true,

  normalizeNewlines: true,
  minifyWhitespace: false,

  ensureXmlns: true,
  pretty: true,
  showPreview: true,

  fileName: "decoded",

  copyWithQuotes: false,
  quoteMode: "double",
};

const FAQ_ITEMS = [
  {
    q: "What can I paste into this Base64 to SVG tool?",
    a: 'You can paste a Base64 string, a full data:image/svg+xml;base64 URL, an <img src="..."> snippet, CSS url("data:...") text, or a larger chunk of code that contains a data URL. The tool will automatically extract the SVG data and decode it.',
  },
  {
    q: "Can this decode an SVG data URI that is not Base64?",
    a: "Yes. If the data URI is UTF-8 or percent-encoded (data:image/svg+xml,<svg...>), the tool can decode it and restore the SVG.",
  },
  {
    q: "Why does my decoded SVG look broken?",
    a: "Some Base64 strings were created with a different character encoding. Try switching Decode mode to UTF-8 or Latin-1. Also disable sanitization if it removed scripts or foreignObject that your SVG depends on.",
  },
  {
    q: "Does this tool upload my Base64 or SVG?",
    a: "No. Everything runs client-side in your browser. Nothing is uploaded to a server.",
  },
  {
    q: "Is it safe to decode and preview SVGs?",
    a: "SVG can contain scripts or event handlers. Use the sanitization options to strip risky content before previewing or downloading.",
  },
];

/* ========================
   Page
======================== */
export default function Base64ToSvg(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [showDecodeMenu, setShowDecodeMenu] = React.useState(false);

  const [input, setInput] = React.useState<string>("");
  const [result, setResult] = React.useState<DecodeResult | null>(null);
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const toastTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current != null)
      window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1500);
  }

  function clearAll() {
    setInput("");
    setResult(null);
    setInfo(null);
    setErr(null);
  }

  function tryDecode(current = input) {
    setErr(null);

    try {
      const decoded = decodeInput(current, settings);
      setResult(decoded);
      setInfo(decoded.kind === "svg" ? parseSvgInfo(decoded.text) : null);
    } catch (e: any) {
      setErr(e?.message || "Decode failed.");
      setResult(null);
      setInfo(null);
    }
  }

  React.useEffect(() => {
    if (!input.trim()) {
      setResult(null);
      setInfo(null);
      setErr(null);
      return;
    }

    tryDecode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, input]);

  function copyDecodedCode() {
    if (!result) return;

    const value =
      result.kind === "svg"
        ? settings.copyWithQuotes
          ? wrapQuotes(result.text, settings.quoteMode)
          : result.text
        : result.dataUrl;

    navigator.clipboard
      .writeText(value)
      .then(() =>
        showToast(
          result.kind === "svg"
            ? "Decoded SVG copied"
            : "Image data URL copied",
        ),
      )
      .catch(() => showToast("Copy failed"));
  }

  function copyDataUrl() {
    if (!result) return;

    navigator.clipboard
      .writeText(result.dataUrl)
      .then(() => showToast("Data URL copied"))
      .catch(() => showToast("Copy failed"));
  }

  function copyCss() {
    if (!result) return;

    const value = `background-image: url("${result.dataUrl}");`;

    navigator.clipboard
      .writeText(value)
      .then(() => showToast("CSS copied"))
      .catch(() => showToast("Copy failed"));
  }

  function copyHtml() {
    if (!result) return;

    const alt = result.kind === "svg" ? "Decoded SVG" : "Decoded image";
    const value = `<img src="${result.dataUrl}" alt="${alt}">`;

    navigator.clipboard
      .writeText(value)
      .then(() => showToast("HTML copied"))
      .catch(() => showToast("Copy failed"));
  }

  function downloadDecoded() {
    if (!result) return;

    const name = (settings.fileName || "decoded").trim() || "decoded";
    const filename = `${safeFileName(name)}.${result.extension}`;

    if (result.kind === "svg") {
      downloadText(result.text, filename);
      showToast("SVG downloaded");
      return;
    }

    downloadDataUrl(result.dataUrl, filename);
    showToast("Image downloaded");
  }

  function pasteExample() {
    const example =
      '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iIzBiMmRmZiIvPjwvc3ZnPg==">';
    setInput(example);
    showToast("Example loaded");
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Base64 to SVG", href: "/base64-to-svg" },
  ];

  return (
    <>
      <main className=" bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 lg:pt-0">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="inline-flex text-sky-800 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                  Base64 to SVG
                </h1>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Paste here... (Example: <img src="data:image/svg+xml;base64,...">)'
                className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-sky-50 px-3 py-2 font-mono text-[12px] text-slate-900"
                spellCheck={false}
              />

              <div className="flex justify-end w-full gap-2">
                <button
                  type="button"
                  onClick={pasteExample}
                  className="cursor-pointer px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-900"
                >
                  Load example
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="cursor-pointer px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                >
                  Clear
                </button>
              </div>

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}

              <p className="hidden md:block mt-2 text-slate-600">
                Paste Base64, a <b>data:image/svg+xml</b> URL, an{" "}
                <b>&lt;img src="..."&gt;</b> snippet, CSS <b>url(...)</b>, or a
                Base64-encoded image. Runs fully client-side.
              </p>

              <div className="hidden md:block mt-3 text-[13px] text-slate-600">
                Try this:
                <code className="ml-1 break-all">
                  data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=
                </code>
              </div>
            </div>

            <div className="bg-slate-600 border border-slate-200 rounded-2xl px-4 py-4 shadow-sm min-w-0 overflow-auto">
              <div className="rounded-2xl bg-white p-4">
                <h2 className="text-xl font-extrabold text-sky-800">
                  Output Settings
                </h2>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copyDecodedCode}
                    disabled={!hydrated || !result}
                    className="flex cursor-pointer items-center justify-center rounded-xl border border-sky-600 bg-sky-500 px-4 py-2 font-bold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icons
                      name="copy"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    Copy Output
                  </button>

                  <button
                    type="button"
                    onClick={downloadDecoded}
                    disabled={!hydrated || !result}
                    className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-bold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icons
                      name="download"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    Download Output
                  </button>

                  <button
                    type="button"
                    onClick={copyCss}
                    disabled={!hydrated || !result}
                    className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icons
                      name="copy"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    Copy CSS
                  </button>

                  <button
                    type="button"
                    onClick={copyHtml}
                    disabled={!hydrated || !result}
                    className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icons
                      name="copy"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    Copy HTML
                  </button>

                  <button
                    type="button"
                    onClick={copyDataUrl}
                    disabled={!hydrated || !result}
                    className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icons
                      name="copy"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    Copy Data URL
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>
                    Type: <b>{result?.mime || "No output yet"}</b>
                  </span>
                  {result && (
                    <>
                      <span>
                        Size: <b>{formatBytes(result.bytes)}</b>
                      </span>
                      <span>
                        Output length:{" "}
                        <b>{result.text.length.toLocaleString()}</b> chars
                      </span>
                    </>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  Notes: Base64 increases size by about 33%. If you are using
                  CSS <b>url()</b>, consider <b>Data URI (UTF-8)</b> for small
                  SVGs.
                </p>
              </div>

              <div className="mt-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowDecodeMenu((v) => !v)}
                  className="w-full inline-flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                  aria-expanded={showDecodeMenu}
                  aria-controls="decode-menu"
                >
                  <span className="flex items-center justify-center font-medium">
                    <Icons
                      name="settings"
                      size={16}
                      className="inline-block mr-1"
                    />
                    Decode & sanitize options
                  </span>

                  <svg
                    className={[
                      "h-4 w-4 text-slate-500 transition-transform",
                      showDecodeMenu ? "rotate-180" : "rotate-0",
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

                {showDecodeMenu && (
                  <div
                    id="decode-menu"
                    className="mt-2 bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden"
                  >
                    <div className="grid gap-2 min-w-0">
                      <Field label="Input type">
                        <select
                          value={settings.sourceMode}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              sourceMode: e.target.value as SourceMode,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate cursor-pointer hover:bg-slate-50"
                        >
                          <option value="auto">Auto detect</option>
                          <option value="data-uri">Data URI</option>
                          <option value="base64-only">Base64 only</option>
                        </select>
                      </Field>

                      <Field label="Decode mode">
                        <select
                          value={settings.decodeMode}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              decodeMode: e.target.value as DecodeMode,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate cursor-pointer hover:bg-slate-50"
                        >
                          <option value="auto">Auto (recommended)</option>
                          <option value="utf8">UTF-8</option>
                          <option value="latin1">Latin-1 fallback</option>
                        </select>
                        <span className="text-[12px] text-slate-500 shrink-0">
                          Handles most SVGs
                        </span>
                      </Field>

                      <Field label="Sanitize output">
                        <input
                          type="checkbox"
                          checked={settings.sanitize}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              sanitize: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Strip risky content from SVG output
                        </span>
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

                      <Field label="Normalize">
                        <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                          <ToggleRow
                            checked={settings.normalizeNewlines}
                            onChange={(v) =>
                              setSettings((s) => ({
                                ...s,
                                normalizeNewlines: v,
                              }))
                            }
                            label="Normalize newlines"
                          />
                          <ToggleRow
                            checked={settings.minifyWhitespace}
                            onChange={(v) =>
                              setSettings((s) => ({
                                ...s,
                                minifyWhitespace: v,
                              }))
                            }
                            label="Minify whitespace (light)"
                          />
                          <ToggleRow
                            checked={settings.ensureXmlns}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, ensureXmlns: v }))
                            }
                            label="Ensure xmlns on <svg>"
                          />
                          <ToggleRow
                            checked={settings.pretty}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, pretty: v }))
                            }
                            label="Pretty format SVG (best effort)"
                          />
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Render decoded output
                        </span>
                      </Field>

                      <Field label="Copy wrapping">
                        <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                          <ToggleRow
                            checked={settings.copyWithQuotes}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, copyWithQuotes: v }))
                            }
                            label="Copy SVG with quotes"
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
                                className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer hover:bg-slate-50"
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
                            setSettings((s) => ({
                              ...s,
                              fileName: e.target.value,
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                          placeholder="decoded"
                        />
                      </Field>
                    </div>

                    <div className="mt-3 text-[13px] text-slate-600">
                      Notes: If SVG decoding fails, try setting Decode mode to
                      UTF-8 or Latin-1 depending on how the Base64 was created.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  {result?.kind === "image"
                    ? "Decoded image data URL"
                    : "Decoded SVG (source)"}
                </div>
                <div className="p-3">
                  <textarea
                    value={result?.text || ""}
                    readOnly
                    className="w-full h-[240px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {settings.showPreview && (
          <div className="flex w-full flex-col mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-slate-800 max-w-[1180px] mx-auto">
            <div className="px-3 py-2 text-sm text-white border-b border-slate-200 bg-slate-600">
              Preview
            </div>
            <div className="flex mx-auto p-3 w-full flex-col items-center justify-center">
              {result ? (
                <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 max-w-full overflow-auto">
                  {result.kind === "svg" ? (
                    <SvgPreview svg={result.text} />
                  ) : (
                    <img
                      src={result.dataUrl}
                      alt="Decoded Base64 image preview"
                      className="block max-w-full max-h-[70vh] h-auto rounded-xl bg-white object-contain"
                    />
                  )}
                </div>
              ) : (
                <div className="text-sm text-white font-semibold flex items-center justify-center">
                  <Icons
                    name="success"
                    size={20}
                    className="inline-block mr-1"
                  />
                  Paste input to preview the decoded output.
                </div>
              )}

              {info && (info.hasScripts || info.hasForeignObject) ? (
                <div className="mt-3 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Detected potentially risky content in the decoded SVG. Use
                  Sanitize output to strip it.
                </div>
              ) : null}
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>

      <ContextualAffiliateCard />
      
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

      <SeoSections hydrated={hydrated} />
      <Breadcrumbs crumbs={crumbs} />
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
   Decoding core
======================== */
function decodeInput(input: string, settings: Settings): DecodeResult {
  const raw0 = String(input || "");
  const raw = normalizeLikelyPastes(raw0);

  if (!raw.trim())
    throw new Error("Paste Base64, a data URL, or an <img src=...> snippet.");

  const isDataUri = /^data:/i.test(raw);

  if (
    settings.sourceMode === "data-uri" ||
    (settings.sourceMode === "auto" && isDataUri) ||
    isDataUri
  ) {
    return decodeDataUri(raw, settings);
  }

  const b64 = extractBase64Flexible(raw);
  const bytes = base64ToBytes(b64);
  const detectedMime = detectRasterImageMime(bytes);

  if (detectedMime) {
    return imageResultFromBase64(b64, detectedMime);
  }

  const decodedText = decodeBytesToString(bytes, settings.decodeMode);
  const finalSvg = postprocessSvg(decodedText, settings);
  return svgResult(finalSvg);
}

function normalizeLikelyPastes(raw: string) {
  let t = String(raw || "").trim();
  if (!t) return t;

  t = t.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  const jsonLike = t.match(
    /["']?(src|href|url|data)["']?\s*:\s*["']([^"']+)["']/i,
  );
  if (jsonLike?.[2]) t = jsonLike[2].trim();

  const imgSrc = t.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (imgSrc) t = imgSrc.trim();

  const dataAttr = t.match(/\bdata\s*=\s*["']([^"']+)["']/i)?.[1];
  if (dataAttr && !imgSrc) t = dataAttr.trim();

  const cssUrl = t.match(/\burl\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1];
  if (cssUrl) t = cssUrl.trim();

  const dataUrlMatch = t.match(
    /data:[a-z0-9.+/-]+(?:;[a-z0-9=.+/-]+)*,[a-z0-9+/=_-]+/i,
  );
  if (dataUrlMatch?.[0]) t = dataUrlMatch[0].trim();

  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  const afterEquals = t.match(/^(?:src|href|data)\s*=\s*(data:.*)$/i)?.[1];
  if (afterEquals) t = afterEquals.trim();

  return t.trim();
}

function decodeDataUri(dataUri: string, settings: Settings): DecodeResult {
  const m = String(dataUri).match(/^data:([^,]*),(.*)$/is);
  if (!m) throw new Error("Invalid data URL.");

  const meta = (m[1] || "").trim();
  const payload = (m[2] || "").trim();
  const mime = (meta.split(";")[0] || "").trim().toLowerCase();
  const isBase64 = /;base64/i.test(meta);

  if (mime && mime.startsWith("image/") && mime !== "image/svg+xml") {
    if (isBase64) {
      const b64 = extractBase64Flexible(payload);
      const rasterMime = toRasterImageMime(mime);
      if (!rasterMime) throw new Error(`Unsupported image type: ${mime}.`);
      return imageResultFromBase64(b64, rasterMime);
    }

    const rasterMime = toRasterImageMime(mime);
    if (!rasterMime) throw new Error(`Unsupported image type: ${mime}.`);

    const dataUrl = `data:${rasterMime},${payload}`;
    return {
      kind: "image",
      mime: rasterMime,
      text: dataUrl,
      dataUrl,
      extension: extensionFromMime(rasterMime),
      bytes: new Blob([dataUrl]).size,
    };
  }

  if (mime && mime !== "image/svg+xml") {
    throw new Error(`Unsupported data URL type: ${mime || "unknown"}.`);
  }

  let decodedText = "";

  if (isBase64) {
    const b64 = extractBase64Flexible(payload);
    const bytes = base64ToBytes(b64);
    const detectedMime = detectRasterImageMime(bytes);

    if (detectedMime) {
      return imageResultFromBase64(b64, detectedMime);
    }

    decodedText = decodeBytesToString(bytes, settings.decodeMode);
  } else {
    decodedText = decodeDataUriTextPayload(payload);
  }

  const finalSvg = postprocessSvg(decodedText, settings);
  return svgResult(finalSvg);
}

function decodeDataUriTextPayload(payload: string) {
  try {
    return decodeURIComponent(payload);
  } catch {
    try {
      return decodeURIComponent(payload.replace(/\s+/g, ""));
    } catch {
      try {
        return decodeURIComponent(payload.replace(/\+/g, "%20"));
      } catch {
        throw new Error("Could not decode non-base64 SVG data URL.");
      }
    }
  }
}

function extractBase64Flexible(s: string) {
  let t = String(s || "").trim();

  const b64Marker = t.toLowerCase().lastIndexOf("base64,");
  if (b64Marker >= 0) t = t.slice(b64Marker + "base64,".length);

  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  t = t.replace(/\s+/g, "");

  const only = t.match(/^[a-z0-9+/=_-]+/i)?.[0] || "";
  t = only;

  if (!t) throw new Error("Missing Base64 payload.");

  if (!/^[a-z0-9+/=_-]+$/i.test(t)) {
    throw new Error("Input does not look like Base64.");
  }

  if (/[-_]/.test(t) && !/[+/]/.test(t)) {
    t = t.replace(/-/g, "+").replace(/_/g, "/");
  }

  const pad = t.length % 4;
  if (pad) t += "=".repeat(4 - pad);

  if (!/^[a-z0-9+/=]+$/i.test(t)) {
    throw new Error("Input does not look like Base64.");
  }

  return t;
}

function base64ToBytes(b64: string) {
  let bin = "";

  try {
    bin = atob(b64);
  } catch {
    throw new Error(
      "Base64 decode failed. Try pasting the full data URL, or check for missing characters.",
    );
  }

  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

function decodeBytesToString(bytes: Uint8Array, mode: DecodeMode) {
  const tryUtf8 = () => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  };

  const latin1 = () => {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return s;
  };

  if (mode === "utf8") {
    const u = tryUtf8();
    if (u == null) throw new Error("UTF-8 decode failed. Try Latin-1.");
    return u;
  }

  if (mode === "latin1") return latin1();

  const u = tryUtf8();
  return u != null ? u : latin1();
}

function detectRasterImageMime(bytes: Uint8Array): RasterImageMime | "" {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return "";
}

function toRasterImageMime(mime: string): RasterImageMime | "" {
  const m = mime.toLowerCase();
  if (m === "image/png") return "image/png";
  if (m === "image/jpeg" || m === "image/jpg") return "image/jpeg";
  if (m === "image/gif") return "image/gif";
  if (m === "image/webp") return "image/webp";
  return "";
}

function imageResultFromBase64(
  b64: string,
  mime: RasterImageMime,
): DecodeResult {
  const clean = extractBase64Flexible(b64);
  const dataUrl = `data:${mime};base64,${clean}`;

  return {
    kind: "image",
    mime,
    text: dataUrl,
    dataUrl,
    extension: extensionFromMime(mime),
    bytes: base64ByteLength(clean),
  };
}

function svgResult(svg: string): DecodeResult {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return {
    kind: "svg",
    mime: "image/svg+xml",
    text: svg,
    dataUrl,
    extension: "svg",
    bytes: new Blob([svg]).size,
  };
}

function extensionFromMime(mime: RasterImageMime) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "gif";
}

function base64ByteLength(b64: string) {
  const clean = b64.replace(/\s+/g, "").replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
}

/* ========================
   Postprocess SVG
======================== */
function postprocessSvg(svgText: string, settings: Settings) {
  let svg = String(svgText || "");

  if (settings.normalizeNewlines) {
    svg = svg.replace(/\r\n?/g, "\n");
  }

  const start = svg.toLowerCase().indexOf("<svg");
  if (start >= 0) {
    svg = svg.slice(start);
  }

  if (!/<svg\b/i.test(svg)) {
    throw new Error("Decoded output does not contain an <svg> root tag.");
  }

  if (settings.sanitize) {
    if (settings.stripScripts) {
      svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    }
    if (settings.stripForeignObject) {
      svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");
    }
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

  if (settings.ensureXmlns) {
    svg = ensureSvgHasXmlns(svg);
  }

  if (settings.minifyWhitespace) {
    svg = svg
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    svg = svg.trim();
  }

  if (settings.pretty) {
    svg = prettySvg(svg);
  }

  return svg;
}

function prettySvg(svg: string) {
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
    out.push("  ".repeat(indent) + line);
    if (isOpen && !isSelf) indent += 1;
  }

  return out.join("\n").trim();
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

  const hasScripts = /<script\b/i.test(svg) || /\son[a-z]+\s*=\s*/i.test(svg);
  const hasForeignObject = /<foreignObject\b/i.test(svg);

  return { bytes, widthRaw, heightRaw, viewBox, hasScripts, hasForeignObject };
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
  if (!hasSvg) return svg;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

/* ========================
   Preview component
======================== */
function SvgPreview({ svg }: { svg: string }) {
  const [src, setSrc] = React.useState("");

  React.useEffect(() => {
    const safe = ensureSvgHasXmlns(svg);
    const blob = new Blob([safe], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    setSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [svg]);

  if (!src) {
    return (
      <div className="text-sm font-semibold text-slate-600">
        Preparing SVG preview...
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Decoded SVG preview"
      className="mx-auto block max-h-[70vh] max-w-full rounded-xl bg-white object-contain"
    />
  );
}

/* ========================
   Download
======================== */
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const blob = dataUrlToBlob(dataUrl);
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return new Blob([dataUrl], { type: "text/plain;charset=utf-8" });

  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";

  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }

  const bytes = base64ToBytes(payload);
  return new Blob([bytes], { type: mime });
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "decoded"
  );
}

function wrapQuotes(s: string, mode: QuoteMode) {
  if (mode === "none") return s;
  if (mode === "single") return `'${s.replace(/'/g, "\\'")}'`;
  return `"${s.replace(/"/g, '\\"')}"`;
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

/* ========================
   Breadcrumbs UI + JSON-LD
======================== */
function Breadcrumbs({
  crumbs,
}: {
  crumbs: Array<{ name: string; href: string }>;
}) {
  return (
    <div className="hidden md:flex max-w-[1100px] mx-auto">
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
  const baseUrl = "https://www.ilovesvg.com";

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Base64 to SVG",
        item: `${baseUrl}/base64-to-svg`,
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
    mainEntity: FAQ_ITEMS.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
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

function SeoSections({ hydrated }: { hydrated: boolean }) {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Base64 / Data URI decoder
              </p>

              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                Base64 to SVG Converter: Decode, sanitize, and recover source
              </h2>

              <p className="text-slate-600">
                Paste Base64, a full <code>data:image/svg+xml;base64</code> URL,
                an <code>&lt;img src="..."&gt;</code> snippet, or CSS{" "}
                <code>url(...)</code>. This tool extracts the SVG, optionally
                sanitizes it, and lets you copy or download a normal{" "}
                <code>.svg</code> file.
              </p>

              <p className="text-slate-600">
                Supports Base64 and UTF-8 percent-encoded SVG data URIs. Runs
                fully client-side unless you enable server features elsewhere.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Extract SVG", v: "From data URIs, HTML, or CSS" },
                  { k: "Sanitize", v: "Strip scripts and handlers" },
                  { k: "Preview", v: "Validate output before saving" },
                  { k: "Private", v: "Paste-only, no uploads required" },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold">{x.k}</div>
                    <div className="mt-1 text-sm text-slate-600">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <ExampleSvgConversion />

          {hydrated && (
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

          <section>
            <h3 className="text-lg font-bold">Best for</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Embedded icons",
                "Data URI cleanup",
                "Copy/paste SVG recovery",
                "Debugging broken SVGs",
                "Sanitizing untrusted SVG",
                "CSS background-image",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">Recover the source</div>
                <p className="mt-1 text-sm text-slate-600">
                  Turn embedded <code>data:image/svg+xml;base64,...</code> into
                  real, editable SVG markup you can paste into code or design
                  tools.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Make it safe to reuse
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Remove <code>&lt;script&gt;</code>, event handlers, and risky
                  links before previewing or embedding decoded SVGs.
                </p>
              </div>
            </div>
          </section>

          <section
            itemScope
            itemType="https://schema.org/HowTo"
            className="mt-12"
          >
            <div className="flex items-end justify-between gap-4">
              <h3 itemProp="name" className="text-lg font-bold">
                How to decode Base64 to SVG
              </h3>
              <span className="text-xs text-slate-500">
                Paste → decode → sanitize → copy/download
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Paste the input",
                  body: "Paste Base64, a full data URL, an HTML snippet, or CSS url(...). The tool auto-extracts the data URL when possible.",
                },
                {
                  title: "Choose decode mode",
                  body: "Pick Base64 or UTF-8 data URI decoding if the input is percent-encoded.",
                },
                {
                  title: "Sanitize if needed",
                  body: "Enable sanitization to strip scripts, inline event handlers, and risky javascript: links before previewing or saving.",
                },
                {
                  title: "Copy or download",
                  body: "Copy the recovered SVG markup or download a .svg file for use in apps, sites, and design tools.",
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  itemScope
                  itemType="https://schema.org/HowToStep"
                  itemProp="step"
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-slate-900 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>
                    <div>
                      <div itemProp="name" className="font-semibold">
                        {s.title}
                      </div>
                      <div
                        itemProp="itemListElement"
                        className="mt-1 text-sm text-slate-600"
                      >
                        {s.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold">Examples</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              These show common SVG Base64 formats this decoder can recover.
            </p>

            <div className="mt-5 grid gap-4">
              {[
                {
                  title: "Full Base64 data URL",
                  inputLabel: "Input",
                  input: `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIvPjwvc3ZnPg==`,
                  outputLabel: "Output",
                  output: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <rect width="24" height="24" rx="4"/>
</svg>`,
                },
                {
                  title: "HTML snippet with embedded data URL",
                  inputLabel: "Input",
                  input: `<img alt="icon" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjAiIHk9IjE0Ij5IZWxsbzwvdGV4dD48L3N2Zz4=" />`,
                  outputLabel: "Output",
                  output: `<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="14">Hello</text>
</svg>`,
                },
              ].map((ex) => (
                <div
                  key={ex.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{ex.title}</div>

                  <div className="mt-3 lg:pt-0 lg:pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {ex.inputLabel}
                      </div>

                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 max-w-full">
                        <code className="block text-[12px] sm:text-[13px] leading-relaxed whitespace-normal break-all">
                          {ex.input}
                        </code>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {ex.outputLabel}
                      </div>

                      <pre className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 max-w-full overflow-hidden sm:overflow-x-auto">
                        <code className="block text-[12px] sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">
                          {ex.output}
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold">Security notes</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              SVG is XML and can include scripts, event handlers, foreignObject,
              and external references. If you did not create the SVG, keep
              sanitization enabled before previewing or reusing output.
            </p>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Strip scripts",
                  body: "Remove <script> blocks and other executable content unless you fully trust the source.",
                },
                {
                  title: "Remove inline handlers",
                  body: "Strip on* attributes like onload/onclick that can execute when the SVG is rendered.",
                },
                {
                  title: "Block javascript: links",
                  body: "Remove javascript: URLs and suspicious xlink:href/href values to prevent click-triggered execution.",
                },
                {
                  title: "Preview cautiously",
                  body: "Preview is useful for validation, but sanitized output should be your default when pasting unknown SVGs.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold">Frequently asked questions</h3>

            <div className="mt-4 grid gap-3">
              {FAQ_ITEMS.map((x) => (
                <article
                  key={x.q}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4 className="m-0 font-semibold">{x.q}</h4>
                  <p className="mt-2 text-sm text-slate-600">{x.a}</p>
                </article>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
