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
import { getSafe } from "@/util/storeHelper";
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
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";

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
  const discoveredGameList: IGameStored[] = [];
  const supportedGameList: IGameStored[] = [];

  displayedGames.forEach((game: IGameStored) => {
    if (getSafe(discoveredGames, [game.id, "path"], undefined) !== undefined) {
      if (profileGames.has(game.id)) {
        managedGameList.push(game);
      } else {
        discoveredGameList.push(game);
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
      } else {
        discoveredGameList.push(gameFromDiscovery(gameId, discoveredGames[gameId]));
      }
    }
  });

  const filteredManaged = managedGameList.filter(applyGameFilter).sort(sortBy(sortManaged));
  // Detection results are a short list with no sort control of their own, so they stay
  // alphabetical rather than following the catalogue's sort.
  // Ordering is the detected section's own setting, so it sorts what it's given.
  const filteredDetected = discoveredGameList.filter(applyGameFilter);
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
          count={getTabGameNumber(discoveredGameList, filteredDetected)}
          filtering={!!currentFilterValue}
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
