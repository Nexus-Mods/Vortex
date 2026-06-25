/**
 * Typography Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent typography system with predefined sizes and appearances.
 */

import { createElement, type AllHTMLAttributes, type Ref } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";
import type { ResponsiveScreenSizes } from "@/ui/utils/types";

export type ITypographyTypes =
  | "heading-2xl"
  | "heading-xl"
  | "heading-lg"
  | "heading-md"
  | "heading-sm"
  | "heading-xs"
  | "title-md"
  | "title-sm"
  | "title-xs"
  | "body-xl"
  | "body-2xl"
  | "body-lg"
  | "body-md"
  | "body-sm"
  | "body-xs";

type ITypographyTypeObjectDefault = {
  [key in Extract<ResponsiveScreenSizes, "default">]: ITypographyTypes;
};
type ITypographyTypeObject = ITypographyTypeObjectDefault & {
  [key in Exclude<ResponsiveScreenSizes, "default">]?: ITypographyTypes;
};

export type ITypographyElements =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "div"
  | "ul";

/** Colour family. */
export type ITypographyBrand =
  | "neutral"
  | "neutral-translucent"
  | "premium"
  | "primary"
  | "info"
  | "success"
  | "danger"
  | "warning"
  | "none";

/** Colour intensity. */
export type ITypographyAppearance = "weak" | "subdued" | "moderate" | "strong";

/**
 * Text colour, expressed as a `brand` (colour family) × `appearance`
 * (intensity) pair:
 *
 * - `brand` defaults to `neutral`; only `neutral` and `neutral-translucent` support `inverted`.
 * - `neutral-translucent` uses the shared white-alpha translucent ramp.
 * - `brand="none"` opts out of colour styling entirely, so `appearance` is
 *   redundant and disallowed (the element inherits its colour).
 */
export type ITypographyColour =
  | { brand?: "neutral" | "neutral-translucent"; appearance?: ITypographyAppearance | "inverted" }
  | {
      brand: Exclude<ITypographyBrand, "neutral" | "neutral-translucent" | "none">;
      appearance?: ITypographyAppearance;
    }
  | { brand: "none"; appearance?: never };

export type ITypographyProps = AllHTMLAttributes<HTMLElement> & {
  as?: ITypographyElements;
  ref?: Ref<HTMLElement>;
  typographyType?: ITypographyTypes | ITypographyTypeObject;
} & ITypographyColour;

const typeFallbacks: Record<ITypographyElements, ITypographyTypes> = {
  div: "body-md",
  h1: "heading-2xl",
  h2: "heading-xl",
  h3: "heading-lg",
  h4: "heading-md",
  h5: "heading-sm",
  h6: "heading-xs",
  p: "body-md",
  span: "body-md",
  ul: "body-md",
};

const toClasses = (type: ITypographyTypes, prefix = "") => {
  const classes = [`${prefix}text-${type}`];

  if (type.startsWith("title-")) {
    classes.push(`${prefix}uppercase`);
  }

  return classes;
};

export const getTypographyStyles = ({
  as = "span",
  typographyType,
}: {
  as?: ITypographyProps["as"];
  typographyType: ITypographyProps["typographyType"];
}) => {
  if (typeof typographyType === "object") {
    return Object.entries(typographyType).flatMap(([size, type]) =>
      !type ? [] : toClasses(type, size === "default" ? "" : `${size}:`),
    );
  }

  return toClasses(typographyType ?? typeFallbacks[as]);
};

// Shared by Typography and TypographyLink — maps a brand × appearance pair to a
// Tailwind text-colour utility.
export const getTypographyColourClass = (
  brand: ITypographyBrand,
  appearance: ITypographyAppearance | "inverted",
): string => {
  // `none` opts out of colour entirely — the element inherits its colour.
  if (brand === "none") {
    return "";
  }

  // Uses the shared white-alpha translucent ramp.
  if (brand === "neutral-translucent") {
    return `text-translucent-${appearance}`;
  }

  return `text-${brand}-${appearance}`;
};

export const Typography = ({
  appearance = "strong",
  as = "p",
  brand = "neutral",
  children,
  className,
  typographyType,
  ...props
}: ITypographyProps) => {
  return createElement(
    as,
    {
      className: joinClasses([
        ...getTypographyStyles({ as, typographyType }),
        getTypographyColourClass(brand, appearance),
        className,
      ]),
      ...props,
    },
    children,
  );
};
