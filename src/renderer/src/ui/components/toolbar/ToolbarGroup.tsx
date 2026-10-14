import React, { type HTMLAttributes, type ReactNode, type Ref } from "react";

import type {
  IMenuAction,
  IPopoverPanel,
} from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";

import type {
  IToolbarAnalytics,
  IToolbarTrackingProperties,
  ToolbarSurface,
} from "./Toolbar.context";
import { identityOf, useToolbarContext } from "./Toolbar.context";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarOverflow } from "./ToolbarOverflow";
import { type IToolbarPanelHandle, ToolbarPanelButton } from "./ToolbarPanelButton";
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
  /** Shows its label as text beside its icon on the bar, rather than in a tooltip. */
  showLabel?: boolean;
  /** Said under the label in its tooltip on the bar, where there's more to say than its name. */
  description?: string;
  /** A `data-testid` for its control on the bar. */
  testId?: string;
  /** For a panel action: filled with a way to open its panel, while it's on the bar. */
  panelHandle?: Ref<IToolbarPanelHandle>;
  /** What pinning it is stored against, so unchanged by language or release; for pinning only. */
  id?: string;
  /** Whether it sits on the bar until the user says otherwise; ignored without pinning. */
  pinned?: boolean;
  /** Its section of the overflow menu: a rule divides each run of actions from the next. */
  section?: string;
  /** The extension that registered it, for counting clicks; absent for the page's own. */
  extension?: string;
  /** Extra properties its counted clicks report, such as a toggle's way; never about the user. */
  trackingProperties?: IToolbarTrackingProperties;
};

type IToolbarGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Its controls, in order; those that don't fit go to the overflow menu. */
  actions: IToolbarAction[];
  /** The most it shows on the bar, however many would fit. */
  maxVisible?: number;
  /** Shown after the actions and before the overflow menu, always, so it takes its room first. */
  beforeOverflow?: ReactNode;
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
      (action) =>
        `${action.iconPath || action.icon !== undefined ? "i" : ""}${action.showLabel ? action.label : ""}`,
    ),
  ].join(":");

/**
 * What every control in the row looks like, whatever it does when activated: a
 * panel trigger is indistinguishable from a plain action until it's used.
 */
const controlProps = (action: IToolbarAction) => ({
  appearance: "weak" as const,
  brand: action.brand ?? "neutral",
  className: action.active ? "nxm-button-active" : undefined,
  "data-testid": action.testId,
  description: action.description,
  disabled: action.disabled,
  isLoading: action.isLoading,
  label: action.label,
  ...(action.icon !== undefined ? { leftIcon: action.icon } : { leftIconPath: action.iconPath }),
  showLabel: action.showLabel,
});

/**
 * The half of {@link IToolbarAction} that runs something when activated, as one type
 * rather than the either-or. Copying an action means spreading it, and spreading the
 * either-or gives back an either-or that no longer knows which half it came from.
 */
type IToolbarClickAction = Extract<IToolbarAction, { panel?: never }>;

const runsSomething = (action: IToolbarAction): action is IToolbarClickAction =>
  action.panel === undefined;

/**
 * The actions as the row will run them: each reports its own click first, if the toolbar
 * is being tracked and the action can say who it is.
 *
 * A panel action is left alone here — opening a panel is a click its control sees but
 * its `onClick` doesn't, so {@link ToolbarControl} reports that one instead. In the
 * overflow menu there is no such click to catch, and the rows inside the panel carry
 * their own identity anyway.
 *
 * Exported because a page that folds several actions into a menu of its own has rows the
 * group never sees, and they have to be counted by the same rule — identity resolves in
 * one place or it drifts.
 */
export const trackedActions = (
  actions: IToolbarAction[],
  surface: ToolbarSurface,
  onActionClick: IToolbarAnalytics["onActionClick"] | undefined,
): IToolbarAction[] => {
  if (onActionClick === undefined) {
    return actions;
  }

  return actions.map((action): IToolbarAction => {
    const identity = identityOf(action);

    if (identity === undefined || !runsSomething(action)) {
      return action;
    }

    const { onClick } = action;

    return {
      ...action,
      onClick: () => {
        onActionClick(identity, surface);
        onClick?.();
      },
    };
  });
};

/**
 * Reports the click on a panel action: the one that opens it, which is the only moment
 * a control that runs nothing can be said to have been clicked.
 *
 * Always from the bar, because a panel action that collapsed into the overflow is opened
 * from a menu row instead, where there is no such click to hang this on.
 */
const panelClickReporter = (
  action: IToolbarAction,
  onActionClick: IToolbarAnalytics["onActionClick"] | undefined,
): (() => void) | undefined => {
  const identity = runsSomething(action) ? undefined : identityOf(action);

  return onActionClick === undefined || identity === undefined
    ? undefined
    : () => onActionClick(identity, "bar");
};

/**
 * A panel action marks itself, because there the group's child is the popover
 * wrapper rather than the button — see {@link TOOLBAR_CONTROL_ATTRIBUTE}.
 */
const ToolbarControl = ({ action, onClick }: { action: IToolbarAction; onClick?: () => void }) =>
  action.panel ? (
    <ToolbarPanelButton
      {...controlProps(action)}
      handle={action.panelHandle}
      panel={action.panel}
      panelRole={action.panelRole}
      onClick={onClick}
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
  beforeOverflow,
  className,
  maxVisible,
  pinning,
  pinningEnabled,
  ...props
}: IGroupBodyProps) => {
  const { tracking } = useToolbarContext();
  const { groupRef, isMeasuring, visible } = useToolbarOverflow({
    actionCount: barActions.length,
    alwaysReserveOverflow: pinningEnabled,
    maxVisible,
    signature: widthSignature(barActions),
  });

  const visibleActions = trackedActions(
    barActions.filter((_, index) => visible.has(index)),
    "bar",
    tracking?.onActionClick,
  );
  const hiddenActions = barActions.filter((_, index) => !visible.has(index));

  // Where pinning is on the menu is the full list rather than the leftovers, so
  // `overflow` records that a button was reached through the kebab, not that it
  // failed to fit.
  const menuActions = trackedActions(
    pinningEnabled ? actions : hiddenActions,
    "overflow",
    tracking?.onActionClick,
  );

  return (
    <TooltipDelayGroup
      as="div"
      className={joinClasses(["nxm-toolbar-group", className])}
      ref={groupRef}
      {...props}
    >
      {/* By id where there is one, so a toggle whose label changes keeps its button, and focus. */}
      {visibleActions.map((action) => (
        <ToolbarControl
          action={action}
          key={action.id ?? action.label}
          onClick={panelClickReporter(action, tracking?.onActionClick)}
        />
      ))}

      {beforeOverflow}

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
