import React, { type SVGAttributes } from "react";

import { joinClasses } from "../utils";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "none";

const sizeMap: { [key in IconSize]: string | undefined } = {
  none: undefined,
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
  "2xl": "size-12",
};

export const Icon = ({
  path,
  size = "md",
  className,
  title,
  ...props
}: Omit<SVGAttributes<SVGSVGElement>, "size" | "path"> & {
  path: string;
  size?: IconSize;
  title?: string;
}) => (
  <svg
    className={joinClasses([sizeMap[size], className])}
    role={title ? "img" : "presentation"}
    viewBox="0 0 24 24"
    {...props}
  >
    {title && <title>{title}</title>}

    <path d={path} fill="currentColor" />
  </svg>
);
