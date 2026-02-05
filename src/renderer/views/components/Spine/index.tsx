import { mdiHome, mdiPlus, mdiPuzzle } from "@mdi/js";
import React, { type FC, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
import { useSpineContext } from "../SpineContext";
import { DownloadButton } from "./DownloadButton";
import { ProfileButton } from "./ProfileButton";
import { SpineButton } from "./SpineButton";
import { getGameImageUrl } from "./utils";

export const Spine: FC = () => {
  const { selection, selectHome, selectProfile } = useSpineContext();

  const dispatch = useDispatch();

  const knownGames = useSelector(
    (state: IState) => state.session.gameMode.known,
  );
  const discoveredGames = useSelector(
    (state: IState) => state.settings.gameMode.discovered,
  );
  const profiles = useSelector((state: IState) => state.persistent.profiles);
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const activity = useSelector(
    (state: IState) => state.session.base.activity?.mods ?? [],
  );
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );
  const lastDeployedProfile = useSelector(
    (state: IState) => state.persistent.deployment.lastDeployedProfile ?? {},
  );

  const isDeploying =
    activity.includes("deployment") || activity.includes("purging");
  const activeProfile = activeProfileId ? profiles[activeProfileId] : undefined;
  const deployingGameId = isDeploying ? activeProfile?.gameId : undefined;

  const handleGlobalPageClick = useCallback(
    (pageId: string) => {
      // Global pages need Home to be selected first
      selectHome();
      // Then navigate to the specific page (overriding the default Dashboard page)
      dispatch(setOpenMainPage(pageId, false));
    },
    [selectHome, dispatch],
  );

  // Get all profiles that belong to discovered, non-hidden games
  const visibleProfiles = useMemo(() => {
    const filtered = Object.values(profiles).filter((profile) => {
      const discovery = discoveredGames[profile.gameId];
      return (
        discovery?.path !== undefined &&
        discovery?.hidden !== true &&
        profile.pendingRemove !== true
      );
    });

    // Group by game
    const gameGroups = new Map<string, typeof filtered>();
    filtered.forEach((profile) => {
      if (!gameGroups.has(profile.gameId)) {
        gameGroups.set(profile.gameId, []);
      }
      gameGroups.get(profile.gameId).push(profile);
    });

    // Sort profiles within each game group alphabetically by name
    gameGroups.forEach((profilesInGame) => {
      profilesInGame.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Sort game groups alphabetically by game ID for deterministic ordering
    const sortedGames = Array.from(gameGroups.entries()).sort(
      ([gameIdA], [gameIdB]) => gameIdA.localeCompare(gameIdB),
    );

    // Flatten back into a single array
    return sortedGames.flatMap(([, profilesInGame]) => profilesInGame);
  }, [profiles, discoveredGames]);

  return (
    <div className="flex shrink-0 flex-col justify-between border-r border-stroke-weak p-3">
      <div className="flex flex-col gap-y-3">
        <SpineButton
          className="border-2"
          iconPath={mdiHome}
          isActive={selection.type === "home"}
          onClick={selectHome}
        />

        {visibleProfiles.map((profile) => {
          const game = knownGames.find((g) => g.id === profile.gameId);
          const discovery = discoveredGames[profile.gameId];
          const imageSrc =
            game !== undefined ? getGameImageUrl(game, discovery) : undefined;
          const isLastDeployed =
            lastDeployedProfile[profile.gameId] === profile.id;
          const isProfileDeploying =
            isLastDeployed && deployingGameId === profile.gameId;

          return (
            <ProfileButton
              emoji={profile.emoji}
              imageSrc={imageSrc}
              isActive={
                selection.type === "profile" &&
                selection.profileId === profile.id
              }
              isDeploying={isProfileDeploying}
              isLastDeployed={isLastDeployed}
              key={profile.id}
              profileName={profile.name}
              onClick={() => selectProfile(profile.id)}
            />
          );
        })}

        <SpineButton
          className="border-2 border-dotted hover:border-solid"
          iconPath={mdiPlus}
          isActive={mainPage === "Games"}
          title="Games"
          onClick={() => handleGlobalPageClick("Games")}
        />
      </div>

      <div className="flex flex-col gap-y-3">
        <SpineButton
          className="hover:border-2"
          iconPath={mdiPuzzle}
          isActive={mainPage === "Extensions"}
          title="Extensions"
          onClick={() => handleGlobalPageClick("Extensions")}
        />

        <DownloadButton />
      </div>
    </div>
  );
};
