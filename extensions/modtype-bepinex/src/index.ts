/* eslint-disable */
import * as path from "path";
import { actions, log, selectors, types, util } from "vortex-api";

import AttribDashlet from "./AttribDashlet";

import { ensureBepInExPack } from "./bepInExDownloader";
import {
  addGameSupport,
  getDownload,
  getSupportMap,
  MODTYPE_BIX_INJECTOR,
} from "./common";
import {
  installInjector,
  installRootMod,
  testSupportedBepInExInjector,
  testSupportedRootMod,
} from "./installers";
import {
  IBepInExGameConfig,
  INexusDownloadInfo,
  NotPremiumError,
} from "./types";
import { createDirectories, dismissNotifications, toBlue } from "./util";

function showAttrib(state: types.IState) {
  const gameMode = selectors.activeGameId(state);
  return getSupportMap()[gameMode] !== undefined;
}

function isSupported(gameId: string) {
  const isGameSupported = !["valheim"].includes(gameId);
  const isRegistered = getSupportMap()[gameId] !== undefined;
  return isGameSupported && isRegistered;
}

async function onCheckModVersion(
  api: types.IExtensionApi,
  gameId: string,
  mods: { [modId: string]: types.IMod },
) {
  const gameConf = getSupportMap()[gameId];
  if (gameConf === undefined) {
    return;
  }
  let state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  if (profileId === undefined) {
    return;
  }
  const profile = selectors.profileById(state, profileId);
  if (profile === undefined) {
    return;
  }
  const injectorModIds = Object.keys(mods).filter(
    (id) => mods[id]?.type === MODTYPE_BIX_INJECTOR,
  );
  const enabledId = injectorModIds.find((id) =>
    util.getSafe(profile, ["modState", id, "enabled"], false),
  );

  if (enabledId === undefined) {
    // There are no enabled injector mods or potentially no injector mods
    //  at all - nothing to update.
    return;
  }

  const injectorMod = mods[enabledId];
  if (injectorMod === undefined) {
    // There's some type of data mismatch/corruption. We can't
    //  find the mod entry for the injector mod so there's nothing we
    //  can update.
    return;
  }

  if (
    gameConf.bepinexVersion &&
    gameConf.bepinexVersion === injectorMod.attributes?.version
  ) {
    // If a specific bepinex version is specified, and the injector mod already has that version.
    //  We do not want to update it! BIX updates will break mods.
    return;
  }
  const forceUpdate = (dwnl?: INexusDownloadInfo) =>
    ensureBepInExPack(api, gameId, true)
      .catch((err) => {
        return err instanceof NotPremiumError
          ? Promise.resolve()
          : api.showErrorNotification("Failed to update BepInEx", err);
      })
      .finally(() => {
        if (dwnl === undefined) {
          return Promise.resolve();
        }
        state = api.getState();
        const newMods: { [modId: string]: types.IMod } = util.getSafe(
          state,
          ["persistent", "mods", gameId],
          undefined,
        );
        const newInjector = Object.keys(newMods).find(
          (id) => newMods[id].attributes?.fileId === dwnl.fileId,
        );
        const batched = [
          actions.setModEnabled(profile.id, enabledId, false),
          actions.setModEnabled(profile.id, newInjector, true),
        ];
        util.batchDispatch(api.store, batched);
      });

  if (gameConf.customPackDownloader !== undefined) {
    const res = await gameConf.customPackDownloader(util.getVortexPath("temp"));
    if (typeof res === "string") {
      if (path.basename(res, path.extname(res)) !== injectorMod.id) {
        return forceUpdate();
      }
    } else if ((res as INexusDownloadInfo) !== undefined) {
      const nexDownload = res as INexusDownloadInfo;
      if (nexDownload.fileId !== injectorMod.attributes?.fileId?.toString()) {
        return forceUpdate(nexDownload);
      }
    }
  } else if (gameConf.forceGithubDownload !== true) {
    const download = getDownload(gameConf);
    if (injectorMod.attributes?.fileId !== +download.fileId) {
      return forceUpdate(download);
    }
  } else {
    await ensureBepInExPack(api, gameConf.gameId, false, true);
  }
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame): string => {
    const state: types.IState = context.api.getState();
    const gameConf: IBepInExGameConfig = getSupportMap()[game.id];
    const discovery = state.settings.gameMode.discovered[game.id];
    if (gameConf !== undefined && discovery?.path !== undefined) {
      return gameConf.installRelPath !== undefined
        ? path.join(discovery.path, gameConf.installRelPath)
        : discovery.path;
    } else {
      return undefined;
    }
  };

  const genTestProps = (gameId?: string) => {
    const state = context.api.getState();
    const activeGameId =
      gameId === undefined ? selectors.activeGameId(state) : gameId;
    const gameConf = getSupportMap()[activeGameId];
    const game: types.IGameStored = selectors.gameById(state, activeGameId);
    return { gameConf, game };
  };

  // A dummy modType test for modTypes we do not want to assign automatically.
  const modTypeTest = toBlue(() => Promise.resolve(false));

  // Regular DLL plugin modType test
  const pluginModTypeTest = async (instructions: types.IInstruction[]) => {
    const copyInstructions = instructions.filter(
      (instr) =>
        instr.type === "copy" && path.extname(path.basename(instr.destination)),
    );

    return (
      copyInstructions.find(
        (instr) => path.extname(instr.destination) === ".dll",
      ) !== undefined
    );
  };

  const rootModTypeTest = async (instructions: types.IInstruction[]) => {
    const bixRootFolders: string[] = ["plugins", "patchers", "config"];
    const isRootSegment = (seg: string) =>
      seg !== undefined ? bixRootFolders.includes(seg.toLowerCase()) : false;
    const copyInstructions = instructions.filter(
      (instr) =>
        instr.type === "copy" && path.extname(path.basename(instr.destination)),
    );

    for (const instr of copyInstructions) {
      const segments = instr.destination.split(path.sep);
      const rootSeg = segments.find(isRootSegment);
      if (rootSeg && segments.indexOf(rootSeg) === 0) {
        // The instructions have an expected root segment
        //  right at the root of the mod's installation folder,
        //  this is a root mod.
        return true;
      }
    }

    return false;
  };

  context.registerDashlet(
    "BepInEx Support",
    1,
    2,
    250,
    AttribDashlet,
    showAttrib,
    () => ({}),
    undefined,
  );

  context.registerAPI(
    "bepinexAddGame",
    (bepinexConf: IBepInExGameConfig, callback?: (err: Error) => void) => {
      if (
        bepinexConf !== undefined ||
        (bepinexConf as IBepInExGameConfig) === undefined
      ) {
        addGameSupport(bepinexConf);
      } else {
        callback?.(
          new util.DataInvalid(
            "failed to register bepinex game, invalid object received",
          ),
        );
      }
    },
    { minArguments: 1 },
  );

  // This modType is assigned by the BepInEx injector installer.
  context.registerModType(
    MODTYPE_BIX_INJECTOR,
    10,
    isSupported,
    getPath,
    modTypeTest,
    {
      mergeMods: true,
      name: "Bepis Injector Extensible",
    },
  );

  // There's currently no reliable way to differentiate BepInEx plugins from patchers,
  //  apart from the mod's description specifying where to deploy the mod. Unlike regular
  //  plugins, patchers should only be used in special cases, which is why
  //  we don't want this to be assigned by default.
  context.registerModType(
    "bepinex-patcher",
    11,
    isSupported,
    (game: types.IGame) => path.join(getPath(game), "BepInEx", "patchers"),
    modTypeTest,
    {
      mergeMods: true,
      name: "BepInEx (patchers)",
    },
  );

  // Assigned to any mod that contains the plugins, patchers, config directories
  context.registerModType(
    "bepinex-root",
    12,
    isSupported,
    (game: types.IGame) => path.join(getPath(game), "BepInEx"),
    toBlue(rootModTypeTest),
    {
      mergeMods: true,
      name: "BepInEx (root)",
    },
  );

  context.registerModType(
    "bepinex-plugin",
    13,
    isSupported,
    (game: types.IGame) => path.join(getPath(game), "BepInEx", "plugins"),
    toBlue(pluginModTypeTest),
    {
      mergeMods: true,
      name: "BepInEx (plugins)",
    },
  );

  // Most of our extension development tutorials suggest that extension authors
  //  should use priority 25 for their installers. Given that this is an API
  //  functionality, we should ensure that our installers are run before any
  //  extension installers.
  //  TODO: Make sure this is documented in the API docs.
  context.registerInstaller(
    "bepis-injector-extensible",
    10,
    toBlue(testSupportedBepInExInjector),
    toBlue(installInjector),
  );

  context.registerInstaller(
    "bepinex-root",
    10,
    toBlue(testSupportedRootMod),
    toBlue(installRootMod),
  );

  context.registerTest(
    "bepinex-config-test",
    "gamemode-activated",
    toBlue(() => {
      const { game, gameConf } = genTestProps();
      return gameConf?.validateBepInExConfiguration !== undefined
        ? gameConf.validateBepInExConfiguration(getPath(game as any))
        : Promise.resolve(undefined);
    }),
  );

  context.registerTest(
    "doorstop-config-test",
    "gamemode-activated",
    toBlue(() => {
      const { game, gameConf } = genTestProps();
      return gameConf?.doorstopConfig?.validateDoorStopConfig !== undefined
        ? gameConf.doorstopConfig.validateDoorStopConfig(getPath(game as any))
        : Promise.resolve(undefined);
    }),
  );

  context.once(() => {
    context.api.events.on(
      "did-install-mod",
      async (gameId, archiveId, modId) => {
        const gameConf = getSupportMap()[gameId];
        if (gameConf === undefined) {
          return;
        }
        const state = context.api.getState();
        const mod: types.IMod = util.getSafe(
          state,
          ["persistent", "mods", gameId, modId],
          undefined,
        );
        if (mod?.type !== MODTYPE_BIX_INJECTOR) {
          return;
        }
        if (
          mod.attributes != undefined &&
          mod.attributes.modId &&
          mod.attributes.fileId &&
          mod.attributes.version
        ) {
          // Mod already has attributes set
          return;
        }
        const metaDataDetails: types.ILookupDetails = {
          gameId: "site",
          fileName: mod.attributes?.fileName,
          fileMD5: mod.attributes?.fileMD5,
          fileSize: mod.attributes?.fileSize,
        };
        context.api.lookupModMeta(metaDataDetails, true).then((meta) => {
          const profileId = selectors.lastActiveProfileForGame(state, gameId);
          const batched = [actions.setModEnabled(profileId, modId, true)];
          if (meta.length > 0 && !!meta[0].value?.details) {
            batched.push(
              actions.setDownloadModInfo(
                archiveId,
                "nexus.modInfo",
                meta[0].value,
              ) as any,
            );
            batched.push(
              actions.setModAttribute(
                gameId,
                modId,
                "version",
                meta[0].value.fileVersion,
              ) as any,
            );
            batched.push(
              actions.setModAttribute(
                gameId,
                modId,
                "modId",
                meta[0].value.details.modId,
              ) as any,
            );
            batched.push(
              actions.setModAttribute(
                gameId,
                modId,
                "fileId",
                meta[0].value.details.fileId,
              ) as any,
            );
            // batched.push(actions.setModAttributes(gameId, modId, meta[0].value) as any);
          } else if (!!gameConf.bepinexVersion && !mod?.attributes?.version) {
            batched.push(
              actions.setModAttribute(
                gameId,
                modId,
                "version",
                gameConf.bepinexVersion,
              ) as any,
            );
          } else {
            batched.push(
              actions.setModAttribute(gameId, modId, "version", "0.0.0") as any,
            );
          }
          util.batchDispatch(context.api.store, batched);
        });
      },
    );
    context.api.events.on("profile-will-change", () => {
      const state = context.api.getState();
      const oldProfileId = util.getSafe(
        state,
        ["settings", "profiles", "activeProfileId"],
        undefined,
      );
      const profile = selectors.profileById(state, oldProfileId);
      const gameConf = getSupportMap()[profile?.gameId];
      if (!!gameConf) {
        dismissNotifications(context.api, oldProfileId);
      }
    });
    context.api.events.on("gamemode-activated", async (gameMode: string) => {
      const t = context.api.translate;
      if (!isSupported(gameMode)) {
        return;
      }

      const { gameConf } = genTestProps(gameMode);

      try {
        await createDirectories(context.api, gameConf);
      } catch (err) {
        log("error", "failed to create BepInEx directories", err);
        return;
      }
      const replace = {
        game: util.getGame(gameMode)?.name || gameMode,
        bl: "[br][/br][br][/br]",
        bixUrl:
          "[url=https://github.com/BepInEx/BepInEx/releases]BepInEx Release[/url]",
      };
      const dialogContents = gameConf.autoDownloadBepInEx
        ? t(
            'The "{{game}}" game extension requires a widely used 3rd party assembly ' +
              "patching/injection library called Bepis Injector Extensible (BepInEx).{{bl}}" +
              "Vortex has downloaded and installed this library automatically for you, and is currently " +
              "available in your mods page to enable/disable just like any other regular mod. " +
              'Depending on the modding pattern of "{{game}}", BepInEx may be a hard requirement ' +
              "for mods to function in-game in which case you MUST have the library enabled and deployed " +
              "at all times for the mods to work!{{bl}}" +
              "To remove the library, simply disable the mod entry for BepInEx.",
            { replace },
          )
        : t(
            'The "{{game}}" game extension requires a widely used 3rd party assembly ' +
              "patching/injection library called Bepis Injector Extensible (BepInEx).{{bl}}" +
              "BepInEx may be a hard requirement for some mods to function in-game in which case you should " +
              "manually download and install the latest {{bixUrl}} in order for the mods to work!{{bl}}" +
              'Choose the "BepInEx_x64_...zip" variant - you can then drag and drop it inside the mods page\'s ' +
              '"Drop area" to have Vortex install it as any other mod.{{bl}}' +
              'If you installed the BepInEx package through Vortex, don\'t forget to enable it and click "Deploy Mods", ' +
              "for the package to be linked to your game's directory.",
            { replace },
          );

      return ensureBepInExPack(context.api)
        .then(() =>
          context.api.sendNotification({
            id: "bepis_injector" + gameMode,
            type: "info",
            allowSuppress: true,
            message: "The {{game}} extension uses BepInEx",
            actions: [
              {
                title: "More",
                action: () =>
                  context.api.showDialog(
                    "info",
                    "Bepis Injector Extensible",
                    {
                      bbcode: dialogContents,
                    },
                    [{ label: "Close" }],
                  ),
              },
            ],
            replace,
          }),
        )
        .catch((err) => {
          return err instanceof NotPremiumError
            ? Promise.resolve()
            : context.api.showErrorNotification(
                "Failed to download/install BepInEx",
                err,
              );
        })
        .finally(() => {
          const state = context.api.getState();
          const mods: { [modId: string]: types.IMod } = util.getSafe(
            state,
            ["persistent", "mods", gameMode],
            {},
          );
          const hasInjectorMod = Object.values(mods).some(
            (mod) => mod?.type === MODTYPE_BIX_INJECTOR,
          );
          if (hasInjectorMod) {
            dismissNotifications(
              context.api,
              selectors.lastActiveProfileForGame(
                context.api.getState(),
                gameMode,
              ),
            );
          }
        });
    });

    context.api.onAsync("will-deploy", async (profileId: string) => {
      const state = context.api.getState();
      const activeProfile: types.IProfile = selectors.activeProfile(state);
      const profile = selectors.profileById(state, profileId);
      if (
        profile?.gameId === undefined ||
        profile.gameId !== activeProfile?.gameId
      ) {
        return;
      }

      if (!isSupported(profile.gameId)) {
        return;
      }
      return ensureBepInExPack(context.api, profile.gameId).catch((err) => {
        return err instanceof NotPremiumError
          ? Promise.resolve()
          : context.api.showErrorNotification(
              "Failed to download/install BepInEx",
              err,
            );
      });
    });

    context.api.events.on(
      "check-mods-version",
      (gameId: string, mods: { [modId: string]: types.IMod }) =>
        onCheckModVersion(context.api, gameId, mods),
    );
  });

  return true;
}

export default init;
