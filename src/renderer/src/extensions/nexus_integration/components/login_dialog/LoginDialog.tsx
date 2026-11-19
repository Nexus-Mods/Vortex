import { getErrorMessageOrDefault } from "@vortex/shared";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { TextAreaField } from "@/ui/components/form/text_area_field/TextAreaField";
import { Icon } from "@/ui/components/icon/Icon";
import { ModalPanel, ModalWrapper } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { log } from "@/util/log";
import { useNexusLogin } from "@/views/components/Header/premium/useNexusLogin.hook";

import { setOauthPending } from "../../actions/session";
import { CopyField } from "./CopyField";
import { LoginModalHeader } from "./LoginModalHeader";

export interface ILoginDialogProps {
  visible: boolean;
  onHide: () => void;
  /** Ends the login that's waiting on the website, telling whoever asked for it that it was cancelled. */
  onCancelLogin: () => void;
  /** Completes the login with the code from a pasted token. */
  onReceiveCode: (code: string, state?: string) => Promise<void>;
}

/** The token the website shows is base64 JSON holding the code and state the redirect would carry. */
const decodeToken = (token: string): { authorization_code: string; state?: string } =>
  JSON.parse(Buffer.from(token.replace(/\s/g, ""), "base64").toString());

// `session.nexus` is registered by this extension, so it isn't on the core state type.
const oauthPendingSelector = (state: IState): string | undefined =>
  (state.session["nexus"] as { oauthPending?: string } | undefined)?.oauthPending || undefined;

const ignoreOutsideClick = () => undefined;

const Spinner = () => (
  <Icon
    className="animate-spin text-primary-moderate"
    data-testid="login-spinner"
    name="progress_activity"
    size="xl"
  />
);

/**
 * Logs the user in to Nexus Mods. While a login waits on the website it shows its progress, the
 * address to open by hand and, as a last resort, a token to paste. Opened without a login under way
 * (by `ensureLoggedIn`), it offers one.
 */
export const LoginDialog = ({
  visible,
  onHide,
  onCancelLogin,
  onReceiveCode,
}: ILoginDialogProps) => {
  const { t } = useTranslation(["nexus_integration"]);
  const dispatch = useDispatch();
  const login = useNexusLogin("login_dialog");
  const oauthPending = useSelector(oauthPendingSelector);
  const isOpen = visible || oauthPending !== undefined;

  const [withToken, setWithToken] = useState(false);
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState<string | undefined>(undefined);

  // Each opening starts on the regular view with an empty token.
  useEffect(() => {
    if (isOpen) {
      setWithToken(false);
      setToken("");
      setTokenError(undefined);
    }
  }, [isOpen]);

  const close = () => {
    dispatch(setOauthPending(undefined));
    onCancelLogin();
    onHide();
  };

  // Escape cancels, as in the old dialog, but a click outside doesn't: clicking Vortex to bring it
  // forward mid-login would otherwise cancel the login.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const applyToken = async () => {
    let decoded: ReturnType<typeof decodeToken>;
    try {
      decoded = decodeToken(token);
    } catch (err: unknown) {
      log("warn", "login token could not be read", { error: err });
      setTokenError(t("login_dialog::token::invalid"));
      return;
    }

    try {
      await onReceiveCode(decoded.authorization_code, decoded.state);
      onHide();
    } catch (err: unknown) {
      log("warn", "login with token failed", { error: err });
      setTokenError(t("login_dialog::token::failed", { error: getErrorMessageOrDefault(err) }));
    }
  };

  const renderStart = () => (
    <>
      <LoginModalHeader
        description={t("login_prompt::description")}
        title={t("login_prompt::title")}
      />

      <Button data-testid="login-dialog-login" onClick={login}>
        {t("login_prompt::login")}
      </Button>
    </>
  );

  const renderProgress = (url: string) => (
    <>
      <LoginModalHeader
        description={t("login_dialog::progress::description")}
        title={t("login_dialog::progress::title")}
      />

      <Spinner />

      <div className="w-full space-y-2">
        <Typography appearance="subdued" typographyType="body-xs">
          {t("login_dialog::progress::copy_address")}
        </Typography>

        <CopyField label={t("login_dialog::address")} value={url} />

        <Typography appearance="subdued" typographyType="body-xs">
          {t("login_dialog::progress::still_not_working")}{" "}
          <button
            className="cursor-pointer underline hover:text-neutral-moderate"
            data-testid="login-with-token"
            type="button"
            onClick={() => setWithToken(true)}
          >
            {t("login_dialog::progress::login_with_token")}
          </button>
        </Typography>
      </div>
    </>
  );

  const renderToken = () => (
    <>
      <LoginModalHeader
        description={t("login_dialog::token::description")}
        title={t("login_dialog::token::title")}
      />

      <div className="w-full space-y-4 text-left">
        {oauthPending !== undefined && (
          <div className="space-y-2">
            <Typography appearance="subdued" typographyType="body-sm">
              {t("login_dialog::token::step_open")}
            </Typography>

            <CopyField label={t("login_dialog::address")} value={oauthPending} />
          </div>
        )}

        <TextAreaField
          data-testid="login-token-input"
          errorMessage={tokenError}
          label={t("login_dialog::token::step_paste")}
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setTokenError(undefined);
          }}
        />
      </div>

      <Button data-testid="login-token-save" disabled={token.trim() === ""} onClick={applyToken}>
        {t("login_dialog::token::save")}
      </Button>
    </>
  );

  const renderView = () => {
    if (withToken) {
      return renderToken();
    }
    return oauthPending === undefined ? renderStart() : renderProgress(oauthPending);
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={ignoreOutsideClick}>
      <ModalPanel className="p-6" onClose={close}>
        <div className="mt-6 flex flex-col items-center gap-y-9 text-center">{renderView()}</div>
      </ModalPanel>
    </ModalWrapper>
  );
};
