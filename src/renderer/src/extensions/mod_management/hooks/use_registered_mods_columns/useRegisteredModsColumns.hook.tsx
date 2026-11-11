import { getErrorMessageOrDefault } from "@vortex/shared";
import React, { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import ExtensionGate from "@/controls/ExtensionGate";
import { registerTableAttribute } from "@/controls/table/registerTableAttribute";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { IState } from "@/types/IState";
import type { ICustomProps, ITableAttribute } from "@/types/ITableAttribute";
import { Icon } from "@/ui/components/icon/Icon";
import { getCurrentLanguage, preT, type TFunction } from "@/util/i18n";
import { log } from "@/util/log";
import { activeGameId } from "@/util/selectors";

import type { IModWithState } from "../../types/IModProps";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import {
  DEFAULT_POSITION,
  type IModsTableColumn,
} from "../use_mods_table_columns/useModsTableColumns.hook";

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

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | undefined)?.then === "function";

const CALC_FAILED = "failed to calculate attribute value";

const logFailure = (
  message: string,
  attribute: ITableAttribute,
  mod: IModWithState,
  err: unknown,
) =>
  log("error", message, {
    attribute: attribute.id,
    row: mod.id,
    error: getErrorMessageOrDefault(err),
  });

interface IRegisteredValueProps {
  attribute: ITableAttribute;
  mod: IModWithState;
  header: string;
  t: TFunction;
  /** Changes when the data its value is from outside the mod does. */
  version: number;
  /** For a volatile column, all the mods: a change to any works its value out again. */
  volatileMods?: { [id: string]: IModWithState };
}

/**
 * A cell's `calc` value, worked out again only when its mod, `version` or `volatileMods`
 * change. One worked out asynchronously shows once it's ready, the last one staying until then.
 */
const RegisteredValue = ({
  attribute,
  mod,
  header,
  t,
  version,
  volatileMods,
}: IRegisteredValueProps) => {
  const result = useMemo(() => {
    try {
      return attribute.calc?.(mod, t);
    } catch (err) {
      logFailure(CALC_FAILED, attribute, mod, err);
      return undefined;
    }
  }, [attribute, mod, t, version, volatileMods]);
  const [settled, setSettled] = useState<unknown>();

  useEffect(() => {
    if (!isThenable(result)) {
      return undefined;
    }
    let current = true;
    result.then(
      (value) => {
        if (current) {
          setSettled(value);
        }
      },
      (err: unknown) => logFailure(CALC_FAILED, attribute, mod, err),
    );
    return () => {
      current = false;
    };
  }, [attribute, mod, result]);

  return valueCell(isThenable(result) ? settled : result, header);
};

// Only the Dependencies column highlights its row, while its icon is dragged over it, which
// comes with dragging to make rules (LAZ-1589).
const NO_HIGHLIGHT: ICustomProps = { onHighlight: () => undefined };

interface ICustomCellProps {
  attribute: ITableAttribute;
  mod: IModWithState;
  t: TFunction;
}

/**
 * A cell an extension draws itself, with its `customRenderer`, called and gated as the legacy
 * table does: the gate keeps the control's reactive props current, by the legacy cell's id.
 */
const CustomCell = ({ attribute, mod, t }: ICustomCellProps) => {
  let control: ReactNode = null;
  try {
    // `||` as the legacy table has it: `shown && <Control />` gives false, which the gate
    // would take for a broken control.
    control = attribute.customRenderer?.(mod, false, t, NO_HIGHLIGHT) || null;
  } catch (err) {
    logFailure("failed to render attribute", attribute, mod, err);
  }
  return control === null ? null : (
    <ExtensionGate id={`extension-${mod.id}-${attribute.id}`}>{control}</ExtensionGate>
  );
};

const isNewTableShown = (state: IState) => state.settings.mods?.betaTable === true;

const isInTable = ({ placement }: ITableAttribute) => placement === "table" || placement === "both";

/** Whether the legacy table shows an attribute's column before the user, or the extension, says. */
const isDefaultVisible = (attribute: ITableAttribute) => attribute.isDefaultVisible ?? true;

/**
 * Whether it's a column here: one the user can't toggle shows only if it does by default, as
 * the legacy table leaves one that doesn't for its extension to show (LAZ-1579).
 */
const isOffered = (attribute: ITableAttribute) =>
  isInTable(attribute) && (attribute.isToggleable === true || isDefaultVisible(attribute));

/**
 * How many times each attribute's `externalData` has said the data it's from changed, by id:
 * the legacy table's way to hear of changes to data outside the mods. Extensions give no way to
 * stop listening, so once unmounted, their calls are ignored, and some keep only the last
 * listener, so it listens only while the new table is shown, leaving them to the legacy one.
 */
const useExternalDataVersions = (attributes: ITableAttribute[], isNewTable: boolean) => {
  const [versions, setVersions] = useState<{ [attributeId: string]: number }>({});

  useEffect(() => {
    if (!isNewTable) {
      return undefined;
    }
    let mounted = true;
    for (const { id, externalData } of attributes) {
      externalData?.(() => {
        if (mounted) {
          setVersions((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [attributes, isNewTable]);

  return versions;
};

/**
 * The columns extensions register on the legacy Mods table, with `registerTableAttribute("mods", …)`,
 * for the new one.
 *
 * @param ownIds The table's own columns, which a registered one with the same id gives way to.
 * @param mods All the mods, whose changes a volatile column is worked out again for.
 */
export const useRegisteredModsColumns = (
  ownIds: ReadonlySet<string>,
  mods: { [id: string]: IModWithState },
) => {
  const { t } = useTranslation("common");
  const gameId = useSelector(activeGameId);
  const isNewTable = useSelector(isNewTableShown);
  const attributes = useExtensionObjects<ITableAttribute>(
    registerTableAttribute as (...args: unknown[]) => ITableAttribute | undefined,
    undefined,
    "mods",
  );
  const versions = useExternalDataVersions(attributes, isNewTable);

  const registered = useMemo(() => {
    const offered = attributes.filter(
      (attribute) =>
        isOffered(attribute) && !ownIds.has(attribute.id) && (attribute.condition?.() ?? true),
    );
    const toggleable = offered.filter((attribute) => attribute.isToggleable === true);
    const columns = offered.map((attribute): IModsTableColumn => {
      const header = preT(t, attribute.name);
      return {
        id: attribute.id,
        header,
        isToggleable: attribute.isToggleable === true,
        // Always one, so a column the user can't toggle takes its place too, not the front.
        position: attribute.position ?? DEFAULT_POSITION,
        cell: ({ mod }) =>
          attribute.customRenderer !== undefined ? (
            <CustomCell attribute={attribute} mod={mod} t={t} />
          ) : (
            <RegisteredValue
              attribute={attribute}
              header={header}
              mod={mod}
              t={t}
              version={versions[attribute.id] ?? 0}
              volatileMods={attribute.isVolatile ? mods : undefined}
            />
          ),
      };
    });

    const defaultShown = toggleable.filter(isDefaultVisible).map(({ id }) => id);
    const toggleableIds = new Set(toggleable.map(({ id }) => id));

    return { columns, defaultShown, toggleableIds };
    // A condition is mostly which game is active, so it's asked again when that changes.
  }, [attributes, gameId, mods, ownIds, t, versions]);

  const { columns, defaultShown, toggleableIds } = registered;

  /**
   * The classes extensions add to a row: from every attribute, as the legacy table asks them,
   * each told whether its column is shown: as the view says, for one the user toggles, and
   * otherwise whether it is by default.
   */
  const rowClassName = useCallback(
    ({ mod }: IModRow, isColumnShown: (columnId: string) => boolean) =>
      attributes
        .map((attribute) =>
          attribute.cssClass?.(
            mod,
            ownIds.has(attribute.id) || toggleableIds.has(attribute.id)
              ? isColumnShown(attribute.id)
              : isDefaultVisible(attribute),
          ),
        )
        .filter(Boolean)
        .join(" ") || undefined,
    [attributes, ownIds, toggleableIds],
  );

  return { columns, defaultShown, rowClassName };
};
