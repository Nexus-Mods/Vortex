import React, { type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";
import type { ResponsiveScreenSizes, XOr } from "@/ui/utils/types";

import { Icon, type IIconSize } from "../icon/Icon";
import {
  getTypographyColourClass,
  getTypographyStyles,
  type ITypographyAppearance,
  type ITypographyColour,
  type ITypographyProps,
  type ITypographyTypes,
} from "./Typography";

type ITypographyLinkTypes = ITypographyTypes | "inherit";

type ITypographyLinkTypeObjectDefault = {
  [key in Extract<ResponsiveScreenSizes, "default">]: ITypographyLinkTypes;
};
type ITypographyLinkTypeObject = ITypographyLinkTypeObjectDefault & {
  [key in Exclude<ResponsiveScreenSizes, "default">]?: ITypographyLinkTypes;
};

export type ITypographyLinkProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  iconSize?: IIconSize;
  leftIconPath?: string;
  ref?: Ref<HTMLButtonElement>;
  rightIconPath?: string;
  typographyType?: ITypographyLinkTypes | ITypographyLinkTypeObject;
  variant?: "primary" | "secondary" | "none";
} & XOr<{ children?: string }, { customContent: ReactNode }> &
  ITypographyColour;

// On hover, the colour shifts one step toward `strong`; `strong` (already the
// lightest) dims to `moderate` instead, so every appearance gives feedback.
const hoverAppearanceMap: Record<ITypographyAppearance, ITypographyAppearance> = {
  weak: "subdued",
  subdued: "moderate",
  moderate: "strong",
  strong: "moderate",
};

const LinkContent = ({
  iconSize,
  label,
  leftIconPath,
  rightIconPath,
}: Pick<ITypographyLinkProps, "iconSize" | "leftIconPath" | "rightIconPath"> & {
  label?: string;
}) => (
  <>
    {!!leftIconPath && <Icon className="shrink-0" path={leftIconPath} size={iconSize} />}

    {label}

    {!!rightIconPath && <Icon className="shrink-0" path={rightIconPath} size={iconSize} />}
  </>
);

export const TypographyLink = ({
  appearance = "strong",
  "aria-disabled": ariaDisabled,
  brand = "neutral",
  children,
  className,
  customContent,
  disabled,
  iconSize,
  leftIconPath,
  ref,
  rightIconPath,
  typographyType = "body-md",
  variant = "primary",
  ...props
}: ITypographyLinkProps) => {
  const isDisabled = ariaDisabled === true || ariaDisabled === "true" || !!disabled;

  const variantClasses: Record<Exclude<ITypographyLinkProps["variant"], undefined>, string> = {
    none: "",
    primary: "nxm-link-variant-primary",
    secondary: "nxm-link-variant-secondary",
  };

  const hoverColourClass =
    !isDisabled && brand !== "none" && appearance !== "inverted"
      ? `hover:${getTypographyColourClass(brand, hoverAppearanceMap[appearance])}`
      : "";

  // `inherit` opts out of the typography sizing; otherwise apply the shared styles.
  const typographyClasses =
    typographyType === "inherit"
      ? []
      : getTypographyStyles({
          typographyType: typographyType as ITypographyProps["typographyType"],
        });

  return (
    <button
      className={joinClasses(
        [
          "nxm-link",
          variantClasses[variant],
          getTypographyColourClass(brand, appearance),
          hoverColourClass,
          ...typographyClasses,
          className,
        ],
        { "nxm-link-disabled": isDisabled },
      )}
      disabled={disabled}
      ref={ref}
      {...props}
    >
      {customContent ?? (
        <LinkContent
          iconSize={iconSize}
          label={children}
          leftIconPath={leftIconPath}
          rightIconPath={rightIconPath}
        />
      )}
    </button>
  );
};
