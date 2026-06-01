import React, { type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";

import { joinClasses } from "../../utils/joinClasses";
import type { ResponsiveScreenSizes, XOr } from "../../utils/types";
import type { IconSize } from "../icon/Icon";
import { Icon } from "../icon/Icon";
import { type TypographyProps, type TypographyTypes, getTypographyStyles } from "./Typography";

type TypographyButtonTypes = TypographyTypes | "inherit";

type TypographyButtonTypeObjectDefault = {
  [key in Extract<ResponsiveScreenSizes, "default">]: TypographyButtonTypes;
};
type TypographyButtonTypeObject = TypographyButtonTypeObjectDefault & {
  [key in Exclude<ResponsiveScreenSizes, "default">]?: TypographyButtonTypes;
};

export type TypographyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * The text colour
   */
  appearance?: "info" | "premium" | "primary" | "moderate" | "strong" | "subdued" | "none";
  iconSize?: IconSize;
  leftIconPath?: string;
  ref?: Ref<HTMLButtonElement>;
  rightIconPath?: string;
  typographyType?: TypographyButtonTypes | TypographyButtonTypeObject;
  variant?: "primary" | "secondary" | "none";
} & XOr<{ children?: string }, { customContent: ReactNode }>;

const ButtonContent = ({
  iconSize,
  label,
  leftIconPath,
  rightIconPath,
}: Pick<TypographyButtonProps, "iconSize" | "leftIconPath" | "rightIconPath"> & {
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
  children,
  className: additionalClasses = "",
  customContent,
  disabled,
  iconSize,
  leftIconPath,
  ref,
  rightIconPath,
  typographyType = "body-md",
  variant = "primary",
  ...props
}: TypographyButtonProps) => {
  const variantClasses: Record<Exclude<TypographyButtonProps["variant"], undefined>, string> = {
    none: "",
    primary: "nxm-link-variant-primary",
    secondary: "nxm-link-variant-secondary",
  };

  const appearanceClasses: Record<
    Exclude<TypographyButtonProps["appearance"], undefined>,
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
      "nxm-link-disabled": ariaDisabled === true || ariaDisabled === "true" || disabled,
    },
  );

  return (
    <button className={className} disabled={disabled} ref={ref} {...props}>
      {customContent ?? (
        <ButtonContent
          iconSize={iconSize}
          label={children}
          leftIconPath={leftIconPath}
          rightIconPath={rightIconPath}
        />
      )}
    </button>
  );
};
