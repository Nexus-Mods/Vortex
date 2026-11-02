import React, { type FormEvent, type RefObject, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

interface IModsTableViewNameModalProps {
  /** Whether it's showing. */
  isOpen: boolean;
  /** Renaming a view, by its name now; unset, it's making a new one. */
  renaming?: string;
  /** Takes the name given, trimmed. */
  onSubmit: (name: string) => void;
  /** Leaves without one. */
  onClose: () => void;
}

/**
 * The name field and actions. Its own component inside the modal, whose content mounts each
 * time it opens, so the name starts from the view being renamed, or from nothing, every time.
 */
const ViewNameForm = ({
  renaming,
  inputRef,
  onSubmit,
  onClose,
}: Omit<IModsTableViewNameModalProps, "isOpen"> & {
  inputRef: RefObject<HTMLInputElement | null>;
}) => {
  const { t } = useTranslation("mod_management");
  const [name, setName] = useState(renaming ?? "");
  const trimmed = name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (trimmed !== "") {
      onSubmit(trimmed);
    }
  };

  return (
    <form onSubmit={submit}>
      <Typography appearance="subdued" className="mb-4" typographyType="body-sm">
        {renaming === undefined
          ? t("modsTable::viewName::createIntro")
          : t("modsTable::viewName::renameIntro")}
      </Typography>

      <TextField
        label={t("modsTable::viewName::label")}
        placeholder={t("modsTable::viewName::placeholder")}
        ref={inputRef}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="mt-4 flex gap-2">
        <Button
          appearance="moderate"
          brand="neutral"
          className="flex-1"
          data-testid="view-name-cancel"
          onClick={onClose}
        >
          {t("modsTable::cancel")}
        </Button>

        <Button className="flex-1" data-testid="view-name-submit" disabled={!trimmed} type="submit">
          {!renaming ? t("modsTable::viewName::create") : t("modsTable::viewName::rename")}
        </Button>
      </div>
    </form>
  );
};

/** Asks for a name for a view of the user's own: to make one, or to rename one. */
export const ModsTableViewNameModal = ({
  isOpen,
  renaming,
  onSubmit,
  onClose,
}: IModsTableViewNameModalProps) => {
  const { t } = useTranslation("mod_management");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Modal
      initialFocusRef={inputRef}
      isOpen={isOpen}
      size="sm"
      title={
        !renaming ? t("modsTable::viewName::createTitle") : t("modsTable::viewName::renameTitle")
      }
      onClose={onClose}
    >
      <ViewNameForm inputRef={inputRef} renaming={renaming} onClose={onClose} onSubmit={onSubmit} />
    </Modal>
  );
};
