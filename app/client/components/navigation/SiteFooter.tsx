import { Link } from "react-router";

export default function SiteFooter() {
  const linkClass =
    "cursor-pointer inline-flex min-h-8 items-center rounded text-sky-200/90 hover:text-white hover:underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300";

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
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <li>
                <Link to="/" className={linkClass}>
                  Home
                </Link>
              </li>

              <li>
                <Link to="/how-it-works" className={linkClass}>
                  How it works
                </Link>
              </li>

              <li>
                <Link to="/pro-waitlist" className={linkClass}>
                  Pro Waitlist
                </Link>
              </li>

              <li>
                <Link to="/sitemap" className={linkClass}>
                  Sitemap
                </Link>
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

        <p className="mt-5 max-w-[920px] text-xs leading-5 text-sky-200/75 text-center mx-auto">
          Privacy: Uploaded files are used for conversion, processed in memory
          during the request, and not intentionally stored after processing.
        </p>
      </div>
    </footer>
  );
}
