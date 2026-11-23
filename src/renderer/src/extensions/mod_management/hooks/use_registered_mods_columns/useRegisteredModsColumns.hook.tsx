import React, {
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import ExtensionGate from "@/controls/ExtensionGate";
import { registerTableAttribute } from "@/controls/table/registerTableAttribute";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { IState } from "@/types/IState";
import type { ICustomProps, ITableAttribute } from "@/types/ITableAttribute";
import { Icon } from "@/ui/components/icon/Icon";
import { LegacyTitled } from "@/ui/components/tooltip/legacy_title_tooltips/LegacyTitleTooltips";
import { getCurrentLanguage, preT, type TFunction } from "@/util/i18n";
import { activeGameId } from "@/util/selectors";

import { ValueText } from "../../components/value_text/ValueText";
import type { IModWithState } from "../../types/IModProps";
import {
  listenToExternalData,
  releaseExternalData,
} from "../../util/external_data_listeners/externalDataListeners";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import {
  logAttributeFailure,
  type ModsById,
  RegisteredValues,
} from "../../util/registered_values/registeredValues";
import { isShownAsRegistered } from "../../util/shown_as_registered/shownAsRegistered";
import {
  DEFAULT_POSITION,
  type IModsTableColumn,
} from "../use_mods_table_columns/useModsTableColumns.hook";

/** A `calc` value as text, a date in the user's language; none for one that has no text to show. */
export const valueText = (value: unknown): string | undefined => {
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
export const valueCell = (value: unknown, header: string): ReactNode => {
  if (value === true) {
    return <Icon name="check" size="sm" title={header} />;
  }
  const text = valueText(value);
  return text ? <ValueText>{text}</ValueText> : null;
};

/** What registered cells are drawn from outside their own mod. */
export interface IRegisteredModsInputs {
  /** All the mods, whose changes a volatile column's value is worked out again for. */
  mods: ModsById;
  /** How many times each attribute's `externalData` has said its data changed, by id. */
  versions: { [attributeId: string]: number };
}

const NO_INPUTS: IRegisteredModsInputs = { mods: {}, versions: {} };

const RegisteredModsInputs = createContext<IRegisteredModsInputs>(NO_INPUTS);

/**
 * Gives the registered columns' cells what they're drawn from outside their own mod, as the
 * columns themselves don't change with it; wraps the table that shows them.
 */
export const RegisteredModsInputsProvider = RegisteredModsInputs.Provider;

interface IRegisteredValueProps {
  attribute: ITableAttribute;
  mod: IModWithState;
  header: string;
  values: RegisteredValues;
}

/**
 * An attribute's `calc` value for a mod, as last worked out. One worked out asynchronously comes
 * once it's ready, drawing again, the last one staying until then.
 */
export const useRegisteredValue = (
  attribute: ITableAttribute,
  mod: IModWithState,
  values: RegisteredValues,
): unknown => {
  const { mods } = useContext(RegisteredModsInputs);
  const entry = values.get(attribute, mod, mods);
  const [, settled] = useReducer((count: number) => count + 1, 0);
  // Taken as it's drawn, as the value can be ready, and `entry.pending` gone, before effects run.
  const { pending } = entry;

  useEffect(() => {
    if (pending === undefined) {
      return undefined;
    }
    let current = true;
    void pending.then(() => {
      if (current) {
        settled();
      }
    });
    return () => {
      current = false;
    };
  }, [pending]);

  return entry.value;
};

/**
 * An attribute's `calc` values for several mods, in their order, as last worked out. Drawn again
 * as any value the attribute has is worked out, so one worked out asynchronously comes once ready.
 */
export const useRegisteredValues = (
  attribute: ITableAttribute,
  mods: readonly IModWithState[],
  values: RegisteredValues,
): unknown[] => {
  const { mods: all } = useContext(RegisteredModsInputs);
  useSyncExternalStore(values.subscribe, values.revision);
  return mods.map((mod) => values.get(attribute, mod, all).value);
};

/** A cell's `calc` value, as {@link useRegisteredValue} works it out. */
const RegisteredValue = ({ attribute, mod, header, values }: IRegisteredValueProps) =>
  valueCell(useRegisteredValue(attribute, mod, values), header);

// Only the Dependencies column highlights its row, while its icon is dragged over it, which
// comes once the table lets you drag one mod onto another to add a rule.
const NO_HIGHLIGHT: ICustomProps = { onHighlight: () => undefined };

interface ICustomCellProps {
  attribute: ITableAttribute;
  /**
   * The mod it's drawn for; in a details pane, every selected one, for an attribute that takes
   * several.
   */
  mod: IModWithState | readonly IModWithState[];
  t: TFunction;
  /** Whether it's drawn in a details pane rather than a table cell, which the renderer is told. */
  detail?: boolean;
  /** Changes when the data it's drawn from outside the mod does, which draws it again. */
  version: number;
}

/**
 * A cell an extension draws itself, with its `customRenderer`, called and gated as the legacy
 * table does: the gate keeps the control's reactive props current, by the legacy cell's id.
 * Drawn again only when its mod or its data outside the mods change, as in the legacy table,
 * as some renderers start work as they're called, such as Content's scan of the mod's files.
 */
const CustomCell = memo(({ attribute, mod, t, detail = false }: ICustomCellProps) => {
  // Named by the first of several, as the legacy pane names it.
  const [first] = ([] as IModWithState[]).concat(mod);
  let control: ReactNode = null;
  try {
    // `||` as the legacy table has it: `shown && <Control />` gives false, which the gate
    // would take for a broken control.
    control = attribute.customRenderer?.(mod, detail, t, NO_HIGHLIGHT) || null;
  } catch (err) {
    logAttributeFailure("failed to render attribute", attribute, first, err);
  }
  // Legacy controls name themselves with a title, shown in the tooltip around the table.
  return control === null ? null : (
    <LegacyTitled>
      <ExtensionGate id={`extension-${first.id}-${attribute.id}`}>{control}</ExtensionGate>
    </LegacyTitled>
  );
});

/** A {@link CustomCell}, given its attribute's version of the data outside the mods. */
export const VersionedCustomCell = (props: Omit<ICustomCellProps, "version">) => {
  const { versions } = useContext(RegisteredModsInputs);
  return <CustomCell {...props} version={versions[props.attribute.id] ?? 0} />;
};

/**
 * Extensions don't say how wide their columns are, and most show an icon or two, so each starts
 * as wide as the widest bundled one's header needs (Dependencies), not the table's default.
 */
const REGISTERED_COLUMN_WIDTH = "96px";

const isInTable = ({ placement }: ITableAttribute) => placement === "table" || placement === "both";

const isInDetails = ({ placement }: ITableAttribute) =>
  placement === "detail" || placement === "both";

/** The legacy details pane's order: by position, 100 where it has none. */
const byDetailPosition = (lhs: ITableAttribute, rhs: ITableAttribute) =>
  (lhs.position || 100) - (rhs.position || 100);

/**
 * Whether the attribute asks for its column to be shown here until the user says: only if it sets
 * `isDefaultVisible: true`, unlike in the legacy table, so the columns extensions add don't crowd
 * every view.
 */
const asksToBeShown = (attribute: ITableAttribute) => attribute.isDefaultVisible ?? false;

type LegacyColumnStates = { [attributeId: string]: { enabled?: boolean } } | undefined;

/** The legacy Mods table's column choices, which extensions also set with `setAttributeVisible`. */
const legacyColumnStates = (state: IState): LegacyColumnStates =>
  state.settings.tables?.mods?.attributes;

/**
 * Whether the legacy table shows an attribute's column: as last set, by the user or, for one
 * they can't toggle, its extension, such as the script extender's error column while there are
 * errors; otherwise as it does by default.
 */
const isLegacyShown = (attribute: ITableAttribute, states: LegacyColumnStates) =>
  states?.[attribute.id]?.enabled ?? attribute.isDefaultVisible ?? true;

/**
 * Whether the user can show or hide an attribute's column here: unless it says they can't, so a
 * column whose extension says nothing of toggling can still be hidden, unlike in the legacy
 * table.
 */
const canUserToggle = (attribute: ITableAttribute) => attribute.isToggleable ?? true;

/** Whether it's a column here: one the user can't toggle only while the legacy table shows it. */
const isOffered = (attribute: ITableAttribute, states: LegacyColumnStates) =>
  isInTable(attribute) && (canUserToggle(attribute) || isLegacyShown(attribute, states));

/**
 * How many times each attribute's `externalData` has said the data it's from changed, by id: the
 * legacy table's way to hear of changes to data outside the mods. Each change has its values
 * worked out again. It listens only while `isNewTable`, leaving them to the legacy table, as some
 * extensions keep only the last listener.
 *
 * @param quietly Whether their values are worked out again without telling `values`'
 * subscribers, for attributes only the caller shows, which its versions draw again.
 */
export const useExternalDataVersions = (
  attributes: ITableAttribute[],
  isNewTable: boolean,
  values: RegisteredValues,
  quietly = false,
) => {
  const [versions, setVersions] = useState<{ [attributeId: string]: number }>({});

  useEffect(() => {
    if (!isNewTable) {
      return undefined;
    }
    // By the attribute itself, which its `externalData` is called once for.
    const unsubscribes = attributes.map((attribute) =>
      listenToExternalData(attribute, () => {
        const { id } = attribute;
        values.invalidate(id, { quietly });
        setVersions((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [attributes, isNewTable, quietly, values]);

  return versions;
};

/**
 * Wraps part of the table's surroundings that listens to some attributes' data outside the mods
 * itself, with {@link useExternalDataVersions}, such as the Properties panel, so its cells are
 * drawn again as that data changes, as well as the table's.
 */
export const RegisteredModsVersionsProvider = ({
  versions,
  children,
}: {
  versions: { [attributeId: string]: number };
  children: ReactNode;
}) => {
  const outer = useContext(RegisteredModsInputs);
  const inputs = useMemo(() => {
    // Added, not replaced, so a cell heard of by both is drawn again as either hears of a change.
    const merged = { ...outer.versions };
    for (const [id, count] of Object.entries(versions)) {
      merged[id] = (merged[id] ?? 0) + count;
    }
    return { ...outer, versions: merged };
  }, [outer, versions]);
  return <RegisteredModsInputs.Provider value={inputs}>{children}</RegisteredModsInputs.Provider>;
};

/**
 * The columns extensions register on the legacy Mods table, with
 * `registerTableAttribute("mods", …)`, for the new one. They change only with the extensions, the
 * game and the table's own columns; what their cells show from outside their own mod comes in
 * `inputs`, for {@link RegisteredModsInputsProvider}.
 *
 * @param ownIds The table's own columns, which a registered one with the same id gives way to.
 * @param mods All the mods, whose changes a volatile column is worked out again for.
 * @param isNewTable Whether the new table is the one shown, which alone listens for changes.
 * @returns Also `details`, the attributes the legacy details pane shows, for the Properties panel,
 * whose values come from `textChanges` and `inputs` as the columns' do; and `detailsOnly`, those
 * of them the panel draws that aren't columns, whose data outside the mods it listens for itself, with
 * {@link useExternalDataVersions}.
 */
export const useRegisteredModsColumns = (
  ownIds: ReadonlySet<string>,
  mods: ModsById,
  isNewTable: boolean,
) => {
  const { t } = useTranslation("common");
  const gameId = useSelector(activeGameId);
  const attributes = useExtensionObjects<ITableAttribute>(
    registerTableAttribute as (...args: unknown[]) => ITableAttribute | undefined,
    undefined,
    "mods",
  );

  const legacyStates = useSelector(legacyColumnStates);

  const offered = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          isOffered(attribute, legacyStates) &&
          !ownIds.has(attribute.id) &&
          (attribute.condition?.() ?? true),
      ),
    // A condition is mostly which game is active, so it's asked again when that changes.
    [attributes, gameId, legacyStates, ownIds],
  );

  // What the legacy details pane shows, in its order, for the Properties panel.
  const details = useMemo(
    () =>
      attributes
        .filter((attribute) => isInDetails(attribute) && (attribute.condition?.() ?? true))
        .sort(byDetailPosition),
    // As for the columns: a condition is mostly which game is active.
    [attributes, gameId],
  );

  // The details the table doesn't listen for, as they're no column of it: the panel listens for
  // these itself while it's open, those it draws from their values, not as its own fields.
  const detailsOnly = useMemo(
    () =>
      details.filter((attribute) => !offered.includes(attribute) && isShownAsRegistered(attribute)),
    [details, offered],
  );

  // Kept apart from the columns, which a mod changing doesn't change; anew for a new language.
  const values = useMemo(() => new RegisteredValues(t), [attributes, t]);
  // The columns' alone: the Properties panel listens for its fields while it's open, so their
  // changes don't draw the table again.
  const versions = useExternalDataVersions(offered, isNewTable, values);

  // The legacy table calls every attribute's `externalData` as it mounts, taking the listener of
  // an extension that keeps only the last one, here or in the classic layout, so the new table
  // calls it again once it's back, though not as its columns are toggled or the panel opens.
  useEffect(() => {
    if (!isNewTable) {
      return undefined;
    }
    return () => attributes.forEach(releaseExternalData);
  }, [attributes, isNewTable]);

  useEffect(() => values.prune(mods), [mods, values]);

  const columns = useMemo(
    () =>
      offered.map((attribute): IModsTableColumn => {
        const header = preT(t, attribute.name);
        return {
          id: attribute.id,
          header,
          width: REGISTERED_COLUMN_WIDTH,
          isToggleable: canUserToggle(attribute),
          // Always one, so a column the user can't toggle takes its place too, not the front.
          position: attribute.position ?? DEFAULT_POSITION,
          // The value as text, as the legacy table's filter matches it; drawn or not.
          searchText:
            attribute.calc === undefined
              ? undefined
              : ({ mod }) => valueText(values.forSearch(attribute, mod).value) ?? "",
          cell: ({ mod }) =>
            attribute.customRenderer !== undefined ? (
              <VersionedCustomCell attribute={attribute} mod={mod} t={t} />
            ) : (
              <RegisteredValue attribute={attribute} header={header} mod={mod} values={values} />
            ),
        };
      }),
    [offered, t, values],
  );

  const { defaultShown, toggleableIds } = useMemo(() => {
    const toggleable = offered.filter(canUserToggle);
    return {
      defaultShown: toggleable.filter(asksToBeShown).map(({ id }) => id),
      toggleableIds: new Set(toggleable.map(({ id }) => id)),
    };
  }, [offered]);

  const inputs = useMemo<IRegisteredModsInputs>(() => ({ mods, versions }), [mods, versions]);

  /**
   * The classes extensions add to a row: from every attribute, as the legacy table asks them,
   * each told whether its column is shown: as the view says, for one the user toggles, and
   * otherwise whether the legacy table shows it.
   */
  const rowClassName = useCallback(
    ({ mod }: IModRow, isColumnShown: (columnId: string) => boolean) =>
      attributes
        .map((attribute) =>
          attribute.cssClass?.(
            mod,
            ownIds.has(attribute.id) || toggleableIds.has(attribute.id)
              ? isColumnShown(attribute.id)
              : isLegacyShown(attribute, legacyStates),
          ),
        )
        .filter(Boolean)
        .join(" ") || undefined,
    [attributes, legacyStates, ownIds, toggleableIds],
  );

  return {
    columns,
    defaultShown,
    rowClassName,
    inputs,
    textChanges: values,
    details,
    detailsOnly,
  };
};
