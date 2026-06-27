import type { MouseEventHandler } from "react";
import vinylBannerImage from "~/client/assets/images/amazon-affiliate-vinyl-banner-final.jpg";

export const AMAZON_VINYL_AFFILIATE_URL = "https://amzn.to/4eyJt2K";

type AmazonVinylAffiliateBannerProps = {
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function AmazonVinylAffiliateBanner({
  onClick,
}: AmazonVinylAffiliateBannerProps) {
  return (
    <a
      href={AMAZON_VINYL_AFFILIATE_URL}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={onClick}
      aria-label="View printable vinyl sticker paper on Amazon"
      className="group mx-auto block w-full max-w-[970px] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      data-monetization-kind="affiliate"
      data-affiliate-provider="amazon"
      data-affiliate-offer-id="amazon-printable-vinyl-sticker-paper"
    >
      <div className="flex min-h-[260px] flex-col">
        <div className="flex min-w-0 items-start justify-between gap-6 px-6 py-5">
          <div className="min-w-0">
            <span className="mb-2 inline-flex w-fit rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-normal text-sky-700">
              Next step
            </span>

            <h2 className="font-display text-[26px] font-[800] leading-[1.08] tracking-normal text-slate-950">
              Turn your image into custom stickers
            </h2>

            <p className="mt-2 max-w-[680px] text-[14px] font-medium leading-5 text-slate-600">
              Use printable matte vinyl sheets to make stickers, labels,
              decals, and craft projects from your designs.
            </p>

            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              Amazon affiliate link: iLoveSVG earns from qualifying purchases.
            </p>
          </div>

          <span className="mt-7 inline-flex shrink-0 rounded-full bg-sky-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition group-hover:bg-sky-700">
            View sticker paper
          </span>
        </div>

        <div className="relative h-[156px] overflow-hidden border-t border-slate-100 bg-slate-50">
          <img
            src={vinylBannerImage}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover object-[center_56%] transition duration-300 group-hover:scale-[1.01] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </div>
    </a>
  );
}
