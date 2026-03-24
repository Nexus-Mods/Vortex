/* eslint-disable */
import * as path from "path";
import { fs, actions, log, selectors, types, util } from "vortex-api";
import { storeName } from "./common";
import {
  getGameStore,
  getScriptExtenderVersion,
  getGamePath,
  toBlue,
  clearNotifications,
  resolveVersionMapping,
} from "./util";
import * as gitHubDownloader from "./githubDownloader";
import * as silverlockDownloader from "./silverlockDownloader";
import supportData from "./gameSupport";
import { testSupported, installScriptExtender } from "./installer";
import { IGameSupport } from "./types";

import * as nexusModsDownloader from "./nexusModsDownloader";

async function onCheckModVersion(
  api: types.IExtensionApi,
  gameId: string,
  mods: { [id: string]: types.IMod },
) {
  // Clear any update notifications.
  clearNotifications(api, true);

  // Exit if this isn't a supported game.
  if (!supportData[gameId]) {
    return;
  }
  const gameSupport: IGameSupport = supportData[gameId];
  if (gameSupport.ignore === true) {
    return;
  }

  //If the script extender has a Nexus Mods page. Exit here as Vortex can check itself.
  if (gameSupport.nexusMods) {
    return;
  }

  const gamePath = getGamePath(gameId, api);
  const gameStore = getGameStore(gameId, api);
  if (gamePath === undefined || ["xbox", "epic"].includes(gameStore)) {
    return;
  }

  // Get the version of the installed script extender
  const scriptExtenderVersion: string = await getScriptExtenderVersion(
    path.join(gamePath, gameSupport.scriptExtExe),
  );
  // If there is no script extender installed, return.
  if (!scriptExtenderVersion) {
    return;
  }

  // Convert the mods object into an array.
  const modArray = Object.values(mods);
  // Get active profile, so we know which mods are enabled.
  const profile = selectors.activeProfile(api.store.getState());
  // Filter out any non-script extender mods or those which are disabled (old versions).
  const scriptExtenders = modArray.filter((mod: types.IMod) => {
    const isScriptExtender = util.getSafe(
      mod,
      ["attributes", "scriptExtender"],
      false,
    );
    const isEnabled = util.getSafe(
      profile,
      ["modState", mod.id, "enabled"],
      false,
    );
    const isNotFromNexusMods = mod.attributes?.source !== "nexus";
    return isScriptExtender && isEnabled && isNotFromNexusMods;
  });

  // Check for update.
  const latestVersion: string = gameSupport?.gitHubAPIUrl
    ? await gitHubDownloader.checkForUpdates(
        api,
        gameSupport,
        scriptExtenderVersion,
      )
    : await silverlockDownloader.checkForUpdate(
        api,
        gameSupport,
        scriptExtenderVersion,
      );

  // If we fail to get the latest version or it's an exact match for our
  // installed script extender, return.
  if (!latestVersion || latestVersion === scriptExtenderVersion) {
    return;
  }

  // Iterate through our script extenders to add the version update info.
  scriptExtenders.forEach((xse) => {
    if (xse.attributes.version !== latestVersion) {
      api.store.dispatch(
        actions.setModAttributes(gameId, xse.id, {
          newestFileId: "unknown",
          newestVersion: latestVersion,
        }),
      );
    }
  });
}

interface IScriptExtenderStatus {
  status: "ok" | "missing" | "mismatched";
  installedVersion?: string;
}

async function checkScriptExtenderStatus(
  api: types.IExtensionApi,
  gameId: string,
): Promise<IScriptExtenderStatus> {
  // If the game is unsupported, exit here.
  if (!supportData[gameId]) {
    return { status: "ok" };
  }
  const gameSupport = supportData[gameId];

  // Get our game path.
  const activegame: types.IGame = util.getGame(gameId);
  const gamePath = getGamePath(activegame.id, api);
  if (gamePath === undefined) {
    // So the user switched to this gameMode yet we have
    //  no evidence of the game ever being discovered...
    //  makes complete sense!
    //  https://github.com/Nexus-Mods/Vortex/issues/6999
    //  Given that getGamePath _can_ return undefined, we just
    //  return here and avoid testing for script extenders.
    //  pretty sure this issue will pop up again in a different location
    //  unless the user of 6999 gets back to us.
    log("warn", "user switched to an undiscovered gamemode", gameId);
    return { status: "ok" };
  }

  // Work out which game store the user has.
  const gameStore = getGameStore(gameId, api);

  // SKSE is not compatible with Xbox Game Pass or Epic Games, so we don't want to notify the user in this case.
  if (["xbox", "epic"].includes(gameStore)) return { status: "ok" };

  // Check for disabled (but installed) script extenders.
  const mods = util.getSafe(
    api.store.getState(),
    ["persistent", "mods", gameId],
    undefined,
  );
  const modArray: types.IMod[] = mods ? Object.values(mods) : [];
  const isManuallyInstalled = await fs
    .statAsync(path.join(gamePath, gameSupport.scriptExtExe))
    .then(() => true)
    .catch(() => false);

  // Grab our current script extender version.
  const scriptExtenderVersion: string = await getScriptExtenderVersion(
    path.join(gamePath, gameSupport.scriptExtExe),
  );

  // If the script extender isn't installed at all, it's missing.
  if (!scriptExtenderVersion && !isManuallyInstalled) {
    const installedScriptExtenders = modArray.filter(
      (mod) => mod?.attributes?.scriptExtender,
    ).length;
    if (!installedScriptExtenders) {
      return { status: "missing" };
    }
  }

  // If the script extender is installed, check if it's the right version for this game.
  if (scriptExtenderVersion && gameSupport.versionMap?.length) {
    const state = api.store.getState();
    const discovery = selectors.discoveryByGame(state, gameId);
    const game = util.getGame(gameId);
    const gameVersion = await game?.getInstalledVersion?.(discovery);
    const versionBasic = gameVersion
      ? gameVersion.split(".").slice(0, 3).join(".")
      : undefined;
    const versionMapping = resolveVersionMapping(gameSupport, versionBasic);
    if (versionMapping && scriptExtenderVersion !== versionMapping.scriptExtenderVersion) {
      return { status: "mismatched", installedVersion: scriptExtenderVersion };
    }
  }

  if (isManuallyInstalled) {
    log("info", "Script extender detected as manually installed", {
      game: gameId,
    });
  }

  return { status: "ok" };
}

async function downloadScriptExtender(
  api: types.IExtensionApi,
  gameSupport: IGameSupport,
  gameId: string,
): Promise<void> {
  if (gameSupport?.nexusMods)
    return nexusModsDownloader.downloadScriptExtender(api, gameSupport);
  else if (gameSupport?.gitHubAPIUrl)
    return gitHubDownloader.downloadScriptExtender(api, gameSupport);
  else return silverlockDownloader.notifyNotInstalled(gameSupport, api);
}

async function testMissingScriptExtender(
  api: types.IExtensionApi,
): Promise<types.ITestResult> {
  const state = api.store.getState();
  const gameMode = selectors.activeGameId(state);
  const gameSupport = supportData[gameMode];
  if (gameSupport === undefined || gameSupport.ignore === true) {
    // Not applicable.
    return Promise.resolve(undefined);
  }
  const seStatus = await checkScriptExtenderStatus(api, gameMode);
  if (seStatus.status === "ok") {
    return Promise.resolve(undefined);
  }

  // Get game version and store info.
  const discovery = selectors.discoveryByGame(state, gameMode);
  const game = util.getGame(gameMode);
  const gameVersion = await game?.getInstalledVersion?.(discovery);
  const versionBasic = gameVersion
    ? gameVersion.split(".").slice(0, 3).join(".")
    : undefined;
  const gameStore = getGameStore(gameMode, api);
  const versionMapping = resolveVersionMapping(gameSupport, versionBasic);

  // Version mismatch: SE is installed but wrong version for this game runtime.
  if (seStatus.status === "mismatched") {
    return Promise.resolve({
      description: {
        short: `${gameSupport.name} version mismatch`,
        long:
          `You have {{name}} version {{installed}} installed, but your game version {{gameVersion}} ({{label}}) requires version {{expected}}.\n\n` +
          `Using the wrong script extender version will cause it to fail on launch. ` +
          `Please install the correct version to avoid issues.`,
        replace: {
          name: gameSupport.name,
          installed: seStatus.installedVersion,
          gameVersion: versionBasic,
          label: versionMapping?.label,
          expected: versionMapping?.scriptExtenderVersion,
        },
      },
      severity: "warning" as types.ProblemSeverity,
      automaticFix: () => downloadScriptExtender(api, gameSupport, gameMode),
    });
  }

  // Missing: SE is not installed at all.
  if (gameSupport.nexusMods) {
    const recommendedText = versionMapping
      ? `\n\nBased on your game version ({{label}}), the recommended script extender version is {{recommended}}.`
      : "";

    return Promise.resolve({
      description: {
        short: `${gameSupport.name} not installed`,
        long:
          `Vortex could not detect "{{name}}". This means it is either not installed or installed incorrectly.\n\n` +
          `For the best modding experience, we recommend downloading and installing the script extender.\n\n` +
          `You are running version {{version}} ({{store}}) of the game, please make sure you use the correct script extender version.` +
          recommendedText,
        replace: {
          name: gameSupport.name,
          version: versionBasic || "?.?.?",
          store: storeName(gameStore),
          recommended: versionMapping?.scriptExtenderVersion,
          label: versionMapping?.label,
        },
      },
      severity: "warning" as types.ProblemSeverity,
      automaticFix: () => downloadScriptExtender(api, gameSupport, gameMode),
    });
  } else {
    // For non-Nexus extenders (GitHub, Silverlock)
    return Promise.resolve({
      description: {
        short: `${gameSupport.name} not installed`,
        long:
          `Vortex could not detect ${gameSupport.name}. This means it is either not installed or installed incorrectly.\n\n` +
          `For the best modding experience, we recommend installing the script extender by visiting ${gameSupport.website}.\n\n` +
          `Click "Fix" to open the download page.`,
        replace: {
          name: gameSupport.name,
          website: gameSupport.website,
        },
      },
      severity: "warning" as types.ProblemSeverity,
      automaticFix: () => downloadScriptExtender(api, gameSupport, gameMode),
    });
  }
}

async function testMisconfiguredPrimaryTool(
  api: types.IExtensionApi,
): Promise<types.ITestResult> {
  const state = api.store.getState();
  const gameMode = selectors.activeGameId(state);
  const primaryToolId = util.getSafe(
    state,
    ["settings", "interface", "primaryTool", gameMode],
    undefined,
  );
  if (supportData[gameMode] === undefined || primaryToolId === undefined) {
    // Not applicable.
    return Promise.resolve(undefined);
  }

  const discovery: types.IDiscoveryResult = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameMode],
    undefined,
  );
  if (!discovery?.path || !discovery?.tools?.[primaryToolId]?.path) {
    // No game or no tools.
    return Promise.resolve(undefined);
  }

  const gameStore = getGameStore(gameMode, api);

  if (["epic", "xbox"].includes(gameStore)) {
    return Promise.resolve(undefined);
  }

  const expectedPath = path.join(
    discovery.path,
    supportData[gameMode].scriptExtExe,
  );

  const installedSEVersion = await getScriptExtenderVersion(expectedPath);

  const primaryTool: types.IDiscoveredTool = discovery.tools[primaryToolId];
  const normalize = (input: string, mod?: (input: string) => string) =>
    mod !== undefined
      ? path.normalize(mod(input.toLowerCase()))
      : path.normalize(input.toLowerCase());
  if (
    installedSEVersion !== undefined &&
    normalize(primaryTool.path, path.basename) ===
      normalize(supportData[gameMode].scriptExtExe) &&
    normalize(primaryTool.path, path.dirname) !==
      normalize(discovery.path).replace(/\/$|\\$/, "")
  ) {
    log(
      "info",
      `Tool path for ${supportData.name} automatically corrected from ${primaryTool.path} to ${expectedPath}`,
      primaryTool.id,
    );
    api.store.dispatch(
      actions.addDiscoveredTool(
        gameMode,
        primaryTool.id,
        {
          ...primaryTool,
          path: expectedPath,
          workingDirectory: discovery.path,
        },
        false,
      ),
    );
    api.store.dispatch(actions.setToolVisible(gameMode, primaryTool.id, true));
    return Promise.resolve(undefined);

    // We don't need to bother the user with this, we'll just fix it!
    // return Promise.resolve({
    //   description: {
    //     short: 'Misconfigured Script Extender Tool',
    //     long: t('Your primary tool/starter for this game is a Script Extender, but it appears to be misconfigured. '
    //           + 'Vortex should be able to automatically fix this issue for you by re-configuring it to launch using:[br][/br][br][/br]'
    //           + '{{valid}}[br][/br][br][/br] instead of:[br][/br][br][/br] {{invalid}}[br][/br][br][/br]'
    //           + 'For more information about where/how to install script extenders, please see our wiki article:[br][/br]'
    //           + '[url]https://wiki.nexusmods.com/index.php/Tool_Setup:_Script_Extenders[/url]', {
    //             replace: {
    //               invalid: primaryTool.path,
    //               valid: path.join(discovery.path, path.basename(primaryTool.path)),
    //             },
    //           }),
    //   },
    //   automaticFix: () => {
    //     api.store.dispatch(actions.addDiscoveredTool(gameMode, primaryTool.id, {
    //       ...primaryTool,
    //       path: expectedPath,
    //       workingDirectory: discovery.path,
    //     }, false));
    //     api.store.dispatch(actions.setToolVisible(gameMode, primaryTool.id, true));
    //     return Promise.resolve();
    //   },
    //   severity: 'warning',
    // });
  } else {
    return Promise.resolve(undefined);
  }
}

function main(context: types.IExtensionContext) {
  context.registerInstaller(
    "script-extender-installer",
    10,
    toBlue(testSupported),
    toBlue(installScriptExtender),
  );

  context.registerTest("script-extender-missing", "gamemode-activated", () =>
    testMissingScriptExtender(context.api),
  );
  context.registerTest(
    "misconfigured-script-extender",
    "gamemode-activated",
    () => testMisconfiguredPrimaryTool(context.api),
  );

  context.once(() => {
    context.api.events.on(
      "check-mods-version",
      (gameId: string, mods: { [id: string]: types.IMod }) =>
        onCheckModVersion(context.api, gameId, mods),
    );

    context.api.onAsync("download-script-extender", (gameId: string) => {
      const gameSupport = supportData[gameId];
      if (gameSupport == null) {
        return Promise.resolve();
      }
      return downloadScriptExtender(context.api, gameSupport, gameId);
    });
  });

  return true;
}

export default main;
