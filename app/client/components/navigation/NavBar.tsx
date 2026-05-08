import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type NavItem = {
  label: string;
  href: string;
  keywords?: string[];
};

type Rect = { top: number; left: number; width: number; height: number };

type NavCategoryId =
  | "general"
  | "file-types"
  | "cricut"
  | "line-art"
  | "logo-icon"
  | "layered"
  | "svg-export"
  | "svg-tools"
  | "more";

type NavCategory = {
  id: NavCategoryId;
  label: string;
  description: string;
};

type NavGroup = {
  category: NavCategory;
  items: NavItem[];
};

const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "line-art",
    label: "Line art and sketch",
    description: "Outline, drawing, scan, and monochrome routes.",
  },
  {
    id: "cricut",
    label: "Cricut and cut files",
    description: "Craft, vinyl, sticker, and cutter routes.",
  },
  {
    id: "logo-icon",
    label: "Logo and icon",
    description: "Brand, icon, emoji, and text conversions.",
  },
  {
    id: "file-types",
    label: "File type converters",
    description: "PNG, JPG, WebP, and Base64 tools.",
  },
  {
    id: "layered",
    label: "Layered and color SVG",
    description: "Layered color and multi-color outputs.",
  },
  {
    id: "svg-export",
    label: "Export tools",
    description: "SVG to image, PDF, and favicon outputs.",
  },
  {
    id: "svg-tools",
    label: "SVG editing tools",
    description: "Recolor, clean, inspect, and edit SVG files.",
  },
  {
    id: "general",
    label: "General converters",
    description: "Core raster to SVG workflows.",
  },
  {
    id: "more",
    label: "More tools",
    description: "Reference and utility pages.",
  },
];

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

export default function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileNavMode, setIsMobileNavMode] = useState(false);

  // Desktop "More" dropdown
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreRect, setMoreRect] = useState<Rect | null>(null);

  // Search
  const [desktopSearch, setDesktopSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");

  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);

  const isClient = useIsClient();

  const SCROLL_CLASS = "ilovesvg-scroll";

  const items: NavItem[] = useMemo(
    () => [
      // Current-page anchor
      {
        label: "All Tools",
        href: "#other-tools",
        keywords: ["all tools", "tools", "navigation", "browse tools"],
      },

      // Home / main converter
      {
        label: "Image to SVG",
        href: "/",
        keywords: [
          "image to svg",
          "convert image",
          "vectorize",
          "png to svg",
          "jpg to svg",
          "jpeg to svg",
          "webp to svg",
          "photo to svg",
          "raster to svg",
        ],
      },

      // SVG -> raster/pdf
      {
        label: "SVG to PNG",
        href: "/svg-to-png-converter",
        keywords: ["svg to png", "png", "transparent png", "export png"],
      },
      {
        label: "SVG to JPG",
        href: "/svg-to-jpg-converter",
        keywords: ["svg to jpg", "svg to jpeg", "jpg", "jpeg", "export jpg"],
      },
      {
        label: "SVG to WebP",
        href: "/svg-to-webp-converter",
        keywords: ["svg to webp", "webp", "export webp"],
      },
      {
        label: "SVG to PDF",
        href: "/svg-to-pdf-converter",
        keywords: ["svg to pdf", "pdf", "print", "export pdf"],
      },

      // SVG utilities
      {
        label: "SVG Background Editor",
        href: "/svg-background-editor",
        keywords: [
          "svg background",
          "background editor",
          "transparent",
          "add background",
        ],
      },
      {
        label: "SVG Resize / Scale",
        href: "/svg-resize-and-scale-editor",
        keywords: ["resize svg", "scale svg", "viewbox", "width", "height"],
      },
      {
        label: "SVG Recolor",
        href: "/svg-recolor",
        keywords: ["recolor svg", "change color", "fill", "stroke"],
      },
      {
        label: "SVG Minifier",
        href: "/svg-minifier",
        keywords: ["svg minifier", "minify", "compress", "reduce size"],
      },
      {
        label: "SVG Cleaner",
        href: "/svg-cleaner",
        keywords: ["svg cleaner", "clean svg", "metadata", "optimize"],
      },
      {
        label: "SVG Preview Viewer",
        href: "/svg-preview-viewer",
        keywords: ["svg preview", "viewer", "view svg", "render svg"],
      },
      {
        label: "SVG Embed Code",
        href: "/svg-embed-code-generator",
        keywords: [
          "embed svg",
          "inline svg",
          "img tag",
          "css background",
          "html code",
        ],
      },
      {
        label: "Inline SVG vs Img",
        href: "/inline-svg-vs-img",
        keywords: ["inline svg", "img", "svg vs img", "reference"],
      },
      {
        label: "SVG to Favicon",
        href: "/svg-to-favicon-generator",
        keywords: ["favicon", "ico", "app icon", "browser icon"],
      },
      {
        label: "SVG Stroke Width Editor",
        href: "/svg-stroke-width-editor",
        keywords: ["stroke width", "line thickness", "stroke-width"],
      },
      {
        label: "SVG Flip / Rotate",
        href: "/svg-flip-and-rotate-editor",
        keywords: ["flip svg", "rotate svg", "mirror", "transform"],
      },
      {
        label: "SVG Dimensions Inspector",
        href: "/svg-dimensions-inspector",
        keywords: ["dimensions", "width", "height", "viewbox", "inspect"],
      },
      {
        label: "SVG File Size Inspector",
        href: "/svg-file-size-inspector",
        keywords: ["file size", "kb", "bytes", "inspect size"],
      },
      {
        label: "SVG Accessibility / Contrast",
        href: "/svg-accessibility-and-contrast-checker",
        keywords: [
          "accessibility",
          "contrast",
          "wcag",
          "a11y",
          "color blindness",
        ],
      },

      // Cricut / craft target audience routes
      {
        label: "Cricut SVG Converter",
        href: "/cricut-svg-converter",
        keywords: [
          "cricut",
          "svg for cricut",
          "cricut svg converter",
          "design space",
          "craft",
          "cut file",
          "vinyl",
          "stickers",
        ],
      },
      {
        label: "Image to SVG for Cricut",
        href: "/image-to-svg-for-cricut",
        keywords: [
          "cricut",
          "image to svg",
          "jpg to svg",
          "jpeg to svg",
          "png to svg",
          "webp to svg",
          "gif to svg",
          "bmp to svg",
          "tiff to svg",
          "svg cleanup",
          "design space",
          "cut file",
        ],
      },
      {
        label: "PNG to SVG for Cricut",
        href: "/png-to-svg-for-cricut",
        keywords: ["cricut", "png to svg", "craft", "cut file", "design space"],
      },
      {
        label: "JPG to SVG for Cricut",
        href: "/jpg-to-svg-for-cricut",
        keywords: [
          "cricut",
          "jpg to svg",
          "jpeg to svg",
          "photo",
          "craft",
          "cut file",
          "design space",
        ],
      },
      {
        label: "JPEG to SVG for Cricut",
        href: "/jpeg-to-svg-for-cricut",
        keywords: [
          "cricut",
          "jpeg to svg",
          "jpg to svg",
          "photo",
          "craft",
          "cut file",
          "design space",
        ],
      },
      {
        label: "WebP to SVG for Cricut",
        href: "/webp-to-svg-for-cricut",
        keywords: [
          "cricut",
          "webp to svg",
          "craft",
          "cut file",
          "design space",
        ],
      },
      {
        label: "Photo to SVG for Cricut",
        href: "/photo-to-svg-for-cricut",
        keywords: [
          "cricut",
          "photo to svg",
          "picture to svg",
          "craft",
          "cut file",
          "design space",
        ],
      },
      {
        label: "B&W Image to SVG for Cricut",
        href: "/black-and-white-image-to-svg-for-cricut",
        keywords: [
          "cricut",
          "black and white",
          "b&w",
          "bw",
          "stencil",
          "monochrome",
          "cut file",
        ],
      },
      {
        label: "Line Art to SVG for Cricut",
        href: "/line-art-to-svg-for-cricut",
        keywords: [
          "cricut",
          "line art",
          "outline",
          "trace",
          "coloring page",
          "cut file",
        ],
      },
      {
        label: "Drawing to SVG for Cricut",
        href: "/drawing-to-svg-for-cricut",
        keywords: [
          "cricut",
          "drawing to svg",
          "hand drawn",
          "trace",
          "cut file",
        ],
      },
      {
        label: "Sketch to SVG for Cricut",
        href: "/sketch-to-svg-for-cricut",
        keywords: [
          "cricut",
          "sketch to svg",
          "pencil",
          "drawing",
          "trace",
          "cut file",
        ],
      },
      {
        label: "Sticker to SVG for Cricut",
        href: "/sticker-to-svg-for-cricut",
        keywords: [
          "cricut",
          "sticker to svg",
          "stickers",
          "labels",
          "print then cut",
          "cut file",
        ],
      },
      {
        label: "Logo to SVG for Cricut",
        href: "/logo-to-svg-for-cricut",
        keywords: [
          "cricut",
          "logo to svg",
          "brand",
          "business logo",
          "vector logo",
          "design space",
        ],
      },
      {
        label: "Layered SVG for Cricut",
        href: "/layered-svg-for-cricut",
        keywords: [
          "cricut",
          "layered svg",
          "layers",
          "multicolor",
          "multi color",
          "vinyl layers",
          "cut file",
        ],
      },
      {
        label: "Image to Layered SVG for Cricut",
        href: "/image-to-layered-svg-for-cricut",
        keywords: [
          "cricut",
          "image to layered svg",
          "layered svg",
          "layers",
          "multicolor",
          "multi color",
          "vinyl layers",
        ],
      },
      {
        label: "PNG to Layered SVG for Cricut",
        href: "/png-to-layered-svg-for-cricut",
        keywords: [
          "cricut",
          "png to layered svg",
          "layered svg",
          "layers",
          "multicolor",
          "multi color",
          "vinyl layers",
        ],
      },
      {
        label: "JPG to Layered SVG for Cricut",
        href: "/jpg-to-layered-svg-for-cricut",
        keywords: [
          "cricut",
          "jpg to layered svg",
          "jpeg to layered svg",
          "layered svg",
          "layers",
          "multicolor",
          "multi color",
        ],
      },
      {
        label: "Logo to Layered SVG for Cricut",
        href: "/logo-to-layered-svg-for-cricut",
        keywords: [
          "cricut",
          "logo to layered svg",
          "layered svg",
          "layers",
          "multicolor",
          "brand",
          "business logo",
        ],
      },
      {
        label: "PNG to SVG for Print Then Cut",
        href: "/png-to-svg-for-cricut-print-then-cut",
        keywords: [
          "cricut",
          "print then cut",
          "stickers",
          "labels",
          "print and cut",
        ],
      },
      {
        label: "PNG to SVG for Cricut Vinyl",
        href: "/png-to-svg-for-cricut-vinyl",
        keywords: ["cricut", "vinyl", "decal", "cut file", "htv", "iron on"],
      },
      {
        label: "PNG to SVG for Cricut Stickers",
        href: "/png-to-svg-for-cricut-stickers",
        keywords: ["cricut", "stickers", "sticker svg", "labels", "kiss cut"],
      },
      {
        label: "Base64 to SVG for Cricut",
        href: "/base64-to-svg-for-cricut",
        keywords: [
          "cricut",
          "base64 to svg",
          "decode svg",
          "data url",
          "design space",
          "cut file",
        ],
      },
      {
        label: "Code to SVG for Cricut",
        href: "/code-to-svg-for-cricut",
        keywords: [
          "cricut",
          "code to svg",
          "svg code",
          "svg markup",
          "design space",
          "cut file",
        ],
      },
      {
        label: "PNG to SVG for Silhouette",
        href: "/png-to-svg-for-silhouette",
        keywords: [
          "silhouette",
          "silhouette studio",
          "cameo",
          "png to svg",
          "craft",
          "cut file",
        ],
      },
      {
        label: "PNG to SVG for Etsy",
        href: "/png-to-svg-for-etsy",
        keywords: [
          "etsy",
          "seller",
          "digital download",
          "png to svg",
          "cut file",
          "svg bundle",
        ],
      },
      {
        label: "PNG to SVG for Laser Cutting",
        href: "/png-to-svg-for-laser-cutting",
        keywords: [
          "laser cutting",
          "engraving",
          "cut paths",
          "outline",
          "glowforge",
          "xtool",
          "lightburn",
        ],
      },

      // Base64
      {
        label: "SVG to Base64",
        href: "/svg-to-base64",
        keywords: ["svg to base64", "encode", "data uri", "base64"],
      },
      {
        label: "Base64 to SVG",
        href: "/base64-to-svg",
        keywords: ["base64 to svg", "decode", "data uri", "decoder"],
      },

      // Color tool
      {
        label: "Color Picker",
        href: "/free-color-picker",
        keywords: ["color picker", "palette", "hex", "rgb", "hsl"],
      },

      // Raster -> SVG
      {
        label: "PNG to SVG",
        href: "/png-to-svg-converter",
        keywords: ["png to svg", "vectorize png", "transparent png"],
      },
      {
        label: "JPG to SVG",
        href: "/jpg-to-svg-converter",
        keywords: ["jpg to svg", "jpeg", "photo", "vectorize jpg"],
      },
      {
        label: "JPEG to SVG",
        href: "/jpeg-to-svg-converter",
        keywords: ["jpeg to svg", "jpg", "photo", "vectorize jpeg"],
      },
      {
        label: "WebP to SVG",
        href: "/webp-to-svg-converter",
        keywords: ["webp to svg", "vectorize webp"],
      },
      {
        label: "Logo to SVG",
        href: "/logo-to-svg-converter",
        keywords: ["logo to svg", "brand", "vector logo"],
      },
      {
        label: "Icon to SVG",
        href: "/icon-to-svg-converter",
        keywords: ["icon to svg", "ui icon", "vector icon"],
      },
      {
        label: "Emoji to SVG",
        href: "/emoji-to-svg-converter",
        keywords: ["emoji to svg", "emoji", "sticker"],
      },
      {
        label: "Text to SVG",
        href: "/text-to-svg-converter",
        keywords: ["text to svg", "wordmark", "typography"],
      },
      {
        label: "Sticker to SVG",
        href: "/sticker-to-svg-converter",
        keywords: ["sticker to svg", "decal", "cut file"],
      },
      {
        label: "Line Art to SVG",
        href: "/line-art-to-svg-converter",
        keywords: ["line art", "outline", "trace", "coloring page"],
      },
      {
        label: "Drawing to SVG",
        href: "/drawing-to-svg-converter",
        keywords: ["drawing to svg", "hand drawn", "sketch", "trace"],
      },
      {
        label: "Scan to SVG",
        href: "/scan-to-svg-converter",
        keywords: ["scan to svg", "scanned image", "document", "trace"],
      },
      {
        label: "Sketch to SVG",
        href: "/sketch-to-svg-converter",
        keywords: ["sketch to svg", "pencil", "drawing", "trace"],
      },
      {
        label: "Image to SVG Outline",
        href: "/image-to-svg-outline",
        keywords: ["image outline", "outline svg", "line art", "trace"],
      },
      {
        label: "Photo to SVG Outline",
        href: "/photo-to-svg-outline",
        keywords: ["photo outline", "outline svg", "trace photo"],
      },
      {
        label: "B&W Image to SVG",
        href: "/black-and-white-image-to-svg-converter",
        keywords: ["black and white", "b&w", "bw", "stencil", "monochrome"],
      },
    ],
    [],
  );

  // Keep the bar compact. Searchable More still contains all routes.
  const primaryLinks = useMemo(() => {
    return items.filter((item) =>
      [
        "#other-tools",
        "/",
        "/cricut-svg-converter",
        "/svg-to-png-converter",
      ].includes(item.href),
    );
  }, [items]);

  const moreLinks = useMemo(() => items, [items]);

  const filteredDesktopMoreLinks = useMemo(
    () => filterNavItems(moreLinks, desktopSearch),
    [moreLinks, desktopSearch],
  );

  const filteredMobileLinks = useMemo(
    () => filterNavItems(items, mobileSearch),
    [items, mobileSearch],
  );

  const desktopNavGroups = useMemo(
    () => groupNavItems(filteredDesktopMoreLinks),
    [filteredDesktopMoreLinks],
  );

  const mobileNavGroups = useMemo(
    () => groupNavItems(filteredMobileLinks),
    [filteredMobileLinks],
  );

  const closeAll = () => {
    setMobileOpen(false);
    setMoreOpen(false);
  };

  function handleNavClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (href.startsWith("#")) {
      e.preventDefault();

      const targetId = href.slice(1);
      closeAll();

      window.setTimeout(() => {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          window.history.replaceState(null, "", href);
        }
      }, 0);

      return;
    }

    closeAll();
  }

  function updateMoreRect() {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const nextRect = {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    };
    setMoreRect((current) =>
      current &&
      current.top === nextRect.top &&
      current.left === nextRect.left &&
      current.width === nextRect.width &&
      current.height === nextRect.height
        ? current
        : nextRect,
    );
  }

  // Measure and keep dropdown positioned during scroll/resize
  useLayoutEffect(() => {
    if (!moreOpen) return;
    updateMoreRect();

    function onScrollOrResize() {
      updateMoreRect();
    }

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreOpen]);

  // Focus search when desktop menu opens
  useEffect(() => {
    if (!moreOpen) return;

    window.setTimeout(() => {
      desktopSearchRef.current?.focus();
    }, 0);
  }, [moreOpen]);

  // Focus mobile search when drawer opens
  useEffect(() => {
    if (!mobileOpen) return;

    window.setTimeout(() => {
      mobileSearchRef.current?.focus();
    }, 0);
  }, [mobileOpen]);

  // Close desktop dropdown on outside click + Escape
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!moreOpen) return;
      const t = e.target as Node | null;
      if (!t) return;

      const btn = moreBtnRef.current;
      const menu = moreMenuRef.current;

      if (btn?.contains(t) || menu?.contains(t)) return;
      setMoreOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  // Mobile body lock
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Keep desktop and mobile menu state mutually exclusive across resizes.
  useEffect(() => {
    if (!isClient) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const syncMenuMode = () => {
      setIsMobileNavMode(media.matches);
      if (media.matches) {
        setMoreOpen(false);
      } else {
        setMobileOpen(false);
      }
    };

    syncMenuMode();
    media.addEventListener?.("change", syncMenuMode);
    return () => {
      media.removeEventListener?.("change", syncMenuMode);
    };
  }, [isClient]);

  // Mobile close on backdrop click
  useEffect(() => {
    if (!mobileOpen) return;

    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      const panel = mobilePanelRef.current;
      if (panel && panel.contains(t)) return;
      setMobileOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [mobileOpen]);

  // ATC-style dropdown placement (fixed, portal, right-aligned to button)
  const dropdownStyle = useMemo(() => {
    if (!moreRect) return undefined;

    const gap = 8;
    const top = Math.round(moreRect.top + moreRect.height + gap);

    const viewportWidth =
      typeof window === "undefined" ? 1180 : window.innerWidth;
    const preferredWidth =
      viewportWidth >= 1536 ? 1120 : viewportWidth >= 1180 ? 960 : viewportWidth >= 768 ? 720 : 380;
    const menuWidth = Math.max(320, Math.min(viewportWidth - 24, preferredWidth));
    const rightEdge = Math.round(moreRect.left + moreRect.width);
    const left = Math.min(
      Math.max(8, rightEdge - menuWidth),
      Math.max(8, viewportWidth - menuWidth - 8),
    );

    return {
      position: "fixed" as const,
      top,
      left,
      width: menuWidth,
      zIndex: 2147483647,
    };
  }, [moreRect]);

  return (
    <header className="block top-0 z-50 bg-sky-950 text-slate-200 border-b border-sky-900/60 shadow-sm">
      {/* Scoped scrollbar styles only for menu containers */}
      <style>{`
        .${SCROLL_CLASS} {
          scrollbar-width: thin;
          scrollbar-color: rgba(125,211,252,.65) rgba(8,47,73,1);
          scrollbar-gutter: stable both-edges;
          overscroll-behavior: contain;
        }
        .${SCROLL_CLASS}::-webkit-scrollbar { width: 10px; }
        .${SCROLL_CLASS}::-webkit-scrollbar-track { background: rgba(8,47,73,1); }
        .${SCROLL_CLASS}::-webkit-scrollbar-thumb {
          background-color: rgba(125,211,252,.55);
          border-radius: 10px;
          border: 2px solid rgba(8,47,73,1);
        }
        .${SCROLL_CLASS}::-webkit-scrollbar-thumb:hover { background-color: rgba(125,211,252,.75); }
        .${SCROLL_CLASS}::-webkit-scrollbar-corner { background: rgba(8,47,73,1); }
      `}</style>

      <div className="max-w-[1180px] mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Logo */}
          <a
            href="/"
            className="group flex items-center gap-3 cursor-pointer select-none"
            onClick={closeAll}
            aria-label="iLoveSVG home"
          >
            <div className="text-left leading-tight">
              <div className="text-base sm:text-lg font-extrabold tracking-tight text-white group-hover:text-sky-200 transition-colors">
                i<span className="text-sky-300">🩵</span>SVG
              </div>
              <div className="text-xs text-sky-200/80 font-semibold">
                Fast, clean SVG utilities
              </div>
            </div>
          </a>

          {/* Mobile burger */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center rounded-md px-3 py-2
                       text-slate-200 hover:text-sky-200 hover:bg-sky-900/25 transition-colors
                       cursor-pointer"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => {
              setMobileOpen(true);
              setMoreOpen(false);
            }}
          >
            <IconMenu />
          </button>

          {/* Desktop nav */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-2 text-sm"
          >
            {primaryLinks.map((l) => (
              <DesktopLink
                key={l.href}
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
              >
                {l.label}
              </DesktopLink>
            ))}

            {moreLinks.length > 0 && (
              <button
                ref={moreBtnRef}
                type="button"
                className="font-semibold rounded-md px-2 py-2 inline-flex items-center gap-2
                           hover:text-sky-200 hover:bg-sky-900/25 transition-colors cursor-pointer"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => {
                  if (!moreOpen) updateMoreRect();
                  setMoreOpen((v) => !v);
                }}
              >
                More <IconChevronDown />
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Desktop dropdown in portal */}
      {isClient && !isMobileNavMode && moreOpen && dropdownStyle
        ? createPortal(
            <div
              ref={moreMenuRef}
              role="menu"
              className="rounded-2xl border border-sky-900/60 bg-sky-950 shadow-xl overflow-hidden"
              style={dropdownStyle}
            >
              <div className="shrink-0 border-b border-sky-900/60 bg-sky-950/95 p-3">
                <label className="sr-only" htmlFor="desktop-tool-search">
                  Search tools
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sky-200/70">
                    <IconSearch />
                  </span>
                  <input
                    id="desktop-tool-search"
                    ref={desktopSearchRef}
                    value={desktopSearch}
                    onChange={(e) => setDesktopSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDesktopSearch("");
                        setMoreOpen(false);
                      }
                    }}
                    placeholder="Search all tools..."
                    className="w-full rounded-lg border border-sky-800/80 bg-sky-900/45 py-2 pl-10 pr-9 text-sm font-semibold text-white
                               placeholder:text-sky-200/60 outline-none transition-colors
                               focus:border-sky-400 focus:bg-sky-900/70 focus:ring-2 focus:ring-sky-400/25"
                  />
                  {desktopSearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopSearch("");
                        desktopSearchRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1
                                 text-sky-200 hover:bg-sky-800/70 hover:text-white transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <IconXSmall />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 text-xs font-semibold text-sky-200/75">
                  {filteredDesktopMoreLinks.length === 1
                    ? "1 tool"
                    : `${filteredDesktopMoreLinks.length} tools`}
                </div>
              </div>

              <div
                className={`${SCROLL_CLASS} max-h-[min(72vh,680px)] overflow-y-auto`}
              >
                {filteredDesktopMoreLinks.length > 0 ? (
                  <div className="grid items-start gap-3 p-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {desktopNavGroups.map((group) => (
                      <DesktopNavGroup
                        key={group.category.id}
                        group={group}
                        onNavClick={handleNavClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-sm font-semibold text-sky-100/80">
                    No matching tools found.
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Mobile drawer */}
      {isMobileNavMode && mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[2147483647]">
          <div className="absolute inset-0 bg-black/55" />

          <div
            ref={mobilePanelRef}
            className="absolute inset-y-0 right-0 w-[92vw] max-w-sm
                       bg-sky-950 border-l border-sky-900/60 shadow-2xl
                       flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="shrink-0 bg-sky-950/95 backdrop-blur border-b border-sky-900/60">
              <div className="flex items-center justify-between px-4 py-3">
                <a
                  href="/"
                  className="flex items-center gap-3 cursor-pointer select-none"
                  onClick={closeAll}
                  aria-label="iLoveSVG home"
                >
                  <div className="leading-tight">
                    <div className="text-sm font-extrabold text-white">
                      i<span className="text-sky-300">🩵</span>SVG
                    </div>
                    <div className="text-xs text-sky-200/80 font-semibold">
                      SVG tools and converters
                    </div>
                  </div>
                </a>

                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-slate-200
                             hover:text-sky-200 hover:bg-sky-900/25 transition-colors
                             cursor-pointer"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <IconX />
                </button>
              </div>

              <div className="px-4 pb-3">
                <label className="sr-only" htmlFor="mobile-tool-search">
                  Search tools
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sky-200/70">
                    <IconSearch />
                  </span>
                  <input
                    id="mobile-tool-search"
                    ref={mobileSearchRef}
                    value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                    placeholder="Search all tools..."
                    className="w-full rounded-lg border border-sky-800/80 bg-sky-900/45 py-2.5 pl-10 pr-9 text-sm font-semibold text-white
                               placeholder:text-sky-200/60 outline-none transition-colors
                               focus:border-sky-400 focus:bg-sky-900/70 focus:ring-2 focus:ring-sky-400/25"
                  />
                  {mobileSearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSearch("");
                        mobileSearchRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1
                                 text-sky-200 hover:bg-sky-800/70 hover:text-white transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <IconXSmall />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 text-xs font-semibold text-sky-200/75">
                  {filteredMobileLinks.length === 1
                    ? "1 tool"
                    : `${filteredMobileLinks.length} tools`}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <div className={`${SCROLL_CLASS} h-full overflow-y-auto`}>
                {filteredMobileLinks.length > 0 ? (
                  <div className="grid gap-2 p-3">
                    {mobileNavGroups.map((group, index) => (
                      <MobileNavGroup
                        key={group.category.id}
                        group={group}
                        forceOpen={Boolean(mobileSearch)}
                        defaultOpen={index < 2}
                        onNavClick={handleNavClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-sm font-semibold text-sky-100/80">
                    No matching tools found.
                  </div>
                )}
                <div className="h-[env(safe-area-inset-bottom)]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterNavItems(items: NavItem[], query: string) {
  const q = normalizeSearchText(query);
  if (!q) return items;

  const tokens = q.split(" ").filter(Boolean);

  return items.filter((item) => {
    const haystack = normalizeSearchText(
      [item.label, item.href, ...(item.keywords ?? [])].join(" "),
    );

    return tokens.every((token) => haystack.includes(token));
  });
}

function getNavCategoryId(item: NavItem): NavCategoryId {
  const target = `${item.href} ${item.label} ${(item.keywords ?? []).join(" ")}`;

  if (/svg-to-(png|jpg|jpeg|webp|pdf)|favicon/i.test(target)) {
    return "svg-export";
  }

  if (/layered/i.test(target)) {
    return "layered";
  }

  if (
    /cricut|silhouette|laser|vinyl|etsy|print then cut|print-then-cut|stickers|cut file/i.test(
      target,
    )
  ) {
    return "cricut";
  }

  if (/line art|line-art|outline|drawing|scan|sketch|black and white|black-and-white|b&w|bw/i.test(target)) {
    return "line-art";
  }

  if (/logo|icon|emoji|text to svg|text-to-svg|favicon/i.test(target)) {
    return "logo-icon";
  }

  if (/png-to-svg|jpg-to-svg|jpeg-to-svg|webp-to-svg|image to svg|image-to-svg/i.test(target)) {
    return item.href === "/" ? "general" : "file-types";
  }

  if (/base64|color picker/i.test(target)) {
    return "file-types";
  }

  if (
    /recolor|background|resize|scale|minifier|cleaner|preview|embed|inline|stroke width|flip|rotate|dimensions|file size|accessibility|contrast/i.test(
      target,
    )
  ) {
    return "svg-tools";
  }

  return item.href === "/" ? "general" : "more";
}

function groupNavItems(items: NavItem[]): NavGroup[] {
  const grouped = new Map<NavCategoryId, NavItem[]>();

  for (const category of NAV_CATEGORIES) {
    grouped.set(category.id, []);
  }

  for (const item of items) {
    const categoryId = getNavCategoryId(item);
    grouped.get(categoryId)?.push(item);
  }

  return NAV_CATEGORIES.map((category) => ({
    category,
    items: grouped.get(category.id) ?? [],
  })).filter((group) => group.items.length > 0);
}

function DesktopLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="cursor-pointer select-none rounded-md px-3 py-2 text-sm font-semibold
                 text-slate-200 hover:text-sky-200 hover:bg-sky-900/25 transition-colors"
    >
      {children}
    </a>
  );
}

function DesktopNavGroup({
  group,
  onNavClick,
}: {
  group: NavGroup;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <section
      role="none"
      className="min-w-0 rounded-xl border border-sky-800/70 bg-sky-900/20 p-2"
    >
      <div className="px-2 pb-2">
        <h3 className="m-0 text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-200">
          {group.category.label}
        </h3>
        <p className="m-0 mt-1 text-[11px] leading-4 text-sky-100/65">
          {group.category.description}
        </p>
      </div>
      <div className="grid gap-1">
        {group.items.map((item) => (
          <DropdownLink
            key={item.href}
            href={item.href}
            onClick={(event) => onNavClick(event, item.href)}
          >
            {item.label}
          </DropdownLink>
        ))}
      </div>
    </section>
  );
}

function MobileNavGroup({
  group,
  forceOpen,
  defaultOpen,
  onNavClick,
}: {
  group: NavGroup;
  forceOpen: boolean;
  defaultOpen: boolean;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const detailsProps = forceOpen ? { open: true } : { defaultOpen };

  return (
    <details
      {...detailsProps}
      className="rounded-xl border border-sky-800/70 bg-sky-900/20"
    >
      <summary className="flex min-h-12 list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-slate-100 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>{group.category.label}</span>
        <span className="text-xs font-semibold text-sky-200/70">
          {group.items.length}
        </span>
      </summary>
      <div className="border-t border-sky-800/60 py-1">
        {group.items.map((item) => (
          <MobileLink
            key={item.href}
            href={item.href}
            onClick={(event) => onNavClick(event, item.href)}
          >
            {item.label}
          </MobileLink>
        ))}
      </div>
    </details>
  );
}

function DropdownLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      role="menuitem"
      className="block min-w-0 cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-semibold
                 text-slate-100 hover:bg-sky-800/65 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300/50 transition-colors"
    >
      {children}
    </a>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="block cursor-pointer select-none px-4 py-3 text-sm font-semibold
                 text-slate-100 hover:bg-sky-800/55 hover:text-sky-200 transition-colors"
    >
      {children}
    </a>
  );
}

function IconMenu() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconXSmall() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.5 18a7.5 7.5 0 1 1 5.303-12.803A7.5 7.5 0 0 1 10.5 18Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 16l4.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
