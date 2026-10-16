import type { IGameListEntry } from "@nexusmods/nexus-api";
import { ratio } from "fuzzball";
import memoizeOne from "memoize-one";
import React, { type ComponentClass, useMemo, useRef, useState } from "react";
import type { WithTranslation } from "react-i18next";

import type { IAvailableExtension } from "@/types/extensions";
import type { IExtensionState } from "@/types/IState";
import type { IState } from "@/types/IState";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { isContributed } from "@/util/isContributed";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { connect, translate } from "../../../controls/ComponentEx";
import { activeGameId } from "../../../util/selectors";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";
import type { IProfile } from "../../profile_management/types/IProfile";
import { setShowHiddenGames } from "../actions/session";
import { setPickerLayout, setSortManaged, setSortUnmanaged } from "../actions/settings";
import { AddedGames } from "../components/added_games/AddedGames";
import { DetectedGames } from "../components/detected_games/DetectedGames";
import { Search } from "../components/search/Search";
import { Section } from "../components/section/Section";
import { SupportedGames } from "../components/supported_games/SupportedGames";
import {
  DEFAULT_PICKER_LAYOUT,
  useDisplayOptionsAction,
} from "../hooks/useDisplayOptionsAction.hook";
import type { IDetectedGame } from "../types/IDetectedGame";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import { detectedInternalId } from "../util/detected_games/detectedInternalId";
import { detectedStore } from "../util/detected_games/detectedStore";
import { isListableDetectedGame } from "../util/detected_games/listableDetectedIds";
import { locallyDetectedGames } from "../util/detected_games/locallyDetectedGames";

const gameFromDiscovery = (id: string, discovered: IDiscoveryResult): IGameStored => ({
  id,
  name: discovered.name ?? id,
  shortName: discovered.shortName,
  executable: discovered.executable,
  extensionPath: discovered.extensionPath,
  logo: discovered.logo,
  requiredFiles: [],
  supportedTools: [],
});

const byGameName = (lhs: IGameStored, rhs: IGameStored): number => lhs.name.localeCompare(rhs.name);

interface IBaseProps {
  active?: boolean;
  pageId?: string;
  secondary?: boolean;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
  nexusGames: IGameListEntry[];
}

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  profiles: { [profileId: string]: IProfile };
  knownGames: IGameStored[];
  gameMode: string;
  pickerLayout: "list" | "small" | "large";
  extensions: IAvailableExtension[];
  extensionsInstalled: { [extId: string]: IExtensionState };
  sortManaged: string;
  sortUnmanaged: string;
  showHidden: boolean;
  detectedGames: IDetectedGame[];
  favouriteGames: number[];
}

interface IActionProps {
  onSetPickerLayout: (layout: "list" | "small" | "large") => void;
  onSetSortManaged: (sorting: string) => void;
  onSetSortUnmanaged: (sorting: string) => void;
  onSetShowHidden: (show: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

// "PAYDAY 2" vs "Payday 2" or "Resident Evil: Village" vs "Resident Evil Village" are 100 similar
// "Final Fantasy 7 Remake" vs "Final Fantasy VII Remake" are 91 similar
const SIMILARITY_RATIO = 90;
/**
 * picker/configuration for game modes
 */
const GamePicker = ({
  t,
  active,
  pageId,
  discoveredGames,
  extensions,
  extensionsInstalled,
  knownGames,
  pickerLayout,
  profiles,
  sortManaged,
  sortUnmanaged,
  showHidden,
  gameMode,
  detectedGames,
  favouriteGames,
  nexusGames,
  onRefreshGameInfo,
  onBrowseGameLocation,
  onSetPickerLayout,
  onSetSortManaged,
  onSetSortUnmanaged,
  onSetShowHidden,
}: IProps) => {
  const [currentFilterValue, setCurrentFilterValue] = useState("");

  const nameLookupRef = useRef<{ [name: string]: string }>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const supportedSectionRef = useRef<HTMLDivElement>(null);

  const nexusGameById = useMemo(
    () =>
      memoizeOne((gameList: IGameListEntry[]) =>
        gameList.reduce<{ [id: string]: IGameListEntry }>((prev, entry) => {
          prev[entry.domain_name] = entry;
          return prev;
        }, {}),
      ),
    [],
  );

  const nexusGameByName = useMemo(
    () =>
      memoizeOne((gameList: IGameListEntry[]) =>
        gameList.reduce<{ [name: string]: IGameListEntry }>((prev, entry) => {
          prev[entry.name] = entry;
          return prev;
        }, {}),
      ),
    [],
  );

  // the detected-games response identifies games by the numeric Nexus id
  const nexusGameByNexusId = useMemo(
    () =>
      memoizeOne((gameList: IGameListEntry[]) =>
        gameList.reduce<Map<number, IGameListEntry>>((prev, entry) => {
          prev.set(entry.id, entry);
          return prev;
        }, new Map<number, IGameListEntry>()),
      ),
    [],
  );

  const getTabGameNumber = (unfiltered: IGameStored[], filtered: IGameStored[]): string =>
    currentFilterValue ? `${filtered.length}/${unfiltered.length}` : `${unfiltered.length}`;

  const applyGameFilter = (game: IGameStored): boolean =>
    !currentFilterValue || game.name?.toLowerCase().includes(currentFilterValue.toLowerCase());

  const lastUsed = (game: IGameStored): number =>
    Math.max(
      ...Object.values(profiles)
        .filter((prof) => prof.gameId === game.id)
        .map((prof) => prof.lastActivated),
    );

  const byRecentlyUsed = (lhs: IGameStored, rhs: IGameStored): number =>
    lastUsed(rhs) - lastUsed(lhs);

  const lookupName = (input: string): string => {
    if (nameLookupRef.current[input] === undefined) {
      const exactMatch = nexusGames.find((i) => i.name === input);
      if (exactMatch !== undefined) {
        nameLookupRef.current[input] = input;
      } else {
        const sorted = nexusGames
          .map((item) => ({ item, ratio: ratio(item.name, input) }))
          .filter((iter) => iter.ratio > SIMILARITY_RATIO)
          .sort((lhs, rhs) => rhs.ratio - lhs.ratio);

        nameLookupRef.current[input] = sorted.length > 0 ? sorted[0].item.name : input;
      }
    }

    return nameLookupRef.current[input];
  };

  const identifyGame = (game: IGameStored): IGameListEntry =>
    nexusGameById(nexusGames)[nexusGameId(game)] ??
    nexusGameByName(nexusGames)[lookupName(game.name)];

  const approvedTime = (game: IGameStored): number => identifyGame(game)?.approved_date ?? 0;

  const byRecent = (lhs: IGameStored, rhs: IGameStored): number =>
    approvedTime(rhs) - approvedTime(lhs);

  const gameFileCount = (game: IGameStored): number => identifyGame(game)?.downloads ?? 0;

  const byPopular = (lhs: IGameStored, rhs: IGameStored): number =>
    gameFileCount(rhs) - gameFileCount(lhs);

  const sortBy = (sortMode: string) =>
    ({
      recentlyused: byRecentlyUsed,
      recent: byRecent,
      popular: byPopular,
    })[sortMode] ?? byGameName;

  const installedExtIds = new Set(Object.values(extensionsInstalled).map((ext) => ext.modId));
  const installedNames = new Set(Object.values(extensionsInstalled).map((ext) => ext.name));

  // figuring out if a manually installed extension corresponds to a remotely available extension
  // isn't trivial, because the unique id and the game name stored in the extension list are both
  // assigned by us, when we compile it, there is no id in the original author-provided info.json
  // because we can't rely on authors to be consistent here.
  // Therefore we will also filter out based on game name, meaning there can only be one entry
  // for each game name, the one installed locally taking precedence.
  const installedGameNames = new Set(knownGames.map((game) => game.name.replace(/\t/g, " ")));

  // contains the extensions we don't have installed locally
  const extensionsUninstalled = extensions
    .filter((ext) => ext.type === "game")
    .filter(
      (ext) =>
        !installedExtIds.has(ext.modId) &&
        !installedNames.has(ext.name) &&
        !installedGameNames.has(ext.gameName),
    );

  // TODO: lots of computation and it doesn't actually change except through discovery
  //   or when adding a profile
  const displayedGames: IGameStored[] =
    showHidden || !!currentFilterValue
      ? knownGames
      : knownGames.filter((game: IGameStored) => !(discoveredGames[game.id]?.hidden ?? false));

  const profileGames = new Set<string>(
    Object.keys(profiles).map((profileId: string) => profiles[profileId].gameId),
  );

  const managedGameList: IGameStored[] = [];
  const supportedGameList: IGameStored[] = [];

  displayedGames.forEach((game: IGameStored) => {
    if (discoveredGames[game.id]?.path !== undefined) {
      // games the user hasn't added go to the detected section, further down
      if (profileGames.has(game.id)) {
        managedGameList.push(game);
      }
    } else {
      supportedGameList.push(game);
    }
  });

  supportedGameList.push(
    ...extensionsUninstalled
      .map((ext) => ({
        id: ext.gameDomain || ext.name,
        name: ext.gameName || ext.name,
        extensionPath: undefined,
        imageURL: ext.image,
        requiredFiles: [],
        executable: undefined,
        contributed: isContributed(ext.author) ? ext.author : undefined,
      }))
      .filter((ext) => showHidden || !(discoveredGames[ext.id]?.hidden ?? false)),
  );

  Object.keys(discoveredGames).forEach((gameId) => {
    if (knownGames.find((game) => game.id === gameId) === undefined) {
      if (discoveredGames[gameId].extensionPath === undefined) {
        return;
      }
      if (profileGames.has(gameId)) {
        managedGameList.push(gameFromDiscovery(gameId, discoveredGames[gameId]));
      }
    }
  });

  // The detected section is fed by the detected-games response, which names the user's
  // store-installed games, and then by discovery. A response game is listable when the
  // endpoint returned an extension for it, or when Vortex already knows it because an
  // extension is installed (the endpoint returns no extension for the ones bundled with
  // Vortex). The nexus games list supplies the name plus the internal id the store's
  // actions know.
  const nexusGameByNexusIdMap = nexusGameByNexusId(nexusGames);
  const favourites = new Set(favouriteGames);
  const favouriteGameIds: string[] = [];
  const detectedStores: Record<string, string> = {};
  const listedIds = new Set<string>();
  const detectedGameList: IGameStored[] = detectedGames
    .map<IGameStored | undefined>((game) => {
      const nexusGame = nexusGameByNexusIdMap.get(game.gameId);
      if (nexusGame === undefined) {
        return undefined;
      }
      // profiles and actions know games by their internal id, which is usually the
      // nexus domain but not always, and is the installed one where games share a domain
      const internalId = detectedInternalId(knownGames, discoveredGames, nexusGame.domain_name);
      if (profileGames.has(internalId)) {
        return undefined;
      }
      // an installed extension is the ground truth, whatever the endpoint returned
      if (!isListableDetectedGame(game, internalId, knownGames)) {
        return undefined;
      }
      // the same game can be reported more than once, e.g. by several stores
      if (listedIds.has(internalId)) {
        return undefined;
      }
      // keep the section's hide-a-game behaviour working; a search also shows hidden
      if (!showHidden && !currentFilterValue && (discoveredGames[internalId]?.hidden ?? false)) {
        return undefined;
      }
      listedIds.add(internalId);
      if (favourites.has(game.gameId)) {
        favouriteGameIds.push(internalId);
      }
      // discovery names the store only once the game's extension is installed, so
      // until then the tile takes it from the response
      const store = detectedStore(game);
      if (store !== undefined) {
        detectedStores[internalId] = store;
      }
      return {
        id: internalId,
        name: nexusGame.name,
        extensionPath: undefined,
        imageURL: game.imageUrl,
        requiredFiles: [],
        executable: undefined,
      };
    })
    .filter((game): game is IGameStored => game !== undefined);

  // Discovery adds the games the response can't name: ones on stores it doesn't cover
  // (Xbox, EA, Ubisoft), ones Nexus Mods doesn't list, such as an extension still in
  // development, and every game while logged out.
  detectedGameList.push(
    ...locallyDetectedGames(knownGames, discoveredGames, {
      addedGameIds: profileGames,
      includeHidden: showHidden || !!currentFilterValue,
      listedIds,
    }),
  );

  const filteredManaged = managedGameList.filter(applyGameFilter).sort(sortBy(sortManaged));
  // The section owns its own sort control, so the input is only filtered here.
  const filteredDetected = detectedGameList.filter(applyGameFilter);
  const filteredSupported = supportedGameList.filter(applyGameFilter).sort(sortBy(sortUnmanaged));

  const displayOptions = useDisplayOptionsAction({
    pickerLayout,
    showHidden,
    t,
    onReset: () => {
      onSetPickerLayout(DEFAULT_PICKER_LAYOUT);
      onSetSortManaged("alphabetical");
      onSetSortUnmanaged("popular");
      onSetShowHidden(false);
    },
    onSetPickerLayout,
    onToggleHidden: () => {
      onSetShowHidden(!showHidden);
    },
  });

  const toolbarActions: IToolbarAction[] = [displayOptions];

  // A quick scan reports through its callback rather than redux, so it's tracked here;
  // the deep search reports through session.discovery and is the only one cancellable.
  const scrollToSupported = () => {
    const container = scrollAreaRef.current;
    const section = supportedSectionRef.current;

    if (container && section) {
      container.scrollTop +=
        section.getBoundingClientRect().top - container.getBoundingClientRect().top;
    }
  };

  return (
    <Page isFullWidth active={active} pageId={pageId} scrollable={false}>
      <PageHeader
        isFullWidth
        pictogramName="game"
        subtitle={t("Manage games to get started.")}
        title={t("Games")}
      >
        <div className="flex shrink-0 items-center gap-x-2">
          <Search
            placeholder={t("Search games...")}
            value={currentFilterValue}
            onChange={(value) => {
              setCurrentFilterValue(value);
            }}
          />

          <Toolbar>
            <ToolbarGroup actions={toolbarActions} />
          </Toolbar>
        </div>
      </PageHeader>

      <PageScroll isFullWidth ref={scrollAreaRef}>
        <DetectedGames
          count={getTabGameNumber(detectedGameList, filteredDetected)}
          detectedStores={detectedStores}
          filtering={!!currentFilterValue}
          favourites={favouriteGameIds}
          games={filteredDetected}
          hasAddedGames={!!managedGameList.length}
          onBrowseGameLocation={onBrowseGameLocation}
          onBrowseSupported={scrollToSupported}
          onRefreshGameInfo={onRefreshGameInfo}
        />

        <AddedGames
          count={getTabGameNumber(managedGameList, filteredManaged)}
          filtering={!!currentFilterValue}
          games={filteredManaged}
          sortOrder={sortManaged}
          onBrowseGameLocation={onBrowseGameLocation}
          onRefreshGameInfo={onRefreshGameInfo}
          onSortChange={onSetSortManaged}
        />

        <SupportedGames
          count={getTabGameNumber(supportedGameList, filteredSupported)}
          filterValue={currentFilterValue}
          games={filteredSupported}
          ref={supportedSectionRef}
          sortOrder={sortUnmanaged}
          onBrowseGameLocation={onBrowseGameLocation}
          onPageChange={scrollToSupported}
          onRefreshGameInfo={onRefreshGameInfo}
          onSortChange={onSetSortUnmanaged}
        />
      </PageScroll>
    </Page>
  );
};

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    discoveredGames: state.settings.gameMode.discovered,
    pickerLayout: state.settings.gameMode.pickerLayout || "list",
    profiles: state.persistent.profiles,
    knownGames: state.session.gameMode.known,
    extensions: state.session.extensions.available,
    extensionsInstalled: state.app.extensions ?? {},
    sortManaged: state.settings.gameMode.sortManaged ?? "alphabetical",
    sortUnmanaged: state.settings.gameMode.sortUnmanaged ?? "alphabetical",
    showHidden: state.session.gameMode.showHidden ?? false,
    detectedGames: state.session.gameMode.detectedGames ?? [],
    favouriteGames: state.session.gameMode.favouriteGames ?? [],
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetPickerLayout: (layout) => dispatch(setPickerLayout(layout)),
    onSetSortManaged: (sorting: string) => dispatch(setSortManaged(sorting)),
    onSetSortUnmanaged: (sorting: string) => dispatch(setSortUnmanaged(sorting)),
    onSetShowHidden: (show: boolean) => dispatch(setShowHiddenGames(show)),
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(GamePicker),
) as ComponentClass<{}>;
