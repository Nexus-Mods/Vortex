import { useCallback } from "react";
import { useDispatch } from "react-redux";

import { setDialogVisible } from "@/actions";
import { useExtensionContext } from "@/ExtensionProvider";

import { UserCanceled } from "../../../../util/CustomErrors";

/**
 * Starts the Nexus Mods login flow: shows the login dialog and asks the nexus
 * integration to authenticate. Cancelling is a choice rather than a fault, so only
 * a real failure is reported.
 */
export const useNexusLogin = (): (() => void) => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  return useCallback(() => {
    dispatch(setDialogVisible("login-dialog"));
    api.events.emit("request-nexus-login", (err: Error) => {
      if (err != null && !(err instanceof UserCanceled)) {
        api.showErrorNotification?.("Login Failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      }
    });
  }, [api, dispatch]);
};
