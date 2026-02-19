/**
 * Typography Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent typography system with predefined sizes and appearances.
 */

import * as React from "react";
import type {
  AllHTMLAttributes,
  AnchorHTMLAttributes,
  ReactNode,
  Ref,
} from "react";
import { createElement } from "react";

import type { ResponsiveScreenSizes, XOr } from "../../utils/types";
import type { IconSize } from "../icon/Icon";

import { joinClasses } from "../../utils/joinClasses";
import { Icon } from "../icon/Icon";

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
  as = "span",
  typographyType,
}: {
  as?: TypographyProps["as"];
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

//
type TypographyLinkAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  as?: "a";
  disabled?: never;
  isExternal?: boolean;
  ref?: Ref<HTMLAnchorElement>;
};

type TypographyLinkButtonProps = AllHTMLAttributes<
  HTMLAnchorElement | HTMLButtonElement
> & {
  as: "button";
  disabled?: boolean;
  href?: never;
  isExternal?: never;
  ref?: Ref<HTMLAnchorElement | HTMLButtonElement>;
};

type TypographyLinkTypes = TypographyTypes | "inherit";

type TypographyLinkTypeObjectDefault = {
  [key in Extract<ResponsiveScreenSizes, "default">]: TypographyLinkTypes;
};
type TypographyLinkTypeObject = TypographyLinkTypeObjectDefault & {
  [key in Exclude<ResponsiveScreenSizes, "default">]?: TypographyLinkTypes;
};

export type TypographyLinkProps = (
  | TypographyLinkAnchorProps
  | TypographyLinkButtonProps
) & {
  /**
   * The text colour
   */
  appearance?:
    | "info"
    | "premium"
    | "primary"
    | "moderate"
    | "strong"
    | "subdued"
    | "none";
  iconSize?: IconSize;
  leftIconPath?: string;
  rightIconPath?: string;
  typographyType?: TypographyLinkTypes | TypographyLinkTypeObject;
  variant?: "primary" | "secondary" | "none";
} & XOr<{ children?: string }, { customContent: ReactNode }>;

const LinkContent = ({
  iconSize,
  label,
  leftIconPath,
  rightIconPath,
}: Pick<TypographyLinkProps, "iconSize" | "leftIconPath" | "rightIconPath"> & {
  label?: string;
}) => (
  <>
    {!!leftIconPath && (
      <Icon className="shrink-0" path={leftIconPath} size={iconSize} />
    )}

    {label}

    {!!rightIconPath && (
      <Icon className="shrink-0" path={rightIconPath} size={iconSize} />
    )}
  </>
);

export const TypographyLink = ({
  appearance = "strong",
  "aria-disabled": ariaDisabled,
  as = "a",
  children,
  className: additionalClasses = "",
  customContent,
  disabled,
  href,
  iconSize,
  isExternal,
  leftIconPath,
  ref,
  rightIconPath,
  typographyType = "body-md",
  variant = "primary",
  ...props
}: TypographyLinkProps) => {
  const variantClasses: Record<
    Exclude<TypographyLinkProps["variant"], undefined>,
    string
  > = {
    none: "",
    primary: "nxm-link-variant-primary",
    secondary: "nxm-link-variant-secondary",
  };

  /* eslint-disable sort-keys */
  const appearanceClasses: Record<
    Exclude<TypographyLinkProps["appearance"], undefined>,
    string
  > = {
    none: "",
    info: "nxm-link-info",
    premium: "nxm-link-premium",
    primary: "nxm-link-primary",
    moderate: "nxm-link-moderate",
    strong: "nxm-link-strong",
    subdued: "nxm-link-subdued",
  };
  /* eslint-enable sort-keys */

  const className = joinClasses(
    [
      "nxm-link",
      variantClasses[variant],
      appearanceClasses[appearance],
      ...(typographyType !== "inherit"
        ? getTypographyStyles({
            typographyType: typographyType as TypographyProps["typographyType"],
          })
        : []),
      additionalClasses,
    ],
    {
      "nxm-link-disabled":
        ariaDisabled === true || ariaDisabled === "true" || disabled,
    },
  );

  return createElement(
    as,
    {
      className,
      ref,
      ...(as === "a"
        ? {
            href,
            ...(isExternal ? { rel: "noreferrer", target: "_blank" } : {}),
          }
        : { disabled }),
      ...props,
    },
    <>
      {customContent ?? (
        <LinkContent
          iconSize={iconSize}
          label={children}
          leftIconPath={leftIconPath}
          rightIconPath={rightIconPath}
        />
      )}
    </>,
  );
};
