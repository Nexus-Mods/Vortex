import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

interface IDeleteViewModalProps {
  /** The name of the view being deleted; unset, it isn't showing. */
  name?: string;
  /** What deleting it removes, and what it leaves, said in full with its name. */
  description: string;
  /** Deletes it. */
  onDelete: () => void;
  /** Keeps it. */
  onClose: () => void;
}

/**
 * Asks before deleting a view of the user's own, for `ViewPicker`'s views, which can't be brought
 * back. The page says what deleting it removes.
 */
export const DeleteViewModal = ({
  name,
  description,
  onDelete,
  onClose,
}: IDeleteViewModalProps) => {
  const { t } = useTranslation(["common"]);

  return (
    <Modal isOpen={name !== undefined} size="sm" title={t("Delete view")} onClose={onClose}>
      <Typography appearance="subdued" typographyType="body-sm">
        {description}
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
