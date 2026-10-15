import React, {
  type ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { Icon, type ISymbolSource, symbolProps } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

export type IButtonBrand = "primary" | "info" | "neutral" | "success" | "danger" | "premium";
export type IButtonAppearance = "weak" | "subdued" | "moderate" | "strong";

/** `scrim` paints a scrim, which only reads on the achromatic brand, so it is neutral-only. */
export type IButtonColour =
  | { appearance?: IButtonAppearance; brand?: IButtonBrand }
  | { appearance: "scrim"; brand: "neutral" };

export type IButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  hasExpandedStyle?: boolean;
  isLoading?: boolean;
  size?: "sm" | "md";
  children?: string;
  customContent?: ReactNode;
  disabled?: boolean;
  href?: never;
  isExternal?: never;
} & IButtonColour &
  XOr<{ leftIconPath?: string; leftSymbol?: ISymbolSource }, { leftIcon?: ReactNode }> &
  XOr<{ rightIconPath?: string; rightSymbol?: ISymbolSource }, { rightIcon?: ReactNode }>;

const ButtonIcon = ({
  icon,
  isLoading = false,
  path,
  symbol,
}: {
  icon?: ReactNode;
  isLoading?: boolean;
  path?: string;
  symbol?: ISymbolSource;
}) => {
  if (isLoading) {
    return (
      <span className="nxm-button-icon relative animate-spin">
        <Icon className="opacity-40" name="radio_button_unchecked" size="none" />

        <Icon className="absolute inset-0" name="progress_activity" size="none" />
      </span>
    );
  }

  if (isValidElement(icon)) {
    const element = icon as ReactElement<{ className?: string }>;

    return cloneElement(element, {
      className: joinClasses(["nxm-button-icon", element.props.className]),
    });
  }

  if (symbol) {
    return <Icon {...symbolProps(symbol)} className="nxm-button-icon" size="none" />;
  }

  if (path) {
    return <Icon className="nxm-button-icon" path={path} size="none" />;
  }

  return null;
};

export const Button = forwardRef<HTMLButtonElement, IButtonProps>(
  (
    {
      "aria-disabled": ariaDisabled,
      appearance = "strong",
      brand = "primary",
      children,
      className,
      customContent,
      disabled,
      hasExpandedStyle = true,
      isExternal,
      isLoading = false,
      leftIcon,
      leftIconPath,
      leftSymbol,
      rightIcon,
      rightIconPath,
      rightSymbol,
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
          "nxm-button-no-expanded-style": !hasExpandedStyle,
          // `md` is the base class, so only `sm` modifies it.
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
          <ButtonIcon
            icon={leftIcon}
            isLoading={isLoading}
            path={leftIconPath}
            symbol={leftSymbol}
          />

          {!!children && <span>{children}</span>}

          <ButtonIcon icon={rightIcon} path={rightIconPath} symbol={rightSymbol} />
        </>
      )}
    </button>
  ),
);
