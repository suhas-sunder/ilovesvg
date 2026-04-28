import * as React from "react";
import type { Route } from "./+types/svg-cleaner";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | SVG Cleaner & Optimizer (Remove Metadata, Junk)";
  const description =
    "Clean and optimize SVG files instantly in your browser with iLoveSVG. Remove metadata, comments, editor namespaces, XML declarations, DOCTYPE, unused defs, and hidden junk. Preview changes and download a clean SVG. Free, client-side, no uploads.";
  const canonical = "https://www.ilovesvg.com/svg-cleaner";

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

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <>
      <main className=" bg-slate-50 text-slate-900" onPaste={onPaste}>
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
                <h1 className="inline-flex items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                  <h1 className="inline-flex text-center text-sky-800 mb-1 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                    SVG Cleaner
                  </h1>
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadExample}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900"
                  >
                    <Icons name="example" size={16} className="mr-1" />
                    Load example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
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
            <div className="bg-slate-600 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-auto">
              <h2 className="m-0 font-bold mb-3 text-lg text-white">
                Cleaner Settings
              </h2>
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
                    <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                      <div className="grid gap-2 min-w-0">
                        <Field label="Cleanup level">
                          <select
                            value={settings.level}
                            onChange={(e) =>
                              applyLevel(e.target.value as CleanupLevel)
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate cursor-pointer transition-colors hover:bg-slate-50"
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
                                setSettings((s) => ({
                                  ...s,
                                  removeComments: v,
                                }))
                              }
                              label="Remove <!-- comments -->"
                            />
                            <ToggleRow
                              checked={settings.removeMetadataTag}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  removeMetadataTag: v,
                                }))
                              }
                              label="Remove <metadata>"
                            />
                            <ToggleRow
                              checked={settings.removeTitleDesc}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  removeTitleDesc: v,
                                }))
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
                                setSettings((s) => ({
                                  ...s,
                                  removeEmptyGroups: v,
                                }))
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
                                setSettings((s) => ({
                                  ...s,
                                  stripDataAttrs: v,
                                }))
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
                                setSettings((s) => ({
                                  ...s,
                                  stripInlineStyle: v,
                                }))
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
                                setSettings((s) => ({
                                  ...s,
                                  removeEmptyDefs: v,
                                }))
                              }
                              label="Remove empty <defs>"
                            />
                            <ToggleRow
                              checked={settings.removeUnusedDefs}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  removeUnusedDefs: v,
                                }))
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
                                setSettings((s) => ({
                                  ...s,
                                  sanitizeScripts: v,
                                }))
                              }
                              label="Strip risky content (recommended)"
                            />
                            {settings.sanitizeScripts && (
                              <div className="pl-6 flex flex-col gap-2">
                                <ToggleRow
                                  checked={settings.stripScripts}
                                  onChange={(v) =>
                                    setSettings((s) => ({
                                      ...s,
                                      stripScripts: v,
                                    }))
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
                            className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
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
                            className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
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
                                setSettings((s) => ({
                                  ...s,
                                  copyWithQuotes: v,
                                }))
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
                                  className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
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
                              setSettings((s) => ({
                                ...s,
                                fileName: e.target.value,
                              }))
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
                            "flex items-center justify-center px-3.5 py-2 rounded-xl font-bold border transition-colors cursor-pointer",
                            "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                            "disabled:opacity-70 disabled:cursor-not-allowed",
                          ].join(" ")}
                        >
                          <Icons name="copy" size={16} className="mr-1" />
                          Copy Cleaned SVG
                        </button>

                        <button
                          type="button"
                          onClick={downloadOut}
                          disabled={!hydrated || !outSvg}
                          className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <Icons name="download" size={16} className="mr-1" />
                          Download SVG
                        </button>

                        {info && outSvg ? (
                          <span className="text-[13px] text-slate-600">
                            Saved:{" "}
                            <b>{pctSaved(info.bytesIn, info.bytesOut)}%</b> (
                            {formatBytes(info.bytesIn)} →{" "}
                            {formatBytes(info.bytesOut)})
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 text-[13px] text-slate-600">
                        Notes: “Remove id attributes” and “Remove unused defs”
                        can break SVGs that rely on references like{" "}
                        <code>url(#id)</code>, <code>clip-path</code>,{" "}
                        <code>mask</code>, gradients, or symbols.
                      </div>
                    </div>
                  </div>
                )}
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
      <SeoSections />
      <JsonLdBreadcrumbs />
      <Breadcrumbs crumbs={crumbs} />
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

/* ========================
   Breadcrumbs UI + JSON-LD
======================== */
function Breadcrumbs({
  crumbs,
}: {
  crumbs: Array<{ name: string; href: string }>;
}) {
  return (
    <div className="my-4">
      <nav
        aria-label="Breadcrumb"
        className="text-[13px] text-slate-600 max-w-[1180px] mx-auto px-4"
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

type FaqItem = { q: string; a: string };

function makeFaqJsonLd(faq: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq
      .filter((x) => x?.q && x?.a)
      .map((x) => ({
        "@type": "Question",
        name: String(x.q).trim(),
        acceptedAnswer: {
          "@type": "Answer",
          text: String(x.a).trim(),
        },
      })),
  };
}

function safeJsonLd(obj: unknown) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function SeoSections() {
  const faq: FaqItem[] = [
    {
      q: "Does cleaning an SVG change how it looks?",
      a: "Safe and Normal usually preserve rendering. Aggressive cleanup can change output if it removes ids, defs, or styling attributes the SVG relies on.",
    },
    {
      q: "Is this SVG cleaner private?",
      a: "Yes. Everything runs in your browser. Your SVG content is not uploaded to a server.",
    },
    {
      q: "What’s safe to remove for icons and logos?",
      a: "Comments, metadata, editor namespaces, and XML/DOCTYPE wrappers are usually safe to remove. Be careful removing ids or defs if the SVG uses gradients, masks, clip-paths, masks, symbols, or url(#id) references.",
    },
    {
      q: "Why strip scripts and event handlers?",
      a: "SVG can include <script> blocks, on* event handlers, and JavaScript URLs. Stripping them reduces risk when previewing or embedding SVGs from unknown sources.",
    },
    {
      q: "Can this remove Inkscape or Illustrator junk?",
      a: "Yes. It targets common editor prefixes (like inkscape/sodipodi) and metadata blocks that often bloat exported SVG files.",
    },
  ];

  const faqJsonLd = makeFaqJsonLd(faq);

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-900">
        <article className="">
          {/* JSON-LD FAQ (kept in the SEO block, no separate component) */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
          />

          {/* Header */}
          <header>
            <h2 className="m-0 text-2xl md:text-3xl font-extrabold tracking-tight">
              SVG Cleaner (Remove Metadata and Comments)
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              This SVG cleaner removes common bloat like{" "}
              <span className="font-semibold text-slate-900">metadata</span>,{" "}
              <span className="font-semibold text-slate-900">comments</span>,
              editor namespaces, XML declarations, and other extra tags so your
              SVG is smaller, safer to preview, and easier to reuse in web apps,
              icon systems, and design pipelines. Paste SVG markup or upload a
              file, verify the preview, and export a cleaned SVG. Processing
              runs entirely in your browser.
            </p>
            <p className="mt-2 text-slate-600">
              Remove metadata, comments, editor junk, and other bloat from SVG
              files. Runs fully client-side.
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="m-0 text-base font-extrabold text-slate-900">
                    Quick workflow
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                    Use this checklist to get a clean export fast, without
                    breaking references like gradients or clip paths.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Upload or paste
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Pick mode
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Preview
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                    Export SVG
                  </span>
                </div>
              </div>

              <ol className="mt-4 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    1) Start with Safe
                  </span>
                  <div className="mt-1 leading-relaxed">
                    Safe removes obvious bloat and strips risky script behavior
                    while keeping ids/defs intact.
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    2) Compare preview
                  </span>
                  <div className="mt-1 leading-relaxed">
                    If the preview changes after cleaning, step back to Normal
                    or disable aggressive options like id removal.
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    3) Clean for your target
                  </span>
                  <div className="mt-1 leading-relaxed">
                    For icons and web apps, light minification helps. For design
                    handoff, keep readability and ids.
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="font-semibold text-slate-900">
                    4) Export and reuse
                  </span>
                  <div className="mt-1 leading-relaxed">
                    Copy for inline SVG or download to commit to your repo and
                    ship as assets.
                  </div>
                </li>
              </ol>
            </div>
          </header>
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
          <ExampleSvgConversion />

          {/* What it removes / keeps */}
          <section className="mt-2 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                <span className="text-base">🧹</span>
                Removed
              </div>
              <h3 className="mt-3 m-0 text-lg font-extrabold text-slate-900">
                What gets removed
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                The cleaner targets common export bloat and optional risky
                behaviors. It does not “redesign” your SVG.
              </p>

              <ul className="mt-4 space-y-3 text-[13px] text-slate-700">
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold text-slate-900">
                      Comments and metadata:
                    </span>{" "}
                    XML comments,{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;metadata&gt;
                    </code>
                    , RDF blocks, and editor notes.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold text-slate-900">
                      Editor namespaces:
                    </span>{" "}
                    common prefixes from Illustrator/Inkscape that inflate the
                    file and add noise.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold text-slate-900">
                      XML/DOCTYPE wrappers:
                    </span>{" "}
                    optional removal for cleaner embeds and fewer strict-parser
                    warnings.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                    i
                  </span>
                  <span>
                    <span className="font-semibold text-slate-900">
                      Safety stripping (optional):
                    </span>{" "}
                    removes{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      &lt;script&gt;
                    </code>
                    ,{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      on*
                    </code>{" "}
                    handlers, and javascript: URLs.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    <span className="font-semibold text-slate-900">
                      Whitespace cleanup:
                    </span>{" "}
                    trims extra whitespace and optionally lightly minifies
                    markup for smaller output.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                <span className="text-base">🛡️</span>
                Preserved
              </div>
              <h3 className="mt-3 m-0 text-lg font-extrabold text-slate-900">
                What we keep untouched
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                Rendering relies on references. The safest cleaner avoids
                touching the parts that frequently break.
              </p>

              <ul className="mt-4 space-y-3 text-[13px] text-slate-700">
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Geometry and shape content (paths, rects, circles, groups)
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Styling that affects rendering: fills, strokes, gradients,
                    patterns, filters
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    ✓
                  </span>
                  <span>
                    Reference systems: defs, symbols, clip-paths, masks, and{" "}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      url(#id)
                    </code>{" "}
                    links (unless you choose Aggressive options)
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                    i
                  </span>
                  <span>
                    If you enable aggressive id/defs removal, verify preview
                    before exporting. That is the #1 cause of “broken” SVGs.
                  </span>
                </li>
              </ul>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
                <span className="font-semibold text-slate-900">
                  Practical rule:
                </span>{" "}
                if an SVG uses gradients, masks, clip-paths, symbols, or
                filters, treat ids/defs as critical and avoid aggressive
                stripping.
              </div>
            </div>
          </section>

          {/* Modes details */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Mode behavior (what each one is for)
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Safe</div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                  Removes comments, obvious metadata, common editor prefixes,
                  and optional XML/DOCTYPE wrappers. Safety stripping removes
                  script behavior. Keeps ids, defs, and structure intact.
                </p>
                <div className="mt-3 text-[12px] text-slate-600">
                  Best for unknown SVGs and anything you did not create.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Normal</div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                  Similar to Safe, with more consistent whitespace cleanup for
                  web reuse. Usually the best default for icons and inline SVG
                  in apps.
                </p>
                <div className="mt-3 text-[12px] text-slate-600">
                  Good balance when you want smaller output without risk.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Aggressive</div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                  Maximum reduction. Can remove ids, unused defs, and extra
                  attributes. Use only after confirming the cleaned preview
                  matches the input.
                </p>
                <div className="mt-3 text-[12px] text-slate-600">
                  Best for controlled assets after testing (design systems,
                  pre-built icon sets).
                </div>
              </div>
            </div>
          </section>

          {/* Common issues */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Troubleshooting checklist
            </h3>

            <div className="mt-4 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Gradients disappeared
                </div>
                <p className="mt-2 leading-relaxed">
                  You removed ids or defs. Keep ids/defs enabled and avoid
                  aggressive removal on files that use{" "}
                  <code className="px-1 py-0.5 rounded bg-white border border-slate-200">
                    url(#...)
                  </code>{" "}
                  references.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Clip paths or masks broke
                </div>
                <p className="mt-2 leading-relaxed">
                  Same root cause: broken references. Switch to Safe/Normal and
                  re-run, or disable any option that removes ids.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Inline SVG styling is inconsistent
                </div>
                <p className="mt-2 leading-relaxed">
                  Ensure the SVG has a valid{" "}
                  <code className="px-1 py-0.5 rounded bg-white border border-slate-200">
                    viewBox
                  </code>
                  . Missing viewBox leads to odd scaling behavior in HTML and
                  React wrappers.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">
                  Unknown SVG feels risky
                </div>
                <p className="mt-2 leading-relaxed">
                  Keep safety stripping on. SVGs can contain script blocks and
                  event handlers. Stripping them reduces risk during preview and
                  embedding.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
              <span className="font-semibold text-slate-900">
                Privacy note:
              </span>{" "}
              cleaning runs on-device in your browser. Your SVG content is not
              uploaded to a server for conversion.
            </div>
          </section>

          {/* FAQ (rendered + schema from same list) */}
          <section className="mt-8" aria-label="Frequently asked questions">
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
                    <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-transform group-open:rotate-45 hover:bg-slate-100 cursor-pointer">
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

      {/* Keep your other JSON-LD separate if you want */}
      <JsonLdBreadcrumbs />
    </section>
  );
}
