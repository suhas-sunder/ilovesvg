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

export function getEditedSvg(
  svg: string,
  layers?: ReadonlyArray<EditablePreviewLayer> | null,
): string {
  if (!layers?.length) return svg;
  return applyLayerEditsToSvg(svg, layers as EditableSvgLayer[]);
}

export function useEditedSvgPreview(
  svg: string,
  layers?: ReadonlyArray<EditablePreviewLayer> | null,
) {
  const editedSvg = React.useMemo(() => getEditedSvg(svg, layers), [svg, layers]);
  const src = React.useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(editedSvg)}`,
    [editedSvg],
  );

  return { editedSvg, src };
}

export const EditedSvgPreviewImage = React.memo(function EditedSvgPreviewImage({
  svg,
  layers,
  ...imageProps
}: EditedSvgPreviewImageProps) {
  const { src } = useEditedSvgPreview(svg, layers);

  return <img src={src} {...imageProps} />;
});
