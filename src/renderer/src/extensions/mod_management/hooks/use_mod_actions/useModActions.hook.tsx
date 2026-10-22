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
import type { IIconProp } from "@/ui/components/icon/Icon";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { nxmCollection, nxmCollectionOutline } from "@/ui/icon-paths";
import { activeGameId } from "@/util/selectors";
import { getIcon } from "@/views/components/icon_map/iconMap";

import { calculateModSize } from "../../util/calculate_mod_size/calculateModSize.util";
import { useCheckModUpdate } from "../use_check_mod_update/useCheckModUpdate.hook";
import { useUninstallMods } from "../use_uninstall_mods/useUninstallMods.hook";

/** Where the rows' pins are stored, shared so an action pinned on one row shows on every row. */
export const MOD_ROW_PINNING_ID = "mods-table-row";

/** Where the selected mods' bar keeps its pins, apart from the rows'. */
export const MOD_SELECTION_PINNING_ID = "mods-table-selection";

/** The group extensions register a mod row's actions into, as the legacy table read them. */
const ROW_ACTIONS_GROUP = "mods-action-icons";

/** The group extensions register actions on several mods into, as the legacy table's footer read them. */
const SELECTION_ACTIONS_GROUP = "mods-multirow-actions";

/** On the selected mods' bar until the user unpins them. */
const SELECTION_PINS = new Set([
  "Add to Collection...",
  "Check for Update",
  "Reinstall",
  "Uninstall",
  "Remove",
]);

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
  icon?: IIconProp;
}

/**
 * The row menu as the design has it: its sections, in order, with their labels and icons.
 * Anything else registered comes after, in a section of its own, by position.
 */
const ROW_MENU: Array<{ section: string; items: IRowMenuItem[] }> = [
  {
    section: "manage",
    items: [
      {
        title: "Add to Collection...",
        label: "Add to Collection",
        icon: { path: nxmCollectionOutline },
      },
      {
        title: "Remove from Collection...",
        label: "Remove from Collection",
        icon: { path: nxmCollection },
      },
      { title: "Install", label: "Install", icon: "install_desktop" },
      { title: "Unpack (as-is)", label: "Unpack (as-is)" },
      { title: "Reinstall", label: "Reinstall", icon: "reset_tv" },
      { title: "Uninstall", label: "Uninstall", icon: "do_not_disturb_on" },
      { title: "Remove related", label: "Remove related", icon: "delete" },
      { title: "Remove", label: "Remove", icon: "delete" },
      { title: "Check for Update", label: "Check for updates", icon: "refresh" },
      {
        title: "Apply Collection Rules",
        label: "Apply collection rules",
        icon: "playlist_add_check",
      },
      { title: "Edit Collection", label: "Edit collection", icon: "edit" },
    ],
  },
  {
    section: "dependencies",
    items: [
      {
        title: "Manage File Conflicts",
        label: "Manage file conflicts",
        icon: getIcon("rules"),
      },
      {
        title: "Install Recommendations",
        label: "Install recommendations",
        icon: "install_desktop",
      },
    ],
  },
  {
    section: "open",
    items: [
      {
        title: "Open in File Manager",
        label: "Open in file manager",
        icon: "folder_open",
      },
      { title: "Open Archive", label: "Open archive", icon: "folder_open" },
      { title: "Open on Nexus Mods", label: "Open on Nexus Mods", icon: <NexusBadge /> },
    ],
  },
  // Several mods' only: these are offered for a selection, not a row.
  {
    section: "organise",
    items: [
      { title: "Combine", label: "Combine", icon: "call_merge" },
      { title: "Track", label: "Track", icon: "pets" },
      { title: "Untrack", label: "Untrack", icon: { name: "pets", filled: true } },
    ],
  },
  {
    section: "maintenance",
    items: [
      { title: "Refresh Content", label: "Refresh content", icon: "rotate_right" },
      { title: "Fix missing IDs", label: "Fix missing IDs", icon: "data_alert" },
      {
        title: "Create Report",
        label: "Generate mod report",
        icon: { name: "bug_report", filled: true },
      },
    ],
  },
];

/** The selected mods' menu reorders the first section: Check for updates first. */
const SELECTION_MANAGE_ORDER = [
  "Check for Update",
  "Add to Collection...",
  "Remove from Collection...",
  "Install",
  "Unpack (as-is)",
  "Reinstall",
  "Uninstall",
  "Remove related",
  "Remove",
];

const SELECTION_MENU = ROW_MENU.map(({ section, items }) => ({
  section,
  items:
    section === "manage"
      ? SELECTION_MANAGE_ORDER.flatMap((title) => items.filter((item) => item.title === title))
      : items,
}));

const OTHER_SECTION = "other";

/** The mod-content extension's, which also works out the mods' sizes again here. */
const REFRESH_CONTENT = "Refresh Content";

type IMenuItems = Map<string, IRowMenuItem & { section: string; order: number }>;

const menuItems = (menu: typeof ROW_MENU): IMenuItems =>
  new Map(
    menu.flatMap(({ section, items }, sectionIndex) =>
      items.map((item, index) => [
        item.title,
        { ...item, section, order: sectionIndex * 100 + index },
      ]),
    ),
  );

const menuOrder = (menu: IMenuItems, definition: IActionDefinition) =>
  menu.get(definition.title)?.order ?? Number.MAX_SAFE_INTEGER;

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
  /** How its menu lays the actions out. */
  menu: IMenuItems;
}

const ROW_SOURCE: IModActionsSource = {
  offers: (action) => action.singleRowAction ?? true,
  group: ROW_ACTIONS_GROUP,
  pinningId: MOD_ROW_PINNING_ID,
  defaultPins: NO_TITLES,
  leftOut: NO_TITLES,
  menu: menuItems(ROW_MENU),
};

const SELECTION_SOURCE: IModActionsSource = {
  offers: (action) => action.multiRowAction ?? true,
  group: SELECTION_ACTIONS_GROUP,
  pinningId: MOD_SELECTION_PINNING_ID,
  defaultPins: SELECTION_PINS,
  leftOut: SWITCH_TITLES,
  menu: menuItems(SELECTION_MENU),
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
  const uninstall = useUninstallMods();

  // Titles are the ids pins are stored against, so the first of a title wins.
  const definitions = useMemo(() => {
    const seen = new Set<string>();

    const someInstalled = (modIds: string[]) => {
      const state = store.getState();
      return modIds.some((modId) => state.persistent.mods?.[activeGameId(state)]?.[modId]);
    };

    // Installed, and with the archive to install it again from: one without would be gone
    // for good, which is Remove's to do, as it asks first.
    const uninstallable = (modIds: string[]) => {
      const state = store.getState();
      const installed = state.persistent.mods?.[activeGameId(state)] ?? {};
      return modIds.filter((modId) => {
        const archiveId = installed[modId]?.archiveId;
        return archiveId !== undefined && state.persistent.downloads.files[archiveId] !== undefined;
      });
    };

    // In place of the legacy table's, a component: offered for an installed mod, as that was.
    const checkForUpdateAction: IActionDefinition = {
      title: "Check for Update",
      action: (modIds: string[]) => void checkForUpdate(modIds),
      condition: someInstalled,
    };

    // The legacy table's "Uninstalled" status, as an action: the archive stays to reinstall from.
    const uninstallAction: IActionDefinition = {
      title: "Uninstall",
      action: (modIds: string[]) => void uninstall(uninstallable(modIds)),
      condition: (modIds: string[]) => uninstallable(modIds).length > 0,
    };

    // The Mod size column can't be clicked to work a size out, as the legacy table's can,
    // so Refresh content does it as well.
    const withSizeRefresh = (definition: IActionDefinition): IActionDefinition =>
      definition.title !== REFRESH_CONTENT
        ? definition
        : {
            ...definition,
            action: (...args: Parameters<IActionDefinition["action"]>) => {
              definition.action?.(...args);
              const [instanceIds] = args;
              const modIds = Array.isArray(instanceIds) ? instanceIds : [instanceIds];
              const gameId = activeGameId(store.getState());
              modIds.forEach((modId) => void calculateModSize(store, gameId, modId));
            },
          };

    return [
      checkForUpdateAction,
      uninstallAction,
      ...rowActions.filter(source.offers),
      ...registered,
    ]
      .map(withSizeRefresh)
      .filter(
        (definition) =>
          definition.title !== undefined &&
          definition.component === undefined &&
          !definition.options?.isClassicOnly &&
          !source.leftOut.has(definition.title),
      )
      .sort(byPosition)
      .sort((a, b) => menuOrder(source.menu, a) - menuOrder(source.menu, b))
      .filter((definition) => !seen.has(definition.title) && !!seen.add(definition.title));
  }, [checkForUpdate, registered, rowActions, source, store, uninstall]);

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

        const menuItem = source.menu.get(definition.title);

        list.push({
          // The registered title, not its translation, so a pin survives a language change.
          id: definition.title,
          label: t(menuItem?.label ?? definition.title),
          icon: menuItem?.icon ?? getIcon(definition.icon, "extension"),
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
 * does. Add to Collection, Reinstall, Uninstall, Check for updates and Remove are pinned until
 * the user unpins them.
 */
export const useModSelectionActions = (rowActions: ITableRowAction[], modIds: string[]) => {
  const { build } = useModActions(rowActions, SELECTION_SOURCE);

  return useMemo(() => build(modIds), [build, modIds]);
};
