import React, { type FormEvent, type RefObject, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

interface IViewNameModalProps {
  /** Whether it's showing. */
  isOpen: boolean;
  /** Renaming a view, by its name now; unset, it's making a new one. */
  renaming?: string;
  /** What a new view starts with and can change later, said above the name field. */
  createDescription: string;
  /** What renaming leaves as it is, said above the name field. */
  renameDescription: string;
  /** An example name, in the empty field. */
  placeholder: string;
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
  createDescription,
  renameDescription,
  placeholder,
  inputRef,
  onSubmit,
  onClose,
}: Omit<IViewNameModalProps, "isOpen"> & {
  inputRef: RefObject<HTMLInputElement | null>;
}) => {
  const { t } = useTranslation(["common"]);
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
        {renaming === undefined ? createDescription : renameDescription}
      </Typography>

      <TextField
        label={t("Name view")}
        placeholder={placeholder}
        ref={inputRef}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="mt-4 flex gap-2">
        <Button appearance="moderate" brand="neutral" className="flex-1" onClick={onClose}>
          {t("Cancel")}
        </Button>

        <Button className="flex-1" disabled={!trimmed} type="submit">
          {!renaming ? t("Create view") : t("Rename view")}
        </Button>
      </div>
    </form>
  );
};

/**
 * Asks for a name for a view of the user's own, for `ViewPicker`'s views: to make one, or to
 * rename one. The page says what its views hold.
 */
export const ViewNameModal = ({
  isOpen,
  renaming,
  createDescription,
  renameDescription,
  placeholder,
  onSubmit,
  onClose,
}: IViewNameModalProps) => {
  const { t } = useTranslation(["common"]);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Modal
      initialFocusRef={inputRef}
      isOpen={isOpen}
      size="sm"
      title={!renaming ? t("Create a new view") : t("Rename view")}
      onClose={onClose}
    >
      <ViewNameForm
        createDescription={createDescription}
        inputRef={inputRef}
        placeholder={placeholder}
        renameDescription={renameDescription}
        renaming={renaming}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
};
