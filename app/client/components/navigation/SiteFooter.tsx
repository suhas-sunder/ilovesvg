import { Link } from "react-router";

export default function SiteFooter() {
  const linkClass =
    "cursor-pointer text-sky-200/85 hover:text-white hover:underline underline-offset-4 transition-colors";
  const sepClass = "text-sky-200/25 select-none";

  return (
    <footer className="bg-sky-950 border-t border-sky-900/60 text-white">
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-sky-200/80">
            <span>© {new Date().getFullYear()} i🩵SVG</span>
            <span className="mx-2 text-sky-200/30">•</span>
            <span className="text-sky-200/60">
              Simple SVG tools, no accounts.
            </span>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <li>
                <Link to="/" className={linkClass}>
                  Home
                </Link>
              </li>

              <li className={sepClass} aria-hidden="true">
                |
              </li>

              <li>
                <Link to="/privacy-policy" className={linkClass}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className={linkClass}>
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/cookies" className={linkClass}>
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
