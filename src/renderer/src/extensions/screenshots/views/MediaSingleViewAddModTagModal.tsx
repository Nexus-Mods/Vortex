import React from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import ModCombobox from "../components/ModCombobox";
import type { IModResult } from "../util/searchMods";

interface IMediaSingleViewAddTagModalProps {
  imagePath: string;
  isOpen: boolean;
  onClose: () => void;
  setTag: (mod: IModResult, comment?: string) => void;
  api: IExtensionApi;
  domainName: string;
}

export default function MediaSingleViewAddTagModal({
  isOpen,
  onClose,
  imagePath,
  api,
  domainName,
}: IMediaSingleViewAddTagModalProps) {
  return (
    <Modal showCloseButton isOpen={isOpen} title={"TRANSLATION REQUIRED"} onClose={onClose}>
      <div className="flex flex-col gap-8" onClick={(e) => e.stopPropagation()}>
        <div>
          <img className="w-80" src={imagePath} />
        </div>

        <section>
          <ModCombobox api={api} domainName={domainName} value={null} onChange={() => {}} />
        </section>

        <div className="flex gap-2">
          <Button>Save</Button>

          <Button appearance="subdued" brand="neutral">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
