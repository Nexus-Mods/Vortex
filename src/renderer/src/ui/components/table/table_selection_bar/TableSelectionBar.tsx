import { mdiClose } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

interface ITableSelectionBarProps {
  /** How many rows are selected. */
  count: number;
  /** Deselects every row. */
  onClear: () => void;
  /** What can be done with the selected rows, at the bar's end. */
  children?: ReactNode;
}

/**
 * A bar along the bottom of the view while a table has rows selected: how many, on a button
 * that deselects them, and what can be done with them. For the table's `footer`, which keeps
 * it in view.
 */
export const TableSelectionBar = ({ count, onClear, children }: ITableSelectionBarProps) => {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("{{count}} selected", { count })}
      className="nxm-table-selection-bar"
      role="region"
    >
      <Tooltip content={t("Deselect all")} placement="top">
        <Button
          appearance="weak"
          aria-label={t("Deselect all")}
          brand="neutral"
          leftIconPath={mdiClose}
          onClick={onClear}
        >
          {t("{{count}} selected", { count })}
        </Button>
      </Tooltip>

      <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
  );
};
