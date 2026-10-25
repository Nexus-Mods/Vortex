import type { IFileInfo } from "@nexusmods/nexus-api";
import { GameDomain } from "@vortex/shared";
import numeral from "numeral";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { isLoggedIn as isLoggedInSelector } from "@/extensions/nexus_integration/selectors";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { SwitchField } from "@/ui/components/form/switch_field/SwitchField";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Listing } from "@/ui/components/listing/Listing";
import { Picker } from "@/ui/components/picker/Picker";
import { Typography } from "@/ui/components/typography/Typography";
import { activeGameId } from "@/util/selectors";
import MainPage from "@/views/MainPage";

import { normalizeSearch } from "../catalogQuery";
import { catalogInstallState } from "../installState";
import { pickPrimaryFile } from "../modFiles";
import { catalogShowAdult, setCatalogShowAdult } from "../settings";
import type { CatalogSort, ICatalogMod } from "../types";
import { useCatalogPages, useDebouncedValue, type ICatalogFilters } from "../useCatalogPages";
import { ModDetails } from "./ModDetails";
import { ModTile } from "./ModTile";
import { ModTileSkeleton } from "./ModTileSkeleton";

const SEARCH_DEBOUNCE_MS = 500;

const SORT_LABELS: Record<CatalogSort, string> = {
  popular: "Most popular",
  newest: "Newest",
  updated: "Recently updated",
  endorsed: "Most endorsed",
};

const ALL_CATEGORIES = "";

export interface IModCatalogPageProps {
  api: IExtensionApi;
}

/** Category names known for the game, sorted, from the categories Vortex already fetched. */
function useCategoryNames(gameId: string | undefined): string[] {
  const categories = useSelector((state: IState) =>
    gameId !== undefined ? state.persistent.categories?.[gameId] : undefined,
  );
  return useMemo(
    () =>
      Array.from(new Set(Object.values(categories ?? {}).map((cat) => cat.name)))
        .filter((name) => !!name)
        .sort((lhs, rhs) => lhs.localeCompare(rhs)),
    [categories],
  );
}

function ModCatalogPage({ api }: IModCatalogPageProps) {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);

  const gameId = useSelector((state: IState) => activeGameId(state));
  const showAdult = useSelector(catalogShowAdult);
  const loggedIn = useSelector(isLoggedInSelector);
  const installedMods = useSelector((state: IState) =>
    gameId !== undefined ? state.persistent.mods[gameId] : undefined,
  );
  const categoryNames = useCategoryNames(gameId);

  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [sort, setSort] = useState<CatalogSort>("popular");
  const [selected, setSelected] = useState<ICatalogMod | undefined>(undefined);
  const [installing, setInstalling] = useState<Set<number>>(new Set());
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const gameDomain = useMemo(() => {
    if (gameId === undefined) {
      return undefined;
    }
    const domain = nexusGameId(getGame(gameId), gameId);
    return domain ? GameDomain(domain) : undefined;
  }, [gameId]);

  const filters: ICatalogFilters | undefined =
    gameDomain === undefined
      ? undefined
      : {
          gameDomain,
          // short input is ignored rather than sent: the API rejects one-letter wildcards
          search: normalizeSearch(search) ?? "",
          category: category === ALL_CATEGORIES ? undefined : category,
          sort,
          showAdult,
        };
  const pages = useCatalogPages(api, filters);

  const markInstalling = (modId: number, busy: boolean) =>
    setInstalling((prev) => {
      const next = new Set(prev);
      if (busy) {
        next.add(modId);
      } else {
        next.delete(modId);
      }
      return next;
    });

  // the regular Nexus download: login check, premium/free flow, then the usual install
  const downloadAndInstall = (mod: ICatalogMod, file: IFileInfo): Promise<unknown> =>
    gameId === undefined || api.ext.nexusDownload === undefined
      ? Promise.resolve()
      : Promise.resolve(
          api.ext.nexusDownload(gameId, mod.modId, file.file_id, file.file_name, true),
        );

  const runInstall = (mod: ICatalogMod, work: () => Promise<unknown>) => {
    markInstalling(mod.modId, true);
    void work()
      .catch((err: unknown) => api.showErrorNotification?.("Failed to install mod", err))
      .finally(() => markInstalling(mod.modId, false));
  };

  const installFile = (mod: ICatalogMod, file: IFileInfo) =>
    runInstall(mod, () => downloadAndInstall(mod, file));

  const installPrimary = (mod: ICatalogMod) =>
    runInstall(mod, async () => {
      if (gameId === undefined) {
        return;
      }
      const files = await api.ext.nexusGetModFiles?.(gameId, mod.modId);
      const file = pickPrimaryFile(files ?? []);
      if (file === undefined) {
        // no obvious main file: let the user choose on the mod page
        setSelected(mod);
        return;
      }
      await downloadAndInstall(mod, file);
    });

  if (gameId === undefined || gameDomain === undefined) {
    return (
      <MainPage id="mod-catalog-page">
        <MainPage.Body>
          <div className="p-5 text-center">
            <Typography as="p">{t("Select a game to browse its mods.")}</Typography>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  if (selected !== undefined) {
    return (
      <MainPage id="mod-catalog-page">
        <MainPage.Body className="h-full overflow-y-auto">
          <ModDetails
            api={api}
            gameDomain={gameDomain}
            gameId={gameId}
            installState={catalogInstallState(installedMods, selected)}
            isLoggedIn={loggedIn}
            mod={selected}
            onBack={() => setSelected(undefined)}
            onInstallFile={(file) => installFile(selected, file)}
          />
        </MainPage.Body>
      </MainPage>
    );
  }

  const searchTooShort =
    searchInput.trim().length > 0 && normalizeSearch(searchInput) === undefined;

  return (
    <MainPage id="mod-catalog-page">
      <MainPage.Body className="h-full overflow-y-auto" ref={scrollRef}>
        <div className="space-y-3 p-6">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
            <TextField
              errorMessage={searchTooShort ? t("Type at least two letters to search.") : undefined}
              fieldClassName="max-w-72 grow"
              hideLabel={true}
              label={t("Search mods by name")}
              leftIcon="search"
              placeholder={t("Search mods by name")}
              value={searchInput}
              onChange={(evt) => setSearchInput(evt.target.value)}
            />

            <Picker
              options={[
                { label: t("All categories"), value: ALL_CATEGORIES },
                ...categoryNames.map((name) => ({ label: name, value: name })),
              ]}
              placement="left"
              value={category}
              onChange={setCategory}
            />

            <Picker
              options={(Object.keys(SORT_LABELS) as CatalogSort[]).map((key) => ({
                label: t(SORT_LABELS[key]),
                value: key,
              }))}
              value={sort}
              onChange={setSort}
            />

            <SwitchField
              checked={showAdult}
              fieldClassName="ml-auto self-center"
              label={t("Show adult mods")}
              onChange={(value: boolean) => dispatch(setCatalogShowAdult(value))}
            />
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              appearance="moderate"
              brand="neutral"
              leftIcon="refresh"
              title={t("Refresh")}
              onClick={pages.retry}
            />

            <Typography appearance="moderate" brand="neutral-translucent" typographyType="body-sm">
              {t("{{total}} mods", { replace: { total: numeral(pages.totalCount).format("0,0") } })}
            </Typography>
          </div>

          <Listing
            className="grid grid-cols-[repeat(auto-fill,minmax(26rem,1fr))] gap-4"
            entityCount={pages.mods.length}
            errorMessage={pages.error?.message}
            errorTitle={t("Could not load mods")}
            isError={pages.error !== undefined && pages.mods.length === 0}
            isLoading={pages.loading}
            noResultsMessage={t("Try another search, category or sort order.")}
            noResultsTitle={t("No mods found")}
            skeletonCount={8}
            SkeletonTile={ModTileSkeleton}
          >
            {pages.mods.map((mod) => (
              <ModTile
                installState={catalogInstallState(installedMods, mod)}
                installing={installing.has(mod.modId)}
                isLoggedIn={loggedIn}
                key={mod.modId}
                mod={mod}
                onInstall={() => installPrimary(mod)}
                onOpen={() => setSelected(mod)}
              />
            ))}
          </Listing>

          {pages.hasMore && !pages.loading && (
            <div className="flex justify-center pt-2">
              <Button
                appearance="moderate"
                brand="neutral"
                isLoading={pages.loadingMore}
                onClick={pages.loadMore}
              >
                {pages.error !== undefined ? t("Try again") : t("Load more")}
              </Button>
            </div>
          )}
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default ModCatalogPage;
