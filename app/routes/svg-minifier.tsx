import * as React from "react";
import type { Route } from "./+types/svg-minifier";
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
  const title = "iLoveSVG | SVG Minify Tool (Client-Side SVG Minifier)";
  const description =
    "Minify SVG files instantly with iLoveSVG. Remove comments, collapse whitespace, optionally strip XML or DOCTYPE, clean style attributes, minify path/transform spacing, remove metadata, and download the optimized SVG. Free, fully client-side, no uploads.";
  const canonical = "https://www.ilovesvg.com/svg-minifier";

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
   FAQ (single source of truth)
======================== */
const FAQ_ITEMS = [
  {
    q: "Does this SVG minify tool upload my file?",
    a: "No. The SVG is processed locally in your browser. Nothing is uploaded to a server.",
  },
  {
    q: "What does SVG minify do?",
    a: "It removes safe bloat like comments and extra whitespace, and can optionally strip the XML/DOCTYPE header, clean style formatting, remove empty attributes, remove metadata/title/desc, and minify path/transform spacing without changing geometry.",
  },
  {
    q: "Can minifying break an SVG?",
    a: "The default options are conservative and usually safe. The main risky content is visible <text> that depends on exact spacing; keep text trimming off if your SVG uses precise spacing.",
  },
  {
    q: "Why is the output size sometimes unchanged?",
    a: "Some SVGs are already compact, or their size is dominated by path data. This tool does not rewrite numbers or apply lossy rounding by default, so savings can be small on certain files.",
  },
];

/* ========================
   Types
======================== */
type Settings = {
  stripXmlDecl: boolean;
  stripDoctype: boolean;

  removeComments: boolean;
  removeCdataSections: boolean;

  collapseWhitespaceBetweenTags: boolean;
  collapseRunsOfSpacesInTags: boolean;
  normalizeNewlines: boolean;

  optimizeStyleAttr: boolean;
  removeEmptyAttrs: boolean;

  removeMetadataTag: boolean;
  removeTitleDesc: boolean;

  removeEditorsNamespaces: boolean;
  removeEditorsAttrs: boolean;
  removeXmlSpaceAttr: boolean;

  removeEmptyContainers: boolean;

  minifyPathDataSpacing: boolean;
  minifyPointsSpacing: boolean;
  minifyTransformSpacing: boolean;

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
  removeCdataSections: false,

  collapseWhitespaceBetweenTags: true,
  collapseRunsOfSpacesInTags: true,
  normalizeNewlines: true,

  optimizeStyleAttr: true,
  removeEmptyAttrs: true,

  removeMetadataTag: false,
  removeTitleDesc: false,

  removeEditorsNamespaces: true,
  removeEditorsAttrs: true,
  removeXmlSpaceAttr: false,

  removeEmptyContainers: false,

  minifyPathDataSpacing: true,
  minifyPointsSpacing: true,
  minifyTransformSpacing: true,

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
      new Blob([coerced], { type: "image/svg+xml" }),
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
    { name: "SVG Minify", href: "/svg-minifier" },
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

          <section className="lg:pt-0 lg:pb-8 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm overflow-hidden min-w-0">
              <h1 className="inline-flex text-sky-800 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                SVG Minify
              </h1>
              <p className="mt-2 text-slate-600">
                Minify an SVG by removing safe bloat like <b>comments</b> and
                extra <b>whitespace</b>, cleaning <b>style</b>, and minifying
                common attribute formatting (like <b>path d</b> spacing) without
                changing geometry. This runs fully client-side.
              </p>

              {!file ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
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
                      className="w-full h-auto block transparent-checkerboard"
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
            <div className="bg-slate-600 sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm min-w-0 overflow-auto">
              <h2 className="m-0 font-bold mb-3 text-lg text-white">
                Minify Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove {"<!-- ... -->"}
                        </span>
                      </Field>

                      <Field label="Remove CDATA blocks">
                        <input
                          type="checkbox"
                          checked={settings.removeCdataSections}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              removeCdataSections: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove {"<![CDATA[ ... ]]>"}
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Collapse {">   <"} to {"><"} (safe for markup)
                        </span>
                      </Field>

                      <Field label="Collapse spaces in tags">
                        <input
                          type="checkbox"
                          checked={settings.collapseRunsOfSpacesInTags}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              collapseRunsOfSpacesInTags: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Reduce spacing inside {"<...>"} only
                        </span>
                      </Field>

                      <Field label="Normalize newlines">
                        <input
                          type="checkbox"
                          checked={settings.normalizeNewlines}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              normalizeNewlines: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Collapse repeated blank lines
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove {"<metadata>...</metadata>"}
                        </span>
                      </Field>

                      <Field label="Remove title/desc">
                        <input
                          type="checkbox"
                          checked={settings.removeTitleDesc}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              removeTitleDesc: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove {"<title>"} / {"<desc>"} (a11y tradeoff)
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove inkscape/sodipodi xmlns:*
                        </span>
                      </Field>

                      <Field label="Remove editor attributes">
                        <input
                          type="checkbox"
                          checked={settings.removeEditorsAttrs}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              removeEditorsAttrs: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove inkscape/sodipodi:* attrs
                        </span>
                      </Field>

                      <Field label="Remove xml:space">
                        <input
                          type="checkbox"
                          checked={settings.removeXmlSpaceAttr}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              removeXmlSpaceAttr: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove xml:space="preserve" (can affect text)
                        </span>
                      </Field>

                      <Field label="Remove empty containers">
                        <input
                          type="checkbox"
                          checked={settings.removeEmptyContainers}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              removeEmptyContainers: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove empty {"<g/>"} / {"<defs/>"} / {"<symbol/>"}
                        </span>
                      </Field>

                      <Field label="Minify path d spacing">
                        <input
                          type="checkbox"
                          checked={settings.minifyPathDataSpacing}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              minifyPathDataSpacing: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Remove redundant spaces/commas (no rounding)
                        </span>
                      </Field>

                      <Field label="Minify points spacing">
                        <input
                          type="checkbox"
                          checked={settings.minifyPointsSpacing}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              minifyPointsSpacing: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Clean points="x,y x,y"
                        </span>
                      </Field>

                      <Field label="Minify transform spacing">
                        <input
                          type="checkbox"
                          checked={settings.minifyTransformSpacing}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              minifyTransformSpacing: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          Clean transform="translate(1, 2) ..."
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
                          className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700 min-w-0">
                          May affect {"<text>"} spacing
                        </span>
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
                          placeholder="minified"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                {/* Actions stay outside advanced panel */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadMinified}
                    disabled={!hydrated || !outSvg}
                    className={[
                      "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icons name="download" size={16} className="mr-1" />
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
                  Notes: Defaults aim for meaningful size reduction without
                  altering geometry. For bigger wins, you need an SVGO-style
                  optimizer that rewrites path numbers, which can be risky.
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
                      className="w-full h-auto block transparent-checkerboard"
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
                      className="inline-flex items-center justify-center mt-2 px-3 py-2 rounded-lg font-medium border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                    >
                      <Icons name="copy" size={16} className="mr-1" />
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
      <JsonLdFaq />
      <Breadcrumbs crumbs={crumbs} />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Core minify logic (robust + conservative)
======================== */
function minifySvg(svgText: string, settings: Settings): { svg: string } {
  let svg = ensureSvgHasXmlns(svgText);

  // normalize newlines early (optional)
  svg = svg.replace(/\r\n?/g, "\n");

  if (settings.stripXmlDecl) {
    // remove xml decl even if preceded by BOM/whitespace
    svg = svg.replace(/^\uFEFF?\s*<\?xml[\s\S]*?\?>\s*/i, "");
  }

  if (settings.stripDoctype) {
    // remove doctype near the top (common), but also handle stray occurrences
    svg = svg.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");
    svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  }

  // remove CDATA (rare in SVG; more common with embedded CSS/scripts)
  if (settings.removeCdataSections) {
    svg = svg.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  }

  // remove comments
  if (settings.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  }

  if (settings.removeMetadataTag) {
    svg = svg.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
  }

  if (settings.removeTitleDesc) {
    // Title/desc can be used for accessibility; leave off by default
    svg = svg.replace(/<title\b[\s\S]*?<\/title>/gi, "");
    svg = svg.replace(/<desc\b[\s\S]*?<\/desc>/gi, "");
  }

  if (settings.removeEditorsNamespaces) {
    // common editor namespaces (not only inkscape/sodipodi)
    svg = svg.replace(/\sxmlns:(inkscape|sodipodi)\s*=\s*["'][^"']*["']/gi, "");
    svg = svg.replace(/\sxmlns:(cc|dc|rdf)\s*=\s*["'][^"']*["']/gi, "");
  }

  if (settings.removeEditorsAttrs) {
    // editor attrs (InkScape/Sodipodi)
    svg = svg.replace(
      /\s(?:inkscape|sodipodi):[a-zA-Z0-9_.:-]+\s*=\s*["'][^"']*["']/gi,
      "",
    );
    // some editor-only attrs without namespaces (safe-ish)
    svg = svg.replace(/\s(?:enable-background)\s*=\s*["'][^"']*["']/gi, "");
  }

  if (settings.removeXmlSpaceAttr) {
    svg = svg.replace(/\sxml:space\s*=\s*["'][^"']*["']/gi, "");
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

  // Minify transform spacing (no numeric changes)
  if (settings.minifyTransformSpacing) {
    svg = svg.replace(/\stransform\s*=\s*["']([^"']*)["']/gi, (m, val) => {
      const cleaned = minifyTransformValue(String(val));
      return cleaned ? ` transform="${escapeAttr(cleaned)}"` : m;
    });
  }

  // Minify points spacing (no numeric changes)
  if (settings.minifyPointsSpacing) {
    svg = svg.replace(/\spoints\s*=\s*["']([^"']*)["']/gi, (m, val) => {
      const cleaned = minifyPointsValue(String(val));
      return cleaned ? ` points="${escapeAttr(cleaned)}"` : m;
    });
  }

  // Minify path "d" spacing (no numeric changes / no rounding)
  if (settings.minifyPathDataSpacing) {
    svg = svg.replace(/\sd\s*=\s*["']([^"']*)["']/gi, (m, val) => {
      const cleaned = minifyPathDataValue(String(val));
      return cleaned ? ` d="${escapeAttr(cleaned)}"` : m;
    });
  }

  // remove empty attributes attr=""
  if (settings.removeEmptyAttrs) {
    svg = svg.replace(/\s[a-zA-Z_:][a-zA-Z0-9_.:-]*\s*=\s*["']\s*["']/g, "");
  }

  if (settings.collapseWhitespaceBetweenTags) {
    // remove ONLY whitespace that exists between tag close/open boundaries
    svg = svg.replace(/>\s+</g, "><");
  }

  if (settings.collapseRunsOfSpacesInTags) {
    // collapse runs of spaces INSIDE tags only to avoid changing text nodes
    svg = svg.replace(/<[^>]+>/g, (tag) =>
      tag
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s*=\s*/g, "=") // safe inside tag: a = "b" -> a="b"
        .replace(/\s+>/g, ">"),
    );
  }

  if (settings.normalizeNewlines) {
    svg = svg.replace(/\n{2,}/g, "\n");
  }

  if (settings.trimTextNodes) {
    // This can change visual spacing in <text>. Off by default.
    svg = svg.replace(/>([^<]+)</g, (m, text) => `>${String(text).trim()}<`);
  }

  if (settings.removeEmptyContainers) {
    // conservative: remove truly empty containers (no text/children)
    svg = svg.replace(/<g\b[^>]*>\s*<\/g>/gi, "");
    svg = svg.replace(/<defs\b[^>]*>\s*<\/defs>/gi, "");
    svg = svg.replace(/<symbol\b[^>]*>\s*<\/symbol>/gi, "");
    svg = svg.replace(/<clipPath\b[^>]*>\s*<\/clipPath>/gi, "");
    svg = svg.replace(/<mask\b[^>]*>\s*<\/mask>/gi, "");
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
   Value minifiers (no numeric rounding)
======================== */
function minifyTransformValue(input: string) {
  // Normalize commas/spaces but do not change numbers.
  // Example: "translate(1, 2) rotate( 45 )" -> "translate(1 2) rotate(45)"
  let s = input.trim();
  // remove newlines/tabs
  s = s.replace(/[\n\r\t]+/g, " ");
  // remove spaces around parentheses
  s = s.replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")");
  // commas to spaces inside args
  s = s.replace(/,/g, " ");
  // collapse spaces
  s = s.replace(/[ ]{2,}/g, " ");
  // remove space between command and '(' already handled; ensure ")( " patterns
  s = s.replace(/\)\s+(?=[a-zA-Z])/g, ") ");
  return s.trim();
}

function minifyPointsValue(input: string) {
  // points="x,y x,y" -> "x y x y" (commas not needed), collapse spaces
  let s = input.trim();
  s = s.replace(/[\n\r\t]+/g, " ");
  s = s.replace(/,/g, " ");
  s = s.replace(/[ ]{2,}/g, " ");
  return s.trim();
}

function minifyPathDataValue(input: string) {
  // Conservative path minify:
  // - collapse whitespace
  // - convert commas to spaces
  // - remove spaces around +/- where safe
  // - remove spaces before command letters
  // No rounding, no number rewriting.
  let s = input.trim();
  s = s.replace(/[\n\r\t]+/g, " ");
  s = s.replace(/,/g, " ");
  s = s.replace(/[ ]{2,}/g, " ");

  // Remove spaces before commands: "  L" -> "L"
  s = s.replace(/\s+([a-zA-Z])/g, "$1");

  // Remove space before minus sign when it separates numbers: "10 -5" -> "10-5"
  // Keep space after command letters intact because we just removed it above.
  s = s.replace(/(\d)\s+(-)/g, "$1$2");

  // Remove space after minus sign? No.
  // Remove space before decimal leading dot? "0 .5" is weird but handle ".5"
  s = s.replace(/(\d)\s+(\.)/g, "$1$2");

  return s.trim();
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
        name: "SVG Minify",
        item: `${baseUrl}/svg-minifier`,
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
   FAQ JSON-LD (derived from FAQ_ITEMS)
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/* ========================
   SEO sections (single visible FAQ, no duplicates)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-900">
        <article>
          <h2 className="m-0 text-2xl md:text-3xl font-extrabold tracking-tight">
            SVG Minify Tool (Client-Side)
          </h2>

          {/* Core intro (tight, relevant) */}
          <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
            This tool reduces SVG size by stripping non-visual bloat: comments,
            editor metadata, redundant whitespace, and noisy attribute
            formatting. It runs entirely in your browser, so your file never
            leaves your device. The defaults are conservative and aim to
            preserve rendering while still producing meaningful savings for
            typical exports from design tools.
          </p>

          {/* What it does (practical, not bloggy) */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h3 className="m-0 text-base font-extrabold text-slate-900">
                  What gets reduced (and why it is usually safe)
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                  SVGs often grow because tools export extra markup that does
                  not affect the final pixels. Removing that bloat shrinks files
                  without changing the shapes.
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  No uploads
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  Conservative defaults
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                  Preview + export
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">Comments</div>
                <p className="mt-2 leading-relaxed">
                  Designers and libraries sometimes leave{" "}
                  <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                    &lt;!-- ... --&gt;
                  </code>{" "}
                  blocks for humans. Browsers ignore them, so removing comments
                  typically saves bytes with no visual impact.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">Whitespace</div>
                <p className="mt-2 leading-relaxed">
                  Extra spacing between tags and inside markup can add up fast,
                  especially in large icon sets. Collapsing markup whitespace is
                  generally safe because browsers treat it as insignificant
                  outside text nodes.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Style attribute cleanup
                </div>
                <p className="mt-2 leading-relaxed">
                  Exports often include messy{" "}
                  <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                    style=""
                  </code>{" "}
                  strings with inconsistent spacing. Normalizing the formatting
                  reduces size while preserving the same declarations.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Editor-only metadata
                </div>
                <p className="mt-2 leading-relaxed">
                  Tools like Inkscape or Illustrator may add{" "}
                  <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                    &lt;metadata&gt;
                  </code>{" "}
                  blocks and editor namespaces. Removing those can materially
                  shrink files, especially for assets exported in bulk.
                </p>
              </div>
            </div>
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
          </section>

          {/* Workflow (direct, tool-centric) */}
          <section
            className="mt-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3
              itemProp="name"
              className="m-0 text-lg font-extrabold text-slate-900"
            >
              How to minify an SVG
            </h3>

            <ol className="mt-3 grid gap-2 list-decimal pl-5 text-[13px] leading-relaxed text-slate-700">
              <li itemProp="step">Upload or paste an SVG file.</li>
              <li itemProp="step">
                Leave the defaults on for a safe first pass (comments + markup
                whitespace + style cleanup).
              </li>
              <li itemProp="step">
                Toggle additional removals if your SVG is an export (metadata,
                editor namespaces, empty attributes, path/transform spacing).
              </li>
              <li itemProp="step">
                Compare the input and output previews, then download the
                minified SVG.
              </li>
            </ol>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
              <span className="font-semibold text-slate-900">Tip:</span> If your
              file includes visible{" "}
              <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                &lt;text&gt;
              </code>{" "}
              content, keep “Trim text nodes” and “Remove xml:space” off unless
              you have verified spacing remains correct.
            </div>
          </section>

          {/* Options (dense, relevant, not educational fluff) */}
          <section className="mt-8">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Settings that usually matter for file size
            </h3>

            <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
              Not every switch is worth it. The items below tend to produce real
              savings across common SVGs while staying non-destructive. The goal
              is to reduce markup and formatting noise, not to rewrite geometry.
              If you need aggressive compression (rounding path numbers, merging
              paths, converting shapes), that is a different class of optimizer
              and can change output. This tool stays on the safe side.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Markup whitespace cleanup
                </div>
                <p className="mt-2 leading-relaxed">
                  Collapsing whitespace between tags and inside tags removes a
                  lot of export noise. It typically has no rendering effect
                  because browsers ignore formatting whitespace in markup.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Path / points / transform spacing
                </div>
                <p className="mt-2 leading-relaxed">
                  Many SVGs are dominated by attribute text like{" "}
                  <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                    d=""
                  </code>{" "}
                  and{" "}
                  <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                    transform=""
                  </code>
                  . Minifying spacing (commas, redundant spaces) reduces bytes
                  without rounding numbers or changing geometry.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Remove editor namespaces / attributes
                </div>
                <p className="mt-2 leading-relaxed">
                  Inkscape and similar tools attach editor-only attributes that
                  do not affect rendering in a browser. Removing these is often
                  a solid win for exported assets.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900">
                  Remove metadata and empty attributes
                </div>
                <p className="mt-2 leading-relaxed">
                  Metadata blocks and empty{" "}
                  <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                    attr=""
                  </code>{" "}
                  attributes are common in exports. If you are shipping icons or
                  illustrations, removing these is usually safe.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-700">
              <div className="font-semibold text-slate-900">
                Things intentionally treated as “advanced”
              </div>
              <p className="mt-2 leading-relaxed">
                Removing{" "}
                <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                  &lt;title&gt;
                </code>{" "}
                and{" "}
                <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                  &lt;desc&gt;
                </code>{" "}
                can shrink files, but it can reduce accessibility and tooltips
                in some contexts. Trimming text nodes and removing{" "}
                <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">
                  xml:space
                </code>{" "}
                can affect text rendering for files that rely on precise
                spacing.
              </p>
            </div>
          </section>

          {/* Common issues (practical only) */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Common issues
            </h3>

            <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-slate-700">
              <li className="flex gap-3">
                <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  i
                </span>
                <span>
                  If the output size barely changes, your SVG may already be
                  compact or dominated by path numbers. Spacing cleanup helps,
                  but bigger gains usually require numeric optimization (which
                  can change output).
                </span>
              </li>

              <li className="flex gap-3">
                <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  i
                </span>
                <span>
                  If you see unexpected text spacing changes, turn off “Trim
                  text nodes” and “Remove xml:space”, then re-check the preview.
                </span>
              </li>

              <li className="flex gap-3">
                <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  i
                </span>
                <span>
                  If your SVG uses embedded scripts or complex CDATA, avoid
                  removing CDATA unless you know it is safe for your asset.
                </span>
              </li>
            </ul>
          </section>

          {/* FAQ (kept short, tool-focused) */}
          <section className="mt-12" aria-label="Frequently asked questions">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">FAQ</h3>

            <div className="mt-4 grid gap-3">
              {FAQ_ITEMS.map((x) => (
                <details
                  key={x.q}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold text-slate-900">
                    <span>{x.q}</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 group-hover:bg-slate-100 group-open:rotate-45 transition-transform select-none cursor-pointer">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
                    {x.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
