import * as React from "react";
import type { Route } from "./+types/base64-to-svg";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "i🩵SVG  -  Base64 to SVG (Data URI Decoder)";
  const description =
    "Decode Base64 to SVG instantly in your browser. Paste a Base64 string, an <img src=...> snippet, CSS url(...), or a data:image/svg+xml;base64, URL. Preview, sanitize risky content, and download the decoded SVG. No uploads, no server.";
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
      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <Breadcrumbs crumbs={crumbs} />

          <header className="text-center mb-4">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span className="text-[#0b2dff]">Base64</span>
              <span className="text-slate-400">to</span>
              <span>SVG</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Paste Base64, a <b>data:image/svg+xml</b> URL, an{" "}
              <b>&lt;img src="..."&gt;</b> snippet, or a CSS <b>url(...)</b>.
              Runs fully client-side.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 font-bold text-lg text-slate-900">Input</h2>
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

              <p className="mt-2 text-[13px] text-slate-600">
                Accepts: Data URI, raw Base64,{" "}
                <code>&lt;img src="..."&gt;</code>, <code>url("data:...")</code>
                , JS strings, or even a blob of text that contains a data URL.
              </p>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Paste here... (Example: <img src="data:image/svg+xml;base64,...">)'
                className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                spellCheck={false}
              />

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}

              <div className="mt-3 text-[13px] text-slate-600">
                Tip: If you pasted HTML/CSS, this tool will automatically pull
                out the <b>data:image/svg+xml...</b> part.
              </div>
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Decode Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
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
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                          setSettings((s) => ({ ...s, normalizeNewlines: v }))
                        }
                        label="Normalize newlines"
                      />
                      <ToggleRow
                        checked={settings.minifyWhitespace}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, minifyWhitespace: v }))
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
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
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
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
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
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download SVG
                  </button>

                  {!err && outSvg && (
                    <span className="text-[13px] text-slate-600">
                      Output size: <b>{formatBytes(new Blob([outSvg]).size)}</b>
                    </span>
                  )}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Notes: If decoding fails, try setting Decode mode to UTF-8 or
                  Latin-1 depending on how the Base64 was created.
                </div>
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

/* ========================
   SEO sections
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            Base64 to SVG Converter (Decode Data URI)
          </h2>
          <p className="mt-3">
            This tool converts <strong>Base64 to SVG</strong> so you can recover
            the original SVG source from embedded icons and{" "}
            <strong>data:image/svg+xml;base64</strong> URLs. Paste what you
            have, including common snippets like{" "}
            <code>&lt;img src="..."&gt;</code> and CSS <code>url(...)</code>,
            preview the decoded SVG, then copy or download it as a normal{" "}
            <code>.svg</code> file.
          </p>
          <p>
            It also supports decoding <strong>UTF-8 SVG data URIs</strong>{" "}
            (percent-encoded) and includes optional sanitization to remove
            scripts and event handlers before you reuse the SVG.
          </p>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Decode Base64 to SVG
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">
                Paste a Base64 string, data URL, or snippet that contains one.
              </li>
              <li itemProp="step">
                If needed, switch Input type or Decode mode.
              </li>
              <li itemProp="step">Optionally sanitize the decoded SVG.</li>
              <li itemProp="step">Copy or download the recovered SVG.</li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Security Notes</h3>
            <p className="mt-3">
              SVG is an XML format that can include scripts. If you did not
              create the SVG yourself, keep sanitization enabled before
              previewing or reusing it.
            </p>
          </section>
        </article>
      </div>

      <JsonLdBreadcrumbs />
      <JsonLdFaq />
    </section>
  );
}
