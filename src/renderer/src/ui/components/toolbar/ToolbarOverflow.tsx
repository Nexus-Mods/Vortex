import { mdiDotsHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import type { IToolbarAction } from "./ToolbarGroup";
import { TOOLBAR_OVERFLOW_ATTRIBUTE } from "./useToolbarOverflow.hook";

interface IToolbarOverflowProps {
  actions: IToolbarAction[];
  /** Present where the user has a say in which actions sit on the bar. */
  pinning?: {
    isPinned: (action: IToolbarAction) => boolean;
    togglePin: (action: IToolbarAction) => void;
  };
}

/**
 * The actions a group had no room for, as a menu hung off a kebab button. They
 * arrive already ordered and belong together, so they go in as a single group.
 */
export const ToolbarOverflow = ({ actions, pinning }: IToolbarOverflowProps) => {
  const { t } = useTranslation();
  const label = t("More actions");

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
        label: pinned
          ? t("Unpin {{name}} from the toolbar", { replace: { name: action.label } })
          : t("Pin {{name}} to the toolbar", { replace: { name: action.label } }),
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
        {({ close }) => <PopoverMenu actions={[rows]} label={label} onSelect={close} />}
      </PopoverPanel>
    </Popover>
  );
};
