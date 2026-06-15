import { mdiCircleOutline, mdiLoading } from "@mdi/js";
import React, {
  type ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

export type ButtonBrand = "primary" | "info" | "neutral" | "success" | "premium";
export type ButtonAppearance = "weak" | "subdued" | "moderate" | "strong";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  brand?: ButtonBrand;
  appearance?: ButtonAppearance;
  isLoading?: boolean;
  size?: "xs" | "sm" | "md";
  children?: string;
  customContent?: ReactNode;
  disabled?: boolean;
  href?: never;
  isExternal?: never;
} & XOr<{ leftIconPath?: string }, { leftIcon?: ReactNode }> &
  XOr<{ rightIconPath?: string }, { rightIcon?: ReactNode }>;

const ButtonIcon = ({
  icon,
  isLoading = false,
  path,
}: {
  icon?: ReactNode;
  isLoading?: boolean;
  path?: string;
}) => {
  if (isLoading) {
    return (
      <span className="nxm-button-icon relative animate-spin">
        <Icon className="opacity-40" path={mdiCircleOutline} size="none" />

        <Icon className="absolute inset-0" path={mdiLoading} size="none" />
      </span>
    );
  }

  if (isValidElement(icon)) {
    const element = icon as ReactElement<{ className?: string }>;

    return cloneElement(element, {
      className: joinClasses(["nxm-button-icon", element.props.className]),
    });
  }

  if (path) {
    return <Icon className="nxm-button-icon" path={path} size="none" />;
  }

  return null;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      "aria-disabled": ariaDisabled,
      appearance = "strong",
      brand = "primary",
      children,
      className,
      customContent,
      disabled,
      isExternal,
      isLoading = false,
      leftIcon,
      leftIconPath,
      rightIcon,
      rightIconPath,
      size = "md",
      type,
      ...props
    },
    ref,
  ) => (
    <button
      aria-disabled={ariaDisabled}
      className={joinClasses(
        ["nxm-button", `nxm-button-${brand}`, `nxm-button-${appearance}`, className],
        {
          "nxm-button-disabled": !!disabled || !!ariaDisabled || isLoading,
          "nxm-button-icon-only": !customContent && !children,
          "nxm-button-xs": size === "xs",
          "nxm-button-sm": size === "sm",
        },
      )}
      disabled={disabled || isLoading}
      ref={ref}
      type={type ?? "button"}
      {...props}
    >
      {customContent ?? (
        <>
          <ButtonIcon icon={leftIcon} isLoading={isLoading} path={leftIconPath} />

          {!!children && <span>{children}</span>}

          <ButtonIcon icon={rightIcon} path={rightIconPath} />
        </>
      )}
    </button>
  ),
);
