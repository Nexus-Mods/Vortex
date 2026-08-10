import React, { useEffect, useState } from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";

import { shouldShowPremiumAd } from "@/extensions/nexus_integration/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { PREMIUM_PATH } from "../../../nexus_integration/constants";
import { useOptionalIssue, useTracker } from "../../hooks/HealthCheckTracking.context";
import { usePremiumStatusRefresh } from "../../hooks/usePremiumStatusRefresh";

/** Where the premium banner is shown. */
export type BannerPlacement = "list" | "detail";

export const PremiumBanner = ({
  api,
  placement,
  totalIssues,
}: {
  api: IExtensionApi;
  placement: BannerPlacement;
  totalIssues: number;
}) => {
  const showPremiumAd = useSelector(shouldShowPremiumAd);
  const { trackPremiumBannerShown, trackPremiumBannerClicked } = useTracker();
  // Present on a detail page, absent on the cross-check listing.
  const identity = useOptionalIssue()?.identity;
  // Once they've followed the link, watch for the purchase so the banner stops selling
  // premium to somebody who now has it.
  const [sentToPremiumPage, setSentToPremiumPage] = useState(false);

  usePremiumStatusRefresh(api, sentToPremiumPage);

  useEffect(() => {
    if (showPremiumAd) {
      trackPremiumBannerShown({ ...identity, placement, total_issues: totalIssues });
    }
  }, [showPremiumAd, placement, totalIssues, identity, trackPremiumBannerShown]);

  if (!showPremiumAd) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-2 rounded-lg border border-stroke-weak p-3">
      <PremiumBadge />

      <Typography appearance="moderate" brand="neutral-translucent">
        <Trans
          components={{
            premiumLink: (
              <TypographyLink
                brand="neutral-translucent"
                typographyType="inherit"
                onClick={() => {
                  trackPremiumBannerClicked({ ...identity, placement, total_issues: totalIssues });
                  setSentToPremiumPage(true);

                  opn(
                    nexusModsURL(PREMIUM_PATH, {
                      section: Section.Users,
                      campaign: Campaign.BuyPremium,
                      content: Content.HealthCheckAd,
                    }),
                  ).catch(() => undefined);
                }}
              />
            ),
          }}
          i18nKey="listing::premium_banner::description"
          ns="health_check"
        />
      </Typography>
    </div>
  );
};
