import * as React from "react";
import {
  applyLayerEditsToSvg,
  type EditableSvgLayer,
} from "~/client/components/svg/LayerPaletteEditor";

type EditablePreviewLayer = {
  id: string;
  label?: string;
  name?: string;
  color: string;
  originalColor?: string;
  visible: boolean;
  kind?: string;
  opacity?: number;
  originalOpacity?: number;
};

type EditedSvgPreviewImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  svg: string;
  layers?: ReadonlyArray<EditablePreviewLayer> | null;
};

const LARGE_EDITED_SVG_PREVIEW_OBJECT_URL_THRESHOLD_BYTES = 1_000_000;
const EMPTY_SVG_PREVIEW_SRC =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";

export function getEditedSvg(
  svg: string,
  layers?: ReadonlyArray<EditablePreviewLayer> | null,
): string {
  const edited = layers?.length
    ? applyLayerEditsToSvg(svg, layers as EditableSvgLayer[])
    : svg;
  return ensureSvgRootNamespace(edited);
}

export function ensureSvgRootNamespace(svg: string): string {
  return String(svg).replace(/<svg\b([^>]*)>/i, (match, attrs) => {
    if (/\sxmlns\s*=/i.test(String(attrs))) return match;
    return `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>`;
  });
}

export function useEditedSvgPreview(
  svg: string,
  layers?: ReadonlyArray<EditablePreviewLayer> | null,
) {
  const editedSvg = React.useMemo(() => getEditedSvg(svg, layers), [svg, layers]);
  const useObjectUrl =
    getSvgByteSize(editedSvg) >= LARGE_EDITED_SVG_PREVIEW_OBJECT_URL_THRESHOLD_BYTES &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function";
  const dataUrlSrc = React.useMemo(
    () =>
      useObjectUrl
        ? EMPTY_SVG_PREVIEW_SRC
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(editedSvg)}`,
    [editedSvg, useObjectUrl],
  );
  const [objectUrlSrc, setObjectUrlSrc] = React.useState("");

  React.useEffect(() => {
    if (!useObjectUrl) {
      setObjectUrlSrc("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([editedSvg], { type: "image/svg+xml" }),
    );
    setObjectUrlSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [editedSvg, useObjectUrl]);

  return { editedSvg, src: useObjectUrl ? objectUrlSrc || dataUrlSrc : dataUrlSrc };
}

export const EditedSvgPreviewImage = React.memo(function EditedSvgPreviewImage({
  svg,
  layers,
  ...imageProps
}: EditedSvgPreviewImageProps) {
  const { src } = useEditedSvgPreview(svg, layers);

  return <img src={src} {...imageProps} />;
});

function getSvgByteSize(svg: string): number {
  if (typeof Blob !== "undefined") {
    return new Blob([svg]).size;
  }
  return new TextEncoder().encode(svg).length;
}
