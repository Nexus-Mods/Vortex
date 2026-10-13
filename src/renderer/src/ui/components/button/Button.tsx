import { mdiCircleOutline, mdiLoading } from "@mdi/js";
import React, {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

export type IButtonBrand = "primary" | "info" | "neutral" | "success" | "danger" | "premium";
export type IButtonAppearance = "weak" | "subdued" | "moderate" | "strong";

/** `scrim` paints a scrim, which only reads on the achromatic brand, so it is neutral-only. */
export type IButtonColour =
  | {
      /** How heavily it's filled, from text only to solid; "strong" by default. */
      appearance?: IButtonAppearance;
      /** Its colour; "primary" by default. */
      brand?: IButtonBrand;
    }
  | {
      /** Over a scrim, for a button on top of an image. */
      appearance: "scrim";
      /** Neutral, the only brand a scrim reads on. */
      brand: "neutral";
    };

export type IButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Keeps its hover look while the menu or panel it opens is open; true by default. */
  hasExpandedStyle?: boolean;
  /** Shows a spinner in place of its left icon, and turns it off until it's done. */
  isLoading?: boolean;
  /** Its height: 28px for "md", the default, or 24px for "sm". */
  size?: "sm" | "md";
  /** Its label; without one or `customContent`, it's an icon-only button. */
  children?: string;
  /** Drawn in place of its icons and label, for content they can't express. */
  customContent?: ReactNode;
  /** Turns it off. */
  disabled?: boolean;
  /** For a button inside another, where a `<button>` can't go: a `span` with the button role. */
  nested?: boolean;
  /** Not a link: links have their own component. */
  href?: never;
  /** Not a link: links have their own component. */
  isExternal?: never;
} & IButtonColour &
  XOr<
    {
      /** The icon before its label, as an SVG path. */
      leftIconPath?: string;
    },
    {
      /** Drawn in place of `leftIconPath`, for an icon a single path can't draw. */
      leftIcon?: ReactNode;
    }
  > &
  XOr<
    {
      /** The icon after its label, as an SVG path. */
      rightIconPath?: string;
    },
    {
      /** Drawn in place of `rightIconPath`, for an icon a single path can't draw. */
      rightIcon?: ReactNode;
    }
  >;

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
      nested = false,
      rightIcon,
      rightIconPath,
      size = "md",
      type,
      ...props
    },
    ref,
  ) => {
    const inactive = !!disabled || isLoading;

    const classes = joinClasses(
      ["nxm-button", `nxm-button-${brand}`, `nxm-button-${appearance}`, className],
      {
        "nxm-button-disabled": inactive || !!ariaDisabled,
        "nxm-button-icon-only": !customContent && !children,
        "nxm-button-no-expanded-style": !hasExpandedStyle,
        // `md` is the base class, so only `sm` modifies it.
        "nxm-button-sm": size === "sm",
      },
    );

    const content = customContent ?? (
      <>
        <ButtonIcon icon={leftIcon} isLoading={isLoading} path={leftIconPath} />

        {!!children && <span>{children}</span>}

        <ButtonIcon icon={rightIcon} path={rightIconPath} />
      </>
    );

    if (nested) {
      const { onClick, onKeyDown, tabIndex, ...spanProps } = props;

      return (
        <span
          {...(spanProps as HTMLAttributes<HTMLSpanElement>)}
          aria-disabled={inactive || ariaDisabled || undefined}
          className={classes}
          ref={ref as Ref<HTMLSpanElement>}
          role="button"
          tabIndex={inactive ? -1 : (tabIndex ?? 0)}
          onClick={inactive ? undefined : (onClick as HTMLAttributes<HTMLSpanElement>["onClick"])}
          // Pressed by the keys a button is, unless whatever handed it a key handler, such as a
          // Headless UI trigger, has already acted on the key.
          onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
            (onKeyDown as HTMLAttributes<HTMLSpanElement>["onKeyDown"])?.(event);
            if (!inactive && !event.defaultPrevented && ["Enter", " "].includes(event.key)) {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
        >
          {content}
        </span>
      );
    }

    return (
      <button
        aria-disabled={ariaDisabled}
        className={classes}
        disabled={inactive}
        ref={ref}
        type={type ?? "button"}
        {...props}
      >
        {content}
      </button>
    );
  },
);
