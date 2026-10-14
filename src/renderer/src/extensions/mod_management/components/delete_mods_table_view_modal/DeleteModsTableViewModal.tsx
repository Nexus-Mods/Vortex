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
  const { t } = useTranslation(["common"]);

  return (
    <Modal isOpen={name !== undefined} size="sm" title={t("Delete view")} onClose={onClose}>
      <Typography appearance="subdued" typographyType="body-sm">
        {t(
          'Are you sure you want to delete "{{name}}"? This won\'t delete any mods, but the view and its customisations will be permanently removed.',
          { name },
        )}
      </Typography>

      <div className="mt-4 flex gap-2">
        <Button appearance="moderate" brand="neutral" className="flex-1" onClick={onClose}>
          {t("Cancel")}
        </Button>

        <Button brand="danger" className="flex-1" onClick={onDelete}>
          {t("Delete view")}
        </Button>
      </div>
    </Modal>
  );
};
