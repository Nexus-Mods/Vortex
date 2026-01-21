import React, { type ReactNode } from "react";
import { Modal } from "../../../../tailwind/components/modal";
import { Typography } from "../../../../tailwind/components/next/typography";
import { Icon } from "../../../../tailwind/components/next/icon";
import { Button } from "../../../../tailwind/components/next/button";
import { useTranslation } from "react-i18next";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon
      className="text-premium-strong mt-0.5 shrink-0"
      path="mdiCheck"
      size="xs"
    />

    {children}
  </li>
);

export const PremiumModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  return (
    <Modal isOpen={isOpen} title={t("premium::modal::title")} onClose={onClose}>
      <Typography
        as="div"
        appearance="subdued"
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

      <div className="grid grid-cols-2 gap-x-2 mt-4">
        <Button
          buttonType="tertiary"
          className="w-full"
          filled="weak"
          size="sm"
          onClick={onClose}
        >
          {t("premium::modal::buttons::download")}
        </Button>

        <Button
          buttonType="premium"
          className="w-full"
          leftIconPath="mdiDiamondStone"
          size="sm"
          onClick={onClose}
        >
          {t("premium::modal::buttons::premium")}
        </Button>
      </div>
    </Modal>
  );
};
