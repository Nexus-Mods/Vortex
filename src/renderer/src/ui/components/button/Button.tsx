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

import { Icon, type IIconProp } from "@/ui/components/icon/Icon";
import { getIconProps, isIconSource } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { joinClasses } from "@/ui/utils/joinClasses";

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
} & IButtonColour & {
    /** The icon before its label: a symbol or SVG path for `Icon` to draw, or a node to show as is. */
    leftIcon?: IIconProp;
    /** The icon after its label, as `leftIcon`. */
    rightIcon?: IIconProp;
  };

const ButtonIcon = ({ icon, isLoading = false }: { icon?: IIconProp; isLoading?: boolean }) => {
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

  if (isIconSource(icon)) {
    return <Icon {...getIconProps(icon)} className="nxm-button-icon" size="none" />;
  }

  return null;
};

interface IButtonClassesOptions {
  /** Its brand and appearance, as `Button` takes them. */
  colour: IButtonColour;
  /** Its height, as `Button` takes it. */
  size: "sm" | "md";
  /** Whether it's off, which dims it. */
  isDisabled: boolean;
  /** Whether it has only an icon, which makes it square. */
  isIconOnly: boolean;
  /** Whether it keeps its hover look while what it opens is open. */
  hasExpandedStyle?: boolean;
  /** Further classes for it. */
  className?: string;
}

/** The classes that draw a button, for anything that draws one as `Button` does. */
export const getButtonClasses = ({
  colour: { appearance = "strong", brand = "primary" },
  size,
  isDisabled,
  isIconOnly,
  hasExpandedStyle = true,
  className,
}: IButtonClassesOptions) =>
  joinClasses(["nxm-button", `nxm-button-${brand}`, `nxm-button-${appearance}`, className], {
    "nxm-button-disabled": isDisabled,
    "nxm-button-icon-only": isIconOnly,
    "nxm-button-no-expanded-style": !hasExpandedStyle,
    "nxm-button-sm": size === "sm",
  });

interface IButtonContentProps {
  /** The icon before its label. */
  leftIcon?: IIconProp;
  /** The icon after its label. */
  rightIcon?: IIconProp;
  /** Its label. */
  children?: string;
  /** Shows a spinner in place of its left icon. */
  isLoading?: boolean;
}

/** A button's icons and label, as `Button` draws them. */
export const ButtonContent = ({
  leftIcon,
  rightIcon,
  children,
  isLoading,
}: IButtonContentProps) => (
  <>
    <ButtonIcon icon={leftIcon} isLoading={isLoading} />

    {!!children && <span>{children}</span>}

    <ButtonIcon icon={rightIcon} />
  </>
);

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
      nested = false,
      rightIcon,
      size = "md",
      type,
      ...props
    },
    ref,
  ) => {
    const inactive = !!disabled || isLoading;

    const classes = getButtonClasses({
      colour: { appearance, brand } as IButtonColour,
      size,
      isDisabled: inactive || !!ariaDisabled,
      isIconOnly: !customContent && !children,
      hasExpandedStyle,
      className,
    });

    const content = customContent ?? (
      <ButtonContent isLoading={isLoading} leftIcon={leftIcon} rightIcon={rightIcon}>
        {children}
      </ButtonContent>
    );

    if (nested) {
      const { onClick, onKeyDown, tabIndex, ...spanProps } = props;

      return (
        <span
          {...spanProps}
          aria-disabled={inactive || ariaDisabled || undefined}
          className={classes}
          ref={ref}
          role="button"
          tabIndex={inactive ? -1 : (tabIndex ?? 0)}
          onClick={inactive ? undefined : onClick}
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
