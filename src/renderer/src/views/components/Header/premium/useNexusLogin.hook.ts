import { useCallback } from "react";
import { useDispatch } from "react-redux";

import { setDialogVisible } from "@/actions";
import { useExtensionContext } from "@/ExtensionProvider";
import { fixLoginPromptCohort } from "@/extensions/nexus_integration/experiments/loginPromptExperiment";
import {
  type LoginSource,
  noteLoginCompleted,
} from "@/extensions/nexus_integration/hooks/loginTracker";

import { UserCanceled } from "../../../../util/CustomErrors";

/**
 * Starts the Nexus Mods login flow. The login dialog opens on its own once the login is waiting on
 * the website, so it goes straight to the progress view. Cancelling is a choice rather than a
 * fault, so only a real failure is reported. `source` says which button started it, for analytics.
 */
export const useNexusLogin = (source: LoginSource): (() => void) => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  return useCallback(() => {
    // STA-574: `control` keeps the old flow, which opens the old dialog first.
    if (fixLoginPromptCohort() === "control") {
      dispatch(setDialogVisible("login-dialog"));
    }

    api.events.emit("request-nexus-login", (err: Error) => {
      if (err == null) {
        noteLoginCompleted(api, source);
      } else if (!(err instanceof UserCanceled)) {
        api.showErrorNotification?.("Login Failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      }
    });
  }, [api, dispatch, source]);
};
