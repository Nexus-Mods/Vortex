import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { suppressNotification } from "@/actions";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { ModalPanel, ModalWrapper } from "@/ui/components/modal/Modal";
import { useNexusLogin } from "@/views/components/Header/premium/useNexusLogin.hook";

import { LoginModalHeader } from "../login_dialog/LoginModalHeader";

/** The dialog id, and the id "Don't show this again" is remembered under. */
export const LOGIN_PROMPT_ID = "login-prompt";

export interface ILoginPromptProps {
  visible: boolean;
  onHide: () => void;
}

/**
 * Invites a logged-out user to log in when Vortex starts. Logging in hands over to the
 * `login-dialog`, which shows the progress and the fallbacks. Ticking "Don't show this again"
 * and answering, with "No, thanks" or logging in, stops it appearing at future startups.
 */
const ignoreDismiss = () => undefined;

export const LoginPrompt = ({ visible, onHide }: ILoginPromptProps) => {
  const { t } = useTranslation(["nexus_integration"]);
  const dispatch = useDispatch();
  const login = useNexusLogin();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const rememberChoice = () => {
    if (dontShowAgain) {
      dispatch(suppressNotification(LOGIN_PROMPT_ID, true));
    }
  };

  const onNoThanks = () => {
    rememberChoice();
    onHide();
  };

  // The login dialog takes over, showing the progress, once the login is waiting on the website.
  const onLogin = () => {
    rememberChoice();
    onHide();
    login();
  };

  return (
    // Only closes with an answer, so "Don't show this again" is never left undecided.
    <ModalWrapper isOpen={visible} onClose={ignoreDismiss}>
      <ModalPanel className="p-6" showCloseButton={false}>
        <div className="flex flex-col items-center gap-y-9 text-center">
          <LoginModalHeader
            description={t("login_prompt::description")}
            title={t("login_prompt::title")}
          />

          <div className="flex flex-col items-center gap-y-6">
            <CheckboxField
              checked={dontShowAgain}
              data-testid="login-prompt-dont-show-again"
              label={t("login_prompt::dont_show_again")}
              onChange={setDontShowAgain}
            />

            <div className="flex gap-x-3">
              <Button
                appearance="subdued"
                brand="neutral"
                data-testid="login-prompt-no-thanks"
                onClick={onNoThanks}
              >
                {t("login_prompt::no_thanks")}
              </Button>

              <Button data-testid="login-prompt-login" onClick={onLogin}>
                {t("login_prompt::login")}
              </Button>
            </div>
          </div>
        </div>
      </ModalPanel>
    </ModalWrapper>
  );
};
