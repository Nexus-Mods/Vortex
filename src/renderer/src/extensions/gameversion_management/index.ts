import PromiseBB from "bluebird";

import type { IExtensionContext } from "../../types/IExtensionContext";
import local from "../../util/local";
import { activeGameId } from "../../util/selectors";
import { wrapExtCBAsync } from "../../util/util";
import { setFeature } from "../profile_management/actions/profiles";
import bethesdaProvider from "./bethesda";
import GameVersionManager from "./GameVersionManager";
import GameVersionTransitionManager from "./GameVersionTransitionManager";
import { sessionReducer } from "./reducers";
import type {
  GameVersionProviderFunc,
  GameVersionProviderTest,
  IGameVersionProvider,
  IGameVersionProviderOptions,
} from "./types/IGameVersionProvider";
import type { IGameVersionTransitionProvider } from "./types/IGameVersionTransitionProvider";
import {
  getExecGameVersion,
  getExtGameVersion,
  testExecProvider,
  testExtProvider,
} from "./util/getGameVersion";
import isVersionProvider from "./util/validation";

// oh boy
const $ = local<{
  gameVersionManager: GameVersionManager;
  gameVersionTransitionManager: GameVersionTransitionManager;
}>("gameversion-manager", {
  gameVersionManager: undefined,
  gameVersionTransitionManager: undefined,
});

const gameVersionProviders: IGameVersionProvider[] = [];
const transitionProviders: IGameVersionTransitionProvider[] = [];

function init(context: IExtensionContext): boolean {
  context.registerReducer(["session", "gameVersioning"], sessionReducer);

  context.registerGameVersionProvider = ((
    id: string,
    priority: number,
    supported: GameVersionProviderTest,
    getGameVersion: GameVersionProviderFunc,
    options?: IGameVersionProviderOptions,
    extPath?: any,
  ) => {
    const errors = isVersionProvider({
      id,
      priority,
      supported,
      getGameVersion,
    });
    if (errors !== null) {
      context.api.showErrorNotification("Invalid game version provider", errors, {
        message: "A game version provider has failed to initialize",
      });
      return;
    }
    gameVersionProviders.push({
      id,
      priority,
      supported: wrapExtCBAsync(supported, extPath),
      getGameVersion: wrapExtCBAsync(getGameVersion, extPath),
      options,
    });
    gameVersionProviders.sort((lhs, rhs) => lhs.priority - rhs.priority);
  }) as any;

  context.registerGameVersionTransitionProvider = (provider) => {
    if (
      provider?.id === undefined ||
      provider.catalog?.url === undefined ||
      Object.keys(provider.catalog.trustedKeys ?? {}).length === 0
    ) {
      context.api.showErrorNotification(
        "Invalid game version transition provider",
        "The provider is missing its id, catalog URL, or trusted key",
        { allowReport: false },
      );
      return;
    }
    transitionProviders.push(provider);
    transitionProviders.sort((lhs, rhs) => lhs.priority - rhs.priority);
  };

  context.registerGameVersionProvider("ext-version-check", 20, testExtProvider, getExtGameVersion);
  context.registerGameVersionProvider(
    "exec-version-check",
    100,
    testExecProvider,
    getExecGameVersion,
  );
  context.registerGameVersionProvider(
    "fallback",
    1000,
    () => Promise.resolve(true),
    () => Promise.resolve("0.0.0"),
  );
  context.registerGameVersionTransitionProvider(bethesdaProvider);

  context.registerModType(
    "game-version",
    10,
    (gameId) => transitionProviders.some((provider) => provider.supportedGames.includes(gameId)),
    (game) => context.api.getState().settings.gameMode.discovered[game.id]?.path,
    () => PromiseBB.resolve(false),
    { mergeMods: true, name: "Game Version" },
  );

  context.registerProfileSelectFeature(
    "game_version",
    "revision",
    "Game Version",
    "Choose whether this profile uses the store installation or a managed game version.",
    () => {
      const gameId = activeGameId(context.api.getState());
      const store =
        gameId === undefined
          ? undefined
          : context.api.getState().settings.gameMode.discovered[gameId]?.store;
      return (
        gameId !== undefined &&
        store !== undefined &&
        transitionProviders.some(
          (provider) =>
            provider.supportedPlatforms.includes(process.platform) &&
            provider.supportedGames.includes(gameId) &&
            provider.supportedStores.includes(store),
        )
      );
    },
    (profile) => $.gameVersionTransitionManager?.getProfileChoices(profile.gameId) ?? [],
    (value) => {
      if (typeof value !== "string" || value === "store") {
        return "Store installation";
      }
      return value.startsWith("managed:") ? `${value.slice("managed:".length)} (Managed)` : value;
    },
  );

  context.once(() => {
    $.gameVersionManager = new GameVersionManager(context.api, gameVersionProviders);
    $.gameVersionTransitionManager = new GameVersionTransitionManager(
      context.api,
      transitionProviders,
    );
    context.api.onAsync("prepare-game-version-for-profile", (profileId: string) =>
      $.gameVersionTransitionManager.prepareProfileVersion(profileId, false),
    );
    context.api.events.on("mod-enabled", (profileId: string, modId: string) =>
      $.gameVersionTransitionManager.handleModStateChange(profileId, modId, true),
    );
    context.api.events.on("mod-disabled", (profileId: string, modId: string) =>
      $.gameVersionTransitionManager.handleModStateChange(profileId, modId, false),
    );
    context.api.onAsync("will-remove-mod", (gameId: string, modId: string) =>
      $.gameVersionTransitionManager.handleModRemoval(gameId, modId),
    );

    let applyingProfileSetting = false;
    context.api.onStateChange(["persistent", "profiles"], (previous, current) => {
      if (applyingProfileSetting) {
        return;
      }
      const profileId = (context.api.getState() as any).settings.profiles.activeProfileId;
      if (profileId === undefined) {
        return;
      }
      if ($.gameVersionTransitionManager.isUpdatingProfile(profileId)) {
        return;
      }
      const before = previous[profileId]?.features?.game_version ?? "store";
      const after = current[profileId]?.features?.game_version ?? "store";
      if (before === after) {
        return;
      }
      applyingProfileSetting = true;
      void $.gameVersionTransitionManager
        .prepareProfileVersion(profileId, true)
        .catch((err) => {
          context.api.store.dispatch(setFeature(profileId, "game_version", before));
          context.api.showErrorNotification("Failed to change the profile game version", err, {
            allowReport: false,
          });
        })
        .finally(() => {
          applyingProfileSetting = false;
        });
    });
    void $.gameVersionTransitionManager.reconcile();
  });

  context.registerAPI(
    "ensureGameVersion",
    (gameId: string, versions: string[], selection?: "prompt" | "prepare" | "skip") =>
      $.gameVersionTransitionManager?.ensure(gameId, versions, selection) ??
      Promise.resolve("unavailable"),
    { minArguments: 2 },
  );

  context.registerAPI(
    "inspectGameVersionTransition",
    (gameId: string, versions: string[]) =>
      $.gameVersionTransitionManager?.inspect(gameId, versions) ??
      Promise.resolve({ status: "unavailable" }),
    { minArguments: 2 },
  );

  return true;
}

export default init;
