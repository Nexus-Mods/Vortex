import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";
import type { TFunction } from "i18next";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { INotificationAction } from "../../../types/INotification";
import type { IUnavailableReason } from "../types/IDeploymentMethod";

/**
 * Why a deployment method can't deploy into a mod type's folder, given the error checking it
 * for write access threw: either the folder doesn't exist or the user account may not write to it.
 */
export function outputDirectoryUnavailable(err: unknown, modPath: string): IUnavailableReason {
  if (getErrorCode(err) === "ENOENT") {
    return {
      description: (t) =>
        t('Output directory "{{modPath}}" doesn\'t exist.', { replace: { modPath } }),
      order: 3,
      solution: (t) =>
        t(
          "This directory is usually created when the game is set up. If it's still missing, " +
            "create it yourself or report the problem to the author of the game's extension.",
        ),
    };
  }
  return {
    description: (t) =>
      t('Can\'t write to output directory "{{modPath}}".', { replace: { modPath } }),
    order: 3,
    solution: (t) =>
      t(
        "To resolve this problem, the current user account needs to be given " +
          'write permission to "{{modPath}}".',
        { replace: { modPath } },
      ),
  };
}

/** The reason a deployment method is unavailable, followed by how to solve it if it says. */
export function unavailableReasonText(t: TFunction, reason: IUnavailableReason): string {
  const description = reason.description(t);
  const solution = reason.solution?.(t);
  return solution ? `${description}\n\n${solution}` : description;
}

/** A notification button applying the reason's automatic fix; none if it has no fix. */
export function unavailableReasonActions(
  api: IExtensionApi,
  reason: IUnavailableReason,
): INotificationAction[] {
  if (reason.fixCallback === undefined) {
    return [];
  }
  return [
    {
      title: "Apply Fix",
      action: (dismiss) => {
        dismiss();
        // a fix that only navigates somewhere may never settle, so it's not awaited
        Promise.resolve(reason.fixCallback(api)).catch((err) => {
          log("warn", "failed to apply deployment fix", getErrorMessageOrDefault(err));
        });
      },
    },
  ];
}
