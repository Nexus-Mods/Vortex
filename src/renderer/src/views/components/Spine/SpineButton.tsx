import React, { type ButtonHTMLAttributes, forwardRef, type PropsWithChildren } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * How the resting outline reads. `hidden` keeps the gutter but only paints it on hover;
 * `none` drops the hover treatment too, for the download button's progress ring, which is
 * its own outline and would otherwise be doubled.
 */
type SpineButtonBorder = "hidden" | "none" | "visible";

const BORDER_CLASSES: Record<SpineButtonBorder, string> = {
  hidden: "border-transparent hover:border-neutral-strong",
  none: "border-transparent",
  visible: "border-stroke-weak hover:border-neutral-strong",
};

interface ISpineButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  border?: SpineButtonBorder;
  className?: string;
  iconPath?: false | string;
  isActive?: boolean;
  isCircular?: boolean;
  title: string;
  tooltipDisabled?: boolean;
}

/**
 * The spine's button shell: fixed size, tooltip, and the shared border/hover treatment.
 * Forwards its ref so Headless UI triggers can render through it via `as`, and renders
 * `children` alongside the icon for anything that decorates the face — a notification
 * pip, a progress ring.
 */
export const SpineButton = forwardRef<HTMLButtonElement, PropsWithChildren<ISpineButtonProps>>(
  (
    {
      border = "visible",
      children,
      className,
      iconPath,
      isActive,
      isCircular,
      title,
      tooltipDisabled,
      ...props
    },
    ref,
  ) => (
    <Tooltip content={title} disabled={tooltipDisabled} placement="right">
      <button
        aria-label={title}
        className={joinClasses([
          className,
          "relative flex size-12 shrink-0 items-center justify-center border-2 transition-colors",
          "hover:bg-surface-translucent-high hover:text-neutral-strong",
          isCircular ? "rounded-full" : "rounded-lg",
          isActive ? "bg-surface-translucent-low text-neutral-strong" : "text-neutral-moderate",
          // `none` leaves the outline to the caller, so an active border would double it.
          isActive && border !== "none" ? "border-neutral-strong" : BORDER_CLASSES[border],
        ])}
        {...props}
        ref={ref}
      >
        {!!iconPath && <Icon className="transition-colors" path={iconPath} size="lg" />}

        {children}
      </button>
    </Tooltip>
  ),
);

SpineButton.displayName = "SpineButton";
