import { PopoverPanel as HeadlessPopoverPanel } from "@headlessui/react";
import React, {
  type ComponentProps,
  type ForwardRefExoticComponent,
  forwardRef,
  type RefAttributes,
} from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

type IPopoverPanelProps = ComponentProps<typeof HeadlessPopoverPanel>;

/**
 * Spelled out so the declaration build has a name for it. Left to infer, the forwarded
 * ref makes a type that can only be named by reaching into Headless UI's internals.
 */
type IPopoverPanel = ForwardRefExoticComponent<
  Omit<IPopoverPanelProps, "ref"> & RefAttributes<HTMLElement>
>;

/**
 * Floating panel for a Popover. Unlike a Dropdown's menu, this holds arbitrary
 * interactive content (pickers, switches, buttons) and stays open until an
 * outside click or Escape.
 *
 * `anchor` hands positioning to Headless UI's Floating UI integration, which also
 * portals the panel — so it escapes any clipping ancestor and flips itself when
 * there's no room below. Pass `anchor` to place it elsewhere.
 *
 * The ref reaches the panel element, for a caller that has to focus it. Headless UI's
 * own `focus` prop does that too, but it couples the focus to the panel's lifetime and
 * closes as soon as focus leaves.
 */
export const PopoverPanel: IPopoverPanel = forwardRef<HTMLElement, IPopoverPanelProps>(
  ({ className, ...props }, ref) => (
    <HeadlessPopoverPanel
      anchor={{ gap: 4, to: "bottom end" }}
      className={joinClasses(["nxm-popover-panel", className])}
      ref={ref}
      {...props}
    />
  ),
);

PopoverPanel.displayName = "PopoverPanel";
