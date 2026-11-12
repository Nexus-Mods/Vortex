import { getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { registerAction } from "@/controls/ActionControl";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { IAvailableExtension } from "@/types/extensions";
import type { IActionDefinition } from "@/types/IActionDefinition";
import type { IState } from "@/types/IState";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { getIcon } from "@/views/components/icon_map/iconMap";

import {
  clearGameAddStore,
  setGameAddExtension,
  setGameAddOrigin,
  setGameAddStore,
} from "../../actions/session";
import { setGameHidden } from "../../actions/settings";
import type { GameSource } from "../../types/GameSource";

/**
 * Where a tile stops leading with an action and starts filing it in the menu. It's the
 * split the classic tile drew between its hover buttons and its info popover, so an
 * extension that placed an action on either side keeps the side it chose.
 */
const MENU_POSITION = 100;

/** Sits the details row where the design has it, directly under Hide. */
const DETAILS_POSITION = MENU_POSITION + 1;

/**
 * Actions that open something on disk fold into a single "Open" row rather than taking
 * one each — the game folder and the mod folder come to sit behind one item that way,
 * as the mods toolbar folds the same icon.
 */
const OPEN_ICON = "open-ext";

interface IPositionedAction {
  position: number;
  /**
   * What the row is called in analytics: the registered title, untranslated, or the
   * tile's own name for the rows it builds.
   */
  analyticsKey: string;
  /** The registered icon name, which is what decides whether a row folds. */
  icon?: string;
  action: IMenuAction;
}

export interface IGameCardActions {
  /** Sections for the tile's overflow menu. */
  menu: IMenuAction[][];
  /** What the tile leads with on its art, when the game offers anything. */
  primary?: { label: string; onClick: () => void };
}

const byPosition = (lhs: IPositionedAction, rhs: IPositionedAction) => lhs.position - rhs.position;

/**
 * Adapts the actions extensions registered for a game the way IconBar rendered them:
 * dropped when `condition` returns false, disabled when it returns a string, ordered by
 * `position`.
 *
 * Modelled on `useModToolbarActions`, which does the same for the mods toolbar.
 */
const useRegisteredActions = (group: string, gameId: string): IPositionedAction[] => {
  const { t } = useTranslation();
  const objects = useExtensionObjects<IActionDefinition>(registerAction, undefined, group, true);
  const instanceIds = useMemo(() => [gameId], [gameId]);

  return objects.reduce<IPositionedAction[]>((prev, definition) => {
    // A component registration only ever draws on the classic tile: a menu row needs a
    // label and an icon of its own. Hide is the one the design asks for, and it's built
    // below rather than read from here.
    if (definition.component !== undefined || definition.options?.isClassicOnly) {
      return prev;
    }

    let condition: boolean | string;
    try {
      condition = definition.condition?.(instanceIds) ?? true;
    } catch (err) {
      condition = getErrorMessageOrDefault(err);
    }

    if (condition === false) {
      return prev;
    }

    prev.push({
      position: definition.position ?? MENU_POSITION,
      analyticsKey: definition.title,
      icon: definition.icon,
      action: {
        // Registrations are inconsistent about translating their own title, and a
        // string already translated passes through untouched.
        label: t(definition.title),
        icon: getIcon(definition.icon),
        disabled: typeof condition === "string",
        onClick: () => definition.action?.(instanceIds),
      },
    });

    return prev;
  }, []);
};

/**
 * Everything a game tile can do with its game: the one action it leads with, and the
 * rest behind its overflow button.
 *
 * The actions come from the same `game-managed-buttons` / `game-unmanaged-buttons`
 * groups the classic tile fed to IconBar, so an extension that registers a game action
 * still reaches the tile. Hide and Game details are the tile's own, the first because
 * it was only ever registered as a classic toolbar component and the second because
 * the details are a dialog now rather than a popover of their own.
 *
 * `onMenuAction` hears which menu row ran, by its analytics key, before the row runs.
 */
export const useGameCardActions = (
  gameId: string,
  type: string,
  onShowDetails: () => void,
  source?: GameSource,
  onMenuAction?: (action: string) => void,
  store?: string,
  extension?: IAvailableExtension,
): IGameCardActions => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const registered = useRegisteredActions(`game-${type}-buttons`, gameId);

  const hidden = useSelector(
    (state: IState) => state.settings.gameMode.discovered[gameId]?.hidden ?? false,
  );

  return useMemo(() => {
    const sorted = [...registered].sort(byPosition);
    const leads = sorted[0] !== undefined && sorted[0].position < MENU_POSITION;

    const hide: IPositionedAction = {
      position: MENU_POSITION,
      analyticsKey: hidden ? "show" : "hide",
      action: {
        label: hidden ? t("Show") : t("Hide"),
        icon: getIcon(hidden ? "show" : "hide"),
        onClick: () => dispatch(setGameHidden(gameId, !hidden)),
      },
    };

    const details: IPositionedAction = {
      position: DETAILS_POSITION,
      analyticsKey: "game_details",
      action: {
        label: t("Game details"),
        icon: getIcon("game"),
        onClick: onShowDetails,
      },
    };

    // A row that opens a panel has no click of its own; the rows inside it report.
    const withReporting = (entry: IPositionedAction): IMenuAction => {
      const { onClick, panel, ...row } = entry.action;
      if (onClick === undefined || panel !== undefined || onMenuAction === undefined) {
        return entry.action;
      }

      return {
        ...row,
        onClick: () => {
          onMenuAction(entry.analyticsKey);
          onClick();
        },
      };
    };

    const rest = leads ? sorted.slice(1) : sorted;
    const opens = rest.filter((entry) => entry.icon === OPEN_ICON);
    const openLabel = t("Open");

    // A single one is itself rather than a menu of one, which keeps a game whose mod
    // folder isn't reachable from showing an "Open" row to reach one thing.
    const open: IPositionedAction[] =
      opens.length > 1
        ? [
            {
              position: opens[0].position,
              analyticsKey: "open",
              action: {
                label: openLabel,
                icon: getIcon(OPEN_ICON),
                panelRole: "menu",
                panel: ({ dismiss }) => (
                  <PopoverMenu
                    actions={[opens.map(withReporting)]}
                    label={openLabel}
                    onSelect={dismiss}
                  />
                ),
              },
            },
          ]
        : opens;

    const menu = [hide, details, ...open, ...rest.filter((entry) => entry.icon !== OPEN_ICON)]
      .sort(byPosition)
      .map(withReporting);

    return {
      menu: [menu],
      primary:
        leads &&
        // The lead action of an unadded game is its add; recording the list it was
        // picked from lets app_game_manage attribute the add. Never set for the
        // added section, whose lead is an "Open".
        source !== undefined
          ? {
              label: sorted[0].action.label,
              onClick: () => {
                // Every click starts a new pick, so an earlier tile's store or extension isn't
                // used for this one
                dispatch(clearGameAddStore());
                dispatch(setGameAddOrigin(gameId, source));
                dispatch(setGameAddExtension(extension ?? null));
                // A tile of the detected list names the store the user is picking; the
                // add manages that store's install, so discovery mustn't choose another.
                if (source === "detected_list" && store !== undefined) {
                  dispatch(setGameAddStore(VortexGameId(gameId), store));
                }
                sorted[0].action.onClick?.();
              },
            }
          : leads
            ? { label: sorted[0].action.label, onClick: () => sorted[0].action.onClick?.() }
            : undefined,
    };
  }, [
    dispatch,
    extension,
    gameId,
    hidden,
    onMenuAction,
    onShowDetails,
    registered,
    source,
    store,
    t,
  ]);
};
