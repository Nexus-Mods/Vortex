import { mdiDotsHorizontal } from "@mdi/js";
import React, { type FC } from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { useHelpMenuSections } from "./useHelpMenu.hook";

/**
 * The help options on their own, for when there's no account menu to nest them in.
 *
 * Signed in they're a row of the profile menu that opens them alongside; signed out
 * that menu doesn't exist, so they hang off a button of their own and open flat.
 */
export const HelpMenu: FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation();
  const sections = useHelpMenuSections();
  const label = t("Help");

  return (
    <Popover>
      {({ open }) => (
        <>
          <Tooltip content={label} disabled={open} placement="bottom">
            <PopoverButton
              appearance="weak"
              aria-haspopup="menu"
              aria-label={label}
              brand="neutral"
              leftIconPath={mdiDotsHorizontal}
            />
          </Tooltip>

          <PopoverPanel className="nxm-popover-panel-dropdown">
            {({ close }) => <PopoverMenu actions={sections} label={label} onSelect={close} />}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};
