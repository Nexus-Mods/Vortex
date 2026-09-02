import type { HTMLAttributes } from "react";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

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
  none: "",
} as const satisfies Record<string, string>;

/** Colour family, `none` leaves the pictogram uncoloured. */
export type IPictogramBrand = "none" | "premium" | "primary";

const brandMap = {
  none: "",
  premium: "text-premium-strong",
  primary: "text-primary-moderate",
} as const satisfies Record<IPictogramBrand, string>;

export type IPictogramName =
  | "game"
  | "health-check"
  | "mod"
  | "no-mod"
  | "preferences"
  | "premium"
  | "puzzle-piece"
  | "settings"
  | "tools";

export const Pictogram = ({
  brand = "primary",
  className,
  name,
  size = "md",
  ...props
}: HTMLAttributes<SVGElement> & {
  brand?: IPictogramBrand;
  className?: string;
  name: IPictogramName;
  size?: keyof typeof sizeMap;
}) => (
  <svg
    {...props}
    className={joinClasses(["shrink-0", className, sizeMap[size], brandMap[brand]])}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <use href={`assets/pictograms/${name}.svg`} />
  </svg>
);
