import type { IExtensionContext, IRunParameters } from "../../types/IExtensionContext";
import type { IGame, IProfile } from "../../types/api";
import type { ILoadOrderEntry, IValidationResult } from "../../types/api";
import type { DiagnosticResult } from "@vortex/shared/ipc";

import PromiseBB from "bluebird";

import GameStoreHelper from "../../util/GameStoreHelper";
import { setExtensionEnabled } from "../../actions";
import { getSafe } from "../../util/storeHelper";
import { activeProfile } from "../../util/selectors";

const GAME_ID = "cyberpunk2077";
const LEGACY_EXTENSION_MOD_ID = 196;
const REDDEPLOY_TOOL_ID = "cyberpunk2077-reddeploy";
const LEGACY_EXTENSION_HINTS = [
  "cyberpunk 2077 vortex support",
  "cyberpunk2077_ext_redux",
];

function createCyberpunkGame(context: IExtensionContext): IGame {
  return {
    id: GAME_ID,
    name: "Cyberpunk 2077",
    mergeMods: true,
    queryPath: () =>
      GameStoreHelper.findByAppId(["1091500", "1423049311", "Ginger"]).then(
        (entry) => entry.gamePath,
      ),
    queryModPath: () => ".",
    executable: () => "bin\\x64\\Cyberpunk2077.exe",
    parameters: ["-modded"],
    requiredFiles: ["bin\\x64\\Cyberpunk2077.exe"],
    logo: "gameart.png",
    supportedTools: [
      {
        id: "cyberpunk2077-game-modded",
        name: "Launch Game with REDmods Enabled",
        shortName: "cp2077.exe -modded",
        executable: () => "bin\\x64\\Cyberpunk2077.exe",
        requiredFiles: ["bin\\x64\\Cyberpunk2077.exe"],
        parameters: ["-modded"],
        relative: true,
        logo: "gameicon.jpg",
      },
      {
        id: "cyberpunk2077-redlauncher",
        name: "REDLauncher",
        shortName: "REDLauncher",
        executable: () => "REDprelauncher.exe",
        requiredFiles: ["REDprelauncher.exe"],
        parameters: ["-modded"],
        relative: true,
        logo: "REDLauncher.png",
      },
      {
        id: REDDEPLOY_TOOL_ID,
        name: "REDmod Deploy Latest Load Order",
        shortName: "REDdeploy",
        executable: () => "tools\\redmod\\bin\\redMod.exe",
        requiredFiles: ["tools\\redmod\\bin\\redMod.exe"],
        parameters: [],
        relative: true,
        shell: true,
        exclusive: true,
        logo: "REDdeploy.png",
      },
    ],
    compatible: {
      symlinks: false,
    },
    details: {
      steamAppId: "1091500",
      gogAppId: "1423049311",
      epicAppId: "Ginger",
    },
    environment: {
      SteamAPPId: "1091500",
    },
    requiresLauncher: (_gamePath, store) =>
      Promise.resolve(
        store === "gog"
          ? { launcher: "gog", addInfo: "1423049311" }
          : undefined,
      ) as any,
    setup: (discovery) =>
      PromiseBB.resolve(
        window.api.games.runSetup(
          GAME_ID,
          buildRuntimeSnapshot(context, undefined, discovery),
        ),
      ).then((diagnostics) => {
        notifyDiagnostics(context, diagnostics, "Cyberpunk setup");
        return undefined;
      }),
  };
}

function buildRuntimeSnapshotFromState(
  state: any,
  profile?: IProfile,
  discoveryOverride?: any,
) {
  const resolvedProfile = profile ?? activeProfile(state);
  const gameId = resolvedProfile?.gameId ?? GAME_ID;
  const discovery =
    discoveryOverride ??
    getSafe(state, ["settings", "gameMode", "discovered", gameId], {});
  const mods = Object.values(
    getSafe(state, ["persistent", "mods", gameId], {}),
  ).map((mod: any) => ({
    id: String(mod.id),
    name: mod.attributes?.customFileName ?? mod.attributes?.name ?? mod.id,
    enabled: getSafe(
      state,
      ["persistent", "profiles", resolvedProfile?.id, "modState", gameId, mod.id, "enabled"],
      false,
    ),
    type: mod.type,
    modId: mod.attributes?.modId?.toString?.() ?? mod.attributes?.modId,
    version: mod.attributes?.version,
    fileId: mod.attributes?.fileId?.toString?.() ?? mod.attributes?.fileId,
    attributes: mod.attributes,
  }));

  return {
    gameId,
    activeProfileId: resolvedProfile?.id,
    discovery: {
      path: discovery?.path,
      store: discovery?.store,
      tools: discovery?.tools,
    },
    features: {
      v2077_feature_redmod_autoconvert_archives: getSafe(
        state,
        ["settings", "v2077", "v2077_feature_redmod_autoconvert_archives"],
        false,
      ),
      v2077_feature_redmod_fallback_install_anyways: getSafe(
        state,
        ["settings", "v2077", "v2077_feature_redmod_fallback_install_anyways"],
        false,
      ),
    },
    mods,
    loadOrder: getSafe(state, ["persistent", "loadOrder", resolvedProfile?.id], []),
  };
}

function buildRuntimeSnapshot(
  context: IExtensionContext,
  profile?: IProfile,
  discoveryOverride?: any,
) {
  return buildRuntimeSnapshotFromState(
    context.api.store.getState(),
    profile,
    discoveryOverride,
  );
}

function notifyDiagnostics(
  context: IExtensionContext,
  diagnostics: DiagnosticResult[],
  titlePrefix: string,
) {
  diagnostics.forEach((diagnostic) => {
    context.api.sendNotification?.({
      id: `${titlePrefix}-${diagnostic.id}`,
      type:
        diagnostic.level === "error"
          ? "error"
          : diagnostic.level === "warning"
            ? "warning"
            : "info",
      title: diagnostic.title,
      message: diagnostic.message,
    });
  });
}

function legacyExtensionId(state: any): string | undefined {
  const installed = getSafe(state, ["session", "extensions", "installed"], {});
  return Object.keys(installed).find((extId) => {
    const ext = installed[extId];
    const name = String(ext?.name ?? "").toLowerCase();
    const repo = String(ext?.github ?? "").toLowerCase();
    return (
      ext?.modId === LEGACY_EXTENSION_MOD_ID ||
      LEGACY_EXTENSION_HINTS.some((hint) => name.includes(hint) || repo.includes(hint))
    );
  });
}

function main(context: IExtensionContext) {
  context.registerGame(createCyberpunkGame(context) as any);

  context.registerInstaller(
    "cyberpunk2077-internal",
    30,
    async (files, gameId, archivePath) => {
      if (gameId !== GAME_ID) {
        return { supported: false, requiredFiles: [] };
      }
      const match = await window.api.games.classifyInstall(
        GAME_ID,
        {
          files: files.map((file) => ({ path: file })),
          stagingPath: "",
          archivePath,
        },
        buildRuntimeSnapshot(context),
      );
      return {
        supported: match.supported,
        requiredFiles: match.requiredFiles,
      };
    },
    async (files, destinationPath, gameId, _progressDelegate, _choices, _unattended, archivePath) => {
      const plan = await window.api.games.buildInstallPlan(
        GAME_ID,
        {
          files: files.map((file) => ({ path: file })),
          stagingPath: destinationPath,
          archivePath,
        },
        buildRuntimeSnapshot(context),
      );
      notifyDiagnostics(context, plan.diagnostics ?? [], "Cyberpunk install");
      return { instructions: plan.instructions as any };
    },
  );

  context.registerLoadOrder({
    gameId: GAME_ID,
    usageInstructions:
      "Only REDmods and autoconverted archive mods are orderable. Non-converted archive mods still load alphabetically before all REDmods.",
    deserializeLoadOrder: async () => {
      const profile = activeProfile(context.api.store.getState());
      const snapshot = await window.api.games.compileLoadOrder(
        GAME_ID,
        buildRuntimeSnapshot(context, profile),
      );
      return snapshot.entries as ILoadOrderEntry[];
    },
    serializeLoadOrder: async (loadOrder) => {
      const profile = activeProfile(context.api.store.getState());
      const diagnostics = await window.api.games.applyLoadOrder(
        GAME_ID,
        buildRuntimeSnapshot(context, profile),
        {
          entries: loadOrder as any,
        },
      );
      notifyDiagnostics(context, diagnostics, "Cyberpunk load order");
    },
    validate: async (): Promise<IValidationResult> =>
      undefined as any,
  });

  context.registerStartHook(45, "cyberpunk2077-reddeploy-hook", async (call: IRunParameters) => {
    const executable = call.executable.toLowerCase();
    if (!executable.endsWith("redmod.exe")) {
      return call;
    }

    const plan = await window.api.games.getToolLaunchPlan(
      GAME_ID,
      REDDEPLOY_TOOL_ID,
      buildRuntimeSnapshot(context),
      call.executable,
      call.args,
    );

    if (plan.handled) {
      return {
        executable: "cmd.exe",
        args: ["/c", "echo", ""],
        options: {
          ...call.options,
          shell: true,
          detach: true,
        },
      };
    }

    return {
      executable: plan.executable ?? call.executable,
      args: plan.args ?? call.args,
      options: {
        ...call.options,
        ...plan.options,
      },
    };
  });
}

function once(context: IExtensionContext) {
  const state = context.api.store.getState();
  const extId = legacyExtensionId(state);
  if (extId !== undefined) {
    context.api.store.dispatch(setExtensionEnabled(extId, false));
    context.api.sendNotification?.({
      id: "cyberpunk2077-built-in-takeover",
      type: "info",
      title: "Built-in Cyberpunk support enabled",
      message:
        "The older third-party Cyberpunk extension was disabled so the built-in integration can take over.",
    });
  }
}

export default main;

export {
  once,
};
