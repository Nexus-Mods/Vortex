import { getErrorMessageOrDefault, NexusGameDomain, type VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { Dispatch } from "redux";

import { useMainContext } from "@/contexts";
import { gameData } from "@/extensions/gamemode_management/gameData";
import { convertId, type IGameData } from "@/extensions/gamemode_management/queries";
import { currentGameDiscovery, discovered } from "@/extensions/gamemode_management/selectors";
import type { IDiscoveryResult } from "@/extensions/gamemode_management/types/IDiscoveryResult";
import { getGame } from "@/extensions/gamemode_management/util/getGame";
import {
  getModType,
  getModTypeExtensions,
} from "@/extensions/gamemode_management/util/modTypeExtensions";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { log } from "@/util/log";
import { activeGameId } from "@/util/selectors";

import { setModAttribute, setModType } from "../../actions/mods";
import type { IModWithState } from "../../types/IModProps";
import { keptDownloadGame, keptSection } from "../../util/kept_section/keptSection";
import { modsSharedValue } from "../../util/mods_shared_value/modsSharedValue";
import type { ModProperty } from "../use_mod_properties/useModProperties.hook";

/**
 * What a game extension's mod type code gives, none if it throws: that code is the extension's, so
 * a failure of it leaves out what it was to give, not the page.
 */
const fromExtension = <T>(typeId: string, what: string, read: () => T): T | undefined => {
  try {
    return read();
  } catch (err) {
    log("warn", `mod type ${what} failed`, {
      modType: typeId,
      error: getErrorMessageOrDefault(err),
    });
    return undefined;
  }
};

/** Where the active game is installed, if it's been found. */
const activeGamePath = (state: IState): string | undefined => currentGameDiscovery(state)?.path;

/** The games found installed, by their Vortex id. */
type InstalledGames = Readonly<Record<VortexGameId, IDiscoveryResult>>;

/** Where a game puts mods of a type, "" for one that doesn't deploy, none if the game's unknown. */
const deployPath = (gameId: VortexGameId, typeId: string, gamePath: string | undefined) => {
  const game = getGame(gameId);
  if (game === undefined) {
    return undefined;
  }

  const modType = getModType(typeId);
  return fromExtension(typeId, "path", () =>
    modType !== undefined ? modType.getPath(game) : game.getModPaths(gamePath)[""],
  );
};

/**
 * What a Nexus Mods game section is kept as, as the legacy field keeps it: the Vortex game for it,
 * the installed one where games share it, else, for a game Vortex has no extension for, its domain.
 */
const keptGameFor = (
  games: IGameData,
  gameDomain: NexusGameDomain,
  installed: InstalledGames,
): VortexGameId | NexusGameDomain =>
  convertId(games, { gameDomain, discovered: installed }, "vortexGameId") ?? gameDomain;

/** What the Advanced fields are built from. */
interface IAdvancedContext {
  t: TFunction;
  api: IExtensionApi;
  dispatch: Dispatch;
  gameId: VortexGameId;
  gamePath: string | undefined;
  /** The games found installed, which picks between games that share a section. */
  discovered: InstalledGames;
}

/**
 * The mods' type, then where it deploys them and its id while they share one, for installed mods
 * only: only an installed mod has one. Changing it has the mods' conflicts worked out again.
 */
const modTypeProperties = (
  mods: IModWithState[],
  { t, api, dispatch, gameId, gamePath }: IAdvancedContext,
): ModProperty[] => {
  if (mods.length === 0 || mods.some(({ state }) => state !== "installed")) {
    return [];
  }

  const { value: typeId, isVarious } = modsSharedValue(mods, ({ type }) => type ?? "");
  const path = isVarious ? undefined : deployPath(gameId, typeId, gamePath);

  return [
    {
      kind: "select",
      id: "modType",
      label: t("modsTable::properties::modType"),
      hint: t("modsTable::properties::modTypeHint"),
      emptyLabel: t("modsTable::properties::modTypeDefault"),
      value: typeId,
      isVarious,
      choices: getModTypeExtensions()
        .filter((type) =>
          Boolean(fromExtension(type.typeId, "support check", () => type.isSupported(gameId))),
        )
        .map((type) => ({ value: type.typeId, label: type.options.name || type.typeId })),
      onChange: (value) => {
        mods.forEach(({ id }) => dispatch(setModType(gameId, id, value)));
        api.events.emit(
          "recalculate-modtype-conflicts",
          mods.map(({ id }) => id),
        );
      },
    },
    ...(path
      ? [
          {
            kind: "value" as const,
            id: "deploysTo",
            label: t("modsTable::properties::deploysTo"),
            value: path,
            copyable: true,
          },
        ]
      : []),
    ...(!isVarious && typeId !== ""
      ? [
          {
            kind: "value" as const,
            id: "modTypeId",
            label: t("modsTable::properties::modTypeId"),
            value: typeId,
            copyable: true,
          },
        ]
      : []),
  ];
};

/**
 * One Nexus Mods mod's game section: the Nexus Mods game it was downloaded from, picked from every
 * one on the site, as the legacy field offers them, never none. Shown by its domain, the active
 * game's where none is kept; kept as the legacy field keeps it. Read-only for a mod that's only
 * downloaded, as the legacy field is.
 */
const gameSectionProperties = (
  mods: IModWithState[],
  games: IGameData,
  { t, dispatch, gameId, discovered: installed }: IAdvancedContext,
): ModProperty[] => {
  const [mod] = mods;
  if (mods.length !== 1 || mod.attributes?.source !== "nexus") {
    return [];
  }

  const { section, vortexGameName } = keptSection(games, keptDownloadGame(mod) ?? gameId);

  return [
    {
      kind: "select",
      id: "gameSection",
      label: t("modsTable::properties::gameSection"),
      hint: t("modsTable::properties::gameSectionHint"),
      value: section ?? "",
      // A game Vortex knows that has no Nexus Mods section yet is named, not guessed at.
      valueLabel: section === undefined ? vortexGameName : undefined,
      isVarious: false,
      disabled: mod.state === "downloaded",
      required: true,
      choices: games.nexusGames
        .map((game) => ({ value: game.domain_name, label: game.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      // The choices are the site's domains, so that's what comes back.
      onChange: (domain) =>
        dispatch(
          setModAttribute(
            gameId,
            mod.id,
            "downloadGame",
            keptGameFor(games, NexusGameDomain(domain), installed),
          ),
        ),
    },
  ];
};

/**
 * The selected mods' Advanced fields: their mod type, where it deploys them and its id, and one
 * Nexus Mods mod's game section, as the legacy table's are.
 */
export const useModAdvancedEdits = (mods: IModWithState[]): ModProperty[] => {
  const { t } = useTranslation("mod_management");
  const { api } = useMainContext();
  const dispatch = useDispatch();
  const gameId = useSelector(activeGameId);
  const gamePath = useSelector(activeGamePath);
  const games = useSelector(gameData);
  const installed = useSelector(discovered);

  return useMemo(() => {
    const context: IAdvancedContext = {
      t,
      api,
      dispatch,
      gameId,
      gamePath,
      discovered: installed,
    };
    return [...modTypeProperties(mods, context), ...gameSectionProperties(mods, games, context)];
  }, [api, dispatch, gameId, gamePath, games, installed, mods, t]);
};
