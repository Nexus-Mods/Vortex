import { mdiCheck, mdiDiamondStone, mdiOpenInNew } from "@mdi/js";
import React, { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import opn from "../../../../util/opn";
import { PREMIUM_PATH } from "../../../nexus_integration/constants";
import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { useOptionalIssue, useTracker } from "../../hooks/HealthCheckTracking.context";

/** Which 1-click flow surfaced the premium upsell modal. */
export type PremiumTrigger = "single_install" | "batch_install" | "install_all";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon className="mt-0.5 shrink-0 text-premium-strong" path={mdiCheck} size="xs" />

    {children}
  </li>
);

/** Rendered only while the upsell is being shown; mounting is what opens it. */
export const PremiumModal = ({
  downloadScope = "single",
  modCount,
  modId,
  trigger,
  onClose,
  onDownload,
}: {
  downloadScope?: "single" | "all";
  modCount?: number;
  modId?: number;
  /** Which 1-click flow surfaced the upsell, for the analytics funnel. */
  trigger: PremiumTrigger;
  onClose: () => void;
  onDownload: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);
  const showPremiumAd = useSelector(shouldShowPremiumAd);

  // An upsell in front of a button that works reads as if the upgrade didn't take, so once the
  // page has re-read the membership (see useRefreshUserInfoOnFocus), get out of the way.
  React.useEffect(() => {
    if (!showPremiumAd) {
      onClose();
    }
  }, [showPremiumAd, onClose]);

  const {
    trackPremiumModalShown,
    trackPremiumModalDismissed,
    trackPremiumModalUnlockClicked,
    trackPremiumModalFallbackClicked,
  } = useTracker();
  // Absent for the cross-check install-all upsell raised from the listing.
  const identity = useOptionalIssue()?.identity;

  // mounting is what opens the upsell, so this runs exactly when it is shown
  useEffect(() => {
    trackPremiumModalShown({ ...identity, trigger, mod_id: modId, mod_count: modCount });
  }, [trigger, identity, modId, modCount, trackPremiumModalShown]);

  return (
    <Modal
      isOpen
      title={t(`premium::modal::title::${downloadScope}`)}
      onClose={() => {
        trackPremiumModalDismissed({ ...identity, trigger });
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
              ...identity,
              trigger,
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
              ...identity,
              trigger,
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
