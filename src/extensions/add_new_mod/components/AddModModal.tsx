import React, { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../../../tailwind/components/modal";
import { Typography } from "../../../tailwind/components/next/typography";
import { Button } from "../../../tailwind/components/next/button";
import { Input } from "../../../tailwind/components/next/form/input";

interface AddModModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (modName: string) => void;
}

/**
 * Modal dialog for creating a new empty mod
 * Uses the modern Tailwind/Headless UI styling
 */
export const AddModModal = ({
  isOpen,
  onClose,
  onConfirm,
}: AddModModalProps) => {
  const { t } = useTranslation(["common"]);
  const [modName, setModName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset mod name when dialog opens
  useEffect(() => {
    if (isOpen) {
      // This is intentional - reset state when modal opens
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setModName("");
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    const trimmedName = modName.trim();
    if (trimmedName) {
      onConfirm(trimmedName);
      setModName("");
      onClose();
    }
  }, [modName, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && modName.trim()) {
        handleConfirm();
      }
    },
    [handleConfirm, modName],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setModName(e.target.value);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      title={t("Create New Mod")}
      onClose={onClose}
      initialFocusRef={inputRef}
    >
      <Typography
        as="div"
        appearance="subdued"
        className="mb-4"
        typographyType="body-sm"
      >
        {t(
          "Enter a name for your new mod. This will create an empty mod folder in your staging directory where you can add files manually.",
        )}
      </Typography>

      <Input
        id="add-mod-name-input"
        ref={inputRef}
        label={t("Mod Name")}
        value={modName}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t("My Custom Mod")}
        className="w-full"
      />

      <div className="grid grid-cols-2 gap-x-2 mt-4">
        <Button
          buttonType="tertiary"
          className="w-full"
          filled="weak"
          size="sm"
          onClick={onClose}
        >
          {t("Cancel")}
        </Button>
        <Button
          buttonType="primary"
          className="w-full"
          size="sm"
          onClick={handleConfirm}
          disabled={!modName.trim()}
        >
          {t("Create Mod")}
        </Button>
      </div>
    </Modal>
  );
};

export default AddModModal;
