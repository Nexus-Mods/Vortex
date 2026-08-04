import { mdiViewGrid, mdiViewList } from "@mdi/js";
import type { TFunction } from "i18next";
import React from "react";

import { DisplayOptions as DisplayOptionsPanel } from "@/ui/components/display_options/DisplayOptions";
import { DisplayOptionsItem } from "@/ui/components/display_options/DisplayOptionsItem";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Picker } from "@/ui/components/picker/Picker";

interface IDisplayOptionsProps {
  t: TFunction;
  pickerLayout: "list" | "small" | "large";
  showHidden: boolean;
  onSetPickerLayout: (layout: "list" | "small" | "large") => void;
  onToggleHidden: () => void;
  onReset: () => void;
}

export const DisplayOptions = ({
  t,
  pickerLayout,
  showHidden,
  onSetPickerLayout,
  onToggleHidden,
  onReset,
}: IDisplayOptionsProps) => (
  <DisplayOptionsPanel onReset={onReset}>
    <DisplayOptionsItem label={t("Display as")}>
      <Picker<"list" | "small" | "large">
        button={{
          leftIconPath: pickerLayout === "list" ? mdiViewList : mdiViewGrid,
          size: "xs",
        }}
        options={[
          { label: t("Grid"), value: "small", iconPath: mdiViewGrid },
          { label: t("List"), value: "list", iconPath: mdiViewList },
        ]}
        value={pickerLayout}
        onChange={onSetPickerLayout}
      />
    </DisplayOptionsItem>

    <DisplayOptionsItem label={t("Show hidden items")}>
      <Switch checked={showHidden} onChange={onToggleHidden} />
    </DisplayOptionsItem>
  </DisplayOptionsPanel>
);
