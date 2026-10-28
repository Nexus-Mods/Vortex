import React, {
  type ButtonHTMLAttributes,
  createContext,
  forwardRef,
  type MouseEvent,
  type ReactNode,
  useContext,
} from "react";

import {
  Button,
  ButtonContent,
  getButtonClasses,
  type IButtonColour,
} from "@/ui/components/button/Button";
import type { IIconProp } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

interface ISplitButtonLook {
  /** Its brand and appearance. */
  colour: IButtonColour;
  /** Its height. */
  size: "sm" | "md";
  /** Whether it's off. */
  isDisabled: boolean;
}

/** The look a `SplitButton` gives the `SplitButtonAction` in it. */
const SplitButtonContext = createContext<ISplitButtonLook>({
  colour: {},
  size: "md",
  isDisabled: false,
});

export type ISplitButtonProps = IButtonColour & {
  /** The main part's label; without one, it's icon-only and needs `aria-label`. */
  children?: string;
  /** The main part's accessible name, for an icon-only one. */
  "aria-label"?: string;
  /** The icon before the main part's label. */
  leftIcon?: IIconProp;
  /** The icon after the main part's label. */
  rightIcon?: IIconProp;
  /** Its height: 28px for "md", the default, or 24px for "sm". */
  size?: "sm" | "md";
  /** Makes the main part a button; without it, the main part shows as it is but isn't one. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Beside the main part: a `SplitButtonAction`, or something holding one, such as a menu. */
  action: ReactNode;
  /** Turns both parts off. */
  isDisabled?: boolean;
  /** Classes for the whole. */
  className?: string;
};

/**
 * A button with a second part beside it, split by a divider, such as a filter with ✕ to remove
 * it. Each part hovers, presses and takes focus on its own, in `Button`'s brands, appearances and
 * sizes; a main part without `onClick` is static, not a button, though it isn't drawn as off.
 */
export const SplitButton = ({
  children,
  "aria-label": ariaLabel,
  leftIcon,
  rightIcon,
  size = "md",
  onClick,
  action,
  isDisabled = false,
  className,
  ...colour
}: ISplitButtonProps) => {
  const mainClasses = getButtonClasses({
    colour: colour as IButtonColour,
    size,
    isDisabled,
    isIconOnly: !children,
    className: "nxm-split-button-main",
  });
  const content = (
    <ButtonContent leftIcon={leftIcon} rightIcon={rightIcon}>
      {children}
    </ButtonContent>
  );

  return (
    <SplitButtonContext.Provider value={{ colour: colour as IButtonColour, size, isDisabled }}>
      <div className={joinClasses(["nxm-split-button", className])}>
        {onClick ? (
          <button
            aria-label={ariaLabel}
            className={mainClasses}
            disabled={isDisabled}
            type="button"
            onClick={onClick}
          >
            {content}
          </button>
        ) : (
          <span aria-label={ariaLabel} className={mainClasses}>
            {content}
          </span>
        )}

        {action}
      </div>
    </SplitButtonContext.Provider>
  );
};

type ISplitButtonActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Its icon, such as `close` to remove or `keyboard_arrow_down` for a menu. */
  icon: IIconProp;
  /** Its accessible name. */
  label: string;
};

/**
 * A `SplitButton`'s action, beside its main part: an icon-only button in the split button's look,
 * with the divider down its leading edge. It forwards its ref and props, so it can open a menu.
 */
export const SplitButtonAction = forwardRef<HTMLButtonElement, ISplitButtonActionProps>(
  ({ icon, label, className, disabled, ...props }, ref) => {
    const { colour, size, isDisabled } = useContext(SplitButtonContext);

    return (
      <Button
        {...props}
        {...colour}
        aria-label={label}
        className={joinClasses(["nxm-split-button-action", className])}
        disabled={isDisabled || disabled}
        leftIcon={icon}
        ref={ref}
        size={size}
      />
    );
  },
);

SplitButtonAction.displayName = "SplitButtonAction";
