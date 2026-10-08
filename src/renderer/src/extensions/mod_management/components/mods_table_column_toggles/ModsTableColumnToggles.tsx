import React, { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { Typography } from "@/ui/components/typography/Typography";

import type { IModsTableColumnToggle } from "../../hooks/use_mods_table_columns/useModsTableColumns.hook";

interface IModsTableColumnTogglesProps {
  /** The columns the user can show or hide. */
  toggles: IModsTableColumnToggle[];
  /** Shows or hides a column. */
  onToggle: (columnId: string, visible: boolean) => void;
}

/** The display options' section for choosing the table's columns, one toggle button each. */
export const ModsTableColumnToggles = ({ toggles, onToggle }: IModsTableColumnTogglesProps) => {
  const { t } = useTranslation(["common"]);
  const titleId = useId();

  if (toggles.length === 0) {
    return null;
  }

  return (
    <PopoverPanelGroup className="flex flex-col gap-y-2">
      <Typography
        appearance="subdued"
        as="p"
        className="px-4"
        id={titleId}
        typographyType="body-sm"
      >
        {t("Toggle columns")}
      </Typography>

      <div aria-labelledby={titleId} className="flex flex-wrap gap-1 px-4 pb-2" role="group">
        {toggles.map(({ id, header, visible }) => (
          <Button
            appearance={visible ? "moderate" : "subdued"}
            aria-pressed={visible}
            brand="neutral"
            className="px-1.5"
            key={id}
            size="sm"
            onClick={() => onToggle(id, !visible)}
          >
            {header}
          </Button>
        ))}
      </div>
    </PopoverPanelGroup>
  );
};
