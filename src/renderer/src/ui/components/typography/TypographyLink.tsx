import React, { type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";

import { type IIconProp, type IIconSize, IconSlot } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { ResponsiveScreenSizes, XOr } from "@/ui/utils/types";

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
  /** The size of both icons. Default `md`. */
  iconSize?: IIconSize;
  /** An icon shown before the label. */
  leftIcon?: IIconProp;
  /** Forwarded to the button. */
  ref?: Ref<HTMLButtonElement>;
  /** An icon shown after the label. */
  rightIcon?: IIconProp;
  /** The type style, or one per screen size; `body-md` by default, `inherit` to take the parent's. */
  typographyType?: ITypographyLinkTypes | ITypographyLinkTypeObject;
  /** `primary` is always underlined, `secondary` only on hover or focus, `none` never. */
  variant?: "primary" | "secondary" | "none";
} & XOr<
    {
      /** The label, shown between the icons. */
      children?: string;
    },
    {
      /** Content shown in place of the label and icons. */
      customContent: ReactNode;
    }
  > &
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
  leftIcon,
  rightIcon,
}: Pick<ITypographyLinkProps, "iconSize" | "leftIcon" | "rightIcon"> & {
  label?: string;
}) => (
  <>
    <IconSlot className="shrink-0" icon={leftIcon} size={iconSize} />

    {label}

    <IconSlot className="shrink-0" icon={rightIcon} size={iconSize} />
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
  iconSize = "md",
  leftIcon,
  ref,
  rightIcon,
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
          typographyType: typographyType as Exclude<
            ITypographyProps["typographyType"],
            "inherit" | undefined
          >,
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
          leftIcon={leftIcon}
          rightIcon={rightIcon}
        />
      )}
    </button>
  );
};
