import {
  mdiBackupRestore,
  mdiBug,
  mdiDeleteOutline,
  mdiFolderOpenOutline,
  mdiPlus,
  mdiPuzzleOutline,
  mdiRefresh,
} from "@mdi/js";
import { getErrorMessageOrDefault } from "@vortex/shared";
import React, { type ReactNode, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector, useStore } from "react-redux";

import { registerAction } from "@/controls/ActionControl";
import type { ITableRowAction } from "@/controls/Table";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { IActionDefinition } from "@/types/IActionDefinition";
import type { IState } from "@/types/IState";
import { NexusBadge } from "@/ui/components/badges/nexus_badge/NexusBadge";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { activeGameId } from "@/util/selectors";
import { getIconPath } from "@/views/components/iconMap";

import { useCheckModUpdate } from "../use_check_mod_update/useCheckModUpdate.hook";

/** Where the rows' pins are stored, shared so an action pinned on one row shows on every row. */
export const MOD_ROW_PINNING_ID = "mods-table-row";

/** Where the selected mods' bar keeps its pins, apart from the rows'. */
export const MOD_SELECTION_PINNING_ID = "mods-table-selection";

/** The group extensions register a mod row's actions into, as the legacy table read them. */
const ROW_ACTIONS_GROUP = "mods-action-icons";

/** The group extensions register actions on several mods into, as the legacy table's footer read them. */
const SELECTION_ACTIONS_GROUP = "mods-multirow-actions";

/** On the selected mods' bar until the user unpins them. */
const SELECTION_PINS = new Set(["Check for Update", "Reinstall", "Remove"]);

/** The legacy table's, which the selected mods' bar has a switch for instead. */
const SWITCH_TITLES = new Set(["Enable", "Disable"]);

const NO_PINS: { [actionId: string]: boolean } = {};
const NO_TITLES = new Set<string>();

const byPosition = (a: IActionDefinition, b: IActionDefinition) =>
  (a.position ?? 100) - (b.position ?? 100);

/** How the row menu shows an action, matched by its registered title. */
interface IRowMenuItem {
  /** The title it was registered with, which matches it. */
  title: string;
  /** What the menu calls it, untranslated. */
  label: string;
  /** Unset keeps the icon it registered with. */
  iconPath?: string;
  /** In place of `iconPath`, for an icon a path can't draw. */
  icon?: ReactNode;
}

/**
 * The row menu as the design has it: its sections, in order, with their labels and icons.
 * Anything else registered comes after, in a section of its own, by position.
 */
const ROW_MENU: Array<{ section: string; items: IRowMenuItem[] }> = [
  {
    section: "manage",
    items: [
      { title: "Install", label: "Install" },
      { title: "Unpack (as-is)", label: "Unpack (as-is)" },
      { title: "Reinstall", label: "Reinstall", iconPath: mdiBackupRestore },
      { title: "Check for Update", label: "Check for updates", iconPath: mdiRefresh },
      { title: "Remove related", label: "Remove related", iconPath: mdiDeleteOutline },
      { title: "Remove", label: "Remove", iconPath: mdiDeleteOutline },
    ],
  },
  {
    section: "dependencies",
    items: [
      {
        title: "Manage File Conflicts",
        label: "Manage file conflicts",
        iconPath: getIconPath("rules"),
      },
      { title: "Install Recommendations", label: "Install recommendations", iconPath: mdiPlus },
    ],
  },
  {
    section: "open",
    items: [
      {
        title: "Open in File Manager",
        label: "Open in file manager",
        iconPath: mdiFolderOpenOutline,
      },
      { title: "Open Archive", label: "Open archive", iconPath: mdiFolderOpenOutline },
      { title: "Open on Nexus Mods", label: "Open on Nexus Mods", icon: <NexusBadge /> },
    ],
  },
  {
    section: "maintenance",
    items: [
      { title: "Refresh Content", label: "Refresh content", iconPath: mdiRefresh },
      { title: "Create Report", label: "Generate mod report", iconPath: mdiBug },
    ],
  },
];

const OTHER_SECTION = "other";

const MENU_ITEMS = new Map(
  ROW_MENU.flatMap(({ section, items }, sectionIndex) =>
    items.map((item, index) => [
      item.title,
      { ...item, section, order: sectionIndex * 100 + index },
    ]),
  ),
);

const menuOrder = (definition: IActionDefinition) =>
  MENU_ITEMS.get(definition.title)?.order ?? Number.MAX_SAFE_INTEGER;

/** Where one set of a mod's actions comes from, and where its pins are kept. */
interface IModActionsSource {
  /** Which of the legacy table's actions it offers. */
  offers: (action: ITableRowAction) => boolean;
  /** The group extensions register its actions into. */
  group: string;
  /** Where its pins are kept. */
  pinningId: string;
  /** Pinned until the user says otherwise. */
  defaultPins: Set<string>;
  /** Titles left out, for something offered another way. */
  leftOut: Set<string>;
}

const ROW_SOURCE: IModActionsSource = {
  offers: (action) => action.singleRowAction ?? true,
  group: ROW_ACTIONS_GROUP,
  pinningId: MOD_ROW_PINNING_ID,
  defaultPins: NO_TITLES,
  leftOut: NO_TITLES,
};

const SELECTION_SOURCE: IModActionsSource = {
  offers: (action) => action.multiRowAction ?? true,
  group: SELECTION_ACTIONS_GROUP,
  pinningId: MOD_SELECTION_PINNING_ID,
  defaultPins: SELECTION_PINS,
  leftOut: SWITCH_TITLES,
};

/**
 * The actions a source offers, laid out as {@link ROW_MENU} has them, with whether each is
 * pinned and a way to make them into toolbar actions for some mods.
 */
const useModActions = (rowActions: ITableRowAction[], source: IModActionsSource) => {
  const { t } = useTranslation(["common"]);
  const registered = useExtensionObjects<IActionDefinition>(
    registerAction,
    undefined,
    source.group,
    true,
  );
  const pins = useSelector(
    (state: IState) => state.settings.toolbars?.[source.pinningId]?.pinned ?? NO_PINS,
  );
  const store = useStore<IState>();
  const checkForUpdate = useCheckModUpdate();

  // Titles are the ids pins are stored against, so the first of a title wins.
  const definitions = useMemo(() => {
    const seen = new Set<string>();

    // In place of the legacy table's, a component: offered for an installed mod, as that was.
    const checkForUpdateAction: IActionDefinition = {
      title: "Check for Update",
      action: (modIds: string[]) => void checkForUpdate(modIds),
      condition: (modIds: string[]) => {
        const state = store.getState();
        return modIds.some((modId) => state.persistent.mods?.[activeGameId(state)]?.[modId]);
      },
    };

    return [checkForUpdateAction, ...rowActions.filter(source.offers), ...registered]
      .filter(
        (definition) =>
          definition.title !== undefined &&
          definition.component === undefined &&
          !definition.options?.isClassicOnly &&
          !source.leftOut.has(definition.title),
      )
      .sort(byPosition)
      .sort((a, b) => menuOrder(a) - menuOrder(b))
      .filter((definition) => !seen.has(definition.title) && !!seen.add(definition.title));
  }, [checkForUpdate, registered, rowActions, source, store]);

  const isPinned = useCallback(
    (title: string) => pins[title] ?? source.defaultPins.has(title),
    [pins, source],
  );

  const pinnedCount = definitions.filter((definition) => isPinned(definition.title)).length;

  /**
   * The actions for some mods. One that rules itself out for them is left out, unless it's
   * pinned: then it stays, disabled, so its button keeps its place.
   */
  const build = useCallback(
    (instanceIds: string[]): IToolbarAction[] =>
      definitions.reduce<IToolbarAction[]>((list, definition) => {
        let condition: boolean | string;
        try {
          condition = definition.condition?.(instanceIds) ?? true;
        } catch (err) {
          condition = getErrorMessageOrDefault(err);
        }

        if (condition === false && !isPinned(definition.title)) {
          return list;
        }

        const menuItem = MENU_ITEMS.get(definition.title);

        list.push({
          // The registered title, not its translation, so a pin survives a language change.
          id: definition.title,
          label: t(menuItem?.label ?? definition.title),
          iconPath: menuItem?.iconPath ?? getIconPath(definition.icon, mdiPuzzleOutline),
          icon: menuItem?.icon,
          section: menuItem?.section ?? OTHER_SECTION,
          pinned: source.defaultPins.has(definition.title),
          disabled: condition !== true,
          extension: definition.options?.namespace,
          onClick: () => definition.action?.(instanceIds),
        });

        return list;
      }, []),
    [definitions, isPinned, source, t],
  );

  return { build, pinnedCount, store };
};

/**
 * The actions a Mods table row offers: the legacy table's own row actions and every
 * extension's in `mods-action-icons`. A component can't become an action, so those stay
 * in the legacy table, as on the toolbar; Check for Update has an action of its own here.
 *
 * A mod's actions are worked out once and kept until the store changes, as their conditions
 * read it: some scan every mod, and rows re-render on each frame of a scroll.
 */
export const useModRowActions = (rowActions: ITableRowAction[]) => {
  const { build, pinnedCount, store } = useModActions(rowActions, ROW_SOURCE);

  // keyed by mod id; a fresh one whenever what the actions are built from changes
  const cache = useMemo(() => new Map<string, IToolbarAction[]>(), [build]);
  useEffect(() => store.subscribe(() => cache.clear()), [cache, store]);

  const actionsFor = useCallback(
    (modId: string): IToolbarAction[] => {
      const cached = cache.get(modId);
      if (cached !== undefined) {
        return cached;
      }

      const actions = build([modId]);
      cache.set(modId, actions);
      return actions;
    },
    [build, cache],
  );

  return { actionsFor, pinnedCount };
};

/**
 * The actions on the selected mods' bar: the legacy table's own for several rows and every
 * extension's in `mods-multirow-actions`, but Enable and Disable, which the bar's switch
 * does. Check for updates, Reinstall and Remove are pinned until the user unpins them.
 */
export const useModSelectionActions = (rowActions: ITableRowAction[], modIds: string[]) => {
  const { build } = useModActions(rowActions, SELECTION_SOURCE);

  return useMemo(() => build(modIds), [build, modIds]);
};
