import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type NavItem = { label: string; href: string };

type Rect = { top: number; left: number; width: number; height: number };

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

export default function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop "More" dropdown
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreRect, setMoreRect] = useState<Rect | null>(null);

  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const isClient = useIsClient();

  const SCROLL_CLASS = "ilovesvg-scroll";

  const items: NavItem[] = useMemo(
    () => [
      // Anchor
      { label: "All Tools", href: "/#other-tools" },

      // Common converters
      { label: "SVG to PNG", href: "/svg-to-png-converter" },
      { label: "SVG to JPG", href: "/svg-to-jpg-converter" },
      { label: "SVG to WebP", href: "/svg-to-webp-converter" },
      { label: "SVG to PDF", href: "/svg-to-pdf-converter" },

      // Core editors
      { label: "Recolor", href: "/svg-recolor" },
      { label: "Resize / Scale", href: "/svg-resize-and-scale-editor" },
      { label: "Background", href: "/svg-background-editor" },
      { label: "Flip / Rotate", href: "/svg-flip-and-rotate-editor" },
      { label: "Stroke Width", href: "/svg-stroke-width-editor" },

      // Cleanup / utility
      { label: "Cleaner", href: "/svg-cleaner" },
      { label: "Minifier", href: "/svg-minifier" },
      { label: "Embed Code", href: "/svg-embed-code-generator" },
      { label: "Preview", href: "/svg-preview-viewer" },
      { label: "Dimensions Inspector", href: "/svg-dimensions-inspector" },
      { label: "File Size Inspector", href: "/svg-file-size-inspector" },
      {
        label: "Accessibility / Contrast",
        href: "/svg-accessibility-and-contrast-checker",
      },

      // Base64
      { label: "SVG to Base64", href: "/svg-to-base64" },
      { label: "Base64 to SVG", href: "/base64-to-svg" },

      // Favicons + reference
      { label: "SVG to Favicon", href: "/svg-to-favicon-generator" },
      { label: "Inline SVG vs Img", href: "/inline-svg-vs-img" },

      // Color tool
      { label: "Color Picker", href: "/free-color-picker" },

      // Raster -> SVG
      { label: "PNG to SVG", href: "/png-to-svg-converter" },
      { label: "JPG to SVG", href: "/jpg-to-svg-converter" },
      { label: "JPEG to SVG", href: "/jpeg-to-svg-converter" },
      { label: "WebP to SVG", href: "/webp-to-svg-converter" },
      { label: "Logo to SVG", href: "/logo-to-svg-converter" },
      { label: "Icon to SVG", href: "/icon-to-svg-converter" },
      { label: "Emoji to SVG", href: "/emoji-to-svg-converter" },
      { label: "Text to SVG", href: "/text-to-svg-converter" },
      { label: "Sticker to SVG", href: "/sticker-to-svg-converter" },
      { label: "Line Art to SVG", href: "/line-art-to-svg-converter" },
      { label: "Drawing to SVG", href: "/drawing-to-svg-converter" },
      { label: "Scan to SVG", href: "/scan-to-svg-converter" },
      { label: "Sketch to SVG", href: "/sketch-to-svg-converter" },
      { label: "Image to SVG Outline", href: "/image-to-svg-outline" },
      { label: "Photo to SVG Outline", href: "/photo-to-svg-outline" },
      {
        label: "B&W Image to SVG",
        href: "/black-and-white-image-to-svg-converter",
      },
    ],
    [],
  );

  // Put first 4 on the bar, rest in More
  const primaryLinks = useMemo(() => items.slice(0, 4), [items]);
  const moreLinks = useMemo(() => items.slice(4), [items]);

  const closeAll = () => {
    setMobileOpen(false);
    setMoreOpen(false);
  };

  function updateMoreRect() {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setMoreRect({ top: r.top, left: r.left, width: r.width, height: r.height });
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

    const menuWidth = 320;
    const rightEdge = Math.round(moreRect.left + moreRect.width);
    const left = Math.max(8, rightEdge - menuWidth);

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
            className="sm:hidden inline-flex items-center justify-center rounded-md px-3 py-2
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
            className="hidden sm:flex items-center gap-2 text-sm"
          >
            {primaryLinks.map((l) => (
              <DesktopLink key={l.href} href={l.href} onClick={closeAll}>
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
      {isClient && moreOpen && dropdownStyle
        ? createPortal(
            <div
              ref={moreMenuRef}
              role="menu"
              className="rounded-xl border border-sky-900/60 bg-sky-950 shadow-xl overflow-hidden"
              style={dropdownStyle}
            >
              <div
                className={`${SCROLL_CLASS} max-h-[min(60vh,520px)] overflow-y-auto`}
              >
                {moreLinks.map((l) => (
                  <DropdownLink key={l.href} href={l.href} onClick={closeAll}>
                    {l.label}
                  </DropdownLink>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-[2147483647]">
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
            </div>

            <div className="flex-1 min-h-0">
              <div className={`${SCROLL_CLASS} h-full overflow-y-auto`}>
                {items.map((l) => (
                  <MobileLink key={l.href} href={l.href} onClick={closeAll}>
                    {l.label}
                  </MobileLink>
                ))}
                <div className="h-[env(safe-area-inset-bottom)]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function DesktopLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
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

function DropdownLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      role="menuitem"
      className="block cursor-pointer select-none px-5 py-4 text-base
                 text-slate-100 hover:bg-sky-900/25 hover:text-sky-200 transition-colors"
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
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="block cursor-pointer select-none px-5 py-4 text-base font-semibold
                 text-slate-100 hover:bg-sky-900/25 hover:text-sky-200 transition-colors"
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
