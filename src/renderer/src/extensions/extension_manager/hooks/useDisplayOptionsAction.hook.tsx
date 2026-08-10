import type { TFunction } from "i18next";
import React from "react";

import { useDisplayOptionsAction as useDisplayOptionsPanelAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { Switch } from "@/ui/components/form/switch/Switch";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";

interface IDisplayOptionsProps {
  t: TFunction;
  showBundled: boolean;
  onToggleBundled: () => void;
  onReset: () => void;
}

/** How the extension listing is shown, as an action for the page's toolbar. */
export const useDisplayOptionsAction = ({
  t,
  showBundled,
  onToggleBundled,
  onReset,
}: IDisplayOptionsProps): IToolbarAction =>
  useDisplayOptionsPanelAction({
    children: (
      <PopoverPanelGroup>
        <PopoverPanelGroupItem label={t("Show bundled extensions")}>
          <Switch checked={showBundled} onChange={onToggleBundled} />
        </PopoverPanelGroupItem>
      </PopoverPanelGroup>
    ),
    onReset,
  });
