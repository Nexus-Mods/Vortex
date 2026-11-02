import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

interface IDeleteModsTableViewModalProps {
  /** The name of the view being deleted; unset, it isn't showing. */
  name?: string;
  /** Deletes it. */
  onDelete: () => void;
  /** Keeps it. */
  onClose: () => void;
}

/** Asks before deleting a view of the user's own, which can't be brought back. */
export const DeleteModsTableViewModal = ({
  name,
  onDelete,
  onClose,
}: IDeleteModsTableViewModalProps) => {
  const { t } = useTranslation("mod_management");

  return (
    <Modal
      isOpen={name !== undefined}
      size="sm"
      title={t("modsTable::deleteView::title")}
      onClose={onClose}
    >
      <Typography appearance="subdued" typographyType="body-sm">
        {t("modsTable::deleteView::body", { name })}
      </Typography>

      <div className="mt-4 flex gap-2">
        <Button appearance="moderate" brand="neutral" className="flex-1" onClick={onClose}>
          {t("modsTable::cancel")}
        </Button>

        <Button brand="danger" className="flex-1" onClick={onDelete}>
          {t("modsTable::deleteView::confirm")}
        </Button>
      </div>
    </Modal>
  );
};
