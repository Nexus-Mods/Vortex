import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { isValidFolderName } from "../util/newFolder";

export interface IManualInstallerFolderNameInputProps {
  /** What the input starts with, all of it selected. */
  initialName: string;
  /** The names the folder can't have, as the folders next to it have them. */
  takenNames: readonly string[];
  /** The name was dropped with Escape. */
  onCancel: () => void;
  /** The name was taken, trimmed: Enter, or the input lost focus with a name that works. */
  onCommit: (name: string) => void;
}

/** Names a folder in place of its name in a tree, as when renaming in a file browser. */
export const ManualInstallerFolderNameInput = ({
  initialName,
  takenNames,
  onCancel,
  onCommit,
}: IManualInstallerFolderNameInputProps) => {
  const { t } = useTranslation("mod_management");

  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  // Taking the name unmounts the input, which may report it losing focus once more.
  const isDone = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const isValid = isValidFolderName(name, takenNames);

  const commit = () => {
    if (!isDone.current) {
      isDone.current = true;
      onCommit(name.trim());
    }
  };

  const cancel = () => {
    if (!isDone.current) {
      isDone.current = true;
      onCancel();
    }
  };

  return (
    <input
      aria-invalid={!isValid}
      aria-label={t("manualInstaller::folderName")}
      className="min-w-0 grow rounded-sm border border-primary-strong bg-surface-low px-1 text-neutral-strong outline-none aria-invalid:border-danger-strong"
      data-testid="manual-installer-folder-name"
      ref={inputRef}
      value={name}
      onBlur={() => {
        // a name that doesn't work stays, with its error showing, until it's fixed or dropped
        if (isValid) {
          commit();
        }
      }}
      onChange={(event) => setName(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // the tree around the input would take the keys for its own, and the dialog Escape
        event.stopPropagation();

        if (event.key === "Enter") {
          event.preventDefault();

          if (isValid) {
            commit();
          }
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
};
