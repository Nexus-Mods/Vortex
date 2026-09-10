import { getErrorMessageOrDefault } from "@vortex/shared";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { registerAction } from "@/controls/ActionControl";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { IActionDefinition } from "@/types/IActionDefinition";
import type { IState } from "@/types/IState";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/PopoverMenuItem";
import { getIconPath } from "@/views/components/iconMap";

import { setGameHidden } from "../../actions/settings";

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
      icon: definition.icon,
      action: {
        // Registrations are inconsistent about translating their own title, and a
        // string already translated passes through untouched.
        label: t(definition.title),
        iconPath: getIconPath(definition.icon),
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
 */
export const useGameCardActions = (
  gameId: string,
  type: string,
  onShowDetails: () => void,
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
      action: {
        label: hidden ? t("Show") : t("Hide"),
        iconPath: getIconPath(hidden ? "show" : "hide"),
        onClick: () => dispatch(setGameHidden(gameId, !hidden)),
      },
    };

    const details: IPositionedAction = {
      position: DETAILS_POSITION,
      action: {
        label: t("Game details"),
        iconPath: getIconPath("game"),
        onClick: onShowDetails,
      },
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
              action: {
                label: openLabel,
                iconPath: getIconPath(OPEN_ICON),
                panelRole: "menu",
                panel: ({ dismiss }) => (
                  <PopoverMenu
                    actions={[opens.map((entry) => entry.action)]}
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
      .map((entry) => entry.action);

    return {
      menu: [menu],
      primary: leads
        ? { label: sorted[0].action.label, onClick: () => sorted[0].action.onClick?.() }
        : undefined,
    };
  }, [dispatch, gameId, hidden, onShowDetails, registered, t]);
};
