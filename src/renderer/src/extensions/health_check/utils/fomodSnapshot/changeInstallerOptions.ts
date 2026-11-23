import { UserCanceled } from "@vortex/shared/errors";

import type { IExtensionApi } from "../../../../types/IExtensionContext";
import type { IMod } from "../../../mod_management/types/IMod";

/**
 * Reopen a mod's installer with the choices it was installed with already selected.
 *
 * This is the same path the mod list's Reinstall uses: passing the recorded
 * `installerChoices` makes the installer preselect them and still show the dialog, so the
 * user changes the one option they care about rather than walking the whole installer
 * again. Nothing is downloaded and the archive is not needed - the install runs from the
 * download the mod was installed from.
 *
 * Resolves true when the install ran, false when the user cancelled it.
 */
export const changeInstallerOptions = async (api: IExtensionApi, mod: IMod): Promise<boolean> => {
  const archiveId = mod.archiveId;
  if (archiveId === undefined) {
    // A mod installed from a file rather than a download has no archive to reinstall from.
    api.showErrorNotification(
      "Cannot change options",
      "This mod was not installed from a download, so its installer cannot be reopened.",
      { allowReport: false },
    );
    return false;
  }

  const choices = mod.attributes?.installerChoices;

  return new Promise<boolean>((resolve) => {
    api.events.emit(
      "start-install-download",
      archiveId,
      { choices, allowAutoEnable: false },
      (err: Error | null) => {
        if (err !== null) {
          // A cancel is a decision, not a failure; anything else is worth reporting.
          if (!(err instanceof UserCanceled)) {
            api.showErrorNotification("Failed to reopen the installer", err, {
              allowReport: false,
            });
          }
          resolve(false);
          return;
        }
        resolve(true);
      },
    );
  });
};
