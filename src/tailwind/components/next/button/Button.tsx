/**
 * Button Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent button system with multiple types, sizes, and states.
 * Uses shared CSS classes from button.css (nxm-button-*) for styling.
 */

import React, {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";

import { Icon } from "../icon";
import { Link } from "../link";
import { type XOr, joinClasses } from "../utils";
import { mdiCircleOutline, mdiLoading } from "@mdi/js";

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

type ButtonButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: "button";
  disabled?: boolean;
  href?: never;
  isExternal?: never;
  ref?: Ref<HTMLButtonElement>;
} & BaseButtonProps;

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "as"> & {
  as: "link";
  className?: string;
  disabled?: never;
  isExternal?: boolean;
  ref?: Ref<HTMLAnchorElement>;
} & BaseButtonProps;

type ButtonLinkAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  as: "a";
  disabled?: never;
  isExternal?: boolean;
  ref?: Ref<HTMLAnchorElement>;
} & BaseButtonProps;

type ButtonProps = ButtonButtonProps | ButtonLinkProps | ButtonLinkAnchorProps;

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
      <span className="nxm-button-icon animate-spin relative">
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

export const Button = (all: ButtonProps) => {
  const {
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
    ref,
    rightIcon,
    rightIconPath,
    size = "md",
    ...rest
  } = all;

  const isDisabled = !!disabled || !!ariaDisabled || isLoading;
  const iconOnly = !customContent && !children;

  const content = customContent ?? (
    <>
      <ButtonIcon icon={leftIcon} isLoading={isLoading} path={leftIconPath} />

      {!!children && <span>{children}</span>}

      <ButtonIcon icon={rightIcon} path={rightIconPath} />
    </>
  );

  if (rest.as === "link") {
    const { as, href, ...props } = rest as ButtonLinkProps;

    return (
      <Link
        ref={ref as MutableRefObject<HTMLAnchorElement>}
        href={href}
        aria-disabled={ariaDisabled ? true : undefined}
        isExternal={isExternal}
        className={joinClasses([
          ...getButtonClasses({
            buttonType,
            disabled: isDisabled,
            filled,
            iconOnly,
            size,
          }),
          className || "",
        ])}
        {...props}
      >
        {content}
      </Link>
    );
  }

  if (rest.as === "a") {
    const { as, ...props } = rest;

    return (
      <a
        ref={ref as MutableRefObject<HTMLAnchorElement>}
        aria-disabled={ariaDisabled}
        className={joinClasses([
          ...getButtonClasses({
            buttonType,
            disabled: isDisabled,
            filled,
            iconOnly,
            size,
          }),
          className || "",
        ])}
        {...(isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
        {...props}
      >
        {content}
      </a>
    );
  }

  const { href, ...props } = rest;

  return (
    <button
      ref={ref as MutableRefObject<HTMLButtonElement>}
      aria-disabled={ariaDisabled}
      className={joinClasses([
        ...getButtonClasses({
          buttonType,
          disabled: isDisabled,
          filled,
          iconOnly,
          size,
        }),
        className || "",
      ])}
      disabled={disabled || isLoading}
      type={props.type ?? "button"}
      {...props}
    >
      {content}
    </button>
  );
};
