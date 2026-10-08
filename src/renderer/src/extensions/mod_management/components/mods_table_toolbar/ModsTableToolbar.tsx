import { mdiMagnify } from "@mdi/js";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";

import {
  MODS_TABLE_PRESETS,
  type ModsTableGrouping,
} from "../../util/mods_table_views/modsTableViews";

interface IModsTableToolbarProps {
  /** What the table groups by, which picks the view shown as selected, if any. */
  grouping: ModsTableGrouping;
  /** The display options' toolbar action, opening its panel. */
  displayOptions: IToolbarAction;
  /** Groups the table as a view does. */
  onGroupingChange: (grouping: ModsTableGrouping) => void;
}

/**
 * The new Mods table's views and actions, in its sticky head. Views aren't tabs, with no
 * panels of their own, so they're toggle buttons, so a user's own views can carry their
 * own controls later. A view is only a grouping for now, so grouping by anything else from
 * the display options leaves none selected. Searching does nothing yet.
 */
export const ModsTableToolbar = ({
  grouping,
  displayOptions,
  onGroupingChange,
}: IModsTableToolbarProps) => {
  const { t } = useTranslation(["common"]);

  const actions = useMemo<IToolbarAction[]>(
    () => [displayOptions, { iconPath: mdiMagnify, label: t("Search") }],
    [displayOptions, t],
  );

  return (
    <>
      <div aria-label={t("Views")} className="flex min-w-0 items-center gap-x-1" role="group">
        {MODS_TABLE_PRESETS.map((preset) => {
          const selected = preset.grouping === grouping;

          return (
            <Button
              appearance={selected ? "moderate" : "weak"}
              aria-pressed={selected}
              brand="neutral"
              key={preset.id}
              onClick={() => onGroupingChange(preset.grouping)}
            >
              {t(preset.label)}
            </Button>
          );
        })}
      </div>

      {/* flex-1, so the actions that don't fit go to its overflow menu. */}
      <Toolbar className="min-w-0 flex-1 justify-end">
        <ToolbarGroup actions={actions} />
      </Toolbar>
    </>
  );
};
