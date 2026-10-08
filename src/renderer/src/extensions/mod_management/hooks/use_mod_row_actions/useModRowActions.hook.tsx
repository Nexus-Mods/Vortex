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

/** The group extensions register a mod row's actions into, as the legacy table read them. */
const ROW_ACTIONS_GROUP = "mods-action-icons";

const NO_PINS: { [actionId: string]: boolean } = {};

const byPosition = (a: IActionDefinition, b: IActionDefinition) =>
  (a.position ?? 100) - (b.position ?? 100);

/** How the row menu shows an action, matched by its registered title. */
interface IRowMenuItem {
  title: string;
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
      // The Mods toolbar's Manage Rules icon: the design's, Material's `rule`, has no MDI path.
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

/**
 * The actions a Mods table row offers: the legacy table's own row actions and every
 * extension's in `mods-action-icons`, laid out as {@link ROW_MENU} has them. One that rules
 * itself out for a mod is left out, unless it's pinned: then it stays, disabled, so every row
 * has the same buttons in the same places. A component can't become an action, so those stay
 * in the legacy table, as on the toolbar; Check for Update has an action of its own here.
 *
 * A mod's actions are worked out once and kept until the store changes, as their conditions
 * read it: some scan every mod, and rows re-render on each frame of a scroll.
 */
export const useModRowActions = (rowActions: ITableRowAction[]) => {
  const { t } = useTranslation(["common"]);
  const registered = useExtensionObjects<IActionDefinition>(
    registerAction,
    undefined,
    ROW_ACTIONS_GROUP,
    true,
  );
  const pins = useSelector(
    (state: IState) => state.settings.toolbars?.[MOD_ROW_PINNING_ID]?.pinned ?? NO_PINS,
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

    return [
      checkForUpdateAction,
      ...rowActions.filter((action) => action.singleRowAction ?? true),
      ...registered,
    ]
      .filter(
        (definition) =>
          definition.title !== undefined &&
          definition.component === undefined &&
          !definition.options?.isClassicOnly,
      )
      .sort(byPosition)
      .sort((a, b) => menuOrder(a) - menuOrder(b))
      .filter((definition) => !seen.has(definition.title) && !!seen.add(definition.title));
  }, [checkForUpdate, registered, rowActions, store]);

  const pinnedCount = definitions.filter((definition) => pins[definition.title] === true).length;

  // keyed by mod id; a fresh one whenever what the actions are built from changes
  const cache = useMemo(() => new Map<string, IToolbarAction[]>(), [definitions, pins, t]);
  useEffect(() => store.subscribe(() => cache.clear()), [cache, store]);

  const actionsFor = useCallback(
    (modId: string): IToolbarAction[] => {
      const cached = cache.get(modId);
      if (cached !== undefined) {
        return cached;
      }

      const instanceIds = [modId];

      const actions = definitions.reduce<IToolbarAction[]>((list, definition) => {
        let condition: boolean | string;
        try {
          condition = definition.condition?.(instanceIds) ?? true;
        } catch (err) {
          condition = getErrorMessageOrDefault(err);
        }

        if (condition === false && pins[definition.title] !== true) {
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
          disabled: condition !== true,
          extension: definition.options?.namespace,
          onClick: () => definition.action?.(instanceIds),
        });

        return list;
      }, []);

      cache.set(modId, actions);
      return actions;
    },
    [cache, definitions, pins, t],
  );

  return { actionsFor, pinnedCount };
};
