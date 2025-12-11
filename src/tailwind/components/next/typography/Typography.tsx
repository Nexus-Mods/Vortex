/**
 * Typography Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent typography system with predefined sizes and appearances.
 */

import * as React from "react";
import { AllHTMLAttributes, createElement, Ref } from "react";
import { joinClasses, ResponsiveScreenSizes } from "../utils";

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

const getTypographyStyles = ({
  as,
  typographyType,
}: {
  as: TypographyProps["as"];
  typographyType: TypographyProps["typographyType"];
}) => {
  const styles: string[] = [];

  const typeFallbacks: { [key in TypographyElements]: string } = {
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

  if (!typographyType || typeof typographyType === "string") {
    styles.push(
      `tw:typography-${
        typeof typographyType === "string"
          ? typographyType
          : (typeFallbacks[as as keyof typeof typeFallbacks] as TypographyTypes)
      }`,
    );
  } else {
    Object.keys(typographyType).forEach((size) => {
      const screenSize = size as ResponsiveScreenSizes;
      const style = typographyType[screenSize];

      if (style) {
        styles.push(
          `${screenSize === "default" ? "tw:" : `${screenSize}:tw:`}typography-${style}`,
        );
      }
    });
  }

  return styles;
};

export const Typography: React.ComponentType<TypographyProps> = ({
  appearance = "inverted",
  as = "p",
  children,
  className,
  isTranslucent = false,
  typographyType,
  ...props
}) => {
  /* eslint-disable sort-keys */
  const appearanceClasses: Record<
    Exclude<TypographyProps["appearance"], undefined>,
    string
  > = {
    none: "",
    inverted: isTranslucent
      ? "tw:text-translucent-dark-950"
      : "tw:text-neutral-inverted",
    moderate: isTranslucent
      ? "tw:text-neutral-translucent-moderate"
      : "tw:text-neutral-moderate",
    strong: isTranslucent
      ? "tw:text-neutral-translucent-strong"
      : "tw:text-neutral-strong",
    subdued: isTranslucent
      ? "tw:text-neutral-translucent-subdued"
      : "tw:text-neutral-subdued",
    weak: isTranslucent
      ? "tw:text-neutral-translucent-weak"
      : "tw:text-neutral-weak",
  };
  /* eslint-enable sort-keys */

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
