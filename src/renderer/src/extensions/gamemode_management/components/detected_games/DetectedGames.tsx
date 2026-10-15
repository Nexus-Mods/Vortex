import { mdiLoading, mdiRefresh, mdiWifiOff } from "@mdi/js";
import React, { useRef, useState } from "react";
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
import { listableDetectedIds } from "../../util/detected_games/listableDetectedIds";
import { GamesGrid } from "../GamesGrid";
import { GamesList } from "../GamesList";
import { Section } from "../section/Section";

interface IDetectedGamesProps {
  games: IGameStored[];
  count: string;
  /** The store each game was detected on, by internal id, for its tile to name. */
  detectedStores?: Record<string, string>;
  /** Internal ids of the caller's favourite games; they lead every sort. */
  favourites?: string[];
  filtering: boolean;
  hasAddedGames: boolean;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
  onBrowseSupported: () => void;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
}

/** Which step of a scan failed, as `start-quick-discovery` reports it. */
type ScanFailure = "discovery" | "detection";

/**
 * Games found installed but not added yet, and the scan that finds them.
 *
 * The scanning state also covers a detection request started elsewhere, at startup or
 * login. A detection failure shows as the panel when the section is empty, and in the
 * description when cards or a search fill it; both follow the stored status, so they clear
 * when detection recovers. A scan the user starts reports its outcome in one short
 * toast, found, none or couldn't check; a discovery failure raises its own error
 * notification instead. A cancelled scan's result is ignored. "Found N new" is only counted against an earlier
 * successful detection, as without one there's nothing to tell new games from: the last request
 * succeeded, or games it stored remain, which only a successful one stores, after a later failure.
 */
export const DetectedGames = ({
  count,
  detectedStores,
  favourites,
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
  const detectedGames = useSelector((state: IState) => state.session.gameMode?.detectedGames);
  const knownGames = useSelector((state: IState) => state.session.gameMode?.known);
  const profiles = useSelector((state: IState) => state.persistent.profiles);
  const detectionStatus = useSelector(
    (state: IState) => state.session.gameMode?.detectedGamesStatus,
  );
  const detectionRunning = detectionStatus === "running";
  const detectionFailed = detectionStatus === "failed";

  const [quickScanning, setQuickScanning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const scanIdRef = useRef(0);

  const scanning = (quickScanning || discoveryRunning || detectionRunning) && !filtering;
  const failed = scanFailed || detectionFailed;

  const handleScan = () => {
    const addedGameIds = new Set(Object.values(profiles).map((profile) => profile.gameId));
    const knownBefore = new Set(
      listableDetectedIds(detectedGames ?? [], knownGames, discoveredGames, addedGameIds),
    );
    const comparable = detectionStatus === "success" || (detectedGames?.length ?? 0) > 0;
    const scanId = ++scanIdRef.current;

    setScanFailed(false);
    setQuickScanning(true);

    const scan = new Promise<{ found: string[]; failure?: ScanFailure }>((resolve) => {
      api.events.emit(
        "start-quick-discovery",
        (found: string[], err?: Error, failure: ScanFailure = "discovery") =>
          resolve({ found, failure: err === undefined ? undefined : failure }),
      );
    });

    void scan
      .then(({ found, failure }) => {
        if (scanId !== scanIdRef.current) {
          return;
        }

        if (failure === "discovery") {
          setScanFailed(true);
          return;
        }

        if (failure === "detection") {
          api.sendNotification({
            type: "error",
            message: t("Couldn't check for new games. Check your internet connection."),
            displayMS: 4000,
          });
          return;
        }

        if (!comparable) {
          api.sendNotification({
            type: "info",
            message: t("Game detection finished"),
            displayMS: 4000,
          });
          return;
        }

        const added = found.filter((id) => !knownBefore.has(id)).length;

        api.sendNotification({
          type: added > 0 ? "success" : "info",
          message:
            added > 0 ? t("Found {{count}} new game", { count: added }) : t("No new games found"),
          displayMS: 4000,
        });
      })
      .finally(() => setQuickScanning(false));
  };

  // An aborted scan only settles once in-flight lookups finish, so clear the flag now.
  const handleCancelScan = () => {
    scanIdRef.current++;
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

    if (failed) {
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

  // Sorted here because the order is this section's own setting; favourites lead
  // regardless of it, and undated games sort oldest.
  const favouriteSet = new Set(favourites ?? []);
  const shownGames = [...games].sort(
    (lhs, rhs) =>
      Number(favouriteSet.has(rhs.id)) - Number(favouriteSet.has(lhs.id)) ||
      (sortOrder === "alphabetical"
        ? lhs.name.localeCompare(rhs.name)
        : (discoveredGames[rhs.id]?.timestamp ?? 0) - (discoveredGames[lhs.id]?.timestamp ?? 0)),
  );

  // Anything waiting to be added lights the section, new to this scan or not.
  const highlighted = !!shownGames.length;

  // With games already added, the header alone reports an empty scan; failures keep a panel.
  const quietlyEmpty = !shownGames.length && hasAddedGames && !filtering && !failed;

  const getDescription = () => {
    if (detectionFailed && (shownGames.length > 0 || filtering)) {
      return t("Can't detect games right now. Check your internet connection and try again.");
    }

    if (quietlyEmpty) {
      return t("We'll show any installed games you haven't added yet here.");
    }

    return t("Installed games you haven't added yet.");
  };

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
      description={getDescription()}
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
              source="detected_list"
              t={t}
              type="unmanaged"
              onBrowseGameLocation={onBrowseGameLocation}
              onRefreshGameInfo={onRefreshGameInfo}
            />
          ) : (
            <GamesGrid
              detectedStores={detectedStores}
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
