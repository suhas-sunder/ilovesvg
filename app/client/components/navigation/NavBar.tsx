import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  PRIMARY_NAV_ITEMS,
  TOOL_NAV_ITEMS,
  TOOL_NAV_SECTIONS,
  type ToolNavItem,
  type ToolNavSection,
} from "./toolNavSections";

type NavItem = ToolNavItem;
type NavGroup = ToolNavSection;

type Rect = { top: number; left: number; width: number; height: number };

const PRO_WAITLIST_PATH = "/pro-waitlist";

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

  const items = TOOL_NAV_ITEMS;

  // Keep the bar compact. Searchable More still contains all route groups.
  const primaryLinks = useMemo(() => {
    return PRIMARY_NAV_ITEMS;
  }, []);

  const moreLinks = items;

  const filteredDesktopMoreLinks = useMemo(
    () => filterNavItems(moreLinks, desktopSearch),
    [moreLinks, desktopSearch],
  );

  const filteredMobileLinks = useMemo(
    () => filterNavItems(items, mobileSearch),
    [items, mobileSearch],
  );

  const filteredDesktopNavSections = useMemo(
    () => filterNavSections(TOOL_NAV_SECTIONS, desktopSearch),
    [desktopSearch],
  );

  const filteredMobileNavSections = useMemo(
    () => filterNavSections(TOOL_NAV_SECTIONS, mobileSearch),
    [mobileSearch],
  );

  const desktopNavGroups = useMemo(
    () => filteredDesktopNavSections,
    [filteredDesktopNavSections],
  );

  const mobileNavGroups = useMemo(
    () => filteredMobileNavSections,
    [filteredMobileNavSections],
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

            <DesktopProLink href={PRO_WAITLIST_PATH} onClick={closeAll} />
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
                        key={group.id}
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
                <MobileProLink href={PRO_WAITLIST_PATH} onClick={closeAll} />

                <label className="sr-only" htmlFor="mobile-tool-search">
                  Search tools
                </label>
                <div className="relative mt-3">
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
                        key={group.id}
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

function filterNavSections(
  sections: ToolNavSection[],
  query: string,
): ToolNavSection[] {
  const q = normalizeSearchText(query);
  if (!q) return sections;

  return sections
    .map((section) => {
      const matchingItems = filterNavItems(section.items, q);

      return {
        ...section,
        items: matchingItems,
      };
    })
    .filter((section) => section.items.length > 0);
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

function DesktopProLink({
  href,
  onClick,
}: {
  href: string;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="ml-1 inline-flex min-h-10 cursor-pointer select-none items-center justify-center rounded-full border border-sky-200/80 bg-sky-200 px-4 py-2 text-sm font-extrabold text-sky-950 shadow-sm transition-colors hover:border-white hover:bg-white hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-950"
    >
      Go Pro
    </a>
  );
}

function MobileProLink({
  href,
  onClick,
}: {
  href: string;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-sky-300/70 bg-sky-200 px-4 py-3 text-sm font-extrabold text-sky-950 shadow-sm transition-colors hover:border-white hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-950"
    >
      <span>Go Pro</span>
      <span className="text-xs font-bold text-sky-800">Early access</span>
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
          {group.label}
        </h3>
        <p className="m-0 mt-1 text-[11px] leading-4 text-sky-100/65">
          {group.description}
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
        <span>{group.label}</span>
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
