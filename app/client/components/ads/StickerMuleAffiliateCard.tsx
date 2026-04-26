import { useLocation } from "react-router";

type StickerMuleCopy = {
  eyebrow: string;
  heading: string;
  body: string;
};

const STICKER_MULE_URL =
  "https://www.stickermule.com/ca/unlock?ref_id=1974725801&utm_medium=embed&utm_source=invite&utm_content=728x90";

const STICKER_MULE_COPY_BY_ROUTE: Record<string, StickerMuleCopy> = {
  "/png-to-svg-for-cricut-stickers": {
    eyebrow: "Sticker printing next step",
    heading: "Ready to print your sticker design?",
    body: "Once your artwork and cut outline look right, you can use the exported file as a starting point for custom stickers, decals, labels, or product packaging. Check the final size, edge spacing, and image quality before ordering.",
  },

  "/png-to-svg-for-cricut-print-then-cut": {
    eyebrow: "Print then cut next step",
    heading: "Turning this design into printed stickers or labels?",
    body: "After creating your Cricut-ready file, check that the artwork stays clear at the final print size and that the cut border has enough breathing room before ordering stickers, labels, or decals.",
  },

  "/png-to-svg-for-cricut-vinyl": {
    eyebrow: "Vinyl project next step",
    heading: "Using this design for decals or vinyl projects?",
    body: "Before cutting or ordering decals, make sure the shapes are clean, the small details are not too thin, and the design will still read well at the final size.",
  },

  "/sticker-to-svg-converter": {
    eyebrow: "Sticker artwork next step",
    heading: "Preparing sticker artwork for printing?",
    body: "After converting your sticker design, check the cut edge, transparent areas, and final size. Clean artwork usually prints better and is easier to turn into stickers, decals, or labels.",
  },

  "/logo-to-svg-converter": {
    eyebrow: "Logo printing next step",
    heading: "Want to use this logo on stickers or packaging?",
    body: "Once your logo is converted, check that the edges are clean and the design is readable at small sizes. A simple SVG can be useful for stickers, labels, decals, packaging, and branded inserts.",
  },

  "/png-to-svg-converter": {
    eyebrow: "Design printing next step",
    heading: "Turning this PNG into stickers, labels, or decals?",
    body: "After converting your PNG to SVG, inspect the edges and final size before using it for physical prints. Simple, high-resolution artwork works best for stickers, decals, labels, and packaging.",
  },

  "/jpg-to-svg-converter": {
    eyebrow: "Design printing next step",
    heading: "Turning this JPG into stickers, labels, or decals?",
    body: "After converting your JPG to SVG, review the traced edges and remove any unwanted background areas. Physical prints usually work best when the source image is clear, high-resolution, and legally usable.",
  },

  "/jpeg-to-svg-converter": {
    eyebrow: "Design printing next step",
    heading: "Turning this JPEG into stickers, labels, or decals?",
    body: "After converting your JPEG to SVG, review the traced edges and remove any unwanted background areas. Physical prints usually work best when the source image is clear, high-resolution, and legally usable.",
  },

  "/png-to-svg-for-cricut": {
    eyebrow: "Cricut project next step",
    heading: "Using this SVG for a real Cricut project?",
    body: "Before cutting or printing, check that the converted shapes are clean, the design is sized correctly, and the file matches your project type. The same artwork may need different prep for vinyl, stickers, decals, or labels.",
  },

  "/png-to-layered-svg-for-cricut": {
    eyebrow: "Layered Cricut project next step",
    heading: "Preparing a layered design for cutting or printing?",
    body: "After creating your layered SVG, check that each color or layer is separated clearly and that small details will survive at the final size. Layered designs can work well for decals, labels, stickers, and craft projects when the file is clean.",
  },

  "/sticker-to-svg-for-cricut": {
    eyebrow: "Cricut sticker next step",
    heading: "Preparing this sticker design for Cricut?",
    body: "After converting your sticker artwork, check that the cut edge is clean, the shape is easy to weed or trim, and the design stays readable at the final sticker size. Clean files are easier to use for stickers, decals, labels, and packaging.",
  },

  "/logo-to-svg-for-cricut": {
    eyebrow: "Cricut logo project next step",
    heading: "Using this logo for stickers, decals, or labels?",
    body: "Once your logo is converted for Cricut, review the edges, small text, and spacing before using it on physical products. Simple logos usually work better for stickers, decals, labels, and branded packaging.",
  },

  "/image-to-svg-for-cricut": {
    eyebrow: "Cricut image project next step",
    heading: "Turning this image into a Cricut-ready design?",
    body: "After converting your image, check that the traced shapes are clean and that important details are not too small for the final size. The same design may need different prep for stickers, vinyl decals, labels, or packaging.",
  },

  "/jpg-to-svg-for-cricut": {
    eyebrow: "Cricut JPG project next step",
    heading: "Preparing this JPG for a Cricut project?",
    body: "After converting your JPG to SVG, review the traced edges and remove any unwanted background areas. Physical projects usually work best when the source image is clear, high-resolution, and simple enough to cut or print cleanly.",
  },

  "/webp-to-svg-for-cricut": {
    eyebrow: "Cricut WEBP project next step",
    heading: "Preparing this WEBP image for Cricut?",
    body: "After converting your WEBP image to SVG, inspect the cut lines, small details, and background areas before using it for stickers, decals, labels, or vinyl projects.",
  },

  "/png-to-svg-for-stickers": {
    eyebrow: "Sticker printing next step",
    heading: "Turning this PNG into sticker artwork?",
    body: "After converting your PNG to SVG, check the cut edge, transparent background, and final print size. High-resolution artwork with clean edges usually works better for custom stickers, decals, labels, and packaging.",
  },

  "/jpg-to-svg-for-stickers": {
    eyebrow: "Sticker printing next step",
    heading: "Turning this JPG into sticker artwork?",
    body: "After converting your JPG to SVG, review the traced edges and remove unwanted background areas. Stickers usually print better when the source image is clear, high-resolution, and sized correctly before ordering.",
  },

  "/jpeg-to-svg-for-stickers": {
    eyebrow: "Sticker printing next step",
    heading: "Turning this JPEG into sticker artwork?",
    body: "After converting your JPEG to SVG, review the traced edges and remove unwanted background areas. Stickers usually print better when the source image is clear, high-resolution, and sized correctly before ordering.",
  },

  "/webp-to-svg-for-stickers": {
    eyebrow: "Sticker printing next step",
    heading: "Turning this WEBP image into sticker artwork?",
    body: "After converting your WEBP to SVG, check the cut edge, background, and final size before using it for stickers, decals, labels, or packaging.",
  },

  "/logo-to-svg-for-stickers": {
    eyebrow: "Logo sticker next step",
    heading: "Turning this logo into stickers or labels?",
    body: "Once your logo is converted, check that it stays readable at small sizes and that the edges are clean enough for printing. A simple logo can work well for stickers, decals, labels, branded inserts, and packaging.",
  },

  "/image-to-svg-for-stickers": {
    eyebrow: "Sticker artwork next step",
    heading: "Turning this image into sticker artwork?",
    body: "After converting your image to SVG, check the traced edges, background, and final print size. Simple, clean artwork usually works better for stickers, decals, labels, and packaging.",
  },

  "/png-to-svg-for-etsy": {
    eyebrow: "Etsy product next step",
    heading: "Preparing this design for Etsy products?",
    body: "After converting your PNG to SVG, check that the artwork is clean, properly licensed, and suitable for the product type you plan to sell. SVG files can be useful for digital downloads, stickers, labels, decals, and product packaging.",
  },

  "/jpg-to-svg-for-etsy": {
    eyebrow: "Etsy product next step",
    heading: "Preparing this JPG for Etsy products?",
    body: "After converting your JPG to SVG, review the traced edges, remove unwanted background areas, and confirm you have the rights to use the artwork. Clean files are easier to use for stickers, labels, decals, and digital products.",
  },

  "/logo-to-svg-for-etsy": {
    eyebrow: "Etsy logo product next step",
    heading: "Using this logo for Etsy products?",
    body: "Once your logo is converted to SVG, check that it is readable at small sizes and clean enough for physical products. A simple logo can work well for stickers, labels, decals, packaging, and branded inserts.",
  },

  "/image-to-svg-for-etsy": {
    eyebrow: "Etsy design next step",
    heading: "Preparing this image for Etsy products?",
    body: "After converting your image to SVG, check the edge quality, background, final size, and usage rights. Clean, properly licensed artwork is easier to use for stickers, labels, decals, packaging, or digital downloads.",
  },

  "/svg-file-for-etsy": {
    eyebrow: "Etsy SVG next step",
    heading: "Preparing SVG files for Etsy products?",
    body: "Before using or selling an SVG file, check that the artwork is clean, properly licensed, and suitable for the product type. SVG files can support digital downloads, stickers, decals, labels, packaging, and other small-business products.",
  },
};

export function StickerMuleAffiliateCard() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const copy = STICKER_MULE_COPY_BY_ROUTE[pathname];

  if (!copy) return null;

  return (
    <section
      aria-labelledby="sticker-printing-heading"
      className="bg-white px-4 py-5"
    >
      <div className="mx-auto max-w-[760px] overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                {copy.eyebrow}
              </p>

              <h2
                id="sticker-printing-heading"
                className="mt-1 text-lg font-extrabold leading-snug text-slate-900 sm:text-xl"
              >
                {copy.heading}
              </h2>
            </div>

            <a
              href={STICKER_MULE_URL}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 sm:w-auto sm:shrink-0"
            >
              Get $10 Sticker Mule credit
            </a>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-700">{copy.body}</p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Affiliate link. iLoveSVG may earn a commission at no extra cost to
            you.
          </p>
        </div>

        <a
          href={STICKER_MULE_URL}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="block cursor-pointer bg-orange-500 transition-opacity hover:opacity-95"
          aria-label="Open Sticker Mule in a new tab"
        >
          <img
            alt="Sticker Mule custom sticker printing offer"
            src="https://cdn.stickermule.com/content/core/assets/banners/stickermule-invite-friends-large.png"
            width={728}
            height={90}
            loading="lazy"
            decoding="async"
            className="h-auto w-full"
          />
        </a>
      </div>
    </section>
  );
}
