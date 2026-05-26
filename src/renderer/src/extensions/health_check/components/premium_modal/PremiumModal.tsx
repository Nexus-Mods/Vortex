import { mdiCheck, mdiDiamondStone, mdiOpenInNew } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { opn } from "../../../../util/api";
import { PREMIUM_PATH } from "../../../nexus_integration/constants";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon className="mt-0.5 shrink-0 text-premium-strong" path={mdiCheck} size="xs" />

    {children}
  </li>
);

export const PremiumModal = ({
  isOpen,
  downloadScope = "single",
  onClose,
  onDownload,
}: {
  isOpen: boolean;
  downloadScope?: "single" | "all";
  onClose: () => void;
  onDownload: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  const goPremium = React.useCallback(() => {
    opn(
      nexusModsURL(PREMIUM_PATH, {
        section: Section.Users,
        campaign: Campaign.BuyPremium,
        content: Content.HealthCheckAd,
      }),
    ).catch(() => undefined);
  }, []);

  return (
    <Modal isOpen={isOpen} title={t(`premium::modal::title::${downloadScope}`)} onClose={onClose}>
      <Typography appearance="subdued" as="div" className="space-y-2" typographyType="body-sm">
        <p className="whitespace-pre-line">{t(`premium::modal::description::${downloadScope}`)}</p>

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
          brand="neutral"
          appearance="moderate"
          className="w-full"
          appearance="moderate"
          leftIconPath={downloadScope === "single" && mdiOpenInNew}
          size="sm"
          onClick={onDownload}
        >
          {t(`premium::modal::buttons::secondary::${downloadScope}`)}
        </Button>

        <Button
          brand="premium"
          className="w-full"
          leftIconPath={mdiDiamondStone}
          size="sm"
          onClick={goPremium}
        >
          {t("premium::modal::buttons::primary")}
        </Button>
      </div>
    </Modal>
  );
};
