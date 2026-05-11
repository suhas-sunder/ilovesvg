import { useRef } from "react";
import { useLocation, useRouteLoaderData } from "react-router";
import { AdSenseDelayed } from "./AdsenseDelayed";
import {
  AFFILIATE_OFFERS,
  PRINTIFY_URL,
  STICKER_MULE_URL,
  type AffiliateOffer,
} from "~/client/lib/monetization/affiliateOffers";
import type { AffiliateProviderId } from "~/client/lib/monetization/affiliateProviders";
import {
  getAffiliateRouteCategories,
  normalizeAffiliatePathname,
} from "~/client/lib/monetization/affiliateRouteIntents";
import { getRouteMonetizationPolicy } from "~/client/lib/monetization/monetizationPolicy";
import { useAffiliateWaterfall } from "~/client/lib/monetization/useAffiliateWaterfall";

const CONTEXTUAL_AFFILIATE_SLOT_ID = "converter-below-tool";
const CONTEXTUAL_ADSENSE_FALLBACK_SLOT = "8102088582";
const CONTEXTUAL_AFFILIATE_RESERVE_CLASS = "min-h-[39rem]";
const CONTEXTUAL_ADSENSE_RESERVE_CLASS = "min-h-[11rem]";

type ActiveAffiliateProviderId = Extract<
  AffiliateProviderId,
  "printify" | "stickerMule"
>;

type AffiliatePlacement = {
  provider: AffiliateProviderId;
  eyebrow: string;
  heading: string;
  headingAlternates?: string[];
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

type AffiliatePlacementBase = Pick<
  AffiliatePlacement,
  | "href"
  | "borderClass"
  | "eyebrowClass"
  | "headingClass"
  | "buttonClass"
  | "surfaceClass"
  | "maxWidthClass"
  | "benefits"
  | "image"
>;

type AffiliateMessage = Pick<
  AffiliatePlacement,
  "eyebrow" | "heading" | "headingAlternates" | "body" | "cta" | "benefits"
>;

const PRINTIFY_IMAGE = {
  src: "https://assets.ilovesvg.com/printify-items.jpg",
  alt: "Printify product mockup examples for creator artwork",
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

const PRINTIFY_BENEFITS = [
  "Product mockups",
  "Listing-ready previews",
  "No inventory needed",
];

const PRINTIFY_MARKETING_BODY =
  "Create polished mockups, test product ideas, and start selling online with Printify without handling inventory.";

const PRINTIFY_ROUTE_MESSAGES: Record<string, AffiliateMessage> = {
  "/": {
    eyebrow: "Printify product next step",
    heading: "Finished the artwork? Put it on products people can buy",
    headingAlternates: [
      "Your SVG is ready for a product page",
      "Turn finished artwork into a shop-ready mockup",
    ],
    body: "After exporting artwork from the converter, use Printify's Product Creator to place the design on products, build listing images, and decide whether to publish or order a sample.",
    cta: "Try for Free!",
    benefits: [
      "Shop listing images",
      "No inventory to hold",
      "Sample order workflow",
    ],
  },
  "/png-to-svg-converter": {
    eyebrow: "Printify product next step",
    heading: "Finished a clean PNG? Build shop listing images next",
    headingAlternates: [
      "Turn transparent PNG art into shop listing images",
      "Move this PNG design from file to product idea",
    ],
    body: "If this PNG became a clean logo, icon, or sticker-style design, use Printify's Product Creator to make listing mockups and plan a sample before you publish.",
    cta: "Create PNG mockups",
    benefits: [
      "Transparent artwork",
      "Logo and sticker listings",
      "Sample before publishing",
    ],
  },
  "/jpg-to-svg-converter": {
    eyebrow: "Printify product next step",
    heading: "Got bold JPG art? Turn it into a product idea",
    headingAlternates: [
      "Use this JPG trace for shop-ready mockups",
      "Move logo-style JPG art toward a listing",
    ],
    body: "For logo-style, line-art, or bold JPG conversions, use Printify to build product mockups before you commit the design to a listing or sample order.",
    cta: "Create JPG mockups",
    benefits: [
      "Bold artwork workflow",
      "Listing images first",
      "Sample before selling",
    ],
  },
  "/jpeg-to-svg-converter": {
    eyebrow: "Printify product next step",
    heading: "Turn clean JPEG art into a shop-ready mockup",
    headingAlternates: [
      "Make listing images from a bold JPEG trace",
      "Use this JPEG conversion for product ideas",
    ],
    body: "When a JPEG trace becomes clean logo-style or line-art artwork, use Printify to create listing mockups and decide whether the design is worth sampling.",
    cta: "Create JPEG mockups",
    benefits: [
      "Bold photo art",
      "Shop listing images",
      "Sample order workflow",
    ],
  },
  "/webp-to-svg-converter": {
    eyebrow: "Printify product next step",
    heading: "Turn web artwork into a product listing idea",
    headingAlternates: [
      "Move this WebP design into shop mockups",
      "Use converted web art for listing visuals",
    ],
    body: "After converting WebP artwork into SVG, use Printify's Product Creator to turn the design into product images for a listing or sample plan.",
    cta: "Create WebP mockups",
    benefits: [
      "Web artwork reuse",
      "Listing mockup workflow",
      "No inventory to hold",
    ],
  },
  "/logo-to-svg-converter": {
    eyebrow: "Logo product next step",
    heading: "Put this logo on brand products without holding inventory",
    headingAlternates: [
      "Turn this logo into shop listing images",
      "Build brand merch mockups from this logo",
    ],
    body: "Use Printify to place the cleaned-up logo on product mockups, create brand listing images, and order a sample when the scale feels right.",
    cta: "Create logo mockups",
    benefits: [
      "Brand listing images",
      "Brand merch ideas",
      "Sample before ordering",
    ],
  },
  "/icon-to-svg-converter": {
    eyebrow: "Brand asset next step",
    heading: "Turn this icon into small brand-product ideas",
    headingAlternates: [
      "Use this SVG icon for shop listing images",
      "Make sticker and merch ideas from this icon",
    ],
    body: "If this icon is part of a brand project, use Printify to create product mockups for stickers, mugs, apparel, and sample planning.",
    cta: "Create icon mockups",
    benefits: [
      "Brand asset workflow",
      "Sticker listing ideas",
      "Sample order workflow",
    ],
  },
  "/sticker-to-svg-converter": {
    eyebrow: "Sticker design next step",
    heading: "Turn this sticker design into a product page",
    headingAlternates: [
      "Make shop listing images from sticker art",
      "Use finished sticker art to start a product idea",
    ],
    body: "Use Printify to turn finished sticker artwork into product mockups for creator-shop listings, then decide whether to publish or order samples.",
    cta: "Create sticker mockups",
    benefits: [
      "Sticker listing visuals",
      "Creator shop ideas",
      "Sample before selling",
    ],
  },
  "/line-art-to-svg-converter": {
    eyebrow: "Line art product next step",
    heading: "Line art converts well into simple product ideas",
    headingAlternates: [
      "Turn clean line art into shop mockups",
      "Use this SVG line art for listing images",
    ],
    body: "After vectorizing line art, use Printify to create product mockups and see whether the design works as a listing before ordering samples.",
    cta: "Create line art mockups",
    benefits: [
      "Clean graphic artwork",
      "Listing images first",
      "Sample order workflow",
    ],
  },
  "/drawing-to-svg-converter": {
    eyebrow: "Drawing product next step",
    heading: "Move this drawing from sketchbook to shop mockup",
    headingAlternates: [
      "Turn cleaned drawing art into product ideas",
      "Use hand-drawn art for listing mockups",
    ],
    body: "After cleaning up the drawing, use Printify to make product mockups for a listing, compare placement, and order a sample when the design is ready.",
    cta: "Create drawing mockups",
    benefits: [
      "Handmade art workflow",
      "Shop listing images",
      "No inventory to hold",
    ],
  },
  "/scan-to-svg-converter": {
    eyebrow: "Scanned artwork next step",
    heading: "Move scanned artwork into shop listing images",
    headingAlternates: [
      "Turn cleaned paper art into shop visuals",
      "Use scanned ink art for product ideas",
    ],
    body: "After cleaning paper shadows and ink marks, use Printify to create product mockups and see whether the artwork is ready for a listing or sample.",
    cta: "Create scan mockups",
    benefits: [
      "Paper-to-product workflow",
      "Listing images first",
      "Sample before selling",
    ],
  },
  "/sketch-to-svg-converter": {
    eyebrow: "Sketch product next step",
    heading: "Turn a cleaned sketch into a product idea",
    headingAlternates: [
      "Use sketch art for shop listing images",
      "Move this sketch into product mockups",
    ],
    body: "After converting the sketch, use Printify to create product mockups and decide whether the design is ready for a shop listing or sample order.",
    cta: "Create sketch mockups",
    benefits: [
      "Clean sketch workflow",
      "Listing mockup ideas",
      "No inventory to hold",
    ],
  },
  "/image-to-svg-outline": {
    eyebrow: "Outline artwork next step",
    heading: "Turn clean outlines into simple product ideas",
    headingAlternates: [
      "Use outline SVG art for shop mockups",
      "Make listing visuals from clean contour art",
    ],
    body: "Use Printify to place clean outline artwork into product mockups, build listing images, and plan a sample when the design looks ready.",
    cta: "Create outline mockups",
    benefits: [
      "Simple art workflow",
      "Listing image ideas",
      "Sample order workflow",
    ],
  },
  "/photo-to-svg-outline": {
    eyebrow: "Photo outline next step",
    heading: "A clean photo outline can become a product idea",
    headingAlternates: [
      "Use bold contours for shop listing images",
      "Turn this outline trace into product mockups",
    ],
    body: "If the photo trace became a clean contour or silhouette, use Printify to create product mockups before you publish or order samples.",
    cta: "Create outline mockups",
    benefits: [
      "Bold contour workflow",
      "Listing mockup ideas",
      "Sample before selling",
    ],
  },
  "/black-and-white-image-to-svg-converter": {
    eyebrow: "Black-and-white design next step",
    heading: "Use high-contrast art for simple shop listings",
    headingAlternates: [
      "Turn black-and-white artwork into listing images",
      "Make product ideas from bold contrast art",
    ],
    body: "Use Printify to create product mockups from bold black-and-white artwork, then decide whether it belongs in a listing or sample order.",
    cta: "Create B&W mockups",
    benefits: [
      "High-contrast artwork",
      "Simple listing visuals",
      "No inventory to hold",
    ],
  },
  "/svg-to-png-converter": {
    eyebrow: "Export next step",
    heading: "Use this PNG export to build shop listing images",
    headingAlternates: [
      "Turn the exported PNG into product mockups",
      "Move this PNG from download to product idea",
    ],
    body: "Use the exported PNG in Printify's Product Creator to build product mockups, create listing images, and order a sample when the design is ready.",
    cta: "Create PNG mockups",
    benefits: [
      "Transparent export workflow",
      "Shop listing images",
      "Sample before publishing",
    ],
  },
  "/svg-to-jpg-converter": {
    eyebrow: "Export next step",
    heading: "Use this JPG export for product listing visuals",
    headingAlternates: [
      "Turn the flattened JPG into mockup images",
      "Move this JPG export into a product idea",
    ],
    body: "Use the exported JPG in Printify to create product mockups when a flattened background is the right fit for your listing or sample plan.",
    cta: "Create JPG mockups",
    benefits: [
      "Flattened export workflow",
      "Product listing images",
      "Sample order workflow",
    ],
  },
  "/svg-background-editor": {
    eyebrow: "Transparent artwork next step",
    heading: "Use the transparent version for cleaner product listings",
    headingAlternates: [
      "Turn background-free art into shop mockups",
      "Make product images after fixing transparency",
    ],
    body: "After fixing the background, use Printify to build product mockups that show how the transparent artwork works on product colors and listing images.",
    cta: "Create transparent mockups",
    benefits: [
      "Transparency-aware workflow",
      "Cleaner listing images",
      "Sample before selling",
    ],
  },
  "/svg-resize-and-scale-editor": {
    eyebrow: "Design size next step",
    heading: "Fit the resized artwork into listing mockups",
    headingAlternates: [
      "Use the resized SVG for shop listing images",
      "Turn the final size into product ideas",
    ],
    body: "After resizing the SVG, use Printify to place the artwork in product mockups and decide whether the scale works before listing or sampling.",
    cta: "Create scale mockups",
    benefits: [
      "Scale-aware mockups",
      "Shop listing images",
      "Sample order workflow",
    ],
  },
  "/svg-recolor": {
    eyebrow: "Design color next step",
    heading: "See which colorway belongs in your shop",
    headingAlternates: [
      "Turn this color version into listing images",
      "Make product mockups from the recolored SVG",
    ],
    body: "After recoloring the SVG, use Printify to create product mockups and choose which colorway is worth publishing or sampling.",
    cta: "Create colorway mockups",
    benefits: [
      "Colorway listing images",
      "Product variant ideas",
      "Sample before selling",
    ],
  },
  "/svg-cleaner": {
    eyebrow: "Clean artwork next step",
    heading: "Cleaned paths are ready for shop mockups",
    headingAlternates: [
      "Turn polished your artwork into listing images",
      "Use cleaned artwork for product ideas",
    ],
    body: "After cleaning the SVG, use Printify to build product mockups and make sure the polished artwork still feels right before publishing or ordering samples.",
    cta: "Create cleaned-art mockups",
    benefits: [
      "Polished artwork workflow",
      "Shop listing images",
      "Sample before publishing",
    ],
  },
  "/svg-stroke-width-editor": {
    eyebrow: "Line weight next step",
    heading: "Turn bolder line art into product listing images",
    headingAlternates: [
      "Use adjusted SVG strokes for shop mockups",
      "Make product ideas from stronger line art",
    ],
    body: "After adjusting stroke width, use Printify to build product mockups and decide whether the line weight works for a listing or sample.",
    cta: "Create stroke mockups",
    benefits: [
      "Line weight workflow",
      "Line-art merch ideas",
      "Sample before selling",
    ],
  },
  "/svg-flip-and-rotate-editor": {
    eyebrow: "Adjusted artwork next step",
    heading: "Use the final layout in shop mockups",
    headingAlternates: [
      "Turn the adjusted SVG into listing images",
      "Make product ideas from the finished orientation",
    ],
    body: "After flipping or rotating the design, use Printify to build product mockups from the final orientation before publishing or ordering samples.",
    cta: "Create adjusted mockups",
    benefits: [
      "Final layout workflow",
      "Shop listing images",
      "Sample order workflow",
    ],
  },
  "/text-to-svg-converter": {
    eyebrow: "Custom text next step",
    heading: "Custom text designs can become gift-product listings",
    headingAlternates: [
      "Turn this name SVG into shop listing images",
      "Make product mockups from custom text art",
    ],
    body: "Use Printify to place custom text, names, or monogram SVGs into product mockups for gift listings, store images, or sample orders.",
    cta: "Create text mockups",
    benefits: [
      "Personalized product ideas",
      "Gift listing images",
      "No inventory to hold",
    ],
  },
  "/emoji-to-svg-converter": {
    eyebrow: "Icon-style design next step",
    heading: "Turn playful icon art into product ideas",
    headingAlternates: [
      "Use emoji-style SVG art for shop images",
      "Make sticker and gift mockups from this icon",
    ],
    body: "If this emoji or icon-style graphic fits a playful design, use Printify to create product mockups for listing images or sample planning.",
    cta: "Create icon mockups",
    benefits: [
      "Icon-style products",
      "Gift listing ideas",
      "Sample order workflow",
    ],
  },
  "/png-to-svg-for-cricut-print-then-cut": {
    eyebrow: "Printify product next step",
    heading: "Turn sticker-style cut art into product listings",
    headingAlternates: [
      "Use Print Then Cut artwork for shop images",
      "Move this cut-file design into product mockups",
    ],
    body: "Use Printify to build product mockups when your Print Then Cut artwork is ready for listing images, sample orders, or creator-shop ideas.",
    cta: "Build Printify mockups",
    benefits: [
      "Sticker-style listings",
      "Creator shop workflow",
      "No inventory to hold",
    ],
  },
  "/png-to-svg-for-cricut-stickers": {
    eyebrow: "Sticker design next step",
    heading: "Turn Cricut sticker art into shop-ready mockups",
    headingAlternates: [
      "Use this sticker SVG for product listings",
      "Make creator-shop images from sticker art",
    ],
    body: "Use Printify to build product mockups from finished Cricut sticker artwork before creating listings or ordering samples.",
    cta: "Create sticker mockups",
    benefits: [
      "Sticker listing visuals",
      "Creator shop workflow",
      "Sample before selling",
    ],
  },
  "/sticker-to-svg-for-cricut": {
    eyebrow: "Sticker design next step",
    heading: "Use this sticker SVG to build product listings",
    headingAlternates: [
      "Turn Cricut sticker art into shop mockups",
      "Make creator-shop images from this sticker design",
    ],
    body: "Use Printify to create product mockups from sticker-style artwork before publishing listings or ordering samples.",
    cta: "Create sticker mockups",
    benefits: [
      "Sticker listing visuals",
      "Creator shop workflow",
      "Sample before selling",
    ],
  },
  "/png-to-svg-for-silhouette": {
    eyebrow: "Cut-file product next step",
    heading: "Move this cut-file design into shop mockups",
    headingAlternates: [
      "Use cleaned SVG art for shop listing images",
      "Turn Silhouette-style art into product ideas",
    ],
    body: "Use Printify to create product mockups after cleaning cut-file artwork for listing images, product ideas, or sample planning.",
    cta: "Create product mockups",
    benefits: [
      "Cut-file product ideas",
      "Shop listing images",
      "No inventory to hold",
    ],
  },
};

function basePlacement(provider: ActiveAffiliateProviderId): AffiliatePlacementBase {
  if (provider === "printify") {
    return {
      href: PRINTIFY_URL,
      borderClass: "border-emerald-200",
      eyebrowClass: "text-emerald-700",
      headingClass: "text-sky-950",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
      surfaceClass: "bg-gradient-to-br from-emerald-50 via-white to-sky-50",
      maxWidthClass: "max-w-[1120px]",
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

function printifyHeadingForPath(pathname: string) {
  if (pathname.includes("logo")) {
    return "Turn your logo into products people can buy";
  }

  if (pathname.includes("text-to-svg")) {
    return "Turn custom text into products people can buy";
  }

  if (pathname.includes("sticker")) {
    return "Turn sticker art into products people can buy";
  }

  if (pathname.includes("drawing") || pathname.includes("sketch")) {
    return "Turn your artwork into products people can buy";
  }

  return "Turn your artwork into products people can buy";
}

function polishPrintifyPlacement(
  pathname: string,
  placement: AffiliatePlacement,
): AffiliatePlacement {
  return {
    ...placement,
    eyebrow: "Printify next step",
    heading: printifyHeadingForPath(pathname),
    headingAlternates: [
      "Create polished mockups from your artwork",
      "Test your artwork as a sellable product idea",
    ],
    body: PRINTIFY_MARKETING_BODY,
    cta: "Create product mockups",
    benefits: PRINTIFY_BENEFITS,
  };
}

function printifyPlacement(pathname: string): AffiliatePlacement {
  const base = basePlacement("printify");

  if (pathname.includes("print-on-demand")) {
    return {
      provider: "printify",
      eyebrow: "Printify print-on-demand next step",
      heading: "Turn prepared artwork into a print-on-demand product",
      headingAlternates: [
        "Use this artwork to build a POD listing",
        "Create product mockups without holding inventory",
      ],
      body: "Use Printify's Product Creator to turn finished artwork into listing mockups, then publish or order samples when the product idea is ready.",
      cta: "Try for Free!",
      ...base,
    };
  }

  if (pathname.includes("t-shirt")) {
    return {
      provider: "printify",
      eyebrow: "Printify T-shirt next step",
      heading: "Turn this artwork into a shirt product idea",
      headingAlternates: [
        "Build shirt listing images from this design",
        "Use this art for apparel mockups",
      ],
      body: "Use Printify to create apparel mockups from this design before publishing a shirt listing or ordering a sample.",
      cta: "Create shirt mockups",
      ...base,
    };
  }

  if (pathname.includes("merch")) {
    return {
      provider: "printify",
      eyebrow: "Printify merch next step",
      heading: "Use this artwork to start a merch listing",
      headingAlternates: [
        "Turn the finished design into product images",
        "Create merch mockups without buying inventory",
      ],
      body: "Use Printify to place the artwork on products for listing visuals, product ideas, or sample planning.",
      cta: "Create merch mockups",
      ...base,
    };
  }

  if (pathname.includes("vinyl")) {
    return {
      provider: "printify",
      eyebrow: "Printify product next step",
      heading: "Turn clean SVG art into product listing images",
      headingAlternates: [
        "Move vinyl-style artwork into shop mockups",
        "Use simple SVG art for product ideas",
      ],
      body: "Use Printify to place simple artwork into product mockups before listing or sampling.",
      cta: "Create product mockups",
      ...base,
    };
  }

  if (pathname.includes("layered") || pathname.includes("multicolor")) {
    return {
      provider: "printify",
      eyebrow: "Printify layered design next step",
      heading: "Turn layered artwork into shop listing images",
      headingAlternates: [
        "Use multicolor SVG art for product mockups",
        "Move layered artwork into a product idea",
      ],
      body: "Use Printify to create product mockups from layered or multicolor artwork before choosing listing visuals or samples.",
      cta: "Create layered mockups",
      ...base,
    };
  }

  if (pathname.includes("cricut")) {
    return {
      provider: "printify",
      eyebrow: "Printify product next step",
      heading: "Move this cut-file design into a product shop",
      headingAlternates: [
        "Use cut-file artwork for product listing images",
        "Create Printify mockups from this Cricut-style design",
      ],
      body: "Use Printify to build product mockups from this cut-file-style artwork before publishing or ordering samples.",
      cta: "Create Printify mockups",
      ...base,
    };
  }

  if (pathname.includes("etsy")) {
    return {
      provider: "printify",
      eyebrow: "Printify Etsy seller next step",
      heading: "Use this artwork for Etsy-style product listings",
      headingAlternates: [
        "Create Printify mockups for your shop",
        "Turn this design into listing images",
      ],
      body: "Use Printify to create product mockups for Etsy-style listings, sample orders, and product ideas from the artwork you just prepared.",
      cta: "Create listing mockups",
      ...base,
    };
  }

  return {
    provider: "printify",
    eyebrow: "Printify product next step",
    heading: "Turn prepared artwork into a product listing idea",
    headingAlternates: [
      "Use this design to build shop mockups",
      "Create product images without holding inventory",
    ],
    body: "Use Printify to create product mockups from the artwork before publishing a listing or ordering samples.",
    cta: "Create Printify mockups",
    ...base,
  };
}

function explicitPrintifyPlacement(
  pathname: string,
): AffiliatePlacement | null {
  const message = PRINTIFY_ROUTE_MESSAGES[pathname];
  if (!message) return null;

  return polishPrintifyPlacement(pathname, {
    provider: "printify",
    ...basePlacement("printify"),
    ...message,
  });
}

function getAffiliatePlacement(
  pathname: string,
  offer: AffiliateOffer,
): AffiliatePlacement | null {
  let placement: AffiliatePlacement | null = null;

  if (offer.providerId === "printify") {
    placement =
      explicitPrintifyPlacement(pathname) ??
      polishPrintifyPlacement(pathname, printifyPlacement(pathname));
  } else if (offer.providerId === "stickerMule") {
    placement = stickerMulePlacement(pathname);
  }

  if (!placement) return null;

  return {
    ...placement,
    provider: offer.providerId,
    href: offer.href,
  };
}

type RootAffiliateLoaderData = {
  affiliateVariantSeed?: number;
} | null;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getAffiliateHeading(
  pathname: string,
  placement: AffiliatePlacement,
  variantSeed: number,
) {
  const headingOptions = [
    placement.heading,
    ...(placement.headingAlternates?.filter(Boolean) ?? []),
  ];
  if (headingOptions.length <= 1) return placement.heading;

  const headingIndex =
    hashText(`${variantSeed}:${pathname}`) % headingOptions.length;
  return headingOptions[headingIndex] ?? placement.heading;
}

function getAffiliateCta(placement: AffiliatePlacement) {
  if (placement.provider === "printify") {
    return "Try for Free!";
  }

  return placement.cta;
}

function AffiliateVisual({
  placement,
  onAffiliateClick,
}: {
  placement: AffiliatePlacement;
  onAffiliateClick: () => void;
}) {
  if (placement.image) {
    return (
      <a
        href={placement.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className={`cursor-pointer ${placement.image.wrapperClass}`}
        aria-label={`Open ${placement.provider} in a new tab`}
        onClick={onAffiliateClick}
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

  return null;
}

function ContextualAffiliateContent({
  pathname,
  placement,
  variantSeed,
  offerId,
  slotId,
  reserveHeightClass,
  registerBannerElement,
  onAffiliateClick,
}: {
  pathname: string;
  placement: AffiliatePlacement;
  variantSeed: number;
  offerId: string;
  slotId: string;
  reserveHeightClass: string;
  registerBannerElement: (element: HTMLElement | null) => void;
  onAffiliateClick: () => void;
}) {
  const displayHeading = getAffiliateHeading(pathname, placement, variantSeed);
  const displayCta = getAffiliateCta(placement);

  return (
    <section
      ref={registerBannerElement}
      aria-labelledby="contextual-affiliate-heading"
      className={`bg-white px-4 py-4 sm:py-5 ${reserveHeightClass}`}
      data-affiliate-offer-id={offerId}
      data-monetization-kind="affiliate"
      data-monetization-slot={slotId}
    >
      <div
        className={`mx-auto ${placement.maxWidthClass} overflow-hidden rounded-2xl border ${placement.borderClass} ${placement.surfaceClass} shadow-sm`}
      >
        <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="inline-flex min-w-0 w-full flex-col">
              <p
                className={`text-[11px] font-bold uppercase tracking-wide sm:text-xs ${placement.eyebrowClass}`}
              >
                {placement.eyebrow}
              </p>

              <h2
                id="contextual-affiliate-heading"
                className={`mt-1 w-full text-xl font-extrabold leading-tight tracking-[-0.018em] ${placement.headingClass} sm:text-2xl lg:text-[1.75rem]`}
              >
                {displayHeading}
              </h2>
            </div>

            <a
              href={placement.href}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className={`inline-flex w-full cursor-pointer items-center justify-center rounded-xl px-5 py-3 text-center text-sm font-extrabold text-white shadow-sm transition-colors ${placement.buttonClass} lg:mt-4 lg:w-auto lg:min-w-[200px] lg:shrink-0 lg:whitespace-nowrap`}
              onClick={onAffiliateClick}
            >
              {displayCta}
            </a>
          </div>

          <p className="mt-2.5 max-w-[800px] text-[13px] leading-6 text-slate-700 sm:text-sm">
            {placement.body}
          </p>

          {placement.benefits?.length ? (
            <ul className="mt-2.5 grid gap-2 text-[13px] leading-5 text-slate-700 sm:grid-cols-3 sm:text-sm sm:leading-6">
              {placement.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-lg border border-white/80 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <span className="font-bold text-emerald-700" aria-hidden>
                    +
                  </span>{" "}
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

        <AffiliateVisual
          placement={placement}
          onAffiliateClick={onAffiliateClick}
        />
      </div>
    </section>
  );
}

export function ContextualAffiliateCard() {
  const location = useLocation();
  const rootData = useRouteLoaderData("root") as RootAffiliateLoaderData;
  const pathname = normalizeAffiliatePathname(location.pathname);
  const monetizationPolicy = getRouteMonetizationPolicy(pathname);
  const routeCategories = getAffiliateRouteCategories(pathname);
  const {
    selectedOffer,
    relevantOffers,
    shouldShowAdsense,
    shouldSuppressAffiliate,
    shouldSuppressAdsenseFallback,
    registerBannerElement,
    trackAffiliateClick,
    isReady,
  } = useAffiliateWaterfall({
    slotId: CONTEXTUAL_AFFILIATE_SLOT_ID,
    routeContext: pathname,
    routeCategories,
    offers: AFFILIATE_OFFERS,
    suppressAffiliateOnMobileWhenAdjacentAdExists: true,
  });
  const placement = selectedOffer
    ? getAffiliatePlacement(pathname, selectedOffer)
    : null;
  const hasRelevantOffers = relevantOffers.length > 0;
  const fallbackSeed = hashText(pathname);
  const variantSeedRef = useRef(
    typeof rootData?.affiliateVariantSeed === "number"
      ? rootData.affiliateVariantSeed
      : fallbackSeed,
  );

  if (!monetizationPolicy.ads && !monetizationPolicy.affiliate) {
    return null;
  }

  if (!isReady) {
    if (!monetizationPolicy.affiliate) {
      return monetizationPolicy.ads ? (
        <ContextualAdsenseFallback reserveMode="compact" />
      ) : null;
    }

    return hasRelevantOffers ? (
      <ContextualMonetizationPendingReserve />
    ) : monetizationPolicy.ads ? (
      <ContextualAdsenseFallback reserveMode="compact" />
    ) : null;
  }

  if (shouldSuppressAffiliate && shouldSuppressAdsenseFallback) {
    return null;
  }

  if (!selectedOffer || !placement || !monetizationPolicy.affiliate) {
    return shouldShowAdsense &&
      monetizationPolicy.ads &&
      !shouldSuppressAdsenseFallback ? (
      <ContextualAdsenseFallback reserveMode="compact" />
    ) : null;
  }

  return (
    <ContextualAffiliateContent
      pathname={pathname}
      placement={placement}
      variantSeed={variantSeedRef.current}
      offerId={selectedOffer.id}
      slotId={CONTEXTUAL_AFFILIATE_SLOT_ID}
      reserveHeightClass={CONTEXTUAL_AFFILIATE_RESERVE_CLASS}
      registerBannerElement={registerBannerElement}
      onAffiliateClick={() => trackAffiliateClick(selectedOffer.id)}
    />
  );
}

function ContextualMonetizationPendingReserve() {
  return (
    <section
      className={`hidden bg-white px-4 py-4 sm:py-5 lg:block ${CONTEXTUAL_AFFILIATE_RESERVE_CLASS}`}
      aria-label="Sponsored placement loading"
      data-monetization-kind="pending"
      data-monetization-slot={CONTEXTUAL_AFFILIATE_SLOT_ID}
      data-monetization-reserve="affiliate"
    >
      <div className="mx-auto flex h-full max-w-[1120px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 shadow-sm">
        <div className="px-5 py-5 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="w-full max-w-[760px]">
              <div className="h-3 w-40 rounded bg-slate-200" />
              <div className="mt-3 h-8 w-full max-w-[620px] rounded bg-slate-200/80" />
            </div>
            <div className="h-11 w-full rounded-xl bg-slate-200/80 lg:mt-4 lg:w-[210px]" />
          </div>
          <div className="mt-4 h-4 w-full max-w-[760px] rounded bg-slate-200/70" />
          <div className="mt-2 h-4 w-full max-w-[620px] rounded bg-slate-200/60" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="h-10 rounded-lg bg-white/90 shadow-sm" />
            <div className="h-10 rounded-lg bg-white/90 shadow-sm" />
            <div className="h-10 rounded-lg bg-white/90 shadow-sm" />
          </div>
          <div className="mt-4 h-3 w-72 rounded bg-slate-200/70" />
        </div>
        <div className="mt-auto h-[18rem] border-t border-slate-200 bg-slate-100/80" />
      </div>
    </section>
  );
}

function ContextualAdsenseFallback({
  reserveMode,
}: {
  reserveMode: "affiliate" | "compact";
}) {
  const reserveHeightClass =
    reserveMode === "affiliate"
      ? CONTEXTUAL_AFFILIATE_RESERVE_CLASS
      : CONTEXTUAL_ADSENSE_RESERVE_CLASS;

  return (
    <section
      className={`hidden bg-white px-4 py-4 sm:py-5 lg:block ${reserveHeightClass}`}
      aria-label="Sponsored advertisement"
      data-monetization-kind="adsense"
      data-monetization-slot={CONTEXTUAL_AFFILIATE_SLOT_ID}
      data-monetization-reserve={reserveMode}
    >
      <div className="mx-auto w-full max-w-[970px]">
        <AdSenseDelayed
          slot={CONTEXTUAL_ADSENSE_FALLBACK_SLOT}
          delayMs={1500}
          minHeight={120}
          maxHeight={180}
          format="horizontal"
          fullWidth={true}
          className="mx-auto w-full"
        />
      </div>
    </section>
  );
}
