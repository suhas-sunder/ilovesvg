import { useLocation } from "react-router";

type AffiliateProvider = "cricut" | "printify" | "stickerMule" | "namecheap";

type AffiliatePlacement = {
  provider: AffiliateProvider;
  eyebrow: string;
  heading: string;
  body: string;
  cta: string;
  href: string;
  borderClass: string;
  eyebrowClass: string;
  headingClass: string;
  buttonClass: string;
  surfaceClass: string;
  maxWidthClass: string;
  benefits?: string[];
  image?: {
    src: string;
    alt: string;
    width: number;
    height: number;
    wrapperClass: string;
    className: string;
  };
};

const CRICUT_URL = "";
const ENABLE_CRICUT_AFFILIATE = Boolean(CRICUT_URL);

const PRINTIFY_URL =
  "https://try.printify.com/ilovesvg?utm_source=ilovesvg&utm_medium=affiliate&utm_campaign=printify_pod";

const STICKER_MULE_URL =
  "https://www.stickermule.com/ca/unlock?ref_id=1974725801&utm_medium=embed&utm_source=invite&utm_content=728x90";

const NAMECHEAP_URL =
  "https://namecheap.pxf.io/c/7235182/738167/5618?utm_source=ilovesvg&utm_medium=affiliate&utm_campaign=domain_hosting_bundle";

const PRINTIFY_IMAGE = {
  src: "https://assets.ilovesvg.com/printify-items.jpg",
  alt: "Printify product examples for SVG designs including T-shirts, mugs, and tote bags",
  width: 2172,
  height: 724,
  wrapperClass:
    "block border-t border-emerald-100 bg-emerald-50/80 transition-opacity hover:opacity-95",
  className: "h-auto w-full object-cover",
};

const STICKER_MULE_IMAGE = {
  src: "https://cdn.stickermule.com/content/core/assets/banners/stickermule-invite-friends-large.png",
  alt: "Sticker Mule custom sticker printing offer",
  width: 728,
  height: 90,
  wrapperClass:
    "block border-t border-orange-100 bg-orange-500 transition-opacity hover:opacity-95",
  className: "h-auto w-full object-cover",
};

const NAMECHEAP_IMAGE = {
  src: "https://assets.ilovesvg.com/namecheap.jpg",
  alt: "Namecheap domain and shared hosting offer banner for portfolios, storefronts, product pages, and small business websites",
  width: 2048,
  height: 683,
  wrapperClass:
    "block border-t border-purple-100 bg-purple-50/80 transition-opacity hover:opacity-95",
  className: "h-auto w-full object-cover",
};

const PRINTIFY_BENEFITS = [
  "Product mockups for SVG artwork",
  "Useful for merch testing",
  "Good fit for creator shops",
];

const CRICUT_BENEFITS = [
  "Works with Cricut projects",
  "Good for vinyl and stickers",
  "Useful after SVG cleanup",
];

const NAMECHEAP_BENEFITS = [
  "Domain and hosting options",
  "Useful for shops or portfolios",
  "Good fit for brand landing pages",
];

const NO_AFFILIATE_ROUTES = new Set([
  "/",
  "/cookies",
  "/privacy-policy",
  "/terms-of-service",

  "/svg-to-png-converter",
  "/svg-to-jpg-converter",
  "/svg-to-webp-converter",
  "/svg-to-pdf-converter",

  "/svg-background-editor",
  "/svg-resize-and-scale-editor",
  "/svg-recolor",
  "/svg-minifier",
  "/svg-cleaner",
  "/svg-preview-viewer",
  "/inline-svg-vs-img",
  "/svg-stroke-width-editor",
  "/svg-flip-and-rotate-editor",
  "/svg-dimensions-inspector",
  "/svg-file-size-inspector",
  "/svg-accessibility-and-contrast-checker",

  "/svg-to-base64",
  "/base64-to-svg",
  "/free-color-picker",

  "/icon-to-svg-converter",
  "/emoji-to-svg-converter",
  "/text-to-svg-converter",
  "/line-art-to-svg-converter",
  "/drawing-to-svg-converter",
  "/scan-to-svg-converter",
  "/sketch-to-svg-converter",
  "/image-to-svg-outline",
  "/photo-to-svg-outline",
  "/black-and-white-image-to-svg-converter",
]);

function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function hasAny(pathname: string, terms: string[]) {
  return terms.some((term) => pathname.includes(term));
}

function matchesCricut(pathname: string) {
  return hasAny(pathname, [
    "cricut",
    "print-then-cut",
    "svg-cut-file",
    "cut-file",
    "vinyl",
    "layered",
    "multicolor",
  ]);
}

function matchesPrintify(pathname: string) {
  return hasAny(pathname, [
    "print-on-demand",
    "t-shirt",
    "merch",
    "cricut",
    "vinyl",
    "layered",
    "multicolor",
    "crafters",
    "etsy",
    "digital-download",
  ]);
}

function matchesStickerMule(pathname: string) {
  return hasAny(pathname, [
    "sticker",
    "label",
    "decal",
    "print-then-cut",
    "black-square",
    "background-layer",
    "white-background",
  ]);
}

function matchesNamecheap(pathname: string) {
  return hasAny(pathname, [
    "etsy",
    "digital-download",
    "logo",
    "favicon",
    "embed-code",
    "svg-to-favicon",
  ]);
}

function basePlacement(provider: AffiliateProvider) {
  if (provider === "cricut") {
    return {
      href: CRICUT_URL,
      borderClass: "border-cyan-200",
      eyebrowClass: "text-cyan-700",
      headingClass: "text-sky-950",
      buttonClass: "bg-cyan-600 hover:bg-cyan-700",
      surfaceClass: "bg-gradient-to-br from-cyan-50 via-white to-sky-50",
      maxWidthClass: "max-w-[920px]",
      benefits: CRICUT_BENEFITS,
    };
  }

  if (provider === "printify") {
    return {
      href: PRINTIFY_URL,
      borderClass: "border-emerald-200",
      eyebrowClass: "text-emerald-700",
      headingClass: "text-sky-950",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
      surfaceClass: "bg-gradient-to-br from-emerald-50 via-white to-sky-50",
      maxWidthClass: "max-w-[920px]",
      benefits: PRINTIFY_BENEFITS,
      image: PRINTIFY_IMAGE,
    };
  }

  if (provider === "stickerMule") {
    return {
      href: STICKER_MULE_URL,
      borderClass: "border-orange-200",
      eyebrowClass: "text-orange-700",
      headingClass: "text-sky-950",
      buttonClass: "bg-orange-600 hover:bg-orange-700",
      surfaceClass: "bg-white",
      maxWidthClass: "max-w-[760px]",
      image: STICKER_MULE_IMAGE,
    };
  }

  return {
    href: NAMECHEAP_URL,
    borderClass: "border-purple-200",
    eyebrowClass: "text-purple-700",
    headingClass: "text-sky-950",
    buttonClass: "bg-purple-600 hover:bg-purple-700",
    surfaceClass: "bg-gradient-to-br from-purple-50 via-white to-sky-50",
    maxWidthClass: "max-w-[920px]",
    benefits: NAMECHEAP_BENEFITS,
    image: NAMECHEAP_IMAGE,
  };
}

function cricutPlacement(pathname: string): AffiliatePlacement {
  const base = basePlacement("cricut");

  if (pathname.includes("print-then-cut")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut project next step",
      heading: "Prepare this file for Cricut Print Then Cut",
      body: "Check size, print quality, and cut setup before making Cricut stickers, labels, or decals.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  if (pathname.includes("vinyl")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut vinyl next step",
      heading: "Use this SVG for a cleaner Cricut vinyl project",
      body: "Review line thickness, spacing, and final size before cutting vinyl decals, labels, or signs.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  if (pathname.includes("sticker")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut sticker next step",
      heading: "Check this design before making Cricut stickers",
      body: "Review the cut edge, transparent areas, and final size before sending it to Cricut Design Space.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  if (pathname.includes("layered") || pathname.includes("multicolor")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut layered SVG next step",
      heading: "Prepare this layered SVG for Cricut projects",
      body: "Check that the layers separate cleanly and import properly before cutting or assembling the design.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  return {
    provider: "cricut",
    eyebrow: "Cricut SVG next step",
    heading: "Use this file in your next Cricut project",
    body: "Check traced edges, background cleanup, and final size before importing the SVG into Cricut Design Space.",
    cta: "Continue with Cricut",
    ...base,
  };
}

function stickerMulePlacement(pathname: string): AffiliatePlacement {
  const base = basePlacement("stickerMule");

  if (
    pathname.includes("cricut-stickers") ||
    pathname.includes("for-stickers")
  ) {
    return {
      provider: "stickerMule",
      eyebrow: "Sticker printing next step",
      heading: "Ready to print your sticker design?",
      body: "Check final size, edge spacing, and transparent areas before ordering stickers, decals, or labels.",
      cta: "Check Sticker Mule offer",
      ...base,
    };
  }

  if (pathname.includes("print-then-cut")) {
    return {
      provider: "stickerMule",
      eyebrow: "Print then cut next step",
      heading: "Turning this design into printed stickers or labels?",
      body: "Make sure the artwork stays clear at print size and that the cut border has enough breathing room.",
      cta: "Check Sticker Mule offer",
      ...base,
    };
  }

  if (pathname.includes("logo")) {
    return {
      provider: "stickerMule",
      eyebrow: "Logo printing next step",
      heading: "Turn your logo into stickers or labels",
      body: "Check that the edges stay clean and the logo remains readable at small sizes.",
      cta: "Check Sticker Mule offer",
      ...base,
    };
  }

  if (pathname.includes("sticker")) {
    return {
      provider: "stickerMule",
      eyebrow: "Sticker artwork next step",
      heading: "Preparing sticker artwork for printing?",
      body: "Review the cut edge, transparent areas, and final size before printing.",
      cta: "Check Sticker Mule offer",
      ...base,
    };
  }

  return {
    provider: "stickerMule",
    eyebrow: "Design printing next step",
    heading: "Turning this design into stickers or labels?",
    body: "Inspect the edges, final size, and background before using it for physical prints.",
    cta: "Check Sticker Mule offer",
    ...base,
  };
}

function printifyPlacement(pathname: string): AffiliatePlacement {
  const base = basePlacement("printify");

  if (pathname.includes("print-on-demand")) {
    return {
      provider: "printify",
      eyebrow: "Printify print-on-demand next step",
      heading: "Test your SVG design on Printify products",
      body: "Preview your artwork on shirts, mugs, tote bags, stickers, and other merch before deciding what to sell.",
      cta: "Test it with Printify",
      ...base,
    };
  }

  if (pathname.includes("t-shirt")) {
    return {
      provider: "printify",
      eyebrow: "Printify T-shirt next step",
      heading: "Turn this SVG design into a Printify shirt mockup",
      body: "Check size, contrast, and background before publishing artwork on apparel.",
      cta: "Test it on Printify shirts",
      ...base,
    };
  }

  if (pathname.includes("merch")) {
    return {
      provider: "printify",
      eyebrow: "Printify merch next step",
      heading: "Preview this SVG on Printify merch products",
      body: "See how the artwork looks on shirts, mugs, tote bags, stickers, and other product mockups.",
      cta: "Preview it on Printify",
      ...base,
    };
  }

  if (pathname.includes("vinyl")) {
    return {
      provider: "printify",
      eyebrow: "Printify product next step",
      heading: "Use this clean SVG beyond vinyl projects",
      body: "Test simple designs on apparel, mugs, stickers, tote bags, and other merch products.",
      cta: "Test it with Printify",
      ...base,
    };
  }

  if (pathname.includes("layered") || pathname.includes("multicolor")) {
    return {
      provider: "printify",
      eyebrow: "Printify layered design next step",
      heading: "Test layered SVG artwork on Printify merch",
      body: "Check how layered or multicolor artwork looks at product size on apparel, mugs, tote bags, stickers, and merch.",
      cta: "Test layered artwork",
      ...base,
    };
  }

  if (pathname.includes("cricut")) {
    return {
      provider: "printify",
      eyebrow: "Printify product next step",
      heading: "Test this Cricut SVG on Printify products",
      body: "Preview the design on shirts, mugs, tote bags, stickers, and merch before publishing or ordering samples.",
      cta: "Test it with Printify",
      ...base,
    };
  }

  if (pathname.includes("etsy")) {
    return {
      provider: "printify",
      eyebrow: "Printify Etsy seller next step",
      heading: "Test this Etsy SVG design on Printify products",
      body: "Try product ideas and make sure the artwork fits the item you want to sell.",
      cta: "Test Etsy product ideas",
      ...base,
    };
  }

  return {
    provider: "printify",
    eyebrow: "Printify product next step",
    heading: "Preview this SVG design on Printify products",
    body: "Test the design on shirts, mugs, tote bags, stickers, and other merch before publishing or ordering samples.",
    cta: "Test it with Printify",
    ...base,
  };
}

function namecheapPlacement(pathname: string): AffiliatePlacement {
  const base = basePlacement("namecheap");

  if (pathname.includes("favicon")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap website next step",
      heading: "Give your brand assets a real home online",
      body: "Set up a simple website for your portfolio, storefront, or landing page.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  if (pathname.includes("embed")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap website next step",
      heading: "Put this SVG project on a real website",
      body: "Get a simple site online for demos, portfolios, product pages, or small business use.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  if (pathname.includes("etsy") || pathname.includes("digital-download")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap seller website next step",
      heading: "Build a simple home for your SVG shop",
      body: "A standalone site gives you a cleaner place to send customers beyond marketplace listings.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  if (pathname.includes("logo")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap branding next step",
      heading: "Have a logo? Secure a domain and site",
      body: "Set up a simple website for your portfolio, storefront, product page, or landing page.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  return {
    provider: "namecheap",
    eyebrow: "Namecheap website next step",
    heading: "Build a simple site for your design brand",
    body: "Set up a simple website for your SVG portfolio, product page, storefront, or small business landing page.",
    cta: "View Namecheap options",
    ...base,
  };
}

function getAffiliatePlacement(pathname: string): AffiliatePlacement | null {
  if (NO_AFFILIATE_ROUTES.has(pathname)) {
    return null;
  }

  if (ENABLE_CRICUT_AFFILIATE && matchesCricut(pathname)) {
    return cricutPlacement(pathname);
  }

  if (matchesStickerMule(pathname)) {
    return stickerMulePlacement(pathname);
  }

  if (matchesPrintify(pathname)) {
    return printifyPlacement(pathname);
  }

  if (matchesNamecheap(pathname)) {
    return namecheapPlacement(pathname);
  }

  return null;
}

function CricutVisual() {
  return (
    <div className="border-t border-cyan-100 bg-cyan-50/70 px-4 py-3 sm:px-5 sm:py-4">
      <div className="rounded-xl border border-cyan-100 bg-white p-3 shadow-sm sm:p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-700 sm:text-xs">
          Cricut project workflow
        </p>
        <p className="mt-1 text-lg font-black leading-tight text-sky-950 sm:text-2xl">
          Prepare cleaner SVG files for Cricut projects
        </p>
        <p className="mt-1 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">
          Useful for Cricut Design Space, vinyl, stickers, labels, decals, and
          layered cut files.
        </p>
      </div>
    </div>
  );
}

function AffiliateVisual({ placement }: { placement: AffiliatePlacement }) {
  if (placement.image) {
    return (
      <a
        href={placement.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className={`cursor-pointer ${placement.image.wrapperClass}`}
        aria-label={`Open ${placement.provider} in a new tab`}
      >
        <img
          alt={placement.image.alt}
          src={placement.image.src}
          width={placement.image.width}
          height={placement.image.height}
          loading="lazy"
          decoding="async"
          className={placement.image.className}
        />
      </a>
    );
  }

  if (placement.provider === "cricut") {
    return (
      <a
        href={placement.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="block cursor-pointer transition-opacity hover:opacity-95"
        aria-label="Open Cricut in a new tab"
      >
        <CricutVisual />
      </a>
    );
  }

  return null;
}

export function ContextualAffiliateCard() {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const placement = getAffiliatePlacement(pathname);

  if (!placement) return null;

  return (
    <section
      aria-labelledby="contextual-affiliate-heading"
      className="bg-white px-4 py-4 sm:py-5"
    >
      <div
        className={`mx-auto ${placement.maxWidthClass} overflow-hidden rounded-2xl border ${placement.borderClass} ${placement.surfaceClass} shadow-sm`}
      >
        <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0">
              <p
                className={`text-[11px] font-bold uppercase tracking-wide sm:text-xs ${placement.eyebrowClass}`}
              >
                {placement.eyebrow}
              </p>

              <h2
                id="contextual-affiliate-heading"
                className={`mt-1 max-w-[720px] text-xl font-extrabold leading-tight ${placement.headingClass} sm:text-2xl`}
              >
                {placement.heading}
              </h2>
            </div>

            <a
              href={placement.href}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className={`inline-flex w-full cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors ${placement.buttonClass} sm:w-auto lg:min-w-[220px]`}
            >
              {placement.cta}
            </a>
          </div>

          <p className="mt-2.5 max-w-[760px] text-[13px] leading-6 text-slate-700 sm:text-sm">
            {placement.body}
          </p>

          {placement.benefits?.length ? (
            <ul className="mt-2.5 grid gap-2 text-[13px] leading-5 text-slate-700 sm:grid-cols-3 sm:text-sm sm:leading-6">
              {placement.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-lg border border-white/80 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <span className="font-bold text-emerald-700">✓</span>{" "}
                  {benefit}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2.5 text-[11px] leading-5 text-slate-500">
            Affiliate link. iLoveSVG may earn a commission at no extra cost to
            you.
          </p>
        </div>

        <AffiliateVisual placement={placement} />
      </div>
    </section>
  );
}
