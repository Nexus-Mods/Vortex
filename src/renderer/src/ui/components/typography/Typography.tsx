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
  | "ul"
  | "ol";

/** Colour family. */
export type ITypographyBrand =
  | "neutral"
  | "neutral-translucent"
  | "neutral-on-scrim"
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
 * - `neutral-on-scrim` is for text laid on a scrim, and draws from the fixed `on-scrim`
 *   ramp — it stays light whatever the theme, because the scrim beneath it stays dark.
 *   Named like `neutral-translucent`: achromatic, but from a ramp of its own.
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
  /** The element rendered; `p` by default. */
  as?: ITypographyElements;
  /** Forwarded to the rendered element. */
  ref?: Ref<HTMLElement>;
  /** The type style, or one per screen size; `body-md` by default, `inherit` to take the parent's. */
  typographyType?: ITypographyTypes | ITypographyTypeObject | "inherit";
} & ITypographyColour;

const toClasses = (type: ITypographyTypes, prefix = "") => {
  const classes = [`${prefix}text-${type}`];

  if (type.startsWith("title-")) {
    classes.push(`${prefix}uppercase`);
  }

  return classes;
};

export const getTypographyStyles = ({
  typographyType,
}: {
  typographyType: ITypographyTypes | ITypographyTypeObject;
}) => {
  if (typeof typographyType === "object") {
    return Object.entries(typographyType).flatMap(([size, type]) =>
      !type ? [] : toClasses(type, size === "default" ? "" : `${size}:`),
    );
  }

  return toClasses(typographyType);
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

  // The token family is `on-scrim`: the colour to use *on* a scrim, not the scrim itself.
  if (brand === "neutral-on-scrim") {
    return `text-on-scrim-${appearance}`;
  }

  return `text-${brand}-${appearance}`;
};

/**
 * A block of text in one type style and colour, which its descendants inherit. Wrap a list
 * or several paragraphs in one, rather than one per item:
 *
 * ```tsx
 * <Typography as="ul" className="list-inside list-disc space-y-2">
 *   <li>First</li>
 *   <li>Second</li>
 * </Typography>
 *
 * <Typography as="div" className="space-y-2">
 *   <p>First paragraph.</p>
 *   <p>Second paragraph.</p>
 * </Typography>
 * ```
 *
 * Nest another only where the style changes, such as a heading or a subdued line. One that
 * changes only the colour takes `typographyType="inherit"`, keeping its parent's type style
 * rather than resetting it to `body-md`.
 */
export const Typography = ({
  appearance = "strong",
  as = "p",
  brand = "neutral",
  children,
  className,
  typographyType = "body-md",
  ...props
}: ITypographyProps) => {
  return createElement(
    as,
    {
      className: joinClasses([
        ...(typographyType === "inherit" ? [] : getTypographyStyles({ typographyType })),
        getTypographyColourClass(brand, appearance),
        className,
      ]),
      ...props,
    },
    children,
  );
};
