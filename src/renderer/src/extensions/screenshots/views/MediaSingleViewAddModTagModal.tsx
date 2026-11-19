import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";

import type { IModOption } from "../components/ModCombobox";
import ModCombobox from "../components/ModCombobox";
import ModFileSelector from "../components/ModFileSelector";
import ModTagIndicator from "../components/ModTagIndicator";

interface IMediaSingleViewAddTagModalProps {
  imagePath: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (mod: IModOption, comment?: string) => void;
  api: IExtensionApi;
  domainName: string;
  pendingCoords: { x: number; y: number };
}

export default function MediaSingleViewAddTagModal(props: IMediaSingleViewAddTagModalProps) {
  const { t } = useTranslation("media_page");

  const { isOpen, onClose } = props;

  return (
    <Modal
      showCloseButton
      isOpen={isOpen}
      size="sm"
      title={t("add_mod_tag::title")}
      onClose={onClose}
    >
      <AddModTagForm {...props} />
    </Modal>
  );
}

type IAddModTagFormProps = Omit<IMediaSingleViewAddTagModalProps, "isOpen">;

function AddModTagForm({
  imagePath,
  pendingCoords,
  api,
  domainName,
  onSave,
  onClose,
}: IAddModTagFormProps) {
  const [selectedMod, setSelectedMod] = useState<IModOption>();

  const saveBlocked: boolean = !selectedMod || !selectedMod.fileId;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative w-full">
        <img className="m-auto w-80" src={imagePath} />

        {pendingCoords && <ModTagIndicator x={pendingCoords.x} y={pendingCoords.y} />}
      </div>

      <section>
        <ModCombobox
          api={api}
          domainName={domainName}
          value={selectedMod}
          onChange={(v) => setSelectedMod(v)}
        />
      </section>

      {selectedMod && selectedMod.source === "nexus" && (
        <div>
          <ModFileSelector
            api={api}
            moduid={selectedMod.uid}
            onSelect={(v) => setSelectedMod({ ...selectedMod, fileId: Number(v.game_scoped_id) })}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button disabled={saveBlocked} onClick={() => onSave(selectedMod)}>
          Save
        </Button>

        <Button appearance="subdued" brand="neutral" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
