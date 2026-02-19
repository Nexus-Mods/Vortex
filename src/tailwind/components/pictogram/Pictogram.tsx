import React from "react";
import type { HTMLAttributes } from "react";
import { joinClasses } from "../../../renderer/ui/utils/joinClasses";

/* eslint-disable sort-keys */
const sizeMap = {
  "4xs": "size-4",
  "3xs": "size-6",
  "2xs": "size-9",
  xs: "size-12",
  sm: "size-14",
  md: "size-20",
  lg: "size-24",
  xl: "size-28",
  "2xl": "size-40",
} as const satisfies Record<string, string>;
/* eslint-enable sort-keys */

type Theme = "creator" | "info" | "none" | "premium" | "primary";

const themeMap = {
  creator: "text-creator-moderate",
  info: "text-info-moderate",
  none: "",
  premium: "text-premium-moderate",
  primary: "text-primary-moderate",
} as const satisfies Record<Theme, string>;

export type PictogramName = "health-check";

export const Pictogram = ({
  className,
  name,
  size = "md",
  theme = "primary",
  ...props
}: HTMLAttributes<SVGElement> & {
  className?: string;
  name: PictogramName;
  size?: keyof typeof sizeMap;
  theme?: Theme;
}) => (
  <svg
    {...props}
    className={joinClasses([
      "shrink-0",
      className,
      sizeMap[size],
      themeMap[theme],
    ])}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <use href={`assets/pictograms/${name}.svg`} />
  </svg>
);
