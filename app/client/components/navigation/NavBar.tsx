import { useEffect, useRef, useState } from "react";

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={wrapRef} className="sticky top-0 z-50">
      {/* Bar */}
      <div className="bg-white/80 backdrop-blur border-b border-slate-200 text-2xl">
        <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
          {/* Logo (unchanged) */}
          <a href="/" className="font-extrabold tracking-tight text-slate-900">
            i<span className="text-sky-600">🩵</span>SVG
          </a>

          {/* Desktop nav (unchanged) */}
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-4 text-[14px] font-semibold">
              <NavLink href="/#other-tools">All Tools</NavLink>
              <NavLink href="/svg-recolor">Recolor</NavLink>
              <NavLink href="/svg-resize-and-scale-editor">
                Resize/Scale
              </NavLink>
              <NavLink href="/svg-to-png-converter">SVG to PNG</NavLink>
              <NavLink href="/svg-to-jpg-converter">SVG to JPG</NavLink>
              <NavLink href="/svg-to-webp-converter">SVG to WEBP</NavLink>
            </ul>
          </nav>

          {/* Mobile button, styled like your UI */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/70 backdrop-blur px-3 py-2 shadow-sm text-slate-900 hover:bg-white transition-colors"
          >
            <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel: full-width, normal mobile feel */}
      <div
        className={[
          "md:hidden overflow-hidden border-b border-slate-200 bg-white/90 backdrop-blur",
          "transition-[max-height,opacity] duration-200",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="max-w-[1180px] mx-auto px-4 py-3">
          <nav aria-label="Primary mobile">
            <ul className="grid gap-1 text-[14px] font-semibold">
              <MobileLink href="/#other-tools" onClick={() => setOpen(false)}>
                All Tools
              </MobileLink>
              <MobileLink href="/svg-recolor" onClick={() => setOpen(false)}>
                Recolor
              </MobileLink>
              <MobileLink
                href="/svg-resize-and-scale-editor"
                onClick={() => setOpen(false)}
              >
                Resize/Scale
              </MobileLink>
              <MobileLink
                href="/svg-to-png-converter"
                onClick={() => setOpen(false)}
              >
                SVG to PNG
              </MobileLink>
              <MobileLink
                href="/svg-to-jpg-converter"
                onClick={() => setOpen(false)}
              >
                SVG to JPG
              </MobileLink>
              <MobileLink
                href="/svg-to-webp-converter"
                onClick={() => setOpen(false)}
              >
                SVG to WEBP
              </MobileLink>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        className="text-slate-700 hover:text-slate-900 transition-colors"
      >
        {children}
      </a>
    </li>
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
    <li>
      <a
        href={href}
        onClick={onClick}
        className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm hover:text-slate-900 hover:bg-white transition-colors"
      >
        {children}
      </a>
    </li>
  );
}
