/**
 * Button Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent button system with multiple types, sizes, and states.
 * Uses shared CSS classes from button.css (nxm-button-*) for styling.
 */

import { mdiCircleOutline, mdiLoading } from "@mdi/js";
import React, {
  type ButtonHTMLAttributes,
  forwardRef,
  type ReactNode,
} from "react";

import { joinClasses } from "../../utils/joinClasses";
import type { XOr } from "../../utils/types";
import { Icon } from "../icon/Icon";

export type ButtonType =
  | "primary"
  | "secondary"
  | "tertiary"
  | "success"
  | "premium";

type BaseButtonProps = {
  buttonType?: ButtonType;
  filled?: "strong" | "weak";
  isLoading?: boolean;
  size?: "xs" | "sm" | "md";
  children?: string;
  customContent?: ReactNode;
} & XOr<{ leftIconPath?: string }, { leftIcon?: ReactNode }> &
  XOr<{ rightIconPath?: string }, { rightIcon?: ReactNode }>;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean;
  href?: never;
  isExternal?: never;
} & BaseButtonProps;

const getButtonClasses = ({
  buttonType,
  disabled,
  filled,
  iconOnly,
  size,
}: {
  buttonType: ButtonType;
  disabled: boolean;
  filled?: ButtonProps["filled"];
  iconOnly: boolean;
  size: Required<ButtonProps>["size"];
}) => {
  const classes = [
    "nxm-button",
    {
      "nxm-button-disabled": disabled,
      "nxm-button-icon-only": iconOnly,
      "nxm-button-xs": size === "xs",
      "nxm-button-sm": size === "sm",
    },
  ];

  switch (buttonType) {
    case "primary":
      classes.push("nxm-button-primary");
      break;
    case "secondary":
      if (filled) {
        classes.push(
          filled === "strong"
            ? "nxm-button-secondary-filled-strong"
            : "nxm-button-secondary-filled-weak",
        );
      } else {
        classes.push("nxm-button-secondary");
      }
      break;
    case "tertiary":
      if (filled) {
        classes.push(
          filled === "strong"
            ? "nxm-button-tertiary-filled-strong"
            : "nxm-button-tertiary-filled-weak",
        );
      } else {
        classes.push("nxm-button-tertiary");
      }
      break;
    case "success":
      classes.push("nxm-button-success");
      break;
    case "premium":
      classes.push("nxm-button-premium");
      break;
  }

  return classes;
};

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

  if (icon) {
    return (
      <span className="nxm-button-icon flex items-center justify-center">
        {icon}
      </span>
    );
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
      buttonType = "primary",
      children,
      className,
      customContent,
      disabled,
      filled,
      isExternal,
      isLoading = false,
      leftIcon,
      leftIconPath,
      rightIcon,
      rightIconPath,
      size = "md",
      ...props
    },
    ref,
  ) => (
    <button
      aria-disabled={ariaDisabled}
      className={joinClasses([
        ...getButtonClasses({
          buttonType,
          disabled: !!disabled || !!ariaDisabled || isLoading,
          filled,
          iconOnly: !customContent && !children,
          size,
        }),
        className || "",
      ])}
      disabled={disabled || isLoading}
      ref={ref}
      type={props.type ?? "button"}
      {...props}
    >
      {customContent ?? (
        <>
          <ButtonIcon
            icon={leftIcon}
            isLoading={isLoading}
            path={leftIconPath}
          />

          {!!children && <span>{children}</span>}

          <ButtonIcon icon={rightIcon} path={rightIconPath} />
        </>
      )}
    </button>
  ),
);
