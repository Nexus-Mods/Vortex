import { mdiViewGrid, mdiViewList } from "@mdi/js";
import type { TFunction } from "i18next";
import React from "react";

import { useDisplayOptionsAction as useDisplayOptionsPanelAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";

type PickerLayout = "list" | "small" | "large";

interface IDisplayOptionsProps {
  t: TFunction;
  pickerLayout: PickerLayout;
  showHidden: boolean;
  onSetPickerLayout: (layout: PickerLayout) => void;
  onToggleHidden: () => void;
  onReset: () => void;
}

/** How the games listing is shown, as an action for the page's toolbar. */
export const useDisplayOptionsAction = ({
  t,
  pickerLayout,
  showHidden,
  onSetPickerLayout,
  onToggleHidden,
  onReset,
}: IDisplayOptionsProps): IToolbarAction =>
  useDisplayOptionsPanelAction({
    children: (
      <>
        <PopoverPanelGroup>
          <PopoverPanelGroupItem label={t("Display as")}>
            <Picker<PickerLayout>
              button={{
                leftIconPath: pickerLayout === "list" ? mdiViewList : mdiViewGrid,
                size: "sm",
              }}
              options={[
                { label: t("Grid"), value: "small", iconPath: mdiViewGrid },
                { label: t("List"), value: "list", iconPath: mdiViewList },
              ]}
              value={pickerLayout}
              onChange={onSetPickerLayout}
            />
          </PopoverPanelGroupItem>
        </PopoverPanelGroup>

        <PopoverPanelGroup>
          <PopoverPanelGroupItem label={t("Show hidden items")}>
            <Switch checked={showHidden} onChange={onToggleHidden} />
          </PopoverPanelGroupItem>
        </PopoverPanelGroup>
      </>
    ),
    onReset,
  });
