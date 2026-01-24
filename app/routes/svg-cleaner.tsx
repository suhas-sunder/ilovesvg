import * as React from "react";
import type { Route } from "./+types/svg-cleaner";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG Cleaner (Remove metadata, comments, editor junk)";
  const description =
    "Clean SVG files instantly in your browser. Remove metadata, comments, editor namespaces, XML declarations, DOCTYPE, unused defs, and other junk. Preview and download a cleaned SVG. No uploads, no server.";
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
type CleanupLevel = "safe" | "normal" | "aggressive";
type QuoteMode = "double" | "single";

type Settings = {
  level: CleanupLevel;

  // remove wrappers
  stripXmlDecl: boolean;
  stripDoctype: boolean;

  // remove typical junk
  removeComments: boolean;
  removeMetadataTag: boolean; // <metadata>...</metadata>
  removeTitleDesc: boolean; // <title> / <desc>
  removeEditors: boolean; // inkscape/sodipodi/adobe/sketch/figma-ish
  removeUnusedNamespaces: boolean;
  removeEmptyGroups: boolean;

  // attributes cleanup
  stripId: boolean;
  stripClass: boolean;
  stripDataAttrs: boolean;
  stripAria: boolean;
  stripXmlSpace: boolean;
  stripEnableBackground: boolean;
  stripPresentationAttrs: boolean; // fill/stroke/opacity etc (aggressive only by default)
  stripInlineStyle: boolean;

  // defs cleanup
  removeEmptyDefs: boolean;
  removeUnusedDefs: boolean; // best-effort (simple id(#...)) matching

  // whitespace
  normalizeNewlines: boolean;
  minifyWhitespace: boolean;

  // safety
  sanitizeScripts: boolean;
  stripScripts: boolean;
  stripEventHandlers: boolean;
  stripJavascriptHrefs: boolean;
  stripForeignObject: boolean;

  // output
  ensureXmlns: boolean;
  pretty: boolean;
  showPreview: boolean;
  fileName: string;

  // copy helper
  copyWithQuotes: boolean;
  quoteMode: QuoteMode;
};

type SvgInfo = {
  bytesIn: number;
  bytesOut: number;
  removed?: string[];
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  hasScripts?: boolean;
  hasForeignObject?: boolean;
};

const DEFAULTS: Settings = {
  level: "normal",

  stripXmlDecl: true,
  stripDoctype: true,

  removeComments: true,
  removeMetadataTag: true,
  removeTitleDesc: false,
  removeEditors: true,
  removeUnusedNamespaces: true,
  removeEmptyGroups: true,

  stripId: false,
  stripClass: false,
  stripDataAttrs: true,
  stripAria: true,
  stripXmlSpace: true,
  stripEnableBackground: true,
  stripPresentationAttrs: false,
  stripInlineStyle: false,

  removeEmptyDefs: true,
  removeUnusedDefs: false,

  normalizeNewlines: true,
  minifyWhitespace: false,

  sanitizeScripts: true,
  stripScripts: true,
  stripEventHandlers: true,
  stripJavascriptHrefs: true,
  stripForeignObject: false,

  ensureXmlns: true,
  pretty: true,
  showPreview: true,
  fileName: "cleaned",

  copyWithQuotes: false,
  quoteMode: "double",
};

/* ========================
   Page
======================== */
export default function SvgCleaner(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [outSvg, setOutSvg] = React.useState<string>("");
  const [outPreviewUrl, setOutPreviewUrl] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

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
    setInfo(null);
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

    const baseName = stripExt(f.name) || "cleaned";
    setSettings((s) => ({ ...s, fileName: baseName }));

    const url = URL.createObjectURL(
      new Blob([coerced], { type: "image/svg+xml" }),
    );
    setPreviewUrl(url);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (outPreviewUrl) URL.revokeObjectURL(outPreviewUrl);
    setFile(null);
    setSvgText("");
    setPreviewUrl(null);
    setOutSvg("");
    setOutPreviewUrl(null);
    setInfo(null);
    setErr(null);
  }

  function loadExample() {
    const example = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Exported by Some Editor -->
<svg width="256px" height="256px" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">
  <metadata>this is metadata</metadata>
  <title>Example</title>
  <desc>Example description</desc>
  <defs></defs>
  <g id="Layer_1" inkscape:label="Layer 1">
    <!-- A comment -->
    <rect x="24" y="24" width="208" height="208" fill="#0b2dff" opacity="0.15"/>
    <circle cx="128" cy="128" r="70" fill="#0b2dff"/>
  </g>
</svg>`;
    setFile(null);
    setErr(null);
    setSvgText(ensureSvgHasXmlns(example));

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([ensureSvgHasXmlns(example)], { type: "image/svg+xml" }),
      );
    });

    showToast("Example loaded");
  }

  function tryClean(currentSvg = svgText) {
    setErr(null);
    try {
      const res = cleanSvg(currentSvg, settings);
      setOutSvg(res.svg);
      setInfo(res.info);

      setOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(
          new Blob([res.svg], { type: "image/svg+xml" }),
        );
      });
    } catch (e: any) {
      setErr(e?.message || "Clean failed.");
      setOutSvg("");
      setInfo(null);
      setOutPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    }
  }

  React.useEffect(() => {
    if (!svgText.trim()) {
      setOutSvg("");
      setInfo(null);
      setErr(null);
      setOutPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      return;
    }
    tryClean();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, svgText]);

  function copyOut() {
    if (!outSvg) return;
    const t = settings.copyWithQuotes
      ? wrapQuotes(outSvg, settings.quoteMode)
      : outSvg;
    navigator.clipboard.writeText(t).then(() => showToast("Copied"));
  }

  function downloadOut() {
    if (!outSvg) return;
    const name = (settings.fileName || "cleaned").trim() || "cleaned";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(outSvg, filename);
    showToast("Downloaded");
  }

  function applyLevel(level: CleanupLevel) {
    setSettings((s) => {
      const base = { ...s, level };
      if (level === "safe") {
        return {
          ...base,
          stripXmlDecl: true,
          stripDoctype: true,
          removeComments: true,
          removeMetadataTag: true,
          removeTitleDesc: false,
          removeEditors: true,
          removeUnusedNamespaces: true,
          removeEmptyGroups: true,

          stripId: false,
          stripClass: false,
          stripDataAttrs: true,
          stripAria: true,
          stripXmlSpace: true,
          stripEnableBackground: true,
          stripPresentationAttrs: false,
          stripInlineStyle: false,

          removeEmptyDefs: true,
          removeUnusedDefs: false,

          minifyWhitespace: false,
          pretty: true,

          sanitizeScripts: true,
          stripScripts: true,
          stripEventHandlers: true,
          stripJavascriptHrefs: true,
          stripForeignObject: false,
        };
      }
      if (level === "aggressive") {
        return {
          ...base,
          stripXmlDecl: true,
          stripDoctype: true,
          removeComments: true,
          removeMetadataTag: true,
          removeTitleDesc: true,
          removeEditors: true,
          removeUnusedNamespaces: true,
          removeEmptyGroups: true,

          stripId: true,
          stripClass: true,
          stripDataAttrs: true,
          stripAria: true,
          stripXmlSpace: true,
          stripEnableBackground: true,
          stripPresentationAttrs: false,
          stripInlineStyle: false,

          removeEmptyDefs: true,
          removeUnusedDefs: true,

          minifyWhitespace: true,
          pretty: false,

          sanitizeScripts: true,
          stripScripts: true,
          stripEventHandlers: true,
          stripJavascriptHrefs: true,
          stripForeignObject: true,
        };
      }
      // normal
      return {
        ...base,
        stripXmlDecl: true,
        stripDoctype: true,
        removeComments: true,
        removeMetadataTag: true,
        removeTitleDesc: false,
        removeEditors: true,
        removeUnusedNamespaces: true,
        removeEmptyGroups: true,

        stripId: false,
        stripClass: false,
        stripDataAttrs: true,
        stripAria: true,
        stripXmlSpace: true,
        stripEnableBackground: true,
        stripPresentationAttrs: false,
        stripInlineStyle: false,

        removeEmptyDefs: true,
        removeUnusedDefs: false,

        minifyWhitespace: false,
        pretty: true,

        sanitizeScripts: true,
        stripScripts: true,
        stripEventHandlers: true,
        stripJavascriptHrefs: true,
        stripForeignObject: false,
      };
    });
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Cleaner", href: "/svg-cleaner" },
  ];

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
              <span className="text-[#0b2dff]">SVG</span>
              <span className="text-slate-400">Cleaner</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Remove metadata, comments, editor junk, and other bloat from SVG
              files. Runs fully client-side.
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
                        className="mt-2 w-full h-[280px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Input preview
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

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Cleaner Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Cleanup level">
                    <select
                      value={settings.level}
                      onChange={(e) =>
                        applyLevel(e.target.value as CleanupLevel)
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="safe">Safe</option>
                      <option value="normal">Normal</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                    <span className="text-[12px] text-slate-500 shrink-0">
                      Normal is recommended
                    </span>
                  </Field>

                  <Field label="Remove wrappers">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.stripXmlDecl}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripXmlDecl: v }))
                        }
                        label="Remove XML declaration"
                      />
                      <ToggleRow
                        checked={settings.stripDoctype}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripDoctype: v }))
                        }
                        label="Remove DOCTYPE"
                      />
                    </div>
                  </Field>

                  <Field label="Remove junk">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.removeComments}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeComments: v }))
                        }
                        label="Remove <!-- comments -->"
                      />
                      <ToggleRow
                        checked={settings.removeMetadataTag}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeMetadataTag: v }))
                        }
                        label="Remove <metadata>"
                      />
                      <ToggleRow
                        checked={settings.removeTitleDesc}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeTitleDesc: v }))
                        }
                        label="Remove <title> and <desc>"
                      />
                      <ToggleRow
                        checked={settings.removeEditors}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeEditors: v }))
                        }
                        label="Remove editor namespaces/attrs (inkscape, sodipodi, etc.)"
                      />
                      <ToggleRow
                        checked={settings.removeUnusedNamespaces}
                        onChange={(v) =>
                          setSettings((s) => ({
                            ...s,
                            removeUnusedNamespaces: v,
                          }))
                        }
                        label="Remove unused xmlns:* declarations (best-effort)"
                      />
                      <ToggleRow
                        checked={settings.removeEmptyGroups}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeEmptyGroups: v }))
                        }
                        label="Remove empty <g> groups (best-effort)"
                      />
                    </div>
                  </Field>

                  <Field label="Attribute cleanup">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.stripDataAttrs}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripDataAttrs: v }))
                        }
                        label="Remove data-* attributes"
                      />
                      <ToggleRow
                        checked={settings.stripAria}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripAria: v }))
                        }
                        label="Remove aria-* attributes"
                      />
                      <ToggleRow
                        checked={settings.stripXmlSpace}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripXmlSpace: v }))
                        }
                        label='Remove xml:space="preserve"'
                      />
                      <ToggleRow
                        checked={settings.stripEnableBackground}
                        onChange={(v) =>
                          setSettings((s) => ({
                            ...s,
                            stripEnableBackground: v,
                          }))
                        }
                        label="Remove enable-background"
                      />
                      <ToggleRow
                        checked={settings.stripId}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripId: v }))
                        }
                        label="Remove id attributes (can break references)"
                      />
                      <ToggleRow
                        checked={settings.stripClass}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripClass: v }))
                        }
                        label="Remove class attributes"
                      />
                      <ToggleRow
                        checked={settings.stripInlineStyle}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, stripInlineStyle: v }))
                        }
                        label='Remove style="" attributes'
                      />
                      <ToggleRow
                        checked={settings.stripPresentationAttrs}
                        onChange={(v) =>
                          setSettings((s) => ({
                            ...s,
                            stripPresentationAttrs: v,
                          }))
                        }
                        label="Remove presentation attrs (fill/stroke/etc.)"
                      />
                    </div>
                  </Field>

                  <Field label="Defs cleanup">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.removeEmptyDefs}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeEmptyDefs: v }))
                        }
                        label="Remove empty <defs>"
                      />
                      <ToggleRow
                        checked={settings.removeUnusedDefs}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, removeUnusedDefs: v }))
                        }
                        label="Remove unused <defs> by id (#...) (best-effort)"
                      />
                    </div>
                  </Field>

                  <Field label="Whitespace">
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
                        checked={settings.pretty}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, pretty: v }))
                        }
                        label="Pretty format (best effort)"
                      />
                    </div>
                  </Field>

                  <Field label="Safety">
                    <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                      <ToggleRow
                        checked={settings.sanitizeScripts}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, sanitizeScripts: v }))
                        }
                        label="Strip risky content (recommended)"
                      />
                      {settings.sanitizeScripts && (
                        <div className="pl-6 flex flex-col gap-2">
                          <ToggleRow
                            checked={settings.stripScripts}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, stripScripts: v }))
                            }
                            label="Strip <script> blocks"
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
                    </div>
                  </Field>

                  <Field label="Ensure xmlns">
                    <input
                      type="checkbox"
                      checked={settings.ensureXmlns}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          ensureXmlns: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Ensure xmlns on &lt;svg&gt;
                    </span>
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
                      Render cleaned SVG
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
                      placeholder="cleaned"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={copyOut}
                    disabled={!hydrated || !outSvg}
                    className={[
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    Copy Cleaned SVG
                  </button>

                  <button
                    type="button"
                    onClick={downloadOut}
                    disabled={!hydrated || !outSvg}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download SVG
                  </button>

                  {info && outSvg ? (
                    <span className="text-[13px] text-slate-600">
                      Saved: <b>{pctSaved(info.bytesIn, info.bytesOut)}%</b> (
                      {formatBytes(info.bytesIn)} → {formatBytes(info.bytesOut)}
                      )
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Notes: “Remove id attributes” and “Remove unused defs” can
                  break SVGs that rely on references like <code>url(#id)</code>,{" "}
                  <code>clip-path</code>, <code>mask</code>, gradients, or
                  symbols.
                </div>
              </div>

              {/* OUTPUT SOURCE */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Cleaned SVG (source)
                </div>
                <div className="p-3">
                  <textarea
                    value={outSvg}
                    readOnly
                    className="w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
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
                    {outPreviewUrl ? (
                      <img
                        src={outPreviewUrl}
                        alt="Cleaned SVG preview"
                        className="w-full h-auto block"
                      />
                    ) : (
                      <div className="text-slate-600 text-sm">
                        Upload an SVG to preview the cleaned output.
                      </div>
                    )}

                    {info && (info.hasScripts || info.hasForeignObject) ? (
                      <div className="mt-3 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        Detected potentially risky content. Keep Safety options
                        enabled if you did not create this SVG.
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
   Cleaner core (string-based, best-effort)
======================== */
function cleanSvg(
  svgText: string,
  settings: Settings,
): { svg: string; info: SvgInfo } {
  const input = String(svgText || "");
  const bytesIn = new Blob([input]).size;

  let svg = input;

  const removed: string[] = [];

  if (settings.normalizeNewlines) {
    svg = svg.replace(/\r\n?/g, "\n");
  }

  if (settings.stripXmlDecl) {
    const before = svg;
    svg = svg.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
    if (svg !== before) removed.push("XML declaration");
  }

  if (settings.stripDoctype) {
    const before = svg;
    svg = svg.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");
    if (svg !== before) removed.push("DOCTYPE");
  }

  if (settings.removeComments) {
    const before = svg;
    svg = svg.replace(/<!--([\s\S]*?)-->/g, "");
    if (svg !== before) removed.push("Comments");
  }

  if (settings.sanitizeScripts) {
    if (settings.stripScripts) {
      const before = svg;
      svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");
      if (svg !== before) removed.push("<script>");
    }
    if (settings.stripEventHandlers) {
      const before = svg;
      svg = svg.replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");
      svg = svg.replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, "");
      if (svg !== before) removed.push("on* handlers");
    }
    if (settings.stripJavascriptHrefs) {
      const before = svg;
      svg = svg.replace(
        /\s(?:href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi,
        "",
      );
      if (svg !== before) removed.push("javascript: hrefs");
    }
    if (settings.stripForeignObject) {
      const before = svg;
      svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");
      if (svg !== before) removed.push("<foreignObject>");
    }
  }

  if (settings.removeMetadataTag) {
    const before = svg;
    svg = svg.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
    if (svg !== before) removed.push("<metadata>");
  }

  if (settings.removeTitleDesc) {
    const before = svg;
    svg = svg.replace(/<title\b[\s\S]*?<\/title>/gi, "");
    svg = svg.replace(/<desc\b[\s\S]*?<\/desc>/gi, "");
    if (svg !== before) removed.push("<title>/<desc>");
  }

  svg = ensureSvgHasXmlns(svg);

  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) throw new Error("Could not find <svg> tag.");
  const openTag = openMatch[0];

  let newOpen = openTag;

  if (settings.stripXmlSpace) {
    const before = newOpen;
    newOpen = removeAttr(newOpen, "xml:space");
    if (newOpen !== before) removed.push('xml:space="..."');
  }

  if (settings.stripEnableBackground) {
    const before = newOpen;
    newOpen = removeAttr(newOpen, "enable-background");
    if (newOpen !== before) removed.push("enable-background");
  }

  if (settings.stripId) {
    const before = newOpen;
    newOpen = removeAttr(newOpen, "id");
    if (newOpen !== before) removed.push("id attributes (root)");
  }

  if (settings.stripClass) {
    const before = newOpen;
    newOpen = removeAttr(newOpen, "class");
    if (newOpen !== before) removed.push("class attributes (root)");
  }

  if (settings.stripDataAttrs) {
    const before = newOpen;
    newOpen = newOpen.replace(
      /\sdata-[a-z0-9\-_:.]+\s*=\s*["'][^"']*["']/gi,
      "",
    );
    if (newOpen !== before) removed.push("data-* (root)");
  }

  if (settings.stripAria) {
    const before = newOpen;
    newOpen = newOpen.replace(
      /\saria-[a-z0-9\-_:.]+\s*=\s*["'][^"']*["']/gi,
      "",
    );
    if (newOpen !== before) removed.push("aria-* (root)");
  }

  if (settings.removeUnusedNamespaces) {
    // Remove xmlns:prefix="..." if prefix is never used in tag/attr names.
    const before = newOpen;
    newOpen = dropUnusedXmlnsPrefixes(newOpen, svg);
    if (newOpen !== before) removed.push("unused xmlns:*");
  }

  svg = svg.replace(openTag, newOpen);

  if (settings.removeEditors) {
    const before = svg;
    svg = stripEditorJunk(svg);
    if (svg !== before) removed.push("editor namespaces/attrs");
  }

  if (settings.stripInlineStyle) {
    const before = svg;
    svg = svg.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, "");
    if (svg !== before) removed.push('style="..."');
  }

  if (settings.stripId) {
    const before = svg;
    // Remove ids everywhere (dangerous). Keep it simple and consistent.
    svg = svg.replace(/\sid\s*=\s*["'][^"']+["']/gi, "");
    if (svg !== before) removed.push("id attributes");
  }

  if (settings.stripClass) {
    const before = svg;
    svg = svg.replace(/\sclass\s*=\s*["'][^"']+["']/gi, "");
    if (svg !== before) removed.push("class attributes");
  }

  if (settings.stripDataAttrs) {
    const before = svg;
    svg = svg.replace(/\sdata-[a-z0-9\-_:.]+\s*=\s*["'][^"']*["']/gi, "");
    if (svg !== before) removed.push("data-*");
  }

  if (settings.stripAria) {
    const before = svg;
    svg = svg.replace(/\saria-[a-z0-9\-_:.]+\s*=\s*["'][^"']*["']/gi, "");
    if (svg !== before) removed.push("aria-*");
  }

  if (settings.stripPresentationAttrs) {
    const before = svg;
    svg = stripPresentationAttributes(svg);
    if (svg !== before) removed.push("presentation attributes");
  }

  if (settings.removeEmptyDefs) {
    const before = svg;
    svg = svg.replace(/<defs\b[^>]*>\s*<\/defs>/gi, "");
    if (svg !== before) removed.push("empty <defs>");
  }

  if (settings.removeUnusedDefs) {
    const before = svg;
    svg = removeUnusedDefsBestEffort(svg);
    if (svg !== before) removed.push("unused <defs> by id (best-effort)");
  }

  if (settings.removeEmptyGroups) {
    const before = svg;
    svg = removeEmptyGroupsBestEffort(svg);
    if (svg !== before) removed.push("empty <g> groups (best-effort)");
  }

  if (settings.minifyWhitespace) {
    svg = svg
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    svg = svg.trim();
  }

  if (settings.pretty && !settings.minifyWhitespace) {
    svg = prettySvg(svg);
  }

  if (settings.ensureXmlns) {
    svg = ensureSvgHasXmlns(svg);
  }

  if (!/<svg\b/i.test(svg))
    throw new Error("Output does not contain an <svg> root tag.");

  const bytesOut = new Blob([svg]).size;
  const parsed = parseSvgInfoLite(svg);

  return {
    svg,
    info: {
      bytesIn,
      bytesOut,
      removed,
      ...parsed,
    },
  };
}

function parseSvgInfoLite(
  svg: string,
): Pick<
  SvgInfo,
  "widthRaw" | "heightRaw" | "viewBox" | "hasScripts" | "hasForeignObject"
> {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const hasScripts = /<script\b/i.test(svg) || /\son[a-z]+\s*=\s*/i.test(svg);
  const hasForeignObject = /<foreignObject\b/i.test(svg);

  return { widthRaw, heightRaw, viewBox, hasScripts, hasForeignObject };
}

function stripEditorJunk(svg: string) {
  let s = svg;

  // Remove common editor XML namespaces if present as xmlns:* (we still may keep if used; unused removal is separate)
  // Remove common editor-only attributes anywhere.
  const editorPrefixes = [
    "inkscape",
    "sodipodi",
    "rdf",
    "cc",
    "dc",
    "sketch",
    "serif",
    "adobe",
  ];

  // Remove attributes like inkscape:label="...", sodipodi:namedview, etc.
  for (const p of editorPrefixes) {
    const reAttr = new RegExp(
      `\\s${p}:[a-z0-9_\\-:.]+\\s*=\\s*["'][^"']*["']`,
      "gi",
    );
    s = s.replace(reAttr, "");
  }

  // Remove <sodipodi:namedview .../> blocks and similar
  s = s.replace(/<sodipodi:namedview\b[\s\S]*?\/>/gi, "");
  s = s.replace(/<inkscape:.*?\b[\s\S]*?\/>/gi, "");

  // Remove <rdf:RDF> metadata blocks (often huge)
  s = s.replace(/<rdf:RDF\b[\s\S]*?<\/rdf:RDF>/gi, "");

  return s;
}

function stripPresentationAttributes(svg: string) {
  // Dangerous: removes styling attributes often needed for correct rendering.
  // Keep list conservative.
  const attrs = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "fill-opacity",
    "opacity",
    "stop-color",
    "stop-opacity",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-anchor",
  ];
  let s = svg;
  for (const a of attrs) {
    const re = new RegExp(`\\s${escapeRegExp(a)}\\s*=\\s*["'][^"']*["']`, "gi");
    s = s.replace(re, "");
  }
  return s;
}

function removeUnusedDefsBestEffort(svg: string) {
  // Parse ids inside <defs> and remove those elements if there are no obvious references
  // to #id or url(#id) or href="#id".
  const defsMatch = svg.match(/<defs\b[^>]*>[\s\S]*?<\/defs>/i);
  if (!defsMatch) return svg;

  const defsBlock = defsMatch[0];
  const ids = Array.from(
    defsBlock.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi),
  ).map((m) => m[1]);
  if (!ids.length) return svg;

  let s = svg;

  for (const id of ids) {
    const idRe = new RegExp(`#${escapeRegExp(id)}\\b`);
    const urlRe = new RegExp(`url\\(\\s*#${escapeRegExp(id)}\\s*\\)`, "i");
    const hrefRe = new RegExp(
      `\\b(?:href|xlink:href)\\s*=\\s*["']#${escapeRegExp(id)}["']`,
      "i",
    );

    // If referenced anywhere outside <defs> itself, keep.
    const withoutDefs = s.replace(defsBlock, "");
    if (
      idRe.test(withoutDefs) ||
      urlRe.test(withoutDefs) ||
      hrefRe.test(withoutDefs)
    ) {
      continue;
    }

    // Remove element with that id anywhere (best-effort). Prefer removing within defs.
    const re = new RegExp(
      `<([a-zA-Z_:][\\w:.-]*)\\b([^>]*\\sid\\s*=\\s*["']${escapeRegExp(id)}["'][^>]*)>[\\s\\S]*?<\\/\\1>`,
      "i",
    );
    const reSelf = new RegExp(
      `<([a-zA-Z_:][\\w:.-]*)\\b([^>]*\\sid\\s*=\\s*["']${escapeRegExp(id)}["'][^>]*)\\/?>`,
      "i",
    );

    // Attempt inside defs block first
    const newDefs = defsBlock
      .replace(re, "")
      .replace(reSelf, (m0) => (m0.endsWith("/>") ? "" : m0));

    if (newDefs !== defsBlock) {
      s = s.replace(defsBlock, newDefs);
    }
  }

  // Remove empty defs if created
  s = s.replace(/<defs\b[^>]*>\s*<\/defs>/gi, "");
  return s;
}

function removeEmptyGroupsBestEffort(svg: string) {
  let s = svg;

  // Remove <g ...></g> when it contains only whitespace/newlines.
  // Run multiple passes because nested groups can become empty after removals.
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/<g\b[^>]*>\s*<\/g>/gi, "");
    if (s === before) break;
  }

  return s;
}

function dropUnusedXmlnsPrefixes(openTag: string, fullSvg: string) {
  let out = openTag;

  // Collect xmlns:prefix declarations on the root <svg>
  const decls = Array.from(
    openTag.matchAll(/\sxmlns:([a-z0-9_\-]+)\s*=\s*["'][^"']*["']/gi),
  ).map((m) => m[1]);

  if (!decls.length) return out;

  for (const prefix of decls) {
    // If prefix is used anywhere as "prefix:" in element/attribute names, keep.
    const used = new RegExp(`\\b${escapeRegExp(prefix)}:`, "i").test(
      fullSvg.replace(openTag, ""),
    );
    if (used) continue;

    const re = new RegExp(
      `\\sxmlns:${escapeRegExp(prefix)}\\s*=\\s*["'][^"']*["']`,
      "i",
    );
    out = out.replace(re, "");
  }

  return out;
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
    const isOpen =
      /^<[^/!][^>]*>$/.test(line) &&
      !/\/>$/.test(line) &&
      !/^<svg\b/i.test(line);
    const isSelf = /\/>$/.test(line) || /^<\?/.test(line) || /^<!/.test(line);

    if (isClose) indent = Math.max(0, indent - 1);
    out.push("  ".repeat(indent) + line);
    if (isOpen && !isSelf) indent += 1;
  }

  return out.join("\n").trim();
}

/* ========================
   Basic helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function removeAttr(tag: string, name: string) {
  const re = new RegExp(
    `\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`,
    "ig",
  );
  return tag.replace(re, "");
}

function escapeRegExp(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      .slice(0, 80) || "cleaned"
  );
}

function wrapQuotes(s: string, mode: QuoteMode) {
  if (mode === "single") return `'${s.replace(/'/g, "\\'")}'`;
  return `"${s.replace(/"/g, '\\"')}"`;
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function pctSaved(inBytes: number, outBytes: number) {
  if (!inBytes || !Number.isFinite(inBytes) || inBytes <= 0) return 0;
  const saved = (1 - outBytes / inBytes) * 100;
  return Math.max(0, Math.min(99.9, Math.round(saved * 10) / 10));
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
        name: "SVG Cleaner",
        item: `${baseUrl}/svg-cleaner`,
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
        name: "Does cleaning an SVG change how it looks?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Safe and Normal usually preserve rendering. Aggressive cleanup can change output if it removes ids, defs, or styling attributes the SVG relies on.",
        },
      },
      {
        "@type": "Question",
        name: "Is this SVG cleaner private?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Everything runs in your browser. Your SVG content is not uploaded to a server.",
        },
      },
      {
        "@type": "Question",
        name: "What’s safe to remove for icons and logos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Comments, metadata, editor namespaces, and XML/DOCTYPE wrappers are usually safe to remove. Be careful removing ids or defs if the SVG uses gradients, masks, clip-paths, or symbols.",
        },
      },
      {
        "@type": "Question",
        name: "Why strip scripts and event handlers?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SVG can include script blocks, on* event handlers, and JavaScript URLs. Stripping them reduces risk when previewing or embedding SVGs from unknown sources.",
        },
      },
      {
        "@type": "Question",
        name: "Can this remove Inkscape or Illustrator junk?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. It targets common editor prefixes (like inkscape/sodipodi) and metadata blocks that often bloat exported SVG files.",
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
            SVG Cleaner (Remove Metadata and Comments)
          </h2>
          <p className="mt-3">
            This <strong>SVG cleaner</strong> removes common bloat like{" "}
            <strong>metadata</strong>, <strong>comments</strong>, editor
            namespaces, XML declarations, and other extra tags so your SVG is
            smaller and easier to reuse in websites, apps, and design systems.
            Paste an SVG or upload a file, preview the result, and download the
            cleaned SVG. Everything runs <strong>client-side</strong>.
          </p>

          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3 itemProp="name" className="m-0 font-bold">
              How to Clean an SVG
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2">
              <li itemProp="step">Upload an SVG or paste SVG code.</li>
              <li itemProp="step">
                Choose Safe, Normal, or Aggressive cleanup.
              </li>
              <li itemProp="step">
                Enable options like removing metadata and comments.
              </li>
              <li itemProp="step">Copy or download the cleaned SVG.</li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">What gets removed?</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>XML declaration and DOCTYPE (optional)</li>
              <li>Comments, editor junk (Inkscape/Illustrator style)</li>
              <li>&lt;metadata&gt; blocks and RDF metadata</li>
              <li>
                Optional stripping of scripts and event handlers for safety
              </li>
              <li>Whitespace cleanup and optional minification</li>
            </ul>
          </section>
        </article>
      </div>

      <section className="mt-10">
        <h3 className="m-0 font-bold">Why clean SVG files?</h3>
        <p className="mt-3">
          SVGs exported from tools like Illustrator and Inkscape often include
          extra tags and attributes that are helpful for editing but unnecessary
          in production. Cleaning can reduce file size, remove editor-only
          namespaces, and make SVGs easier to inline in HTML, use in React, or
          ship as icons in a design system.
        </p>
      </section>

      <section className="mt-10">
        <h3 className="m-0 font-bold">Safe vs Normal vs Aggressive</h3>
        <div className="mt-3 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="m-0 font-semibold">Safe</h4>
            <p className="mt-2 text-slate-700">
              Best for most SVGs. Removes obvious bloat (comments, metadata,
              editor junk) while keeping structure that SVGs commonly rely on.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="m-0 font-semibold">Normal</h4>
            <p className="mt-2 text-slate-700">
              Recommended default. Similar to Safe, with a bit more cleanup for
              reusable web SVGs. Usually keeps rendering intact.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="m-0 font-semibold">Aggressive</h4>
            <p className="mt-2 text-slate-700">
              For maximum reduction. Can remove ids, unused defs, and more
              whitespace. Use carefully because it can break references like
              gradients, clip-paths, masks, symbols, or <code>url(#id)</code>.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h3 className="m-0 font-bold">Common issues</h3>
        <ul className="mt-3 text-slate-700 list-disc pl-5">
          <li>
            If an SVG looks different after cleaning, turn off options like
            removing ids, removing unused defs, or removing presentation
            attributes.
          </li>
          <li>
            Inline SVGs often work best with a valid <code>viewBox</code>. If
            yours is missing, use an SVG viewBox fixer or dimensions inspector.
          </li>
          <li>
            If you didn’t create the SVG, keep Safety options enabled to strip
            scripts and event handlers before previewing.
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-label="Frequently asked questions">
        <h3 className="m-0 font-bold">FAQ</h3>

        <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Does cleaning an SVG change how it looks?
          </summary>
          <p className="mt-2 text-slate-700">
            Safe and Normal usually preserve rendering. Aggressive cleanup can
            change output if it removes ids, defs, or styling attributes the SVG
            relies on.
          </p>
        </details>

        <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Is this SVG cleaner private?
          </summary>
          <p className="mt-2 text-slate-700">
            Yes. Everything runs in your browser. Your SVG content is not
            uploaded to a server.
          </p>
        </details>

        <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            What’s safe to remove for icons and logos?
          </summary>
          <p className="mt-2 text-slate-700">
            Comments, metadata, editor namespaces, and XML/DOCTYPE wrappers are
            usually safe to remove. Be careful removing ids or defs if the SVG
            uses gradients, masks, clip-paths, or symbols.
          </p>
        </details>

        <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Why strip scripts and event handlers?
          </summary>
          <p className="mt-2 text-slate-700">
            SVG can include <code>&lt;script&gt;</code>, <code>on*</code>{" "}
            handlers, and JavaScript URLs. Stripping them reduces risk when
            previewing or embedding SVGs from unknown sources.
          </p>
        </details>

        <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Can this remove Inkscape or Illustrator junk?
          </summary>
          <p className="mt-2 text-slate-700">
            Yes. It targets common editor prefixes (like inkscape/sodipodi) and
            metadata blocks that often bloat exported SVG files.
          </p>
        </details>
      </section>

      <JsonLdBreadcrumbs />
      <JsonLdFaq />
    </section>
  );
}
