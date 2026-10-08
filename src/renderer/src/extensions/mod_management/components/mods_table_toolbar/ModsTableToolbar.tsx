import { mdiFilterVariant, mdiMagnify, mdiPlus } from "@mdi/js";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";

import { type IModsTableView, MODS_TABLE_PRESETS } from "../../util/modsTableViews";

interface IModsTableToolbarProps {
  /** The view the table shows. */
  view: IModsTableView;
  /** The display options' toolbar action, opening its panel. */
  displayOptions: IToolbarAction;
  /** Shows another view. */
  onViewChange: (view: IModsTableView) => void;
}

/**
 * The new Mods table's views and actions, in its sticky head. Views aren't tabs, with no
 * panels of their own, so they're toggle buttons, so a user's own views can carry their
 * own controls later. Adding a view, filtering and searching do nothing yet.
 */
export const ModsTableToolbar = ({
  view,
  displayOptions,
  onViewChange,
}: IModsTableToolbarProps) => {
  const { t } = useTranslation(["common"]);

  const actions = useMemo<IToolbarAction[]>(
    () => [
      { iconPath: mdiFilterVariant, label: t("Filter") },
      displayOptions,
      { iconPath: mdiMagnify, label: t("Search") },
    ],
    [displayOptions, t],
  );

  return (
    <>
      <div className="flex min-w-0 items-center gap-x-1">
        <div aria-label={t("Views")} className="flex items-center gap-x-1" role="group">
          {MODS_TABLE_PRESETS.map((preset) => {
            const selected = preset.id === view.id;

            return (
              <Button
                appearance={selected ? "moderate" : "weak"}
                aria-pressed={selected}
                brand="neutral"
                key={preset.id}
                onClick={() => onViewChange(preset)}
              >
                {t(preset.label)}
              </Button>
            );
          })}
        </div>

        <ToolbarButton
          appearance="weak"
          brand="neutral"
          label={t("Add view")}
          leftIconPath={mdiPlus}
        />
      </div>

      {/* flex-1, so the actions that don't fit go to its overflow menu. */}
      <Toolbar className="min-w-0 flex-1 justify-end">
        <ToolbarGroup actions={actions} />
      </Toolbar>
    </>
  );
};
