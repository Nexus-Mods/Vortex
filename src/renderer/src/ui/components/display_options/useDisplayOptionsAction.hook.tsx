import { mdiTune } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

/**
 * The controls for how a listing is shown, as an action for that page's toolbar:
 * a tune-icon button opening a panel of the rows you pass as `children`. Compose
 * those from `PopoverPanelGroup` and `PopoverPanelGroupItem`.
 *
 * The toolbar owns the trigger and anchors the panel to whichever control it
 * rendered — the button in the row, or the action's row in the overflow menu —
 * so the rows never have to know where they were opened from.
 *
 * Every panel ends in a reset link, so there is always a way back to the
 * defaults; `onReset` restores them and the panel closes itself.
 *
 * The trigger and reset labels default to "Display options" and "Reset to
 * default"; pass them only to say something else.
 */
export const useDisplayOptionsAction = ({
  children,
  label,
  resetLabel,
  onReset,
}: {
  children: ReactNode;
  label?: string;
  resetLabel?: string;
  onReset: () => void;
}): IToolbarAction => {
  const { t } = useTranslation();

  return {
    iconPath: mdiTune,
    label: label ?? t("Display options"),
    panel: ({ close }) => (
      <>
        {children}

        <PopoverPanelGroup>
          <PopoverPanelGroupItem className="justify-end">
            <TypographyLink
              brand="info"
              typographyType="body-sm"
              variant="secondary"
              onClick={() => {
                onReset();
                close();
              }}
            >
              {resetLabel ?? t("Reset to default")}
            </TypographyLink>
          </PopoverPanelGroupItem>
        </PopoverPanelGroup>
      </>
    ),
  };
};
