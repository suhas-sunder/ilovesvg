import * as React from "react";
import type { Route } from "./+types/svg-preview-viewer";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | SVG Viewer (Zoom, Pan, Inspect)";
  const description =
    "Inspect SVG files instantly with iLoveSVG. Zoom and pan intuitively, fit to view, pick elements, inspect metadata, and view source. Free, fully client-side, no uploads.";
  const canonical = "https://www.ilovesvg.com/svg-preview-viewer";

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
type BgMode = "checker" | "white" | "black" | "transparent";
type FitMode = "fit" | "fill" | "actual";

type Settings = {
  bg: BgMode;
  fitMode: FitMode;
  grid: boolean;
  bounds: boolean;
  snap: boolean;

  picker: boolean;
  showInspector: boolean;

  // safety preview
  stripScripts: boolean;
  stripForeignObject: boolean;
  stripEventHandlers: boolean;
  stripJavascriptHrefs: boolean;

  fileName: string;
};

type SvgVB = { minX: number; minY: number; w: number; h: number };

type SvgInfo = {
  bytes: number;
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  vb?: SvgVB | null;
  aspect?: number | null;

  hasScripts?: boolean;
  hasForeignObject?: boolean;

  tagCounts?: Record<string, number>;
  ids?: string[];
  defsSummary?: {
    gradients: number;
    patterns: number;
    clipPaths: number;
    masks: number;
    filters: number;
    symbols: number;
  };
};

type Picked = {
  tag: string;
  id?: string;
  classes?: string;
  fill?: string;
  stroke?: string;
  dLen?: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
};

/* ========================
   Defaults
======================== */
const DEFAULTS: Settings = {
  bg: "checker",
  fitMode: "fit",
  grid: false,
  bounds: true,
  snap: true,

  picker: false,
  showInspector: true,

  stripScripts: true,
  stripForeignObject: false,
  stripEventHandlers: true,
  stripJavascriptHrefs: true,

  fileName: "svg",
};

/* ========================
   Shared FAQ (visible + JSON-LD)
======================== */
const FAQ = [
  {
    q: "Does this SVG viewer upload my file?",
    a: "No. Everything runs locally in your browser. Nothing is uploaded to a server.",
  },
  {
    q: "How do I zoom without the page scrolling?",
    a: "Use Ctrl (or Cmd) + mouse wheel / trackpad pinch to zoom. Regular scrolling will scroll the page as normal.",
  },
  {
    q: "How do I pan around the SVG?",
    a: "Drag to pan when zoomed in. You can also hold Space and drag to pan from anywhere, or use the middle mouse button.",
  },
  {
    q: "What is the element picker?",
    a: "Enable Pick and click an element to see its tag, id, class, fill, stroke, and bounding box (when available).",
  },
  {
    q: "Why does the preview look different from my design tool?",
    a: "Some SVGs rely on external fonts, CSS, or scripts. This viewer can strip scripts and event handlers for safety, which may change behavior. Toggle the safety options to compare.",
  },
];

/* ========================
   Page
======================== */
export default function SvgPreviewViewer(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState("");
  const [safeSvg, setSafeSvg] = React.useState("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // View state
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const svgHostRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState<number>(1);
  const [tx, setTx] = React.useState<number>(0);
  const [ty, setTy] = React.useState<number>(0);

  // Interaction state
  const [isSpaceDown, setIsSpaceDown] = React.useState(false);
  const panRef = React.useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    baseTx: number;
    baseTy: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    baseTx: 0,
    baseTy: 0,
  });

  const didPanRef = React.useRef(false);

  const [picked, setPicked] = React.useState<Picked | null>(null);
  const [pickedOutline, setPickedOutline] = React.useState<string | null>(null);

  // tabs
  const [tab, setTab] = React.useState<"details" | "elements" | "source">(
    "details",
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
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
    setPicked(null);
    setPickedOutline(null);

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

    const baseName = stripExt(f.name) || "svg";
    setSettings((s) => ({ ...s, fileName: baseName }));

    const parsed = parseSvgInfo(coerced);
    setInfo(parsed);

    applySafetyAndRender(coerced, parsed, settings);

    setScale(1);
    setTx(0);
    setTy(0);

    requestAnimationFrame(() => {
      const m = settings.fitMode;
      if (m === "actual") setActual();
      else if (m === "fit") fitToViewport("fit");
      else fitToViewport("fill");
    });
  }

  function clearAll() {
    setFile(null);
    setSvgText("");
    setSafeSvg("");
    setInfo(null);
    setErr(null);
    setPicked(null);
    setPickedOutline(null);
    setScale(1);
    setTx(0);
    setTy(0);
    setTab("details");
  }

  function applySafetyAndRender(
    raw: string,
    parsedInfo: SvgInfo | null,
    s: Settings,
  ) {
    setErr(null);
    try {
      const safe = buildSafeSvg(raw, s);
      setSafeSvg(safe);
      setInfo((prev) => (parsedInfo ? parsedInfo : prev));
      requestAnimationFrame(() => {
        if (!safe) return;
        if (s.fitMode === "actual") setActual();
        else if (s.fitMode === "fit") fitToViewport("fit");
        else fitToViewport("fill");
      });
    } catch (e: any) {
      setErr(e?.message || "Render failed.");
    }
  }

  React.useEffect(() => {
    if (!svgText) return;
    applySafetyAndRender(svgText, info, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.stripScripts,
    settings.stripForeignObject,
    settings.stripEventHandlers,
    settings.stripJavascriptHrefs,
    settings.fitMode,
    svgText,
  ]);

  // Make cursor reflect pan affordance when zoomed
  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (!safeSvg) {
      vp.style.cursor = "";
      return;
    }
    if (settings.picker) {
      vp.style.cursor = "crosshair";
      return;
    }
    if (isSpaceDown) {
      vp.style.cursor = "grab";
      return;
    }
    vp.style.cursor = scale > 1.01 ? "grab" : "";
  }, [safeSvg, settings.picker, isSpaceDown, scale]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " " && !e.repeat) {
        setIsSpaceDown(true);
      }

      if (!safeSvg) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (key === "escape") {
        setSettings((st) => ({ ...st, picker: false }));
        setPicked(null);
        setPickedOutline(null);
        return;
      }

      if (ctrl && key === "0") {
        e.preventDefault();
        setSettings((st) => ({ ...st, fitMode: "fit" }));
        requestAnimationFrame(() => fitToViewport("fit"));
        return;
      }

      if (ctrl && (key === "=" || key === "+")) {
        e.preventDefault();
        zoomAtCenter(scale * 1.15);
        return;
      }

      if (ctrl && key === "-") {
        e.preventDefault();
        zoomAtCenter(scale / 1.15);
        return;
      }

      if (key === "f") {
        setSettings((st) => ({ ...st, fitMode: "fit" }));
        requestAnimationFrame(() => fitToViewport("fit"));
        return;
      }

      if (key === "a") {
        setSettings((st) => ({ ...st, fitMode: "actual" }));
        requestAnimationFrame(() => setActual());
        return;
      }

      if (key === "i") {
        setSettings((st) => ({ ...st, showInspector: !st.showInspector }));
        return;
      }

      if (key === "p") {
        setSettings((st) => ({ ...st, picker: !st.picker }));
        return;
      }

      if (key === "g") {
        setSettings((st) => ({ ...st, grid: !st.grid }));
        return;
      }

      if (key === "b") {
        setSettings((st) => ({ ...st, bounds: !st.bounds }));
        return;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " ") {
        setIsSpaceDown(false);
      }
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown as any);
      window.removeEventListener("keyup", onKeyUp as any);
    };
  }, [safeSvg, scale]);

  // Resize observer to keep fit stable
  React.useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const ro = new ResizeObserver(() => {
      if (!safeSvg) return;
      if (settings.fitMode === "fit") fitToViewport("fit");
      if (settings.fitMode === "fill") fitToViewport("fill");
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSvg, settings.fitMode]);

  function intrinsicSize(): { w: number; h: number } {
    const vb = info?.vb;
    // prefer viewBox for viewer
    const w = vb?.w ?? parseLen(info?.widthRaw || "") ?? 1024;
    const h = vb?.h ?? parseLen(info?.heightRaw || "") ?? 1024;
    return {
      w: Math.max(1, Number(w) || 1024),
      h: Math.max(1, Number(h) || 1024),
    };
  }

  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  function centerAtScale(nextScale: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const { w, h } = intrinsicSize();
    const scaledW = w * nextScale;
    const scaledH = h * nextScale;
    setTx((r.width - scaledW) / 2);
    setTy((r.height - scaledH) / 2);
  }

  function setActual() {
    setScale(1);
    requestAnimationFrame(() => centerAtScale(1));
  }

  function fitToViewport(mode: "fit" | "fill") {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const pad = 24;
    const availW = Math.max(1, r.width - pad * 2);
    const availH = Math.max(1, r.height - pad * 2);
    const { w, h } = intrinsicSize();
    const sx = availW / w;
    const sy = availH / h;
    const next = mode === "fit" ? Math.min(sx, sy) : Math.max(sx, sy);
    const nextScale = clamp(next, 0.05, 64);
    setScale(nextScale);
    requestAnimationFrame(() => centerAtScale(nextScale));
  }

  function zoomAtCenter(nextScaleRaw: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    zoomAtScreenPoint(r.left + r.width / 2, r.top + r.height / 2, nextScaleRaw);
  }

  function zoomAtScreenPoint(
    screenX: number,
    screenY: number,
    nextScaleRaw: number,
  ) {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const nextScale = clamp(nextScaleRaw, 0.05, 64);

    const px = screenX - r.left;
    const py = screenY - r.top;

    setTx((prevTx) => {
      const worldX = (px - prevTx) / scale;
      return px - worldX * nextScale;
    });
    setTy((prevTy) => {
      const worldY = (py - prevTy) / scale;
      return py - worldY * nextScale;
    });
    setScale(nextScale);
  }

  function onWheel(e: React.WheelEvent) {
    if (!safeSvg) return;

    // Intuitive UX:
    // - Regular wheel scroll should scroll the page (do not hijack).
    // - Ctrl/Cmd wheel or trackpad pinch should zoom in the viewer.
    // - Alt wheel also zooms for users who prefer it.
    const zoomIntent = e.ctrlKey || e.metaKey || e.altKey;
    if (!zoomIntent) return;

    e.preventDefault();

    // Trackpads often send small deltas, this curve feels natural
    const delta = e.deltaY;
    const factor = Math.exp(-delta * 0.0015);
    zoomAtScreenPoint(e.clientX, e.clientY, scale * factor);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!safeSvg) return;

    // Allow panning even while picker is enabled if Space is held or middle mouse.
    // Also allow intuitive left-drag panning when zoomed in.
    const isTouch = e.pointerType === "touch";

    const shouldPan =
      isTouch ||
      isSpaceDown ||
      e.button === 1 ||
      (e.button === 0 && scale > 1.01 && !settings.picker);

    if (!shouldPan) return;

    didPanRef.current = false;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    panRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseTx: tx,
      baseTy: ty,
    };

    const vp = viewportRef.current;
    if (vp) vp.style.cursor = "grabbing";
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = panRef.current;
    if (!p.active) return;
    if (p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;

    if (!didPanRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      didPanRef.current = true;
    }

    setTx(p.baseTx + dx);
    setTy(p.baseTy + dy);
  }

  function onPointerUp(e: React.PointerEvent) {
    const p = panRef.current;
    if (!p.active) return;
    if (p.pointerId !== e.pointerId) return;
    panRef.current.active = false;
    panRef.current.pointerId = null;

    const vp = viewportRef.current;
    if (!vp) return;

    if (settings.picker) vp.style.cursor = "crosshair";
    else if (isSpaceDown || scale > 1.01) vp.style.cursor = "grab";
    else vp.style.cursor = "";
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (!safeSvg) return;
    // Double click zooms in, but keep it from selecting text.
    e.preventDefault();
    zoomAtScreenPoint(e.clientX, e.clientY, scale * 1.35);
  }

  function sizeLabel(bytes: number) {
    if (!bytes || !Number.isFinite(bytes)) return "?";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

  function downloadSource() {
    if (!svgText) return;
    const name = (settings.fileName || "svg").trim() || "svg";
    downloadText(svgText, `${safeFileName(name)}.svg`);
    showToast("Downloaded");
  }

  function copy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => showToast("Copied"));
  }

  function resetView() {
    setPicked(null);
    setPickedOutline(null);
    if (settings.fitMode === "actual") setActual();
    else if (settings.fitMode === "fit") fitToViewport("fit");
    else fitToViewport("fill");
  }

  function setFitMode(m: FitMode) {
    setSettings((s) => ({ ...s, fitMode: m }));
    requestAnimationFrame(() => {
      if (m === "actual") setActual();
      else if (m === "fit") fitToViewport("fit");
      else fitToViewport("fill");
    });
  }

  // Element picking
  React.useEffect(() => {
    if (!settings.picker) return;
    const host = svgHostRef.current;
    if (!host) return;

    function handler(ev: MouseEvent) {
      // If user just panned, do not treat as a pick click.
      if (didPanRef.current || panRef.current.active || isSpaceDown) return;

      if (!settings.picker) return;
      const target = ev.target as Element | null;
      if (!target) return;

      // only inside svg
      const svgEl = target.closest("svg");
      if (!svgEl) return;

      ev.preventDefault();
      ev.stopPropagation();

      const el = target as any;

      // ignore <svg> itself
      if (target.tagName.toLowerCase() === "svg") return;

      // gather
      const tag = target.tagName.toLowerCase();
      const id = (target.getAttribute("id") || undefined) as string | undefined;
      const classes = (target.getAttribute("class") || undefined) as
        | string
        | undefined;

      const fill = (target.getAttribute("fill") || undefined) as
        | string
        | undefined;
      const stroke = (target.getAttribute("stroke") || undefined) as
        | string
        | undefined;

      const d = target.getAttribute("d");
      const dLen = d ? d.length : undefined;

      const bbox = safeGetBBox(el);

      setPicked({ tag, id, classes, fill, stroke, dLen, bbox });

      if (bbox) {
        const outline = `M${bbox.x},${bbox.y} h${bbox.w} v${bbox.h} h${-bbox.w} Z`;
        setPickedOutline(outline);
      } else {
        setPickedOutline(null);
      }

      setTab("elements");
      if (!settings.showInspector)
        setSettings((s) => ({ ...s, showInspector: true }));
    }

    host.addEventListener("click", handler, true);
    return () => host.removeEventListener("click", handler, true);
  }, [settings.picker, settings.showInspector, isSpaceDown]);

  // Update minimap viewbox overlay by computing viewport in SVG coords
  const minimap = React.useMemo(() => {
    if (!safeSvg || !info?.vb) return null;

    const vb = info.vb;
    const vp = viewportRef.current;
    if (!vp) return null;

    const r = vp.getBoundingClientRect();
    const { w, h } = intrinsicSize();

    const viewSvgX = -tx / scale;
    const viewSvgY = -ty / scale;
    const viewSvgW = r.width / scale;
    const viewSvgH = r.height / scale;

    // Map intrinsic coords to viewBox coords
    const sx = vb.w / w;
    const sy = vb.h / h;

    const vx = vb.minX + viewSvgX * sx;
    const vy = vb.minY + viewSvgY * sy;
    const vw = viewSvgW * sx;
    const vh = viewSvgH * sy;

    return {
      vb,
      vx,
      vy,
      vw,
      vh,
    };
  }, [safeSvg, info?.vb, tx, ty, scale]);

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "SVG Viewer", href: "/svg-preview-viewer" },
  ];

  const inputBytes = info?.bytes ?? (svgText ? new Blob([svgText]).size : 0);

  return (
    <>
      <main className=" bg-slate-50 text-slate-900" onPaste={onPaste}>
        <div className="max-w-[1180px] mx-auto px-4 pb-8">
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

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ">
            {/* Top bar */}
            <div className="border-b border-slate-200 bg-white ">
              <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap ">
                <div className="flex items-center gap-3 min-w-0">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 cursor-pointer">
                    <span className="font-semibold text-slate-900 text-[14px]">
                      Open SVG
                    </span>
                    <input
                      type="file"
                      accept="image/svg+xml,.svg"
                      onChange={onPick}
                      className="hidden"
                    />
                  </label>

                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-900 truncate">
                      {file ? file.name : "No file loaded"}
                    </div>
                    <div className="text-[12px] text-slate-600">
                      {file ? (
                        <>
                          {sizeLabel(inputBytes)}
                          {info?.viewBox ? (
                            <span className="text-slate-400"> • </span>
                          ) : null}
                          {info?.viewBox ? (
                            <span>viewBox {info.viewBox}</span>
                          ) : null}
                        </>
                      ) : (
                        "Drop or paste an SVG anywhere on this page"
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => zoomAtCenter(scale / 1.15)}
                    disabled={!hydrated || !safeSvg}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Zoom out (Ctrl/Cmd + wheel, Ctrl + -)"
                  >
                    −
                  </button>

                  <button
                    type="button"
                    onClick={() => zoomAtCenter(scale * 1.15)}
                    disabled={!hydrated || !safeSvg}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Zoom in (Ctrl/Cmd + wheel, Ctrl + +)"
                  >
                    +
                  </button>

                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[12px] text-slate-600 w-[52px] text-right">
                      {Math.round(scale * 100)}%
                    </span>
                    <input
                      type="range"
                      min={5}
                      max={800}
                      value={Math.round(scale * 100)}
                      onChange={(e) => {
                        const val = clamp(
                          Number(e.target.value) / 100,
                          0.05,
                          64,
                        );
                        zoomAtCenter(val);
                      }}
                      disabled={!hydrated || !safeSvg}
                      className="w-[180px] cursor-pointer disabled:cursor-not-allowed"
                      title="Zoom"
                    />
                  </div>

                  <select
                    value={settings.fitMode}
                    onChange={(e) => setFitMode(e.target.value as FitMode)}
                    disabled={!hydrated || !safeSvg}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Fit mode (F, A, Ctrl+0)"
                  >
                    <option value="fit">Fit</option>
                    <option value="fill">Fill</option>
                    <option value="actual">Actual</option>
                  </select>

                  <button
                    type="button"
                    onClick={resetView}
                    disabled={!hydrated || !safeSvg}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Reset view"
                  >
                    Reset
                  </button>

                  <span className="mx-1 text-slate-200">|</span>

                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({ ...s, picker: !s.picker }))
                    }
                    disabled={!hydrated || !safeSvg}
                    className={[
                      "px-3 py-2 rounded-xl border transition-colors cursor-pointer",
                      settings.picker
                        ? "border-sky-300 bg-sky-50 text-slate-900"
                        : "border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                    ].join(" ")}
                    title="Element picker (P). Click an element to inspect."
                  >
                    Pick
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        showInspector: !s.showInspector,
                      }))
                    }
                    disabled={!hydrated}
                    className={[
                      "px-3 py-2 rounded-xl border transition-colors cursor-pointer",
                      settings.showInspector
                        ? "border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                    ].join(" ")}
                    title="Toggle inspector (I)"
                  >
                    Inspector
                  </button>

                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={!hydrated || (!file && !svgText)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Clear"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Secondary bar */}
              <div className="px-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <TogglePill
                    label="Grid (G)"
                    checked={settings.grid}
                    onChange={(v) => setSettings((s) => ({ ...s, grid: v }))}
                    disabled={!safeSvg}
                  />
                  <TogglePill
                    label="Bounds (B)"
                    checked={settings.bounds}
                    onChange={(v) => setSettings((s) => ({ ...s, bounds: v }))}
                    disabled={!safeSvg}
                  />
                  <TogglePill
                    label="Snap"
                    checked={settings.snap}
                    onChange={(v) => setSettings((s) => ({ ...s, snap: v }))}
                    disabled={!safeSvg}
                  />

                  <select
                    value={settings.bg}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        bg: e.target.value as BgMode,
                      }))
                    }
                    disabled={!hydrated || !safeSvg}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Background"
                  >
                    <option value="checker">Checker</option>
                    <option value="white">White</option>
                    <option value="black">Black</option>
                    <option value="transparent">Transparent</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => copy(svgText)}
                    disabled={!hydrated || !svgText}
                    className=" inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Copy source"
                  >
                    <Icons name="copy" size={16} className="mr-1" />
                    Copy source
                  </button>
                  <button
                    type="button"
                    onClick={downloadSource}
                    disabled={!hydrated || !svgText}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl font-semibold border border-sky-600 text-white bg-sky-500 hover:bg-sky-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Download original source"
                  >
                    <Icons name="download" size={16} className="mr-1" />
                    Download SVG
                  </button>
                </div>
              </div>
            </div>

            {/* Body split */}
            <div className="lg:pt-0 lg:pb-8 grid grid-cols-1 lg:grid-cols-[1fr_360px]">
              {/* Viewer */}
              <div className="border-r border-slate-200">
                <div
                  ref={viewportRef}
                  onWheel={onWheel}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onDoubleClick={onDoubleClick}
                  onContextMenu={(e) => settings.picker && e.preventDefault()}
                  className={[
                    "relative h-[560px] lg:h-[680px] overflow-hidden select-none touch-none",
                    bgClass(settings.bg),
                  ].join(" ")}
                >
                  {settings.grid && <GridOverlay />}

                  {!safeSvg ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onDrop}
                    >
                      <div className="text-center px-6">
                        <div className="text-[22px] font-extrabold text-slate-900">
                          SVG Viewer
                        </div>
                        <div className="mt-2 text-slate-600">
                          Open, drop, or paste an SVG.
                        </div>
                        <div className="mt-4 text-[13px] text-slate-500">
                          Ctrl/Cmd + wheel (or pinch) to zoom. Drag to pan when
                          zoomed. Hold Space to pan anytime.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="absolute left-0 top-0"
                        style={{
                          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                          transformOrigin: "0 0",
                          willChange: "transform",
                        }}
                      >
                        <div
                          className={
                            settings.bounds ? "outline outline-sky-300" : ""
                          }
                          style={{
                            width: `${intrinsicSize().w}px`,
                            height: `${intrinsicSize().h}px`,
                            position: "relative",
                          }}
                        >
                          <div
                            ref={svgHostRef}
                            className="w-full h-full"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: safeSvg }}
                          />

                          {pickedOutline && info?.vb ? (
                            <SvgOverlayPath
                              vb={info.vb}
                              outlinePath={pickedOutline}
                            />
                          ) : null}
                        </div>
                      </div>

                      {/* Help chip */}
                      <div className="absolute left-3 top-3 flex items-center gap-2">
                        <div className="px-3 py-2 rounded-xl bg-white/90 border border-slate-200 text-[12px] text-slate-700 shadow-sm">
                          {settings.picker ? (
                            <span>
                              Picker on: click an element. Drag to pan with
                              Space. Esc exits.
                            </span>
                          ) : scale > 1.01 ? (
                            <span>
                              Ctrl/Cmd + wheel to zoom. Drag to pan. Space pans
                              from anywhere.
                            </span>
                          ) : (
                            <span>
                              Ctrl/Cmd + wheel to zoom. Space pan, or zoom in to
                              drag-pan.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Minimap */}
                      {minimap && (
                        <div className="absolute right-3 bottom-3">
                          <MiniMap minimap={minimap} />
                        </div>
                      )}
                    </>
                  )}

                  {err && (
                    <div className="absolute left-3 bottom-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[13px]">
                      {err}
                    </div>
                  )}
                </div>
              </div>

              {/* Inspector */}
              <div
                className={
                  settings.showInspector ? "bg-white" : "hidden lg:block"
                }
              >
                <div className="h-full flex flex-col">
                  <div className="border-b border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-slate-900">
                        Inspector
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({ ...s, showInspector: false }))
                        }
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                        title="Hide"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <TabPill
                        active={tab === "details"}
                        onClick={() => setTab("details")}
                      >
                        Details
                      </TabPill>
                      <TabPill
                        active={tab === "elements"}
                        onClick={() => setTab("elements")}
                      >
                        Elements
                      </TabPill>
                      <TabPill
                        active={tab === "source"}
                        onClick={() => setTab("source")}
                      >
                        Source
                      </TabPill>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-3">
                    {!safeSvg ? (
                      <div className="text-slate-600 text-sm">
                        Load an SVG to inspect it.
                      </div>
                    ) : tab === "details" ? (
                      <DetailsPanel
                        info={info}
                        settings={settings}
                        setSettings={setSettings}
                        bytes={inputBytes}
                      />
                    ) : tab === "elements" ? (
                      <ElementsPanel
                        info={info}
                        picked={picked}
                        onClearPick={() => {
                          setPicked(null);
                          setPickedOutline(null);
                        }}
                      />
                    ) : (
                      <SourcePanel
                        svgText={svgText}
                        safeSvg={safeSvg}
                        onCopySource={() => copy(svgText)}
                        onCopyPreview={() => copy(safeSvg)}
                        hydrated={hydrated}
                      />
                    )}
                  </div>

                  <div className="border-t border-slate-200 p-3 text-[12px] text-slate-600">
                    Shortcuts: Ctrl+0 fit, Ctrl+ +/- zoom, F fit, A actual, P
                    pick, I inspector, Esc exit pick
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg text-sm z-[1000]">
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
   Panels
======================== */
function DetailsPanel({
  info,
  settings,
  setSettings,
  bytes,
}: {
  info: SvgInfo | null;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  bytes: number;
}) {
  const hasScripts = !!info?.hasScripts;
  const hasForeignObject = !!info?.hasForeignObject;

  return (
    <div className="grid gap-3">
      <InfoCard title="File">
        <InfoRow label="Size" value={<b>{bytesLabel(bytes)}</b>} />
        <InfoRow label="Width" value={info?.widthRaw || "(none)"} />
        <InfoRow label="Height" value={info?.heightRaw || "(none)"} />
        <InfoRow label="viewBox" value={info?.viewBox || "(none)"} />
        <InfoRow
          label="Aspect"
          value={
            info?.aspect && Number.isFinite(info.aspect)
              ? String(Math.round(info.aspect * 1000) / 1000)
              : "?"
          }
        />
      </InfoCard>

      {(hasScripts || hasForeignObject) && (
        <InfoCard title="Detected">
          {hasScripts ? (
            <div className="text-amber-800 text-[13px]">
              This SVG contains script or event handlers.
            </div>
          ) : null}
          {hasForeignObject ? (
            <div className="text-amber-800 text-[13px]">
              This SVG contains foreignObject.
            </div>
          ) : null}
        </InfoCard>
      )}

      <InfoCard title="Safety preview">
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[13px] text-slate-700">Strip scripts</span>
          <input
            type="checkbox"
            checked={settings.stripScripts}
            onChange={(e) =>
              setSettings((s) => ({ ...s, stripScripts: e.target.checked }))
            }
            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[13px] text-slate-700">
            Strip foreignObject
          </span>
          <input
            type="checkbox"
            checked={settings.stripForeignObject}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                stripForeignObject: e.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[13px] text-slate-700">
            Strip event handlers
          </span>
          <input
            type="checkbox"
            checked={settings.stripEventHandlers}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                stripEventHandlers: e.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[13px] text-slate-700">
            Strip javascript: href
          </span>
          <input
            type="checkbox"
            checked={settings.stripJavascriptHrefs}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                stripJavascriptHrefs: e.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
          />
        </label>
      </InfoCard>
    </div>
  );
}

function ElementsPanel({
  info,
  picked,
  onClearPick,
}: {
  info: SvgInfo | null;
  picked: Picked | null;
  onClearPick: () => void;
}) {
  const ids = info?.ids || [];
  const tagCounts = info?.tagCounts || {};
  const defs = info?.defsSummary;

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);

  return (
    <div className="grid gap-3">
      <InfoCard title="Picked element">
        {!picked ? (
          <div className="text-[13px] text-slate-600">
            Turn on Pick and click an element in the viewer.
          </div>
        ) : (
          <div className="grid gap-2">
            <InfoRow label="Tag" value={<b>{picked.tag}</b>} />
            <InfoRow label="id" value={picked.id || "(none)"} />
            <InfoRow label="class" value={picked.classes || "(none)"} />
            <InfoRow label="fill" value={picked.fill || "(none)"} />
            <InfoRow label="stroke" value={picked.stroke || "(none)"} />
            <InfoRow label="d length" value={picked.dLen ?? "(n/a)"} />
            <InfoRow
              label="bbox"
              value={
                picked.bbox
                  ? `${round3(picked.bbox.x)}, ${round3(
                      picked.bbox.y,
                    )}  ${round3(picked.bbox.w)}×${round3(picked.bbox.h)}`
                  : "(n/a)"
              }
            />
            <button
              type="button"
              onClick={onClearPick}
              className="inline-flex items-center justify-center mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
            >
              <Icons name="trash" size={16} className="mr-1" />
              Clear selection
            </button>
          </div>
        )}
      </InfoCard>

      <InfoCard title="Counts">
        {sortedTags.length ? (
          <div className="grid gap-1">
            {sortedTags.map(([tag, count]) => (
              <div key={tag} className="flex items-center justify-between">
                <span className="text-[13px] text-slate-700">{tag}</span>
                <span className="text-[13px] font-semibold text-slate-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-slate-600">No element counts.</div>
        )}
      </InfoCard>

      <InfoCard title="Defs">
        {defs ? (
          <div className="grid gap-1">
            <MiniRow label="gradients" value={defs.gradients} />
            <MiniRow label="patterns" value={defs.patterns} />
            <MiniRow label="clipPaths" value={defs.clipPaths} />
            <MiniRow label="masks" value={defs.masks} />
            <MiniRow label="filters" value={defs.filters} />
            <MiniRow label="symbols" value={defs.symbols} />
          </div>
        ) : (
          <div className="text-[13px] text-slate-600">No defs summary.</div>
        )}
      </InfoCard>

      <InfoCard title="IDs">
        {ids.length ? (
          <div className="flex flex-wrap gap-1">
            {ids.slice(0, 80).map((id) => (
              <span
                key={id}
                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-700"
              >
                #{id}
              </span>
            ))}
            {ids.length > 80 ? (
              <span className="text-[12px] text-slate-500">
                +{ids.length - 80} more
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-[13px] text-slate-600">No ids found.</div>
        )}
      </InfoCard>
    </div>
  );
}

function SourcePanel({
  svgText,
  safeSvg,
  onCopySource,
  onCopyPreview,
  hydrated,
}: {
  svgText: string;
  safeSvg: string;
  onCopySource: () => void;
  onCopyPreview: () => void;
  hydrated: boolean;
}) {
  return (
    <div className="grid gap-3">
      <InfoCard title="Source">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <button
            type="button"
            onClick={onCopySource}
            disabled={!hydrated || !svgText}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icons name="copy" size={16} className="mr-1" />
            Copy source
          </button>
          <button
            type="button"
            onClick={onCopyPreview}
            disabled={!hydrated || !safeSvg}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icons name="copy" size={16} className="mr-1" />
            Copy preview
          </button>
        </div>

        <textarea
          value={svgText}
          readOnly
          className="w-full h-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
          spellCheck={false}
        />
      </InfoCard>

      <InfoCard title="Preview (sanitized)">
        <textarea
          value={safeSvg}
          readOnly
          className="w-full h-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
          spellCheck={false}
        />
      </InfoCard>
    </div>
  );
}

/* ========================
   Safe SVG builder
======================== */
function buildSafeSvg(svgText: string, settings: Settings) {
  let svg = ensureSvgHasXmlns(svgText);

  // Normalize newlines
  svg = svg.replace(/\r\n?/g, "\n");

  // Hard ban on scripts if requested
  if (settings.stripScripts) {
    svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  }

  if (settings.stripForeignObject) {
    svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");
  }

  if (settings.stripEventHandlers) {
    // remove on*="..." and on*=...
    svg = svg.replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");
    svg = svg.replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, "");
  }

  if (settings.stripJavascriptHrefs) {
    svg = svg.replace(
      /\s(?:href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi,
      "",
    );
  }

  // Ensure outer SVG has width/height attributes in viewer space if missing,
  // but do not mutate source text, only preview.
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!open) throw new Error("Could not find <svg> tag.");

  const hasW = /width\s*=\s*["'][^"']+["']/i.test(open);
  const hasH = /height\s*=\s*["'][^"']+["']/i.test(open);
  const hasVB = /viewBox\s*=\s*["'][^"']+["']/i.test(open);

  let newOpen = open;

  if (!hasVB && hasW && hasH) {
    const w = parseLen(matchAttr(open, "width") || "") ?? 1024;
    const h = parseLen(matchAttr(open, "height") || "") ?? 1024;
    newOpen = setOrReplaceAttr(newOpen, "viewBox", `0 0 ${w} ${h}`);
  }

  if (!hasW && !hasH && hasVB) {
    const vb = parseViewBox(matchAttr(newOpen, "viewBox"));
    if (vb) {
      newOpen = setOrReplaceAttr(newOpen, "width", `${vb.w}`);
      newOpen = setOrReplaceAttr(newOpen, "height", `${vb.h}`);
    }
  }

  // Force preserveAspectRatio to a sane default for viewer
  if (!/preserveAspectRatio\s*=\s*["'][^"']+["']/i.test(newOpen)) {
    newOpen = setOrReplaceAttr(newOpen, "preserveAspectRatio", "xMidYMid meet");
  }

  svg = svg.replace(open, newOpen);

  return svg;
}

/* ========================
   SVG overlay (picked bbox)
======================== */
function SvgOverlayPath({
  vb,
  outlinePath,
}: {
  vb: SvgVB;
  outlinePath: string;
}) {
  // Overlay is in svg coords. We render a transparent svg on top using same viewBox.
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      viewBox={`${vb.minX} ${vb.minY} ${vb.w} ${vb.h}`}
      preserveAspectRatio="none"
    >
      <path
        d={outlinePath}
        fill="none"
        stroke="rgba(11,45,255,0.85)"
        strokeWidth={Math.max(vb.w, vb.h) / 600}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ========================
   Minimap
======================== */
function MiniMap({
  minimap,
}: {
  minimap: {
    vb: SvgVB;
    vx: number;
    vy: number;
    vw: number;
    vh: number;
  };
}) {
  const { vb, vx, vy, vw, vh } = minimap;

  const pad = Math.max(vb.w, vb.h) * 0.02;
  const view = {
    x: vb.minX - pad,
    y: vb.minY - pad,
    w: vb.w + pad * 2,
    h: vb.h + pad * 2,
  };

  const rect = {
    x: vx,
    y: vy,
    w: vw,
    h: vh,
  };

  return (
    <div className="w-[160px] h-[120px] rounded-xl bg-white/90 border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-2 py-1 text-[11px] text-slate-600 border-b border-slate-200 bg-slate-50">
        Map
      </div>
      <svg
        className="w-full h-full"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      >
        <rect
          x={vb.minX}
          y={vb.minY}
          width={vb.w}
          height={vb.h}
          fill="rgba(2,6,23,0.04)"
          stroke="rgba(2,6,23,0.18)"
          strokeWidth={Math.max(vb.w, vb.h) / 700}
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill="none"
          stroke="rgba(11,45,255,0.9)"
          strokeWidth={Math.max(vb.w, vb.h) / 600}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
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

  const vb = parseViewBox(viewBox);
  const w = widthRaw ? parseLen(widthRaw) : null;
  const h = heightRaw ? parseLen(heightRaw) : null;

  const aspect =
    (vb && vb.h > 0 ? vb.w / vb.h : w && h && h > 0 ? w / h : null) || null;

  const hasScripts =
    /<script\b/i.test(coerced) || /\son[a-z]+\s*=\s*/i.test(coerced);
  const hasForeignObject = /<foreignObject\b/i.test(coerced);

  // DOM-based counts (safe in browser)
  const { tagCounts, ids, defsSummary } = analyzeSvgDom(coerced);

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    vb,
    aspect,
    hasScripts,
    hasForeignObject,
    tagCounts,
    ids,
    defsSummary,
  };
}

function analyzeSvgDom(svg: string): {
  tagCounts: Record<string, number>;
  ids: string[];
  defsSummary: SvgInfo["defsSummary"];
} {
  const tagCounts: Record<string, number> = {};
  const ids: string[] = [];
  const defsSummary = {
    gradients: 0,
    patterns: 0,
    clipPaths: 0,
    masks: 0,
    filters: 0,
    symbols: 0,
  };

  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const all = Array.from(doc.querySelectorAll("*"));

    for (const el of all) {
      const tag = el.tagName.toLowerCase();
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;

      const id = el.getAttribute("id");
      if (id) ids.push(id);
    }

    defsSummary.gradients = doc.querySelectorAll(
      "linearGradient, radialGradient",
    ).length;
    defsSummary.patterns = doc.querySelectorAll("pattern").length;
    defsSummary.clipPaths = doc.querySelectorAll("clipPath").length;
    defsSummary.masks = doc.querySelectorAll("mask").length;
    defsSummary.filters = doc.querySelectorAll("filter").length;
    defsSummary.symbols = doc.querySelectorAll("symbol").length;
  } catch {
    // ignore
  }

  // unique ids
  const uniq = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));

  return { tagCounts, ids: uniq, defsSummary };
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
  return { minX, minY, w, h };
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseLen(raw: string): number | null {
  const m = String(raw)
    .trim()
    .match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.abs(n) : null;
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

function setOrReplaceAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/<svg\b/i, (m) => `${m} ${name}="${escapeAttr(value)}"`);
}

function escapeAttr(v: string) {
  return String(v).replace(/"/g, "&quot;");
}

/* ========================
   Element bbox helper
======================== */
function safeGetBBox(
  el: any,
): { x: number; y: number; w: number; h: number } | null {
  try {
    if (!el || typeof el.getBBox !== "function") return null;
    const b = el.getBBox();
    if (
      !b ||
      !isFinite(b.x) ||
      !isFinite(b.y) ||
      !isFinite(b.width) ||
      !isFinite(b.height)
    )
      return null;
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    return null;
  }
}

/* ========================
   Small UI components
======================== */
function TogglePill({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        "px-3 py-2 rounded-xl border text-[14px] font-semibold transition-colors cursor-pointer",
        checked
          ? "border-sky-300 bg-sky-50 text-slate-900"
          : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      ].join(" ")}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}

function TabPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl border text-[13px] font-semibold transition-colors cursor-pointer",
        active
          ? "border-sky-300 bg-sky-50 text-slate-900"
          : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="font-extrabold text-slate-900 mb-2">{title}</div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-xl px-3 py-2">
      <span className="text-slate-600 text-[13px]">{label}</span>
      <span className="text-slate-900 text-[13px] truncate">{value}</span>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-slate-700">{label}</span>
      <span className="text-[13px] font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function bytesLabel(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/* ========================
   Viewer background + grid
======================== */
function bgClass(bg: BgMode) {
  if (bg === "white") return "bg-white";
  if (bg === "black") return "bg-slate-950";
  if (bg === "transparent") return "bg-transparent";
  return "bg-[linear-gradient(45deg,rgba(0,0,0,0.06)_25%,transparent_25%,transparent_75%,rgba(0,0,0,0.06)_75%,rgba(0,0,0,0.06)),linear-gradient(45deg,rgba(0,0,0,0.06)_25%,transparent_25%,transparent_75%,rgba(0,0,0,0.06)_75%,rgba(0,0,0,0.06))] bg-[length:24px_24px] bg-[position:0_0,12px_12px]";
}

function GridOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-80"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(2,6,23,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,0.06) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

/* ========================
   Breadcrumbs + JSON-LD
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
        className="text-[13px] text-slate-600 max-w-[1180px] mx-auto px-4 py-2"
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
        name: "SVG Viewer",
        item: `${baseUrl}/svg-preview-viewer`,
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

function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((x) => ({
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
   SEO sections (correct for SVG Viewer)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-900">
        <article>
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <p className="m-0 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              SVG inspection tool
            </p>

            <h2 className="m-0 text-2xl text-sky-800 md:text-3xl font-extrabold tracking-tight leading-tight">
              SVG Viewer (Zoom, Pan, Inspect)
            </h2>

            <p className="mt-3 m-0 text-[15px] leading-relaxed text-slate-700">
              Open an SVG and inspect it fast. Zoom and pan for detailed
              checking, pick elements to see attributes, review basic stats like
              viewBox and dimensions, and copy the source. Everything runs
              client-side.
            </p>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "Private", v: "No uploads, runs in your browser" },
                { k: "Zoom + pan", v: "Ctrl/Cmd + wheel to zoom, drag to pan" },
                { k: "Element picker", v: "Click elements to inspect details" },
                { k: "Source access", v: "Copy or download the original SVG" },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {x.k}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{x.v}</div>
                </div>
              ))}
            </div>
          </header>

          {typeof document !== "undefined" && (
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
          <ExampleSvgConversion />

          <section className="mt-10">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              How to use the SVG viewer
            </h3>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Open, drop, or paste an SVG",
                  body: "Use the file picker, drag and drop, or paste an SVG file from your clipboard.",
                },
                {
                  title: "Zoom intentionally",
                  body: "Use Ctrl/Cmd + mouse wheel or trackpad pinch to zoom the SVG without hijacking normal page scrolling.",
                },
                {
                  title: "Pan to inspect",
                  body: "Drag to pan when zoomed in. Hold Space to pan from anywhere. Use middle mouse if you prefer.",
                },
                {
                  title: "Pick elements to inspect",
                  body: "Turn on Pick, click an element, and review its tag, id, class, fill/stroke, and bounding box when available.",
                },
                {
                  title: "Copy or download source",
                  body: "Copy the original SVG source, or download it with the filename you want.",
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-slate-900 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {s.title}
                      </div>
                      <div className="mt-1 text-sm text-slate-600 leading-relaxed">
                        {s.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="m-0 text-lg font-extrabold text-slate-900">
              Frequently asked questions
            </h3>

            <div className="mt-4 grid gap-3">
              {FAQ.map((x) => (
                <article
                  key={x.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h4
                    itemProp="name"
                    className="m-0 font-semibold text-slate-900"
                  >
                    {x.q}
                  </h4>
                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm text-slate-600 leading-relaxed"
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

/* ========================
   Filename helpers
======================== */
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
      .slice(0, 80) || "svg"
  );
}
