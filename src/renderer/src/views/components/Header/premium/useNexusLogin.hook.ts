import { useCallback } from "react";

import { useExtensionContext } from "@/ExtensionProvider";

import { UserCanceled } from "../../../../util/CustomErrors";

/**
 * Starts the Nexus Mods login flow. The login dialog opens on its own once the login is waiting on
 * the website, so it goes straight to the progress view. Cancelling is a choice rather than a
 * fault, so only a real failure is reported.
 */
export const useNexusLogin = (): (() => void) => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  return useCallback(() => {
    api.events.emit("request-nexus-login", (err: Error) => {
      if (err != null && !(err instanceof UserCanceled)) {
        api.showErrorNotification?.("Login Failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      }
    });
  }, [api]);
};
