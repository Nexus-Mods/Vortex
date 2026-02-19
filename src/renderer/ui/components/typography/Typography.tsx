/**
 * Typography Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent typography system with predefined sizes and appearances.
 */

import { createElement, type AllHTMLAttributes, type Ref } from "react";

import type { ResponsiveScreenSizes } from "../../utils/types";

import { joinClasses } from "../../utils/join_classes";

export type TypographyTypes =
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

type TypographyTypeObjectDefault = {
  [key in Extract<ResponsiveScreenSizes, "default">]: TypographyTypes;
};
type TypographyTypeObject = TypographyTypeObjectDefault & {
  [key in Exclude<ResponsiveScreenSizes, "default">]?: TypographyTypes;
};

export type TypographyElements =
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

export interface TypographyProps extends AllHTMLAttributes<HTMLElement> {
  /**
   * The text colour
   */
  appearance?: "inverted" | "moderate" | "strong" | "subdued" | "weak" | "none";
  as?: TypographyElements;
  isTranslucent?: boolean;
  ref?: Ref<HTMLElement>;
  typographyType?: TypographyTypes | TypographyTypeObject;
}

const typeFallbacks: Record<TypographyElements, TypographyTypes> = {
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

const toClasses = (type: TypographyTypes, prefix = "") => {
  const classes = [`${prefix}text-${type}`];

  if (type.startsWith("title-")) {
    classes.push(`${prefix}uppercase`);
  }

  return classes;
};

const getTypographyStyles = ({
  as,
  typographyType,
}: {
  as: TypographyProps["as"];
  typographyType: TypographyProps["typographyType"];
}) => {
  if (typeof typographyType === "object") {
    return Object.entries(typographyType).flatMap(([size, type]) =>
      !type ? [] : toClasses(type, size === "default" ? "" : `${size}:`),
    );
  }

  return toClasses(typographyType ?? typeFallbacks[as]);
};

export const Typography = ({
  appearance = "strong",
  as = "p",
  children,
  className,
  isTranslucent = false,
  typographyType,
  ...props
}: TypographyProps) => {
  const appearanceClasses: Record<
    Exclude<TypographyProps["appearance"], undefined>,
    string
  > = {
    none: "",
    inverted: isTranslucent
      ? "text-translucent-dark-950"
      : "text-neutral-inverted",
    moderate: isTranslucent
      ? "text-neutral-translucent-moderate"
      : "text-neutral-moderate",
    strong: isTranslucent
      ? "text-neutral-translucent-strong"
      : "text-neutral-strong",
    subdued: isTranslucent
      ? "text-neutral-translucent-subdued"
      : "text-neutral-subdued",
    weak: isTranslucent ? "text-neutral-translucent-weak" : "text-neutral-weak",
  };

  return createElement(
    as,
    {
      className: joinClasses([
        ...getTypographyStyles({ as, typographyType }),
        appearanceClasses[appearance],
        className,
      ]),
      ...props,
    },
    children,
  );
};
