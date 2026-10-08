import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

interface IDisableSharedModsModalProps {
  /** Whether it's showing. */
  isOpen: boolean;
  /** How many of the group's mods other collections have too. */
  sharedCount: number;
  /** The names of those other collections. */
  collections: string[];
  /** Disables the group's mods but the shared ones. */
  onKeepShared: () => void;
  /** Disables every mod in the group, the shared ones too. */
  onDisableAll: () => void;
  /** Leaves every mod as it is. */
  onClose: () => void;
}

/** Asks before disabling a group's mods that other collections rely on as well. */
export const DisableSharedModsModal = ({
  isOpen,
  sharedCount,
  collections,
  onKeepShared,
  onDisableAll,
  onClose,
}: IDisableSharedModsModalProps) => {
  const { t } = useTranslation(["common"]);
  const names = collections.join(", ");

  return (
    <Modal isOpen={isOpen} size="sm" title={t("Disable mods?")} onClose={onClose}>
      <div className="space-y-2">
        <Typography typographyType="body-sm">
          {sharedCount === 1
            ? t("1 mod is shared with: {{collections}}", { collections: names })
            : t("{{count}} mods are shared with: {{collections}}", {
                count: sharedCount,
                collections: names,
              })}
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t(
            "Disabling them may affect those collections. Keep the shared mods enabled to avoid issues.",
          )}
        </Typography>
      </div>

      <div className="mt-4 grid gap-y-2">
        <Button className="w-full" onClick={onKeepShared}>
          {t("Keep shared mods enabled")}
        </Button>

        <Button appearance="moderate" brand="neutral" className="w-full" onClick={onDisableAll}>
          {t("Disable all mods")}
        </Button>

        <Button appearance="weak" brand="neutral" className="w-full" onClick={onClose}>
          {t("Cancel")}
        </Button>
      </div>
    </Modal>
  );
};
