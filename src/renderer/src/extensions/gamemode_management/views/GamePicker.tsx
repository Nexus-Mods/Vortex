import type { IGameListEntry } from "@nexusmods/nexus-api";
import type PromiseBB from "bluebird";
import { ratio } from "fuzzball";
import memoizeOne from "memoize-one";
import React, {
  type ComponentClass,
  type UIEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { WithTranslation } from "react-i18next";

import type { IAvailableExtension, IExtension } from "@/types/extensions";
import type { IState } from "@/types/IState";
import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { Picker } from "@/ui/components/picker/Picker";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import { getSafe } from "@/util/storeHelper";

import { connect, translate } from "../../../controls/ComponentEx";
import { activeGameId } from "../../../util/selectors";
import PageRoot from "../../../views/PageRoot";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";
import type { IProfile } from "../../profile_management/types/IProfile";
import { setPickerLayout, setSortManaged, setSortUnmanaged } from "../actions/settings";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { DisplayOptions } from "../components/DisplayOptions";
import { GamesGrid } from "../components/GamesGrid";
import { GamesList } from "../components/GamesList";
import { NoGamesFound } from "../components/NoGamesFound";
import { Search } from "../components/Search";
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
  onRefreshGameInfo: (gameId: string) => PromiseBB<void>;
  onBrowseGameLocation: (gameId: string) => PromiseBB<void>;
  nexusGames: IGameListEntry[];
}

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  profiles: { [profileId: string]: IProfile };
  knownGames: IGameStored[];
  gameMode: string;
  pickerLayout: "list" | "small" | "large";
  extensions: IAvailableExtension[];
  extensionsInstalled: { [extId: string]: IExtension };
  sortManaged: string;
  sortUnmanaged: string;
}

interface IActionProps {
  onSetPickerLayout: (layout: "list" | "small" | "large") => void;
  onSetSortManaged: (sorting: string) => void;
  onSetSortUnmanaged: (sorting: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

// "PAYDAY 2" vs "Payday 2" or "Resident Evil: Village" vs "Resident Evil Village" are 100 similar
// "Final Fantasy 7 Remake" vs "Final Fantasy VII Remake" are 91 similar
const SIMILARITY_RATIO = 90;
// The unmanaged list can be large, so it's paginated this many games per page.
const UNMANAGED_PAGE_SIZE = 50;

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
  gameMode,
  nexusGames,
  onRefreshGameInfo,
  onBrowseGameLocation,
  onSetPickerLayout,
  onSetSortManaged,
  onSetSortUnmanaged,
}: IProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [currentFilterValue, setCurrentFilterValue] = useState("");
  const [unmanagedPage, setUnmanagedPage] = useState(1);

  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  const nameLookupRef = useRef<{ [name: string]: string }>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const unmanagedSectionRef = useRef<HTMLDivElement>(null);

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

  const getBounds = useCallback(() => rootEl.getBoundingClientRect(), [rootEl]);

  const onScroll = (evt: UIEvent<HTMLDivElement>) => {
    const isScrolled = evt.currentTarget.scrollTop > 0;
    if (isScrolled !== scrolled) {
      setScrolled(isScrolled);
    }
  };

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
        id: ext.gameId || ext.name,
        name: ext.gameName || ext.name,
        extensionPath: undefined,
        imageURL: ext.image,
        requiredFiles: [],
        executable: undefined,
        contributed: ext.author,
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

  const unmanagedGameList: IGameStored[] = [...discoveredGameList, ...supportedGameList];

  const filteredManaged = managedGameList.filter(applyGameFilter).sort(sortBy(sortManaged));
  const filteredUnmanaged = unmanagedGameList.filter(applyGameFilter).sort(sortBy(sortUnmanaged));

  // Paginate the (potentially large) unmanaged list. The page is clamped so the
  // view stays valid when filtering/sorting shrinks the list under the cursor.
  const unmanagedPageCount = Math.max(1, Math.ceil(filteredUnmanaged.length / UNMANAGED_PAGE_SIZE));
  const currentUnmanagedPage = Math.min(unmanagedPage, unmanagedPageCount);
  const pagedUnmanaged = filteredUnmanaged.slice(
    (currentUnmanagedPage - 1) * UNMANAGED_PAGE_SIZE,
    currentUnmanagedPage * UNMANAGED_PAGE_SIZE,
  );

  return (
    <PageRoot active={active} domRef={(el) => setRootEl(el)} pageId={pageId} scrollable={false}>
      <div
        className={joinClasses([
          "relative flex items-center gap-x-6 px-6 pb-3 transition-[padding]",
          scrolled ? "pt-3 shadow-md" : "pt-6",
        ])}
      >
        <div className="flex grow items-center gap-x-2">
          <Pictogram
            className={joinClasses(["transition-[width,height]", scrolled ? "size-7" : "size-14"])}
            name="game"
            size="none"
          />

          <div className="grow">
            <Typography appearance="moderate" as="h2" typographyType="heading-xs">
              {t("Games")}
            </Typography>

            <Typography appearance="subdued" className={joinClasses({ hidden: scrolled })}>
              {t("Manage games to get started.")}
            </Typography>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-x-2">
          <Search
            placeholder={t("Search games...")}
            value={currentFilterValue}
            onChange={(value) => {
              setCurrentFilterValue(value);
              setUnmanagedPage(1);
            }}
          />

          <DisplayOptions
            pickerLayout={pickerLayout}
            showHidden={showHidden}
            t={t}
            onReset={() => {
              onSetPickerLayout("small");
              onSetSortManaged("alphabetical");
              onSetSortUnmanaged("popular");
              setShowHidden(false);
              setUnmanagedPage(1);
            }}
            onSetPickerLayout={onSetPickerLayout}
            onToggleHidden={() => {
              setShowHidden((prev) => !prev);
              setUnmanagedPage(1);
            }}
          />
        </div>
      </div>

      <PageRoot.Scroll ref={scrollAreaRef} onScroll={onScroll}>
        <CollapsibleSection
          actions={
            <Picker
              button={{ appearance: "subdued", size: "xs" }}
              options={[
                { label: t("Name A-Z"), value: "alphabetical" },
                { label: t("Recently used"), value: "recentlyused" },
              ]}
              value={sortManaged}
              onChange={onSetSortManaged}
            />
          }
          title={
            <span className="flex items-center gap-x-2">
              {t("Managed")}

              <span className="text-neutral-subdued">
                {getTabGameNumber(managedGameList, filteredManaged)}
              </span>
            </span>
          }
        >
          <Listing
            entityCount={filteredManaged.length}
            noResultsMessage={
              currentFilterValue
                ? t("Try adjusting your search terms.")
                : t('To start managing a game, go to "Unmanaged" and activate a game there.')
            }
            noResultsTitle={
              currentFilterValue ? t("No games found") : t("You haven't managed any games yet")
            }
          >
            {pickerLayout === "list" ? (
              <GamesList
                container={rootEl}
                discoveredGames={discoveredGames}
                gameMode={gameMode}
                games={filteredManaged}
                getBounds={getBounds}
                t={t}
                type="managed"
                onBrowseGameLocation={onBrowseGameLocation}
                onRefreshGameInfo={onRefreshGameInfo}
              />
            ) : (
              <GamesGrid
                container={rootEl}
                discoveredGames={discoveredGames}
                gameMode={gameMode}
                games={filteredManaged}
                getBounds={getBounds}
                t={t}
                type="managed"
                onRefreshGameInfo={onRefreshGameInfo}
              />
            )}
          </Listing>
        </CollapsibleSection>

        <CollapsibleSection
          actions={
            <Picker
              button={{ appearance: "subdued", size: "xs" }}
              options={[
                { label: t("Most Popular"), value: "popular" },
                { label: t("Name A-Z"), value: "alphabetical" },
                { label: t("Most Recent"), value: "recent" },
              ]}
              value={sortUnmanaged}
              onChange={(value) => {
                onSetSortUnmanaged(value);
                setUnmanagedPage(1);
              }}
            />
          }
          ref={unmanagedSectionRef}
          title={
            <span className="flex items-center gap-x-2">
              {t("Unmanaged")}

              <span className="text-neutral-subdued">
                {getTabGameNumber(unmanagedGameList, filteredUnmanaged)}
              </span>
            </span>
          }
        >
          <div className="space-y-6">
            <Listing
              customNoResults={<NoGamesFound className="py-16" t={t} />}
              entityCount={filteredUnmanaged.length}
            >
              {pickerLayout === "list" ? (
                <GamesList
                  container={rootEl}
                  discoveredGames={discoveredGames}
                  gameMode={gameMode}
                  games={pagedUnmanaged}
                  getBounds={getBounds}
                  t={t}
                  type="unmanaged"
                  onBrowseGameLocation={onBrowseGameLocation}
                  onRefreshGameInfo={onRefreshGameInfo}
                />
              ) : (
                <GamesGrid
                  container={rootEl}
                  discoveredGames={discoveredGames}
                  gameMode={gameMode}
                  games={pagedUnmanaged}
                  getBounds={getBounds}
                  t={t}
                  type="unmanaged"
                  onRefreshGameInfo={onRefreshGameInfo}
                />
              )}
            </Listing>

            {!!filteredUnmanaged.length && currentUnmanagedPage === unmanagedPageCount && (
              <NoGamesFound className="py-6" t={t} />
            )}

            <Pagination
              currentPage={currentUnmanagedPage}
              recordsPerPage={UNMANAGED_PAGE_SIZE}
              totalRecords={filteredUnmanaged.length}
              onPaginationUpdate={(page) => {
                setUnmanagedPage(page);

                const container = scrollAreaRef.current;
                const section = unmanagedSectionRef.current;
                if (container && section) {
                  container.scrollTop +=
                    section.getBoundingClientRect().top - container.getBoundingClientRect().top;
                }
              }}
            />
          </div>
        </CollapsibleSection>
      </PageRoot.Scroll>
    </PageRoot>
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
    extensionsInstalled: state.session.extensions.installed,
    sortManaged: state.settings.gameMode.sortManaged ?? "alphabetical",
    sortUnmanaged: state.settings.gameMode.sortUnmanaged ?? "alphabetical",
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetPickerLayout: (layout) => dispatch(setPickerLayout(layout)),
    onSetSortManaged: (sorting: string) => dispatch(setSortManaged(sorting)),
    onSetSortUnmanaged: (sorting: string) => dispatch(setSortUnmanaged(sorting)),
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(GamePicker),
) as ComponentClass<{}>;
