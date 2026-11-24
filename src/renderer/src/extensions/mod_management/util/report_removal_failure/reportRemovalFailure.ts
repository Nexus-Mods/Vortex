import { VortexError } from "@vortex/shared/errors";

import type { IExtensionApi } from "@/types/IExtensionContext";

/**
 * Tells the user why mods couldn't be removed, for Remove and Uninstall alike: nothing for a
 * cancel, a warning for a removal that can't go ahead, and an error for anything else.
 */
export const reportRemovalFailure = (api: IExtensionApi, title: string, err: unknown): void => {
  const isVortexError = err instanceof VortexError;

  if (isVortexError && err.data.kind === "user-canceled") {
    return;
  }

  if (isVortexError && err.data.kind === "process-canceled") {
    api.sendNotification({ id: "cant-remove-mod", type: "warning", title, message: err.message });
    return;
  }

  // A corrupt manifest says it isn't worth reporting, as the legacy table heeded.
  api.showErrorNotification(title, err, {
    allowReport: (err as { allowReport?: boolean })?.allowReport !== false,
  });
};
