import * as React from "react";
import { useLocation } from "react-router";

type ExampleCategory =
  | "general-image-to-svg"
  | "logo-to-svg"
  | "icon-to-svg"
  | "character-to-svg"
  | "sticker-to-svg"
  | "line-art-to-svg"
  | "cricut"
  | "laser-cutting"
  | "svg-editing"
  | "svg-export"
  | "base64"
  | "inspect"
  | "optimize"
  | "color";

type ImageExample = {
  id: string;
  baseName: string;
  beforeExt: "jpg" | "png" | "webp";
  conversions: string[];
  label: string;
  subject: string;
};

type ExamplePair = {
  example: ImageExample;
  conversionName: string;
};

type CopySet = {
  title: string;
  description: string;
  beforeLabel: string;
  afterLabel: string;
  beforeAlt: string;
  afterAlt: string;
};

type Props = {
  routeSlug?: string;
  category?: ExampleCategory;
  className?: string;
};

type ImageStatus = "loading" | "loaded" | "error";

const ASSET_BASE_URL = "https://assets.ilovesvg.com";

const IMAGE_EXAMPLES: ImageExample[] = [
  {
    id: "car",
    baseName: "car",
    beforeExt: "jpg",
    conversions: [
      "car_1",
      "car_2",
      "car_3",
      "car_4",
      "car_5",
      "car_6",
      "car_7",
      "car_8",
      "car_9",
      "car_10",
      "car_11",
      "car_12",
      "car_13",
      "car_14",
      "car_15",
      "car_16",
    ],
    label: "Car logo",
    subject: "car logo",
  },
  {
    id: "char",
    baseName: "char",
    beforeExt: "jpg",
    conversions: ["char_1", "char_2", "char_3"],
    label: "Character graphic",
    subject: "character graphic",
  },
  {
    id: "kawaii-char",
    baseName: "kawaii_char",
    beforeExt: "jpg",
    conversions: [
      "kawaii_char_1",
      "kawaii_char_2",
      "kawaii_char_3",
      "kawaii_char_4",
      "kawaii_char_5",
      "kawaii_char_6",
      "kawaii_char_7",
      "kawaii_char_8",
      "kawaii_char_9",
      "kawaii_char_10",
      "kawaii_char_11",
      "kawaii_char_12",
    ],
    label: "Kawaii character",
    subject: "kawaii character illustration",
  },
  {
    id: "sushi",
    baseName: "sushi",
    beforeExt: "jpg",
    conversions: [
      "sushi_1",
      "sushi_2",
      "sushi_3",
      "sushi_4",
      "sushi_5",
      "sushi_6",
      "sushi_7",
    ],
    label: "Sushi graphic",
    subject: "sushi illustration",
  },
];

const ROUTE_CATEGORY_RULES: Array<{
  match: RegExp;
  category: ExampleCategory;
}> = [
  {
    match: /svg-to-(png|jpg|jpeg|webp|pdf)|favicon/i,
    category: "svg-export",
  },
  {
    match: /base64/i,
    category: "base64",
  },
  {
    match: /cricut|vinyl|stickers|print-then-cut/i,
    category: "cricut",
  },
  {
    match: /laser-cutting/i,
    category: "laser-cutting",
  },
  {
    match: /logo-to-svg/i,
    category: "logo-to-svg",
  },
  {
    match: /icon-to-svg|emoji-to-svg/i,
    category: "icon-to-svg",
  },
  {
    match: /sticker-to-svg/i,
    category: "sticker-to-svg",
  },
  {
    match: /line-art|outline|drawing|scan|sketch|black-and-white/i,
    category: "line-art-to-svg",
  },
  {
    match: /recolor|resize|scale|background|stroke|flip|rotate/i,
    category: "svg-editing",
  },
  {
    match:
      /preview|dimensions|file-size|accessibility|contrast|inline-svg-vs-img|embed/i,
    category: "inspect",
  },
  {
    match: /minifier|cleaner/i,
    category: "optimize",
  },
  {
    match: /color-picker/i,
    category: "color",
  },
  {
    match:
      /png-to-svg|jpg-to-svg|jpeg-to-svg|webp-to-svg|image-to-svg|text-to-svg/i,
    category: "general-image-to-svg",
  },
];

const CATEGORY_COPY: Record<
  ExampleCategory,
  (example: ImageExample) => CopySet
> = {
  "general-image-to-svg": (example) => ({
    title: "Example image to SVG conversion",
    description: `See how a raster ${example.subject} can be converted into a scalable SVG with cleaner edges and editable vector paths.`,
    beforeLabel: "Before: raster image",
    afterLabel: "After: converted SVG",
    beforeAlt: `Original raster ${example.subject} before image to SVG conversion`,
    afterAlt: `Converted SVG result from ${example.subject} vector conversion`,
  }),

  "logo-to-svg": (example) => ({
    title: "Example logo to SVG conversion",
    description: `See how a raster ${example.subject} can be converted into a scalable SVG logo for sharper resizing, editing, and reuse.`,
    beforeLabel: "Before: raster logo",
    afterLabel: "After: scalable SVG logo",
    beforeAlt: `Original raster ${example.subject} before logo to SVG conversion`,
    afterAlt: `Converted SVG logo result with editable vector paths`,
  }),

  "icon-to-svg": (example) => ({
    title: "Example icon-style SVG conversion",
    description: `See how a simple raster graphic can be converted into SVG for cleaner scaling, UI usage, stickers, and reusable visual assets.`,
    beforeLabel: "Before: raster graphic",
    afterLabel: "After: SVG graphic",
    beforeAlt: `Original raster ${example.subject} before icon-style SVG conversion`,
    afterAlt: `Converted SVG icon-style result from ${example.subject}`,
  }),

  "character-to-svg": (example) => ({
    title: "Example character SVG conversion",
    description: `See how a character-style raster image can be converted into an SVG graphic that stays sharp across different sizes.`,
    beforeLabel: "Before: raster character",
    afterLabel: "After: SVG character",
    beforeAlt: `Original raster ${example.subject} before SVG conversion`,
    afterAlt: `Converted SVG character result from ${example.subject}`,
  }),

  "sticker-to-svg": (example) => ({
    title: "Example sticker to SVG conversion",
    description: `See how a raster sticker-style image can be converted into SVG for cleaner edges, scaling, decals, and craft workflows.`,
    beforeLabel: "Before: raster sticker",
    afterLabel: "After: SVG sticker",
    beforeAlt: `Original raster ${example.subject} before sticker to SVG conversion`,
    afterAlt: `Converted SVG sticker result from ${example.subject}`,
  }),

  "line-art-to-svg": (example) => ({
    title: "Example outline SVG conversion",
    description: `See how a raster image can be converted into a simplified SVG-style result for outlines, tracing, line art, and clean vector output.`,
    beforeLabel: "Before: raster image",
    afterLabel: "After: SVG outline-style result",
    beforeAlt: `Original raster ${example.subject} before outline SVG conversion`,
    afterAlt: `Converted outline-style SVG result from ${example.subject}`,
  }),

  cricut: (example) => ({
    title: "Example Cricut SVG conversion",
    description: `See how raster artwork can be converted into SVG-style output for Cricut projects, decals, stickers, vinyl, and craft files.`,
    beforeLabel: "Before: raster artwork",
    afterLabel: "After: Cricut-friendly SVG",
    beforeAlt: `Original raster ${example.subject} before Cricut SVG conversion`,
    afterAlt: `Converted Cricut-friendly SVG result from ${example.subject}`,
  }),

  "laser-cutting": (example) => ({
    title: "Example laser cutting SVG conversion",
    description: `See how raster artwork can be converted into SVG-style output for outlines, engraving prep, signs, and cut path workflows.`,
    beforeLabel: "Before: raster artwork",
    afterLabel: "After: laser-cutting SVG",
    beforeAlt: `Original raster ${example.subject} before laser cutting SVG conversion`,
    afterAlt: `Converted laser-cutting SVG result from ${example.subject}`,
  }),

  "svg-editing": (example) => ({
    title: "Example editable SVG result",
    description: `After an image is converted into SVG, the result can be recolored, resized, cleaned, inspected, rotated, or exported without losing sharpness.`,
    beforeLabel: "Original raster image",
    afterLabel: "Editable SVG result",
    beforeAlt: `Original raster ${example.subject} before SVG editing workflow`,
    afterAlt: `Converted SVG result from ${example.subject} ready for editing`,
  }),

  "svg-export": (example) => ({
    title: "Example SVG export workflow",
    description: `Start with a converted SVG asset, then export it to PNG, JPG, WebP, PDF, or favicon formats depending on where the file will be used.`,
    beforeLabel: "Original raster image",
    afterLabel: "SVG asset ready to export",
    beforeAlt: `Original raster ${example.subject} before SVG export workflow`,
    afterAlt: `Converted SVG asset from ${example.subject} ready for export`,
  }),

  base64: (example) => ({
    title: "Example SVG asset for Base64 encoding",
    description: `A converted SVG can be encoded as Base64 or a data URI for use in HTML, CSS, image tags, and embedded asset workflows.`,
    beforeLabel: "Original raster image",
    afterLabel: "SVG asset ready for encoding",
    beforeAlt: `Original raster ${example.subject} before SVG Base64 workflow`,
    afterAlt: `Converted SVG asset from ${example.subject} ready for Base64 encoding`,
  }),

  inspect: (example) => ({
    title: "Example SVG inspection workflow",
    description: `Once artwork is converted into SVG, you can preview it, inspect dimensions, check file size, generate embed code, or review accessibility details.`,
    beforeLabel: "Original raster image",
    afterLabel: "SVG asset ready to inspect",
    beforeAlt: `Original raster ${example.subject} before SVG inspection workflow`,
    afterAlt: `Converted SVG asset from ${example.subject} ready for inspection`,
  }),

  optimize: (example) => ({
    title: "Example SVG cleanup workflow",
    description: `After conversion, an SVG can often be cleaned or minified to reduce file size and remove unnecessary markup before embedding or downloading.`,
    beforeLabel: "Original raster image",
    afterLabel: "SVG asset ready to optimize",
    beforeAlt: `Original raster ${example.subject} before SVG optimization workflow`,
    afterAlt: `Converted SVG asset from ${example.subject} ready for cleanup and minification`,
  }),

  color: (example) => ({
    title: "Example SVG color workflow",
    description: `Converted SVG artwork can be inspected for colors, recolored, and reused across websites, icons, stickers, and brand assets.`,
    beforeLabel: "Original raster image",
    afterLabel: "SVG asset with editable colors",
    beforeAlt: `Original raster ${example.subject} before SVG color workflow`,
    afterAlt: `Converted SVG asset from ${example.subject} with editable colors`,
  }),
};

export default function ExampleSvgConversion({
  routeSlug,
  category,
  className = "",
}: Props) {
  const location = useLocation();

  const activeSlug = React.useMemo(() => {
    if (routeSlug) return sanitizeRouteSlug(routeSlug);
    return sanitizeRouteSlug(location.pathname);
  }, [location.pathname, routeSlug]);

  const activeCategory = React.useMemo(() => {
    return category ?? getCategoryForRoute(activeSlug);
  }, [activeSlug, category]);

  const pair = React.useMemo(() => {
    return getExamplePair(activeSlug, activeCategory);
  }, [activeCategory, activeSlug]);

  const copy = CATEGORY_COPY[activeCategory](pair.example);

  const beforeSrc = getBeforeSrc(pair);
  const afterSrc = getAfterSrc(pair);

  return (
    <section
      className={[
        "mt-8 rounded-2xl border border-slate-200 bg-white p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h3 className="text-lg font-bold text-sky-950">{copy.title}</h3>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {copy.description}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ExampleImagePanel
          label={copy.beforeLabel}
          src={beforeSrc}
          alt={copy.beforeAlt}
        />

        <ExampleImagePanel
          label={copy.afterLabel}
          src={afterSrc}
          alt={copy.afterAlt}
        />
      </div>
    </section>
  );
}

function ExampleImagePanel({
  label,
  src,
  alt,
}: {
  label: string;
  src: string;
  alt: string;
}) {
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = React.useState<ImageStatus>("loading");

  React.useEffect(() => {
    const image = imageRef.current;

    setStatus("loading");

    if (!image) return;

    if (image.complete) {
      if (image.naturalWidth > 0) {
        setStatus("loaded");
      } else {
        setStatus("error");
      }
    }
  }, [src]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 text-sm font-semibold text-slate-900">{label}</div>

      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        {status === "loading" ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-0 animate-pulse bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50"
          />
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-white px-6 text-center">
            <p className="text-sm font-semibold text-slate-500">
              Preview unavailable
            </p>
          </div>
        ) : null}

        <img
          ref={imageRef}
          src={src}
          alt={alt}
          width={900}
          height={900}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={[
            "relative z-10 max-h-full max-w-full bg-white object-contain transition-all duration-300 ease-out",
            status === "loaded" ? "opacity-100 blur-0" : "opacity-0 blur-sm",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
    </div>
  );
}

function sanitizeRouteSlug(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/g, "")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

function getCategoryForRoute(routeSlug: string): ExampleCategory {
  const rule = ROUTE_CATEGORY_RULES.find((entry) =>
    entry.match.test(routeSlug),
  );
  return rule?.category ?? "general-image-to-svg";
}

function getExamplePair(
  routeSlug: string,
  category: ExampleCategory,
): ExamplePair {
  const examples = getCandidateExamplesForRoute(routeSlug, category);
  const seed = `${routeSlug}:${category}`;
  const example =
    examples[stableIndex(`${seed}:example`, examples.length)] ??
    IMAGE_EXAMPLES[0];
  const conversionName =
    example.conversions[
      stableIndex(`${seed}:${example.id}:conversion`, example.conversions.length)
    ] ??
    example.conversions[0] ??
    example.baseName;

  return {
    example,
    conversionName,
  };
}

function getCandidateExamplesForRoute(
  routeSlug: string,
  category: ExampleCategory,
): ImageExample[] {
  if (/logo|car|vehicle|paint/i.test(routeSlug)) {
    return [getExampleById("car")];
  }

  if (/emoji|character|char|kawaii/i.test(routeSlug)) {
    return [getExampleById("kawaii-char"), getExampleById("char")];
  }

  if (/sushi|food|restaurant/i.test(routeSlug)) {
    return [getExampleById("sushi")];
  }

  if (/sticker|cricut|vinyl|print-then-cut|craft/i.test(routeSlug)) {
    return [getExampleById("kawaii-char"), getExampleById("sushi")];
  }

  if (/icon|favicon|recolor|color/i.test(routeSlug)) {
    return [getExampleById("char"), getExampleById("kawaii-char")];
  }

  if (
    /line-art|outline|drawing|scan|sketch|black-and-white|laser/i.test(
      routeSlug,
    )
  ) {
    return [getExampleById("car"), getExampleById("char")];
  }

  if (/text-to-svg/i.test(routeSlug)) {
    return [getExampleById("char")];
  }

  if (category === "sticker-to-svg" || category === "cricut") {
    return [getExampleById("kawaii-char"), getExampleById("sushi")];
  }

  if (category === "laser-cutting") {
    return [getExampleById("car"), getExampleById("char")];
  }

  if (category === "logo-to-svg" || category === "svg-export") {
    return [getExampleById("car")];
  }

  if (category === "icon-to-svg" || category === "color") {
    return [getExampleById("char"), getExampleById("kawaii-char")];
  }

  return IMAGE_EXAMPLES;
}

function getExampleById(id: string) {
  return (
    IMAGE_EXAMPLES.find((example) => example.id === id) ?? IMAGE_EXAMPLES[0]
  );
}

function getBeforeSrc(pair: ExamplePair) {
  return `${ASSET_BASE_URL}/${pair.example.baseName}.${pair.example.beforeExt}`;
}

function getAfterSrc(pair: ExamplePair) {
  return `${ASSET_BASE_URL}/${pair.conversionName}.svg`;
}

function stableIndex(seed: string, length: number) {
  if (length <= 1) return 0;

  let hash = 2166136261;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % length;
}
