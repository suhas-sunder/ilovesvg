// src/components/icons/IconBase.tsx
import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number; // px
  title?: string;
};

export default function Icons({
  size = 24,
  title,
  children,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      focusable="false"
      fill="currentColor"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
