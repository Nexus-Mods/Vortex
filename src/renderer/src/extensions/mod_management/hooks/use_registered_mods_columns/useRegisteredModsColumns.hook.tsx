import React, { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { registerTableAttribute } from "@/controls/table/registerTableAttribute";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { ITableAttribute } from "@/types/ITableAttribute";
import { Icon } from "@/ui/components/icon/Icon";
import { getCurrentLanguage, preT } from "@/util/i18n";
import { activeGameId } from "@/util/selectors";

import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";

/** A `calc` value as text, a date in the user's language; none for one that has no text to show. */
const valueText = (value: unknown): string | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toLocaleString(getCurrentLanguage());
  }
  if (Array.isArray(value)) {
    return value.map(valueText).filter(Boolean).join(", ");
  }
  return undefined;
};

/** A `calc` value as the legacy table's cell shows one, with true as a tick. */
const valueCell = (value: unknown, header: string): ReactNode => {
  if (value === true) {
    return <Icon name="check" size="sm" title={header} />;
  }
  const text = valueText(value);
  return text ? <span className="truncate">{text}</span> : null;
};

const isInTable = ({ placement }: ITableAttribute) => placement === "table" || placement === "both";

/**
 * The columns extensions register on the legacy Mods table, with `registerTableAttribute("mods", …)`,
 * for the new one.
 */
export const useRegisteredModsColumns = (ownIds: ReadonlySet<string>) => {
  const { t } = useTranslation("common");
  const gameId = useSelector(activeGameId);
  const attributes = useExtensionObjects<ITableAttribute>(
    registerTableAttribute as (...args: unknown[]) => ITableAttribute | undefined,
    undefined,
    "mods",
  );

  return useMemo(() => {
    const shown = attributes.filter(
      (attribute) =>
        isInTable(attribute) && !ownIds.has(attribute.id) && (attribute.condition?.() ?? true),
    );
    const columns = shown.map((attribute): IModsTableColumn => {
      const header = preT(t, attribute.name);
      return {
        id: attribute.id,
        header,
        isToggleable: true,
        position: attribute.position,
        cell: ({ mod }) => valueCell(attribute.calc?.(mod, t), header),
      };
    });

    const defaultShown = shown
      .filter((attribute) => attribute.isDefaultVisible ?? true)
      .map(({ id }) => id);

    return { columns, defaultShown };
    // A condition is mostly which game is active, so it's asked again when that changes.
  }, [attributes, gameId, ownIds, t]);
};
