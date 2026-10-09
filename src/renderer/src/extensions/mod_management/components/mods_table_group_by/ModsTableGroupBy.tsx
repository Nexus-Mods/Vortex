import React from "react";
import { useTranslation } from "react-i18next";

import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";

import type {
  IModsTableGroupingColumn,
  ModsTableGrouping,
} from "../../util/mods_table_views/modsTableViews";

interface IModsTableGroupByProps {
  /** The columns the table can group by, in order. */
  columns: Array<Pick<IModsTableGroupingColumn, "id" | "header">>;
  /** What it groups by now. */
  grouping: ModsTableGrouping;
  /** Groups it by another column, or by none. */
  onChange: (grouping: ModsTableGrouping) => void;
}

/** The display options' section for choosing what the table groups by. */
export const ModsTableGroupBy = ({ columns, grouping, onChange }: IModsTableGroupByProps) => {
  const { t } = useTranslation(["common"]);

  return (
    <PopoverPanelGroup>
      <PopoverPanelGroupItem passive label={t("Group by")}>
        <Picker<ModsTableGrouping>
          button={{ size: "sm" }}
          options={[
            { label: t("None"), value: "none" },
            ...columns.map(({ id, header }) => ({ label: header, value: id })),
          ]}
          value={grouping}
          onChange={onChange}
        />
      </PopoverPanelGroupItem>
    </PopoverPanelGroup>
  );
};
