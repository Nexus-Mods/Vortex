import { setDialogVisible } from "@/actions";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { fixLoginPromptCohort } from "../../experiments/loginPromptExperiment";
import { isLoggedIn } from "../../selectors";
import { LOGIN_PROMPT_ID } from "./LoginPrompt";

const isSuppressed = (state: IState): boolean =>
  state.settings.notifications?.suppress?.[LOGIN_PROMPT_ID] === true;

// Registered dialogs and `api.showDialog` ones are kept separately.
const isAnyDialogOpen = (state: IState): boolean =>
  state.session.base.visibleDialog !== undefined ||
  (state.session.notifications?.dialogs?.length ?? 0) > 0;

/**
 * Shows the login prompt once the UI is up, unless the user is logged in, ticked
 * "Don't show this again", or another dialog is already open.
 */
export const showLoginPromptOnStartup = async (api: IExtensionApi): Promise<void> => {
  if (isLoggedIn(api.getState()) || isSuppressed(api.getState())) {
    return;
  }

  await api.awaitUI();

  // Re-read: the user may have logged in, or something else opened a dialog, while the UI loaded.
  const state = api.getState();
  if (isLoggedIn(state) || isAnyDialogOpen(state)) {
    return;
  }

  // STA-574: only the `test` cohort sees it.
  if (fixLoginPromptCohort() !== "test") {
    return;
  }

  api.store.dispatch(setDialogVisible(LOGIN_PROMPT_ID));
};
