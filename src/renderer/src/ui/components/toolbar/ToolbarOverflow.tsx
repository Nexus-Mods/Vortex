import { mdiDotsHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

import { useToolbarContext } from "./Toolbar.context";
import type { IToolbarAction } from "./ToolbarGroup";
import { TOOLBAR_OVERFLOW_ATTRIBUTE } from "./useToolbarOverflow.hook";

interface IToolbarOverflowProps {
  actions: IToolbarAction[];
  /** Present where the user has a say in which actions sit on the bar. */
  pinning?: {
    isPinned: (action: IToolbarAction) => boolean;
    togglePin: (action: IToolbarAction) => void;
    canReset: boolean;
    reset: () => void;
  };
}

/**
 * The actions a group had no room for, as a menu hung off a kebab button. They
 * arrive already ordered and belong together, so they go in as a single group.
 *
 * Where pinning is offered the menu ends in a reset link, shown only once there is
 * something to undo. Resetting leaves the menu open — the pins above visibly move
 * back, which is the confirmation — and the link then removes itself, there being
 * nothing left to reset.
 */
/** Each run of actions in the same `section`, in order, for the menu to divide. */
const sections = <T extends IToolbarAction>(rows: T[]): T[][] =>
  rows.reduce<T[][]>((runs, row) => {
    const run = runs.at(-1);
    if (run !== undefined && run[0].section === row.section) {
      run.push(row);
    } else {
      runs.push([row]);
    }
    return runs;
  }, []);

export const ToolbarOverflow = ({ actions, pinning }: IToolbarOverflowProps) => {
  const { t } = useTranslation();
  const { pinTarget = "toolbar" } = useToolbarContext();
  const label = t("More actions");

  // Each said in full, so a translation can word each its own way.
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

  // An action with no id cannot be decided about, so it gets no toggle rather than
  // one that does nothing — see `useToolbarPinning`.
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
    // The wrapper is what the group lays out, so it is what the group measures.
    <Popover {...{ [TOOLBAR_OVERFLOW_ATTRIBUTE]: true }}>
      <PopoverButton
        appearance="weak"
        aria-haspopup="menu"
        aria-label={label}
        brand="neutral"
        data-testid="toolbar-overflow"
        leftIconPath={mdiDotsHorizontal}
      />

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => (
          <>
            <PopoverMenu actions={sections(rows)} label={label} onSelect={close} />

            {!!pinning?.canReset && (
              <>
                <DropdownDivider />

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
        )}
      </PopoverPanel>
    </Popover>
  );
};
