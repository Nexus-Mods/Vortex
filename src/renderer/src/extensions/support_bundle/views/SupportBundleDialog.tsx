import { mdiLoading, mdiOpenInNew } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { nxmDiscord } from "@/ui/icon-paths";

import { usePrepareSupportBundle } from "../hooks/usePrepareSupportBundle";

export interface ISupportBundleDialogProps {
  visible: boolean;
  onHide: () => void;
}

/** Where a user can hand the archive to the team. Same forum the feedback extension points at. */
export const SUPPORT_FORUM_URL =
  "https://forums.nexusmods.com/index.php?/forum/4306-vortex-support";
/** The #vortex channel in the Nexus Mods server. Same link the game extension READMEs use. */
export const SUPPORT_DISCORD_URL =
  "https://discord.com/channels/215154001799413770/408252140533055499";

export const SupportBundleDialog = ({ visible, onHide }: ISupportBundleDialogProps) => {
  const { t } = useTranslation(["support_bundle", "common"]);
  const { state, open, retry } = usePrepareSupportBundle(visible);

  const secondaryLabel =
    state.status === "preparing" ? t("dialog::buttons::cancel") : t("dialog::buttons::close");

  return (
    <Modal isOpen={visible} size="lg" title={t("dialog::title")} onClose={onHide}>
      {state.status === "failed" ? (
        <Alert data-testid="support-bundle-error" severity="danger">
          {`${t("dialog::failed")} ${state.message}`}
        </Alert>
      ) : (
        <>
          <Typography appearance="moderate" as="p">
            {t("dialog::intro")}
          </Typography>

          <Typography appearance="moderate" as="p" className="mt-2">
            {t("dialog::sendTo")}
          </Typography>

          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            <TypographyLink
              brand="primary"
              data-testid="support-bundle-link-forums"
              rightIconPath={mdiOpenInNew}
              onClick={() => window.api.shell.openUrl(SUPPORT_FORUM_URL)}
            >
              {t("dialog::links::forums")}
            </TypographyLink>

            <TypographyLink
              brand="primary"
              data-testid="support-bundle-link-discord"
              leftIconPath={nxmDiscord}
              rightIconPath={mdiOpenInNew}
              onClick={() => window.api.shell.openUrl(SUPPORT_DISCORD_URL)}
            >
              {t("dialog::links::discord")}
            </TypographyLink>
          </div>

          {state.status === "preparing" ? (
            <div className="mt-4 flex items-center gap-x-2" data-testid="support-bundle-status">
              <Icon className="animate-spin" path={mdiLoading} size="sm" />

              <Typography as="p" typographyType="body-sm">
                {state.percent === undefined
                  ? t("dialog::building")
                  : `${t("dialog::building")} ${state.percent}%`}
              </Typography>
            </div>
          ) : (
            <Typography as="p" className="mt-4" typographyType="body-sm">
              {t("dialog::archiveReady")}
            </Typography>
          )}
        </>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          appearance="subdued"
          brand="neutral"
          data-testid="support-bundle-cancel"
          onClick={onHide}
        >
          {secondaryLabel}
        </Button>

        {state.status === "failed" ? (
          <Button data-testid="support-bundle-retry" onClick={retry}>
            {t("dialog::buttons::tryAgain")}
          </Button>
        ) : (
          <Button
            data-testid="support-bundle-open"
            disabled={state.status !== "ready"}
            onClick={open}
          >
            {t("dialog::buttons::open")}
          </Button>
        )}
      </div>
    </Modal>
  );
};
