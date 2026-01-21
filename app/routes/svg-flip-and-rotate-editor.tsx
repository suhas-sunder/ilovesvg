import * as React from "react";
import type { Route } from "./+types/svg-flip-and-rotate-editor";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  SVG Flip & Rotate Editor (Client-Side, Live Preview)";
  const description =
    "Flip or rotate an SVG instantly in your browser. Upload or paste SVG, flip horizontally/vertically, rotate by degrees or 90° steps, preview before/after live, then copy or download. No uploads, no server.";
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
type RotateAnchor = "center" | "origin";
type UnitMode = "auto" | "px";

type Settings = {
  flipH: boolean;
  flipV: boolean;

  rotationDeg: number; // -360..360 (or more)
  anchor: RotateAnchor;

  // When true, attempt to expand viewBox to include rotated bounds (best-effort)
  fitToRotation: boolean;

  // If width/height are missing, allow a default fallback size for transforms
  fallbackSize: number;

  // Prefer using viewBox if present; otherwise try width/height; otherwise fallback
  unitMode: UnitMode;

  fileName: string;
  copyMinify: boolean;
};

type SvgInfo = {
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  approxW?: number;
  approxH?: number;
  bytes?: number;
};

type Result = {
  svgText: string;
  notes: string[];
};

/* ========================
   Defaults
======================== */
const DEFAULTS: Settings = {
  flipH: false,
  flipV: false,

  rotationDeg: 0,
  anchor: "center",

  fitToRotation: false,
  fallbackSize: 1024,
  unitMode: "auto",

  fileName: "flipped-rotated",
  copyMinify: false,
};

/* ========================
   Page
======================== */
export default function SvgFlipRotateEditor(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [outPreviewUrl, setOutPreviewUrl] = React.useState<string | null>(null);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);

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
    setResult(null);
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
    setInfo(parseSvgInfo(coerced));

    const baseName = stripExt(f.name) || "flipped-rotated";
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
    setInfo(null);
    setPreviewUrl(null);
    setResult(null);
    setOutPreviewUrl(null);
    setErr(null);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
  <rect x="0" y="0" width="640" height="420" fill="#ffffff"/>
  <g fill="none" stroke="#0b2dff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M110 280 C 160 120, 260 120, 310 280 S 460 430, 530 280" />
    <circle cx="220" cy="230" r="56"/>
    <rect x="360" y="170" width="170" height="120" rx="18"/>
  </g>
  <text x="320" y="380" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="18"
    text-anchor="middle" fill="#334155">Flip + Rotate (live)</text>
</svg>`;

    setFile(null);
    setErr(null);
    setSvgText(example);
    setInfo(parseSvgInfo(example));
    setResult(null);

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml" }),
      );
    });

    setOutPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    showToast("Example loaded");
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Flip & Rotate", href: "/svg-flip-rotate-editor" },
  ];

  async function applyNow() {
    setErr(null);
    setIsWorking(true);
    try {
      if (!svgText.trim()) throw new Error("Upload or paste an SVG first.");

      const cleaned = ensureSvgHasXmlns(svgText);
      const out = flipRotateSvg(cleaned, settings);
      setResult(out);

      setOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        const blob = new Blob([out.svgText], {
          type: "image/svg+xml;charset=utf-8",
        });
        return URL.createObjectURL(blob);
      });

      showToast("Updated");
    } catch (e: any) {
      setErr(e?.message || "Update failed.");
      setResult(null);
      setOutPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    } finally {
      setIsWorking(false);
    }
  }

  function downloadSvg() {
    if (!result?.svgText) return;
    const name =
      (settings.fileName || "flipped-rotated").trim() || "flipped-rotated";
    const filename = `${safeFileName(name)}.svg`;
    downloadText(result.svgText, filename, "image/svg+xml;charset=utf-8");
    showToast("Downloaded");
  }

  function copySvg() {
    if (!result?.svgText) return;
    const text = settings.copyMinify
      ? minifySvg(result.svgText)
      : result.svgText;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Copied"))
      .catch(() => setErr("Clipboard copy failed (browser blocked it)."));
  }

  // Instant apply on changes
  const lastKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!svgText.trim()) return;

    const key = JSON.stringify({
      svg: svgText,
      s: {
        flipH: settings.flipH,
        flipV: settings.flipV,
        rotationDeg: settings.rotationDeg,
        anchor: settings.anchor,
        fitToRotation: settings.fitToRotation,
        fallbackSize: settings.fallbackSize,
        unitMode: settings.unitMode,
      },
    });

    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    void applyNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    svgText,
    settings.flipH,
    settings.flipV,
    settings.rotationDeg,
    settings.anchor,
    settings.fitToRotation,
    settings.fallbackSize,
    settings.unitMode,
  ]);

  function rotateBy(delta: number) {
    setSettings((s) => ({
      ...s,
      rotationDeg: clampNum(s.rotationDeg + delta, -9999, 9999),
    }));
  }

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
              <span className="text-slate-400">•</span>
              <span className="text-[#0b2dff]">Flip & Rotate</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Flip horizontally/vertically and rotate by degrees with a live
              before/after preview. Runs fully client-side.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 font-bold text-lg text-slate-900">
                  SVG Input
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

                  {info && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected:{" "}
                      <b>
                        {info.widthRaw || "?"} {" × "} {info.heightRaw || "?"}
                      </b>
                      {info.viewBox ? (
                        <span className="text-slate-500">
                          {" "}
                          • viewBox {info.viewBox}
                        </span>
                      ) : null}
                      {typeof info.bytes === "number" ? (
                        <span className="text-slate-500">
                          {" "}
                          • {formatBytes(info.bytes)}
                        </span>
                      ) : null}
                    </div>
                  )}

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
                        onChange={(e) => {
                          const v = ensureSvgHasXmlns(e.target.value);
                          setSvgText(v);
                          setInfo(parseSvgInfo(v));
                        }}
                        className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {/* Before / After */}
              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Before / After
                  </div>

                  <div className="p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        <div className="px-3 py-2 text-[12px] text-slate-600 border-b border-slate-200 bg-slate-50">
                          Before (input)
                        </div>
                        <div className="p-3">
                          <img
                            src={previewUrl}
                            alt="Before SVG preview"
                            className="w-full h-auto block"
                          />
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        <div className="px-3 py-2 text-[12px] text-slate-600 border-b border-slate-200 bg-slate-50">
                          After (output)
                        </div>
                        <div className="p-3">
                          {outPreviewUrl ? (
                            <img
                              src={outPreviewUrl}
                              alt="After SVG preview"
                              className="w-full h-auto block"
                            />
                          ) : (
                            <div className="text-slate-600 text-sm">
                              Adjust settings to generate an output preview.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {result?.notes?.length ? (
                      <div className="mt-3 text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <ul className="list-disc pl-5 grid gap-1">
                          {result.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Transform Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Flip horizontal">
                    <input
                      type="checkbox"
                      checked={settings.flipH}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, flipH: e.target.checked }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Mirror left ↔ right
                    </span>
                  </Field>

                  <Field label="Flip vertical">
                    <input
                      type="checkbox"
                      checked={settings.flipV}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, flipV: e.target.checked }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Mirror top ↕ bottom
                    </span>
                  </Field>

                  <Field label="Rotate (degrees)">
                    <Num
                      value={settings.rotationDeg}
                      min={-9999}
                      max={9999}
                      step={1}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, rotationDeg: v }))
                      }
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => rotateBy(-90)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                      >
                        -90°
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateBy(90)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                      >
                        +90°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({ ...s, rotationDeg: 0 }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                      >
                        Reset
                      </button>
                    </div>
                  </Field>

                  <Field label="Rotate around">
                    <select
                      value={settings.anchor}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          anchor: e.target.value as RotateAnchor,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="center">Center (recommended)</option>
                      <option value="origin">Origin (0,0)</option>
                    </select>
                  </Field>

                  <Field label="Fit to rotation">
                    <input
                      type="checkbox"
                      checked={settings.fitToRotation}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          fitToRotation: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Try to expand viewBox so rotated art isn’t clipped
                    </span>
                  </Field>

                  <Field label="Sizing mode">
                    <select
                      value={settings.unitMode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          unitMode: e.target.value as UnitMode,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="auto">
                        Auto (viewBox → width/height → fallback)
                      </option>
                      <option value="px">
                        Force px width/height if missing
                      </option>
                    </select>
                  </Field>

                  <Field label="Fallback size">
                    <Num
                      value={settings.fallbackSize}
                      min={16}
                      max={50000}
                      step={1}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, fallbackSize: v }))
                      }
                    />
                    <span className="text-[12px] text-slate-500 shrink-0">
                      used if SVG has no size
                    </span>
                  </Field>

                  <Field label="Copy minify">
                    <input
                      type="checkbox"
                      checked={settings.copyMinify}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          copyMinify: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Minify when copying output
                    </span>
                  </Field>

                  <Field label="Output filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="flipped-rotated"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={applyNow}
                    disabled={!hydrated || !svgText.trim() || isWorking}
                    className={[
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {isWorking ? "Updating..." : "Apply flip/rotate"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadSvg}
                    disabled={!hydrated || !result?.svgText || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download SVG
                  </button>

                  <button
                    type="button"
                    onClick={copySvg}
                    disabled={!hydrated || !result?.svgText || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Copy SVG
                  </button>
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Notes: Changes apply instantly as you tweak settings.
                  Everything stays on your device.
                </div>
              </div>

              {/* OUTPUT SVG TEXT */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output SVG (editable)
                </div>
                <div className="p-3">
                  {result ? (
                    <textarea
                      value={result.svgText}
                      onChange={(e) => {
                        const v = ensureSvgHasXmlns(e.target.value);
                        setResult((r) => (r ? { ...r, svgText: v } : r));
                        setOutPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          const blob = new Blob([v], {
                            type: "image/svg+xml;charset=utf-8",
                          });
                          return URL.createObjectURL(blob);
                        });
                      }}
                      className="w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Output SVG will appear here after processing.
                    </div>
                  )}
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

      <SeoSections />
      <JsonLdBreadcrumbs />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Core transform
======================== */
function flipRotateSvg(svgText: string, settings: Settings): Result {
  const notes: string[] = [];
  const safe = ensureSvgHasXmlns(String(svgText || "").trim());

  const parser = new DOMParser();
  const doc = parser.parseFromString(safe, "image/svg+xml");
  const parserError = doc.getElementsByTagName("parsererror")?.[0];
  if (parserError)
    throw new Error("Invalid SVG. Please upload a valid SVG file.");

  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG. Root <svg> element not found.");
  }

  // Determine bounds for anchor
  const bounds = getSvgBoundsForTransform(svg, settings);
  const w = bounds.w;
  const h = bounds.h;
  const cx = bounds.x + w / 2;
  const cy = bounds.y + h / 2;

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    notes.push(
      "Could not confidently determine SVG size; using fallback sizing.",
    );
  }

  const deg = clampNum(settings.rotationDeg, -9999, 9999);
  const useFlipH = !!settings.flipH;
  const useFlipV = !!settings.flipV;

  // Build transform:
  // - anchor: center or origin
  // - rotate first or flips first both work as long as consistent
  // We'll do: translate(anchor) -> rotate -> scale(flip) -> translate(-anchor)
  const ax = settings.anchor === "center" ? cx : bounds.x;
  const ay = settings.anchor === "center" ? cy : bounds.y;

  const sx = useFlipH ? -1 : 1;
  const sy = useFlipV ? -1 : 1;

  const pieces: string[] = [];
  const hasAny = deg !== 0 || sx !== 1 || sy !== 1;
  if (!hasAny) {
    notes.push("No transform applied (rotation is 0 and flips are off).");
    return { svgText: safe, notes };
  }

  pieces.push(`translate(${fmt(ax)} ${fmt(ay)})`);
  if (deg !== 0) pieces.push(`rotate(${fmt(deg)})`);
  if (sx !== 1 || sy !== 1) pieces.push(`scale(${fmt(sx)} ${fmt(sy)})`);
  pieces.push(`translate(${fmt(-ax)} ${fmt(-ay)})`);

  // Wrap all visible content in a group with the transform.
  // Keep defs/style outside to avoid breaking references.
  const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-fr-wrap", "1");
  g.setAttribute("transform", pieces.join(" "));

  // Move all children except defs/style/metadata/title/desc into wrapper group
  const skipTags = new Set(["defs", "style", "metadata", "title", "desc"]);
  const toMove: Element[] = [];
  for (const node of Array.from(svg.children)) {
    const tag = node.tagName.toLowerCase();
    if (skipTags.has(tag)) continue;
    toMove.push(node);
  }
  toMove.forEach((n) => g.appendChild(n));
  svg.appendChild(g);

  // Optionally expand viewBox to fit rotated bounds (best-effort)
  if (settings.fitToRotation) {
    const vb = parseViewBox(svg.getAttribute("viewBox"));
    if (vb) {
      const fitted = fitViewBoxToTransform(vb, deg, sx, sy, ax, ay);
      svg.setAttribute(
        "viewBox",
        `${fmt(fitted.minX)} ${fmt(fitted.minY)} ${fmt(fitted.w)} ${fmt(fitted.h)}`,
      );
      notes.push("Adjusted viewBox to reduce clipping (best-effort).");
    } else {
      notes.push(
        "Fit-to-rotation needs a viewBox. Add one or switch sizing mode.",
      );
    }
  }

  const serializer = new XMLSerializer();
  const outSvg = serializer.serializeToString(doc).replace(/\u00a0/g, " ");
  return { svgText: ensureSvgHasXmlns(outSvg), notes };
}

function getSvgBoundsForTransform(
  svg: SVGSVGElement,
  settings: Settings,
): { x: number; y: number; w: number; h: number } {
  const vb = parseViewBox(svg.getAttribute("viewBox"));
  if (vb && settings.unitMode !== "px") {
    return { x: vb.minX, y: vb.minY, w: vb.w, h: vb.h };
  }

  // Try width/height
  const open = svg.outerHTML.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width");
  const heightRaw = matchAttr(open, "height");
  const w = widthRaw ? parseCssLengthToPx(widthRaw) : null;
  const h = heightRaw ? parseCssLengthToPx(heightRaw) : null;

  if (w && h && w > 0 && h > 0) return { x: 0, y: 0, w, h };

  // Fallback
  const s = clampNum(settings.fallbackSize, 16, 50000);
  return { x: 0, y: 0, w: s, h: s };
}

// Best-effort: compute transformed corners and fit a new viewBox around them
function fitViewBoxToTransform(
  vb: { minX: number; minY: number; w: number; h: number },
  deg: number,
  sx: number,
  sy: number,
  ax: number,
  ay: number,
) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: vb.minX, y: vb.minY },
    { x: vb.minX + vb.w, y: vb.minY },
    { x: vb.minX + vb.w, y: vb.minY + vb.h },
    { x: vb.minX, y: vb.minY + vb.h },
  ];

  const pts = corners.map((p) => {
    // translate to anchor
    let x = p.x - ax;
    let y = p.y - ay;
    // rotate
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    // scale flip
    const xs = xr * sx;
    const ys = yr * sy;
    // translate back
    return { x: xs + ax, y: ys + ay };
  });

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  return { minX, minY, w, h };
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

  const dims = getSvgPixelSize(svg);

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    approxW: dims.w,
    approxH: dims.h,
  };
}

function getSvgPixelSize(svg: string): { w: number; h: number } {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width");
  const heightRaw = matchAttr(open, "height");
  const viewBox = matchAttr(open, "viewBox");

  const vb = parseViewBox(viewBox);
  const wLen = widthRaw ? parseCssLengthToPx(widthRaw) : null;
  const hLen = heightRaw ? parseCssLengthToPx(heightRaw) : null;

  if (wLen && hLen && wLen > 0 && hLen > 0) return { w: wLen, h: hLen };

  if (vb && vb.w > 0 && vb.h > 0) {
    if (wLen && wLen > 0)
      return { w: wLen, h: Math.max(1, Math.round(wLen * (vb.h / vb.w))) };
    if (hLen && hLen > 0)
      return { w: Math.max(1, Math.round(hLen * (vb.w / vb.h))), h: hLen };
    return { w: Math.round(vb.w), h: Math.round(vb.h) };
  }

  return { w: 1024, h: 1024 };
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseViewBox(vb: string | null | undefined) {
  if (!vb) return null;
  const parts = vb
    .trim()
    .split(/[\s,]+/)
    .map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minX, minY, w, h] = parts;
  if (w === 0 || h === 0) return null;
  return { minX, minY, w: Math.abs(w), h: Math.abs(h) };
}

function parseCssLengthToPx(raw: string): number | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(-?\d+(\.\d+)?)([a-z%]*)$/i);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;

  const unit = (m[3] || "px").toLowerCase();
  const v = Math.abs(n);

  if (!unit || unit === "px") return v;
  if (unit === "in") return v * 96;
  if (unit === "cm") return (v * 96) / 2.54;
  if (unit === "mm") return (v * 96) / 25.4;
  if (unit === "pt") return (v * 96) / 72;
  if (unit === "pc") return (v * 96) / 6;
  if (unit === "em" || unit === "rem") return v * 16;
  if (unit === "%") return null;
  return null;
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
   Download helpers
======================== */
function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
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
      .slice(0, 80) || "flipped-rotated"
  );
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function clampNum(v: number, lo: number, hi: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const s = String(Math.round(n * 1000) / 1000);
  return s;
}

function minifySvg(svg: string) {
  return String(svg || "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function Num({
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
                href="/svg-to-pdf"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PDF
              </a>
            </li>
            <li>
              <a
                href="/svg-stroke-width-adjust"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Stroke Width
              </a>
            </li>
            <li>
              <a
                href="/svg-flip-rotate-editor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Flip & Rotate
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
        name: "SVG Flip & Rotate Editor",
        item: `${baseUrl}/svg-flip-rotate-editor`,
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
   SEO sections
======================== */
/* ========================
   SEO sections
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "Does this SVG flip and rotate tool upload my file?",
      a: "No. Everything runs client-side in your browser. Your SVG never leaves your device.",
    },
    {
      q: "Why is my rotated SVG getting clipped?",
      a: "Many SVGs have a tight viewBox. Enable “Fit to rotation” to expand the viewBox (best-effort), or edit the viewBox manually so the rotated artwork stays inside the canvas.",
    },
    {
      q: "Can I rotate around the center of the artwork?",
      a: "Yes. Choose “Rotate around: Center” to rotate around the center of the SVG’s viewBox (or its size if there’s no viewBox).",
    },
    {
      q: "Will this change my paths or reduce quality?",
      a: "No. This tool applies a transform on a wrapper <g> element. It doesn’t rasterize or rewrite your path data.",
    },
    {
      q: "Why does flipping/rotating look different in another app?",
      a: "Some apps interpret missing viewBox/width/height differently. If results look off, add a viewBox, use the fallback size option, and keep transforms on the SVG content rather than editing paths.",
    },
  ];

  function JsonLdFaq() {
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    );
  }

  return (
    <section className="bg-white border-t border-slate-200">
      {/* JSON-LD for FAQ */}
      <JsonLdFaq />

      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG Flip & Rotate Editor (Free, Client-Side)
          </h2>

          <p className="mt-3">
            Use this <strong>SVG flip and rotate editor</strong> to mirror and
            rotate vector graphics instantly. Flip an SVG{" "}
            <strong>horizontally</strong> (left ↔ right) or{" "}
            <strong>vertically</strong> (top ↕ bottom), rotate by{" "}
            <strong>any degree</strong> or quick 90° steps, preview the result
            live, then copy or download the updated SVG.
          </p>

          <p className="mt-3">
            This is a <strong>browser-based SVG transformer</strong>: your file
            stays on your device, and the tool updates your SVG by applying a{" "}
            <strong>transform</strong> to your SVG content (no rasterization, no
            quality loss).
          </p>

          <section className="mt-10">
            <h3 className="m-0 font-bold">What You Can Do</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Flip SVGs horizontally or vertically (mirror icons/logos)</li>
              <li>Rotate SVGs by degrees or 90° steps</li>
              <li>
                Reduce clipping by expanding the viewBox (best-effort “Fit to
                rotation”)
              </li>
              <li>Copy minified SVG output or download a new .svg file</li>
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">Common Uses</h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>Mirror icons, logos, and illustrations</li>
              <li>
                Rotate SVGs for print layouts, stickers, and cutting tools
              </li>
              <li>Fix SVG orientation imported from design apps</li>
              <li>Prep assets for UI, web, and design systems</li>
            </ul>
          </section>

          {/* Visible FAQ (bottom) */}
          <section className="mt-12">
            <h3 className="m-0 font-bold">FAQ</h3>

            <div className="not-prose mt-4 grid gap-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                    <span>{f.q}</span>
                    <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                      +
                    </span>
                  </summary>
                  <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
