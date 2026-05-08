import * as React from "react";
import type { Route } from "./+types/sitemap";
import { Link } from "react-router";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import SiteFooter from "~/client/components/navigation/SiteFooter";

const SITE_URL = "https://www.ilovesvg.com";

type SitemapLink = {
  title: string;
  path: string;
  description: string;
};

type SitemapSection = {
  title: string;
  description: string;
  links: SitemapLink[];
};

const sitemapSections: SitemapSection[] = [
  {
    title: "How it works and converter help",
    description:
      "Practical documentation for choosing presets, understanding settings, troubleshooting output, and exporting SVG results.",
    links: [
      {
        title: "How It Works",
        path: "/how-it-works",
        description:
          "Start with the iLoveSVG workflow hub for presets, settings, queueing, output history, source previews, and downloads.",
      },
      {
        title: "Conversion Workflow",
        path: "/how-it-works/conversion-workflow",
        description:
          "Learn what Upload, Presets, Convert, queued status, Settings/Edit, Update preview, Copy SVG, Download SVG, Batch, and Minimize do.",
      },
      {
        title: "Preset Guide",
        path: "/how-it-works/presets",
        description:
          "Compare actual image-to-SVG presets by family, speed label, output style, best use, and settings to adjust.",
      },
      {
        title: "Settings Guide",
        path: "/how-it-works/settings",
        description:
          "Understand live preview edits, click-to-convert trace controls, layer colors, output appearance, and batch settings.",
      },
      {
        title: "Troubleshooting",
        path: "/how-it-works/troubleshooting",
        description:
          "Fix blank previews, messy SVG output, unwanted transparent backgrounds, slow presets, failed jobs, and large files.",
      },
      {
        title: "Exporting and Downloads",
        path: "/how-it-works/exporting-and-downloads",
        description:
          "Use Copy SVG, Download SVG, fullscreen preview, batch ZIP downloads, SVG file size, and SVG-to-raster export routes correctly.",
      },
    ],
  },
  {
    title: "Main SVG tools",
    description:
      "Core conversion tools for turning SVG files into browser-friendly image and document formats.",
    links: [
      {
        title: "Home",
        path: "/",
        description:
          "Start from the main iLoveSVG image to SVG converter and browse the most-used SVG tools.",
      },
      {
        title: "SVG to PNG Converter",
        path: "/svg-to-png-converter",
        description:
          "Convert SVG artwork into PNG images for web pages, previews, documents, and sharing.",
      },
      {
        title: "SVG to JPG Converter",
        path: "/svg-to-jpg-converter",
        description:
          "Export SVG graphics as JPG files for image workflows that do not need transparency.",
      },
      {
        title: "SVG to WebP Converter",
        path: "/svg-to-webp-converter",
        description:
          "Create WebP images from SVG files for smaller web-friendly image output.",
      },
      {
        title: "SVG to PDF Converter",
        path: "/svg-to-pdf-converter",
        description:
          "Turn SVG files into PDF documents for printing, sharing, and document workflows.",
      },
    ],
  },
  {
    title: "SVG editing and inspection tools",
    description:
      "Utilities for cleaning, previewing, resizing, recoloring, inspecting, and preparing SVG files.",
    links: [
      {
        title: "SVG Background Editor",
        path: "/svg-background-editor",
        description:
          "Add, remove, or adjust SVG backgrounds before downloading the finished file.",
      },
      {
        title: "SVG Resize and Scale Editor",
        path: "/svg-resize-and-scale-editor",
        description:
          "Resize SVG dimensions and scale artwork while keeping the file editable.",
      },
      {
        title: "SVG Recolor",
        path: "/svg-recolor",
        description:
          "Change SVG colors directly in the browser for quick edits and design cleanup.",
      },
      {
        title: "SVG Minifier",
        path: "/svg-minifier",
        description:
          "Reduce SVG file size by removing unnecessary code and whitespace.",
      },
      {
        title: "SVG Cleaner",
        path: "/svg-cleaner",
        description:
          "Clean messy SVG markup and prepare files for editing, embedding, or download.",
      },
      {
        title: "SVG Preview Viewer",
        path: "/svg-preview-viewer",
        description:
          "Open and preview SVG files quickly without installing design software.",
      },
      {
        title: "SVG Embed Code Generator",
        path: "/svg-embed-code-generator",
        description:
          "Generate clean SVG embed code for websites, HTML snippets, and inline usage.",
      },
      {
        title: "Inline SVG vs IMG",
        path: "/inline-svg-vs-img",
        description:
          "Compare inline SVG code and image tag usage for web design and development.",
      },
      {
        title: "SVG to Favicon Generator",
        path: "/svg-to-favicon-generator",
        description: "Create favicon-ready assets from SVG logos and icons.",
      },
      {
        title: "SVG Stroke Width Editor",
        path: "/svg-stroke-width-editor",
        description:
          "Adjust SVG stroke thickness for outlines, line art, icons, and cut-ready designs.",
      },
      {
        title: "SVG Flip and Rotate Editor",
        path: "/svg-flip-and-rotate-editor",
        description:
          "Flip, rotate, and reorient SVG artwork before exporting the final file.",
      },
      {
        title: "SVG Dimensions Inspector",
        path: "/svg-dimensions-inspector",
        description:
          "Check SVG width, height, viewBox, and sizing details before using a file.",
      },
      {
        title: "SVG File Size Inspector",
        path: "/svg-file-size-inspector",
        description:
          "Review SVG file size details and identify whether cleanup may be useful.",
      },
      {
        title: "SVG Accessibility and Contrast Checker",
        path: "/svg-accessibility-and-contrast-checker",
        description:
          "Check SVG contrast and accessibility details for clearer, more usable graphics.",
      },
    ],
  },
  {
    title: "Cricut and craft SVG tools",
    description:
      "Tools for preparing SVG files for Cricut Design Space, vinyl decals, stickers, labels, layered designs, and craft projects.",
    links: [
      {
        title: "Cricut SVG Converter",
        path: "/cricut-svg-converter",
        description:
          "Convert PNG, JPG, WebP, GIF, AVIF, BMP, TIFF, and SVG images into SVG files for Cricut projects.",
      },
      {
        title: "Image to SVG for Cricut",
        path: "/image-to-svg-for-cricut",
        description:
          "Turn general image files into Cricut-friendly SVG output for craft design workflows.",
      },
      {
        title: "PNG to SVG for Cricut",
        path: "/png-to-svg-for-cricut",
        description:
          "Convert PNG images into SVG files for Cricut cutting, decals, labels, and craft projects.",
      },
      {
        title: "PNG to Layered SVG for Cricut",
        path: "/png-to-layered-svg-for-cricut",
        description:
          "Create layered SVG designs from PNG images for multi-color Cricut projects.",
      },
      {
        title: "PNG to SVG for Cricut Print Then Cut",
        path: "/png-to-svg-for-cricut-print-then-cut",
        description:
          "Prepare PNG artwork for Cricut Print Then Cut sticker and label workflows.",
      },
      {
        title: "PNG to SVG for Cricut Vinyl",
        path: "/png-to-svg-for-cricut-vinyl",
        description:
          "Convert PNG artwork into SVG files for vinyl cutting, decals, and transfer designs.",
      },
      {
        title: "PNG to SVG for Cricut Stickers",
        path: "/png-to-svg-for-cricut-stickers",
        description:
          "Prepare PNG sticker art as SVG output for Cricut sticker-making projects.",
      },
      {
        title: "JPG to SVG for Cricut",
        path: "/jpg-to-svg-for-cricut",
        description:
          "Convert JPG images into Cricut-ready SVG files for cutting and craft layouts.",
      },
      {
        title: "JPEG to SVG for Cricut",
        path: "/jpeg-to-svg-for-cricut",
        description:
          "Convert JPEG artwork into SVG format for Cricut Design Space projects.",
      },
      {
        title: "WebP to SVG for Cricut",
        path: "/webp-to-svg-for-cricut",
        description:
          "Turn WebP image files into SVG output for Cricut and craft design use.",
      },
      {
        title: "Photo to SVG for Cricut",
        path: "/photo-to-svg-for-cricut",
        description:
          "Convert photos into simplified SVG artwork for Cricut-style design projects.",
      },
      {
        title: "Logo to SVG for Cricut",
        path: "/logo-to-svg-for-cricut",
        description:
          "Convert logo images into SVG files for Cricut decals, labels, and branded craft work.",
      },
      {
        title: "Black and White Image to SVG for Cricut",
        path: "/black-and-white-image-to-svg-for-cricut",
        description:
          "Trace black and white artwork into SVG files for Cricut cutting and stencil projects.",
      },
      {
        title: "Line Art to SVG for Cricut",
        path: "/line-art-to-svg-for-cricut",
        description:
          "Convert line drawings and outline artwork into SVG files for Cricut projects.",
      },
      {
        title: "Drawing to SVG for Cricut",
        path: "/drawing-to-svg-for-cricut",
        description:
          "Turn drawings into SVG output for Cricut cutting, stickers, and design files.",
      },
      {
        title: "Sketch to SVG for Cricut",
        path: "/sketch-to-svg-for-cricut",
        description:
          "Convert sketch-style artwork into Cricut-friendly SVG vector output.",
      },
      {
        title: "Sticker to SVG for Cricut",
        path: "/sticker-to-svg-for-cricut",
        description:
          "Prepare sticker artwork as SVG files for Cricut design and cutting workflows.",
      },
      {
        title: "Base64 to SVG for Cricut",
        path: "/base64-to-svg-for-cricut",
        description:
          "Decode Base64 SVG content and prepare it for Cricut-compatible use.",
      },
      {
        title: "Code to SVG for Cricut",
        path: "/code-to-svg-for-cricut",
        description: "Convert SVG code into a usable Cricut-ready SVG file.",
      },
      {
        title: "Layered SVG for Cricut",
        path: "/layered-svg-for-cricut",
        description:
          "Work with layered SVG designs intended for Cricut multi-layer projects.",
      },
      {
        title: "Image to Layered SVG for Cricut",
        path: "/image-to-layered-svg-for-cricut",
        description:
          "Create separated color layers from image files for Cricut layered designs.",
      },
      {
        title: "JPG to Layered SVG for Cricut",
        path: "/jpg-to-layered-svg-for-cricut",
        description:
          "Convert JPG artwork into layered SVG output for multi-color Cricut projects.",
      },
      {
        title: "Logo to Layered SVG for Cricut",
        path: "/logo-to-layered-svg-for-cricut",
        description:
          "Prepare logos as layered SVG files for Cricut decals, branding, and craft projects.",
      },
    ],
  },
  {
    title: "Specialized SVG conversion tools",
    description:
      "Focused converters for specific source images, artwork types, platforms, and cutting workflows.",
    links: [
      {
        title: "PNG to SVG Converter",
        path: "/png-to-svg-converter",
        description:
          "Convert PNG images into scalable SVG files with preview and download options.",
      },
      {
        title: "JPG to SVG Converter",
        path: "/jpg-to-svg-converter",
        description:
          "Trace JPG artwork into SVG format for editing, cutting, and web use.",
      },
      {
        title: "JPEG to SVG Converter",
        path: "/jpeg-to-svg-converter",
        description:
          "Convert JPEG images into scalable SVG files for design and export workflows.",
      },
      {
        title: "WebP to SVG Converter",
        path: "/webp-to-svg-converter",
        description:
          "Turn WebP artwork into SVG format for easier editing and reuse.",
      },
      {
        title: "Logo to SVG Converter",
        path: "/logo-to-svg-converter",
        description:
          "Convert logo images into cleaner SVG files for websites, branding, and craft use.",
      },
      {
        title: "Icon to SVG Converter",
        path: "/icon-to-svg-converter",
        description:
          "Create SVG files from icon images for UI, web, and design workflows.",
      },
      {
        title: "Emoji to SVG Converter",
        path: "/emoji-to-svg-converter",
        description:
          "Convert emoji-style artwork into SVG output for graphics and design use.",
      },
      {
        title: "Text to SVG Converter",
        path: "/text-to-svg-converter",
        description:
          "Create SVG text artwork for headings, labels, logos, and design exports.",
      },
      {
        title: "Sticker to SVG Converter",
        path: "/sticker-to-svg-converter",
        description:
          "Convert sticker artwork into SVG files for editing, cutting, and printing workflows.",
      },
      {
        title: "Line Art to SVG Converter",
        path: "/line-art-to-svg-converter",
        description:
          "Trace line art into SVG format while keeping the output simple and scalable.",
      },
      {
        title: "Drawing to SVG Converter",
        path: "/drawing-to-svg-converter",
        description:
          "Convert drawings into scalable SVG files for design and craft projects.",
      },
      {
        title: "Scan to SVG Converter",
        path: "/scan-to-svg-converter",
        description:
          "Turn scanned artwork into SVG output for cleanup, editing, and reuse.",
      },
      {
        title: "Sketch to SVG Converter",
        path: "/sketch-to-svg-converter",
        description:
          "Convert sketch images into SVG artwork for design, editing, and cutting.",
      },
      {
        title: "Image to SVG Outline",
        path: "/image-to-svg-outline",
        description:
          "Create outline-style SVG output from images for line art and cut-file workflows.",
      },
      {
        title: "Photo to SVG Outline",
        path: "/photo-to-svg-outline",
        description:
          "Convert photos into simplified SVG outlines for stylized artwork and craft use.",
      },
      {
        title: "Black and White Image to SVG Converter",
        path: "/black-and-white-image-to-svg-converter",
        description:
          "Trace black and white images into SVG files for clean single-color output.",
      },
      {
        title: "PNG to SVG for Laser Cutting",
        path: "/png-to-svg-for-laser-cutting",
        description:
          "Prepare PNG artwork as SVG files for laser cutting and outline-based fabrication.",
      },
      {
        title: "PNG to SVG for Etsy",
        path: "/png-to-svg-for-etsy",
        description:
          "Create SVG files from PNG artwork for Etsy digital products and craft listings.",
      },
      {
        title: "PNG to SVG for Silhouette",
        path: "/png-to-svg-for-silhouette",
        description:
          "Convert PNG artwork into SVG files for Silhouette cutting machine workflows.",
      },
    ],
  },
  {
    title: "Base64, color, and code utilities",
    description:
      "Helper tools for SVG code, Base64 conversion, and choosing colors for design work.",
    links: [
      {
        title: "SVG to Base64",
        path: "/svg-to-base64",
        description:
          "Encode SVG markup or files into Base64 for embedding and technical workflows.",
      },
      {
        title: "Base64 to SVG",
        path: "/base64-to-svg",
        description:
          "Decode Base64 SVG data back into readable SVG markup and downloadable files.",
      },
      {
        title: "Free Color Picker",
        path: "/free-color-picker",
        description:
          "Pick, compare, and copy colors for SVG files, websites, branding, and design work.",
      },
    ],
  },
  {
    title: "Legal and site information",
    description:
      "Site policy pages and navigation pages for iLoveSVG visitors and search engines.",
    links: [
      {
        title: "Cookies",
        path: "/cookies",
        description: "Review cookie-related information for iLoveSVG.",
      },
      {
        title: "Privacy Policy",
        path: "/privacy-policy",
        description: "Read how iLoveSVG handles privacy-related information.",
      },
      {
        title: "iLoveSVG Pro Waitlist",
        path: "/pro-waitlist",
        description:
          "Request early access to the planned iLoveSVG Pro workspace for higher limits, larger batch workflows, saved presets, and fewer interruptions.",
      },
      {
        title: "Terms of Service",
        path: "/terms-of-service",
        description: "Review the terms that apply when using iLoveSVG tools.",
      },
      {
        title: "Sitemap",
        path: "/sitemap",
        description:
          "Browse a structured list of iLoveSVG pages and tool categories.",
      },
    ],
  },
];

const totalLinks = sitemapSections.reduce(
  (total, section) => total + section.links.length,
  0,
);

export function meta({}: Route.MetaArgs) {
  const title = "Sitemap | iLoveSVG";
  const description =
    "Browse the iLoveSVG HTML sitemap with organized links to SVG converters, Cricut SVG tools, SVG editors, Base64 tools, color tools, and site information pages.";
  const canonical = `${SITE_URL}/sitemap`;

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    { tagName: "link", rel: "canonical", href: canonical },

    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

export default function Sitemap({ loaderData }: Route.ComponentProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Sitemap | iLoveSVG",
    url: `${SITE_URL}/sitemap`,
    description:
      "A structured HTML sitemap for iLoveSVG tools and site information pages.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: totalLinks,
      itemListElement: sitemapSections.flatMap((section) =>
        section.links.map((link) => ({
          "@type": "SiteNavigationElement",
          name: link.title,
          url: `${SITE_URL}${link.path === "/" ? "" : link.path}`,
          description: link.description,
        })),
      ),
    },
  };

  return (
    <>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_30%)]" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <p className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
              iLoveSVG navigation
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl sm:text-5xl font-bold tracking-tight text-sky-700">
              Sitemap
            </h1>
            <p className="mt-4 max-w-3xl text-base sm:text-lg leading-8 text-slate-700">
              A clean, organized index of iLoveSVG pages. Use this page to find
              SVG converters, Cricut tools, editing utilities, Base64 tools,
              color tools, and site information pages.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {sitemapSections.length} sections
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {totalLinks} indexed links
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-sky-700">
              Jump to a section
            </h2>
            <nav aria-label="Sitemap sections" className="mt-4">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sitemapSections.map((section) => (
                  <li key={section.title}>
                    <a
                      href={`#${sectionId(section.title)}`}
                      className="flex h-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 cursor-pointer transition"
                    >
                      <span>{section.title}</span>
                      <span aria-hidden="true" className="text-sky-600">
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="mt-8 space-y-8">
            {sitemapSections.map((section) => (
              <section
                key={section.title}
                id={sectionId(section.title)}
                className="scroll-mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm"
                aria-labelledby={`${sectionId(section.title)}-heading`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id={`${sectionId(section.title)}-heading`}
                      className="text-2xl font-bold tracking-tight text-sky-700"
                    >
                      {section.title}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {section.description}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    {section.links.length} links
                  </p>
                </div>

                <nav aria-label={section.title} className="mt-5">
                  <ul className="grid gap-3 md:grid-cols-2">
                    {section.links.map((link) => (
                      <li key={link.path}>
                        <Link
                          to={link.path}
                          className="group block h-full rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 cursor-pointer transition"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="text-base font-semibold text-slate-950 group-hover:text-sky-700">
                              {link.title}
                            </span>
                            <span
                              aria-hidden="true"
                              className="mt-0.5 shrink-0 text-sky-600 group-hover:translate-x-0.5 transition"
                            >
                              →
                            </span>
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-slate-600">
                            {link.description}
                          </span>
                          <span className="mt-3 block text-xs font-medium text-slate-500">
                            {link.path}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight text-sky-700">
              About this HTML sitemap
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
              <p>
                This page groups iLoveSVG tools by task so visitors and search
                engines can find the main conversion, editing, Cricut, utility,
                and policy pages from one crawlable location.
              </p>
              <p>
                The sitemap uses normal text links instead of scripted-only
                navigation, so each listed page remains easy to browse, crawl,
                and understand.
              </p>
            </div>
          </section>
        </section>
      </main>

      <SocialLinks />
      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  );
}

function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
