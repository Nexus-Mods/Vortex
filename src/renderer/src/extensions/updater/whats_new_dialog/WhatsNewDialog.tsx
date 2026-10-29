import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Html } from "@/ui/components/prose/html/Html";
import { PlainText } from "@/ui/components/prose/plain_text/PlainText";

export const WHATS_NEW_DIALOG_ID = "new-update-changelog-dialog";

interface IProps {
  visible: boolean;
  onHide: () => void;
  /** Runs the update's action, as `whatsNew.action` names it. */
  onConfirm: () => void;
}

/**
 * What's New in a Vortex version: the release notes from our own GitHub releases, so media is
 * allowed. Shown for an update on offer, with the button that gets it, or after an update, with
 * none.
 */
export const WhatsNewDialog = ({ visible, onHide, onConfirm }: IProps) => {
  const { t } = useTranslation(["common"]);
  const whatsNew = useSelector((state: IState) => state.session.updater.whatsNew);

  if (whatsNew === undefined) {
    return null;
  }

  const { action, notes, version } = whatsNew;

  const confirm = () => {
    onHide();
    onConfirm();
  };

  return (
    <Modal
      isOpen={visible}
      showCloseButton={false}
      size="lg"
      title={t("What's New in {{version}}", { replace: { version } })}
      onClose={onHide}
    >
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {notes ? (
          <Html allowMedia html={notes} size="sm" />
        ) : (
          <PlainText
            size="sm"
            text={
              action
                ? t("A new version of Vortex is available.")
                : t("No release notes are available for this update.")
            }
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          // Alone, Close is the way out and so the strong neutral button; beside an update's
          // button it is the quieter alternative.
          appearance={action === undefined ? "strong" : "moderate"}
          brand="neutral"
          data-testid="whats-new-close"
          onClick={onHide}
        >
          {t("Close")}
        </Button>

        {action !== undefined && (
          <Button data-testid="whats-new-confirm" onClick={confirm}>
            {action === "restart" ? t("Restart Now") : t("Download")}
          </Button>
        )}
      </div>
    </Modal>
  );
};
