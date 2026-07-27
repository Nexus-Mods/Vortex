import { mdiCheck, mdiDiamondStone, mdiOpenInNew } from "@mdi/js";
import React, { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { opn } from "../../../../util/api";
import { PREMIUM_PATH } from "../../../nexus_integration/constants";
import { useHealthCheckTracking } from "../../hooks/useHealthCheckTracking";

/** Which 1-click flow surfaced the premium upsell modal. */
export type PremiumTrigger = "single_install" | "batch_install" | "install_all";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon className="mt-0.5 shrink-0 text-premium-strong" path={mdiCheck} size="xs" />

    {children}
  </li>
);

/** Analytics context for the premium upsell modal. */
export interface IPremiumModalTracking {
  api: IExtensionApi;
  /** Which 1-click flow surfaced the upsell, for the analytics funnel. */
  trigger: PremiumTrigger;
  issueId?: string;
  modId?: number;
  modCount?: number;
}

export const PremiumModal = ({
  isOpen,
  downloadScope = "single",
  onClose,
  onDownload,
  tracking,
}: {
  isOpen: boolean;
  downloadScope?: "single" | "all";
  onClose: () => void;
  onDownload: () => void;
  tracking: IPremiumModalTracking;
}) => {
  const { t } = useTranslation(["health_check"]);
  const { api, trigger, issueId, modId, modCount } = tracking;

  const {
    trackPremiumModalShown,
    trackPremiumModalDismissed,
    trackPremiumModalUnlockClicked,
    trackPremiumModalFallbackClicked,
  } = useHealthCheckTracking(api);

  useEffect(() => {
    if (isOpen) {
      trackPremiumModalShown({
        trigger,
        issue_id: issueId,
        mod_id: modId,
        mod_count: modCount,
      });
    }
  }, [isOpen, trigger, issueId, modId, modCount, trackPremiumModalShown]);

  return (
    <Modal
      isOpen={isOpen}
      title={t(`premium::modal::title::${downloadScope}`)}
      onClose={() => {
        trackPremiumModalDismissed({ trigger, issue_id: issueId });
        onClose();
      }}
    >
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
          appearance="moderate"
          brand="neutral"
          className="w-full"
          leftIconPath={downloadScope === "single" && mdiOpenInNew}
          size="sm"
          onClick={() => {
            trackPremiumModalFallbackClicked({
              trigger,
              issue_id: issueId,
              mod_count: modCount,
              fallback_type: downloadScope === "single" ? "single_mod_page" : "batch_mod_pages",
            });

            onDownload();
          }}
        >
          {t(`premium::modal::buttons::secondary::${downloadScope}`)}
        </Button>

        <Button
          brand="premium"
          className="w-full"
          leftIconPath={mdiDiamondStone}
          size="sm"
          onClick={() => {
            trackPremiumModalUnlockClicked({
              trigger,
              issue_id: issueId,
              mod_count: modCount,
            });

            opn(
              nexusModsURL(PREMIUM_PATH, {
                section: Section.Users,
                campaign: Campaign.BuyPremium,
                content: Content.HealthCheckAd,
              }),
            ).catch(() => undefined);
          }}
        >
          {t("premium::modal::buttons::primary")}
        </Button>
      </div>
    </Modal>
  );
};
