import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

import {
  type IToolbarContext,
  ToolbarContext,
  type ToolbarPinTarget,
  useToolbarContext,
} from "./Toolbar.context";
import { type IToolbarAction, trackedActions } from "./ToolbarGroup";
import { useToolbarPinning } from "./useToolbarPinning.hook";

/** How a toolbar's menu reads and changes which actions are pinned to its bar. */
export interface IToolbarMenuPinning {
  /** Whether an action is pinned now. */
  isPinned: (action: IToolbarAction) => boolean;
  /** Pins an action, or unpins it. */
  togglePin: (action: IToolbarAction) => void;
  /** Whether anything has been pinned or unpinned, for the reset link. */
  canReset: boolean;
  /** Puts every pin back as it was by default. */
  reset: () => void;
}

interface IToolbarMenuContentProps {
  /** Its actions, in order, divided where their `section` changes. */
  actions: IToolbarAction[];
  /** The menu's accessible name. */
  label: string;
  /** Present where the user has a say in which actions sit on the bar. */
  pinning?: IToolbarMenuPinning;
  /** Closes whatever it's in, once a row is chosen. */
  onSelect: () => void;
}

/** Each run of actions in the same `section`, in order, for a menu to divide. */
const toolbarMenuSections = <T extends IToolbarAction>(rows: T[]): T[][] =>
  rows.reduce<T[][]>((runs, row) => {
    const run = runs.at(-1);
    if (run !== undefined && run[0].section === row.section) {
      run.push(row);
    } else {
      runs.push([row]);
    }
    return runs;
  }, []);

/**
 * A toolbar's actions as a menu, each with a pin toggle where pinning is offered and a reset
 * link once there's something to undo: what its overflow menu, or a context menu, holds.
 *
 * Resetting leaves the menu open, the pins above visibly moving back as the confirmation,
 * and the link then removes itself, there being nothing left to reset.
 *
 * Each pin toggle is worded in full, so a translation can word each its own way. An action
 * without an id can't be decided about, so it gets no toggle rather than one that does nothing
 * (see `useToolbarPinning`). The reset link's divider sits outside the rows and their gap, so
 * it makes up the gap's 2px itself.
 */
export const ToolbarMenuContent = ({
  actions,
  label,
  pinning,
  onSelect,
}: IToolbarMenuContentProps) => {
  const { t } = useTranslation();
  const { pinTarget = "toolbar" } = useToolbarContext();

  const pinLabel = (name: string, pinned: boolean) => {
    const replace = { replace: { name } };
    if (pinTarget === "row") {
      return pinned
        ? t("Unpin {{name}} from the row", replace)
        : t("Pin {{name}} to the row", replace);
    }
    return pinned
      ? t("Unpin {{name}} from the toolbar", replace)
      : t("Pin {{name}} to the toolbar", replace);
  };

  const rows = actions.map((action) => {
    if (pinning === undefined || action.id === undefined) {
      return action;
    }

    const pinned = pinning.isPinned(action);

    return {
      ...action,
      pin: {
        pinned,
        label: pinLabel(action.label, pinned),
        onToggle: () => pinning.togglePin(action),
      },
    };
  });

  return (
    <>
      <PopoverMenu actions={toolbarMenuSections(rows)} label={label} onSelect={onSelect} />

      {!!pinning?.canReset && (
        <>
          <DropdownDivider className="mt-1" />

          <PopoverPanelGroupItem className="h-auto justify-end py-3">
            <TypographyLink
              brand="info"
              typographyType="body-sm"
              variant="secondary"
              onClick={pinning.reset}
            >
              {t("Reset pins to default")}
            </TypographyLink>
          </PopoverPanelGroupItem>
        </>
      )}
    </>
  );
};

interface IToolbarMenuProps {
  /** Its actions, in order, divided where their `section` changes. */
  actions: IToolbarAction[];
  /** The menu's accessible name. */
  label: string;
  /** Where the bar's pins are stored, as its `Toolbar`'s `pinningId`; unset, it has none. */
  pinningId?: string;
  /** What a pin puts an action on, as the pin toggles say. Default the toolbar. */
  pinTarget?: ToolbarPinTarget;
  /** How its use is counted: its clicks, from the menu surface, and its pins; unset, nothing. */
  tracking?: IToolbarContext["tracking"];
  /** Closes whatever it's in, once a row is chosen. */
  onSelect: () => void;
}

const PinnableToolbarMenu = (props: IToolbarMenuProps) => {
  const pinning = useToolbarPinning(props.actions);

  return <ToolbarMenuContent {...props} pinning={pinning} />;
};

/**
 * A toolbar's actions as a menu away from its bar, such as in a context menu: the same rows,
 * pins and reset link as its overflow menu, the pins changing the same bar's. Given `tracking`,
 * its clicks count as from the menu surface, and its pins as its bar's do.
 */
export const ToolbarMenu = ({
  actions,
  pinningId,
  pinTarget,
  tracking,
  ...props
}: IToolbarMenuProps) => {
  const context = useMemo<IToolbarContext>(
    () => ({
      element: null,
      pinningId: pinningId ?? null,
      pinTarget,
      signature: "",
      tracking,
      width: null,
    }),
    [pinningId, pinTarget, tracking],
  );

  const counted = useMemo(
    () => trackedActions(actions, "menu", tracking?.onActionClick),
    [actions, tracking],
  );

  return (
    <ToolbarContext.Provider value={context}>
      {pinningId === undefined ? (
        <ToolbarMenuContent {...props} actions={counted} />
      ) : (
        <PinnableToolbarMenu {...props} actions={counted} />
      )}
    </ToolbarContext.Provider>
  );
};
