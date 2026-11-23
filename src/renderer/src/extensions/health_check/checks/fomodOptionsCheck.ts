import { unknownToError } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IHealthCheck, IHealthCheckResult } from "../../../types/IHealthCheck";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
} from "../../../types/IHealthCheck";
import { activeGameId } from "../../../util/selectors";
import { OPTION_SNAPSHOT_ATTRIBUTE } from "../../installer_fomod_shared/types/snapshot";
import type { IEvaluationContext } from "../../installer_fomod_shared/utils/evaluateSnapshot";
import {
  findNewlyUsable,
  type INewlyUsableOption,
  replayFlags,
} from "../../installer_fomod_shared/utils/findNewlyUsable";
import { normaliseSnapshot } from "../../installer_fomod_shared/utils/normaliseSnapshot";
import { pluginStateLookup, pluginsShippedBy } from "../utils/fomodSnapshot/pluginState";

export const FOMOD_OPTIONS_CHECK_ID = "check-fomod-option-availability";

/** One mod that has options which have become selectable since it was installed. */
export interface IFomodOptionIssue {
  modId: string;
  modName: string;
  /** True when the mod is managed by a collection, which changes what a fix may do. */
  collectionManaged: boolean;
  options: INewlyUsableOption[];
}

export interface IFomodOptionsCheckMetadata {
  issues: IFomodOptionIssue[];
  /** How many installed mods carried a snapshot and were examined. */
  modsChecked: number;
  /** Installed mods with no snapshot, which cannot be checked until they are reinstalled. */
  modsWithoutSnapshot: number;
}

const createResult = (
  startTime: number,
  status: IHealthCheckResult["status"],
  severity: HealthCheckSeverity,
  message: string,
  metadata?: IFomodOptionsCheckMetadata,
  details?: string,
): IHealthCheckResult => ({
  checkId: FOMOD_OPTIONS_CHECK_ID,
  status,
  severity,
  message,
  details,
  metadata,
  executionTime: Date.now() - startTime,
  timestamp: new Date(),
});

/**
 * Find options that were unusable when a mod was installed and are usable now.
 *
 * Reads the snapshot each fomod install records on the mod, re-evaluates its conditions
 * against the live plugin list, and reports the options that have crossed from unusable to
 * usable without the user selecting them. Environment conditions are undecidable from a
 * snapshot, so an option gated on one is never reported - guessing there would raise a
 * false alarm about an option the installer was happy with.
 */
export const checkFomodOptions = async (
  api: IExtensionApi,
  signal?: AbortSignal,
): Promise<IHealthCheckResult> => {
  const startTime = Date.now();

  try {
    const state = api.getState();
    const gameId = activeGameId(state);
    if (gameId === undefined) {
      return createResult(startTime, "passed", HealthCheckSeverity.Info, "No game active");
    }

    const mods = state.persistent.mods[gameId] ?? {};
    const pluginState = pluginStateLookup(state);

    const issues: IFomodOptionIssue[] = [];
    let modsChecked = 0;
    let modsWithoutSnapshot = 0;

    for (const [modId, mod] of Object.entries(mods)) {
      if (signal?.aborted) {
        break;
      }

      const attributes = mod.attributes ?? {};
      const snapshot = normaliseSnapshot(attributes[OPTION_SNAPSHOT_ATTRIBUTE]);
      if (snapshot === undefined) {
        // An install from an installer that predates the snapshot, or a mod with no
        // fomod at all. Neither can be checked, and neither is an error.
        if (attributes.installerChoices !== undefined) {
          modsWithoutSnapshot++;
        }
        continue;
      }
      modsChecked++;

      const flags = replayFlags(snapshot);
      const shipped = pluginsShippedBy(
        (attributes.fileList as { path: string }[] | undefined)?.map((entry) => entry.path),
      );

      const context: IEvaluationContext = {
        pluginState,
        flagValue: (name) => flags.get(name),
      };

      const newlyUsable = findNewlyUsable(snapshot, context).filter(
        // An option waiting on the mod's own plugin is not a gap the user can close.
        (option) => !shipped.has(option.reason.toLowerCase()),
      );

      if (newlyUsable.length === 0) {
        continue;
      }

      issues.push({
        modId,
        modName: attributes.customFileName ?? attributes.modName ?? modId,
        collectionManaged: attributes.referenceTag !== undefined,
        options: newlyUsable,
      });
    }

    const metadata: IFomodOptionsCheckMetadata = { issues, modsChecked, modsWithoutSnapshot };

    if (issues.length === 0) {
      return createResult(
        startTime,
        "passed",
        HealthCheckSeverity.Info,
        `No newly available installer options (checked ${modsChecked} mods)`,
        metadata,
      );
    }

    const total = issues.reduce((sum, issue) => sum + issue.options.length, 0);
    return createResult(
      startTime,
      "warning",
      HealthCheckSeverity.Warning,
      `${total} installer option${total === 1 ? "" : "s"} available across ${issues.length} mod${issues.length === 1 ? "" : "s"}`,
      metadata,
    );
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    log("error", "Failed to check fomod option availability", unknownToError(error));
    return createResult(
      startTime,
      "error",
      HealthCheckSeverity.Error,
      "Failed to check installer options",
    );
  }
};

export const fomodOptionsHealthCheck: IHealthCheck = {
  id: FOMOD_OPTIONS_CHECK_ID,
  name: "Installer Options",
  description:
    "Reports installer options that were unavailable when a mod was installed and are available now",
  category: HealthCheckCategory.Mods,
  severity: HealthCheckSeverity.Info,
  // ModsChanged is the trigger that fires when the plugin list moves: the plugin-list
  // watcher in api/triggers.ts schedules it, because an option's availability turns on
  // which plugins are present and active. PluginsChanged is deliberately not listed -
  // nothing dispatches it on this path, and a trigger that never fires is a lie.
  triggers: [
    HealthCheckTrigger.ModsChanged,
    HealthCheckTrigger.Manual,
    HealthCheckTrigger.ProfileChanged,
    HealthCheckTrigger.GameChanged,
  ],
  check: checkFomodOptions,
};
