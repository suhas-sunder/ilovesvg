import * as React from "react";
import {
  useNativeColorFinalCommit,
  useThrottledCommit,
} from "~/client/hooks/useThrottledCommit";

type ThrottledColorInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "onInput"
> & {
  value?: string;
  defaultValue?: string;
  delayMs?: number;
  onCommit: (value: string) => void;
};

export function ThrottledColorInput({
  value,
  defaultValue = "#000000",
  delayMs = 180,
  onCommit,
  ...inputProps
}: ThrottledColorInputProps) {
  const normalizedValue =
    normalizeNativeColor(value) ||
    normalizeNativeColor(defaultValue) ||
    "#000000";
  const controller = useThrottledCommit({
    value: normalizedValue,
    onCommit,
    delayMs,
    leading: false,
    normalize: normalizeNativeColor,
  });
  const colorInputRef = useNativeColorFinalCommit((nextValue) =>
    controller.flush(nextValue),
  );

  return (
    <input
      {...inputProps}
      ref={colorInputRef}
      type="color"
      value={controller.draft}
      onInput={(event) => controller.schedule(event.currentTarget.value)}
      onChange={(event) => controller.schedule(event.currentTarget.value)}
      onPointerUp={() => controller.flush()}
      onMouseUp={() => controller.flush()}
      onTouchEnd={() => controller.flush()}
      onBlur={() => controller.flush()}
    />
  );
}

function normalizeNativeColor(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}
