import { mdiCheck, mdiDiamondStone } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../../../../tailwind/components/modal";
import { Button } from "../../../../tailwind/components/next/button";
import { Icon } from "../../../../tailwind/components/next/icon";
import { Typography } from "../../../../tailwind/components/next/typography";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon
      className="mt-0.5 shrink-0 text-premium-strong"
      path={mdiCheck}
      size="xs"
    />

    {children}
  </li>
);

export const PremiumModal = ({
  isOpen,
  onClose,
  onDownload,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  return (
    <Modal isOpen={isOpen} title={t("premium::modal::title")} onClose={onClose}>
      <Typography
        appearance="subdued"
        as="div"
        className="space-y-2"
        typographyType="body-sm"
      >
        <p>{t("premium::modal::description")}</p>

        <p>{t("premium::modal::benefits_title")}</p>

        <ul className="space-y-2">
          <ListItem>{t("premium::modal::benefits::downloads")}</ListItem>

          <ListItem>{t("premium::modal::benefits::collections")}</ListItem>

          <ListItem>{t("premium::modal::benefits::speed")}</ListItem>

          <ListItem>{t("premium::modal::benefits::ad_free")}</ListItem>
        </ul>
      </Typography>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <Button
          buttonType="tertiary"
          className="w-full"
          filled="weak"
          size="sm"
          onClick={onDownload}
        >
          {t("premium::modal::buttons::download")}
        </Button>

        <Button
          buttonType="premium"
          className="w-full"
          leftIconPath={mdiDiamondStone}
          size="sm"
          onClick={onClose}
        >
          {t("premium::modal::buttons::premium")}
        </Button>
      </div>
    </Modal>
  );
};
