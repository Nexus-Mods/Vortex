import React, { type HTMLAttributes } from "react";

import type { IMenuAction, IPopoverPanel } from "@/ui/components/popover/PopoverMenuItem";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";

import { useToolbarContext } from "./Toolbar.context";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarOverflow } from "./ToolbarOverflow";
import { ToolbarPanelButton } from "./ToolbarPanelButton";
import { TOOLBAR_CONTROL_ATTRIBUTE, useToolbarOverflow } from "./useToolbarOverflow.hook";
import { type IToolbarPinning, useToolbarPinning } from "./useToolbarPinning.hook";

export type IToolbarPanel = IPopoverPanel;

/**
 * One toolbar control: a menu action, plus what only a toolbar can say about it —
 * whether its label shows as text, and whether the row may collapse it into the
 * overflow. Its `brand` comes from the action itself, so the colour survives the
 * collapse. Activating it either runs `onClick` or opens `panel`; activation has a
 * single meaning, so the two are mutually exclusive.
 */
export type IToolbarAction = IMenuAction & {
  showLabel?: boolean;
  testId?: string;
  /**
   * What a decision to pin this action is stored against, so it must not change with
   * the language or the release. Only needed on a toolbar that offers pinning.
   */
  id?: string;
  /**
   * Whether it sits on the bar until the user says otherwise. Ignored by a toolbar
   * that doesn't offer pinning, which shows every action it was given.
   */
  pinned?: boolean;
};

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
    <ToolbarPanelButton
      {...controlProps(action)}
      panel={action.panel}
      panelRole={action.panelRole}
    />
  ) : (
    <ToolbarButton
      {...controlProps(action)}
      {...{ [TOOLBAR_CONTROL_ATTRIBUTE]: true }}
      onClick={action.onClick}
    />
  );

type IGroupBodyProps = IToolbarGroupProps & {
  /** The actions belonging on the bar: every one, or the pinned ones. */
  barActions: IToolbarAction[];
  /** Whether the menu is there whatever fits, holding the full list. */
  pinningEnabled: boolean;
  /** How the menu's rows read and change what the user decided. */
  pinning?: IToolbarPinning;
};

const ToolbarGroupBody = ({
  actions,
  barActions,
  className,
  maxVisible,
  pinning,
  pinningEnabled,
  ...props
}: IGroupBodyProps) => {
  const { groupRef, isMeasuring, visible } = useToolbarOverflow({
    actionCount: barActions.length,
    alwaysReserveOverflow: pinningEnabled,
    maxVisible,
    signature: widthSignature(barActions),
  });

  const visibleActions = barActions.filter((_, index) => visible.has(index));
  const hiddenActions = barActions.filter((_, index) => !visible.has(index));
  const menuActions = pinningEnabled ? actions : hiddenActions;
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
      {(isMeasuring || pinningEnabled || !!hiddenActions.length) && (
        <ToolbarOverflow actions={menuActions} pinning={pinning} />
      )}
    </TooltipDelayGroup>
  );
};

/**
 * The pinning path, in a component of its own so that only a toolbar offering
 * pinning reaches for the store — where the user's decisions are kept.
 */
const PinnableToolbarGroup = (props: IToolbarGroupProps) => {
  const pinning = useToolbarPinning(props.actions);

  return (
    <ToolbarGroupBody
      {...props}
      pinningEnabled
      barActions={pinning.pinnedActions}
      pinning={pinning}
    />
  );
};

/**
 * A rounded "pill" cluster of related toolbar controls sharing a single raised
 * surface. Renders as many actions as fit the width the toolbar has; the rest
 * collapse into an overflow menu occupying the final slot.
 *
 * Where the toolbar offers pinning, the bar holds the pinned actions rather than
 * every action, and the menu becomes the full list — so it is always there, and an
 * unpinned action is still one click away, as is a pinned one that didn't fit.
 */
export const ToolbarGroup = (props: IToolbarGroupProps) => {
  const { pinningId } = useToolbarContext();

  return pinningId === null ? (
    <ToolbarGroupBody {...props} barActions={props.actions} pinningEnabled={false} />
  ) : (
    <PinnableToolbarGroup {...props} />
  );
};
