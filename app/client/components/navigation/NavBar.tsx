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
const DEFAULT_MOBILE_PREVIEW_LIMIT = 10;
const MOBILE_PREVIEW_LIMITS: Record<string, number> = {
  "craft-cut-files": 12,
  "svg-export": 10,
  "svg-editing": 10,
};
const PRIMARY_NAV_VISIBILITY_CLASS_NAMES: Record<string, string> = {
  "/svg-to-png-converter": "inline-flex",
  "/png-to-svg-converter": "inline-flex",
  "/svg-to-jpg-converter": "hidden xl:inline-flex",
  "/jpg-to-svg-converter": "hidden xl:inline-flex",
  "/svg-to-pdf-converter": "hidden min-[1536px]:inline-flex",
};

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
  const [viewportSize, setViewportSize] = useState({
    width: 1180,
    height: 720,
  });

  // Search
  const [desktopSearch, setDesktopSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<
    Record<string, boolean>
  >({});

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
  const isDesktopSearching = normalizeSearchText(desktopSearch).length > 0;
  const isMobileSearching = normalizeSearchText(mobileSearch).length > 0;

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

  function toggleMobileGroup(groupId: string) {
    setExpandedMobileGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

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
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
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

  useEffect(() => {
    if (!isClient) return;

    function updateViewportSize() {
      setViewportSize((current) => {
        const next = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        return current.width === next.width && current.height === next.height
          ? current
          : next;
      });
    }

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
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
    const viewportHeight =
      typeof window === "undefined" ? 720 : window.innerHeight;
    const preferredWidth =
      viewportWidth >= 1840
        ? 1680
        : viewportWidth >= 1536
          ? 1440
          : viewportWidth >= 1280
            ? 1240
            : viewportWidth >= 1024
              ? 992
              : viewportWidth >= 768
                ? 720
                : 380;
    const menuWidth = Math.max(
      320,
      Math.min(viewportWidth - 32, preferredWidth),
    );
    const left = Math.round(
      Math.max(
        16,
        Math.min((viewportWidth - menuWidth) / 2, viewportWidth - menuWidth - 16),
      ),
    );
    const safeBottom = 16;
    const maxHeight = `calc(100vh - ${Math.min(
      viewportHeight - safeBottom,
      top + safeBottom,
    )}px)`;

    return {
      position: "fixed" as const,
      top,
      left,
      width: menuWidth,
      maxHeight,
      zIndex: 2147483647,
    };
  }, [moreRect]);

  const desktopMoreGridStyle = useMemo(() => {
    const columnCount =
      viewportSize.width >= 1840 ? 6 : viewportSize.width >= 1536 ? 5 : 4;
    return {
      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    };
  }, [viewportSize.width]);

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
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Logo */}
          <a
            href="/"
            className="group flex shrink-0 items-center gap-3 cursor-pointer select-none"
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
            className="hidden min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap text-sm lg:flex"
          >
            {primaryLinks.map((l) => (
              <DesktopLink
                key={l.href}
                href={l.href}
                className={getPrimaryLinkVisibilityClassName(l.href)}
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
              data-nav-menu="desktop-more"
              className="flex min-h-0 flex-col rounded-2xl border border-sky-900/60 bg-sky-950 shadow-xl overflow-hidden"
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
                className={`${SCROLL_CLASS} min-h-0 flex-1 overflow-y-auto`}
              >
                {filteredDesktopMoreLinks.length > 0 ? (
                  isDesktopSearching ? (
                    <DesktopSearchResults
                      items={filteredDesktopMoreLinks}
                      gridStyle={desktopMoreGridStyle}
                      onNavClick={handleNavClick}
                    />
                  ) : (
                    <div
                      className="grid auto-rows-max items-start gap-3 p-3"
                      style={desktopMoreGridStyle}
                    >
                      {desktopNavGroups.map((group) => (
                        <DesktopNavGroup
                          key={group.id}
                          group={group}
                          onNavClick={handleNavClick}
                        />
                      ))}
                    </div>
                  )
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
            className="absolute inset-y-0 right-0 w-full max-w-[46rem] sm:w-[94vw] md:w-[82vw]
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
                  <div
                    data-nav-menu="mobile-tools"
                    className="grid gap-3 p-3 sm:p-4"
                  >
                    {isMobileSearching ? (
                      <MobileSearchResults
                        items={filteredMobileLinks}
                        onNavClick={handleNavClick}
                      />
                    ) : (
                      mobileNavGroups.map((group) => (
                        <MobileNavGroup
                          key={group.id}
                          group={group}
                          expanded={Boolean(expandedMobileGroups[group.id])}
                          onToggleExpanded={() => toggleMobileGroup(group.id)}
                          onNavClick={handleNavClick}
                        />
                      ))
                    )}
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
    .replace(/\b(?:two|too|2)\b/g, " to ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterNavItems(items: NavItem[], query: string) {
  const q = normalizeSearchText(query);
  if (!q) return items;

  return rankNavItems(items, q).map((result) => result.item);
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

function rankNavItems(items: NavItem[], normalizedQuery: string) {
  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreNavItem(item, normalizedQuery),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function scoreNavItem(item: NavItem, normalizedQuery: string) {
  const label = normalizeSearchText(item.label);
  const keywords = (item.keywords ?? []).map(normalizeSearchText);
  const slug = normalizeSearchText(
    item.href.replace(/^\/+/, "").replace(/-/g, " "),
  );
  const phrases = [label, ...keywords, slug].filter(Boolean);
  const haystack = phrases.join(" ");
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const directional = hasDirectionalSearchIntent(normalizedQuery);

  if (directional) {
    if (phrases.some((phrase) => phrase === normalizedQuery)) return 1000;
    if (phrases.some((phrase) => phrase.startsWith(`${normalizedQuery} `))) return 920;
    if (phrases.some((phrase) => hasWordPhrase(phrase, normalizedQuery))) return 780;
    return 0;
  }

  if (phrases.some((phrase) => phrase === normalizedQuery)) return 980;
  if (phrases.some((phrase) => phrase.startsWith(`${normalizedQuery} `))) return 900;
  if (phrases.some((phrase) => hasWordPhrase(phrase, normalizedQuery))) return 820;
  if (tokens.every((token) => hasWordPrefix(haystack, token))) return 650;
  if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) return 420;
  if (tokens.length === 1 && haystack.includes(tokens[0])) return 360;

  return 0;
}

function hasDirectionalSearchIntent(normalizedQuery: string) {
  return (
    normalizedQuery.includes(" to ") ||
    normalizedQuery.endsWith(" to") ||
    normalizedQuery.startsWith("to ")
  );
}

function hasWordPhrase(value: string, phrase: string) {
  return new RegExp(`(^|\\s)${escapeRegExp(phrase)}(\\s|$)`).test(value);
}

function hasWordPrefix(value: string, token: string) {
  return new RegExp(`(^|\\s)${escapeRegExp(token)}`).test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPrimaryLinkVisibilityClassName(href: string) {
  return PRIMARY_NAV_VISIBILITY_CLASS_NAMES[href] ?? "inline-flex";
}

function DesktopLink({
  href,
  children,
  className = "inline-flex",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`${className} cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm font-semibold
                 text-slate-200 transition-colors hover:bg-sky-900/25 hover:text-sky-200`}
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
  const isLargeGroup = group.items.length >= 18;

  return (
    <section
      role="none"
      data-nav-section={group.id}
      className={`min-w-0 rounded-xl border border-sky-800/70 bg-sky-900/20 p-2 ${
        isLargeGroup ? "lg:col-span-2" : ""
      }`}
    >
      <div className="px-2 pb-2">
        <h3 className="m-0 text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-200">
          {group.label}
        </h3>
        <p className="m-0 mt-1 text-[11px] leading-4 text-sky-100/65">
          {group.description}
        </p>
      </div>
      <div className={`grid gap-1 ${isLargeGroup ? "sm:grid-cols-2" : ""}`}>
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

function DesktopSearchResults({
  items,
  gridStyle,
  onNavClick,
}: {
  items: NavItem[];
  gridStyle: React.CSSProperties;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <div
      data-nav-search-results=""
      className="grid auto-rows-max items-start gap-1 p-3"
      style={gridStyle}
    >
      {items.map((item) => (
        <DropdownLink
          key={item.href}
          href={item.href}
          onClick={(event) => onNavClick(event, item.href)}
        >
          {item.label}
        </DropdownLink>
      ))}
    </div>
  );
}

function MobileSearchResults({
  items,
  onNavClick,
}: {
  items: NavItem[];
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <section
      data-nav-search-results=""
      className="rounded-xl border border-sky-800/70 bg-sky-900/20 p-3"
    >
      <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 md:grid-cols-3">
        {items.map((item) => (
          <MobileLink
            key={item.href}
            href={item.href}
            onClick={(event) => onNavClick(event, item.href)}
          >
            {item.label}
          </MobileLink>
        ))}
      </div>
    </section>
  );
}

function MobileNavGroup({
  group,
  expanded,
  onToggleExpanded,
  onNavClick,
}: {
  group: NavGroup;
  expanded: boolean;
  onToggleExpanded: () => void;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const previewLimit =
    group.id === "most-popular"
      ? group.items.length
      : MOBILE_PREVIEW_LIMITS[group.id] ?? DEFAULT_MOBILE_PREVIEW_LIMIT;
  const visibleItems = expanded
    ? group.items
    : group.items.slice(0, previewLimit);
  const hiddenCount = group.items.length - visibleItems.length;
  const gridClass =
    group.id === "most-popular"
      ? "grid-cols-1 min-[360px]:grid-cols-2"
      : "grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-3";

  return (
    <section
      data-nav-section={group.id}
      className="rounded-xl border border-sky-800/70 bg-sky-900/20 p-3"
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-2">
        <div className="min-w-0">
          <h3 className="m-0 text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-200">
            {group.label}
          </h3>
          <p className="m-0 mt-1 text-[11px] leading-4 text-sky-100/65">
            {group.description}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-sky-800/70 bg-sky-950/55 px-2 py-1 text-xs font-semibold text-sky-200/75">
          {group.items.length}
        </span>
      </div>
      <div className={`grid gap-2 ${gridClass}`}>
        {visibleItems.map((item) => (
          <MobileLink
            key={item.href}
            href={item.href}
            onClick={(event) => onNavClick(event, item.href)}
          >
            {item.label}
          </MobileLink>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-sky-800/70 bg-sky-950/45 px-3 py-2 text-sm font-extrabold text-sky-100 transition-colors hover:border-sky-500/70 hover:bg-sky-800/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
        >
          Show {hiddenCount} more
        </button>
      ) : null}
    </section>
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
      data-nav-link=""
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
      data-nav-link=""
      className="flex min-h-11 cursor-pointer select-none items-center rounded-lg border border-sky-800/60 bg-sky-950/35 px-3 py-2 text-sm font-semibold leading-snug
                 text-slate-100 transition-colors hover:border-sky-500/65 hover:bg-sky-800/60 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
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
