import React, { type HTMLAttributes, type ReactNode } from "react";

import type { IButtonBrand } from "@/ui/components/button/Button";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

import { ToolbarButton } from "./ToolbarButton";
import { ToolbarOverflow } from "./ToolbarOverflow";
import { ToolbarPanelButton } from "./ToolbarPanelButton";
import { TOOLBAR_CONTROL_ATTRIBUTE, useToolbarOverflow } from "./useToolbarOverflow.hook";

interface IToolbarActionBase {
  label: string;
  iconPath?: string;
  disabled?: boolean;
  brand?: IButtonBrand;
  showLabel?: boolean;
  testId?: string;
  isLoading?: boolean;
  pinned?: boolean;
}

/**
 * The contents of the floating panel an action opens. The group anchors it to
 * whichever control it rendered for that action — a toolbar button, or its row in
 * the overflow menu — so the panel doesn't have to know where it was opened from.
 * `close` dismisses it.
 */
export type IToolbarPanel = (props: { close: () => void }) => ReactNode;

/**
 * One toolbar control. Activating it either runs `onClick` or opens `panel`;
 * activation has a single meaning, so the two are mutually exclusive.
 */
export type IToolbarAction = IToolbarActionBase &
  XOr<{ onClick?: () => void }, { panel?: IToolbarPanel }>;

type IToolbarGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  actions: IToolbarAction[];
  maxVisible?: number;
};

/**
 * Identity of everything about the actions that affects how wide they render:
 * the count, whether each has an icon, and any label shown as visible text.
 * Colon-separated and count-prefixed like the row's signature, so two different
 * action lists can't produce the same string and reuse each other's widths.
 */
const widthSignature = (actions: IToolbarAction[]): string =>
  [
    actions.length,
    ...actions.map(
      (action) => `${action.iconPath ? "i" : ""}${action.showLabel ? action.label : ""}`,
    ),
  ].join(":");

/**
 * What every control in the row looks like, whatever it does when activated: a
 * panel trigger is indistinguishable from a plain action until it's used.
 */
const controlProps = (action: IToolbarAction) => ({
  appearance: "weak" as const,
  brand: action.brand ?? "neutral",
  "data-testid": action.testId,
  disabled: action.disabled,
  isLoading: action.isLoading,
  label: action.label,
  leftIconPath: action.iconPath,
  showLabel: action.showLabel,
});

/**
 * A panel action marks itself, because there the group's child is the popover
 * wrapper rather than the button — see {@link TOOLBAR_CONTROL_ATTRIBUTE}.
 */
const ToolbarControl = ({ action }: { action: IToolbarAction }) =>
  action.panel ? (
    <ToolbarPanelButton {...controlProps(action)} panel={action.panel} />
  ) : (
    <ToolbarButton
      {...controlProps(action)}
      {...{ [TOOLBAR_CONTROL_ATTRIBUTE]: true }}
      onClick={action.onClick}
    />
  );

/**
 * A rounded "pill" cluster of related toolbar controls sharing a single raised
 * surface. Renders as many actions as fit the width the toolbar has; the rest
 * collapse into an overflow menu occupying the final slot. A `pinned` action is
 * held back from that, whatever its position.
 */
export const ToolbarGroup = ({ actions, className, maxVisible, ...props }: IToolbarGroupProps) => {
  const { groupRef, isMeasuring, visible } = useToolbarOverflow({
    maxVisible,
    pinned: actions.map((action) => action.pinned ?? false),
    signature: widthSignature(actions),
  });

  const visibleActions = actions.filter((_, index) => visible.has(index));
  const hiddenActions = actions.filter((_, index) => !visible.has(index));

  return (
    <TooltipDelayGroup
      as="div"
      className={joinClasses(["nxm-toolbar-group", className])}
      ref={groupRef}
      {...props}
    >
      {visibleActions.map((action) => (
        <ToolbarControl action={action} key={action.label} />
      ))}

      {/* Kept mounted through the measuring pass so its width is measured too. */}
      {(isMeasuring || !!hiddenActions.length) && <ToolbarOverflow actions={hiddenActions} />}
    </TooltipDelayGroup>
  );
};
