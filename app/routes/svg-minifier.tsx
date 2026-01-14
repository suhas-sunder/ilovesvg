import * as React from "react";
import type { Route } from "./+types/svg-minifier";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "i🩵SVG  -  SVG Minify (client-side SVG minifier)";
  const description =
    "Minify SVG files instantly in your browser. Remove comments, collapse whitespace, optionally strip XML/DOCTYPE, clean style attributes, and download the minified SVG. No uploads, no server.";
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
type Settings = {
  stripXmlDecl: boolean;
  stripDoctype: boolean;
  removeComments: boolean;
  collapseWhitespaceBetweenTags: boolean;
  collapseRunsOfSpaces: boolean;
  optimizeStyleAttr: boolean;
  removeEmptyAttrs: boolean;

  removeMetadataTag: boolean;
  removeEditorsNamespaces: boolean;

  trimTextNodes: boolean;

  fileName: string;
};

type SvgInfo = {
  bytes?: number;
  viewBox?: string;
  widthRaw?: string;
  heightRaw?: string;
};

const DEFAULTS: Settings = {
  stripXmlDecl: true,
  stripDoctype: true,
  removeComments: true,
  collapseWhitespaceBetweenTags: true,
  collapseRunsOfSpaces: true,
  optimizeStyleAttr: true,
  removeEmptyAttrs: true,

  removeMetadataTag: false,
  removeEditorsNamespaces: false,

  trimTextNodes: false,

  fileName: "minified",
};

/* ========================
   Page
======================== */
export default function SvgMinify(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  // Preview upload only
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Output
  const [outSvg, setOutSvg] = React.useState<string>("");
  const [outPreviewUrl, setOutPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (outPreviewUrl) URL.revokeObjectURL(outPreviewUrl);
    };
  }, [previewUrl, outPreviewUrl]);

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
    setOutSvg("");
    setOutPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

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
    setInfo({ ...parsed, bytes: new Blob([coerced]).size });

    const baseName = stripExt(f.name) || "minified";
    setSettings((s) => ({
      ...s,
      fileName: baseName,
    }));

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml" })
    );
    setPreviewUrl(url);

    tryConvert(coerced);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (outPreviewUrl) URL.revokeObjectURL(outPreviewUrl);
    setFile(null);
    setSvgText("");
    setInfo(null);
    setPreviewUrl(null);
    setOutSvg("");
    setOutPreviewUrl(null);
    setErr(null);
  }

  function tryConvert(currentSvgText = svgText) {
    setErr(null);
    try {
      const { svg } = minifySvg(currentSvgText, settings);
      setOutSvg(svg);

      setOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      });
    } catch (e: any) {
      setErr(e?.message || "Minify failed.");
    }
  }

  React.useEffect(() => {
    if (!svgText) return;
    tryConvert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, svgText]);

  function downloadMinified() {
    if (!outSvg) return;
    const name = (settings.fileName || "minified").trim() || "minified";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(outSvg, filename);
    showToast("Downloaded");
  }

  function sizeLabel(bytes?: number) {
    if (!bytes || !Number.isFinite(bytes)) return "?";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const inBytes = info?.bytes ?? (svgText ? new Blob([svgText]).size : 0);
  const outBytes = outSvg ? new Blob([outSvg]).size : 0;
  const savingsPct =
    inBytes > 0 && outBytes > 0
      ? Math.max(0, Math.min(99.9, (1 - outBytes / inBytes) * 100))
      : 0;

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Minify", href: "/svg-minify" },
  ];

  return (
    <>
      <SiteHeader />

      <main
        className="min-h-[100dvh] bg-slate-50 text-slate-900"
        onPaste={onPaste}
      >
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <Breadcrumbs crumbs={crumbs} />

          <header className="text-center mb-3">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>SVG</span>
              <span className="text-slate-400">Minify</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Minify an SVG by removing safe bloat like <b>comments</b> and
              extra <b>whitespace</b>, and optionally stripping <b>XML</b>/
              <b>DOCTYPE</b> and cleaning <b>style</b>. This runs fully
              client-side.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
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
                  className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
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

                  <div className="mt-2 text-[13px] text-slate-700">
                    Input size: <b>{sizeLabel(inBytes)}</b>
                    {info?.viewBox ? (
                      <span className="text-slate-500">
                        {" "}
                        • viewBox {info.viewBox}
                      </span>
                    ) : null}
                    {info?.widthRaw || info?.heightRaw ? (
                      <span className="text-slate-500">
                        {" "}
                        • {info.widthRaw || "?"} × {info.heightRaw || "?"}
                      </span>
                    ) : null}
                  </div>
                </>
              )}

              {/* Input preview */}
              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Input SVG preview
                  </div>
                  <div className="p-3">
                    <img
                      src={previewUrl}
                      alt="Input SVG"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}

              {/* Source editor */}
              {file && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                    Advanced: Edit SVG source
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-slate-600 mt-2">
                      Optional. Changes apply instantly.
                    </p>
                    <textarea
                      value={svgText}
                      onChange={(e) => {
                        const v = ensureSvgHasXmlns(e.target.value);
                        setSvgText(v);
                        setInfo((prev) => ({
                          ...(prev || {}),
                          ...parseSvgInfo(v),
                          bytes: new Blob([v]).size,
                        }));
                      }}
                      className="mt-2 w-full h-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  </div>
                </details>
              )}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Minify Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Strip XML declaration">
                    <input
                      type="checkbox"
                      checked={settings.stripXmlDecl}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          stripXmlDecl: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Remove {"<?xml ...?>"} header
                    </span>
                  </Field>

                  <Field label="Strip DOCTYPE">
                    <input
                      type="checkbox"
                      checked={settings.stripDoctype}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          stripDoctype: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Remove {"<!DOCTYPE ...>"}
                    </span>
                  </Field>

                  <Field label="Remove comments">
                    <input
                      type="checkbox"
                      checked={settings.removeComments}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          removeComments: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Remove {"<!-- ... -->"}
                    </span>
                  </Field>

                  <Field label="Whitespace between tags">
                    <input
                      type="checkbox"
                      checked={settings.collapseWhitespaceBetweenTags}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          collapseWhitespaceBetweenTags: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Collapse {">   <"} to {"><"}
                    </span>
                  </Field>

                  <Field label="Collapse repeated spaces">
                    <input
                      type="checkbox"
                      checked={settings.collapseRunsOfSpaces}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          collapseRunsOfSpaces: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Reduce obvious markup spacing
                    </span>
                  </Field>

                  <Field label="Optimize style attribute">
                    <input
                      type="checkbox"
                      checked={settings.optimizeStyleAttr}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          optimizeStyleAttr: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Clean style="a:1; b:2 ;"
                    </span>
                  </Field>

                  <Field label="Remove empty attributes">
                    <input
                      type="checkbox"
                      checked={settings.removeEmptyAttrs}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          removeEmptyAttrs: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Remove attr=""
                    </span>
                  </Field>

                  <Field label="Remove metadata tag">
                    <input
                      type="checkbox"
                      checked={settings.removeMetadataTag}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          removeMetadataTag: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Remove {"<metadata>...</metadata>"}
                    </span>
                  </Field>

                  <Field label="Remove editor namespaces">
                    <input
                      type="checkbox"
                      checked={settings.removeEditorsNamespaces}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          removeEditorsNamespaces: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Remove inkscape/sodipodi attrs
                    </span>
                  </Field>

                  <Field label="Trim text nodes">
                    <input
                      type="checkbox"
                      checked={settings.trimTextNodes}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          trimTextNodes: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      May affect {"<text>"} in rare cases
                    </span>
                  </Field>

                  <Field label="Output filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="minified"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadMinified}
                    disabled={!hydrated || !outSvg}
                    className={[
                      "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Download Minified SVG
                  </button>

                  {err && <span className="text-red-700 text-sm">{err}</span>}

                  {!err && outSvg && (
                    <span className="text-[13px] text-slate-600">
                      Output size: <b>{sizeLabel(outBytes)}</b>
                      {inBytes > 0 && outBytes > 0 ? (
                        <span className="text-slate-500">
                          {" "}
                          • saved {savingsPct.toFixed(1)}%
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Notes: This minifier is conservative. It focuses on safe size
                  reductions like whitespace, comments, and simple attribute
                  cleanup. It does not rewrite paths or transforms.
                </div>
              </div>

              {/* OUTPUT PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output preview
                </div>
                <div className="p-3">
                  {outPreviewUrl ? (
                    <img
                      src={outPreviewUrl}
                      alt="Minified SVG preview"
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Upload an SVG to see the minified output preview.
                    </div>
                  )}
                </div>
              </div>

              {/* OUTPUT SOURCE */}
              {outSvg && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
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
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(outSvg)
                          .then(() => showToast("Copied"));
                      }}
                      className="mt-2 px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                    >
                      Copy SVG
                    </button>
                  </div>
                </details>
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
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <JsonLdBreadcrumbs />
      <JsonLdFaq />
      <SiteFooter />
    </>
  );
}

/* ========================
   Core minify logic (string-based)
======================== */
function minifySvg(svgText: string, settings: Settings): { svg: string } {
  let svg = ensureSvgHasXmlns(svgText);

  // normalize newlines
  svg = svg.replace(/\r\n?/g, "\n");

  if (settings.stripXmlDecl) svg = svg.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  if (settings.stripDoctype)
    svg = svg.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");

  // remove comments
  if (settings.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  }

  if (settings.removeMetadataTag) {
    svg = svg.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
  }

  if (settings.removeEditorsNamespaces) {
    svg = svg.replace(/\sxmlns:(inkscape|sodipodi)\s*=\s*["'][^"']*["']/gi, "");
    svg = svg.replace(
      /\s(?:inkscape|sodipodi):[a-zA-Z0-9_-]+\s*=\s*["'][^"']*["']/gi,
      ""
    );
  }

  // style cleanup
  if (settings.optimizeStyleAttr) {
    svg = svg.replace(/\sstyle\s*=\s*["']([^"']*)["']/gi, (m, style) => {
      const cleaned = String(style)
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((decl) => {
          const i = decl.indexOf(":");
          if (i === -1) return decl.trim();
          const k = decl.slice(0, i).trim();
          const v = decl.slice(i + 1).trim();
          return `${k}:${v}`;
        })
        .join(";");
      return cleaned ? ` style="${escapeAttr(cleaned)}"` : "";
    });
  }

  // remove empty attributes attr=""
  if (settings.removeEmptyAttrs) {
    svg = svg.replace(/\s[a-zA-Z_:][a-zA-Z0-9_.:-]*\s*=\s*["']\s*["']/g, "");
  }

  if (settings.collapseWhitespaceBetweenTags) {
    svg = svg.replace(/>\s+</g, "><");
  }

  if (settings.collapseRunsOfSpaces) {
    svg = svg.replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n");
  }

  if (settings.trimTextNodes) {
    svg = svg.replace(/>([^<]+)</g, (m, text) => `>${String(text).trim()}<`);
  }

  svg = svg.trim();

  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) throw new Error("Could not find <svg> tag.");

  return { svg };
}

/* ========================
   SVG parsing helpers
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;
  return { widthRaw, heightRaw, viewBox };
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

/* ========================
   Attribute editing helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function escapeAttr(v: string) {
  return String(v).replace(/"/g, "&quot;");
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
      .slice(0, 80) || "minified"
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
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
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
                href="/svg-recolor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Recolor
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
              <li>
                <Link
                  to="/svg-minify"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Minify
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
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "SVG Minify",
        item: "/svg-minify",
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
   FAQ JSON-LD
======================== */
function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Does this SVG minify tool upload my file?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The SVG is processed locally in your browser. Nothing is uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "What does SVG minify do?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It removes safe bloat like comments and extra whitespace, and can optionally strip the XML/DOCTYPE header, clean style formatting, and remove empty attributes.",
        },
      },
      {
        "@type": "Question",
        name: "Can minifying break an SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The default options are conservative and usually safe. Trimming text nodes can affect SVGs that rely on exact spacing inside <text>.",
        },
      },
      {
        "@type": "Question",
        name: "Why is the output size sometimes unchanged?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Some SVGs are already compact, or their size is dominated by path data. This tool avoids rewriting paths and transforms, so savings can be small for certain files.",
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
          <h2 className="m-0 font-bold">SVG Minify Tool (Client-Side)</h2>
          <p className="mt-3">
            This <strong>SVG minifier</strong> reduces file size by removing
            safe bloat such as <strong>comments</strong>, extra{" "}
            <strong>whitespace</strong>, and optional headers like{" "}
            <strong>XML</strong> and <strong>DOCTYPE</strong>. Because it is{" "}
            <strong>client-side</strong>, your SVG stays on your device.
          </p>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Minify an SVG
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload or paste an SVG file.</li>
              <li itemProp="step">
                Choose what to remove (comments, whitespace, headers).
              </li>
              <li itemProp="step">Preview the minified result.</li>
              <li itemProp="step">Download the minified SVG.</li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">What This Tool Changes</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Removes comments and collapses whitespace</li>
              <li>Optionally strips XML declaration and DOCTYPE</li>
              <li>Cleans style attributes and removes empty attributes</li>
              <li>
                Optionally removes metadata and common editor-only namespaces
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">When This Tool Is Useful</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Reducing SVG payload size for web performance</li>
              <li>Cleaning exported SVGs from design tools</li>
              <li>Normalizing SVG formatting across a codebase</li>
              <li>Preparing icons and illustrations for shipping</li>
            </ul>
          </section>
        </article>
      </div>

      <section className="">
        <h3 className="m-0 font-bold">Common issues</h3>
        <ul className="mt-3 text-slate-700 list-disc pl-5">
          <li>
            If the output size barely changes, your SVG is probably already
            compact, or most of the size is in path data. This conservative
            minifier does not rewrite path numbers.
          </li>
          <li>
            If your SVG contains visible <code>&lt;text&gt;</code> content, keep
            “Trim text nodes” off to avoid changing spacing.
          </li>
          <li>
            If you need bigger reductions, use the SVGO WASM optimizer tool. It
            can rewrite paths more aggressively.
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-label="Frequently asked questions">
        <h3 className="m-0 font-bold">FAQ</h3>

        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Does this SVG minify tool upload my file?
          </summary>
          <p className="mt-2 text-slate-700">
            No. The SVG is processed locally in your browser. Nothing is
            uploaded to a server.
          </p>
        </details>

        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            What does SVG minify do?
          </summary>
          <p className="mt-2 text-slate-700">
            It removes safe bloat like comments and extra whitespace, and can
            optionally strip the XML/DOCTYPE header, clean <code>style=""</code>{" "}
            formatting, and remove empty attributes.
          </p>
        </details>

        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Can minifying break an SVG?
          </summary>
          <p className="mt-2 text-slate-700">
            The default options are conservative and usually safe. The main
            risky option is trimming text nodes, which can affect SVGs that rely
            on exact spacing inside <code>&lt;text&gt;</code>.
          </p>
        </details>

        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Why is the output size sometimes unchanged?
          </summary>
          <p className="mt-2 text-slate-700">
            Some SVGs are already compact, or their size is dominated by path
            data. This tool avoids rewriting paths and transforms, so savings
            can be small for certain files.
          </p>
        </details>
      </section>
    </section>
  );
}
