import * as React from "react";
import type { Route } from "./+types/base64-to-svg";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | Base64 to SVG Decoder (Data URI to SVG)";
  const description =
    "Decode Base64 or Data URI SVG instantly in your browser with ilovesvg. Paste a Base64 string, <img src>, CSS url(...), or data:image/svg+xml;base64 value. Preview safely, sanitize the SVG, and download the file. Free, client-side only, no uploads.";
  const canonical = "https://ilovesvg.com/base64-to-svg";

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

type Settings = {
  sourceMode: SourceMode;
  decodeMode: DecodeMode;

  // sanitize output SVG
  sanitize: boolean;
  stripScripts: boolean;
  stripForeignObject: boolean;
  stripEventHandlers: boolean;
  stripJavascriptHrefs: boolean;

  // normalize formatting
  normalizeNewlines: boolean;
  minifyWhitespace: boolean;

  // output options
  ensureXmlns: boolean;
  pretty: boolean;
  showPreview: boolean;

  fileName: string;

  // copy helpers
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

/* ========================
   Page
======================== */
export default function Base64ToSvg(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [showDecodeMenu, setShowDecodeMenu] = React.useState(false);

  const [input, setInput] = React.useState<string>("");
  const [outSvg, setOutSvg] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function clearAll() {
    setInput("");
    setOutSvg("");
    setInfo(null);
    setErr(null);
  }

  function tryDecode(current = input) {
    setErr(null);
    try {
      const decoded = decodeToSvg(current, settings);
      const finalSvg = postprocessSvg(decoded, settings);
      setOutSvg(finalSvg);
      setInfo(parseSvgInfo(finalSvg));
    } catch (e: any) {
      setErr(e?.message || "Decode failed.");
      setOutSvg("");
      setInfo(null);
    }
  }

  React.useEffect(() => {
    if (!input.trim()) {
      setOutSvg("");
      setInfo(null);
      setErr(null);
      return;
    }
    tryDecode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, input]);

  function copySvg() {
    if (!outSvg) return;
    const t = settings.copyWithQuotes
      ? wrapQuotes(outSvg, settings.quoteMode)
      : outSvg;
    navigator.clipboard.writeText(t).then(() => showToast("Copied"));
  }

  function downloadSvg() {
    if (!outSvg) return;
    const name = (settings.fileName || "decoded").trim() || "decoded";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(outSvg, filename);
    showToast("Downloaded");
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
          <div className="hidden md:block lg:hidden py-6">
            <AdSenseDelayed
              slot="8858930853"
              delayMs={1500}
              minHeight={90}
              maxHeight={100}
              format="horizontal"
              fullWidth={true}
              className="mx-auto w-full max-w-[728px]"
            />
          </div>
          <div className="block md:hidden py-6">
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

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Breadcrumbs crumbs={crumbs} />

                <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
                  <span className="text-[#0b2dff]">Base64</span>
                  <span className="text-slate-400">to</span>
                  <span>SVG</span>
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={pasteExample}
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

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Paste here... (Example: <img src="data:image/svg+xml;base64,...">)'
                className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-sky-50 px-3 py-2 font-mono text-[12px] text-slate-900"
                spellCheck={false}
              />

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
              <p className="hidden md:block mt-2 text-slate-600">
                Paste Base64, a <b>data:image/svg+xml</b> URL, an{" "}
                <b>&lt;img src="..."&gt;</b> snippet, or CSS <b>url(...)</b>.
                Runs fully client-side.
              </p>

              <div className="hidden md:block mt-3 text-[13px] text-slate-600">
                Try this:
                <code className="ml-1 break-all">
                  data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=
                </code>
              </div>
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50 border border-slate-200 rounded-2xl px-4 py-4 shadow-sm min-w-0 overflow-auto">
              <div className="mt-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowDecodeMenu((v) => !v)}
                  className="w-full inline-flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                  aria-expanded={showDecodeMenu}
                  aria-controls="decode-menu"
                >
                  <span className="font-medium">Decode & sanitize options</span>

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
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
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
                          className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
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
                          Strip risky content (recommended)
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
                            label="Pretty format (best effort)"
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
                          Render decoded SVG
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
                                className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer"
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

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <button
                        type="button"
                        onClick={copySvg}
                        disabled={!hydrated || !outSvg}
                        className={[
                          "px-3.5 py-2 rounded-xl font-bold border transition-colors cursor-pointer",
                          "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                          "disabled:opacity-70 disabled:cursor-not-allowed",
                        ].join(" ")}
                      >
                        Copy SVG
                      </button>

                      <button
                        type="button"
                        onClick={downloadSvg}
                        disabled={!hydrated || !outSvg}
                        className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        Download SVG
                      </button>

                      {!err && outSvg && (
                        <span className="text-[13px] text-slate-600">
                          Output size:{" "}
                          <b>{formatBytes(new Blob([outSvg]).size)}</b>
                        </span>
                      )}
                    </div>

                    <div className="mt-3 text-[13px] text-slate-600">
                      Notes: If decoding fails, try setting Decode mode to UTF-8
                      or Latin-1 depending on how the Base64 was created.
                    </div>
                  </div>
                )}
              </div>

              {/* OUTPUT SVG */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Decoded SVG (source)
                </div>
                <div className="p-3">
                  <textarea
                    value={outSvg}
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
                    {outSvg ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <SvgPreview svg={outSvg} />
                      </div>
                    ) : (
                      <div className="text-slate-600 text-sm">
                        Paste input to preview the decoded SVG.
                      </div>
                    )}

                    {info && (info.hasScripts || info.hasForeignObject) ? (
                      <div className="mt-3 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        Detected potentially risky content in the decoded SVG.
                        Use Sanitize output to strip it.
                      </div>
                    ) : null}
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
   Decoding core (ROBUST)
======================== */
function decodeToSvg(input: string, settings: Settings) {
  const raw0 = String(input || "");
  const raw = normalizeLikelyPastes(raw0);

  if (!raw.trim())
    throw new Error("Paste Base64, a data URL, or an <img src=...> snippet.");

  const mode = settings.sourceMode;

  // Heuristic: if it looks like a data URI anywhere, treat as data
  const isDataUri = /^data:/i.test(raw);

  if (mode === "data-uri" || (mode === "auto" && isDataUri)) {
    return decodeDataUriToSvg(raw, settings.decodeMode);
  }

  // If user forced base64-only but pasted data:..., still handle it
  if (isDataUri) {
    return decodeDataUriToSvg(raw, settings.decodeMode);
  }

  // base64-only
  const b64 = extractBase64Flexible(raw);
  return decodeBase64ToString(b64, settings.decodeMode);
}

function normalizeLikelyPastes(raw: string) {
  let t = String(raw || "").trim();
  if (!t) return t;

  // If user pasted a JSON blob, try to grab a common property value
  // { "src": "data:..." } or {src:"data:..."}
  const jsonLike = t.match(
    /["']?(src|href|url|data)["']?\s*:\s*["']([^"']+)["']/i,
  );
  if (jsonLike?.[2]) t = jsonLike[2].trim();

  // If user pasted an HTML <img ...> tag, extract src
  const imgSrc = t.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (imgSrc) t = imgSrc.trim();

  // If user pasted <object data="..."> or <embed src="..."> etc.
  const dataAttr = t.match(/\bdata\s*=\s*["']([^"']+)["']/i)?.[1];
  if (dataAttr && !imgSrc) t = dataAttr.trim();

  // CSS url("...") wrapper
  const cssUrl = t.match(/\burl\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1];
  if (cssUrl) t = cssUrl.trim();

  // If the text contains a data:image/svg+xml... anywhere, slice it out
  const idx = t.toLowerCase().indexOf("data:image/svg+xml");
  if (idx >= 0) {
    const sliced = t.slice(idx);
    const end = sliced.search(/[\s"'<>)]/); // stop at likely terminators
    t = (end === -1 ? sliced : sliced.slice(0, end)).trim();
  }

  // Unescape common HTML entities for quotes
  t = t.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  // Strip wrapping quotes around entire thing
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  // Sometimes pasted as: src=data:image/svg+xml;base64,....
  const afterEquals = t.match(/^(?:src|href|data)\s*=\s*(data:.*)$/i)?.[1];
  if (afterEquals) t = afterEquals.trim();

  return t.trim();
}

function decodeDataUriToSvg(dataUri: string, decodeMode: DecodeMode) {
  const m = String(dataUri).match(/^data:([^,]*),(.*)$/is);
  if (!m) throw new Error("Invalid data URL.");

  const meta = (m[1] || "").trim();
  const payload = (m[2] || "").trim();

  // Some people paste "data:image/svg+xml;base64;utf8,..." etc
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    const b64 = extractBase64Flexible(payload);
    return decodeBase64ToString(b64, decodeMode);
  }

  // UTF-8 / percent-encoded data URI
  try {
    return decodeURIComponent(payload);
  } catch {
    try {
      return decodeURIComponent(payload.replace(/\s+/g, ""));
    } catch {
      // Some payloads contain plus signs as spaces (common in form encodings)
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

  // If user pasted another wrapper that still contains "base64,", split after it
  const b64Marker = t.toLowerCase().lastIndexOf("base64,");
  if (b64Marker >= 0) t = t.slice(b64Marker + "base64,".length);

  // Strip surrounding quotes
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  // Remove whitespace/newlines
  t = t.replace(/\s+/g, "");

  // Common accidental paste: trailing characters after base64
  // Keep only base64-ish chars
  const only = t.match(/^[a-z0-9+/=_-]+/i)?.[0] || "";
  t = only;

  if (!t) throw new Error("Missing Base64 payload.");

  // Accept urlsafe too during initial validation
  if (!/^[a-z0-9+/=_-]+$/i.test(t)) {
    throw new Error("Input does not look like Base64.");
  }

  // Convert urlsafe base64 to standard for atob
  if (/[-_]/.test(t) && !/[+/]/.test(t)) {
    t = t.replace(/-/g, "+").replace(/_/g, "/");
  }

  // Fix missing padding
  const pad = t.length % 4;
  if (pad) t += "=".repeat(4 - pad);

  // Final validation (standard alphabet)
  if (!/^[a-z0-9+/=]+$/i.test(t)) {
    throw new Error("Input does not look like Base64.");
  }

  return t;
}

function decodeBase64ToString(b64: string, mode: DecodeMode) {
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

/* ========================
   Postprocess SVG
======================== */
function postprocessSvg(svgText: string, settings: Settings) {
  let svg = String(svgText || "");

  if (settings.normalizeNewlines) {
    svg = svg.replace(/\r\n?/g, "\n");
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

  if (!/<svg\b/i.test(svg)) {
    // Some decodes include leading junk before <svg> (rare)
    const start = svg.toLowerCase().indexOf("<svg");
    if (start >= 0) svg = svg.slice(start);
  }

  if (!/<svg\b/i.test(svg)) {
    throw new Error("Decoded output does not contain an <svg> root tag.");
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
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

/* ========================
   Preview component
======================== */
function SvgPreview({ svg }: { svg: string }) {
  const safe = React.useMemo(() => ensureSvgHasXmlns(svg), [svg]);

  return (
    <div
      className="w-full overflow-auto"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

/* ========================
   Download
======================== */
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
    <div className="hidden md:flex mb-4">
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
    mainEntity: [
      {
        "@type": "Question",
        name: "What can I paste into this Base64 to SVG tool?",
        acceptedAnswer: {
          "@type": "Answer",
          text: 'You can paste a Base64 string, a full data:image/svg+xml;base64, URL, an <img src="..."> snippet, CSS url("data:...") text, or a larger chunk of code that contains a data URL. The tool will automatically extract the SVG data and decode it.',
        },
      },
      {
        "@type": "Question",
        name: "Can this decode an SVG data URI that is not Base64?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. If the data URI is UTF-8 / percent-encoded (data:image/svg+xml,<svg...>), the tool can decode it and restore the SVG.",
        },
      },
      {
        "@type": "Question",
        name: "Why does my decoded SVG look broken?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Some Base64 strings were created with a different character encoding. Try switching Decode mode to UTF-8 or Latin-1. Also disable sanitization if it removed scripts or foreignObject that your SVG depends on.",
        },
      },
      {
        "@type": "Question",
        name: "Does this tool upload my Base64 or SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Everything runs client-side in your browser. Nothing is uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "Is it safe to decode and preview SVGs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SVG can contain scripts or event handlers. Use the sanitization options to strip risky content before previewing or downloading.",
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

function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-12 text-slate-800">
        <article className="max-w-none">
          {/* Header / Hero */}
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
                Supports Base64 and UTF-8 (percent-encoded) SVG data URIs. Runs
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

          {typeof document !== "undefined" && (
            <div className="block py-6">
              <AdSenseDelayed
                slot="7336722354"
                delayMs={2500}
                afterInteraction={true}
                className="my-8"
                format="rectangle"
                fullWidth={false}
                minHeight={250}
                maxHeight={300}
                placeholderLabel="Sponsored"
              />
            </div>
          )}

          {/* Use cases */}
          <section className="mt-10">
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

          {/* HowTo */}
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
                  title: "Sanitize (recommended)",
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

          {/* Examples */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Examples (Input → Output)</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              These show what you can paste and what you’ll get back. Outputs
              are shortened for readability.
            </p>

            <div className="mt-5 grid gap-4">
              {[
                {
                  title: "Example 1: Full Base64 data URL",
                  inputLabel: "Input",
                  input: `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIvPjwvc3ZnPg==`,
                  outputLabel: "Output",
                  output: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <rect width="24" height="24" rx="4"/>
</svg>`,
                },
                {
                  title: "Example 2: HTML snippet with embedded data URL",
                  inputLabel: "Input",
                  input: `<img alt="icon" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjAiIHk9IjE0Ij5IZWxsbzwvdGV4dD48L3N2Zz4=" />`,
                  outputLabel: "Output",
                  output: `<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="14">Hello</text>
</svg>`,
                },
                {
                  title: "Example 3: CSS url(...) with a data URL",
                  inputLabel: "Input",
                  input: `.logo { background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PC9zdmc+"); }`,
                  outputLabel: "Output",
                  output: `<svg xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10"/>
</svg>`,
                },
                {
                  title: "Example 4: UTF-8 (percent-encoded) SVG data URI",
                  inputLabel: "Input",
                  input: `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M2%202h20v20H2z%22%2F%3E%3C%2Fsvg%3E`,
                  outputLabel: "Output",
                  output: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M2 2h20v20H2z"/>
</svg>`,
                },
              ].map((ex) => (
                <div
                  key={ex.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{ex.title}</div>

                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {ex.inputLabel}
                      </div>

                      {/* INPUT: use a normal block so it wraps cleanly on mobile */}
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

                      {/* OUTPUT: keep <pre> for SVG formatting; wrap on mobile */}
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

          {/* Security Notes */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Security notes</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              SVG is XML and can include scripts, event handlers, foreignObject,
              and external references. If you didn’t create the SVG, keep
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

          {/* FAQ */}
          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold">Frequently asked questions</h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "What inputs does this support?",
                  a: "Base64 strings, full data:image/svg+xml;base64 URLs, HTML snippets that contain an <img src>, and CSS url(...) values. UTF-8 percent-encoded SVG data URIs are also supported.",
                },
                {
                  q: "Why sanitize the output?",
                  a: "SVG can contain scripts and event handlers. Sanitization removes common dangerous constructs so you can reuse the SVG more safely.",
                },
                {
                  q: "Will this change my SVG visually?",
                  a: "Sanitization aims to preserve visuals while removing executable parts. If the SVG relies on scripts or external content, the sanitized result may differ.",
                },
                {
                  q: "Does this run client-side?",
                  a: "Yes for decode and preview in typical implementations. If your app routes some actions server-side, that’s separate from the decoding logic here.",
                },
              ].map((x) => (
                <article
                  key={x.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4 itemProp="name" className="m-0 font-semibold">
                    {x.q}
                  </h4>
                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm text-slate-600"
                  >
                    <span itemProp="text">{x.a}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
