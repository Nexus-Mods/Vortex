import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import React, { type RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { IButtonBrand } from "@/ui/components/button/Button";
import type { IIconProp } from "@/ui/components/icon/Icon";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";

/** How the split button's main part looks for what the user has of the mod. */
export interface IModOptionsSplitLook {
  /** Its label. */
  label: string;
  /** Its brand; the button's default when absent. */
  brand?: IButtonBrand;
  /** The icon before its label. */
  leftIcon: IIconProp;
  /** The icon after its label, such as the Premium badge. */
  rightIcon?: IIconProp;
  /** Its `data-testid`. */
  testId: string;
}

interface IModOptionsSplitButtonProps extends IModOptionsSplitLook {
  /** What the main part does. */
  onClick: () => void;
  /** The menu's actions, in groups. */
  actions: IMenuAction[][];
  /** Spins the main part and turns both parts off, such as while files load. */
  isLoading: boolean;
  /** The main part, which picking from the menu leaves focus on. */
  mainRef: RefObject<HTMLButtonElement | null>;
}

/**
 * What the user has of a mod in Browse's details, as a split button: the main part for what
 * they'd do next, and a menu of more, such as deleting it. Picking from the menu leaves focus on
 * the main part, for a modal it opens to return to.
 */
export const ModOptionsSplitButton = ({
  label,
  testId,
  onClick,
  actions,
  isLoading,
  mainRef,
  ...look
}: IModOptionsSplitButtonProps) => {
  const { t } = useTranslation();

  return (
    <SplitButton
      {...look}
      action={
        <Popover className="flex">
          <HeadlessPopoverButton
            as={SplitButtonAction}
            data-testid="mod-install-options"
            icon="keyboard_arrow_down"
            label={t("Mod options")}
          />

          <PopoverPanel
            anchor={{ gap: 4, to: "bottom end" }}
            className="nxm-popover-panel-dropdown"
          >
            {({ close }) => (
              <PopoverMenu
                actions={actions}
                label={t("Mod options")}
                onSelect={() => close(mainRef)}
              />
            )}
          </PopoverPanel>
        </Popover>
      }
      data-testid={testId}
      isLoading={isLoading}
      ref={mainRef}
      onClick={onClick}
    >
      {label}
    </SplitButton>
  );
};
