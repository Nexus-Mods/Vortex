/**
 * Button Component
 * Adapted from web team's "next" project for Vortex
 *
 * Provides a consistent button system with multiple types, sizes, and states.
 */

import * as React from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentProps,
  MutableRefObject,
  ReactNode,
  Ref,
} from "react";

import { Icon } from "../icon";
import { Link } from "../link";
import { Typography } from "../typography/Typography";
import { TypographyProps } from "../typography/Typography";
import { XOr, joinClasses } from "../utils";

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
  isResponsive?: boolean;
  size?: "sm" | "md";
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

type Size = {
  buttonClass: string;
  iconClassName: string;
  iconWrapperClassName: string;
  spacing: string;
  typographyType: TypographyProps["typographyType"];
};

const getSizes = ({
  isResponsive,
  size,
}: Pick<Required<BaseButtonProps>, "size"> &
  Pick<BaseButtonProps, "isResponsive">) => {
  const md = {
    buttonClass: "tw:min-h-9 tw:px-3 tw:min-w-8",
    iconClassName: "tw:size-5",
    iconWrapperClassName: "[&>svg]:tw:max-w-5! [&>svg]:tw:max-h-5!",
    spacing: "tw:gap-x-1.5",
    typographyType: "body-lg",
  } satisfies Size;

  switch (size) {
    case "sm":
      if (isResponsive) {
        return {
          buttonClass: joinClasses([
            md.buttonClass,
            "sm:tw:min-h-7 sm:tw:min-w-0 sm:tw:px-2.5",
          ]),
          iconClassName: joinClasses([md.iconClassName, "sm:tw:size-4"]),
          iconWrapperClassName: joinClasses([
            md.iconWrapperClassName,
            "sm:[&>svg]:tw:max-h-4! sm:[&>svg]:tw:max-w-4!",
          ]),
          spacing: joinClasses([md.spacing, "sm:tw:gap-x-1"]),
          typographyType: { default: md.typographyType, sm: "body-md" },
        } satisfies Size;
      }

      return {
        buttonClass: "tw:min-h-7 tw:px-2.5",
        iconClassName: "tw:size-4",
        iconWrapperClassName: "[&>svg]:tw:max-w-4! [&>svg]:tw:max-h-4!",
        spacing: "tw:gap-x-1",
        typographyType: "body-md",
      } satisfies Size;
    case "md":
      return md;
  }
};

const getButtonClasses = ({
  buttonType,
  filled,
  isDisabled,
  isLoading,
  isResponsive,
  size,
}: {
  buttonType: ButtonType;
  filled?: ButtonProps["filled"];
  isDisabled: boolean;
  isLoading: boolean;
  isResponsive: boolean;
  size: Required<ButtonProps>["size"];
}) => {
  const { buttonClass } = getSizes({ isResponsive, size });
  const canHover = !isDisabled && !isLoading;

  const classes = [
    buttonClass,
    "tw:relative tw:whitespace-nowrap tw:transition [&>*:first-child]:tw:relative",
    "tw:flex tw:items-center tw:justify-center tw:rounded before:tw:rounded",
    ...(isDisabled
      ? ["tw:cursor-not-allowed tw:opacity-40"]
      : ["tw:cursor-pointer", !isLoading && !filled ? "tw:hover-overlay" : ""]),
  ];

  switch (buttonType) {
    case "primary":
      classes.push(
        "tw:bg-primary-moderate tw:text-neutral-inverted",
        canHover ? "tw:hover:bg-primary-subdued" : "",
      );
      break;
    case "secondary":
      classes.push(
        "tw:border tw:border-stroke-moderate",
        canHover ? "tw:hover:border-stroke-strong" : "",
      );

      if (filled) {
        classes.push(
          ...(filled === "strong"
            ? [
                "tw:bg-neutral-strong tw:text-neutral-inverted",
                canHover ? "tw:hover-dark-overlay" : "",
              ]
            : [
                "tw:bg-surface-mid tw:text-neutral-moderate",
                canHover
                  ? "tw:hover:text-neutral-strong tw:hover:bg-surface-high"
                  : "",
              ]),
        );
      } else {
        classes.push(
          "tw:text-neutral-moderate",
          canHover ? "tw:hover:text-neutral-strong" : "",
        );
      }

      break;
    case "tertiary":
      if (filled) {
        classes.push(
          ...(filled === "strong"
            ? [
                "tw:bg-neutral-strong tw:text-neutral-inverted",
                canHover ? "tw:hover-dark-overlay" : "",
              ]
            : [
                "tw:bg-surface-mid tw:text-neutral-moderate",
                canHover
                  ? "tw:hover:text-neutral-strong tw:hover:bg-surface-high"
                  : "",
              ]),
        );
      } else {
        classes.push(
          "tw:text-neutral-moderate",
          canHover ? "tw:hover:text-neutral-strong" : "",
        );
      }
      break;
    case "success":
      classes.push(
        "tw:bg-success-moderate tw:text-neutral-inverted",
        canHover ? "tw:hover:bg-success-subdued" : "",
      );
      break;
    case "premium":
      classes.push(
        "tw:bg-premium-moderate tw:text-neutral-strong",
        canHover ? "tw:hover:bg-premium-subdued" : "",
      );
      break;
  }

  return classes;
};

const ButtonIcon = ({
  className,
  icon,
  isLoading = false,
  path,
  wrapperClassName,
}: {
  className: string;
  icon?: ReactNode;
  isLoading?: boolean;
  path?: string;
  wrapperClassName: string;
}) => {
  if (isLoading) {
    // Note: Loading icon won't render until Icon component is implemented
    return (
      <span className={joinClasses(["tw:shrink-0 tw:animate-spin", className])}>
        <Icon className="tw:opacity-40" path="mdiCircleOutline" size="none" />
        <Icon path="mdiLoading" size="none" />
      </span>
    );
  }

  if (!!icon) {
    return (
      <span
        className={joinClasses([
          "tw:flex tw:items-center tw:justify-center tw:shrink-0",
          wrapperClassName,
          className,
        ])}
      >
        {icon}
      </span>
    );
  }

  if (!!path) {
    return (
      <Icon
        className={joinClasses(["tw:shrink-0", className])}
        path={path}
        size="none"
      />
    );
  }

  return null;
};

const Content = ({
  isLoading,
  isResponsive,
  label,
  leftIcon,
  leftIconPath,
  rightIcon,
  rightIconPath,
  size,
}: Pick<
  ButtonProps,
  | "isLoading"
  | "isResponsive"
  | "leftIcon"
  | "leftIconPath"
  | "rightIcon"
  | "rightIconPath"
> &
  Required<Pick<ButtonProps, "size">> & { label?: string }) => {
  const { iconClassName, iconWrapperClassName, spacing, typographyType } =
    getSizes({ isResponsive, size });

  return (
    <span className={joinClasses(["tw:flex tw:items-center", spacing])}>
      <ButtonIcon
        className={joinClasses(["tw:-ml-0.5", iconClassName])}
        icon={leftIcon}
        isLoading={isLoading}
        path={leftIconPath}
        wrapperClassName={iconWrapperClassName}
      />

      {!!label && (
        <Typography
          appearance="none"
          as="span"
          className="tw:grow tw:text-left tw:leading-5"
          typographyType={typographyType}
        >
          {label}
        </Typography>
      )}

      <ButtonIcon
        className={joinClasses(["tw:-mr-0.5", iconClassName])}
        icon={rightIcon}
        path={rightIconPath}
        wrapperClassName={iconWrapperClassName}
      />
    </span>
  );
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
    isResponsive = false,
    leftIcon,
    leftIconPath,
    ref,
    rightIcon,
    rightIconPath,
    size = "md",
    ...rest
  } = all;

  const content = customContent ?? (
    <Content
      isLoading={isLoading}
      isResponsive={isResponsive}
      label={children}
      leftIcon={leftIcon}
      leftIconPath={leftIconPath}
      rightIcon={rightIcon}
      rightIconPath={rightIconPath}
      size={size}
    />
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
            filled,
            isDisabled: !!ariaDisabled || isLoading,
            isLoading,
            isResponsive,
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
            filled,
            isDisabled: !!ariaDisabled || isLoading,
            isLoading,
            isResponsive,
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
          filled,
          isDisabled: !!ariaDisabled || !!disabled || isLoading,
          isLoading,
          isResponsive,
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
