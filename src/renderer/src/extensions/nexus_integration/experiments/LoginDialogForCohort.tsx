import React from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";

import { LoginDialog, type ILoginDialogProps } from "../components/login_dialog/LoginDialog";
import LegacyLoginDialog from "../views/LoginDialog";
import { fixLoginPromptCohort, useLoginPromptCohort } from "./loginPromptExperiment";

// The old dialog's props also list what `translate` injects, which it fills in itself.
const Legacy = LegacyLoginDialog as unknown as React.ComponentType<ILoginDialogProps>;

const isLoginPending = (state: IState): boolean =>
  (state.session["nexus"] as { oauthPending?: string } | undefined)?.oauthPending !== undefined;

/** STA-574: the `login-dialog` for every route, new for `test` and old for `control`. */
export const LoginDialogForCohort = (props: ILoginDialogProps) => {
  const liveCohort = useLoginPromptCohort();
  const isOpen = useSelector(isLoginPending) || props.visible;
  // Opening fixes the cohort (idempotent), so flags arriving mid-login can't swap the dialog.
  const cohort = isOpen ? fixLoginPromptCohort() : liveCohort;

  return cohort === "test" ? <LoginDialog {...props} /> : <Legacy {...props} />;
};
