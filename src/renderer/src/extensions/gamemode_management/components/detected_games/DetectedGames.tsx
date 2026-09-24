import { mdiLoading, mdiRefresh, mdiWifiOff } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { useMainContext } from "@/contexts";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Listing } from "@/ui/components/listing/Listing";
import { Picker } from "@/ui/components/picker/Picker";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";
import { activeGameId } from "@/util/selectors";

import { setSortDetected } from "../../actions/settings";
import type { IGameStored } from "../../types/IGameStored";
import { GamesGrid } from "../GamesGrid";
import { GamesList } from "../GamesList";
import { Section } from "../section/Section";

interface IDetectedGamesProps {
  games: IGameStored[];
  count: string;
  filtering: boolean;
  hasAddedGames: boolean;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
  onBrowseSupported: () => void;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
}

/** Games found installed but not added yet, and the scan that finds them. */
export const DetectedGames = ({
  count,
  filtering,
  games,
  hasAddedGames,
  onBrowseGameLocation,
  onBrowseSupported,
  onRefreshGameInfo,
}: IDetectedGamesProps) => {
  const { t } = useTranslation();
  const { api } = useMainContext();
  const dispatch = useDispatch();

  const discoveredGames = useSelector((state: IState) => state.settings.gameMode.discovered);
  const sortOrder = useSelector(
    (state: IState) => state.settings.gameMode.sortDetected ?? "recentlydetected",
  );
  const gameMode = useSelector(activeGameId);
  const layout = useSelector((state: IState) => state.settings.gameMode.pickerLayout || "list");
  // True only while the deep search runs; a quick scan reports through its callback.
  const discoveryRunning = useSelector(
    (state: IState) => state.session.discovery?.running ?? false,
  );

  const [quickScanning, setQuickScanning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);

  const scanning = (quickScanning || discoveryRunning) && !filtering;

  const handleScan = () => {
    // The scan reports every game on disk, so "new" is a diff against what came before.
    const knownBefore = new Set(
      Object.keys(discoveredGames).filter((id) => discoveredGames[id].path !== undefined),
    );

    setScanFailed(false);
    setQuickScanning(true);

    const scan = new Promise<string[]>((resolve, reject) => {
      api.events.emit("start-quick-discovery", (gameIds: string[], err?: Error) =>
        err !== undefined ? reject(err) : resolve(gameIds),
      );
    });

    scan
      .then(
        (found) => {
          const added = found.filter((id) => !knownBefore.has(id)).length;

          setScanFailed(false);
          api.sendNotification({
            type: added > 0 ? "success" : "info",
            message:
              added > 0 ? t("Found {{count}} new game", { count: added }) : t("No new games found"),
            displayMS: 4000,
          });
        },
        () => setScanFailed(true),
      )
      .finally(() => setQuickScanning(false));
  };

  // An aborted scan only settles once in-flight lookups finish, so clear the flag now.
  const handleCancelScan = () => {
    api.events.emit("cancel-game-scan");
    setQuickScanning(false);
  };

  const retryButton = (
    <Button appearance="moderate" brand="neutral" isLoading={quickScanning} onClick={handleScan}>
      {t("Retry scan")}
    </Button>
  );

  const getEmptyState = () => {
    if (scanning) {
      return {
        children: (
          <Button appearance="moderate" brand="neutral" onClick={handleCancelScan}>
            {t("Cancel scan")}
          </Button>
        ),
        iconClassName: "animate-spin text-primary-strong",
        iconPath: mdiLoading,
        message: t("We'll show detected games here as we find them."),
        title: t("Scanning for installed games..."),
      };
    }

    if (filtering) {
      return {
        message: t("Try adjusting your search terms."),
        title: t("No games found"),
      };
    }

    if (scanFailed) {
      return {
        children: retryButton,
        iconPath: mdiWifiOff,
        message: t(
          "We're having trouble connecting. Check your internet connection and try again.",
        ),
        title: t("Can't detect games right now"),
      };
    }

    return {
      children: (
        <div className="flex gap-x-2">
          <Button appearance="moderate" brand="neutral" onClick={onBrowseSupported}>
            {t("Browse games")}
          </Button>

          {retryButton}
        </div>
      ),
      message: t("Browse our supported games to add manually"),
      title: t("No installed games detected"),
    };
  };

  const emptyState = getEmptyState();

  // Sorted here because the order is this section's own setting; undated games sort oldest.
  const shownGames = [...games].sort((lhs, rhs) =>
    sortOrder === "alphabetical"
      ? lhs.name.localeCompare(rhs.name)
      : (discoveredGames[rhs.id]?.timestamp ?? 0) - (discoveredGames[lhs.id]?.timestamp ?? 0),
  );

  // Anything waiting to be added lights the section, new to this scan or not.
  const highlighted = !!shownGames.length;

  // With games already added, the header alone reports an empty scan; failures keep a panel.
  const quietlyEmpty = !shownGames.length && hasAddedGames && !filtering && !scanFailed;

  return (
    <Section
      actions={
        (shownGames.length > 0 || quietlyEmpty) && (
          <div className="flex items-center gap-x-2">
            {scanning ? (
              <>
                <Icon className="animate-spin text-primary-strong" path={mdiLoading} size="sm" />

                <Button appearance="moderate" brand="neutral" size="sm" onClick={handleCancelScan}>
                  {t("Cancel scan")}
                </Button>
              </>
            ) : (
              <Tooltip content={t("Refresh scan")}>
                <Button
                  appearance="subdued"
                  aria-label={t("Refresh scan")}
                  brand="neutral"
                  leftIconPath={mdiRefresh}
                  size="sm"
                  onClick={handleScan}
                />
              </Tooltip>
            )}

            {!!shownGames.length && (
              <Picker
                button={{ appearance: "subdued", size: "sm" }}
                options={[
                  { label: t("Recently detected"), value: "recentlydetected" },
                  { label: t("Name A-Z"), value: "alphabetical" },
                ]}
                value={sortOrder}
                onChange={(value) => dispatch(setSortDetected(value))}
              />
            )}
          </div>
        )
      }
      className={joinClasses({
        "bg-radial-[63.18%_100%_at_50%_100%] from-primary-500/15 from-13% to-primary-500/1":
          highlighted,
      })}
      count={count}
      description={
        quietlyEmpty
          ? t("We'll show any installed games you haven't added yet here.")
          : t("Installed games you haven't added yet.")
      }
      testId={highlighted ? "detected-games-lit" : undefined}
      title={highlighted || quietlyEmpty ? t("New games detected") : t("Games detected")}
    >
      {!quietlyEmpty && (
        <Listing
          entityCount={shownGames.length}
          noResultsChildren={emptyState.children}
          noResultsIconClassName={emptyState.iconClassName}
          noResultsIconPath={emptyState.iconPath}
          noResultsMessage={emptyState.message}
          noResultsTitle={emptyState.title}
        >
          {layout === "list" ? (
            <GamesList
              discoveredGames={discoveredGames}
              gameMode={gameMode}
              games={shownGames}
              t={t}
              type="unmanaged"
              onBrowseGameLocation={onBrowseGameLocation}
              onRefreshGameInfo={onRefreshGameInfo}
            />
          ) : (
            <GamesGrid
              games={shownGames}
              section="detected"
              onRefreshGameInfo={onRefreshGameInfo}
            />
          )}
        </Listing>
      )}
    </Section>
  );
};
