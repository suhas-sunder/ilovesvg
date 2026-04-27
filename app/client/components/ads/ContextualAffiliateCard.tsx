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
  wrapperClass: "block bg-emerald-50/80 transition-opacity hover:opacity-95",
  className: "h-auto w-full object-cover",
};

const STICKER_MULE_IMAGE = {
  src: "https://cdn.stickermule.com/content/core/assets/banners/stickermule-invite-friends-large.png",
  alt: "Sticker Mule custom sticker printing offer",
  width: 728,
  height: 90,
  wrapperClass: "block bg-orange-500 transition-opacity hover:opacity-95",
  className: "h-auto w-full object-cover",
};

const NAMECHEAP_IMAGE = {
  src: "https://assets.ilovesvg.com/namecheap.jpg",
  alt: "Namecheap domain and shared hosting offer banner for portfolios, storefronts, product pages, and small business websites",
  width: 2048,
  height: 683,
  wrapperClass: "block bg-purple-50/80 transition-opacity hover:opacity-95",
  className: "h-auto w-full object-cover",
};

const PRINTIFY_BENEFITS = [
  "Test designs on real products",
  "No inventory or shipping setup needed",
  "Good fit after exporting SVG artwork",
];

const CRICUT_BENEFITS = [
  "Useful for Cricut Design Space projects",
  "Good fit for stickers, vinyl, labels, and decals",
  "Helpful after preparing a cleaner SVG cut file",
];

const NAMECHEAP_BENEFITS = [
  "Domain and shared hosting in one place",
  "Useful for a portfolio, shop, or product landing page",
  "Good when you want a simple standalone site for your brand",
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
      body: "After creating your SVG or print-ready artwork, use Cricut tools to check the final size, print quality, cut border, and project setup before making stickers, labels, decals, or craft products.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  if (pathname.includes("vinyl")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut vinyl next step",
      heading: "Use this SVG for a cleaner Cricut vinyl project",
      body: "After preparing the SVG, review the line thickness, small details, spacing, and final size before cutting vinyl decals, labels, signs, or transfer projects.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  if (pathname.includes("sticker")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut sticker next step",
      heading: "Check this design before making Cricut stickers",
      body: "After converting your artwork, review the cut edge, transparent areas, final size, and print clarity before using the file for Cricut sticker projects.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  if (pathname.includes("layered") || pathname.includes("multicolor")) {
    return {
      provider: "cricut",
      eyebrow: "Cricut layered SVG next step",
      heading: "Prepare this layered SVG for Cricut projects",
      body: "After creating a layered or multicolor SVG, check that each layer is separated clearly, small details are usable, and the file imports cleanly before cutting or assembling the design.",
      cta: "Continue with Cricut",
      ...base,
    };
  }

  return {
    provider: "cricut",
    eyebrow: "Cricut SVG next step",
    heading: "Use this file in your next Cricut project",
    body: "After converting your image to SVG, check the traced edges, background cleanup, final size, and project type before importing it into Cricut Design Space.",
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
      body: "After preparing your SVG or cut-ready file, check the final size, edge spacing, transparent areas, and print quality before ordering stickers, decals, labels, or packaging.",
      cta: "Get $10 Sticker Mule credit",
      ...base,
    };
  }

  if (pathname.includes("print-then-cut")) {
    return {
      provider: "stickerMule",
      eyebrow: "Print then cut next step",
      heading: "Turning this design into printed stickers or labels?",
      body: "After creating your Cricut-ready file, check that the artwork stays clear at the final print size and that the cut border has enough breathing room before ordering stickers, labels, or decals.",
      cta: "Get $10 Sticker Mule credit",
      ...base,
    };
  }

  if (pathname.includes("logo")) {
    return {
      provider: "stickerMule",
      eyebrow: "Logo printing next step",
      heading: "Turn your logo into stickers or labels",
      body: "Once your logo is converted, check that the edges are clean and the design stays readable at small sizes. Simple logos can work well for stickers, decals, labels, packaging, and branded inserts.",
      cta: "Get $10 Sticker Mule credit",
      ...base,
    };
  }

  if (pathname.includes("sticker")) {
    return {
      provider: "stickerMule",
      eyebrow: "Sticker artwork next step",
      heading: "Preparing sticker artwork for printing?",
      body: "After converting your sticker artwork, check the cut edge, transparent areas, and final size. Clean artwork usually prints better and is easier to turn into stickers, decals, or labels.",
      cta: "Get $10 Sticker Mule credit",
      ...base,
    };
  }

  return {
    provider: "stickerMule",
    eyebrow: "Design printing next step",
    heading: "Turning this design into stickers or labels?",
    body: "After converting your artwork, inspect the edges, final size, and background before using it for physical prints. Simple, high-resolution artwork works best for stickers, decals, labels, and packaging.",
    cta: "Get $10 Sticker Mule credit",
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
      body: "After preparing your SVG or product-ready artwork, use Printify to preview the design on shirts, mugs, tote bags, stickers, and other merch without buying inventory first.",
      cta: "Test it with Printify",
      ...base,
    };
  }

  if (pathname.includes("t-shirt")) {
    return {
      provider: "printify",
      eyebrow: "Printify T-shirt next step",
      heading: "Turn this SVG design into a Printify shirt mockup",
      body: "Once your artwork is cleaned up, use Printify to check how it looks on apparel before publishing. Review the final size, contrast, and background so the design stays readable on the shirt.",
      cta: "Test it on Printify shirts",
      ...base,
    };
  }

  if (pathname.includes("merch")) {
    return {
      provider: "printify",
      eyebrow: "Printify merch next step",
      heading: "Preview this SVG on Printify merch products",
      body: "After exporting your SVG or product-ready file, use Printify to test whether the artwork still looks clean on shirts, mugs, tote bags, stickers, and other product mockups.",
      cta: "Preview it on Printify",
      ...base,
    };
  }

  if (pathname.includes("vinyl")) {
    return {
      provider: "printify",
      eyebrow: "Printify product next step",
      heading: "Use this clean SVG beyond vinyl projects",
      body: "After preparing a clean SVG for vinyl cutting, you can also use Printify to test simple designs on apparel, mugs, stickers, tote bags, and other merch products.",
      cta: "Test it with Printify",
      ...base,
    };
  }

  if (pathname.includes("layered") || pathname.includes("multicolor")) {
    return {
      provider: "printify",
      eyebrow: "Printify layered design next step",
      heading: "Test layered SVG artwork on Printify merch",
      body: "After creating a layered or multicolor SVG, use Printify to check whether the design still looks clean at the final product size on apparel, mugs, tote bags, stickers, and other merch.",
      cta: "Test layered artwork",
      ...base,
    };
  }

  if (pathname.includes("cricut")) {
    return {
      provider: "printify",
      eyebrow: "Printify product next step",
      heading: "Test this Cricut SVG on Printify products",
      body: "After converting your image for Cricut, use Printify to preview the design on shirts, mugs, tote bags, stickers, and merch. Check the traced edges, final size, and contrast before publishing or ordering samples.",
      cta: "Test it with Printify",
      ...base,
    };
  }

  if (pathname.includes("etsy")) {
    return {
      provider: "printify",
      eyebrow: "Printify Etsy seller next step",
      heading: "Test this Etsy SVG design on Printify products",
      body: "After preparing your SVG, use Printify to test product ideas before managing inventory. Check that the artwork is clean, properly licensed, and suitable for the product you plan to sell.",
      cta: "Test Etsy product ideas",
      ...base,
    };
  }

  return {
    provider: "printify",
    eyebrow: "Printify product next step",
    heading: "Preview this SVG design on Printify products",
    body: "After preparing your SVG or product-ready artwork, use Printify to test the design on shirts, mugs, tote bags, stickers, and other merch before publishing or ordering samples.",
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
      body: "After preparing your favicon or brand asset, use Namecheap to set up a simple website for your portfolio, storefront, or landing page.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  if (pathname.includes("embed")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap website next step",
      heading: "Put this SVG project on a real website",
      body: "If you are preparing SVG embed code for a site, Namecheap can help you get a simple website online for demos, portfolios, product pages, or small business use.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  if (pathname.includes("etsy") || pathname.includes("digital-download")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap seller website next step",
      heading: "Build a simple home for your SVG shop",
      body: "If you are selling SVG files, a simple standalone site can strengthen your brand beyond marketplace listings and give you a cleaner place to send customers.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  if (pathname.includes("logo")) {
    return {
      provider: "namecheap",
      eyebrow: "Namecheap branding next step",
      heading: "Have a logo? Secure a domain and site",
      body: "Once your logo is ready, use Namecheap to secure a domain and simple website for your portfolio, storefront, product page, or landing page.",
      cta: "View Namecheap options",
      ...base,
    };
  }

  return {
    provider: "namecheap",
    eyebrow: "Namecheap website next step",
    heading: "Build a simple site for your design brand",
    body: "Use Namecheap to set up a simple website for your SVG portfolio, product page, storefront, or small-business landing page.",
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

  if (matchesPrintify(pathname)) {
    return printifyPlacement(pathname);
  }

  if (matchesStickerMule(pathname)) {
    return stickerMulePlacement(pathname);
  }

  if (matchesNamecheap(pathname)) {
    return namecheapPlacement(pathname);
  }

  return null;
}

function CricutVisual() {
  return (
    <div className="border-t border-cyan-100 bg-cyan-50/70 px-4 py-4 sm:px-5">
      <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
          Cricut project workflow
        </p>
        <p className="mt-1 text-2xl font-black leading-tight text-sky-950">
          Prepare cleaner SVG files for Cricut projects
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
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
      className="bg-white px-4 py-5"
    >
      <div
        className={`mx-auto ${placement.maxWidthClass} overflow-hidden rounded-2xl border ${placement.borderClass} ${placement.surfaceClass} shadow-sm`}
      >
        <div className="px-4 py-4 sm:px-5 lg:px-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0">
              <p
                className={`text-xs font-bold uppercase tracking-wide ${placement.eyebrowClass}`}
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
              className={`inline-flex w-full cursor-pointer items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm transition-colors ${placement.buttonClass} sm:w-auto lg:min-w-[240px]`}
            >
              {placement.cta}
            </a>
          </div>

          <p className="mt-3 max-w-[820px] text-sm leading-6 text-slate-700">
            {placement.body}
          </p>

          {placement.benefits?.length ? (
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 sm:grid-cols-3">
              {placement.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <span className="font-bold text-emerald-700">✓</span>{" "}
                  {benefit}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Affiliate link. iLoveSVG may earn a commission at no extra cost to
            you.
          </p>
        </div>

        <AffiliateVisual placement={placement} />
      </div>
    </section>
  );
}
