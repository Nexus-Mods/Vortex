import { log, selectors, types } from "@nexusmods/vortex-api";
import IniParser, { WinapiFormat } from "vortex-parse-ini";

import { GAME_ID, getDx12UserSettingsPath, VORTEX_BACKUP_TAG } from "./common";
import {
  CONTENT_MANAGER_MODS_SECTION,
  ContentManagerState,
  evaluateContentManagerSettings,
} from "./contentManager";
import { detectEdition, MAX_MOD_NAME_LENGTH, W3Edition } from "./edition";
import { modFolderNames } from "./modFolders";

const LOCAL_MODS_CHECK_ID = "witcher3-local-mods-enabled";
const MOD_NAME_LENGTH_CHECK_ID = "witcher3-mod-name-length";

const TRIGGERS: types.HealthCheckTrigger[] = [
  types.HealthCheckTrigger.GameChanged,
  types.HealthCheckTrigger.Startup,
  types.HealthCheckTrigger.ModsChanged,
  types.HealthCheckTrigger.Manual,
];

function makeResult(
  checkId: string,
  status: types.IHealthCheckResult["status"],
  severity: types.HealthCheckSeverity,
  message: string,
  startedAt: number,
  details?: string,
): types.IHealthCheckResult {
  return {
    checkId,
    status,
    severity,
    message,
    details,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

const passed = (checkId: string, message: string, startedAt: number): types.IHealthCheckResult =>
  makeResult(checkId, "passed", types.HealthCheckSeverity.Info, message, startedAt);

function isRemastered(api: types.IExtensionApi): boolean {
  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  return detectEdition(discovery?.path) === W3Edition.Remastered;
}

const newParser = () => new IniParser(new WinapiFormat());

/**
 * Turns the mod switches back on, in the live settings file and in Vortex's
 * backup of it. Both matter: the menu mod regenerates the live file from the
 * backup, so fixing only the live copy gets reverted on the next deployment.
 */
async function enableLocalMods(): Promise<void> {
  const parser = newParser();
  const livePath = getDx12UserSettingsPath();

  for (const target of [livePath, livePath + VORTEX_BACKUP_TAG]) {
    try {
      const doc = await parser.read(target);
      const section = doc.data[CONTENT_MANAGER_MODS_SECTION];
      if (section === undefined) {
        continue;
      }
      section.Enabled = "true";
      section.EnabledLocal = "true";
      // WinapiFormat writes only the changed keys, so the rest of the file -
      // including anything the game added that we don't know about - survives.
      await parser.write(target, doc);
    } catch (err) {
      // The backup only exists once a menu mod has been deployed.
      log("debug", "W3: could not update mod switches", { target, error: err.message });
    }
  }
}

/**
 * With `[ContentManager/Mods] Enabled` or `EnabledLocal` off, the Remastered
 * edition ignores everything deployed into Mods\ and reports nothing.
 */
export const localModsEnabledCheck: types.IHealthCheck = {
  id: LOCAL_MODS_CHECK_ID,
  gameId: GAME_ID,
  name: "The Witcher 3 - local mods enabled in game",
  description: "Checks that the Remastered edition is set to load locally installed mods.",
  category: types.HealthCheckCategory.Game,
  severity: types.HealthCheckSeverity.Critical,
  triggers: TRIGGERS,
  check: async (api: types.IExtensionApi) => {
    const startedAt = Date.now();
    if (!isRemastered(api)) {
      return passed(LOCAL_MODS_CHECK_ID, "Not applicable to this edition", startedAt);
    }

    let state: ContentManagerState;
    try {
      const doc =
        await newParser().read<Record<string, Record<string, unknown>>>(getDx12UserSettingsPath());
      state = evaluateContentManagerSettings(doc.data);
    } catch {
      return makeResult(
        LOCAL_MODS_CHECK_ID,
        "warning",
        types.HealthCheckSeverity.Warning,
        "Game settings not found",
        startedAt,
        "Run the game once so it can create its settings file, then run this check again.",
      );
    }

    switch (state) {
      case ContentManagerState.ModsDisabled:
        return makeResult(
          LOCAL_MODS_CHECK_ID,
          "failed",
          types.HealthCheckSeverity.Critical,
          "Mods are switched off in game",
          startedAt,
          "The game's gameplay settings have mods disabled, so nothing Vortex deploys will load.",
        );
      case ContentManagerState.LocalModsDisabled:
        return makeResult(
          LOCAL_MODS_CHECK_ID,
          "failed",
          types.HealthCheckSeverity.Critical,
          "Locally installed mods are switched off in game",
          startedAt,
          "The game is set to ignore locally installed mods, so nothing Vortex deploys will " +
            "load. mod.io and Steam Workshop mods are unaffected.",
        );
      case ContentManagerState.Unknown:
        return passed(LOCAL_MODS_CHECK_ID, "Mod switches not set yet", startedAt);
      default:
        return passed(LOCAL_MODS_CHECK_ID, "Local mods are enabled", startedAt);
    }
  },
  fix: () => enableLocalMods(),
};

/**
 * The Remastered edition caps mod folder names, and an over-long one is simply
 * skipped rather than reported.
 */
export const modNameLengthCheck: types.IModHealthCheck = {
  id: MOD_NAME_LENGTH_CHECK_ID,
  gameId: GAME_ID,
  name: "The Witcher 3 - mod folder name length",
  description: "Checks that mod folder names are short enough for the Remastered edition.",
  category: types.HealthCheckCategory.Mods,
  severity: types.HealthCheckSeverity.Warning,
  triggers: [types.HealthCheckTrigger.ModsChanged, types.HealthCheckTrigger.Manual],
  checkMod: async (api: types.IExtensionApi, mod: types.IModCheckContext) => {
    const startedAt = Date.now();
    // gameId is the only gate the runner offers, so other editions still pay
    // for the per-mod walk and the result is discarded here.
    if (!isRemastered(api)) {
      return passed(MOD_NAME_LENGTH_CHECK_ID, "Not applicable to this edition", startedAt);
    }

    const tooLong = modFolderNames(mod.files ?? []).filter(
      (name) => name.length > MAX_MOD_NAME_LENGTH,
    );
    if (tooLong.length > 0) {
      return makeResult(
        MOD_NAME_LENGTH_CHECK_ID,
        "warning",
        types.HealthCheckSeverity.Warning,
        // Named in the message: the aggregate result is built from messages
        // and drops the per-mod details.
        `Mod folder name too long to load: ${tooLong.join(", ")}`,
        startedAt,
        `The game ignores mod folders longer than ${MAX_MOD_NAME_LENGTH} characters. ` +
          `Rename these and redeploy: ${tooLong.join(", ")}`,
      );
    }
    return passed(MOD_NAME_LENGTH_CHECK_ID, "Mod folder names are within the limit", startedAt);
  },
};

export const healthChecks: Array<types.IHealthCheck | types.IModHealthCheck> = [
  localModsEnabledCheck,
  modNameLengthCheck,
];

const notificationId = (checkId: string) => `w3-health-${checkId}`;

function showResultDetails(
  api: types.IExtensionApi,
  check: types.IHealthCheck | types.IModHealthCheck,
  result: types.IHealthCheckResult,
): void {
  api.showDialog("info", check.name, { text: result.details ?? result.message }, [
    { label: "Close" },
  ]);
}

async function applyFix(
  api: types.IExtensionApi,
  fix: types.HealthCheckFixFunction,
  dismiss: () => void,
): Promise<void> {
  try {
    await fix(api);
    dismiss();
    api.sendNotification({
      type: "success",
      message: "Setting applied. Restart the game for it to take effect.",
      displayMS: 5000,
    });
  } catch (err) {
    api.showErrorNotification("Failed to change the game setting", err);
  }
}

function notifyResult(
  api: types.IExtensionApi,
  check: types.IHealthCheck | types.IModHealthCheck,
  result: types.IHealthCheckResult | undefined,
): void {
  const id = notificationId(check.id);
  const failing = result?.status === "failed" || result?.status === "warning";
  if (!failing || selectors.activeGameId(api.getState()) !== GAME_ID) {
    api.dismissNotification(id);
    return;
  }

  const actions: types.INotificationAction[] = [
    { title: "More", action: () => showResultDetails(api, check, result) },
  ];
  const fix = types.isModHealthCheck(check) ? undefined : check.fix;
  if (fix !== undefined) {
    actions.unshift({ title: "Fix", action: (dismiss) => void applyFix(api, fix, dismiss) });
  }

  api.sendNotification({
    id,
    type: result.status === "failed" ? "error" : "warning",
    message: result.message,
    // Dismissable, but not permanently: the next run raises it again while the
    // condition holds.
    allowSuppress: false,
    actions,
  });
}

/**
 * The health check page only lists mod requirements, so a failing check on this
 * game reaches nobody. Mirror the results into notifications instead.
 */
export function registerHealthCheckNotifications(api: types.IExtensionApi): void {
  for (const check of healthChecks) {
    api.onStateChange(
      ["session", "healthCheck", "results", check.id],
      (_previous: types.IHealthCheckResult, current: types.IHealthCheckResult) =>
        notifyResult(api, check, current),
    );
  }

  // Results persist for the session, so without this the notification outlives
  // a switch to another game.
  api.events.on("gamemode-activated", (gameMode: string) => {
    if (gameMode !== GAME_ID) {
      healthChecks.forEach((check) => api.dismissNotification(notificationId(check.id)));
    }
  });
}
