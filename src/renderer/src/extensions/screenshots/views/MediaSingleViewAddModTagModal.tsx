import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";

import type { IModOption } from "../components/ModCombobox";
import ModCombobox from "../components/ModCombobox";
import ModFileSelector from "../components/ModFileSelector";
import ModTagIndicator from "../components/ModTagIndicator";
import type { IModResult } from "../util/searchMods";

interface IMediaSingleViewAddTagModalProps {
  imagePath: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (mod: IModResult, comment?: string) => void;
  api: IExtensionApi;
  domainName: string;
  pendingCoords: { x: number; y: number };
}

export default function MediaSingleViewAddTagModal({
  isOpen,
  onClose,
  imagePath,
  api,
  domainName,
  pendingCoords,
}: IMediaSingleViewAddTagModalProps) {
  const { t } = useTranslation("media_page");

  const [selectedMod, setSelectedMod] = useState<IModOption>();

  return (
    <Modal
      showCloseButton
      isOpen={isOpen}
      size="sm"
      title={t("add_mod_tag::title")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-6">
        <div className="w-full">
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
            <ModFileSelector api={api} moduid={selectedMod.uid} onSelect={() => {}} />
          </div>
        )}

        <div className="flex gap-2">
          <Button disabled={!selectedMod}>Save</Button>

          <Button appearance="subdued" brand="neutral" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
