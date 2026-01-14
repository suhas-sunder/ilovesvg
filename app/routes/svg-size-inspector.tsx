import * as React from "react";
import type { Route } from "./+types/svg-size-inspector";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "i🩵SVG  -  SVG Size Inspector (Width, Height, viewBox, px)";
  const description =
    "Inspect SVG size instantly in your browser. See width, height, units, viewBox, preserveAspectRatio, file size, and computed pixel dimensions. Upload or paste SVG. No uploads, fully client-side.";
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
type UnitMode = "css-96dpi" | "custom-dpi";

type Settings = {
  unitMode: UnitMode;
  dpi: number; // used only when custom-dpi is selected
  fallbackPx: number; // used if neither width/height nor viewBox provide a size
  sanitizePreview: boolean; // removes scripts/events for preview safety
  fileName: string;
};

type SvgStats = {
  bytes: number;
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  preserveAspectRatio?: string;

  widthPxFrom?: string; // explanation label
  heightPxFrom?: string;

  computedWpx: number;
  computedHpx: number;
  aspectRatio: number;

  warnings: string[];
};

const DEFAULTS: Settings = {
  unitMode: "css-96dpi",
  dpi: 300,
  fallbackPx: 1024,
  sanitizePreview: true,
  fileName: "inspected",
};

/* ========================
   Page
======================== */
export default function SvgSizeInspector(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<SvgStats | null>(null);

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

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

    if (
      !(f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
    ) {
      setErr("Please choose an SVG file.");
      return;
    }

    setFile(f);

    const text = await f.text();
    const coerced = ensureSvgHasXmlns(text);

    const baseName = stripExt(f.name) || "inspected";
    setSettings((s) => ({ ...s, fileName: baseName }));

    setSvgText(coerced);
  }

  function clearAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setSvgText("");
    setPreviewUrl(null);
    setStats(null);
    setErr(null);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" preserveAspectRatio="xMidYMid meet">
  <rect x="0" y="0" width="640" height="420" fill="#ffffff"/>
  <g fill="none" stroke="#0b2dff" stroke-width="6" stroke-linecap="round">
    <path d="M80 130 C 160 60, 260 60, 340 130 S 520 200, 560 130" />
    <circle cx="170" cy="260" r="70"/>
    <rect x="290" y="210" width="190" height="120" rx="18"/>
  </g>
  <text x="320" y="370" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="18"
    text-anchor="middle" fill="#334155">SVG Size Inspector (example)</text>
</svg>`;
    setFile(null);
    setErr(null);
    setSvgText(example);
    showToast("Example loaded");
  }

  // Recompute stats + preview anytime input or settings change
  const lastKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!svgText.trim()) {
      setStats(null);
      setPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      return;
    }

    const key = JSON.stringify({
      svg: svgText,
      s: {
        unitMode: settings.unitMode,
        dpi: settings.dpi,
        fallbackPx: settings.fallbackPx,
        sanitizePreview: settings.sanitizePreview,
      },
    });
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    try {
      const cleaned = ensureSvgHasXmlns(svgText);
      const safeForPreview = settings.sanitizePreview
        ? sanitizeSvgForPreview(cleaned)
        : cleaned;

      const st = inspectSvg(cleaned, settings);
      setStats(st);

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        const blob = new Blob([safeForPreview], {
          type: "image/svg+xml;charset=utf-8",
        });
        return URL.createObjectURL(blob);
      });

      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Could not inspect this SVG.");
      setStats(null);
      setPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    }
  }, [
    svgText,
    settings.unitMode,
    settings.dpi,
    settings.fallbackPx,
    settings.sanitizePreview,
  ]);

  function copyStats() {
    if (!stats) return;
    const lines = [
      `width: ${stats.widthRaw || "missing"}`,
      `height: ${stats.heightRaw || "missing"}`,
      `viewBox: ${stats.viewBox || "missing"}`,
      `preserveAspectRatio: ${stats.preserveAspectRatio || "default"}`,
      `computed px: ${stats.computedWpx} x ${stats.computedHpx}`,
      `aspect ratio: ${round(stats.aspectRatio, 4)}`,
      `file size: ${formatBytes(stats.bytes)}`,
      stats.warnings.length ? `warnings: ${stats.warnings.join(" | ")}` : "",
    ].filter(Boolean);

    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast("Copied stats"))
      .catch(() => setErr("Clipboard copy failed (browser blocked it)."));
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Size Inspector", href: "/svg-size-inspector" },
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

          <header className="text-center mb-4">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>SVG</span>
              <span className="text-slate-400">•</span>
              <span className="text-[#0b2dff]">Size Inspector</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Inspect <b>width</b>, <b>height</b>, <b>viewBox</b>, and{" "}
              <b>computed pixel size</b>. Upload or paste an SVG. Runs fully
              client-side.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT + PREVIEW */}
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

                  <details className="mt-3 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      Advanced: Edit SVG source
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-[13px] text-slate-600 mt-2">
                        Optional. Stats and preview update instantly.
                      </p>
                      <textarea
                        value={svgText}
                        onChange={(e) =>
                          setSvgText(ensureSvgHasXmlns(e.target.value))
                        }
                        className="mt-2 w-full h-[260px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {/* PREVIEW */}
              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Preview
                </div>
                <div className="p-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="SVG preview"
                      className="w-full h-auto block"
                    />
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Upload or paste an SVG to preview it.
                    </div>
                  )}
                </div>
              </div>

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* STATS */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Size Details
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Unit conversion">
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
                      <option value="css-96dpi">CSS default (96 DPI)</option>
                      <option value="custom-dpi">Custom DPI</option>
                    </select>
                  </Field>

                  {settings.unitMode === "custom-dpi" ? (
                    <Field label="DPI">
                      <NumInt
                        value={settings.dpi}
                        min={36}
                        max={1200}
                        step={1}
                        onChange={(v) => setSettings((s) => ({ ...s, dpi: v }))}
                      />
                      <span className="text-[12px] text-slate-500 shrink-0">
                        Used for in/cm/mm/pt
                      </span>
                    </Field>
                  ) : null}

                  <Field label="Fallback px if missing">
                    <NumInt
                      value={settings.fallbackPx}
                      min={1}
                      max={100000}
                      step={1}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, fallbackPx: v }))
                      }
                    />
                    <span className="text-[12px] text-slate-500 shrink-0">
                      Only if size cannot be inferred
                    </span>
                  </Field>

                  <Field label="Preview safety">
                    <input
                      type="checkbox"
                      checked={settings.sanitizePreview}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          sanitizePreview: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Strip scripts and event handlers in preview
                    </span>
                  </Field>

                  <div className="mt-2 border border-slate-200 rounded-2xl bg-white p-3">
                    <div className="font-bold text-slate-900">Detected</div>

                    <div className="mt-2 grid gap-1 text-[14px] text-slate-800">
                      <div>
                        width:{" "}
                        <b>{stats?.widthRaw ? stats.widthRaw : "missing"}</b>
                      </div>
                      <div>
                        height:{" "}
                        <b>{stats?.heightRaw ? stats.heightRaw : "missing"}</b>
                      </div>
                      <div className="truncate">
                        viewBox:{" "}
                        <b>{stats?.viewBox ? stats.viewBox : "missing"}</b>
                      </div>
                      <div className="truncate">
                        preserveAspectRatio:{" "}
                        <b>
                          {stats?.preserveAspectRatio
                            ? stats.preserveAspectRatio
                            : "default"}
                        </b>
                      </div>
                      <div>
                        file size:{" "}
                        <b>{stats ? formatBytes(stats.bytes) : "?"}</b>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200">
                        computed px:{" "}
                        <b>
                          {stats
                            ? `${stats.computedWpx} × ${stats.computedHpx}`
                            : "?"}
                        </b>
                      </div>
                      <div className="text-[13px] text-slate-600">
                        {stats?.widthPxFrom || stats?.heightPxFrom ? (
                          <>
                            Source:{" "}
                            <span className="text-slate-700">
                              {stats.widthPxFrom || "?"}
                              {stats.heightPxFrom
                                ? `, ${stats.heightPxFrom}`
                                : ""}
                            </span>
                          </>
                        ) : (
                          "Source: ?"
                        )}
                      </div>
                      <div className="text-[13px] text-slate-600">
                        aspect ratio:{" "}
                        <b className="text-slate-900">
                          {stats ? round(stats.aspectRatio, 4) : "?"}
                        </b>
                      </div>
                    </div>

                    {stats?.warnings?.length ? (
                      <div className="mt-3 text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <div className="font-semibold mb-1">Notes</div>
                        <ul className="list-disc pl-5 grid gap-1">
                          {stats.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <Field label="Output filename">
                    <input
                      value={settings.fileName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, fileName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      placeholder="inspected"
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={copyStats}
                    disabled={!hydrated || !stats}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Copy stats
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!svgText.trim()) return;
                      const name =
                        (settings.fileName || "inspected").trim() ||
                        "inspected";
                      const filename = `${safeFileName(name)}.svg`;
                      downloadText(
                        ensureSvgHasXmlns(svgText),
                        filename,
                        "image/svg+xml;charset=utf-8"
                      );
                      showToast("Downloaded");
                    }}
                    disabled={!hydrated || !svgText.trim()}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download SVG
                  </button>
                </div>

                <div className="mt-3 text-[13px] text-slate-600">
                  Tip: If your SVG scales weirdly across apps, the most common
                  cause is a missing or overly tight <b>viewBox</b>.
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
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <JsonLdBreadcrumbs />
      <SiteFooter />
    </>
  );
}

/* ========================
   Core: inspect SVG size
======================== */
function inspectSvg(svgText: string, settings: Settings): SvgStats {
  const svg = ensureSvgHasXmlns(String(svgText || "").trim());
  const bytes = new Blob([svg]).size;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const parserError = doc.getElementsByTagName("parsererror")?.[0];
  if (parserError)
    throw new Error("Invalid SVG. Please upload a valid SVG file.");

  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG. Root <svg> element not found.");
  }

  const widthRaw = (root.getAttribute("width") || "").trim() || undefined;
  const heightRaw = (root.getAttribute("height") || "").trim() || undefined;
  const viewBox = (root.getAttribute("viewBox") || "").trim() || undefined;
  const preserveAspectRatio =
    (root.getAttribute("preserveAspectRatio") || "").trim() || undefined;

  const warnings: string[] = [];

  // unit conversion basis
  const dpi =
    settings.unitMode === "custom-dpi" ? clampNum(settings.dpi, 36, 1200) : 96;

  const wLen = widthRaw ? parseCssLengthToPx(widthRaw, dpi) : null;
  const hLen = heightRaw ? parseCssLengthToPx(heightRaw, dpi) : null;

  const vb = parseViewBox(viewBox);
  const fallback = clampNum(settings.fallbackPx, 1, 100000);

  let computedWpx = 0;
  let computedHpx = 0;
  let widthPxFrom = "";
  let heightPxFrom = "";

  // Compute pixel size rules:
  // 1) If width+height parse to px, use them.
  // 2) Else if viewBox exists, use viewBox w/h.
  // 3) Else fallback.
  if (wLen && hLen && wLen > 0 && hLen > 0) {
    computedWpx = Math.round(wLen);
    computedHpx = Math.round(hLen);
    widthPxFrom = `width/height (${settings.unitMode === "custom-dpi" ? `${dpi} DPI` : "96 DPI"})`;
    heightPxFrom = `width/height (${settings.unitMode === "custom-dpi" ? `${dpi} DPI` : "96 DPI"})`;
  } else if (vb && vb.w > 0 && vb.h > 0) {
    // If only one dimension exists, preserve aspect ratio from viewBox
    if (wLen && wLen > 0) {
      computedWpx = Math.round(wLen);
      computedHpx = Math.max(1, Math.round(wLen * (vb.h / vb.w)));
      widthPxFrom = `width + viewBox aspect`;
      heightPxFrom = `width + viewBox aspect`;
    } else if (hLen && hLen > 0) {
      computedHpx = Math.round(hLen);
      computedWpx = Math.max(1, Math.round(hLen * (vb.w / vb.h)));
      widthPxFrom = `height + viewBox aspect`;
      heightPxFrom = `height + viewBox aspect`;
    } else {
      computedWpx = Math.max(1, Math.round(vb.w));
      computedHpx = Math.max(1, Math.round(vb.h));
      widthPxFrom = "viewBox";
      heightPxFrom = "viewBox";
    }
  } else {
    computedWpx = fallback;
    computedHpx = fallback;
    widthPxFrom = "fallback";
    heightPxFrom = "fallback";
  }

  if (!viewBox) {
    warnings.push(
      "Missing viewBox. Scaling can be inconsistent across apps. Adding a viewBox is usually the safest fix."
    );
  } else if (vb && (vb.w <= 0 || vb.h <= 0)) {
    warnings.push("viewBox exists but looks invalid (zero or non-numeric).");
  }

  if (widthRaw && /%/.test(widthRaw)) {
    warnings.push("width is a percentage. Render size depends on container.");
  }
  if (heightRaw && /%/.test(heightRaw)) {
    warnings.push("height is a percentage. Render size depends on container.");
  }

  if (widthRaw && /(em|rem)/i.test(widthRaw)) {
    warnings.push(
      "width uses em/rem. Pixel size depends on font-size context."
    );
  }
  if (heightRaw && /(em|rem)/i.test(heightRaw)) {
    warnings.push(
      "height uses em/rem. Pixel size depends on font-size context."
    );
  }

  if (!widthRaw || !heightRaw) {
    warnings.push(
      "width/height missing or non-px units not fully resolvable. Many tools fall back to viewBox or default sizing."
    );
  }

  const aspectRatio = computedHpx > 0 ? computedWpx / computedHpx : 1;

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    preserveAspectRatio,
    widthPxFrom,
    heightPxFrom,
    computedWpx,
    computedHpx,
    aspectRatio,
    warnings,
  };
}

/* ========================
   Preview sanitization
======================== */
function sanitizeSvgForPreview(svgText: string) {
  let svg = String(svgText || "");

  // remove script blocks
  svg = svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/\s*>/gi, "");

  // remove on* handlers
  svg = svg.replace(/\s(on[a-zA-Z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g, "");

  // remove javascript: links
  svg = svg.replace(
    /\s(?:href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    (m) => {
      const valMatch = m.match(/=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const raw = (valMatch?.[1] || valMatch?.[2] || valMatch?.[3] || "")
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase()
        .replace(/\s+/g, "");
      return raw.startsWith("javascript:") ? "" : m;
    }
  );

  return ensureSvgHasXmlns(svg);
}

/* ========================
   Parsing helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function parseViewBox(vb: string | null | undefined) {
  if (!vb) return null;
  const parts = vb
    .trim()
    .split(/[\s,]+/)
    .map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [, , w, h] = parts;
  if (w === 0 || h === 0) return null;
  return { w: Math.abs(w), h: Math.abs(h) };
}

/**
 * Converts common CSS/SVG lengths to px.
 * - px or unitless => px-ish
 * - in/cm/mm/pt/pc => based on dpi passed in (96 for CSS default)
 * - % => unknown (returns null)
 * - em/rem => unknown without context (returns null)
 */
function parseCssLengthToPx(raw: string, dpi: number): number | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(-?\d+(\.\d+)?)([a-z%]*)$/i);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;

  const unit = (m[3] || "px").toLowerCase();
  const v = Math.abs(n);

  if (!unit || unit === "px") return v;

  if (unit === "in") return v * dpi;
  if (unit === "cm") return (v * dpi) / 2.54;
  if (unit === "mm") return (v * dpi) / 25.4;
  if (unit === "pt") return (v * dpi) / 72;
  if (unit === "pc") return (v * dpi) / 6;

  if (unit === "em" || unit === "rem") return null;
  if (unit === "%") return null;

  return null;
}

/* ========================
   Download + misc helpers
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
      .slice(0, 80) || "inspected"
  );
}

function clampNum(v: number, lo: number, hi: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function round(n: number, d: number) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
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
                href="/svg-size-inspector"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Size Inspector
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
                href="/svg-to-png-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PNG
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
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "SVG Size Inspector",
        item: "/svg-size-inspector",
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
   SEO sections + FAQ JSON-LD
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "Does this SVG size inspector upload my file?",
      a: "No. Everything runs in your browser. Your SVG is not uploaded to a server.",
    },
    {
      q: "What is the difference between width/height and viewBox in an SVG?",
      a: "width and height describe a preferred display size. viewBox defines the internal coordinate system. viewBox is what makes SVG scale cleanly and predictably across browsers and design tools.",
    },
    {
      q: "Why does my SVG look huge or tiny in different apps?",
      a: "Different apps and frameworks interpret SVG sizing differently. Percent sizes depend on the container. em/rem depend on font size. Missing viewBox often causes inconsistent scaling. This tool shows what is actually present and estimates the rendered pixel size.",
    },
    {
      q: "Why is the pixel size only an estimate?",
      a: "If width/height are percentages or em/rem, the actual pixel size depends on where the SVG is placed. If width/height are physical units like mm/in/pt, the px conversion depends on DPI assumptions. This tool lets you use CSS default (96 DPI) or a custom DPI.",
    },
    {
      q: "What is the safest fix for sizing issues?",
      a: "In most workflows, adding or correcting viewBox is the safest fix because it defines the coordinate system for scaling. Width and height can be treated as display hints, but viewBox is what prevents cropping and weird scaling.",
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
      <JsonLdFaq />
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            SVG Size Inspector (Width, Height, viewBox, Rendered Pixels)
          </h2>

          <p className="mt-3">
            Use this <strong>SVG size inspector</strong> to quickly answer the
            question: <strong>“How big is this SVG?”</strong> It shows the raw{" "}
            <code>width</code>, <code>height</code>, <code>viewBox</code>, and{" "}
            <code>preserveAspectRatio</code> attributes, plus an estimated{" "}
            <strong>rendered pixel size</strong>. Upload a file or paste SVG
            source, preview it instantly, then copy the sizing details for
            debugging or documentation. Everything runs locally in your browser.
          </p>

          <section className="mt-10">
            <h3 className="m-0 font-bold">What “SVG size” really means</h3>
            <p className="mt-3">
              SVGs can be confusing because they have two layers of sizing: a{" "}
              <strong>display size</strong> (<code>width</code> and{" "}
              <code>height</code>) and an internal{" "}
              <strong>coordinate system</strong> (<code>viewBox</code>). In most
              real-world issues, the SVG scales poorly or gets clipped because
              the viewBox is missing or too tight. That is why this tool
              highlights viewBox and gives a computed pixel estimate.
            </p>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">
              Why your SVG size changes across apps
            </h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                <strong>Percent sizing</strong> depends on the container size.
              </li>
              <li>
                <strong>em/rem sizing</strong> depends on font-size context.
              </li>
              <li>
                <strong>mm/in/pt</strong> need a DPI assumption for px
                conversion.
              </li>
              <li>
                <strong>Missing viewBox</strong> leads to inconsistent scaling
                and cropping.
              </li>
            </ul>
          </section>

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
