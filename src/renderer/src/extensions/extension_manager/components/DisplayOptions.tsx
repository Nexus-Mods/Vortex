import type { TFunction } from "i18next";
import React from "react";

import { DisplayOptions as DisplayOptionsPanel } from "@/ui/components/display_options/DisplayOptions";
import { DisplayOptionsItem } from "@/ui/components/display_options/DisplayOptionsItem";
import { Switch } from "@/ui/components/form/switch/Switch";

interface IDisplayOptionsProps {
  t: TFunction;
  showBundled: boolean;
  onToggleBundled: () => void;
  onReset: () => void;
}

export const DisplayOptions = ({
  t,
  showBundled,
  onToggleBundled,
  onReset,
}: IDisplayOptionsProps) => (
  <DisplayOptionsPanel onReset={onReset}>
    <DisplayOptionsItem label={t("Show bundled extensions")}>
      <Switch checked={showBundled} onChange={onToggleBundled} />
    </DisplayOptionsItem>
  </DisplayOptionsPanel>
);
